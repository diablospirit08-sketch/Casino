/* VOLT — on-chain cashier bridge (BSC / VoltVault).
   Requires MetaMask + backend running at http://localhost:4000.
   No MetaMask → bscCashier never defined; deposit modal works as normal. */
(function(){
'use strict';

var API='https://casino-production-2759.up.railway.app';

/* ── ABI helpers ──────────────────────────────────────────────────────────── */
function pad32(hex){return hex.replace(/^0x/,'').padStart(64,'0');}
function toHexWei(n){return '0x'+n.toString(16);}
var WITHDRAW_SELECTOR='0xfe55892d';
function encodeWithdraw(amount,nonce,deadline,signature){
  var sig=signature.replace(/^0x/,'');
  var sigLen=sig.length/2;
  var sigPadded=sig.padEnd(Math.ceil(sigLen/32)*64,'0');
  return WITHDRAW_SELECTOR
    +pad32(BigInt(amount).toString(16))
    +pad32(BigInt(nonce).toString(16))
    +pad32(BigInt(deadline).toString(16))
    +pad32((0x80).toString(16))
    +pad32(sigLen.toString(16))
    +sigPadded;
}
function ethToWei(x){return BigInt(Math.round(x*1e18));}
function weiToEth(wei){return Number(BigInt(wei))/1e18;}

if(typeof document==='undefined'){
  module.exports={pad32:pad32,encodeWithdraw:encodeWithdraw,ethToWei:ethToWei,weiToEth:weiToEth,WITHDRAW_SELECTOR:WITHDRAW_SELECTOR};
  return;
}
if(!window.ethereum)return;

/* prefer MetaMask over Trust Wallet / TronLink */
var _provider=(function(){
  var providers=window.ethereum.providers;
  if(providers&&providers.length){
    return providers.find(function(p){return p.isMetaMask&&!p.isTrust&&!p.isTronLink;})||window.ethereum;
  }
  return window.ethereum;
})();

/* ── state ──────────────────────────────────────────────────────────────── */
var account=null,vaultAddr=null,chainIdHex=null;
var nativeW=WALLETS.find(function(w){return w.c==='BNB';});

function setLedgerBnb(amt){
  if(!nativeW)return;
  nativeW.amt=amt;nativeW.fiat=amt*(nativeW.rate||0);
  renderWallet();if(window.gvCurSync)gvCurSync();
}

/* ── backend API (auth-aware) ────────────────────────────────────────────── */
function voltFetch(path,opts){
  return window.voltApi._fetch(path,opts).then(function(r){return r.json();})
    .then(function(j){if(j.error)throw new Error(j.error);return j;});
}

function refreshBalance(){
  return voltFetch('/api/wallet/balance/BNB')
    .then(function(j){setLedgerBnb(parseFloat(j.balance)||0);});
}

/* ── MetaMask plumbing ───────────────────────────────────────────────────── */
function rpc(method,params){return _provider.request({method:method,params:params||[]});}

var BSC_CHAINS={
  '0x38':{chainId:'0x38',chainName:'BNB Smart Chain',rpcUrls:['https://bsc-dataseed.binance.org/'],nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18},blockExplorerUrls:['https://bscscan.com']},
  '0x61':{chainId:'0x61',chainName:'BNB Smart Chain Testnet',rpcUrls:['https://data-seed-prebsc-1-s1.binance.org:8545/'],nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18},blockExplorerUrls:['https://testnet.bscscan.com']},
};

function ensureChain(){
  return rpc('wallet_switchEthereumChain',[{chainId:chainIdHex}]).catch(function(e){
    if(e.code!==4902)throw e;
    var def=BSC_CHAINS[chainIdHex.toLowerCase()];
    if(def)return rpc('wallet_addEthereumChain',[def]);
    throw new Error('Please add chain '+parseInt(chainIdHex,16)+' to MetaMask');
  });
}

function waitForReceipt(txHash){
  return new Promise(function(resolve,reject){
    var tries=0;
    (function poll(){
      rpc('eth_getTransactionReceipt',[txHash]).then(function(r){
        if(r)return resolve(r);
        if(++tries>60)return reject(new Error('Transaction not mined after 60s'));
        setTimeout(poll,1000);
      },reject);
    })();
  });
}

