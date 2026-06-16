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
var WITHDRAWAL_URL='https://czqqdwmifcqoiyphjqjk.supabase.co/functions/v1/create-withdrawal';
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

/* When multiple wallets are installed (TrustWallet, TronLink, etc.) they override
   window.ethereum. Pick MetaMask specifically; fall back to window.ethereum. */
var _provider=(function(){
  var providers=window.ethereum.providers;
  if(providers&&providers.length){
    return providers.find(function(p){return p.isMetaMask&&!p.isTrust&&!p.isTronLink;})
           ||window.ethereum;
  }
  return window.ethereum;
})();

/* ---------- state ---------- */
var account=null,vaultAddr=null,chainIdHex=null,chainCurrency='BNB';
var nativeW=WALLETS.find(function(w){return w.c==='BNB';}); /* BNB is the native token on BSC */
var settleQueue=Promise.resolve();

function setLedgerEth(wei){if(!nativeW)return;nativeW.amt=weiToEth(wei);nativeW.fiat=nativeW.amt*nativeW.rate;renderWallet();if(window.gvCurSync)gvCurSync();}

/* keep old name as alias so any external callers still work */
var ethW=nativeW;

/* ---------- cashier API ---------- */
function api(path,body){
  return fetch(CASHIER+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined)
    .then(function(r){return r.json();})
    .then(function(j){if(j.error)throw new Error(j.error);return j;});
}
function refreshBalance(){
  return fetchEthBalance().then(function(amt){
    setLedgerEth((amt*1e18).toString());
    return BigInt(Math.round(amt*1e18));
  });
}

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
function rpc(method,params){return _provider.request({method:method,params:params});}
/* BSC chain definitions — MetaMask can auto-add these */
var BSC_CHAINS={
  '0x38':{chainId:'0x38',chainName:'BNB Smart Chain',rpcUrls:['https://bsc-dataseed.binance.org/'],nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18},blockExplorerUrls:['https://bscscan.com']},
  '0x61':{chainId:'0x61',chainName:'BNB Smart Chain Testnet',rpcUrls:['https://data-seed-prebsc-1-s1.binance.org:8545/'],nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18},blockExplorerUrls:['https://testnet.bscscan.com']},
};

function ensureChain(){
  return rpc('wallet_switchEthereumChain',[{chainId:chainIdHex}]).catch(function(e){
    if(e.code!==4902)throw e;
    var bscDef=BSC_CHAINS[chainIdHex.toLowerCase()];
    if(bscDef)return rpc('wallet_addEthereumChain',[bscDef]);
    if(parseInt(chainIdHex,16)===LOCAL_CHAIN_ID)
      return rpc('wallet_addEthereumChain',[{chainId:chainIdHex,chainName:'VOLT local (hardhat)',rpcUrls:['http://'+location.hostname+':8545'],nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18}}]);
    throw new Error('Add chain '+parseInt(chainIdHex,16)+' to your wallet, then reconnect');
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
    _provider.on&&_provider.on('accountsChanged',function(accs){
      account=accs[0]||null;
      if(account)refreshBalance();else ui.disconnected();
      ui.render();
    });
    return refreshBalance();
  }).then(function(){
    if(!document.body.classList.contains('authed'))setAuth(true);
    if(voltCur!=='BNB'){voltCur='BNB';localStorage.setItem(LS_CUR,voltCur);renderWallet();if(window.gvCurSync)gvCurSync();}
    ui.render();
    ui.flash('Wallet connected — BNB balance is live');
  });
}

function depositEth(amountEth){
  var wei=ethToWei(amountEth);
  var beforeAmt=ethW?ethW.amt:0;
  return rpc('eth_sendTransaction',[{from:account,to:vaultAddr,value:toHexWei(wei)}])
    .then(waitForReceipt).then(function(){
      /* alchemy-webhook credits the Supabase wallet asynchronously when the
         Deposited event lands. Poll until the balance rises. */
      return new Promise(function(resolve,reject){
        var tries=0;
        (function poll(){
          setTimeout(function(){
            fetchEthBalance().then(function(newAmt){
              if(newAmt>beforeAmt+amountEth*0.99){setLedgerEth((newAmt*1e18).toString());resolve();}
              else if(++tries>30)reject(new Error('Deposit not credited yet — check back in a moment'));
              else poll();
            }).catch(function(){if(++tries>30)reject(new Error('Balance check failed'));else poll();});
          },2000);
        })();
      });
    });
}

