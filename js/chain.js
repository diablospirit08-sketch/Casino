/* VOLT — on-chain cashier (BSC).
   MetaMask / injected wallets work instantly.
   WalletConnect (mobile wallets) loads lazily only when user picks it. */
(function(){
'use strict';

var API        = 'https://casino-production-2759.up.railway.app';
var PROJECT_ID = '93a532199ac4f47fc5e2e12f6b87dd7e';

/* ── ABI helpers ─────────────────────────────────────────────────────────── */
function pad32(hex){return hex.replace(/^0x/,'').padStart(64,'0');}
function toHexWei(n){return '0x'+BigInt(Math.round(n)).toString(16);}
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

if(typeof document==='undefined'){
  module.exports={pad32,encodeWithdraw,ethToWei,WITHDRAW_SELECTOR};
  return;
}

/* ── state ───────────────────────────────────────────────────────────────── */
var account=null, vaultAddr=null, chainIdHex=null, _provider=null;
var nativeW=WALLETS.find(function(w){return w.c==='BNB';});

function setLedgerBnb(amt){
  if(!nativeW)return;
  nativeW.amt=amt; nativeW.fiat=amt*(nativeW.rate||0);
  renderWallet(); if(window.gvCurSync)gvCurSync();
}

/* ── backend helpers ─────────────────────────────────────────────────────── */
function voltFetch(path,opts){
  return window.voltApi._fetch(path,opts).then(function(r){return r.json();})
    .then(function(j){if(j.error)throw new Error(j.error);return j;});
}
function refreshBalance(){
  return voltFetch('/api/wallet/balance/BNB')
    .then(function(j){setLedgerBnb(parseFloat(j.balance)||0);});
}
function rpc(method,params){
  return _provider.request({method:method,params:params||[]});
}

/* ── vault config ────────────────────────────────────────────────────────── */
function fetchVaultConfig(){
  if(vaultAddr)return Promise.resolve();
  return fetch(API+'/api/config').then(function(r){return r.json();})
    .then(function(cfg){
      vaultAddr=cfg.vaultAddress;
      chainIdHex='0x'+cfg.chainId.toString(16);
      if(!vaultAddr)throw new Error('Vault not configured on backend');
    });
}

/* ── save wallet to backend ──────────────────────────────────────────────── */
function saveWalletAddress(addr){
  return voltFetch('/api/wallet/connect-wallet-message?address='+addr)
    .then(function(j){
      return rpc('personal_sign',[
        '0x'+Array.from(new TextEncoder().encode(j.message))
          .map(function(b){return b.toString(16).padStart(2,'0');}).join(''),
        addr,
      ]);
    })
    .then(function(sig){
      return voltFetch('/api/wallet/connect-wallet',{
        method:'POST',
        body:JSON.stringify({address:addr,network:'bsc_testnet',signature:sig}),
      });
    })
    .catch(function(e){console.warn('saveWalletAddress:',e.message);});
}

/* ── after any wallet connects ───────────────────────────────────────────── */
function afterConnect(addr){
  account=addr;
  _provider.on&&_provider.on('accountsChanged',function(accs){
    account=accs[0]||null;
    if(window.bscCashier)window.bscCashier._onAccountChange();
  });
  return saveWalletAddress(account)
    .then(refreshBalance)
    .then(function(){
      if(!document.body.classList.contains('authed'))setAuth(true);
      if(voltCur!=='BNB'){voltCur='BNB';localStorage.setItem(LS_CUR,voltCur);renderWallet();if(window.gvCurSync)gvCurSync();}
      if(window.bscCashier)window.bscCashier._onAccountChange();
    });
}

/* ── connect MetaMask / injected wallet ──────────────────────────────────── */
function connectInjected(){
  var provider=window.ethereum;
  if(!provider){
    showToast({icon:'⚠',title:'No wallet found',sub:'Please install MetaMask or a browser wallet.'});
    return Promise.reject(new Error('No injected wallet'));
  }
  /* prefer MetaMask when multiple providers exist */
  if(provider.providers&&provider.providers.length){
    provider=provider.providers.find(function(p){return p.isMetaMask&&!p.isTrust;})||provider;
  }
  _provider=provider;
  return fetchVaultConfig()
    .then(function(){return rpc('wallet_switchEthereumChain',[{chainId:chainIdHex}]);})
    .catch(function(e){
      if(e.code!==4902)throw e;
      return rpc('wallet_addEthereumChain',[{
        chainId:chainIdHex,chainName:'BNB Smart Chain Testnet',
        rpcUrls:['https://data-seed-prebsc-1-s1.binance.org:8545/'],
        nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18},
        blockExplorerUrls:['https://testnet.bscscan.com'],
      }]);
    })
    .then(function(){return rpc('eth_requestAccounts');})
    .then(function(accs){return afterConnect(accs[0]);});
}

/* ── connect via WalletConnect (mobile wallets) ──────────────────────────── */
function connectWalletConnect(){
  /* hide deposit modal so the WC QR overlay isn't buried behind it */
  var depOverlay=document.getElementById('depOverlay');
  depOverlay&&depOverlay.classList.remove('open');

  /* dynamic import() works in regular scripts — only top-level import fails */
  return import('https://esm.sh/@walletconnect/ethereum-provider@2.17.3')
    .then(function(mod){
      var Provider=mod.default||mod.EthereumProvider;
      if(!Provider)throw new Error('WalletConnect library unavailable');
      return Provider.init({
        projectId:PROJECT_ID,
        chains:[97],
        optionalChains:[56],
        showQrModal:true,
        qrModalOptions:{themeMode:'dark',themeVariables:{'--wcm-accent-color':'#41f0a4'}},
        metadata:{
          name:'VOLT Casino',
          description:'Crypto Casino',
          url:location.origin,
          icons:[location.origin+'/favicon.ico'],
        },
      });
    })
    .then(function(wcp){_provider=wcp;return wcp.enable();})
    .then(function(accs){
      /* reopen deposit modal after successful connection */
      depOverlay&&depOverlay.classList.add('open');
      return afterConnect(accs[0]);
    })
    .catch(function(e){
      /* reopen deposit modal if user cancels or error occurs */
      depOverlay&&depOverlay.classList.add('open');
      throw e;
    });
}

/* ── connect Coinbase Wallet ─────────────────────────────────────────────── */
function connectCoinbase(){
  var cbProvider=window.coinbaseWalletExtension
    ||(window.ethereum&&window.ethereum.isCoinbaseWallet?window.ethereum:null);
  if(!cbProvider){
    showToast({icon:'⚠',title:'Coinbase Wallet not found',sub:'Please install the Coinbase Wallet extension.'});
    return Promise.reject(new Error('Coinbase Wallet not installed'));
  }
  _provider=cbProvider;
  return fetchVaultConfig()
    .then(function(){return rpc('eth_requestAccounts');})
    .then(function(accs){return afterConnect(accs[0]);});
}

/* ── connect Trust Wallet ────────────────────────────────────────────────── */
function connectTrust(){
  /* Trust Wallet injects window.trustwallet, or sets isTrust on window.ethereum */
  var provider=window.trustwallet
    ||(window.ethereum&&window.ethereum.isTrust?window.ethereum:null);
  if(!provider&&window.ethereum&&window.ethereum.providers){
    provider=window.ethereum.providers.find(function(p){return p.isTrust;})||null;
  }
  if(!provider){
    showToast({icon:'⚠',title:'Trust Wallet not found',sub:'Please install the Trust Wallet browser extension.'});
    return Promise.reject(new Error('Trust Wallet not installed'));
  }
  _provider=provider;
  return fetchVaultConfig()
    .then(function(){return rpc('eth_requestAccounts');})
    .then(function(accs){return afterConnect(accs[0]);});
}

/* ── disconnect ──────────────────────────────────────────────────────────── */
function disconnect(){
  if(_provider&&_provider.disconnect)_provider.disconnect();
  account=null; _provider=null;
  if(window.bscCashier)window.bscCashier._onAccountChange();
}

/* ── wait for tx ─────────────────────────────────────────────────────────── */
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

/* ── deposit ─────────────────────────────────────────────────────────────── */
function depositEth(amountEth){
  var txHash;
  return fetchVaultConfig()
    .then(function(){
      return rpc('eth_sendTransaction',[{
        from:account, to:vaultAddr, value:toHexWei(ethToWei(amountEth)),
      }]);
    })
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
  return fetchVaultConfig()
    .then(function(){
      return voltFetch('/api/wallet/sign-withdrawal',{
        method:'POST',
        body:JSON.stringify({amountBnb:amountEth,playerAddress:account,network:'bsc_testnet'}),
      });
    })
    .then(function(v){
      return rpc('eth_sendTransaction',[{
        from:account, to:vaultAddr,
        data:encodeWithdraw(v.amountWei,v.nonce,v.deadline,v.signature),
      }]);
    })
    .then(waitForReceipt)
    .then(function(rec){
      if(rec.status!=='0x1')throw new Error('Withdrawal transaction reverted');
      return refreshBalance();
    });
}

/* ── wallet picker UI ────────────────────────────────────────────────────── */
var WALLET_OPTS=[
  {id:'metamask',  label:'MetaMask',        icon:'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg',       fn:connectInjected},
  {id:'wc',        label:'WalletConnect',   icon:'https://avatars.githubusercontent.com/u/37784886?s=48',                     fn:connectWalletConnect},
  {id:'coinbase',  label:'Coinbase Wallet', icon:'https://avatars.githubusercontent.com/u/18060234?s=48',                     fn:connectCoinbase},
  {id:'trust',     label:'Trust Wallet',    icon:'https://trustwallet.com/assets/images/media/assets/TWT.png',                fn:connectTrust},
];

function pickerHTML(){
  return '<hr style="border:none;border-top:1px solid var(--line-2);margin:16px 0">'
    +'<p class="dep-lbl" style="margin-top:0">Connect Wallet</p>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    +WALLET_OPTS.map(function(w){
      return '<button class="bsc-w-btn" data-wid="'+w.id+'" style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--panel-2);border:1px solid var(--line-2);border-radius:10px;color:var(--txt);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:.15s" onmouseover="this.style.borderColor=\'var(--mint)\'" onmouseout="this.style.borderColor=\'var(--line-2)\'">'
        +'<img src="'+w.icon+'" style="width:22px;height:22px;border-radius:4px;object-fit:contain" onerror="this.style.display=\'none\'">'
        +w.label+'</button>';
    }).join('')
    +'</div>'
    +'<p id="bscMsg" style="font-size:11px;color:var(--muted);margin-top:8px;min-height:14px"></p>';
}

