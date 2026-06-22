/* VOLT — payments strip, deposit modal, auth modal, daily-bonus modal wiring lives in js/vip.js */
/* ---------- payments ---------- */
const PAY_COINS=['BTC','ETH','BNB','LTC','USDT','SOL','XRP','TRX','DOGE','MATIC'];
document.getElementById('payStrip').insertAdjacentHTML('beforeend',
  PAY_COINS.map(c=>`<img src="${coinIconUrl(c)}" title="${c}" alt="${c}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex:none" onerror="this.style.display='none'">`).join(''));

/* ---------- deposit modal ---------- */
const DEPOSIT={
  BTC:{networks:[
    {id:'BTC', name:'Bitcoin',              addr:'bc1qj9w4ux0e3a8yq2v5tslh7nf06xm3r9c4kzd2e', min:'0.0001 BTC', conf:'1 confirmation',   fee:'0.00005 BTC', evm:false},
  ]},
  ETH:{networks:[
    {id:'ERC20',name:'Ethereum · ERC-20',   addr:'',                                            min:'0.005 ETH',  conf:'12 confirmations', fee:'0.0008 ETH',  evm:true},
  ]},
  BNB:{networks:[
    {id:'BEP20',name:'BNB Chain · BEP-20',  addr:'',                                            min:'0.01 BNB',   conf:'15 confirmations', fee:'0.001 BNB',   evm:true},
  ]},
  LTC:{networks:[
    {id:'LTC', name:'Litecoin',             addr:'ltc1q8v2m4xw9c7t3p5dyh0kn6azfu1rqsje5lg8b3',min:'0.01 LTC',   conf:'3 confirmations',  fee:'0.001 LTC',   evm:false},
  ]},
  USDT:{networks:[
    {id:'ERC20',name:'Ethereum · ERC-20',   addr:'',                                            min:'10 USDT',    conf:'12 confirmations', fee:'2 USDT',      evm:true},
    {id:'TRC20',name:'Tron · TRC-20',       addr:'TUsdt7vR3mQk9xZ2bP4wN6cF8gH0jL5eA',         min:'1 USDT',     conf:'~1 min',           fee:'0.5 USDT',    evm:false},
    {id:'BEP20',name:'BNB Chain · BEP-20',  addr:'',                                            min:'1 USDT',     conf:'15 confirmations', fee:'0.5 USDT',    evm:true},
    {id:'SPL',  name:'Solana · SPL',        addr:'9wK3rT7pNxV2mQ8cZ5bL4dF6gH1jY0aEuSnB8XoD2RkM',min:'1 USDT',  conf:'~1 min',           fee:'0.01 USDT',   evm:false},
  ]},
  USDC:{networks:[
    {id:'ERC20',name:'Ethereum · ERC-20',   addr:'',                                            min:'10 USDC',    conf:'12 confirmations', fee:'1.5 USDC',    evm:true},
    {id:'SOL',  name:'Solana · SPL',        addr:'9wK3rT7pNxV2mQ8cZ5bL4dF6gH1jY0aEuSnB8XoD2RkM',min:'1 USDC',  conf:'~1 min',           fee:'0.01 USDC',   evm:false},
    {id:'BEP20',name:'BNB Chain · BEP-20',  addr:'',                                            min:'1 USDC',     conf:'15 confirmations', fee:'0.5 USDC',    evm:true},
    {id:'TRC20',name:'Tron · TRC-20',       addr:'TUsdc8wR4mQk9xZ2bP4wN6cF8gH0jL5eB',         min:'1 USDC',     conf:'~1 min',           fee:'0.5 USDC',    evm:false},
  ]},
  SOL:{networks:[
    {id:'SOL', name:'Solana',               addr:'9wK3rT7pNxV2mQ8cZ5bL4dF6gH1jY0aEuSnB8XoD2RkM',min:'0.05 SOL', conf:'~1 min finality',  fee:'0.001 SOL',   evm:false},
  ]},
};
let depCur=voltCur,depNetId=null;
const depOverlay=document.getElementById('depOverlay'),
      depNet=document.getElementById('depNet'),
      depMin=document.getElementById('depMin'),
      depConf=document.getElementById('depConf'),
      depAddr=document.getElementById('depAddr'),
      depWarnCur=document.getElementById('depWarnCur'),
      depCopyBtn=document.getElementById('depCopy');