/* ── connect wallet ──────────────────────────────────────────────────────── */
function connect(){
  return fetch(API+'/api/config').then(function(r){return r.json();})
    .then(function(cfg){
      vaultAddr=cfg.vaultAddress;
      chainIdHex='0x'+cfg.chainId.toString(16);
      if(!vaultAddr)throw new Error('Vault not configured on backend');
    })
    .then(ensureChain)
    .then(function(){return rpc('eth_requestAccounts');})
    .then(function(accs){
      account=accs[0];
      _provider.on&&_provider.on('accountsChanged',function(accs){
        account=accs[0]||null;
        if(account){saveWalletAddress(account).then(function(){refreshBalance();});}
        if(window.bscCashier)window.bscCashier._onAccountChange();
      });
    })
    .then(function(){return saveWalletAddress(account);})
    .then(function(){return refreshBalance();})
    .then(function(){
      if(!document.body.classList.contains('authed'))setAuth(true);
      if(voltCur!=='BNB'){voltCur='BNB';localStorage.setItem(LS_CUR,voltCur);renderWallet();if(window.gvCurSync)gvCurSync();}
    });
}

function saveWalletAddress(addr){
  var network='bsc_testnet';
  return voltFetch('/api/wallet/connect-wallet-message?address='+addr)
    .then(function(j){
      return rpc('personal_sign',[
        '0x'+Array.from(new TextEncoder().encode(j.message)).map(function(b){return b.toString(16).padStart(2,'0');}).join(''),
        addr,
      ]);
    })
    .then(function(signature){
      return voltFetch('/api/wallet/connect-wallet',{
        method:'POST',
        body:JSON.stringify({address:addr,network:network,signature:signature}),
      });
    })
    .catch(function(e){console.warn('saveWalletAddress:',e.message);});
}

/* ── deposit ─────────────────────────────────────────────────────────────── */
function depositEth(amountEth){
  var wei=ethToWei(amountEth);
  var txHash;
  return rpc('eth_sendTransaction',[{from:account,to:vaultAddr,value:toHexWei(wei)}])
    .then(function(hash){txHash=hash;return waitForReceipt(hash);})
    .then(function(){
      return voltFetch('/api/deposits/verify-tx',{
        method:'POST',
        body:JSON.stringify({txHash:txHash,network:'bsc_testnet'}),
      });
    })
    .then(function(j){setLedgerBnb(parseFloat(j.balance)||0);});
}

/* ── cash out ────────────────────────────────────────────────────────────── */
function cashOut(amountEth){
  var network='bsc_testnet';
  return voltFetch('/api/wallet/sign-withdrawal',{
    method:'POST',
    body:JSON.stringify({amountBnb:amountEth,playerAddress:account,network:network}),
  }).then(function(v){
    return rpc('eth_sendTransaction',[{
      from:account,
      to:vaultAddr,
      data:encodeWithdraw(v.amountWei,v.nonce,v.deadline,v.signature),
    }]);
  }).then(waitForReceipt).then(function(rec){
    if(rec.status!=='0x1')throw new Error('Withdrawal transaction reverted');
    return refreshBalance();
  });
}

/* ── cashier section injected into BNB deposit / withdraw views ──────────── */
var BSC_DEP_ID='bscDepSection';
var BSC_WD_ID='bscWdSection';

function short(a){return a.slice(0,6)+'…'+a.slice(-4);}

