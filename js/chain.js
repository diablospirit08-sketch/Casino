/* VOLT — on-chain cashier bridge (BSC / VoltVault).
   Requires MetaMask + backend running at http://localhost:4000.
   No MetaMask → widget never appears; demo behaves as before. */
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
var ethW=nativeW;

function setLedgerBnb(amt){
  if(!nativeW)return;
  nativeW.amt=amt;nativeW.fiat=amt*nativeW.rate;
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
  /* 1. fetch vault address + chainId from backend */
  return fetch(API+'/api/config').then(function(r){return r.json();})
    .then(function(cfg){
      vaultAddr=cfg.vaultAddress;
      chainIdHex='0x'+cfg.chainId.toString(16);
      if(!vaultAddr)throw new Error('Vault not configured on backend');
    })
    /* 2. switch MetaMask to the right chain */
    .then(ensureChain)
    /* 3. request accounts */
    .then(function(){return rpc('eth_requestAccounts');})
    .then(function(accs){
      account=accs[0];
      _provider.on&&_provider.on('accountsChanged',function(accs){
        account=accs[0]||null;
        if(account){saveWalletAddress(account).then(function(){refreshBalance();});}
        else ui.disconnected();
        ui.render();
      });
    })
    /* 4. link wallet to casino account (sign a message) */
    .then(function(){return saveWalletAddress(account);})
    /* 5. load balance */
    .then(function(){return refreshBalance();})
    .then(function(){
      if(!document.body.classList.contains('authed'))setAuth(true);
      if(voltCur!=='BNB'){voltCur='BNB';localStorage.setItem(LS_CUR,voltCur);renderWallet();if(window.gvCurSync)gvCurSync();}
      ui.render();
      ui.flash('Wallet connected — BNB balance is live');
    });
}

/* sign a message to prove wallet ownership, then POST to backend */
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
    .catch(function(e){
      /* non-fatal: user rejected sign or already linked */
      console.warn('saveWalletAddress:',e.message);
    });
}

/* ── deposit ─────────────────────────────────────────────────────────────── */
function depositEth(amountEth){
  var wei=ethToWei(amountEth);
  var txHash;
  return rpc('eth_sendTransaction',[{from:account,to:vaultAddr,value:toHexWei(wei)}])
    .then(function(hash){txHash=hash;return waitForReceipt(hash);})
    .then(function(){
      /* Submit tx hash directly — backend verifies on-chain and credits ledger */
      return voltFetch('/api/deposits/verify-tx',{
        method:'POST',
        body:JSON.stringify({txHash:txHash,network:'bsc_testnet'}),
      });
    })
    .then(function(j){
      setLedgerBnb(parseFloat(j.balance)||0);
    });
}

/* ── cash out (EIP-712 voucher) ──────────────────────────────────────────── */
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

/* ── widget ──────────────────────────────────────────────────────────────── */
var ui=(function(){
  var css='#chainBar{position:fixed;right:16px;bottom:16px;z-index:400;background:#141a26;border:1px solid #2a3447;border-radius:12px;padding:10px 12px;font:12px/1.5 Inter,system-ui,sans-serif;color:#dbe2ef;box-shadow:0 8px 28px rgba(0,0,0,.45);min-width:208px}'
    +'#chainBar b{color:#8a93a6;font-weight:600;letter-spacing:.4px;font-size:10px;text-transform:uppercase;display:block;margin-bottom:6px}'
    +'#chainBar .cb-row{display:flex;gap:6px;margin-top:6px}'
    +'#chainBar input{flex:1;min-width:0;background:#0d121c;border:1px solid #2a3447;border-radius:8px;color:#fff;padding:5px 8px;font-size:12px}'
    +'#chainBar button{background:#1fff8f;color:#06281a;border:0;border-radius:8px;padding:5px 10px;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap}'
    +'#chainBar button.alt{background:#222c3e;color:#dbe2ef}'
    +'#chainBar button:disabled{opacity:.45;cursor:default}'
    +'#chainBar .cb-msg{margin-top:6px;color:#8a93a6;min-height:14px}'
    +'#chainBar .cb-addr{color:#1fff8f}';
  var style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  var el=document.createElement('div');el.id='chainBar';document.body.appendChild(el);
  var msgT=null;
  function flash(m){var n=el.querySelector('.cb-msg');if(n){n.textContent=m;clearTimeout(msgT);msgT=setTimeout(function(){n.textContent='';},6000);}}
  function busy(b){el.querySelectorAll('button').forEach(function(x){x.disabled=b;});}
  function short(a){return a.slice(0,6)+'…'+a.slice(-4);}
  function render(){
    if(!account){
      el.innerHTML='<b>BSC Cashier</b>'
        +'<div class="cb-row"><button id="cbConnect">Connect Wallet</button></div>'
        +'<div class="cb-msg"></div>';
      el.querySelector('#cbConnect').addEventListener('click',function(){
        busy(true);
        connect().catch(function(e){flash(e.message);}).then(function(){busy(false);render();});
      });
      return;
    }
    el.innerHTML='<b>BSC · <span class="cb-addr">'+short(account)+'</span></b>'
      +'<div class="cb-row"><input id="cbAmt" type="number" min="0.001" step="0.001" placeholder="BNB amount"><button id="cbDep">Deposit</button><button id="cbWd" class="alt">Cash out</button></div>'
      +'<div class="cb-msg"></div>';
    var amt=el.querySelector('#cbAmt');
    function val(){return parseFloat(amt.value)||0;}
    el.querySelector('#cbDep').addEventListener('click',function(){
      if(val()<=0)return flash('Enter a BNB amount first');
      busy(true);
      depositEth(val()).then(function(){flash('Deposited — BNB balance updated');amt.value='';},function(e){flash(e.message);}).then(function(){busy(false);});
    });
    el.querySelector('#cbWd').addEventListener('click',function(){
      var a=val()||(nativeW?nativeW.amt:0);
      if(a<=0)return flash('Nothing to cash out');
      busy(true);
      cashOut(Math.min(a,nativeW?nativeW.amt:0)).then(function(){flash('Cashed out to your wallet');amt.value='';},function(e){flash(e.message);}).then(function(){busy(false);});
    });
  }
  function disconnected(){account=null;flash('Wallet disconnected');}
  render();
  return{render:render,flash:flash,disconnected:disconnected};
})();
})();
