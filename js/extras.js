/* VOLT — extras: notifications, header search/chat, profile, vault, weekly race, info pages, footer links.
   Withdraw tab lives in js/modals.js. */

/* ---------- helpers ---------- */
function lobbyScroll(id){
  const go=()=>{
    if(id==='top'){window.scrollTo({top:0,behavior:'smooth'});return;}
    const el=$id(id);
    if(el)window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-86,behavior:'smooth'});
  };
  if(document.body.classList.contains('ingame')&&window.closeGame){closeGame();setTimeout(go,500);}
  else go();
}

/* ---------- notifications ---------- */
const notifWrap=$id('notifWrap'),notifBtn=$id('notifBtn'),
      notifMenu=$id('notifMenu'),notifDot=$id('notifDot');
const NOTIFS=[
  {ic:'🎁',t:'Daily bonus ready',s:'Your streak bonus is waiting behind the gift icon.',act:()=>openBonus()},
  {ic:'🏁',t:'Weekly race is live',s:'$75,000 prize pool — every $1 wagered counts.',act:()=>openRace()},
  {ic:'✨',t:'New arrivals',s:'Six fresh games just landed in the lobby.',act:()=>lobbyScroll('sec-new')},
];
notifMenu.innerHTML='<div class="mlbl">Notifications</div>'+NOTIFS.map((n,i)=>`
  <button class="nitem" data-i="${i}"><span class="nic">${n.ic}</span><div><b>${n.t}</b><span>${n.s}</span></div></button>`).join('');
notifDot.hidden=sessionStorage.getItem('volt-notif-seen')==='1';
notifBtn.addEventListener('click',e=>{
  e.stopPropagation();
  walletEl.classList.remove('open');avatarWrap.classList.remove('open');
  const open=notifWrap.classList.toggle('open');
  notifBtn.setAttribute('aria-expanded',open);
  if(open){notifDot.hidden=true;sessionStorage.setItem('volt-notif-seen','1');}
});
notifMenu.addEventListener('click',e=>{
  const b=e.target.closest('.nitem');if(!b)return;
  e.stopPropagation();
  notifWrap.classList.remove('open');
  NOTIFS[+b.dataset.i].act();
});
document.addEventListener('click',()=>notifWrap.classList.remove('open'));

/* ---------- header search ---------- */
$id('hdrSearchBtn').addEventListener('click',()=>{
  const wasInGame=document.body.classList.contains('ingame');
  if(wasInGame&&window.closeGame)closeGame();
  setTimeout(()=>{if(window.openSearch)openSearch();},wasInGame?500:0);
});

/* ---------- chat drawer ---------- */
const chatDrawer=$id('chatDrawer'),chatMsgs=$id('chatMsgs'),
      chatInput=$id('chatInput'),chatOn=$id('chatOn');
const CHAT_USERS=['Volty_88','Nina_X','Krakn','Joules','Mx_Turbo','Ohmies','spinz4dayz','0xLuna','BetWizard','gg_marek'];
const CHAT_LINES=[
  'just hit 12.4× on Plinko 🤯','anyone grinding the race this week?','gm legends ⚡',
  'Mines on 24 is pure pain lol','cashed 3.80× on Crash, heart rate 180','Berry Rush paying today fr',
  'one more spin then I sleep (lie)','streak day 6, do not talk to me tomorrow',
  'who else camping Dice 98%?','finally hit Capo 🎉','that 170× bucket exists, I refuse to believe otherwise',
];
let chatTimer=null,chatSeeded=false;
function addChat(u,txt,me){
  const el=document.createElement('div');
  el.className='cmsg'+(me?' me':'');
  const cu=document.createElement('span');
  cu.className='cu';cu.textContent=u;
  el.appendChild(cu);
  el.appendChild(document.createTextNode(txt));
  chatMsgs.appendChild(el);
  while(chatMsgs.children.length>60)chatMsgs.firstElementChild.remove();
  chatMsgs.scrollTop=chatMsgs.scrollHeight;
}
function openChat(){
  if(!chatSeeded){
    chatSeeded=true;
    for(let i=0;i<7;i++)addChat(CHAT_USERS[Math.floor(rnd(0,CHAT_USERS.length))],CHAT_LINES[i]);
  }
  chatDrawer.classList.add('open');
  clearInterval(chatTimer);
  chatTimer=setInterval(()=>{
    addChat(CHAT_USERS[Math.floor(rnd(0,CHAT_USERS.length))],CHAT_LINES[Math.floor(rnd(0,CHAT_LINES.length))]);
    chatOn.textContent=(1200+Math.floor(rnd(0,180))).toLocaleString('en-US')+' online';
  },5200);
}
function closeChat(){
  chatDrawer.classList.remove('open');
  clearInterval(chatTimer);chatTimer=null;
}
function sendChat(){
  const t=chatInput.value.trim();if(!t)return;
  addChat('You',t,true);
  chatInput.value='';
}
$id('chatBtn').addEventListener('click',()=>{chatDrawer.classList.contains('open')?closeChat():openChat();});
$id('chatClose').addEventListener('click',closeChat);
$id('contactBtn').addEventListener('click',openChat);
$id('chatSend').addEventListener('click',sendChat);
chatInput.addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();});

/* ---------- rail foot: support + language ---------- */
$id('railChat').addEventListener('click',e=>{
  e.preventDefault();
  chatDrawer.classList.contains('open')?closeChat():openChat();
});
const railLang=$id('railLang'),langBtn=$id('langBtn'),
      langMenu=$id('langMenu'),langLbl=$id('langLbl');
const LANGS=[['en','English'],['de','Deutsch'],['es','Español'],['pt','Português'],['ja','日本語']];
let curLang=localStorage.getItem('volt-lang')||'en';
if(!LANGS.some(l=>l[0]===curLang))curLang='en';
function renderLang(){
  langLbl.textContent=LANGS.find(l=>l[0]===curLang)[1];
  langMenu.innerHTML='<div class="mlbl">Language</div>'+LANGS.map(([k,l])=>`
    <button class="wmi ${k===curLang?'sel':''}" data-k="${k}"><span class="wnm">${l}</span>${TICK_SVG}</button>`).join('');
}
renderLang();
langBtn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  const open=railLang.classList.toggle('open');
  if(open){
    /* fixed-position drop-up so the rail's overflow doesn't clip it */
    const r=langBtn.getBoundingClientRect();
    langMenu.style.left=(r.right+12)+'px';
    langMenu.style.bottom=Math.max(10,window.innerHeight-r.bottom)+'px';
  }
});
langMenu.addEventListener('click',e=>{
  const b=e.target.closest('.wmi');if(!b)return;
  e.stopPropagation();
  curLang=b.dataset.k;
  localStorage.setItem('volt-lang',curLang);
  renderLang();
  railLang.classList.remove('open');
  showToast({icon:'🌐',title:'Language: '+LANGS.find(l=>l[0]===curLang)[1],sub:'Demo — interface copy stays in English'});
});
document.addEventListener('click',()=>railLang.classList.remove('open'));

