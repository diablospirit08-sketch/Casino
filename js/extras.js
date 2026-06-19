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

/* ---------- profile modal ---------- */
const profOverlay=$id('profOverlay');
async function openProfile(){
  avatarWrap.classList.remove('open');
  const v=VIP_LEVELS[vipLevel()];
  const total=WALLETS.reduce((s,w)=>s+w.fiat,0);
  const streak=bonusState().streak;
  $id('profAv').style.borderColor=v.col;
  $id('profAv').style.color=v.col;
  $id('profStats').innerHTML=[
    ['Total balance','$'+total.toFixed(2)],
    ['Lifetime XP',Math.floor(vipXp).toLocaleString('en-US')],
    ['Session wagered','$'+gsession.wag.toFixed(2)],
    ['Daily streak',streak+(streak===1?' day':' days')],
  ].map(([l,vv])=>`<div class="prof-stat"><span>${l}</span><b>${vv}</b></div>`).join('');
  profOverlay.classList.add('open');
  /* populate real user data from Supabase */
  try{
    const{data:{user}}=await supa.auth.getUser();
    if(user){
      const email=user.email||'';
      const name=user.user_metadata?.full_name||user.user_metadata?.name||email.split('@')[0]||'Player';
      const since=new Date(user.created_at).toLocaleDateString('en-US',{month:'long',year:'numeric'});
      $id('profName').textContent=name;
      $id('profSub').textContent='VIP '+v.n+' · member since '+since;
      $id('profFine').textContent='Signed in as '+email;
      $id('profActions').hidden=false;
    } else {
      $id('profName').textContent='volt_player';
      $id('profSub').textContent='VIP '+v.n+' · member since June 2026';
      $id('profFine').textContent='Demo profile — progress is stored in this browser only.';
      $id('profActions').hidden=true;
    }
  }catch(_){
    $id('profSub').textContent='VIP '+v.n;
  }
  /* reset change-password form if it was open from a previous visit */
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
function _profClose(){profOverlay.classList.remove('open');_profChPwReset();$id('profChPwBtn').disabled=false;}
$id('profClose').addEventListener('click',_profClose);
profOverlay.addEventListener('click',e=>{if(e.target===profOverlay)_profClose();});

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
   State stored in localStorage scoped to user ID so settings
   survive page reload and are isolated between accounts.
   ================================================================ */
const _rgPfx='volt-rg-';let _rgUid=null;
function _rgKey(){return _rgPfx+(_rgUid||'guest');}
function _rgGet(){try{return JSON.parse(localStorage.getItem(_rgKey())||'{}');}catch{return{};}}
function _rgSet(patch){localStorage.setItem(_rgKey(),JSON.stringify({..._rgGet(),...patch}));}

/* ── enforcement: daily wager limit ── */
function _rgWagKey(){return _rgKey()+'-wag';}
function _rgTodayMs(){return new Date().toISOString().slice(0,10);}
function _rgGetWag(){try{const d=JSON.parse(localStorage.getItem(_rgWagKey())||'{}');return d.date===_rgTodayMs()?d.usd:0;}catch{return 0;}}
function _rgAddWag(usd){
  const today=_rgTodayMs();
  const cur=_rgGetWag();
  localStorage.setItem(_rgWagKey(),JSON.stringify({date:today,usd:cur+usd}));
}
/* Called by wrapped debitBet — returns false and toasts if limit would be exceeded */
function _rgCheckWager(betUsd){
  const rg=_rgGet();
  if(!rg.wagLimitDay)return true;
  const spent=_rgGetWag();
  if(spent+betUsd>rg.wagLimitDay){
    showToast({icon:'🛡',title:'Daily wager limit reached',sub:'You\'ve hit your $'+rg.wagLimitDay.toFixed(0)+' limit. Resets at midnight UTC.'});
    return false;
  }
  return true;
}
/* Wrap debitBet (defined in engines.js) to enforce the wager limit */
(function(){
  const _orig=window.debitBet;
  window.debitBet=function(){
    const w=typeof curW==='function'?curW():null;
    const b=w?Math.min(parseFloat((document.getElementById('gvBet')||{}).value||0),w.amt):0;
    if(!_rgCheckWager(b*(w?w.rate:0)))return null;
    const st=_orig.apply(this,arguments);
    if(st)_rgAddWag(st.b*st.w.rate);
    return st;
  };
})();

/* ── enforcement: self-exclusion / cool-off ── */
function _rgExclActive(){
  const rg=_rgGet();
  if(!rg.exclUntil)return null;
  if(rg.exclUntil===-1)return new Date(8640000000000000); /* permanent */
  const d=new Date(rg.exclUntil);
  if(d>new Date())return d;
  _rgSet({exclUntil:null}); /* expired — clear it */
  return null;
}
/* Check exclusion on every sign-in */
supa.auth.onAuthStateChange((_,session)=>{
  if(!session)return;
  _rgUid=session.user.id;
  const till=_rgExclActive();
  if(!till)return;
  /* sign out immediately; modals.js setAuth(false) will follow */
  supa.auth.signOut();
  const rg2=_rgGet();
  const msg=rg2.exclUntil===-1?'Your self-exclusion is permanent.':'Your exclusion expires '+till.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+'.';
  /* show after a tick so signOut's state change fires first */
  setTimeout(()=>showToast({icon:'🛡',title:'Account excluded',sub:msg,col:'#e2596a'}),120);
});
/* Also update _rgUid on sign-in so _rgKey() is correct before auth state fires */
supa.auth.getSession().then(({data:{session}})=>{if(session)_rgUid=session.user.id;});

/* ── enforcement: session time reminder ── */
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
/* bootstrap timer if one was already set */
(()=>{const rg=_rgGet();if(rg.sessRemind)_rgStartSessTimer(rg.sessRemind);})();

/* ── modal UI ── */
let _rgTab='limit';
function openRg(){
  const rg=_rgGet();
  /* render current state into the modal before opening */
  _rgRenderLimit(rg);_rgRenderSession(rg);_rgRenderExcl(rg);
  _rgSwitchTab(_rgTab);
  rgOverlay.classList.add('open');
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
function _rgRenderLimit(rg){
  const st=$id('rgLimitStatus'),cl=$id('rgLimitClear'),sv=$id('rgLimitSave');
  if(rg.wagLimitDay){
    const spent=_rgGetWag();
    st.hidden=false;
    st.className='rg-status '+(spent>=rg.wagLimitDay?'danger':'ok');
    st.textContent='Limit: $'+rg.wagLimitDay.toFixed(0)+'/day · Wagered today: $'+spent.toFixed(2);
    $id('rgLimitAmt').value=rg.wagLimitDay;
    cl.hidden=false;sv.textContent='Update Limit';
  }else{
    st.hidden=true;cl.hidden=true;sv.textContent='Set Limit';$id('rgLimitAmt').value='';
  }
}
$id('rgLimitSave').addEventListener('click',()=>{
  const v=parseFloat($id('rgLimitAmt').value);
  if(!(v>0))return;
  _rgSet({wagLimitDay:v});
  _rgRenderLimit(_rgGet());
  showToast({icon:'🛡',title:'Daily limit set',sub:'Max $'+v.toFixed(0)+' wagered per day.'});
});
$id('rgLimitClear').addEventListener('click',()=>{
  _rgSet({wagLimitDay:null});
  _rgRenderLimit(_rgGet());
  showToast({icon:'🛡',title:'Wager limit removed',sub:'Bet responsibly.'});
});

/* ── session reminder tab ── */
let _rgSessSel=null;
function _rgRenderSession(rg){
  const st=$id('rgSessStatus'),cl=$id('rgSessClear'),sv=$id('rgSessSave');
  $id('rgSessChips').querySelectorAll('.rg-chip').forEach(c=>{
    c.classList.toggle('sel',+c.dataset.m===rg.sessRemind);
  });
  _rgSessSel=rg.sessRemind||null;
  if(rg.sessRemind){
    st.hidden=false;st.className='rg-status ok';
    st.textContent='Reminder every '+_minsLabel(rg.sessRemind)+'.';
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
  _rgSet({sessRemind:_rgSessSel});
  _rgStartSessTimer(_rgSessSel);
  _rgRenderSession(_rgGet());
  showToast({icon:'⏱',title:'Session reminder set',sub:'You\'ll be reminded every '+_minsLabel(_rgSessSel)+'.'});
});
$id('rgSessClear').addEventListener('click',()=>{
  _rgSet({sessRemind:null});
  clearInterval(_rgSessTimer);_rgSessTimer=null;_rgSessSel=null;
  _rgRenderSession(_rgGet());
  showToast({icon:'⏱',title:'Session reminder cleared',sub:''});
});

/* ── self-exclusion tab ── */
let _rgExclSel=null;
function _rgRenderExcl(rg){
  const active=_rgExclActive();
  const st=$id('rgExclStatus'),chips=$id('rgExclChips'),sv=$id('rgExclSave');
  chips.querySelectorAll('.rg-chip').forEach(c=>c.classList.remove('sel'));
  if(active){
    st.hidden=false;
    const msg=rg.exclUntil===-1?'Permanent exclusion is active.':'Exclusion active until '+active.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+'.';
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
  const until=_rgExclSel===-1?-1:new Date(Date.now()+_rgExclSel*3600000).toISOString();
  _rgSet({exclUntil:until});
  rgOverlay.classList.remove('open');
  await supa.auth.signOut();
  showToast({icon:'🛡',title:'Self-exclusion activated',sub:_rgExclSel===-1?'Your account is permanently excluded.':'You can return in '+_rgHoursLabel(_rgExclSel)+'.',col:'#e2596a'});
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
$id('gvCurBtn').addEventListener('click',()=>{
  const i=WALLETS.findIndex(x=>x.c===voltCur);
  voltCur=WALLETS[(i+1)%WALLETS.length].c;
  localStorage.setItem(LS_CUR,voltCur);
  renderWallet();renderGvCur();
  if(window.gvCurSync)gvCurSync();
});
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