let depCopyT=null;
function drawQr(text){
  const c=document.getElementById('depQr'),ctx=c.getContext('2d'),N=33;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,N,N);
  let seed=0;
  for(const ch of text)seed=(seed*131+ch.charCodeAt(0))>>>0;
  if(!seed)seed=7;
  const rand=()=>{seed^=seed<<13;seed>>>=0;seed^=seed>>17;seed^=seed<<5;seed>>>=0;return seed/4294967296;};
  ctx.fillStyle='#10141d';
  for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){
    const inFinder=(x<10&&y<10)||(x>=N-10&&y<10)||(x<10&&y>=N-10);
    if(!inFinder&&rand()<0.46)ctx.fillRect(x,y,1,1);
  }
  const fin=(ox,oy)=>{
    ctx.fillStyle='#10141d';ctx.fillRect(ox,oy,7,7);
    ctx.fillStyle='#fff';ctx.fillRect(ox+1,oy+1,5,5);
    ctx.fillStyle='#10141d';ctx.fillRect(ox+2,oy+2,3,3);
  };
  fin(1,1);fin(N-8,1);fin(1,N-8);
}
const depAddrCache={};

async function fetchDepositAddress(currency,networkId){
  const key=currency+':'+networkId;
  if(depAddrCache[key])return depAddrCache[key];
  const{data:{session}}=await supa.auth.getSession();
  if(!session) return null;
  try{
    const res=await window.voltApi._fetch(
      '/api/wallet/deposit-address/'+currency+'/'+networkId
    );
    if(!res.ok)return null;
    const json=await res.json();
    if(json.address){depAddrCache[key]=json.address;return json.address;}
  }catch(e){}
  return null;
}

function currentNetwork(){
  const nets=(DEPOSIT[depCur]||DEPOSIT.BTC).networks;
  return nets.find(n=>n.id===depNetId)||nets[0];
}

async function renderDep(){
  if(!DEPOSIT[depCur]){depCur='BTC';}
  const nets=DEPOSIT[depCur].networks;
  /* keep depNetId as-is; caller is responsible for setting it */
  if(depNetId&&!nets.find(n=>n.id===depNetId)) depNetId=null;

  /* currency dropdown */
  const curDdIc=document.getElementById('depCurDdIc'),curDdLbl=document.getElementById('depCurDdLbl');
  if(curDdIc){curDdIc.src=coinIconUrl(depCur);curDdIc.alt=depCur;}
  if(curDdLbl)curDdLbl.textContent=depCur;
  const curPanel=document.getElementById('depCurPanel');
  if(curPanel)curPanel.innerHTML=WALLETS.map(w=>`
    <button class="dep-dd-item${w.c===depCur?' sel':''}" data-dc="${w.c}">
      <img src="${coinIconUrl(w.c)}" alt="${w.c}" onerror="this.style.display='none'">
      <span>${w.c}</span>
      <span class="bal">${fmtAmt(w)}</span>
    </button>`).join('');

  /* network dropdown */
  const netDdBtn=document.getElementById('depNetDdBtn');
  const netDdLbl=document.getElementById('depNetDdLbl');
  const netPanel=document.getElementById('depNetPanel');
  if(netDdLbl){
    if(depNetId){netDdLbl.textContent=nets.find(n=>n.id===depNetId).name;netDdLbl.style.color='';}
    else{netDdLbl.textContent='Select network';netDdLbl.style.color='var(--muted)';}
  }
  if(netDdBtn)netDdBtn.disabled=nets.length<=1;
  if(netPanel)netPanel.innerHTML=nets.length>1?nets.map(n=>`
    <button class="dep-dd-item${n.id===depNetId?' sel':''}" data-dn="${n.id}">
      <span>${n.name}</span>
    </button>`).join(''):'';

  /* network warning — shown for multi-network coins; message adapts to selection state */
  const netWarn=document.getElementById('depNetWarn');
  const netWarnMsg=document.getElementById('depNetWarnMsg');
  if(netWarn){
    const multiNet=nets.length>1;
    netWarn.hidden=!multiNet;
    if(multiNet&&netWarnMsg){
      if(depNetId){
        const sel=nets.find(n=>n.id===depNetId);
        netWarnMsg.textContent='Your deposit must be sent on the '+sel.name+' network. Sending on the wrong network will result in lost funds.';
      } else {
        netWarnMsg.textContent='This coin runs on multiple networks — please select a network above before depositing.';
      }
    }
  }

  /* address section — visible only after network is chosen */
  const addrSec=document.getElementById('depAddrSection');
  if(addrSec) addrSec.hidden=!depNetId;

  if(depNetId){
    const net=currentNetwork();
    depNet.textContent=net.name;
    depMin.textContent=net.min;
    depConf.textContent=net.conf;
    depWarnCur.textContent=depCur;
    clearTimeout(depCopyT);
    depCopyBtn.textContent='Copy';
    depCopyBtn.classList.remove('ok');
    if(net.evm){
      depAddr.textContent='Fetching address…';
      drawQr('');
      const addr=await fetchDepositAddress(depCur,net.id);
      if(addr){depAddr.textContent=addr;drawQr(addr);}
      else{depAddr.textContent='Sign in to get your deposit address';}
    } else {
      depAddr.textContent=net.addr||'Sign in to get your deposit address';
      drawQr(net.addr);
    }
    if(document.getElementById('depCalcEq'))document.getElementById('depCalcEq').textContent='≈ — '+depCur;
    if(typeof updateCalc==='function')updateCalc();
  }
}