/* ---------- user menu header ---------- */
async function refreshUmHead(){
  const total=WALLETS.reduce((s,w)=>s+w.fiat,0);
  $id('umBal').textContent='$'+total.toFixed(2);

  /* rank fills umAv — avatar SVG no longer shown here */

  try{
    const{data:{user}}=await supa.auth.getUser();
    if(user){
      const name=user.user_metadata?.full_name||user.user_metadata?.name||user.email?.split('@')[0]||'Player';
      const shortId=user.id.slice(0,8).toUpperCase();
      $id('umName').textContent=name;
      $id('umIdTxt').textContent='#'+shortId;
      /* upgrade topbar avatar to real photo if available */
      const photoUrl=user.user_metadata?.avatar_url||user.user_metadata?.picture||null;
      const btn=$id('avatarBtn');
      if(photoUrl&&btn.dataset.avImg!==photoUrl){
        btn.dataset.avImg=photoUrl;
        btn.innerHTML=`<span class="av-circle"><img src="${photoUrl}" alt="avatar"/></span>`;
      } else if(!photoUrl&&!btn.dataset.avImg){
        /* refresh initial in case name loaded after renderVip */
        const ini=name[0].toUpperCase();
        const circle=btn.querySelector('.av-circle');
        if(circle&&!circle.querySelector('img'))circle.textContent=ini;
      }
    } else {
      $id('umName').textContent='Guest';
      $id('umIdTxt').textContent='#DEMO';
    }
  }catch(_){}
}

/* populate header every time menu opens */
document.getElementById('avatarBtn').addEventListener('click',()=>setTimeout(refreshUmHead,0),true);

/* copy user ID */
$id('umCopy').addEventListener('click',e=>{
  e.stopPropagation();
  const txt=$id('umIdTxt').textContent;
  navigator.clipboard?.writeText(txt).catch(()=>{});
  showToast({icon:'📋',title:'ID copied',sub:txt});
});

/* wallet shortcut in menu */
$id('walletMenuBtn').addEventListener('click',()=>{avatarWrap.classList.remove('open');openDep();});

/* transactions shortcut */
$id('txnMenuBtn').addEventListener('click',()=>{avatarWrap.classList.remove('open');if(typeof openTxnModal==='function')openTxnModal();});

/* user preferences → opens profile modal */
$id('prefBtn').addEventListener('click',()=>{avatarWrap.classList.remove('open');openProfile();});

/* inbox → opens notifications panel */
$id('inboxBtn').addEventListener('click',e=>{
  e.stopPropagation();
  avatarWrap.classList.remove('open');
  const w=document.getElementById('notifWrap');
  if(w)w.classList.toggle('open');
});

/* live support → scrolls rail support link */
$id('supportMenuBtn').addEventListener('click',()=>{
  avatarWrap.classList.remove('open');
  if(typeof openLiveSupport==='function')openLiveSupport();
});

/* ---------- profile modal ---------- */
const profOverlay=$id('profOverlay');
async function openProfile(){
  avatarWrap.classList.remove('open');
  const li=vipLevel(),v=VIP_LEVELS[li],nx=VIP_LEVELS[li+1];
  const pct=nx?Math.min(100,Math.floor((vipXp-v.xp)/(nx.xp-v.xp)*100)):100;
  /* VIP progress */
  $id('profAv').style.borderColor=v.col;
  $id('profAv').style.color=v.col;
  $id('profRankBadge').textContent='Current Rank: '+v.n;
  $id('profRankBadge').style.color=v.col;
  $id('profProgFill').style.width=pct+'%';
  $id('profProgPct').textContent=pct+'% to next rank';
  $id('profProgNext').textContent=nx?nx.n:'Max Rank';
  /* stats */
  $id('profWagered').textContent='$'+gsession.wag.toFixed(2);
  profOverlay.classList.add('open');
  /* populate real user data */
  try{
    const{data:{user}}=await supa.auth.getUser();
    if(user){
      const email=user.email||'';
      const name=user.user_metadata?.full_name||user.user_metadata?.name||email.split('@')[0]||'Player';
      const since=user.created_at?new Date(user.created_at):null;
      const sinceStr=(since&&!isNaN(since))?since.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
      $id('profName').textContent=name;
      $id('profEmail').value=email;
      $id('profUsername').value=name;
      $id('profJoined').textContent=sinceStr;
      $id('profVerifiedBadge').hidden=false;
      $id('profFine').textContent='Signed in as '+email;
    } else {
      $id('profName').textContent='viofyre_player';
      $id('profEmail').value='';
      $id('profUsername').value='viofyre_player';
      $id('profJoined').textContent='—';
      $id('profVerifiedBadge').hidden=true;
      $id('profFine').textContent='Demo profile — progress is stored in this browser only.';
    }
  }catch(_){}
  _profChPwReset();
}
function _profChPwReset(){
  $id('profChPwForm').hidden=true;
  $id('profPwA').value='';$id('profPwB').value='';
  $id('profPwErr').textContent='';$id('profPwSave').disabled=true;
}
$id('profChPwBtn').addEventListener('click',()=>{
  $id('profChPwForm').hidden=false;
  $id('profChPwBtn').disabled=true;
  setTimeout(()=>$id('profPwA').focus(),40);
});
$id('profPwCancel').addEventListener('click',()=>{
  _profChPwReset();
  $id('profChPwBtn').disabled=false;
});
function _profPwValidate(){
  const a=$id('profPwA').value,b=$id('profPwB').value;
  const ok=a.length>=6&&b.length>=6;
  $id('profPwErr').textContent=ok&&a!==b?'Passwords do not match':'';
  $id('profPwSave').disabled=!(ok&&a===b);
}
[$id('profPwA'),$id('profPwB')].forEach(i=>i.addEventListener('input',_profPwValidate));
$id('profPwSave').addEventListener('click',async()=>{
  const pw=$id('profPwA').value;
  $id('profPwSave').disabled=true;$id('profPwSave').textContent='Saving…';
  const{error}=await supa.auth.updateUser({password:pw});
  $id('profPwSave').textContent='Update Password';
  if(error){$id('profPwErr').textContent=error.message;$id('profPwSave').disabled=false;return;}
  _profChPwReset();
  $id('profChPwBtn').disabled=false;
  showToast({icon:'🔒',title:'Password updated',sub:'Your new password is active.'});
});
const _profileBtn=$id('profileBtn');if(_profileBtn)_profileBtn.addEventListener('click',openProfile);
function _profClose(){profOverlay.classList.remove('open');_profChPwReset();}
$id('profClose').addEventListener('click',_profClose);
profOverlay.addEventListener('click',e=>{if(e.target===profOverlay)_profClose();});
/* prof tab switching */
document.querySelectorAll('.prof-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.prof-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const tab=btn.dataset.ptab;
    $id('profTabProfile').hidden=tab!=='profile';
    $id('profTabSessions').hidden=tab!=='sessions';
  });
});
/* prof save username */
$id('profSaveBtn').addEventListener('click',async()=>{
  const btn=$id('profSaveBtn');
  const name=$id('profUsername').value.trim();
  if(!name)return;
  btn.textContent='Saving…';btn.disabled=true;
  try{
    const r=await voltApi._fetch('/api/auth/username',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:name})});
    if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||'Save failed');}
    $id('profName').textContent=name;
    showToast({icon:'✓',title:'Profile updated',col:'#4287f5'});
  }catch(e){showToast({icon:'⚠',title:'Could not save',sub:e.message,col:'#f87171'});}
  btn.textContent='Save';btn.disabled=false;
});