function connectedHTML(section){
  var bnbBal=nativeW?nativeW.amt:0;
  var isWd=section==='wd';
  return '<hr style="border:none;border-top:1px solid var(--line-2);margin:16px 0">'
    +'<p class="dep-lbl" style="margin-top:0">'+(isWd?'Live BNB Withdrawal':'Live BNB Deposit')+'</p>'
    +'<p style="font-size:12px;color:var(--muted);margin-bottom:10px">Connected: <span style="color:var(--mint)">'+short(account)+'</span>'
    +(isWd?' · Available: <b style="color:var(--txt)">'+bnbBal.toFixed(4)+' BNB</b>':'')
    +' <button id="bscDisc" style="background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;text-decoration:underline;margin-left:6px">Disconnect</button></p>'
    +'<div class="gv-input" style="margin-bottom:10px">'
    +'<input id="bscAmt" type="number" min="0.001" step="0.001" placeholder="BNB amount" style="background:transparent;border:none;outline:none;color:var(--txt);font-family:inherit;font-size:14px;width:100%;padding:0"/>'
    +'<button class="mod" id="bscMax">Max</button>'
    +'</div>'
    +'<button id="bscAction" class="auth-submit" style="margin-top:0">'+(isWd?'Cash Out BNB':'Deposit BNB')+'</button>'
    +'<p id="bscMsg" style="font-size:11px;color:var(--muted);margin-top:8px;min-height:14px"></p>';
}