/* ── deposit dropdown toggles ── */
(function(){
  function closeAll(){
    document.getElementById('depCurPanel').hidden=true;
    document.getElementById('depCurDdBtn').classList.remove('open');
    document.getElementById('depNetPanel').hidden=true;
    document.getElementById('depNetDdBtn').classList.remove('open');
  }
  document.getElementById('depCurDdBtn').addEventListener('click',()=>{
    const p=document.getElementById('depCurPanel'),open=!p.hidden;
    document.getElementById('depNetPanel').hidden=true;
    document.getElementById('depNetDdBtn').classList.remove('open');
    p.hidden=open;document.getElementById('depCurDdBtn').classList.toggle('open',!open);
  });
  document.getElementById('depNetDdBtn').addEventListener('click',()=>{
    const b=document.getElementById('depNetDdBtn');if(b.disabled)return;
    const p=document.getElementById('depNetPanel'),open=!p.hidden;
    document.getElementById('depCurPanel').hidden=true;
    document.getElementById('depCurDdBtn').classList.remove('open');
    p.hidden=open;b.classList.toggle('open',!open);
  });
  document.getElementById('depCurPanel').addEventListener('click',e=>{
    const b=e.target.closest('[data-dc]');if(!b)return;
    depCur=b.dataset.dc;
    localStorage.setItem('volt-dep-cur',depCur);
    const nets=(DEPOSIT[depCur]||DEPOSIT.BTC).networks;
    depNetId=nets.length===1?nets[0].id:null;
    closeAll();renderDep();
  });
  document.getElementById('depNetPanel').addEventListener('click',e=>{
    const b=e.target.closest('[data-dn]');if(!b)return;
    depNetId=b.dataset.dn;closeAll();renderDep();
  });
  document.addEventListener('click',e=>{
    if(!document.getElementById('depCurDd')?.contains(e.target)){
      document.getElementById('depCurPanel').hidden=true;
      document.getElementById('depCurDdBtn').classList.remove('open');
    }
    if(!document.getElementById('depNetDd')?.contains(e.target)){
      document.getElementById('depNetPanel').hidden=true;
      document.getElementById('depNetDdBtn')?.classList.remove('open');
    }
  });
})();
/* ── amount calculator ── */
const depUsdAmt=document.getElementById('depUsdAmt');
const depCalcEq=document.getElementById('depCalcEq');
function updateCalc(){
  const usd=parseFloat(depUsdAmt.value);
  const w=WALLETS.find(x=>x.c===depCur);
  const rate=w?.rate||0;
  if(!usd||!rate){depCalcEq.textContent='≈ — '+depCur;return;}
  const amt=usd/rate;
  const fmt=amt<0.0001?amt.toFixed(8):amt<0.01?amt.toFixed(6):amt<1?amt.toFixed(4):amt.toFixed(2);
  depCalcEq.textContent='≈ '+fmt+' '+depCur;
}
depUsdAmt.addEventListener('input',updateCalc);

