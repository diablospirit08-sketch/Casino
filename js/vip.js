/* ---------- gamification: vip xp, level-up toasts, daily bonus ---------- */
const VIP_LEVELS=[
  {n:'Associate',xp:0,    col:'#c98b4a',mult:1,  rn:'I',  perk:'5% weekly cashback', rb:1},
  {n:'Soldier',  xp:500,  col:'#aeb6c2',mult:1.5,rn:'II', perk:'Free spins drops',   rb:2},
  {n:'Capo',     xp:2500, col:'#f0c05a',mult:2,  rn:'III',perk:'A personal host',     rb:3.5},
  {n:'Underboss',xp:10000,col:'#8fd0d8',mult:3,  rn:'IV', perk:'Higher limits & odds',rb:5},
  {n:'Don',      xp:50000,col:'#41cdf0',mult:5,  rn:'V',  perk:'Bespoke rewards',     rb:8},
];
const LS_XP='volt-xp',LS_STREAK='volt-streak',LS_CLAIM='volt-claim';
let vipXp=parseFloat(localStorage.getItem(LS_XP))||0;
const vipLevel=()=>{let l=0;VIP_LEVELS.forEach((v,i)=>{if(vipXp>=v.xp)l=i;});return l;};

function showToast(o){
  const t=document.createElement('div');
  const col=o.col||'#41f0a4';
  t.className='toast';t.style.borderLeftColor=col;
  t.innerHTML=`<span class="tic" style="background:${col}22;color:${col}">${o.icon||'⚡'}</span><div><b>${o.title}</b><span>${o.sub||''}</span></div>`;
  $id('toasts').appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),320);},3800);
}

function renderVip(){
  const li=vipLevel(),v=VIP_LEVELS[li],nx=VIP_LEVELS[li+1];
  const pct=nx?Math.min(100,(vipXp-v.xp)/(nx.xp-v.xp)*100):100;
  $id('vipBlock').innerHTML=`
    <div class="vip-top">
      <span class="vip-badge" style="background:${v.col}1f;border:1px solid ${v.col}">
        <svg viewBox="0 0 24 24" fill="${v.col}"><path d="M12 3l2.5 6H21l-5 4 2 7-6-4.5L6 20l2-7-5-4h6.5L12 3Z"/></svg></span>
      <div>
        <div class="vip-name" style="color:${v.col}">${v.n}</div>
        <div class="vip-sub">VIP · ${Math.floor(vipXp).toLocaleString('en-US')} XP</div>
      </div>
    </div>
    <div class="vip-bar"><i style="width:${pct}%"></i></div>
    <div class="vip-meta"><span>${nx?Math.floor(pct)+'%':'MAX TIER'}</span><div class="vip-dots"></div><span>${nx?'Next: '+nx.n+' · '+nx.xp.toLocaleString('en-US')+' XP':''}</span></div>`;
  $id('avatarBtn').style.borderColor=v.col;
  $id('avatarBtn').style.color=v.col;
  const badge=$id('vipBadge');
  if(badge){badge.textContent=v.rn;badge.style.color=v.col;badge.style.borderColor=v.col;badge.style.background=v.col+'22';}
  renderVipTrack();
}

/* --- lobby loyalty track ("Climb the Family") --- */
function renderVipTrack(){
  const el=$id('vipTiers');if(!el)return;
  const li=vipLevel(),v=VIP_LEVELS[li],nx=VIP_LEVELS[li+1];
  const frac=nx?Math.min(1,Math.max(0,(vipXp-v.xp)/(nx.xp-v.xp))):0;
  el.innerHTML=VIP_LEVELS.map((t,i)=>`
    <div class="vt${i<=li?' reached':''}${i===li?' current':''}" style="--tc:${t.col}">
      <span class="vt-badge">${t.rn}</span>
      <span class="vt-name">${t.n}</span>
      <span class="vt-perk">${t.perk}</span>
      ${i===li?'<span class="vt-here">You are here</span>':''}
    </div>`).join('');
  const fill=$id('vipLineFill');
  if(fill)fill.style.width=Math.min(100,(li+frac)/(VIP_LEVELS.length-1)*100)+'%';
}

function addXp(usd){
  if(!(usd>0))return;
  const before=vipLevel();
  vipXp+=usd;
  localStorage.setItem(LS_XP,vipXp);
  if(vipLevel()>before){
    const v=VIP_LEVELS[vipLevel()];
    showToast({icon:'★',col:v.col,title:'VIP Level Up — '+v.n,sub:'Daily bonus multiplier is now '+v.mult+'×'});
    syncGift();
  }
  renderVip();
}

