/* VOLT — payments strip, deposit modal, auth modal, daily-bonus modal wiring lives in js/vip.js */
/* ---------- payments ---------- */
const PAY_COINS=['BTC','ETH','BNB','LTC','USDT','SOL','XRP','TRX','DOGE','MATIC'];
document.getElementById('payStrip').insertAdjacentHTML('beforeend',
  PAY_COINS.map(c=>`<img src="${coinIconUrl(c)}" title="${c}" alt="${c}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;flex:none" onerror="this.style.display='none'">`).join(''));

/* ---------- deposit modal ---------- */
const DEPOSIT={
  BTC:{addr:'bc1qj9w4ux0e3a8yq2v5tslh7nf06xm3r9c4kzd2e',net:'Bitcoin',min:'0.0001 BTC',conf:'1 confirmation',fee:'0.00005 BTC'},
  ETH:{addr:'',net:'Ethereum',min:'0.005 ETH',conf:'12 confirmations',fee:'0.0008 ETH'},
  BNB:{addr:'',net:'BNB Smart Chain · BEP-20',min:'0.01 BNB',conf:'15 confirmations',fee:'0.001 BNB'},
  LTC:{addr:'ltc1q8v2m4xw9c7t3p5dyh0kn6azfu1rqsje5lg8b3',net:'Litecoin',min:'0.01 LTC',conf:'3 confirmations',fee:'0.001 LTC'},
  USDT:{addr:'',net:'Ethereum · ERC-20',min:'5 USDT',conf:'12 confirmations',fee:'2 USDT'},
  SOL:{addr:'9wK3rT7pNxV2mQ8cZ5bL4dF6gH1jY0aEuSnB8XoD2RkM',net:'Solana',min:'0.05 SOL',conf:'~1 min finality',fee:'0.001 SOL'},
};
let depCur=voltCur;
const depOverlay=document.getElementById('depOverlay'),
      depCoins=document.getElementById('depCoins'),
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
const EVM_CURRENCIES=['ETH','USDT','BNB'];
const depAddrCache={};

async function fetchDepositAddress(currency){
  if(depAddrCache[currency])return depAddrCache[currency];
  const{data:{session}}=await supa.auth.getSession();
  if(!session) return null;
  const res=await fetch(
    'https://czqqdwmifcqoiyphjqjk.supabase.co/functions/v1/get-deposit-address?currency='+currency,
    {headers:{Authorization:'Bearer '+session.access_token}}
  );
  const json=await res.json();
  if(json.address){depAddrCache[currency]=json.address;return json.address;}
  return null;
}

async function renderDep(){
  const d=DEPOSIT[depCur];
  depCoins.innerHTML=WALLETS.map(x=>`
    <button class="dep-coin ${x.c===depCur?'sel':''}" data-c="${x.c}">
      ${coinImg(x.c)}${x.c}</button>`).join('');
  depNet.textContent=d.net;
  depMin.textContent=d.min;
  depConf.textContent=d.conf;
  depWarnCur.textContent=depCur;
  clearTimeout(depCopyT);
  depCopyBtn.textContent='Copy';
  depCopyBtn.classList.remove('ok');

  if(EVM_CURRENCIES.includes(depCur)){
    depAddr.textContent='Fetching address…';
    drawQr('');
    const addr=await fetchDepositAddress(depCur);
    if(addr){
      depAddr.textContent=addr;
      drawQr(addr);
      depAddrCache[depCur]=addr;
    } else {
      depAddr.textContent='Sign in to get your deposit address';
    }
  } else {
    depAddr.textContent=d.addr;
    drawQr(d.addr);
  }
}
function openDep(){depCur=voltCur;depMode='dep';renderDep();renderDepMode();depOverlay.classList.add('open');}
function closeDep(){depOverlay.classList.remove('open');}
document.getElementById('walletDep').addEventListener('click',openDep);
document.getElementById('depClose').addEventListener('click',closeDep);
depOverlay.addEventListener('click',e=>{if(e.target===depOverlay)closeDep();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&depOverlay.classList.contains('open')){closeDep();e.stopPropagation();}
},true);
depCoins.addEventListener('click',e=>{
  const b=e.target.closest('.dep-coin');if(!b)return;
  depCur=b.dataset.c;renderDep();
});
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

/* ---------- withdraw tab ---------- */
const depTabsEl=document.getElementById('depTabs'),
      depView=document.getElementById('depView'),
      wdView=document.getElementById('wdView'),
      wdCoins=document.getElementById('wdCoins'),
      wdAvail=document.getElementById('wdAvail'),
      wdAddr=document.getElementById('wdAddr'),
      wdAmt=document.getElementById('wdAmt'),
      wdFee=document.getElementById('wdFee'),
      wdCoinIc=document.getElementById('wdCoinIc'),
      wdSubmit=document.getElementById('wdSubmit');
let depMode='dep';
const depW=()=>WALLETS.find(x=>x.c===depCur);
function renderDepMode(){
  depTabsEl.querySelectorAll('.auth-tab').forEach(t=>t.classList.toggle('active',t.dataset.mode===depMode));
  depView.hidden=depMode!=='dep';
  wdView.hidden=depMode!=='wd';
  if(depMode==='wd')renderWd();
}
function renderWd(){
  const w=depW(),d=DEPOSIT[depCur];
  wdCoins.innerHTML=WALLETS.map(x=>`
    <button class="dep-coin ${x.c===depCur?'sel':''}" data-c="${x.c}">
      ${coinImg(x.c)}${x.c}</button>`).join('');
  wdAvail.textContent=fmtAmt(w)+' '+w.c;
  wdCoinIc.style.background='none';wdCoinIc.innerHTML=`<img src="${coinIconUrl(depCur)}" style="width:22px;height:22px;object-fit:cover" alt="${depCur}">`;
  wdAddr.placeholder='Paste your '+depCur+' address';
  wdFee.textContent=d.fee;
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
wdSubmit.addEventListener('click',()=>{
  if(wdSubmit.disabled)return;
  const w=depW(),a=Math.min(parseFloat(wdAmt.value)||0,w.amt);
  if(a<=0)return;
  const addr=wdAddr.value.trim();
  creditTo(w,-a);
  if(window.recordTransaction) recordTransaction({
    type:'withdraw', currency:w.c, amount:a,
    status:'pending', address:addr,
    note:'Withdrawal requested by user',
  });
  showToast({icon:'↗',title:'Withdrawal requested',sub:'-'+fmtW(w,a)+' '+w.c+' · simulated, nothing is sent'});
  wdAmt.value='';wdAddr.value='';
  renderWd();
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
[['ssoGoogle','Continue with Google']].forEach(([id,label])=>{
  const btn=document.getElementById(id);
  btn.addEventListener('click',async()=>{
    if(ssoBusy)return;
    ssoBusy=true;
    const sp=btn.querySelector('span');
    sp.textContent='Connecting…';
    const{error}=await supa.auth.signInWithOAuth({
      provider:'google',
      options:{redirectTo:location.origin+location.pathname}
    });
    if(error){sp.textContent=label;ssoBusy=false;showToast({icon:'⚠',title:'Google auth failed',sub:error.message});}
  });
});
/* Supabase auth state — keeps UI in sync with real session */
supa.auth.onAuthStateChange((_,session)=>{
  if(session){
    if(authOverlay.classList.contains('open'))finishAuth();
    else setAuth(true);
  } else {
    setAuth(false);
  }
});
supa.auth.getSession().then(({data:{session}})=>{if(session)setAuth(true);});