/* ── deposit monitor (polls balance while modal open) ── */
const depMonitor=document.getElementById('depMonitor');
const depMonMsg=document.getElementById('depMonMsg');
let _depMonBase=null,_depMonTimer=null;
function startDepMonitor(){
  const w=WALLETS.find(x=>x.c===depCur);
  _depMonBase=w?.amt??null;
  depMonitor.hidden=false;
  depMonitor.classList.remove('credited');
  depMonMsg.textContent='Monitoring for incoming deposit…';
  clearInterval(_depMonTimer);
  _depMonTimer=setInterval(async()=>{
    if(!depOverlay.classList.contains('open')){clearInterval(_depMonTimer);return;}
    await window.loadBalances?.();
    const w2=WALLETS.find(x=>x.c===depCur);
    if(w2&&_depMonBase!==null&&w2.amt>_depMonBase+0.000001){
      clearInterval(_depMonTimer);
      depMonitor.classList.add('credited');
      depMonMsg.textContent='Deposit received and credited to your account!';
      _depMonBase=w2.amt;
    }
  },10000);
}
function stopDepMonitor(){clearInterval(_depMonTimer);_depMonTimer=null;depMonitor.hidden=true;}


function openDep(mode){
  const saved=localStorage.getItem('volt-dep-cur');
  depCur=(saved&&DEPOSIT[saved])?saved:voltCur;
  depNetId=null;depMode=mode||'dep';
  if(depMode==='dep')renderDep();
  if(depMode==='wd')renderDep();
  renderDepMode();
  depOverlay.classList.add('open');
  if(depMode==='dep')startDepMonitor();
}
function closeDep(){depOverlay.classList.remove('open');stopDepMonitor();}
function openTxnModal(){openDep('txn');}
window.openTxnModal=openTxnModal;
document.getElementById('walletDep').addEventListener('click',()=>openDep());
document.getElementById('depClose').addEventListener('click',closeDep);
depOverlay.addEventListener('click',e=>{if(e.target===depOverlay)closeDep();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&depOverlay.classList.contains('open')){closeDep();e.stopPropagation();}
},true);
depCopyBtn.addEventListener('click',()=>{
  const t=depAddr.textContent;
  if(!t||t.length<10)return;
  const flash=()=>{
    depCopyBtn.textContent='Copied ✓';
    depCopyBtn.classList.add('ok');
    clearTimeout(depCopyT);
    depCopyT=setTimeout(()=>{depCopyBtn.textContent='Copy';depCopyBtn.classList.remove('ok');},1600);
    if(window.recordTransaction) recordTransaction({
      type:'deposit', currency:depCur, amount:0,
      status:'pending', address:t,
      note:'Deposit address copied by user',
    });
  };
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(flash,flash);
  else flash();
});

/* ---------- deposit / withdraw / buy crypto tabs ---------- */
const depTabsEl=document.getElementById('depTabs'),
      depView=document.getElementById('depView'),
      wdView=document.getElementById('wdView'),
      txnViewInline=document.getElementById('txnViewInline'),
      buyView=document.getElementById('buyView'),
      wdCoins=document.getElementById('wdCoins'),
      wdAvail=document.getElementById('wdAvail'),
      wdAddr=document.getElementById('wdAddr'),
      wdAmt=document.getElementById('wdAmt'),
      wdFee=document.getElementById('wdFee'),
      wdCoinIc=document.getElementById('wdCoinIc'),
      wdSubmit=document.getElementById('wdSubmit');