/* ---------- vault ---------- */
const vaultOverlay=$id('vaultOverlay');
const VAULT={};
WALLETS.forEach(w=>VAULT[w.c]=0);
let vaultMode='lock';
let vaultCurSel=voltCur;
let _vaultHistory=[];

function _vaultW(){return WALLETS.find(x=>x.c===vaultCurSel)||WALLETS[0];}
function _vaultTimeAgo(iso){
  const s=Math.floor((Date.now()-new Date(iso))/1000);
  if(s<60)return s+'s ago';if(s<3600)return Math.floor(s/60)+'m ago';
  if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago';
}
async function _vaultFetch(){
  try{
    const res=await voltApi._fetch('/api/vault');
    if(!res.ok)return;
    const{balances,history}=await res.json();
    Object.assign(VAULT,balances);
    _vaultHistory=history||[];
  }catch(_){}
}
function _buildVaultPicker(){
  const el=$id('vaultCurPicker');if(!el)return;
  el.innerHTML=WALLETS.map(w=>`
    <button class="vault-cur-btn${w.c===vaultCurSel?' active':''}" data-vc="${w.c}">
      <img src="${coinIconUrl(w.c)}" alt="${w.c}" onerror="this.style.display='none'">
      ${w.c}
    </button>`).join('');
  el.querySelectorAll('.vault-cur-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      vaultCurSel=btn.dataset.vc;
      _buildVaultPicker();
      if($id('vaultAmt'))$id('vaultAmt').value='';
      renderVault();
    });
  });
}
function renderVault(){
  const w=_vaultW();
  const vBal=VAULT[w.c]||0;
  const door=$id('vaultDoor');
  if(door)door.classList.toggle('unlocked',vBal>0);
  const bb=$id('vaultBalBig');if(bb)bb.textContent=fmtW(w,vBal)+' '+w.c;
  const bf=$id('vaultBalFiat');if(bf)bf.textContent='≈ $'+(vBal*(w.rate||0)).toFixed(2);
  const wb=$id('vaultWalletBal');if(wb)wb.textContent=fmtW(w,w.amt)+' '+w.c;
  const ic=$id('vaultCoinIc');if(ic){ic.style.background=w.col;ic.textContent=w.s;}
  const hist=_vaultHistory.filter(h=>h.currency===w.c);
  const hEl=$id('vaultHistory');
  if(hEl){
    if(!hist.length){hEl.innerHTML='<p class="vault-empty">No vault activity yet.</p>';}
    else{hEl.innerHTML=hist.map(h=>`
      <div class="vault-hist-row">
        <div class="vault-hist-ic ${h.type==='lock'?'lock':'unlock'}">${h.type==='lock'?'🔒':'🔓'}</div>
        <span class="vault-hist-label">${h.type==='lock'?'Locked':'Unlocked'}</span>
        <b class="vault-hist-amt">${parseFloat(h.amount).toFixed(6)} ${w.c}</b>
        <span class="vault-hist-time">${_vaultTimeAgo(h.created_at)}</span>
      </div>`).join('');}
  }
  _validateVault();
}
function _validateVault(){
  const btn=$id('vaultAction');if(!btn)return;
  const w=_vaultW(),a=parseFloat(($id('vaultAmt')||{}).value)||0;
  const max=vaultMode==='lock'?w.amt:(VAULT[w.c]||0);
  btn.disabled=!(a>0&&a<=max);
}
function _setVaultMode(m){
  vaultMode=m;
  const tl=$id('vaultTabLock'),tu=$id('vaultTabUnlock'),btn=$id('vaultAction');
  if(tl)tl.classList.toggle('active',m==='lock');
  if(tu)tu.classList.toggle('active',m==='unlock');
  if(btn){
    btn.textContent=m==='lock'?'Lock Funds':'Unlock Funds';
    btn.style.background=m==='lock'?'var(--accent-grad)':'linear-gradient(90deg,#0e6b4a,#41f0a4)';
  }
  const amtIn=$id('vaultAmt');if(amtIn)amtIn.value='';
  _validateVault();
}
window.openVault=async function(){
  vaultCurSel=voltCur;
  _buildVaultPicker();
  _setVaultMode('lock');
  vaultOverlay.classList.add('open');
  await _vaultFetch();
  renderVault();
};
$id('vaultBtn').addEventListener('click',()=>{avatarWrap.classList.remove('open');openVault();});
$id('vaultTabLock').addEventListener('click',()=>_setVaultMode('lock'));
$id('vaultTabUnlock').addEventListener('click',()=>_setVaultMode('unlock'));
$id('vaultAmt').addEventListener('input',_validateVault);
$id('vaultMax').addEventListener('click',()=>{
  const w=_vaultW();
  $id('vaultAmt').value=fmtW(w,floorW(w,vaultMode==='lock'?w.amt:(VAULT[w.c]||0)));
  _validateVault();
});
document.querySelectorAll('.vault-pct').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const pct=parseInt(btn.dataset.pct)/100;
    const w=_vaultW();
    const src=vaultMode==='lock'?w.amt:(VAULT[w.c]||0);
    $id('vaultAmt').value=fmtW(w,floorW(w,src*pct));
    _validateVault();
  });
});
$id('vaultAction').addEventListener('click',async()=>{
  const w=_vaultW();
  const amtIn=$id('vaultAmt');
  const max=vaultMode==='lock'?w.amt:(VAULT[w.c]||0);
  const a=Math.min(parseFloat(amtIn.value)||0,max);
  if(a<=0)return;
  const btn=$id('vaultAction');
  btn.disabled=true;btn.textContent='Processing…';
  try{
    const endpoint=vaultMode==='lock'?'/api/vault/lock':'/api/vault/unlock';
    const res=await voltApi._fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currency:w.c,amount:a})});
    const j=await res.json();
    if(!res.ok)throw new Error(j.error||'Request failed');
    if(vaultMode==='lock'){creditTo(w,-a);VAULT[w.c]=(VAULT[w.c]||0)+a;}
    else{VAULT[w.c]=Math.max(0,(VAULT[w.c]||0)-a);creditTo(w,a);}
    showToast({icon:vaultMode==='lock'?'🔒':'🔓',title:vaultMode==='lock'?'Funds locked':'Funds unlocked',sub:fmtW(w,a)+' '+w.c+(vaultMode==='lock'?' moved to your Vault.':" returned to your wallet.")});
    amtIn.value='';
    await _vaultFetch();
    renderVault();
  }catch(e){showToast({icon:'⚠',title:'Vault error',sub:e.message,col:'#f87171'});}
  _setVaultMode(vaultMode);
});
$id('vaultClose').addEventListener('click',()=>vaultOverlay.classList.remove('open'));
vaultOverlay.addEventListener('click',e=>{if(e.target===vaultOverlay)vaultOverlay.classList.remove('open');});