/* fetch ETH balance from Supabase (prod) or local cashier (dev) */
function fetchEthBalance(){
  if(typeof supa!=='undefined'){
    return supa.auth.getUser().then(function(res){
      var user=res.data&&res.data.user;
      if(!user)return ethW?ethW.amt:0;
      return supa.from('wallets').select('balance').eq('user_id',user.id).eq('currency','ETH').single()
        .then(function(r){return parseFloat(r.data&&r.data.balance)||0;});
    });
  }
  return api('/balance/'+account).then(function(j){return weiToEth(BigInt(j.balance));});
}

function cashOut(amountEth){
  var amountWei=ethToWei(amountEth).toString();
  var voucher;
  /* let pending game results land first, then get a signed voucher */
  return settleQueue.then(function(){
    /* use Supabase Edge Function when a session exists; fall back to local cashier for dev */
    if(typeof supa!=='undefined'){
      return supa.auth.getSession().then(function(res){
        var session=res.data&&res.data.session;
        if(!session)throw new Error('Not logged in');
        return fetch(WITHDRAWAL_URL,{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
          body:JSON.stringify({walletAddress:account,amountWei:amountWei}),
        }).then(function(r){return r.json();}).then(function(j){
          if(j.error)throw new Error(j.error);
          return j;
        });
      });
    }
    /* local hardhat dev: use cashier.js */
    return api('/withdraw',{player:account,amount:amountWei});
  }).then(function(v){
    voucher=v;
    return rpc('eth_sendTransaction',[{from:account,to:vaultAddr,data:encodeWithdraw(v.amount,v.nonce,v.deadline,v.signature)}]);
  }).then(waitForReceipt).then(function(rec){
    if(rec.status!=='0x1')throw new Error('withdraw transaction reverted');
    /* apply authoritative balance from server; Supabase wallets table was already debited */
    if(voucher.new_balance!=null&&ethW){
      ethW.amt=parseFloat(voucher.new_balance)||Math.max(0,ethW.amt-amountEth);
      ethW.fiat=ethW.amt*ethW.rate;renderWallet();
    }else{
      return refreshBalance();
    }
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
  var style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  var el=document.createElement('div');el.id='chainBar';document.body.appendChild(el);
  var msgT=null;
  function flash(m){var n=el.querySelector('.cb-msg');if(n){n.textContent=m;clearTimeout(msgT);msgT=setTimeout(function(){n.textContent='';},5000);}}
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
      +'<div class="cb-row"><input id="cbAmt" type="number" min="0" step="0.001" placeholder="BNB"><button id="cbDep">Deposit</button><button id="cbWd" class="alt">Cash out</button></div>'
      +'<div class="cb-msg"></div>';
    var amt=el.querySelector('#cbAmt');
    function val(){return parseFloat(amt.value)||0;}
    el.querySelector('#cbDep').addEventListener('click',function(){
      if(val()<=0)return flash('Enter an ETH amount first');
      busy(true);
      depositEth(val()).then(function(){flash('Deposited — BNB balance is live');amt.value='';},function(e){flash(e.message);}).then(function(){busy(false);});
    });
    el.querySelector('#cbWd').addEventListener('click',function(){
      var a=val()||nativeW.amt; /* empty input = cash out everything */
      if(a<=0)return flash('Nothing to cash out');
      busy(true);
      cashOut(Math.min(a,nativeW.amt)).then(function(){flash('Cashed out to your wallet');amt.value='';},function(e){flash(e.message);}).then(function(){busy(false);});
    });
  }
  function disconnected(){account=null;flash('Wallet disconnected');}
  render();
  return{render:render,flash:flash,disconnected:disconnected};
})();
})();