let depMode='dep';
const depW=()=>WALLETS.find(x=>x.c===depCur);
let buyCur=voltCur||'BNB';
function renderBuyView(){
  const buyCoins=document.getElementById('buyCoins');
  if(buyCoins)buyCoins.innerHTML=WALLETS.map(x=>`
    <button class="dep-coin ${x.c===buyCur?'sel':''}" data-bc="${x.c}">
      ${coinImg(x.c)}${x.c}</button>`).join('');
  openBuyFrame(buyCur);
}
function openBuyFrame(coin){
  const frame=document.getElementById('buyFrame');if(!frame)return;
  const addr=depAddrCache[coin+':'+((DEPOSIT[coin]?.networks||[])[0]?.id||coin)]||'';
  const url='https://global.transak.com/?defaultCryptoCurrency='+coin.toLowerCase()
    +(addr?'&walletAddress='+encodeURIComponent(addr):'')
    +'&disableWalletAddressForm=true';
  frame.innerHTML=`<iframe src="${url}" style="width:100%;height:480px;border:none;border-radius:12px" allow="camera;microphone;payment" loading="lazy"></iframe>`;
}
document.getElementById('buyView').addEventListener('click',e=>{
  const b=e.target.closest('[data-bc]');if(!b)return;
  buyCur=b.dataset.bc;
  document.querySelectorAll('[data-bc]').forEach(x=>x.classList.toggle('sel',x.dataset.bc===buyCur));
  openBuyFrame(buyCur);
});
function renderDepMode(){
  depTabsEl.querySelectorAll('.auth-tab').forEach(t=>t.classList.toggle('active',t.dataset.mode===depMode));
  depView.hidden=depMode!=='dep';
  wdView.hidden=depMode!=='wd';
  txnViewInline.hidden=depMode!=='txn';
  buyView.hidden=depMode!=='buy';
  if(depMode==='wd')renderWd();
  if(depMode==='txn')window.loadInlineTxnPage&&window.loadInlineTxnPage(true);
  if(depMode==='buy')renderBuyView();
}
function renderWd(){
  const w=depW();
  wdCoins.innerHTML=WALLETS.map(x=>`
    <button class="dep-coin ${x.c===depCur?'sel':''}" data-c="${x.c}">
      ${coinImg(x.c)}${x.c}</button>`).join('');
  wdAvail.textContent=fmtAmt(w)+' '+w.c;
  wdCoinIc.style.background='none';wdCoinIc.innerHTML=`<img src="${coinIconUrl(depCur)}" style="width:22px;height:22px;object-fit:cover" alt="${depCur}">`;
  wdAddr.placeholder='Paste your '+depCur+' address';
  wdFee.textContent=currentNetwork().fee||'—';
  validateWd();
}
function validateWd(){
  const a=parseFloat(wdAmt.value);
  wdSubmit.disabled=!(wdAddr.value.trim().length>=16&&a>0&&a<=depW().amt);
}
depTabsEl.addEventListener('click',e=>{
  const t=e.target.closest('.auth-tab');
  if(t){depMode=t.dataset.mode;renderDepMode();}
});
wdCoins.addEventListener('click',e=>{
  const b=e.target.closest('.dep-coin');if(!b)return;
  depCur=b.dataset.c;renderDep();renderWd();
});
document.getElementById('wdMax').addEventListener('click',()=>{
  const w=depW();
  wdAmt.value=fmtW(w,floorW(w,w.amt));validateWd();
});
[wdAddr,wdAmt].forEach(i=>i.addEventListener('input',validateWd));
wdSubmit.addEventListener('click',async()=>{
  if(wdSubmit.disabled)return;
  const w=depW(),a=Math.min(parseFloat(wdAmt.value)||0,w.amt);
  if(a<=0)return;
  const addr=wdAddr.value.trim();
  const net=currentNetwork();
  wdSubmit.disabled=true;wdSubmit.textContent='Submitting…';
  try{
    const res=await window.voltApi._fetch('/api/wallet/withdraw',{
      method:'POST',
      body:JSON.stringify({currency:w.c,network:net.id,amount:a,address:addr}),
    });
    const json=await res.json();
    if(!res.ok)throw new Error(json.error||'Withdrawal failed');
    if(window.loadBalances)loadBalances().catch(()=>{});
    showToast({icon:'↗',title:'Withdrawal submitted',sub:'-'+fmtW(w,a)+' '+w.c+' · processing'});
    wdAmt.value='';wdAddr.value='';renderWd();
  }catch(err){
    showToast({icon:'⚠',title:'Withdrawal failed',sub:err.message});
  }finally{
    wdSubmit.disabled=false;wdSubmit.textContent='Withdraw';
  }
});

/* ---------- auth modal ---------- */
const authOverlay=document.getElementById('authOverlay'),
      authTabs=document.getElementById('authTabs'),
      authEmail=document.getElementById('authEmail'),
      authPass=document.getElementById('authPass'),
      authTermsRow=document.getElementById('authTermsRow'),
      authTermsCb=document.getElementById('authTerms'),
      authSubmit=document.getElementById('authSubmit'),
      forgotBtn=document.getElementById('forgotBtn');