function short(a){return a.slice(0,6)+'…'+a.slice(-4);}

function wireSection(el,section){
  el.querySelector('#bscDisc')&&el.querySelector('#bscDisc').addEventListener('click',function(){
    disconnect(); renderSection(el,section);
  });
  var amtEl=el.querySelector('#bscAmt');
  var bnbBal=nativeW?nativeW.amt:0;
  el.querySelector('#bscMax')&&el.querySelector('#bscMax').addEventListener('click',function(){
    amtEl.value=bnbBal.toFixed(4);
  });
  el.querySelector('#bscAction')&&el.querySelector('#bscAction').addEventListener('click',function(){
    var a=parseFloat(amtEl.value)||0;
    if(a<=0){el.querySelector('#bscMsg').textContent='Enter a BNB amount';return;}
    var btn=el.querySelector('#bscAction');
    btn.disabled=true; btn.textContent=section==='wd'?'Processing…':'Sending…';
    var fn=section==='wd'?cashOut(Math.min(a,bnbBal)):depositEth(a);
    fn.then(function(){
      btn.disabled=false; btn.textContent=section==='wd'?'Cash Out BNB':'Deposit BNB';
      amtEl.value=''; el.querySelector('#bscMsg').textContent='';
      showToast(section==='wd'
        ?{icon:'↗',title:'Withdrawal sent',sub:'BNB sent to your wallet'}
        :{icon:'↙',title:'Deposit confirmed',sub:'BNB balance updated'});
    }).catch(function(e){
      btn.disabled=false; btn.textContent=section==='wd'?'Cash Out BNB':'Deposit BNB';
      el.querySelector('#bscMsg').textContent=e.message;
    });
  });
  /* wallet picker clicks */
  el.addEventListener('click',function(e){
    var btn=e.target.closest('.bsc-w-btn'); if(!btn)return;
    var wid=btn.dataset.wid;
    var opt=WALLET_OPTS.find(function(w){return w.id===wid;});
    if(!opt)return;
    btn.disabled=true; btn.textContent='Connecting…';
    var msgEl=el.querySelector('#bscMsg');
    if(msgEl)msgEl.textContent='';
    opt.fn().then(function(){
      renderSection(el,section);
      showToast({icon:'🔗',title:'Wallet connected',sub:'BNB balance is live'});
    }).catch(function(e){
      btn.disabled=false;
      btn.innerHTML='<img src="'+opt.icon+'" style="width:22px;height:22px;border-radius:4px;object-fit:contain" onerror="this.style.display=\'none\'">'+opt.label;
      if(msgEl)msgEl.textContent=e.message;
    });
  });
}

