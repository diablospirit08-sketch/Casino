/* VOLT — payments strip, deposit modal, auth modal, daily-bonus modal wiring lives in js/vip.js */
/* ---------- payments ---------- */
const PAY_COINS=['BTC','ETH','BNB','LTC','USDT','SOL','XRP','TRX','MATIC'];
document.getElementById('payStrip').insertAdjacentHTML('beforeend',
  PAY_COINS.map(c=>`<img src="${coinIconUrl(c)}" title="${c}" alt="${c}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex:none" onerror="this.style.display='none'">`).join(''));

/* ---------- deposit modal ---------- */
const DEPOSIT={
  BTC:{networks:[
    {id:'BTC', name:'Bitcoin',              addr:'bc1qh9hlwc6vhzskuzkjtznj4zuy88e03f0pzzthdf', min:'0.0001 BTC', conf:'1 confirmation',   fee:'0.00005 BTC', evm:false},
  ]},
  ETH:{networks:[
    {id:'ERC20',name:'Ethereum · ERC-20',   addr:'',                                            min:'0.005 ETH',  conf:'12 confirmations', fee:'0.0008 ETH',  evm:true},
  ]},
  BNB:{networks:[
    {id:'BEP20',name:'BNB Chain · BEP-20',  addr:'',                                            min:'0.01 BNB',   conf:'15 confirmations', fee:'0.001 BNB',   evm:true},
  ]},
  LTC:{networks:[
    {id:'LTC', name:'Litecoin',             addr:'ltc1qnt2qj2ku76wgg5ajjx7av4ws7xntlh2t852u7v',min:'0.01 LTC',   conf:'3 confirmations',  fee:'0.001 LTC',   evm:false},
  ]},
  USDT:{networks:[
    {id:'ERC20',name:'Ethereum · ERC-20',   addr:'',                                            min:'10 USDT',    conf:'12 confirmations', fee:'2 USDT',      evm:true},
    {id:'TRC20',name:'Tron · TRC-20',       addr:'TMR9Jny3DXe8xgrPNGREJhmmMvnvd7Nbaf',         min:'1 USDT',     conf:'~1 min',           fee:'0.5 USDT',    evm:false},
    {id:'BEP20',name:'BNB Chain · BEP-20',  addr:'',                                            min:'1 USDT',     conf:'15 confirmations', fee:'0.5 USDT',    evm:true},
    {id:'SPL',  name:'Solana · SPL',        addr:'5UX3z2nACjhAPAQHDRDRCtdq5no38bqRXfpMMixeShTg',min:'1 USDT',  conf:'~1 min',           fee:'0.01 USDT',   evm:false},
  ]},
  USDC:{networks:[
    {id:'ERC20',name:'Ethereum · ERC-20',   addr:'',                                            min:'10 USDC',    conf:'12 confirmations', fee:'1.5 USDC',    evm:true},
    {id:'SOL',  name:'Solana · SPL',        addr:'5UX3z2nACjhAPAQHDRDRCtdq5no38bqRXfpMMixeShTg',min:'1 USDC',  conf:'~1 min',           fee:'0.01 USDC',   evm:false},
    {id:'BEP20',name:'BNB Chain · BEP-20',  addr:'',                                            min:'1 USDC',     conf:'15 confirmations', fee:'0.5 USDC',    evm:true},
    {id:'TRC20',name:'Tron · TRC-20',       addr:'TYaYhdMcmfqsSesmmYT4C1AaATSzR5XR8p',         min:'1 USDC',     conf:'~1 min',           fee:'0.5 USDC',    evm:false},
  ]},
  SOL:{networks:[
    {id:'SOL', name:'Solana',               addr:'5UX3z2nACjhAPAQHDRDRCtdq5no38bqRXfpMMixeShTg',min:'0.05 SOL', conf:'~1 min finality',  fee:'0.001 SOL',   evm:false},
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
  const wrap=document.getElementById('depQr');
  if(!wrap)return;
  wrap.innerHTML='';
  if(!text)return;
  if(typeof QRCode==='undefined')return;
  QRCode.toDataURL(text,{width:156,margin:1,color:{dark:'#000000',light:'#ffffff'}},function(err,url){
    if(err){console.warn('[depQr] QR error:',err);return;}
    const img=document.createElement('img');
    img.src=url;img.alt='Deposit QR';
    wrap.appendChild(img);
  });
}
const depAddrCache={};

const DEP_NET_MAP={ERC20:'mainnet',BEP20:'bsc',TRC20:'tron',BTC:'mainnet',LTC:'mainnet',SOL:'sol',SPL:'sol'};

async function fetchDepositAddress(currency,networkId){
  const key=currency+':'+networkId;
  if(depAddrCache[key])return depAddrCache[key];
  const{data:{session}}=await supa.auth.getSession();
  if(!session) return null;
  const railNet=DEP_NET_MAP[networkId]||networkId.toLowerCase();
  try{
    const res=await window.voltApi._fetch(
      '/api/wallet/deposit-address/'+currency+'/'+railNet
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
  /* auto-select when only one network exists */
  if(!depNetId&&nets.length===1) depNetId=nets[0].id;

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
  if(netDdBtn)netDdBtn.disabled=false;
  if(netPanel)netPanel.innerHTML=nets.map(n=>`
    <button class="dep-dd-item${n.id===depNetId?' sel':''}" data-dn="${n.id}">
      <span>${n.name}</span>
    </button>`).join('');

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
    depNetId=null;
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
function openTxnModal(){
  const ov=document.getElementById('txnOverlay');
  if(ov){ov.classList.add('open');if(window.loadTxnPage)loadTxnPage(true);}
  else openDep('txn');
}
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

/* ── Buy Crypto view ── */
const MOONPAY_CUR={
  BTC:{BTC:'btc'},
  ETH:{ERC20:'eth'},
  BNB:{BEP20:'bnb_bsc'},
  LTC:{LTC:'ltc'},
  USDT:{ERC20:'usdt',TRC20:'usdt_tron',BEP20:'usdt_bsc',SPL:'usdt_sol'},
  USDC:{ERC20:'usdc',BEP20:'usdc_bsc',SPL:'usdc_sol'},
  SOL:{SOL:'sol'},
  XRP:{XRP:'xrp'},
};
let buyCur='BTC',buyNetId=null;

function renderBuyNetDd(){
  const nets=(DEPOSIT[buyCur]||DEPOSIT.BTC).networks;
  if(!buyNetId||!nets.find(n=>n.id===buyNetId))buyNetId=nets[0].id;
  const net=nets.find(n=>n.id===buyNetId)||nets[0];
  const lbl=document.getElementById('buyNetDdLbl');
  if(lbl)lbl.textContent=net.name;
  const panel=document.getElementById('buyNetPanel');
  if(panel)panel.innerHTML=nets.map(n=>`
    <button class="dep-dd-item${n.id===buyNetId?' sel':''}" data-buyn="${n.id}">
      <span>${n.name}</span>
    </button>`).join('');
}

function renderBuyView(){
  const ic=document.getElementById('buyCurDdIc'),lbl=document.getElementById('buyCurDdLbl');
  if(ic){ic.src=coinIconUrl(buyCur);ic.alt=buyCur;}
  if(lbl)lbl.textContent=buyCur;
  const panel=document.getElementById('buyCurPanel');
  if(panel)panel.innerHTML=Object.keys(DEPOSIT).map(c=>`
    <button class="dep-dd-item${c===buyCur?' sel':''}" data-buyc="${c}">
      <img src="${coinIconUrl(c)}" alt="${c}" onerror="this.style.display='none'">
      <span>${c}</span>
    </button>`).join('');
  renderBuyNetDd();
}

document.getElementById('buyCurDdBtn').addEventListener('click',()=>{
  const p=document.getElementById('buyCurPanel'),b=document.getElementById('buyCurDdBtn');
  const open=!p.hidden;p.hidden=open;b.classList.toggle('open',!open);
});
document.getElementById('buyCurPanel').addEventListener('click',e=>{
  const b=e.target.closest('[data-buyc]');if(!b)return;
  buyCur=b.dataset.buyc;buyNetId=null;
  document.getElementById('buyCurPanel').hidden=true;
  document.getElementById('buyCurDdBtn').classList.remove('open');
  renderBuyView();
});
document.getElementById('buyNetDdBtn').addEventListener('click',()=>{
  const p=document.getElementById('buyNetPanel'),b=document.getElementById('buyNetDdBtn');
  const open=!p.hidden;p.hidden=open;b.classList.toggle('open',!open);
});
document.getElementById('buyNetPanel').addEventListener('click',e=>{
  const b=e.target.closest('[data-buyn]');if(!b)return;
  buyNetId=b.dataset.buyn;
  document.getElementById('buyNetPanel').hidden=true;
  document.getElementById('buyNetDdBtn').classList.remove('open');
  renderBuyNetDd();
});
document.getElementById('buyContinueBtn').addEventListener('click',async()=>{
  const btn=document.getElementById('buyContinueBtn');
  btn.disabled=true;btn.textContent='Opening MoonPay…';
  const net=(DEPOSIT[buyCur]?.networks||[]).find(n=>n.id===buyNetId)||(DEPOSIT[buyCur]?.networks||[])[0];
  const addr=depAddrCache[buyCur+':'+(net?.id||buyCur)]||await fetchDepositAddress(buyCur,net?.id||buyCur)||'';
  const mpCur=(MOONPAY_CUR[buyCur]||{})[buyNetId]||buyCur.toLowerCase();
  /* SECURITY: API key must come from your backend — never hardcode in client JS */
  const mpKey=window._mpk||'';
  const url='https://buy-sandbox.moonpay.com/?apiKey='+mpKey
    +'&currencyCode='+mpCur
    +(addr?'&walletAddress='+encodeURIComponent(addr):'')
    +'&theme=dark&colorCode='+encodeURIComponent('#4287f5');
  window.open(url,'_blank');
  btn.disabled=false;btn.innerHTML='Continue to MoonPay &rarr;';
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
  wdSubmit.disabled=true;wdSubmit.textContent='Submitting…';
  try{
    const net=currentNetwork();
    const railwayNet=DEP_NET_MAP[net.id]||net.id.toLowerCase();
    const res=await window.voltApi._fetch('/api/wallet/withdraw',{
      method:'POST',
      body:JSON.stringify({currency:w.c,network:railwayNet,amount:a,address:addr})
    });
    const json=await res.json();
    if(!res.ok)throw new Error(json.error||'Withdrawal failed');
    if(window.loadBalances)loadBalances().catch(()=>{});
    const sub=json.txHash?'-'+fmtW(w,a)+' '+w.c+' · tx: '+json.txHash.slice(0,10)+'…':json.message||'Processing within 24h';
    showToast({icon:'↗',title:'Withdrawal submitted',sub});
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
  if(t){authMode=t.dataset.mode;showAuthErr('');renderAuth();}
});
document.getElementById('authClose').addEventListener('click',closeAuth);
authOverlay.addEventListener('click',e=>{if(e.target===authOverlay)closeAuth();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&authOverlay.classList.contains('open')){closeAuth();e.stopPropagation();}
},true);
[authEmail,authPass].forEach(i=>i.addEventListener('input',validateAuth));
authTermsCb.addEventListener('change',validateAuth);
const authErr=document.getElementById('authErr');
function showAuthErr(msg){if(authErr){authErr.textContent=msg;authErr.style.display=msg?'':'none';}}
authSubmit.addEventListener('click',async()=>{
  if(authSubmit.disabled)return;
  showAuthErr('');
  const label=authSubmit.textContent;
  authSubmit.disabled=true;
  authSubmit.textContent='…';
  try{
    if(authMode==='up'){
      const signupEmail=authEmail.value;
      const{data,error}=await supa.auth.signUp({email:signupEmail,password:authPass.value});
      if(error)throw error;
      if(!data.session){
        closeAuth();
        showToast({icon:'📧',title:'Check your email',sub:'Click the confirmation link to activate your account.'});
        return;
      }
      closeAuth();
      openUnamePicker(signupEmail);
      return;
    } else {
      const{error}=await supa.auth.signInWithPassword({email:authEmail.value,password:authPass.value});
      if(error)throw error;
    }
  } catch(err){
    authSubmit.disabled=false;
    authSubmit.textContent=label;
    showAuthErr(err.message);
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
    const{error}=await supa.auth.resetPasswordForEmail(email);
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