/* ---------- weekly race ---------- */
const raceOverlay=$id('raceOverlay');
const RACE_PRIZES=[30000,15000,9000,6000,4500,3500,2750,2000,1500,750];
const RACERS=['Krakn','Volty_88','0xLuna','Mx_Turbo','BetWizard','Nina_X','spinz4dayz','Joules','Ohmies','gg_marek']
  .map((u,i)=>({u,pts:Math.round(2400000/(i+1.6)/100)*100}));
let raceTimer=null;
function renderRaceCd(){
  const now=new Date();
  const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+((7-now.getUTCDay())%7),23,59,59));
  let s=Math.max(0,Math.floor((end-now)/1000));
  const d=Math.floor(s/86400);s-=d*86400;
  const h=Math.floor(s/3600);s-=h*3600;
  const m=Math.floor(s/60);s-=m*60;
  $id('raceCd').innerHTML=[[d,'Days'],[h,'Hours'],[m,'Min'],[s,'Sec']]
    .map(([vv,l])=>`<div class="rc"><b>${String(vv).padStart(2,'0')}</b><span>${l}</span></div>`).join('');
}
function openRace(){
  $id('raceBoard').innerHTML=RACERS.map((r,i)=>`
    <div class="race-row">
      <span class="rp">${['🥇','🥈','🥉'][i]||'#'+(i+1)}</span>
      <span class="ru">${r.u}</span>
      <span class="rw">${r.pts.toLocaleString('en-US')} pts</span>
      <span class="rz">$${RACE_PRIZES[i].toLocaleString('en-US')}</span>
    </div>`).join('')
    +`<div class="race-row you"><span class="rp">—</span><span class="ru">You</span><span class="rw">${Math.floor(gsession.wag).toLocaleString('en-US')} pts</span><span class="rz">$0</span></div>`;
  renderRaceCd();
  clearInterval(raceTimer);
  raceTimer=setInterval(renderRaceCd,1000);
  raceOverlay.classList.add('open');
}
function closeRace(){
  raceOverlay.classList.remove('open');
  clearInterval(raceTimer);raceTimer=null;
}
$id('promoRace')?.addEventListener('click',openRace);
$id('promoRace')?.addEventListener('keydown',e=>{
  if(e.key==='Enter'||e.key===' '){e.preventDefault();openRace();}
});
$id('raceClose').addEventListener('click',closeRace);
raceOverlay.addEventListener('click',e=>{if(e.target===raceOverlay)closeRace();});