function renderSection(el,section){
  if(!el)return;
  el.innerHTML=account?connectedHTML(section):pickerHTML();
  wireSection(el,section);
}

/* ── inject containers ───────────────────────────────────────────────────── */
var BSC_DEP_ID='bscDepSection', BSC_WD_ID='bscWdSection';
(function(){
  var depView=document.getElementById('depView');
  var wdView=document.getElementById('wdView');
  if(depView&&!document.getElementById(BSC_DEP_ID)){
    var d=document.createElement('div');d.id=BSC_DEP_ID;depView.appendChild(d);
  }
  if(wdView&&!document.getElementById(BSC_WD_ID)){
    var w=document.createElement('div');w.id=BSC_WD_ID;wdView.appendChild(w);
  }
})();

function renderBscDeposit(){renderSection(document.getElementById(BSC_DEP_ID),'dep');}
function renderBscWithdraw(){renderSection(document.getElementById(BSC_WD_ID),'wd');}

/* ── dedicated wallet connect modal ─────────────────────────────────────── */
function openWalletModal(){
  var overlay=document.getElementById('walletPickerOverlay');
  var body=document.getElementById('walletPickerBody');
  if(!overlay||!body)return;
  body.innerHTML='';
  var el=document.createElement('div');
  body.appendChild(el);
  renderSection(el,'dep');
  overlay.classList.add('open');
}
function closeWalletModal(){
  var overlay=document.getElementById('walletPickerOverlay');
  if(overlay)overlay.classList.remove('open');
}
window.openWalletModal=openWalletModal;

/* ── public API ──────────────────────────────────────────────────────────── */
window.bscCashier={
  isConnected:function(){return !!account;},
  getAccount:function(){return account;},
  disconnect:disconnect,
  renderBscDeposit:renderBscDeposit,
  renderBscWithdraw:renderBscWithdraw,
  _onAccountChange:function(){renderBscDeposit();renderBscWithdraw();},
};

/* ── MutationObserver: render when cashier modal opens ───────────────────── */
function selectedCoinIn(id){
  var sel=document.querySelector('#'+id+' .dep-coin.sel');
  return sel?sel.dataset.c:null;
}

new MutationObserver(function(){
  var overlay=document.getElementById('depOverlay');
  if(!overlay.classList.contains('open'))return;
  if(selectedCoinIn('depCoins')==='BNB')renderBscDeposit();
  if(selectedCoinIn('wdCoins')==='BNB')renderBscWithdraw();
}).observe(document.getElementById('depOverlay'),{attributes:true,attributeFilter:['class']});

document.getElementById('depCoins').addEventListener('click',function(e){
  var b=e.target.closest('.dep-coin');if(!b)return;
  var sec=document.getElementById(BSC_DEP_ID);
  if(b.dataset.c==='BNB')setTimeout(renderBscDeposit,50);
  else if(sec)sec.innerHTML='';
});

document.getElementById('wdCoins').addEventListener('click',function(e){
  var b=e.target.closest('.dep-coin');if(!b)return;
  var sec=document.getElementById(BSC_WD_ID);
  if(b.dataset.c==='BNB')setTimeout(renderBscWithdraw,50);
  else if(sec)sec.innerHTML='';
});

document.getElementById('depTabs').addEventListener('click',function(e){
  var t=e.target.closest('.auth-tab');if(!t)return;
  setTimeout(function(){
    if(t.dataset.mode==='dep'&&selectedCoinIn('depCoins')==='BNB')renderBscDeposit();
    if(t.dataset.mode==='wd'&&selectedCoinIn('wdCoins')==='BNB')renderBscWithdraw();
  },50);
});

/* handle case where modal is already open when script runs */
if(document.getElementById('depOverlay').classList.contains('open')){
  if(selectedCoinIn('depCoins')==='BNB')renderBscDeposit();
  if(selectedCoinIn('wdCoins')==='BNB')renderBscWithdraw();
}

})();