let authMode='up',ssoBusy=false;
function validateAuth(){
  const ok=/.+@.+\..+/.test(authEmail.value)&&authPass.value.length>=6&&(authMode==='in'||authTermsCb.checked);
  authSubmit.disabled=!ok;
}
function renderAuth(){
  authTabs.querySelectorAll('.auth-tab').forEach(t=>t.classList.toggle('active',t.dataset.mode===authMode));
  authTermsRow.hidden=authMode==='in';
  forgotBtn.style.display=authMode==='in'?'':'none';
  authSubmit.textContent=authMode==='up'?'Create Account':'Sign In';
  authPass.setAttribute('autocomplete',authMode==='up'?'new-password':'current-password');
  validateAuth();
}
function openAuth(mode){
  authMode=mode||'up';
  renderAuth();
  authOverlay.classList.add('open');
  setTimeout(()=>authEmail.focus(),60);
}
function closeAuth(){authOverlay.classList.remove('open');}
function finishAuth(){
  closeAuth();
  setAuth(true);
  authEmail.value='';authPass.value='';authTermsCb.checked=false;
  validateAuth();
}
authTabs.addEventListener('click',e=>{
  const t=e.target.closest('.auth-tab');
  if(t){authMode=t.dataset.mode;renderAuth();}
});
document.getElementById('authClose').addEventListener('click',closeAuth);
authOverlay.addEventListener('click',e=>{if(e.target===authOverlay)closeAuth();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&authOverlay.classList.contains('open')){closeAuth();e.stopPropagation();}
},true);
[authEmail,authPass].forEach(i=>i.addEventListener('input',validateAuth));
authTermsCb.addEventListener('change',validateAuth);
authSubmit.addEventListener('click',async()=>{
  if(authSubmit.disabled)return;
  const label=authSubmit.textContent;
  authSubmit.disabled=true;
  authSubmit.textContent='…';
  try{
    if(authMode==='up'){
      const{data,error}=await supa.auth.signUp({email:authEmail.value,password:authPass.value});
      if(error)throw error;
      if(!data.session){
        closeAuth();
        showToast({icon:'📧',title:'Check your email',sub:'Click the confirmation link to activate your account.'});
        return;
      }
      /* signup success — show username picker before finishing */
      closeAuth();
      openUnamePicker(authEmail.value);
      return;
    } else {
      const{error}=await supa.auth.signInWithPassword({email:authEmail.value,password:authPass.value});
      if(error)throw error;
    }
  } catch(err){
    authSubmit.disabled=false;
    authSubmit.textContent=label;
    showToast({icon:'⚠',title:'Auth error',sub:err.message});
  }
});

/* ===== USERNAME PICKER (post-signup) ===== */
(function(){
  const overlay=document.getElementById('unameOverlay'),
        input=document.getElementById('unameInput'),
        submit=document.getElementById('unameSubmit'),
        hint=document.getElementById('unameHint'),
        skip=document.getElementById('unameSkip');

  function validate(){
    const v=input.value.trim();
    const ok=/^[a-zA-Z0-9_]{3,32}$/.test(v);
    submit.disabled=!ok;
    if(v.length>0&&!ok){
      hint.innerHTML='<b style="color:#ff6b6b">3–32 chars · letters, numbers, underscores only</b>';
    } else {
      hint.innerHTML='3–32 characters · letters, numbers, underscores only';
    }
  }

  window.openUnamePicker=function(email){
    /* pre-fill with derived name */
    input.value=(email||'').split('@')[0].replace(/[^a-zA-Z0-9_]/g,'_').slice(0,32)||'';
    validate();
    overlay.classList.add('open');
    setTimeout(()=>{input.select();},60);
  };

  async function saveUsername(){
    const username=input.value.trim();
    if(!/^[a-zA-Z0-9_]{3,32}$/.test(username))return;
    submit.disabled=true;
    submit.textContent='Saving…';
    try{
      const r=await voltApi._fetch('/api/auth/username',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({username})});
      const j=await r.json();
      if(!r.ok){
        hint.innerHTML='<b style="color:#ff6b6b">'+(j.error||'Error saving username')+'</b>';
        submit.disabled=false;
        submit.textContent='Set Username';
        return;
      }
      /* update stored user with new username */
      const stored=JSON.parse(localStorage.getItem('volt-user')||'{}');
      stored.username=j.username;
      localStorage.setItem('volt-user',JSON.stringify(stored));
      overlay.classList.remove('open');
      finishAuth();
      showToast({icon:'✓',col:'#41f0a4',title:'Welcome, '+j.username+'!',sub:'Your username has been set.'});
    } catch(e){
      hint.innerHTML='<b style="color:#ff6b6b">Network error — try again</b>';
      submit.disabled=false;
      submit.textContent='Set Username';
    }
  }

  input.addEventListener('input',validate);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!submit.disabled)saveUsername();});
  submit.addEventListener('click',saveUsername);
  skip.addEventListener('click',()=>{overlay.classList.remove('open');finishAuth();});
})();
authEmail.addEventListener('keydown',e=>{if(e.key==='Enter')authPass.focus();});
authPass.addEventListener('keydown',e=>{if(e.key==='Enter'&&!authSubmit.disabled)authSubmit.click();});