/* ---------- info pages + footer links ---------- */
const infoOverlay=$id('infoOverlay');
const PAGES={
  terms:['Terms of Service','<p><b>VIOFYRE is a fictional product</b> built for design demonstration purposes. It is not a gambling operator, holds no licence, accepts no wagers and pays out no winnings.</p><p>By using this demo you acknowledge that all balances, games, odds and rewards shown are simulated and carry no monetary value of any kind.</p><p>All game names, providers and brands shown are illustrative placeholders.</p>'],
  privacy:['Privacy Policy','<p>Your account, balances, bets and transactions are stored securely in our database. Your email and password are managed by <b>Supabase Auth</b> and never stored in plain text.</p><p>Preferences such as your avatar and selected currency are saved locally in your browser via <b>localStorage</b>. No analytics or third-party tracking scripts are used.</p>'],
  fraud:['Anti-Fraud Policy','<p>A real operator would document chargeback handling, bonus-abuse detection and multi-accounting rules here.</p><p>Since VIOFYRE is a demo with no real money involved, this page is a placeholder for that policy.</p>'],
  aml:['AML Policy','<p>A real operator would document KYC tiers, source-of-funds checks and transaction monitoring here.</p><p>Since VIOFYRE is a demo with no real money involved, this page is a placeholder for that policy.</p>'],
  sports:['Sports','<p>The sportsbook is not part of this demo — only the casino lobby is implemented.</p>'],
  referrals:['Referrals','<p>Invite friends, earn a cut of their wagers — that\'s how this page would work on a real platform.</p><p>In this demo there are no accounts, so there\'s no one to refer. Sorry to you and your imaginary friends.</p>'],
  help:['Help Center',`
    <style>.faq-item{border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:8px}.faq-q{width:100%;background:var(--panel-2);border:none;color:var(--txt);font-family:inherit;font-size:13px;font-weight:700;text-align:left;padding:14px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:12px}.faq-q:hover{background:var(--panel)}.faq-q .arr{font-size:16px;transition:transform .2s;flex:none}.faq-item.open .arr{transform:rotate(180deg)}.faq-a{display:none;padding:14px 16px;font-size:12.5px;color:var(--muted);line-height:1.7;background:var(--panel)}.faq-item.open .faq-a{display:block}.faq-cat{font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-2);margin:18px 0 8px}</style>
    <p class="faq-cat">Account</p>
    <div class="faq-item"><button class="faq-q">How do I create an account?<span class="arr">&#8964;</span></button><div class="faq-a">Click <b>Sign Up</b> in the top-right corner. Enter your email, choose a username and a password of at least 8 characters. You'll be logged in immediately.</div></div>
    <div class="faq-item"><button class="faq-q">How do I change my username or password?<span class="arr">&#8964;</span></button><div class="faq-a">Go to your <b>Avatar → User Preferences</b>. You can update your username anytime. To change your password, click <b>Change Password</b> in the same screen.</div></div>
    <div class="faq-item"><button class="faq-q">I forgot my password. What do I do?<span class="arr">&#8964;</span></button><div class="faq-a">On the login screen click <b>Forgot password?</b> and enter your email. You'll receive a reset link within a few minutes. Check your spam folder if it doesn't arrive.</div></div>
    <p class="faq-cat">Deposits & Withdrawals</p>
    <div class="faq-item"><button class="faq-q">Which cryptocurrencies do you accept?<span class="arr">&#8964;</span></button><div class="faq-a">We currently support <b>BTC, ETH, BNB, USDT, and USDC</b>. More currencies are added regularly. Each currency has its own deposit address — always double-check you're sending to the correct network.</div></div>
    <div class="faq-item"><button class="faq-q">How long do deposits take?<span class="arr">&#8964;</span></button><div class="faq-a">Deposits are credited after the required number of network confirmations: BTC (3), ETH/BNB/USDT/USDC (12). This typically takes 5–30 minutes depending on network congestion.</div></div>
    <div class="faq-item"><button class="faq-q">What is the minimum withdrawal?<span class="arr">&#8964;</span></button><div class="faq-a">Minimum withdrawals vary by currency. Network fees are deducted from the withdrawal amount. You can see exact minimums on the <b>Withdraw</b> screen after selecting your currency.</div></div>
    <p class="faq-cat">Games & Fairness</p>
    <div class="faq-item"><button class="faq-q">Are the games provably fair?<span class="arr">&#8964;</span></button><div class="faq-a">Yes. All VioFyre Originals (Dice, Mines, Plinko, Crash, etc.) use a <b>provably fair</b> system. Each bet generates a server seed hash before the bet is placed — you can verify any result using the Verify tool on the game screen.</div></div>
    <div class="faq-item"><button class="faq-q">What is RTP and where can I find it?<span class="arr">&#8964;</span></button><div class="faq-a"><b>Return to Player (RTP)</b> is the percentage of wagered money a game pays back over time. It's displayed on every game tile and inside the game header. VioFyre Originals are set at 97–99% RTP.</div></div>
    <div class="faq-item"><button class="faq-q">What is the Vio Token?<span class="arr">&#8964;</span></button><div class="faq-a">VIO is our loyalty token. You earn <b>1 VIO for every $10 wagered</b>. Accumulated VIO can be withdrawn to your BNB wallet once the contract is live. Track your balance via the ⚡ icon in the header.</div></div>
    <p class="faq-cat">Bonuses & VIP</p>
    <div class="faq-item"><button class="faq-q">How does the Welcome Bonus work?<span class="arr">&#8964;</span></button><div class="faq-a">New players receive a <b>200% match up to $1,000</b> on their first deposit. The bonus has a 30× wagering requirement before withdrawal. Full terms are available on the Promotions page.</div></div>
    <div class="faq-item"><button class="faq-q">How do I climb the VIP ranks?<span class="arr">&#8964;</span></button><div class="faq-a">VIP rank is determined by your total lifetime wager. Each rank unlocks higher cashback rates, faster withdrawals, and dedicated account managers. You can see your progress under <b>Loyalty Program</b> on the lobby page.</div></div>
    <script>(function(){document.querySelectorAll('.faq-q').forEach(function(btn){btn.addEventListener('click',function(){var item=btn.closest('.faq-item');item.classList.toggle('open');});});})();</script>
  `],
  responsible:['Responsible Gambling',`
    <p style="color:var(--muted);line-height:1.8">At VIOFYRE we are committed to keeping gambling fun, safe and within your control. The following tools and resources are available to every player.</p>

    <h3 style="font-size:13px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;margin:22px 0 10px;color:var(--txt)">⚠️ Warning Signs</h3>
    <ul style="color:var(--muted);line-height:2;padding-left:18px">
      <li>Spending more than you can afford to lose</li>
      <li>Chasing losses to try to win money back</li>
      <li>Gambling interfering with work, family or daily life</li>
      <li>Feeling anxious, irritable or restless when not gambling</li>
      <li>Borrowing money or selling possessions to gamble</li>
      <li>Hiding your gambling from friends or family</li>
    </ul>

    <h3 style="font-size:13px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;margin:22px 0 10px;color:var(--txt)">🛡️ Tools Available to You</h3>
    <div style="display:grid;gap:10px">
      <div style="background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:14px 16px">
        <b style="font-size:13px">Deposit Limits</b>
        <p style="color:var(--muted);font-size:12px;margin-top:4px">Set daily, weekly or monthly deposit limits to stay in control of your spending. Limits take effect immediately.</p>
      </div>
      <div style="background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:14px 16px">
        <b style="font-size:13px">Reality Check</b>
        <p style="color:var(--muted);font-size:12px;margin-top:4px">Set reminders that notify you how long you have been playing, helping you take regular breaks.</p>
      </div>
      <div style="background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:14px 16px">
        <b style="font-size:13px">Self-Exclusion</b>
        <p style="color:var(--muted);font-size:12px;margin-top:4px">Take a break from gambling for 24 hours, 1 week, 1 month, or permanently. Contact support to activate.</p>
      </div>
      <div style="background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:14px 16px">
        <b style="font-size:13px">Cool-Off Period</b>
        <p style="color:var(--muted);font-size:12px;margin-top:4px">Temporarily suspend your account for a short cooling-off period without full self-exclusion.</p>
      </div>
    </div>

    <h3 style="font-size:13px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;margin:22px 0 10px;color:var(--txt)">📞 Free Help & Support</h3>
    <div style="display:grid;gap:8px">
      <a href="https://www.begambleaware.org" target="_blank" rel="noopener" class="rg-help-link">
        <div><b style="font-size:13px">BeGambleAware</b><p style="color:var(--muted);font-size:12px;margin-top:2px">Free advice, information &amp; support</p></div>
        <span style="color:var(--muted);font-size:12px">begambleaware.org →</span>
      </a>
      <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener" class="rg-help-link">
        <div><b style="font-size:13px">GamCare</b><p style="color:var(--muted);font-size:12px;margin-top:2px">National Gambling Helpline: 0808 8020 133</p></div>
        <span style="color:var(--muted);font-size:12px">gamcare.org.uk →</span>
      </a>
      <a href="https://www.gamblersanonymous.org.uk" target="_blank" rel="noopener" class="rg-help-link">
        <div><b style="font-size:13px">Gamblers Anonymous</b><p style="color:var(--muted);font-size:12px;margin-top:2px">Peer support meetings worldwide</p></div>
        <span style="color:var(--muted);font-size:12px">gamblersanonymous.org →</span>
      </a>
    </div>

    <div style="margin-top:20px;background:rgba(192,57,43,.1);border:1px solid rgba(192,57,43,.3);border-radius:10px;padding:14px 16px">
      <p style="color:#e74c3c;font-size:12px;line-height:1.7"><b>Remember:</b> Gambling should always be entertainment, not a way to make money. Never gamble with money you cannot afford to lose. If you feel you have a problem, please reach out — help is free, confidential and available 24/7.</p>
    </div>
  `],
  complaint:['Complaint Form',`
    <style>.cf-field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}.cf-field label{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.cf-field input,.cf-field select,.cf-field textarea{background:var(--panel-2);border:1px solid var(--line-2);border-radius:8px;color:var(--txt);font-family:inherit;font-size:13px;padding:10px 13px;outline:none;transition:border-color .15s}.cf-field input:focus,.cf-field select:focus,.cf-field textarea:focus{border-color:var(--mint)}.cf-field textarea{resize:vertical;min-height:110px}.cf-field select option{background:var(--panel-2)}#cfErr{font-size:12px;color:#e2596a;min-height:16px;margin-bottom:6px}#cfOk{font-size:12px;color:#4ade80;min-height:16px;margin-bottom:6px}</style>
    <p style="font-size:12.5px;color:var(--muted);margin-bottom:18px;line-height:1.6">We aim to respond to all complaints within <b>48 hours</b>. For urgent issues, use <b>Live Support</b>.</p>
    <form id="cfForm" onsubmit="return false">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="cf-field"><label>Your Name</label><input id="cfName" type="text" placeholder="Optional" maxlength="80"/></div>
        <div class="cf-field"><label>Email *</label><input id="cfEmail" type="email" placeholder="your@email.com" required maxlength="254"/></div>
      </div>
      <div class="cf-field"><label>Category</label>
        <select id="cfCat">
          <option value="general">General</option>
          <option value="account">Account</option>
          <option value="payment">Payment / Withdrawal</option>
          <option value="game">Game Issue</option>
          <option value="bonus">Bonus / Promotion</option>
          <option value="technical">Technical Problem</option>
        </select>
      </div>
      <div class="cf-field"><label>Subject *</label><input id="cfSubject" type="text" placeholder="Brief description of your issue" required maxlength="120"/></div>
      <div class="cf-field"><label>Message *</label><textarea id="cfMsg" placeholder="Please describe the issue in as much detail as possible..." required maxlength="4000"></textarea></div>
      <div id="cfErr"></div><div id="cfOk"></div>
      <button type="submit" class="auth-submit" id="cfBtn" style="width:100%">Submit Complaint</button>
    </form>
    <script>(function(){
      var form=document.getElementById('cfForm');
      if(!form||form._cfBound)return;form._cfBound=true;
      form.addEventListener('submit',async function(){
        var btn=document.getElementById('cfBtn');
        var err=document.getElementById('cfErr');var ok=document.getElementById('cfOk');
        err.textContent='';ok.textContent='';
        var email=document.getElementById('cfEmail').value.trim();
        var subject=document.getElementById('cfSubject').value.trim();
        var msg=document.getElementById('cfMsg').value.trim();
        if(!email||!subject||msg.length<10){err.textContent='Please fill in all required fields (message min 10 chars).';return;}
        btn.disabled=true;btn.textContent='Submitting…';
        try{
          var res=await fetch('/api/complaints',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('cfName').value.trim()||undefined,email:email,category:document.getElementById('cfCat').value,subject:subject,message:msg})});
          var j=await res.json();
          if(!res.ok)throw new Error(j.error||'Submission failed');
          ok.textContent='✓ '+j.message;
          form.reset();
        }catch(e){err.textContent='⚠ '+e.message;}
        btn.disabled=false;btn.textContent='Submit Complaint';
      });
    })();</script>
  `],
};
function openInfo(key){
  const p=PAGES[key];if(!p)return;
  $id('infoTitle').textContent=p[0];
  $id('infoBody').innerHTML=p[1];
  infoOverlay.classList.add('open');
}
$id('infoClose').addEventListener('click',()=>infoOverlay.classList.remove('open'));
infoOverlay.addEventListener('click',e=>{if(e.target===infoOverlay)infoOverlay.classList.remove('open');});
const ACTS={
  top:()=>lobbyScroll('top'),
  providers:()=>lobbyScroll('provSection'),
  race:openRace,
  bonus:()=>openBonus(),
  vip:()=>vipOverlay.classList.add('open'),
  chat:openChat,
  support:()=>{if(typeof openLiveSupport==='function')openLiveSupport();},
  responsible:()=>openRg(),
};
document.addEventListener('click',e=>{
  const a=e.target.closest('a[data-act]');
  if(!a)return;
  e.preventDefault();
  const k=a.dataset.act;
  (ACTS[k]||(()=>openInfo(k)))();
});