function renderBscDeposit(){
  var el=document.getElementById(BSC_DEP_ID);
  if(!el)return;
  if(!account){
    el.innerHTML='<hr style="border:none;border-top:1px solid var(--line-2);margin:16px 0"><p class="dep-lbl" style="margin-top:0">MetaMask — Live BNB Deposit</p>'
      +'<button id="bscConnectBtn" class="auth-submit" style="margin-top:0">Connect Wallet</button>'
      +'<p id="bscMsg" style="font-size:11px;color:var(--muted);margin-top:8px;min-height:14px"></p>';
    var btn=el.querySelector('#bscConnectBtn');
    btn.addEventListener('click',function(){
      btn.disabled=true;btn.textContent='Connecting…';
      connect().then(function(){
        renderBscDeposit();
        showToast({icon:'🔗',title:'Wallet connected',sub:'BNB balance is live'});
      }).catch(function(e){
        btn.disabled=false;btn.textContent='Connect Wallet';
        el.querySelector('#bscMsg').textContent=e.message;
      });
    });
  } else {
    var bnbBal=nativeW?nativeW.amt:0;
    el.innerHTML='<hr style="border:none;border-top:1px solid var(--line-2);margin:16px 0"><p class="dep-lbl" style="margin-top:0">MetaMask — Live BNB Deposit</p>'
      +'<p style="font-size:12px;color:var(--muted);margin-bottom:10px">Connected: <span style="color:var(--mint)">'+short(account)+'</span></p>'
      +'<div class="gv-input" style="margin-bottom:10px">'
      +'<input id="bscDepAmt" type="number" min="0.001" step="0.001" placeholder="BNB amount" style="background:transparent;border:none;outline:none;color:var(--txt);font-family:inherit;font-size:14px;width:100%;padding:0"/>'
      +'<button class="mod" id="bscDepMax">Max</button>'
      +'</div>'
      +'<button id="bscDepBtn" class="auth-submit" style="margin-top:0">Deposit BNB</button>'
      +'<p id="bscMsg" style="font-size:11px;color:var(--muted);margin-top:8px;min-height:14px"></p>';
    var amtEl=el.querySelector('#bscDepAmt');
    el.querySelector('#bscDepMax').addEventListener('click',function(){amtEl.value=bnbBal.toFixed(4);});
    el.querySelector('#bscDepBtn').addEventListener('click',function(){
      var a=parseFloat(amtEl.value)||0;
      if(a<=0){el.querySelector('#bscMsg').textContent='Enter a BNB amount';return;}
      var depBtn=el.querySelector('#bscDepBtn');
      depBtn.disabled=true;depBtn.textContent='Sending…';
      depositEth(a).then(function(){
        depBtn.disabled=false;depBtn.textContent='Deposit BNB';
        amtEl.value='';
        el.querySelector('#bscMsg').textContent='';
        showToast({icon:'↙',title:'Deposit confirmed',sub:'BNB balance updated'});
      }).catch(function(e){
        depBtn.disabled=false;depBtn.textContent='Deposit BNB';
        el.querySelector('#bscMsg').textContent=e.message;
      });
    });
  }
}

function renderBscWithdraw(){
  var el=document.getElementById(BSC_WD_ID);
  if(!el)return;
  if(!account){
    el.innerHTML='<hr style="border:none;border-top:1px solid var(--line-2);margin:16px 0"><p class="dep-lbl" style="margin-top:0">MetaMask — Live BNB Withdrawal</p>'
      +'<button id="bscWdConnectBtn" class="auth-submit" style="margin-top:0">Connect Wallet</button>'
      +'<p id="bscWdMsg" style="font-size:11px;color:var(--muted);margin-top:8px;min-height:14px"></p>';
    var btn=el.querySelector('#bscWdConnectBtn');
    btn.addEventListener('click',function(){
      btn.disabled=true;btn.textContent='Connecting…';
      connect().then(function(){
        renderBscWithdraw();
        showToast({icon:'🔗',title:'Wallet connected',sub:'BNB balance is live'});
      }).catch(function(e){
        btn.disabled=false;btn.textContent='Connect Wallet';
        el.querySelector('#bscWdMsg').textContent=e.message;
      });
    });
  } else {
    var bnbBal=nativeW?nativeW.amt:0;
    el.innerHTML='<hr style="border:none;border-top:1px solid var(--line-2);margin:16px 0"><p class="dep-lbl" style="margin-top:0">MetaMask — Live BNB Withdrawal</p>'
      +'<p style="font-size:12px;color:var(--muted);margin-bottom:10px">Connected: <span style="color:var(--mint)">'+short(account)+'</span> · Available: <b style="color:var(--txt)">'+bnbBal.toFixed(4)+' BNB</b></p>'
      +'<div class="gv-input" style="margin-bottom:10px">'
      +'<input id="bscWdAmt" type="number" min="0.001" step="0.001" placeholder="BNB amount" style="background:transparent;border:none;outline:none;color:var(--txt);font-family:inherit;font-size:14px;width:100%;padding:0"/>'
      +'<button class="mod" id="bscWdMax">Max</button>'
      +'</div>'
      +'<button id="bscWdBtn" class="auth-submit" style="margin-top:0">Cash Out BNB</button>'
      +'<p id="bscWdMsg" style="font-size:11px;color:var(--muted);margin-top:8px;min-height:14px"></p>';
    var amtEl=el.querySelector('#bscWdAmt');
    el.querySelector('#bscWdMax').addEventListener('click',function(){amtEl.value=bnbBal.toFixed(4);});
    el.querySelector('#bscWdBtn').addEventListener('click',function(){
      var a=Math.min(parseFloat(amtEl.value)||0,bnbBal);
      if(a<=0){el.querySelector('#bscWdMsg').textContent='Enter a BNB amount';return;}
      var wdBtn=el.querySelector('#bscWdBtn');
      wdBtn.disabled=true;wdBtn.textContent='Processing…';
      cashOut(a).then(function(){
        wdBtn.disabled=false;wdBtn.textContent='Cash Out BNB';
        amtEl.value='';
        el.querySelector('#bscWdMsg').textContent='';
        showToast({icon:'↗',title:'Withdrawal sent',sub:'BNB sent to your wallet'});
      }).catch(function(e){
        wdBtn.disabled=false;wdBtn.textContent='Cash Out BNB';
        el.querySelector('#bscWdMsg').textContent=e.message;
      });
    });
  }
}