/* --- daily bonus + streak --- */
const dayKey=d=>{const x=d||new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
const yesterdayKey=()=>{const d=new Date();d.setDate(d.getDate()-1);return dayKey(d);};
function bonusState(){
  const last=localStorage.getItem(LS_CLAIM),streak=parseInt(localStorage.getItem(LS_STREAK))||0;
  if(last===dayKey())return{claimed:true,streak:Math.max(1,streak)};
  return{claimed:false,streak:last===yesterdayKey()?streak+1:1};
}
const bonusBase=day=>[5,8,12,16,20,25,30][Math.min(day,7)-1];
const bonusUsd=streak=>bonusBase(streak)*VIP_LEVELS[vipLevel()].mult;

function syncGift(){$id('giftDot').hidden=bonusState().claimed;}

function renderBonus(){
  const s=bonusState(),w=curW(),v=VIP_LEVELS[vipLevel()];
  const day=Math.min(s.streak,7),usd=bonusUsd(s.streak);
  $id('bonusStreak').innerHTML=Array.from({length:7},(_,i)=>{
    const dn=i+1;
    const done=s.claimed?dn<=day:dn<day;
    const today=dn===day&&!s.claimed;
    return`<div class="sday${done?' done':''}${today?' today':''}"><b>${done?'✓':'$'+bonusBase(dn)}</b>Day ${dn}</div>`;
  }).join('');
  $id('bonusAmt').textContent='$'+usd.toFixed(2);
  $id('bonusCoin').textContent='≈ '+fmtW(w,usd/w.rate)+' '+w.c;
  $id('bonusNote').innerHTML=s.claimed
    ?'Claimed today — come back tomorrow to keep the streak going.'
    :`Streak day <b>${day}</b>${s.streak>7?'+':''} · VIP <b style="color:${v.col}">${v.n}</b> bonus <b>×${v.mult}</b>`;
  $id('bonusClaim').disabled=s.claimed;
  $id('bonusClaim').textContent=s.claimed?'Claimed — Back Tomorrow':'Claim Bonus';
}

function claimBonus(){
  const s=bonusState();if(s.claimed)return;
  const usd=bonusUsd(s.streak),w=curW();
  creditTo(w,usd/w.rate);
  localStorage.setItem(LS_CLAIM,dayKey());
  localStorage.setItem(LS_STREAK,s.streak);
  renderBonus();syncGift();
  showToast({icon:'🎁',title:'Daily bonus claimed',sub:'+$'+usd.toFixed(2)+' · streak day '+Math.min(s.streak,7)+(s.streak>7?'+':'')});
}

const bonusOverlay=$id('bonusOverlay');
function openBonus(){renderBonus();bonusOverlay.classList.add('open');}
function closeBonus(){bonusOverlay.classList.remove('open');}
$id('giftBtn').addEventListener('click',openBonus);
$id('bonusClose').addEventListener('click',closeBonus);
$id('bonusClaim').addEventListener('click',claimBonus);
bonusOverlay.addEventListener('click',e=>{if(e.target===bonusOverlay)closeBonus();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&bonusOverlay.classList.contains('open')){closeBonus();e.stopPropagation();}
},true);
/* --- vip "how it works" modal --- */
const vipOverlay=$id('vipOverlay');
$id('vipTierList').innerHTML=VIP_LEVELS.map(t=>`
  <div class="vip-tr">
    <span class="rn" style="color:${t.col}">${t.rn}</span>
    <b>${t.n}</b>
    <span class="xp">${t.xp.toLocaleString('en-US')} XP</span>
    <span class="m">×${t.mult}</span>
  </div>`).join('');
$id('vipHow').addEventListener('click',e=>{e.preventDefault();vipOverlay.classList.add('open');});
$id('vipClose').addEventListener('click',()=>vipOverlay.classList.remove('open'));
vipOverlay.addEventListener('click',e=>{if(e.target===vipOverlay)vipOverlay.classList.remove('open');});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&vipOverlay.classList.contains('open')){vipOverlay.classList.remove('open');e.stopPropagation();}
},true);

renderVip();
syncGift();

/* ===== rakeback ===== */
const LS_RB='volt-rakeback';
let rakebackAccum=parseFloat(localStorage.getItem(LS_RB))||0;

window.addRakeback=function addRakeback(usdWagered){
  if(!(usdWagered>0))return;
  const rate=VIP_LEVELS[vipLevel()].rb/100;
  rakebackAccum+=usdWagered*rate;
  localStorage.setItem(LS_RB,rakebackAccum);
  syncRakebackDot();
};

function syncRakebackDot(){
  const dot=$id('rbDot');
  if(dot)dot.hidden=rakebackAccum<0.01;
}

function renderRakeback(){
  const v=VIP_LEVELS[vipLevel()];
  const w=curW();
  $id('rbRate').textContent=v.rb+'%';
  $id('rbLevel').textContent=v.n;
  $id('rbLevel').style.color=v.col;
  $id('rbAmt').textContent='$'+rakebackAccum.toFixed(4);
  $id('rbCoin').textContent='≈ '+fmtW(w,rakebackAccum/w.rate)+' '+w.c;
  const claim=$id('rbClaim');
  claim.disabled=rakebackAccum<0.0001;
  claim.textContent=rakebackAccum>=0.0001?'Claim $'+rakebackAccum.toFixed(4):'Nothing to claim yet';
  /* fill bar: show how far to the next $1 milestone */
  const fill=$id('rbBarFill');
  if(fill)fill.style.width=Math.min(100,(rakebackAccum%1)*100)+'%';
}

function claimRakeback(){
  if(rakebackAccum<0.0001)return;
  const v=VIP_LEVELS[vipLevel()],w=curW();
  const usd=rakebackAccum;
  creditTo(w,usd/w.rate);
  showToast({icon:'♻',col:'#41f0a4',title:'Rakeback claimed',sub:'+$'+usd.toFixed(4)+' · '+v.rb+'% · VIP '+v.n});
  rakebackAccum=0;
  localStorage.setItem(LS_RB,0);
  syncRakebackDot();
  renderRakeback();
}

const rbOverlay=$id('rbOverlay');
function openRakeback(){renderRakeback();rbOverlay.classList.add('open');}
$id('rbBtn').addEventListener('click',()=>{avatarWrap.classList.remove('open');openRakeback();});
$id('rbClose').addEventListener('click',()=>rbOverlay.classList.remove('open'));
rbOverlay.addEventListener('click',e=>{if(e.target===rbOverlay)rbOverlay.classList.remove('open');});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&rbOverlay.classList.contains('open')){rbOverlay.classList.remove('open');e.stopPropagation();}
},true);
$id('rbClaim').addEventListener('click',claimRakeback);
syncRakebackDot();
