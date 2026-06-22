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
  setTimeout(()=>{
    const s=$id('gameSearch');
    window.scrollTo({top:s.getBoundingClientRect().top+window.scrollY-150,behavior:'smooth'});
    s.focus({preventScroll:true});
  },wasInGame?500:0);
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
  const s=document.getElementById('railChat');
  if(s)s.click();
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
      $id('profName').textContent='volt_player';
      $id('profEmail').value='';
      $id('profUsername').value='volt_player';
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
$id('profileBtn').addEventListener('click',openProfile);
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
    await supa.auth.updateUser({data:{full_name:name}});
    $id('profName').textContent=name;
    showToast({icon:'✓',title:'Profile updated',col:'#4287f5'});
  }catch(_){showToast({icon:'⚠',title:'Could not save',col:'#f87171'});}
  btn.textContent='Save';btn.disabled=false;
});

/* ---------- vault ---------- */
const vaultOverlay=$id('vaultOverlay'),vaultAmtIn=$id('vaultAmt'),
      vaultGo=$id('vaultGo'),vaultIcEl=$id('vaultIc');
const VAULT={};
WALLETS.forEach(w=>VAULT[w.c]=0);
let vaultMode='in';
/* persistence — scoped to user ID so different accounts don't share a vault */
const _vpPfx='volt-vault-';let _vpUid=null;
function _vpKey(){return _vpPfx+(_vpUid||'guest');}
function _vpSave(){try{localStorage.setItem(_vpKey(),JSON.stringify(VAULT));}catch(_){}}
function _vpLoad(uid){
  _vpUid=uid||null;
  try{
    const s=JSON.parse(localStorage.getItem(_vpKey())||'{}');
    Object.keys(VAULT).forEach(c=>{VAULT[c]=Math.max(0,parseFloat(s[c])||0);});
  }catch(_){}
}
(async()=>{const{data:{session}}=await supa.auth.getSession();_vpLoad(session?.user?.id);renderVault();})();
supa.auth.onAuthStateChange((_,s)=>{_vpLoad(s?.user?.id);renderVault();});
function renderVault(){
  const w=curW();
  $id('vaultTabs').querySelectorAll('.auth-tab').forEach(t=>t.classList.toggle('active',t.dataset.mode===vaultMode));
  $id('vaultWal').textContent=fmtW(w,w.amt)+' '+w.c;
  $id('vaultBal').textContent=fmtW(w,VAULT[w.c])+' '+w.c;
  vaultIcEl.style.background=w.col;vaultIcEl.textContent=w.s;
  vaultGo.textContent=vaultMode==='in'?'Move to Vault':'Move to Wallet';
  validateVault();
}
function validateVault(){
  const w=curW(),a=parseFloat(vaultAmtIn.value);
  const max=vaultMode==='in'?w.amt:VAULT[w.c];
  vaultGo.disabled=!(a>0&&a<=max);
}
$id('vaultBtn').addEventListener('click',()=>{
  avatarWrap.classList.remove('open');
  vaultMode='in';vaultAmtIn.value='';
  renderVault();
  vaultOverlay.classList.add('open');
});
$id('vaultTabs').addEventListener('click',e=>{
  const t=e.target.closest('.auth-tab');
  if(t){vaultMode=t.dataset.mode;renderVault();}
});
$id('vaultMax').addEventListener('click',()=>{
  const w=curW();
  vaultAmtIn.value=fmtW(w,floorW(w,vaultMode==='in'?w.amt:VAULT[w.c]));
  validateVault();
});
vaultAmtIn.addEventListener('input',validateVault);
vaultGo.addEventListener('click',()=>{
  if(vaultGo.disabled)return;
  const w=curW();
  const max=vaultMode==='in'?w.amt:VAULT[w.c];
  const a=Math.min(parseFloat(vaultAmtIn.value)||0,max);
  if(a<=0)return;
  if(vaultMode==='in'){creditTo(w,-a);VAULT[w.c]+=a;}
  else{VAULT[w.c]-=a;creditTo(w,a);}
  _vpSave();
  showToast({icon:'🔒',title:vaultMode==='in'?'Moved to vault':'Moved to wallet',sub:fmtW(w,a)+' '+w.c});
  vaultAmtIn.value='';
  renderVault();
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
  terms:['Terms of Service','<p><b>VOLT is a fictional product</b> built for design demonstration purposes. It is not a gambling operator, holds no licence, accepts no wagers and pays out no winnings.</p><p>By using this demo you acknowledge that all balances, games, odds and rewards shown are simulated and carry no monetary value of any kind.</p><p>All game names, providers and brands shown are illustrative placeholders.</p>'],
  privacy:['Privacy Policy','<p>Your account, balances, bets and transactions are stored securely in our database. Your email and password are managed by <b>Supabase Auth</b> and never stored in plain text.</p><p>Preferences such as your avatar and selected currency are saved locally in your browser via <b>localStorage</b>. No analytics or third-party tracking scripts are used.</p>'],
  fraud:['Anti-Fraud Policy','<p>A real operator would document chargeback handling, bonus-abuse detection and multi-accounting rules here.</p><p>Since VOLT is a demo with no real money involved, this page is a placeholder for that policy.</p>'],
  aml:['AML Policy','<p>A real operator would document KYC tiers, source-of-funds checks and transaction monitoring here.</p><p>Since VOLT is a demo with no real money involved, this page is a placeholder for that policy.</p>'],
  sports:['Sports','<p>The sportsbook is not part of this demo — only the casino lobby is implemented.</p>'],
  referrals:['Referrals','<p>Invite friends, earn a cut of their wagers — that\'s how this page would work on a real platform.</p><p>In this demo there are no accounts, so there\'s no one to refer. Sorry to you and your imaginary friends.</p>'],
  help:['Help Center','<p><b>Stuck?</b> Everything in this demo runs locally: sign in with any email and a 6+ character password, claim the daily bonus from the gift icon, and play the Volt Originals with the demo balance.</p><p>For anything else, open Live Support — the chat is happy to listen, even if nobody is on the other end.</p>'],
  responsible:['Responsible Gambling',`
    <p style="color:var(--muted);line-height:1.8">At VOLT we are committed to keeping gambling fun, safe and within your control. The following tools and resources are available to every player.</p>

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
  complaint:['Complaint Form','<p>On a real platform this form would route to a support team with a ticket number and an SLA.</p><p>In this demo, your complaint has been pre-emptively resolved by virtue of nothing being real.</p>'],
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
    _rgCache=res;
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
    return _orig.apply(this,arguments);
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