/* ---------- forgot password ---------- */
forgotBtn.addEventListener('click',async()=>{
  const email=authEmail.value.trim();
  /* If the field is already filled with a valid address, send immediately.
     Otherwise swap the modal into a minimal reset-email screen. */
  if(/.+@.+\..+/.test(email)){
    await sendReset(email);
    return;
  }
  /* Replace modal body with a focused reset screen */
  const modal=authOverlay.querySelector('.dep-modal');
  const original=modal.innerHTML;
  modal.innerHTML=`
    <div class="dep-head">
      <h3 style="font-size:15px;font-weight:900;letter-spacing:.14em;text-transform:uppercase">Reset Password</h3>
      <button class="icon-btn" id="resetClose" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"></path></svg></button>
    </div>
    <p style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:16px">Enter the email address linked to your account and we'll send you a password reset link.</p>
    <div class="auth-field">
      <p class="dep-lbl" style="margin-top:0">Email</p>
      <div class="gv-input"><input id="resetEmail" type="email" placeholder="you@example.com" autocomplete="email" /></div>
    </div>
    <button class="auth-submit" id="resetSubmit" disabled>Send Reset Link</button>
    <p class="auth-fine" style="margin-top:10px"><button id="resetBack" style="background:none;border:none;font:inherit;font-size:10.5px;color:var(--mint);cursor:pointer;padding:0">← Back to Sign In</button></p>`;
  const resetEmail=modal.querySelector('#resetEmail');
  const resetSubmit=modal.querySelector('#resetSubmit');
  const validate=()=>{resetSubmit.disabled=!/.+@.+\..+/.test(resetEmail.value);};
  resetEmail.addEventListener('input',validate);
  resetEmail.addEventListener('keydown',e=>{if(e.key==='Enter'&&!resetSubmit.disabled)resetSubmit.click();});
  resetSubmit.addEventListener('click',async()=>{
    resetSubmit.disabled=true;
    resetSubmit.textContent='Sending…';
    await sendReset(resetEmail.value.trim());
    modal.innerHTML=original;
    authMode='in';
    renderAuth();
  });
  modal.querySelector('#resetClose').addEventListener('click',()=>{modal.innerHTML=original;authMode='in';renderAuth();closeAuth();});
  modal.querySelector('#resetBack').addEventListener('click',()=>{modal.innerHTML=original;authMode='in';renderAuth();});
  setTimeout(()=>resetEmail.focus(),60);
});

async function sendReset(email){
  try{
    const{error}=await supa.auth.resetPasswordForEmail(email,{
      redirectTo:location.origin+location.pathname+'?reset=1',
    });
    if(error)throw error;
    closeAuth();
    showToast({icon:'📧',title:'Reset link sent',sub:'Check your inbox — the link expires in 1 hour.'});
  }catch(err){
    showToast({icon:'⚠',title:'Reset failed',sub:err.message});
  }
}
/* Google SSO */
const _ssoBtn=document.getElementById('ssoGoogle');
if(_ssoBtn){
  _ssoBtn.addEventListener('click',async()=>{
    const orig=_ssoBtn.innerHTML;
    _ssoBtn.disabled=true;_ssoBtn.textContent='Redirecting to Google…';
    const{error}=await supa.auth.signInWithOAuth({provider:'google'});
    if(error){
      _ssoBtn.disabled=false;_ssoBtn.innerHTML=orig;
      showToast({icon:'⚠',title:'Google sign-in failed',sub:error.message});
    }
  });
}

/* Auth state — keeps UI in sync with real session */
supa.auth.onAuthStateChange((_,session)=>{
  if(session){
    if(authOverlay.classList.contains('open'))finishAuth();
    else setAuth(true);
  } else {
    setAuth(false);
  }
});
supa.auth.getSession().then(({data:{session}})=>{if(session)setAuth(true);});