/* ---------- escape closes extras ---------- */
const rgOverlay=$id('rgOverlay');
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  const open=[raceOverlay,profOverlay,vaultOverlay,infoOverlay,rgOverlay].find(o=>o.classList.contains('open'));
  if(open){
    if(open===raceOverlay)closeRace();
    else open.classList.remove('open');
    e.stopPropagation();
    return;
  }
  if(chatDrawer.classList.contains('open')){closeChat();e.stopPropagation();}
},true);

/* ---------- profile action: open RG from profile modal ---------- */
$id('profRgBtn').addEventListener('click',()=>{_profClose();openRg();});

/* ================================================================
   RESPONSIBLE GAMING
   Limits are stored server-side (POST /api/rg/limits).
   We keep a local cache (_rgCache) so the pre-flight wager check
   gives instant feedback without waiting for a server round-trip.
   Session timer remains localStorage-only (not a security control).
   ================================================================ */

/* Current user ID from voltApi session — used only for localStorage session timer key */
function _rgUid(){try{return JSON.parse(localStorage.getItem('volt-user')||'{}').id||'guest';}catch{return'guest';}}
function _rgSessKey(){return'volt-rg-sess-'+_rgUid();}

/* In-memory cache of limits fetched from server */
let _rgCache=null; /* null=not loaded yet; {} means no limits set */

async function _rgLoadFromServer(){
  try{
    const w=typeof curW==='function'?curW():null;
    const cur=w?w.c:'BNB';
    const res=await voltApi._fetch('/api/rg/limits?currency='+cur);
    _rgCache=res.ok?await res.json():{};
  }catch(e){_rgCache={};}
}

/* ── enforcement: daily wager limit (pre-flight client-side check) ── */
/* The real enforcement is server-side in bets.js; this gives instant UX feedback */
function _rgCheckWager(wager){
  if(!_rgCache||!_rgCache.wager||!_rgCache.wager.daily)return true;
  const limit=parseFloat(_rgCache.wager.daily);
  const spent=(_rgCache.usage&&_rgCache.usage.wageredToday)||0;
  if(spent+wager>limit){
    const c=(_rgCache.currency||'');
    showToast({icon:'🛡',title:'Daily wager limit reached',sub:'Limit: '+limit+' '+c+'/day. Resets at midnight UTC.'});
    return false;
  }
  return true;
}
/* Wrap debitBet to run the pre-flight wager check */
(function(){
  const _orig=window.debitBet;
  window.debitBet=function(){
    const w=typeof curW==='function'?curW():null;
    const b=w?Math.min(parseFloat((document.getElementById('gvBet')||{}).value||0),w.amt):0;
    if(!_rgCheckWager(b))return null;
    if(_orig)return _orig.apply(this,arguments);
  };
})();

