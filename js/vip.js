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
  const pct=nx?Math.min(100,Math.floor((vipXp-v.xp)/(nx.xp-v.xp)*100)):100;
  const nameEl=$id('umName');
  const initial=(nameEl&&nameEl.textContent.trim()||'?')[0].toUpperCase();
  $id('vipBlock').innerHTML=`
    <div class="um-hero">
      <div class="um-hero-medal" style="border-color:${v.col};box-shadow:0 0 28px ${v.col}44;background:${v.col}18">
        <span style="color:${v.col}">${initial}</span>
      </div>
      <div class="um-hero-rank-lbl">Rank</div>
      <div class="um-hero-rank-name" style="color:${v.col}">${v.n}</div>
    </div>
    <div class="um-hero-prog">
      <div class="um-hero-bar"><i style="width:${pct}%;background:${v.col}"></i></div>
      <div class="um-hero-meta">
        <span>${pct}% to next rank</span>
        ${nx?`<span class="um-hero-next" style="color:${nx.col}">${nx.n}<span class="um-hero-next-badge" style="background:${nx.col}22;border:1px solid ${nx.col}">${nx.rn}</span></span>`:'<span>MAX RANK</span>'}
      </div>
    </div>`;
  const btn=$id('avatarBtn');
  btn.style.borderColor=v.col;
  btn.style.color=v.col;
  /* only set initial if no real photo already loaded */
  if(!btn.dataset.avImg){
    btn.innerHTML=`<span class="av-circle" style="color:${v.col}">${initial}</span>`;
  }
  const umAv=$id('umAv');
  if(umAv){umAv.style.borderColor=v.col;umAv.innerHTML=`<span class="av-rank-num">${v.rn}</span>`;}
  renderVipTrack();
}

/* --- lobby loyalty track ("Climb the Family") --- */
const VIP_ICONS=[
  /* Associate — shield */
  `<path d="M12 2 4 5.5v5.5c0 5 3.5 9.6 8 11 4.5-1.4 8-6 8-11V5.5Z" fill="currentColor"/>`,
  /* Soldier — crossed blades */
  `<path d="M5 3l7 7-5 5a2 2 0 002.8 2.8l5-5 7-7-2-2-7 7-3-3 7-7L15 1 8 8 3 5zm14 14l-4-4-1.4 1.4 4 4a1 1 0 001.4-1.4z" fill="currentColor"/>`,
  /* Capo — diamond gem */
  `<path d="M6 3h12l4 6-10 13L2 9zm2.5 6h7L14 6H10zm-1.4 0L3.7 9 8 17.5zm10.3 0l3.8 0L17.5 17zm-8.9 0l3.5 8.7L14.5 9z" fill="currentColor"/>`,
  /* Underboss — crown */
  `<path d="M5 16h14v3H5zm0-1l2.5-9 4.5 5 4.5-9 4.5 9L23 15H1z" fill="currentColor"/>`,
  /* Don — star */
  `<path d="M12 2l2.9 6.26L22 9.27l-5 5.14 1.18 7.22L12 18.77l-6.18 2.86L7 14.41 2 9.27l7.11-1z" fill="currentColor"/>`,
];
function renderVipTrack(){
  const el=$id('vipTiers');if(!el)return;
  const li=vipLevel(),v=VIP_LEVELS[li],nx=VIP_LEVELS[li+1];
  const frac=nx?Math.min(1,Math.max(0,(vipXp-v.xp)/(nx.xp-v.xp))):0;
  el.innerHTML=VIP_LEVELS.map((t,i)=>`
    <div class="vt${i<=li?' reached':''}${i===li?' current':''}" style="--tc:${t.col}">
      <div class="vt-medal">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="color:${i<=li?t.col:'rgba(255,255,255,.25)'}">${VIP_ICONS[i]}</svg>
      </div>
      <div class="vt-rn">${t.rn}</div>
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
var _rbClaimable = 0;
var _rbRate = 0.10;

function syncRakebackDot(){
  var dot = $id('rbDot');
  if (dot) dot.hidden = _rbClaimable < 0.000001;
}

window.refreshRakeback = function refreshRakeback() {
  if (!window.voltApi || !window.voltApi.auth.getSession()) return;
  window.voltApi._fetch('/api/rakeback')
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(j){
      if (!j) return;
      _rbClaimable = parseFloat(j.claimable) || 0;
      _rbRate = j.rate || 0.10;
      syncRakebackDot();
    })
    .catch(function(){});
};

function renderRakeback(){
  var v = VIP_LEVELS[vipLevel()];
  $id('rbRate').textContent = Math.round(_rbRate * 100) + '%';
  $id('rbLevel').textContent = v.n;
  $id('rbLevel').style.color = v.col;
  $id('rbAmt').textContent = _rbClaimable.toFixed(6) + ' BNB';
  $id('rbCoin').textContent = '';
  var claim = $id('rbClaim');
  claim.disabled = _rbClaimable < 0.000001;
  claim.textContent = _rbClaimable >= 0.000001
    ? 'Claim ' + _rbClaimable.toFixed(6) + ' BNB'
    : 'Nothing to claim yet';
  var fill = $id('rbBarFill');
  if (fill) fill.style.width = Math.min(100, (_rbClaimable % 0.01) / 0.01 * 100) + '%';
}

function claimRakeback(){
  if (_rbClaimable < 0.000001) return;
  var btn = $id('rbClaim');
  btn.disabled = true;
  btn.textContent = 'Claiming…';
  window.voltApi._fetch('/api/rakeback/claim', { method: 'POST', body: '{}' })
    .then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
    .then(function(res){
      if (!res.ok) { showToast({icon:'⚠',col:'#ff4757',title:'Claim failed',sub:res.j.error||'Try again'}); return; }
      var amt = _rbClaimable;
      _rbClaimable = 0;
      syncRakebackDot();
      renderRakeback();
      showToast({icon:'♻',col:'#41f0a4',title:'Rakeback claimed',sub:'+'+amt.toFixed(6)+' BNB'});
      if (window.loadBalances) window.loadBalances();
    })
    .catch(function(){ showToast({icon:'⚠',col:'#ff4757',title:'Claim failed',sub:'Network error'}); })
    .finally(function(){ renderRakeback(); });
}

/* remove stale localStorage rakeback */
localStorage.removeItem('volt-rakeback');

const rbOverlay = $id('rbOverlay');
function openRakeback(){
  window.refreshRakeback();
  renderRakeback();
  rbOverlay.classList.add('open');
}
$id('rbBtn').addEventListener('click', function(){ avatarWrap.classList.remove('open'); openRakeback(); });
$id('rbClose').addEventListener('click', function(){ rbOverlay.classList.remove('open'); });
rbOverlay.addEventListener('click', function(e){ if (e.target === rbOverlay) rbOverlay.classList.remove('open'); });
document.addEventListener('keydown', function(e){
  if (e.key === 'Escape' && rbOverlay.classList.contains('open')){ rbOverlay.classList.remove('open'); e.stopPropagation(); }
}, true);
$id('rbClaim').addEventListener('click', claimRakeback);

/* poll every 60s when logged in */
setInterval(function(){ window.refreshRakeback(); }, 60000);
window.refreshRakeback();