/* ── inject BSC sections into the deposit modal ──────────────────────────── */
(function injectSections(){
  var depView=document.getElementById('depView');
  var wdView=document.getElementById('wdView');
  if(depView&&!document.getElementById(BSC_DEP_ID)){
    var sec=document.createElement('div');
    sec.id=BSC_DEP_ID;
    depView.appendChild(sec);
  }
  if(wdView&&!document.getElementById(BSC_WD_ID)){
    var sec2=document.createElement('div');
    sec2.id=BSC_WD_ID;
    wdView.appendChild(sec2);
  }
})();

/* ── public API ──────────────────────────────────────────────────────────── */
window.bscCashier={
  isConnected:function(){return !!account;},
  getAccount:function(){return account;},
  connect:connect,
  depositEth:depositEth,
  cashOut:cashOut,
  refreshBalance:refreshBalance,
  renderBscDeposit:renderBscDeposit,
  renderBscWithdraw:renderBscWithdraw,
  _onAccountChange:function(){renderBscDeposit();renderBscWithdraw();},
};

/* render sections when BNB is selected and modal opens */
function selectedCoinIn(coinsId){
  var sel=document.querySelector('#'+coinsId+' .dep-coin.sel');
  return sel?sel.dataset.c:null;
}
document.getElementById('walletDep').addEventListener('click',function(){
  setTimeout(function(){
    if(selectedCoinIn('depCoins')==='BNB')renderBscDeposit();
  },50);
});
document.getElementById('depCoins')&&document.getElementById('depCoins').addEventListener('click',function(e){
  var b=e.target.closest('.dep-coin');
  if(!b)return;
  var sec=document.getElementById(BSC_DEP_ID);
  if(b.dataset.c==='BNB'){setTimeout(renderBscDeposit,50);}
  else if(sec){sec.innerHTML='';}
});
document.getElementById('wdCoins')&&document.getElementById('wdCoins').addEventListener('click',function(e){
  var b=e.target.closest('.dep-coin');
  if(!b)return;
  var sec=document.getElementById(BSC_WD_ID);
  if(b.dataset.c==='BNB'){setTimeout(renderBscWithdraw,50);}
  else if(sec){sec.innerHTML='';}
});
var depTabsEl=document.getElementById('depTabs');
depTabsEl&&depTabsEl.addEventListener('click',function(e){
  var t=e.target.closest('.auth-tab');
  if(!t)return;
  setTimeout(function(){
    if(t.dataset.mode==='dep'&&selectedCoinIn('depCoins')==='BNB')renderBscDeposit();
    if(t.dataset.mode==='wd'&&selectedCoinIn('wdCoins')==='BNB')renderBscWithdraw();
  },50);
});
})();