/* ── enforcement: session time reminder (localStorage-only — UX, not security) ── */
let _rgSessTimer=null;
const _rgSessStart=Date.now();
function _rgStartSessTimer(mins){
  clearInterval(_rgSessTimer);
  if(!mins)return;
  _rgSessTimer=setInterval(()=>{
    const elapsed=Math.round((Date.now()-_rgSessStart)/60000);
    showToast({icon:'⏱',title:'Session reminder',sub:'You\'ve been playing for '+elapsed+' min. Take a break?'});
  },mins*60000);
}
(()=>{const s=localStorage.getItem(_rgSessKey());if(s)_rgStartSessTimer(+s);})();

/* ── modal UI ── */
let _rgTab='limit';
async function openRg(){
  rgOverlay.classList.add('open');
  _rgSwitchTab(_rgTab);
  /* load fresh data from server then render */
  await _rgLoadFromServer();
  _rgRenderLimit();_rgRenderSession();_rgRenderExcl();
}
$id('rgClose').addEventListener('click',()=>rgOverlay.classList.remove('open'));
rgOverlay.addEventListener('click',e=>{if(e.target===rgOverlay)rgOverlay.classList.remove('open');});

$id('rgTabs').addEventListener('click',e=>{
  const b=e.target.closest('.rg-tab');if(!b)return;
  _rgTab=b.dataset.tab;_rgSwitchTab(_rgTab);
});
function _rgSwitchTab(tab){
  $id('rgTabs').querySelectorAll('.rg-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  ['limit','session','excl'].forEach(t=>$id('rgTab'+t.charAt(0).toUpperCase()+t.slice(1)).hidden=t!==tab);
}

/* ── wager limit tab ── */
function _rgRenderLimit(){
  const d=_rgCache||{};
  const limit=d.wager&&d.wager.daily!=null?parseFloat(d.wager.daily):null;
  const spent=(d.usage&&d.usage.wageredToday)||0;
  const c=d.currency||'';
  const st=$id('rgLimitStatus'),cl=$id('rgLimitClear'),sv=$id('rgLimitSave');
  if(limit!=null){
    st.hidden=false;
    st.className='rg-status '+(spent>=limit?'danger':'ok');
    st.textContent='Limit: '+limit+' '+c+'/day · Wagered today: '+spent.toFixed(8).replace(/\.?0+$/,'')+' '+c;
    $id('rgLimitAmt').value=limit;
    cl.hidden=false;sv.textContent='Update Limit';
  }else{
    st.hidden=true;cl.hidden=true;sv.textContent='Set Limit';$id('rgLimitAmt').value='';
  }
}
$id('rgLimitSave').addEventListener('click',async()=>{
  const v=parseFloat($id('rgLimitAmt').value);
  if(!(v>0))return;
  try{
    await voltApi._fetch('/api/rg/limits',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({wager_daily:v})});
    await _rgLoadFromServer();_rgRenderLimit();
    showToast({icon:'🛡',title:'Daily wager limit set',sub:'Max '+v+' '+(_rgCache&&_rgCache.currency||'')+' wagered per day.'});
  }catch(e){showToast({icon:'⚠',title:'Failed to save limit',sub:e.message});}
});
$id('rgLimitClear').addEventListener('click',async()=>{
  try{
    await voltApi._fetch('/api/rg/limits',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({keys:['wager_daily']})});
    await _rgLoadFromServer();_rgRenderLimit();
    showToast({icon:'🛡',title:'Daily wager limit removed',sub:'Bet responsibly.'});
  }catch(e){showToast({icon:'⚠',title:'Failed to remove limit',sub:e.message});}
});

/* ── session reminder tab (localStorage — UX only) ── */
let _rgSessSel=null;
function _rgRenderSession(){
  const stored=localStorage.getItem(_rgSessKey());
  const mins=stored?+stored:null;
  const st=$id('rgSessStatus'),cl=$id('rgSessClear'),sv=$id('rgSessSave');
  $id('rgSessChips').querySelectorAll('.rg-chip').forEach(c=>{
    c.classList.toggle('sel',+c.dataset.m===mins);
  });
  _rgSessSel=mins||null;
  if(mins){
    st.hidden=false;st.className='rg-status ok';
    st.textContent='Reminder every '+_minsLabel(mins)+'.';
    cl.hidden=false;sv.textContent='Update Reminder';
  }else{
    st.hidden=true;cl.hidden=true;sv.textContent='Set Reminder';sv.disabled=true;
  }
}
function _minsLabel(m){return m<60?m+' min':(m/60)+(m===60?'hr':'hrs');}
$id('rgSessChips').addEventListener('click',e=>{
  const b=e.target.closest('.rg-chip');if(!b)return;
  $id('rgSessChips').querySelectorAll('.rg-chip').forEach(c=>c.classList.toggle('sel',c===b));
  _rgSessSel=+b.dataset.m;
  $id('rgSessSave').disabled=false;
});
$id('rgSessSave').addEventListener('click',()=>{
  if(!_rgSessSel)return;
  localStorage.setItem(_rgSessKey(),_rgSessSel);
  _rgStartSessTimer(_rgSessSel);
  _rgRenderSession();
  showToast({icon:'⏱',title:'Session reminder set',sub:'You\'ll be reminded every '+_minsLabel(_rgSessSel)+'.'});
});
$id('rgSessClear').addEventListener('click',()=>{
  localStorage.removeItem(_rgSessKey());
  clearInterval(_rgSessTimer);_rgSessTimer=null;_rgSessSel=null;
  _rgRenderSession();
  showToast({icon:'⏱',title:'Session reminder cleared',sub:''});
});