/* ---------- inline transactions tab ---------- */
(function(){
  const iTxnList=document.getElementById('iTxnList');
  const iTxnMore=document.getElementById('iTxnMore');
  const TXN_CFG_I={
    deposit:{bg:'rgba(65,240,164,.12)',stroke:'#41f0a4',icon:'<path d="M12 3v14m-7-7 7 7 7-7"/>'},
    withdraw:{bg:'rgba(248,113,113,.12)',stroke:'#f87171',icon:'<path d="M12 21V7m-7 7 7-7 7 7"/>'},
    win:{bg:'rgba(65,240,164,.12)',stroke:'#41f0a4',icon:'<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>'},
    bet:{bg:'rgba(100,116,139,.12)',stroke:'#94a3b8',icon:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>'},
  };
  function iTxnRow(t){
    const cfg=TXN_CFG_I[t.type]||TXN_CFG_I.bet;
    const sign=t.amt>0?'+':'−';
    const fmtC=t.cur==='USDT'?Math.abs(t.amt).toFixed(2):Math.abs(t.amt).toFixed(4);
    const col=t.amt>0?'#41f0a4':t.type==='bet'?'var(--txt)':'#f87171';
    return `<div class="txn">
      <div class="txn-ic" style="background:${cfg.bg}">
        <svg viewBox="0 0 24 24" fill="none" stroke="${cfg.stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cfg.icon}</svg>
      </div>
      <div class="txn-meta">
        <div class="txn-lbl">${t.label}</div>
        <div class="txn-time">${t.time}</div>
      </div>
      <div class="txn-right">
        <div class="txn-amt" style="color:${col}">${sign}${fmtC} ${t.cur}</div>
      </div>
    </div>`;
  }
  let iTxnFilter='all',iBetsOff=0,iTxnsOff=0,iTxnLoading=false;
  const PAGE=20;
  async function loadInlineTxnPage(reset){
    if(iTxnLoading)return;
    iTxnLoading=true;
    if(reset){iBetsOff=0;iTxnsOff=0;}
    if(reset)iTxnList.innerHTML='<div class="txn-empty">Loading…</div>';
    const{data:{user}}=await supa.auth.getUser();
    if(!user){iTxnList.innerHTML='<div class="txn-empty">Sign in to view transactions</div>';iTxnLoading=false;return;}
    const rows=[];
    let betsHasMore=false,txnsHasMore=false;
    if(iTxnFilter!=='txns'){
      const betsRes=await window.voltApi._fetch('/api/bets/history?limit='+PAGE+'&offset='+iBetsOff);
      const betsJson=betsRes.ok?await betsRes.json():{bets:[]};
      const bets=betsJson.bets||[];
      betsHasMore=bets.length===PAGE;
      bets.forEach(b=>{
        const win=b.status==='won';
        const profit=(b.payout||0)-(b.wager||0);
        const gameName=(b.game||'Game').replace('originals-','').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
        rows.push({type:win?'win':'bet',label:gameName,cur:b.currency,
          amt:win?+profit:-(b.wager||0),time:timeAgo(b.created_at),_ts:new Date(b.created_at).getTime()});
      });
      iBetsOff+=bets.length;
    }
    if(iTxnFilter!=='bets'){
      const txnRes=await window.voltApi._fetch('/api/wallet/history?limit='+PAGE+'&offset='+iTxnsOff);
      const txnJson=txnRes.ok?await txnRes.json():{entries:[]};
      const allEntries=txnJson.entries||[];
      const txns=allEntries.filter(e=>e.type==='deposit'||e.type==='withdrawal');
      txnsHasMore=allEntries.length===PAGE;
      txns.forEach(t=>{
        const sign=t.type==='deposit'?1:-1;
        rows.push({type:t.type,label:t.type==='deposit'?'Deposit':'Withdraw',cur:t.currency,
          amt:sign*Math.abs(t.amount||0),time:timeAgo(t.created_at),_ts:new Date(t.created_at).getTime()});
      });
      iTxnsOff+=allEntries.length;
    }
    rows.sort((a,b)=>b._ts-a._ts);
    if(reset)iTxnList.innerHTML='';
    if(!rows.length&&reset){iTxnList.innerHTML='<div class="txn-empty">No transactions yet</div>';}
    else rows.forEach(r=>iTxnList.insertAdjacentHTML('beforeend',iTxnRow(r)));
    iTxnMore.style.display=(betsHasMore||txnsHasMore)?'block':'none';
    iTxnLoading=false;
  }
  window.loadInlineTxnPage=loadInlineTxnPage;
  iTxnMore.addEventListener('click',()=>loadInlineTxnPage(false));
  txnViewInline.addEventListener('click',e=>{
    const b=e.target.closest('.auto-seg[data-itxf]');if(!b)return;
    iTxnFilter=b.dataset.itxf;
    txnViewInline.querySelectorAll('.auto-seg[data-itxf]').forEach(x=>x.classList.toggle('active',x===b));
    loadInlineTxnPage(true);
  });
})();
