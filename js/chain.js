/* VOLT — on-chain cashier bridge (Stake model). Loads last; everything else stays demo-only.
   With MetaMask + the local stack running (chain/: npm run node, deploy, cashier),
   the ETH wallet becomes real: deposits go to VoltVault on-chain, every game
   round mirrors its ETH delta to the cashier ledger via /settle (by wrapping
   debitBet/creditTo from engines.js), and cash-out redeems a cashier-signed
   EIP-712 voucher on-chain. No MetaMask -> the widget never appears and the
   demo behaves exactly as before. */
(function(){
'use strict';
/* cashier rides on the same host the page was served from, so a phone on the
   LAN that loads http://<pc-ip>:8080 talks to the cashier at <pc-ip>:8484
   (typeof guard: this file is also evaluated under Node by the tests) */
var CASHIER=typeof location!=='undefined'?'http://'+location.hostname+':8484':'';
var DEPLOYMENT_URL='chain/deployment.json';
var LOCAL_CHAIN_ID=31337; /* hardhat; the actual target chain comes from deployment.json */
var WITHDRAW_SELECTOR='0xfe55892d'; /* withdraw(uint256,uint256,uint256,bytes) — keccak precomputed, no keccak lib in the demo */
var WEI=1e18;

/* ---------- ABI helpers (pure; unit-tested from chain/test) ---------- */
function pad32(hex){return hex.replace(/^0x/,'').padStart(64,'0');}
function toHexWei(n){return '0x'+n.toString(16);}
/* calldata for VoltVault.withdraw(amount, nonce, deadline, signature) */
function encodeWithdraw(amount,nonce,deadline,signature){
  var sig=signature.replace(/^0x/,'');
  var sigLen=sig.length/2;
  var sigPadded=sig.padEnd(Math.ceil(sigLen/32)*64,'0');
  return WITHDRAW_SELECTOR
    +pad32(BigInt(amount).toString(16))
    +pad32(BigInt(nonce).toString(16))
    +pad32(BigInt(deadline).toString(16))
    +pad32((0x80).toString(16))   /* offset of the bytes arg: after 4 head words */
    +pad32(sigLen.toString(16))
    +sigPadded;
}
function ethToWei(x){return BigInt(Math.round(x*WEI));}
function weiToEth(wei){return Number(BigInt(wei))/WEI;}

if(typeof document==='undefined'){ /* loaded under Node for tests */
  module.exports={pad32:pad32,encodeWithdraw:encodeWithdraw,ethToWei:ethToWei,weiToEth:weiToEth,WITHDRAW_SELECTOR:WITHDRAW_SELECTOR};
  return;
}
if(!window.ethereum)return; /* pure demo mode */

/* ---------- state ---------- */
var account=null,vaultAddr=null,chainIdHex=null;
var ethW=WALLETS.find(function(w){return w.c==='ETH';});
var settleQueue=Promise.resolve(); /* serialize /settle so deltas apply in order */

function setLedgerEth(wei){ethW.amt=weiToEth(wei);ethW.fiat=ethW.amt*ethW.rate;renderWallet();if(window.gvCurSync)gvCurSync();}

/* ---------- cashier API ---------- */
function api(path,body){
  return fetch(CASHIER+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined)
    .then(function(r){return r.json();})
    .then(function(j){if(j.error)throw new Error(j.error);return j;});
}
function refreshBalance(){return api('/balance/'+account).then(function(j){setLedgerEth(j.balance);return BigInt(j.balance);});}

/* mirror a game-round ETH delta into the ledger; cashier's reply is authoritative */
function pushSettle(deltaEth){
  if(!account)return;
  var delta=ethToWei(deltaEth).toString();
  settleQueue=settleQueue
    .then(function(){return api('/settle',{player:account,delta:delta});})
    .then(function(j){setLedgerEth(j.balance);})
    .catch(function(e){console.warn('cashier settle failed:',e.message);ui.flash('Cashier offline — ETH balance is no longer live');});
}

/* ---------- hook the demo's money flow (covers all games) ---------- */
var origDebit=window.debitBet,origCredit=window.creditTo;
window.debitBet=function(){
  var st=origDebit.apply(this,arguments);
  if(st&&st.w===ethW)pushSettle(-st.b);
  return st;
};
window.creditTo=function(w,x){
  origCredit.apply(this,arguments);
  if(w===ethW)pushSettle(x);
};

/* ---------- MetaMask plumbing ---------- */
function rpc(method,params){return window.ethereum.request({method:method,params:params});}
function ensureChain(){
  return rpc('wallet_switchEthereumChain',[{chainId:chainIdHex}]).catch(function(e){
    if(e.code!==4902)throw e;
    /* wallet doesn't know the chain: we can only auto-add the local hardhat
       one; public testnets ship with MetaMask or are added by the user */
    if(parseInt(chainIdHex,16)!==LOCAL_CHAIN_ID)throw new Error('Add chain '+parseInt(chainIdHex,16)+' to your wallet, then reconnect');
    return rpc('wallet_addEthereumChain',[{chainId:chainIdHex,chainName:'VOLT local (hardhat)',rpcUrls:['http://'+location.hostname+':8545'],nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18}}]);
  });
}
function waitForReceipt(txHash){
  return new Promise(function(resolve,reject){
    var tries=0;
    (function poll(){
      rpc('eth_getTransactionReceipt',[txHash]).then(function(r){
        if(r)return resolve(r);
        if(++tries>60)return reject(new Error('transaction not mined'));
        setTimeout(poll,1000);
      },reject);
    })();
  });
}

function connect(){
  return fetch(DEPLOYMENT_URL).then(function(r){
    if(!r.ok)throw new Error('chain/deployment.json not found — run npm run deploy');
    return r.json();
  }).then(function(d){
    vaultAddr=d.vault;
    if(!vaultAddr)throw new Error('no vault in deployment.json — redeploy');
    chainIdHex='0x'+Number(d.chainId||LOCAL_CHAIN_ID).toString(16);
    return ensureChain();
  }).then(function(){
    return rpc('eth_requestAccounts');
  }).then(function(accs){
    account=accs[0];
    window.ethereum.on&&window.ethereum.on('accountsChanged',function(accs){
      account=accs[0]||null;
      if(account)refreshBalance();else ui.disconnected();
      ui.render();
    });
    return refreshBalance();
  }).then(function(){
    if(!document.body.classList.contains('authed'))setAuth(true); /* a connected wallet is a session */
    if(voltCur!=='ETH'){voltCur='ETH';localStorage.setItem(LS_CUR,voltCur);renderWallet();if(window.gvCurSync)gvCurSync();}
    ui.render();
    ui.flash('Wallet connected — ETH balance is live');
  });
}

function depositEth(amountEth){
  var wei=ethToWei(amountEth);
  var before;
  return refreshBalance().then(function(b){
    before=b;
    return rpc('eth_sendTransaction',[{from:account,to:vaultAddr,value:toHexWei(wei)}]); /* plain transfer; vault's receive() emits Deposited */
  }).then(waitForReceipt).then(function(){
    /* credited asynchronously by the cashier's event listener — poll until it lands */
    return new Promise(function(resolve,reject){
      var tries=0;
      (function poll(){
        api('/balance/'+account).then(function(j){
          if(BigInt(j.balance)>before){setLedgerEth(j.balance);return resolve();}
          if(++tries>20)return reject(new Error('deposit not credited — is the cashier running?'));
          setTimeout(poll,1000);
        },reject);
      })();
    });
  });
}

function cashOut(amountEth){
  var voucher;
  return settleQueue.then(function(){ /* let pending game results land first */
    return api('/withdraw',{player:account,amount:ethToWei(amountEth).toString()});
  }).then(function(v){
    voucher=v;
    return rpc('eth_sendTransaction',[{from:account,to:vaultAddr,data:encodeWithdraw(v.amount,v.nonce,v.deadline,v.signature)}]);
  }).then(waitForReceipt).then(function(rec){
    if(rec.status!=='0x1')throw new Error('withdraw transaction reverted');
    return refreshBalance();
  });
}

/* ---------- widget (self-contained so the demo's HTML/CSS stay untouched) ---------- */
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
  var style=document.createElement('style');style.textContent=css+'#chainBar{display:none!important}';document.head.appendChild(style);
  var el=document.createElement('div');el.id='chainBar';document.body.appendChild(el);
  var msgT=null;
  function flash(m){var n=el.querySelector('.cb-msg');if(n){n.textContent=m;clearTimeout(msgT);msgT=setTimeout(function(){n.textContent='';},5000);}}
  function busy(b){el.querySelectorAll('button').forEach(function(x){x.disabled=b;});}
  function short(a){return a.slice(0,6)+'…'+a.slice(-4);}
  function render(){
    if(!account){
      el.innerHTML='<b>On-chain cashier · local</b>'
        +'<div class="cb-row"><button id="cbConnect">Connect MetaMask</button></div>'
        +'<div class="cb-msg"></div>';
      el.querySelector('#cbConnect').addEventListener('click',function(){
        busy(true);
        connect().catch(function(e){flash(e.message);}).then(function(){busy(false);render();});
      });
      return;
    }
    el.innerHTML='<b>On-chain cashier · <span class="cb-addr">'+short(account)+'</span></b>'
      +'<div class="cb-row"><input id="cbAmt" type="number" min="0" step="0.01" placeholder="ETH"><button id="cbDep">Deposit</button><button id="cbWd" class="alt">Cash out</button></div>'
      +'<div class="cb-msg"></div>';
    var amt=el.querySelector('#cbAmt');
    function val(){return parseFloat(amt.value)||0;}
    el.querySelector('#cbDep').addEventListener('click',function(){
      if(val()<=0)return flash('Enter an ETH amount first');
      busy(true);
      depositEth(val()).then(function(){flash('Deposited — balance is live');amt.value='';},function(e){flash(e.message);}).then(function(){busy(false);});
    });
    el.querySelector('#cbWd').addEventListener('click',function(){
      var a=val()||ethW.amt; /* empty input = cash out everything */
      if(a<=0)return flash('Nothing to cash out');
      busy(true);
      cashOut(Math.min(a,ethW.amt)).then(function(){flash('Cashed out to your wallet');amt.value='';},function(e){flash(e.message);}).then(function(){busy(false);});
    });
  }
  function disconnected(){account=null;flash('Wallet disconnected');}
  render();
  return{render:render,flash:flash,disconnected:disconnected};
})();
})();