/* ── self-exclusion tab ── */
let _rgExclSel=null;
function _rgRenderExcl(){
  const d=_rgCache||{};
  const excl=d.excluded; /* null | 'permanent' | ISO date string */
  const st=$id('rgExclStatus'),chips=$id('rgExclChips'),sv=$id('rgExclSave');
  chips.querySelectorAll('.rg-chip').forEach(c=>c.classList.remove('sel'));
  if(excl){
    st.hidden=false;
    const msg=excl==='permanent'?'Permanent exclusion is active.':
      'Exclusion active until '+new Date(excl).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+'.';
    st.textContent=msg;
    chips.querySelectorAll('.rg-chip').forEach(c=>{c.disabled=true;});
    sv.disabled=true;sv.textContent='Exclusion Active';
  }else{
    st.hidden=true;
    chips.querySelectorAll('.rg-chip').forEach(c=>{c.disabled=false;});
    sv.disabled=true;sv.textContent='Activate Self-Exclusion';_rgExclSel=null;
  }
}
$id('rgExclChips').addEventListener('click',e=>{
  const b=e.target.closest('.rg-chip');if(!b||b.disabled)return;
  $id('rgExclChips').querySelectorAll('.rg-chip').forEach(c=>c.classList.toggle('sel',c===b));
  _rgExclSel=+b.dataset.h;
  $id('rgExclSave').disabled=false;
});
$id('rgExclSave').addEventListener('click',async()=>{
  if(_rgExclSel==null)return;
  const period=_rgExclSel===-1?'permanent':_rgExclSel;
  try{
    const res=await voltApi._fetch('/api/rg/exclude',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({period})});
    rgOverlay.classList.remove('open');
    /* log out client-side — server already revoked all refresh tokens */
    if(typeof voltApi.logout==='function')voltApi.logout();
    else{localStorage.removeItem('volt-access-token');localStorage.removeItem('volt-refresh-token');localStorage.removeItem('volt-user');window.location.reload();}
    showToast({icon:'🛡',title:'Self-exclusion activated',sub:res.message||'Account excluded.',col:'#e2596a'});
  }catch(e){showToast({icon:'⚠',title:'Failed to exclude',sub:e.message});}
});
function _rgHoursLabel(h){if(h<48)return h+'h';if(h<336)return Math.round(h/24)+'d';return Math.round(h/720)+'mo';}

/* ---------- game view toolbar ---------- */
function renderGvCur(){
  const w=WALLETS.find(x=>x.c===voltCur),ic=$id('gvCurIc');
  ic.style.background='none';
  ic.innerHTML=`<img src="${coinIconUrl(w.c)}" style="width:22px;height:22px;object-fit:cover;border-radius:50%" alt="${w.c}" onerror="var p=this.parentElement;p.style.background='${w.col}';p.innerHTML='${w.s}'">`;
  $id('gvCurLbl').textContent=w.c;
}
renderGvCur();

/* currency dropdown */
(function(){
  const btn=$id('gvCurBtn');
  let menu=null,scrollEl=null;
  function closeMenu(){
    if(menu){menu.remove();menu=null;}
    if(scrollEl){scrollEl.removeEventListener('scroll',closeMenu);scrollEl=null;}
    window.removeEventListener('scroll',closeMenu);
  }
  function openMenu(){
    if(menu){closeMenu();return;}
    const r=btn.getBoundingClientRect();
    menu=document.createElement('div');
    const estH=WALLETS.length*38+10;
    const top=r.bottom+6+estH>window.innerHeight ? r.top-estH-6 : r.bottom+6;
    /* use position:absolute on document.documentElement to avoid body overflow-x:hidden breaking fixed */
    menu.style.cssText='position:fixed;z-index:9999;top:'+top+'px;left:'+r.left+'px;min-width:180px;background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:5px;box-shadow:0 16px 40px -8px rgba(0,0,0,.8)';
    menu.innerHTML=WALLETS.map(w=>`
      <button data-c="${w.c}" style="display:flex;align-items:center;gap:9px;width:100%;padding:8px 10px;background:${w.c===voltCur?'rgba(65,240,164,.08)':'transparent'};border:none;border-radius:8px;color:${w.c===voltCur?'var(--mint)':'var(--txt)'};font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;transition:.12s" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background='${w.c===voltCur?'rgba(65,240,164,.08)':'transparent'}'">
        <img src="${coinIconUrl(w.c)}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;flex:none" onerror="this.style.display='none'">
        <span>${w.c}</span>
        <span style="margin-left:auto;font-size:10px;color:var(--muted);font-variant-numeric:tabular-nums">${fmtAmt(w)}</span>
      </button>`).join('');
    menu.addEventListener('click',function(e){
      const b=e.target.closest('[data-c]');if(!b)return;
      voltCur=b.dataset.c;
      localStorage.setItem(LS_CUR,voltCur);
      renderWallet();renderGvCur();
      if(window.gvCurSync)gvCurSync();
      closeMenu();
    });
    /* append to <html> so body's overflow-x:hidden doesn't trap fixed positioning */
    document.documentElement.appendChild(menu);
    /* close on any scroll */
    window.addEventListener('scroll',closeMenu,{passive:true});
    const main=document.querySelector('.main-wrap')||document.querySelector('main');
    if(main){scrollEl=main;main.addEventListener('scroll',closeMenu,{passive:true});}
    setTimeout(()=>document.addEventListener('click',function h(e){
      if(!btn.contains(e.target)&&(!menu||!menu.contains(e.target))){closeMenu();document.removeEventListener('click',h);}
    }),0);
  }
  btn.addEventListener('click',openMenu);
})();

walletMenu.addEventListener('click',()=>setTimeout(renderGvCur,0));
// Fun / Real play toolbar toggle
(function(){
  function revertToFun(pill,funLbl,realLbl){
    pill.classList.remove('real');
    funLbl.classList.add('active');
    realLbl.classList.remove('active');
  }
  function setMode(fun){
    const pill=$id('gvTogPill');
    const funLbl=$id('gvFunLbl');
    const realLbl=$id('gvRealLbl');
    if(!pill)return;
    pill.classList.toggle('real',!fun);
    funLbl.classList.toggle('active',fun);
    realLbl.classList.toggle('active',!fun);
    if(!fun){
      if(!document.body.classList.contains('authed')){
        openAuth('up');
        revertToFun(pill,funLbl,realLbl);
        return;
      }
      const bal=(WALLETS.find(w=>w.c===voltCur)||{}).amt||0;
      if(bal<=0){
        showToast({icon:'💳',title:'No balance',sub:'Add funds to play with real money'});
        openDep();
        revertToFun(pill,funLbl,realLbl);
        return;
      }
    }
  }
  $id('gvFunLbl').addEventListener('click',()=>setMode(true));
  $id('gvRealLbl').addEventListener('click',()=>setMode(false));
  $id('gvTogPill').addEventListener('click',function(){
    setMode(this.classList.contains('real'));
  });
})();
$id('gvFavBtn').addEventListener('click',function(){
  const on=this.classList.toggle('active');
  showToast({icon:on?'💚':'🤍',title:on?'Added to favourites':'Removed from favourites',sub:gvName.textContent});
});
$id('gvStatsBtn').addEventListener('click',()=>{
  showToast({icon:'📊',title:'Game stats',sub:'Demo — detailed stats coming soon'});
});
$id('gvTheaterBtn').addEventListener('click',function(){
  const on=!document.body.classList.contains('rail-min');
  setRailMin(on);
  this.classList.toggle('active',on);
});
$id('gvSetBtn').addEventListener('click',()=>{
  showToast({icon:'⚙️',title:'Settings',sub:'Demo — nothing to configure yet'});
});
