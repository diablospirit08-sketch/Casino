/* VOLT — sportsbook-lite. Fictional leagues, simulated live matches on compressed
   clocks, drifting odds, a bet slip (singles + parlay) that debits the real wallet,
   and My Bets with settlement. View toggles with body.insports; rail item wired in lobby.js. */
(function(){
'use strict';

const view=document.getElementById('sportsView');
if(!view)return;
const rr=(a,b)=>Math.random()*(b-a)+a;
const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
const usdFmt=v=>'$'+(v<10?v.toFixed(2):v.toFixed(0));

/* ---------- styles ---------- */
const css=document.createElement('style');
css.textContent=`
body.insports #lobbyView{display:none}
body.ingame #sportsView{display:none!important}
#sportsView{padding-bottom:60px}
.sb-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:6px 0 14px;flex-wrap:wrap}
.sb-head h2{font-size:22px;font-weight:800;letter-spacing:.3px;margin:0;display:flex;align-items:center;gap:9px}
.sb-head h2 svg{width:24px;height:24px;color:#41f0a4}
.sb-tabs{display:flex;gap:6px;background:#141b2e;border-radius:10px;padding:4px}
.sb-tabs button{border:0;background:transparent;color:#8b93a7;font:inherit;font-size:13px;font-weight:700;padding:7px 16px;border-radius:8px;cursor:pointer}
.sb-tabs button.active{background:#232d47;color:#ebf0ff}
.sb-tabs .n{display:inline-block;min-width:16px;padding:0 4px;margin-left:4px;border-radius:8px;background:#8b5cf6;color:#fff;font-size:10.5px;line-height:16px}
.sb-ticker{display:flex;align-items:center;gap:8px;background:#10162a;border:1px solid rgba(235,240,255,.06);border-radius:10px;padding:8px 12px;margin-bottom:14px;font-size:12.5px;color:#8b93a7;overflow:hidden;white-space:nowrap}
.sb-ticker b{color:#dfe6f5}
.sb-ticker .dot{width:7px;height:7px;border-radius:50%;background:#41f0a4;flex:none;animation:sbPulse 1.6s infinite}
@keyframes sbPulse{0%,100%{opacity:1}50%{opacity:.3}}
.sb-cols{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}
@media(max-width:900px){.sb-cols{grid-template-columns:1fr}}
.sb-lg{margin-bottom:18px}
.sb-lg-head{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#8b93a7;margin:0 2px 8px}
.sb-match{background:#141b2e;border:1px solid rgba(235,240,255,.05);border-radius:12px;padding:12px 14px;margin-bottom:8px;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}
.sb-mstat{grid-column:1/-1;display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;color:#6d7688}
.sb-live{color:#ff5c72;display:inline-flex;align-items:center;gap:5px}
.sb-live::before{content:'';width:7px;height:7px;border-radius:50%;background:#ff5c72;animation:sbPulse 1.2s infinite}
.sb-ended{color:#57607a}
.sb-teams{display:flex;flex-direction:column;gap:5px;min-width:0}
.sb-team{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:#dfe6f5}
.sb-team .sc{margin-left:auto;font-weight:800;color:#41f0a4;font-variant-numeric:tabular-nums}
.sb-odds{display:flex;gap:6px}
.sb-odd{border:1px solid rgba(235,240,255,.08);background:#1b2440;color:#dfe6f5;border-radius:9px;padding:7px 0;width:72px;cursor:pointer;font:inherit;display:flex;flex-direction:column;align-items:center;gap:1px;transition:background .15s,border-color .15s}
.sb-odd small{font-size:10px;font-weight:700;color:#6d7688;text-transform:uppercase;letter-spacing:.5px}
.sb-odd b{font-size:13.5px;font-variant-numeric:tabular-nums}
.sb-odd:hover{background:#232d47}
.sb-odd.sel{background:linear-gradient(135deg,#7c52e0,#8b5cf6);border-color:#a48bfd}
.sb-odd.sel small{color:#e6dcff}
.sb-odd:disabled{opacity:.35;cursor:default}
.sb-slip{background:#141b2e;border:1px solid rgba(235,240,255,.06);border-radius:14px;padding:14px;position:sticky;top:86px}
.sb-slip h3{margin:0 0 10px;font-size:14px;font-weight:800}
.sb-mode{display:flex;gap:5px;background:#0f1526;border-radius:8px;padding:3px;margin-bottom:10px}
.sb-mode button{flex:1;border:0;background:transparent;color:#8b93a7;font:inherit;font-size:12px;font-weight:700;padding:6px;border-radius:6px;cursor:pointer}
.sb-mode button.active{background:#232d47;color:#ebf0ff}
.sb-sel{background:#0f1526;border-radius:10px;padding:9px 10px;margin-bottom:7px;font-size:12.5px}
.sb-sel-top{display:flex;justify-content:space-between;gap:8px;font-weight:700;color:#dfe6f5}
.sb-sel-top .x{cursor:pointer;color:#57607a;border:0;background:none;font:inherit;font-size:14px;line-height:1;padding:0 2px}
.sb-sel-top .x:hover{color:#ff5c72}
.sb-sel-sub{display:flex;justify-content:space-between;color:#6d7688;margin-top:2px}
.sb-sel-sub b{color:#41f0a4}
.sb-stake{display:flex;align-items:center;gap:6px;margin-top:7px}
.sb-stake input{flex:1;background:#141b2e;border:1px solid rgba(235,240,255,.1);border-radius:7px;color:#ebf0ff;font:inherit;font-size:13px;font-weight:700;padding:6px 8px;width:100%}
.sb-stake input:focus{outline:none;border-color:#8b5cf6}
.sb-tot{display:flex;justify-content:space-between;font-size:12.5px;color:#8b93a7;margin:9px 2px}
.sb-tot b{color:#ebf0ff}
.sb-place{width:100%;border:0;border-radius:10px;padding:12px;font:inherit;font-size:14px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#41f0a4,#25c17f);color:#06251a}
.sb-place:disabled{opacity:.4;cursor:default}
.sb-msg{font-size:12px;font-weight:700;margin-top:8px;text-align:center;min-height:15px}
.sb-msg.ok{color:#41f0a4}.sb-msg.err{color:#ff5c72}
.sb-empty{color:#57607a;font-size:12.5px;text-align:center;padding:18px 6px}
.sb-bet{background:#141b2e;border:1px solid rgba(235,240,255,.05);border-radius:12px;padding:12px 14px;margin-bottom:8px;font-size:13px}
.sb-bet-head{display:flex;justify-content:space-between;font-weight:800;color:#dfe6f5}
.sb-chip{font-size:10.5px;font-weight:800;letter-spacing:.6px;padding:2px 8px;border-radius:20px;text-transform:uppercase}
.sb-chip.pending{background:rgba(139,92,246,.15);color:#a48bfd}
.sb-chip.won{background:rgba(65,240,164,.15);color:#41f0a4}
.sb-chip.lost{background:rgba(255,92,114,.13);color:#ff5c72}
.sb-chip.void{background:rgba(139,147,167,.13);color:#8b93a7}
.sb-bet-leg{color:#8b93a7;margin-top:4px;display:flex;justify-content:space-between;gap:8px}
.sb-bet-leg b{color:#c6cddd}
.sb-bet-foot{display:flex;justify-content:space-between;color:#6d7688;margin-top:7px;font-size:12px}
.sb-bet-foot b{color:#ebf0ff}`;
document.head.appendChild(css);

/* ---------- data ---------- */
const LEAGUES=[
  {id:'cs2', n:'CS2 · Volt Invitational', draw:false, pace:8,  maxSc:13, evP:.75, evPts:()=>1, done:m=>m.sa>=13||m.sb>=13, clock:m=>'Map 1 · Round '+(m.sa+m.sb+1)},
  {id:'foot',n:'Football · Euro Volt League', draw:true, pace:5, maxSc:0, evP:.16, evPts:()=>1, done:m=>m.prog>=100, clock:m=>Math.min(90,Math.round(m.prog*.9))+"'"},
  {id:'bball',n:'Basketball · VBA', draw:false, pace:7, maxSc:0, evP:.95, evPts:()=>2+(Math.random()<.3?1:0), done:m=>m.prog>=100, clock:m=>'Q'+Math.min(4,1+Math.floor(m.prog/25))},
];
const TEAMS={
  cs2:['Nova Five','Phantom Syndicate','Iron Wolves','Zero Latency','Clutch Kings','AWP City'],
  foot:['FC Voltaire','Athletico Amps','Real Ohmshire','Dynamo Kilowatt','Sparta Surge','United Volts'],
  bball:['Capacitors','Short Circuits','High Voltage','Amp City','Grid Runners','Fuse Town'],
};
let mid=0;
function mkMatch(lgId,live){
  const lg=LEAGUES.find(l=>l.id===lgId);
  const pool=[...TEAMS[lgId]];
  const a=pool.splice(Math.floor(Math.random()*pool.length),1)[0];
  const b=pool.splice(Math.floor(Math.random()*pool.length),1)[0];
  const pA=rr(.3,.62);
  const m={id:'m'+(++mid),lg:lgId,a,b,pA,sa:0,sb:0,prog:0,
    status:live?'live':'up',kick:live?0:Math.round(rr(25,140))};
  setOdds(m);
  return m;
}
function setOdds(m){
  const lg=LEAGUES.find(l=>l.id===m.lg);
  /* live: winning side shortens */
  let pA=m.pA;
  if(m.status==='live'){
    const lead=(m.sa-m.sb)/(m.lg==='foot'?2.5:(m.lg==='cs2'?13:20));
    pA=Math.min(.93,Math.max(.07,pA+lead*(.3+m.prog/160)));
  }
  const marg=1.06;
  if(lg.draw){
    const pD=Math.max(.08,.26-Math.abs(pA-.5)*.3-m.prog/500);
    const pB=Math.max(.05,1-pA-pD);
    m.oA=Math.max(1.01,marg/ (pA*(1+pD))).toFixed(2);
    m.oD=Math.max(1.01,marg/pD).toFixed(2);
    m.oB=Math.max(1.01,marg/(pB*(1+pD))).toFixed(2);
  }else{
    m.oA=Math.max(1.01,marg/pA).toFixed(2);
    m.oD=null;
    m.oB=Math.max(1.01,marg/(1-pA)).toFixed(2);
  }
}
let MATCHES=[];
function seed(){
  MATCHES=[
    mkMatch('cs2',true),mkMatch('cs2',false),
    mkMatch('foot',true),mkMatch('foot',false),mkMatch('foot',false),
    mkMatch('bball',true),mkMatch('bball',false),
  ];
}
seed();

/* ---------- my bets (persisted) ---------- */
const LS='volt-sports-bets';
let BETS=[];
try{BETS=JSON.parse(localStorage.getItem(LS)||'[]');}catch{}
/* matches don't survive reload — refund any bet still pending from a past session */
BETS.forEach(b=>{
  if(b.status==='pending'){b.status='void';creditUsd(b.cur,b.stake);}
});
saveBets();
function saveBets(){try{localStorage.setItem(LS,JSON.stringify(BETS.slice(0,40)));}catch{}}
function creditUsd(cur,usd){
  if(!window.WALLETS)return;
  const w=WALLETS.find(x=>x.c===cur)||(window.curW&&curW());
  if(!w)return;
  w.amt+=usd/w.rate;w.fiat=w.amt*w.rate;
  if(window.renderWallet)renderWallet();
}

/* ---------- view skeleton ---------- */
view.innerHTML=`
  <div class="sb-head">
    <h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18M3.5 9h17M3.5 15h17"/></svg>Sportsbook</h2>
    <div class="sb-tabs">
      <button data-t="board" class="active">Board</button>
      <button data-t="mybets">My Bets<span class="n" id="sbMyN" hidden></span></button>
    </div>
  </div>
  <div class="sb-ticker"><span class="dot"></span><span id="sbTick">Odds board is live — tap any price to build a slip.</span></div>
  <div class="sb-cols">
    <div id="sbMain"></div>
    <aside class="sb-slip" id="sbSlip"></aside>
  </div>`;
const sbMain=document.getElementById('sbMain'),sbSlip=document.getElementById('sbSlip');
let tab='board';
view.querySelectorAll('.sb-tabs button').forEach(b=>b.addEventListener('click',()=>{
  tab=b.dataset.t;
  view.querySelectorAll('.sb-tabs button').forEach(x=>x.classList.toggle('active',x===b));
  render();
}));

/* ---------- bet slip ---------- */
let SLIP=[];      /* {mid,pk,odds,team,label} */
let slipMode='single';
let stakes={};    /* mid+pk -> usd stake (singles) */
let parlayStake=10;
function selKey(s){return s.mid+':'+s.pk;}
function pickLabel(m,pk){return pk==='A'?m.a:(pk==='B'?m.b:'Draw');}
function toggleSel(m,pk){
  const i=SLIP.findIndex(s=>s.mid===m.id&&s.pk===pk);
  if(i>=0)SLIP.splice(i,1);
  else{
    /* one pick per match */
    const j=SLIP.findIndex(s=>s.mid===m.id);
    if(j>=0)SLIP.splice(j,1);
    SLIP.push({mid:m.id,pk,odds:parseFloat(pk==='A'?m.oA:(pk==='B'?m.oB:m.oD)),team:pickLabel(m,pk),label:m.a+' vs '+m.b});
  }
  renderSlip();renderBoard();
}
function renderSlip(){
  if(!SLIP.length){
    sbSlip.innerHTML=`<h3>Bet Slip</h3><div class="sb-empty">Tap any odds to add a pick.<br>Combine 2+ picks into a parlay.</div>`;
    return;
  }
  const modeUi=SLIP.length>1?`
    <div class="sb-mode">
      <button data-m="single" class="${slipMode==='single'?'active':''}">Singles</button>
      <button data-m="parlay" class="${slipMode==='parlay'?'active':''}">Parlay</button>
    </div>`:'';
  const rows=SLIP.map(s=>`
    <div class="sb-sel">
      <div class="sb-sel-top"><span>${s.team}</span><button class="x" data-k="${selKey(s)}" aria-label="Remove">×</button></div>
      <div class="sb-sel-sub"><span>${s.label}</span><b>${s.odds.toFixed(2)}</b></div>
      ${slipMode==='single'?`<div class="sb-stake"><input type="text" inputmode="decimal" placeholder="Stake $" data-k="${selKey(s)}" value="${stakes[selKey(s)]||''}"></div>`:''}
    </div>`).join('');
  let tot='',potential=0,stakeSum=0;
  if(slipMode==='parlay'&&SLIP.length>1){
    const odds=SLIP.reduce((p,s)=>p*s.odds,1);
    potential=parlayStake*odds;stakeSum=parlayStake;
    tot=`
      <div class="sb-stake"><input type="text" inputmode="decimal" placeholder="Stake $" id="sbParStake" value="${parlayStake||''}"></div>
      <div class="sb-tot"><span>Combined odds</span><b>${odds.toFixed(2)}</b></div>
      <div class="sb-tot"><span>Potential win</span><b>${usdFmt(potential)}</b></div>`;
  }else{
    SLIP.forEach(s=>{const st=parseFloat(stakes[selKey(s)])||0;stakeSum+=st;potential+=st*s.odds;});
    tot=`<div class="sb-tot"><span>Total stake</span><b>${usdFmt(stakeSum)}</b></div>
         <div class="sb-tot"><span>Potential win</span><b>${usdFmt(potential)}</b></div>`;
  }
  sbSlip.innerHTML=`<h3>Bet Slip (${SLIP.length})</h3>${modeUi}${rows}${tot}
    <button class="sb-place" id="sbPlace" ${stakeSum>0?'':'disabled'}>Place Bet${slipMode==='single'&&SLIP.length>1?'s':''}</button>
    <div class="sb-msg" id="sbMsg"></div>`;
  sbSlip.querySelectorAll('.sb-mode button').forEach(b=>b.addEventListener('click',()=>{slipMode=b.dataset.m;renderSlip();}));
  sbSlip.querySelectorAll('.x').forEach(b=>b.addEventListener('click',()=>{
    SLIP=SLIP.filter(s=>selKey(s)!==b.dataset.k);
    if(SLIP.length<2)slipMode='single';
    renderSlip();renderBoard();
  }));
  sbSlip.querySelectorAll('.sb-stake input[data-k]').forEach(inp=>inp.addEventListener('input',()=>{
    stakes[inp.dataset.k]=inp.value;
    const t=sbSlip.querySelectorAll('.sb-tot b');
    let ss=0,pp=0;SLIP.forEach(s=>{const st=parseFloat(stakes[selKey(s)])||0;ss+=st;pp+=st*s.odds;});
    if(t.length===2){t[0].textContent=usdFmt(ss);t[1].textContent=usdFmt(pp);}
    document.getElementById('sbPlace').disabled=!(ss>0);
  }));
  const par=document.getElementById('sbParStake');
  if(par)par.addEventListener('input',()=>{
    parlayStake=parseFloat(par.value)||0;
    const odds=SLIP.reduce((p,s)=>p*s.odds,1);
    const t=sbSlip.querySelectorAll('.sb-tot b');
    if(t.length===2)t[1].textContent=usdFmt(parlayStake*odds);
    document.getElementById('sbPlace').disabled=!(parlayStake>0);
  });
  document.getElementById('sbPlace').addEventListener('click',placeBets);
}
function slipMsg(txt,ok){
  const el=document.getElementById('sbMsg');
  if(el){el.textContent=txt;el.className='sb-msg '+(ok?'ok':'err');}
}
function placeBets(){
  if(!document.body.classList.contains('authed')){if(window.openAuth)openAuth('in');return;}
  const w=window.curW&&curW();
  if(!w){slipMsg('Wallet unavailable',false);return;}
  const balUsd=w.amt*w.rate;
  const legs=SLIP.map(s=>({mid:s.mid,pk:s.pk,odds:s.odds,team:s.team,label:s.label,res:null}));
  if(slipMode==='parlay'&&SLIP.length>1){
    const stake=parlayStake;
    if(!(stake>0))return;
    if(stake>balUsd){slipMsg('Insufficient balance',false);return;}
    w.amt-=stake/w.rate;w.fiat=w.amt*w.rate;
    BETS.unshift({id:'b'+Date.now(),type:'parlay',legs,stake,odds:legs.reduce((p,l)=>p*l.odds,1),cur:w.c,status:'pending',ts:Date.now()});
  }else{
    let total=0;
    for(const s of SLIP)total+=parseFloat(stakes[selKey(s)])||0;
    if(!(total>0))return;
    if(total>balUsd){slipMsg('Insufficient balance',false);return;}
    for(const s of SLIP){
      const stake=parseFloat(stakes[selKey(s)])||0;
      if(!(stake>0))continue;
      w.amt-=stake/w.rate;
      BETS.unshift({id:'b'+Date.now()+Math.random().toString(36).slice(2,6),type:'single',
        legs:[{...s,res:null}],stake,odds:s.odds,cur:w.c,status:'pending',ts:Date.now()});
    }
    w.fiat=w.amt*w.rate;
  }
  if(window.renderWallet)renderWallet();
  saveBets();
  SLIP=[];stakes={};slipMode='single';
  renderSlip();renderBoard();renderMyN();
  slipMsg('Bet placed — good luck! ⚡',true);
  setTimeout(()=>{const el=document.getElementById('sbMsg');if(el&&!SLIP.length)renderSlip();},2200);
}

/* ---------- settlement ---------- */
function settleMatch(m){
  const winPk=m.sa>m.sb?'A':(m.sb>m.sa?'B':'D');
  let touched=false;
  for(const b of BETS){
    if(b.status!=='pending')continue;
    let hit=false;
    for(const l of b.legs){
      if(l.mid!==m.id||l.res)continue;
      l.res=(l.pk===winPk)?'won':'lost';
      hit=true;
    }
    if(!hit)continue;
    touched=true;
    if(b.legs.some(l=>l.res==='lost'))b.status='lost';
    else if(b.legs.every(l=>l.res==='won')){
      b.status='won';
      creditUsd(b.cur,b.stake*b.odds);
      if(window.VoltHost&&window.addChat)addChat('Ace · Host','📢 Sports slip cashed — '+usdFmt(b.stake*b.odds)+' on '+b.legs.map(l=>l.team).join(' + ')+'!');
    }
  }
  if(touched){saveBets();renderMyN();if(tab==='mybets')render();}
}

/* ---------- simulation loop ---------- */
function simTick(){
  let changed=false;
  MATCHES.forEach((m,i)=>{
    if(m.status==='up'){
      m.kick-=4;
      if(m.kick<=0){m.status='live';changed=true;}
      return;
    }
    if(m.status!=='live')return;
    const lg=LEAGUES.find(l=>l.id===m.lg);
    m.prog+=lg.pace;
    if(Math.random()<lg.evP){
      const pts=lg.evPts();
      /* live win prob decides who scores */
      const lead=(m.sa-m.sb)/(m.lg==='foot'?2.5:(m.lg==='cs2'?13:20));
      const pA=Math.min(.9,Math.max(.1,m.pA+lead*.25));
      if(Math.random()<pA)m.sa+=pts;else m.sb+=pts;
    }
    if(lg.done(m)){
      m.status='ended';
      settleMatch(m);
      /* replace with a fresh fixture shortly */
      setTimeout(()=>{
        const idx=MATCHES.indexOf(m);
        if(idx>=0)MATCHES[idx]=mkMatch(m.lg,false);
        if(isOpen()&&tab==='board')renderBoard();
      },30000);
    }else{
      setOdds(m);
    }
    changed=true;
  });
  if(changed&&isOpen()&&tab==='board')renderBoard();
}

/* ---------- render ---------- */
function statusHtml(m){
  const lg=LEAGUES.find(l=>l.id===m.lg);
  if(m.status==='live')return`<span class="sb-live">LIVE</span><span>${lg.clock(m)}</span>`;
  if(m.status==='ended')return`<span class="sb-ended">Final</span>`;
  const mn=Math.max(1,Math.round(m.kick/60));
  return`<span>Starts in ~${mn}m</span>`;
}
function oddBtn(m,pk,val,lbl){
  if(!val)return'';
  const sel=SLIP.some(s=>s.mid===m.id&&s.pk===pk);
  const dis=m.status==='ended'?'disabled':'';
  return`<button class="sb-odd ${sel?'sel':''}" ${dis} data-mid="${m.id}" data-pk="${pk}"><small>${lbl}</small><b>${val}</b></button>`;
}
function renderBoard(){
  if(tab!=='board')return;
  sbMain.innerHTML=LEAGUES.map(lg=>{
    const ms=MATCHES.filter(m=>m.lg===lg.id);
    if(!ms.length)return'';
    return`<div class="sb-lg"><div class="sb-lg-head">${lg.n}</div>`+ms.map(m=>`
      <div class="sb-match">
        <div class="sb-mstat">${statusHtml(m)}</div>
        <div class="sb-teams">
          <div class="sb-team"><span>${m.a}</span>${m.status!=='up'?`<span class="sc">${m.sa}</span>`:''}</div>
          <div class="sb-team"><span>${m.b}</span>${m.status!=='up'?`<span class="sc">${m.sb}</span>`:''}</div>
        </div>
        <div class="sb-odds">
          ${oddBtn(m,'A',m.oA,'1')}${oddBtn(m,'D',m.oD,'X')}${oddBtn(m,'B',m.oB,'2')}
        </div>
      </div>`).join('')+`</div>`;
  }).join('');
}
sbMain.addEventListener('click',e=>{
  const btn=e.target.closest('.sb-odd');
  if(!btn||btn.disabled)return;
  const m=MATCHES.find(x=>x.id===btn.dataset.mid);
  if(m)toggleSel(m,btn.dataset.pk);
});
function renderMyBets(){
  if(!BETS.length){sbMain.innerHTML='<div class="sb-empty" style="padding:40px 0">No bets yet — hit the board and take a swing.</div>';return;}
  sbMain.innerHTML=BETS.map(b=>`
    <div class="sb-bet">
      <div class="sb-bet-head"><span>${b.type==='parlay'?'Parlay ×'+b.legs.length:'Single'}</span><span class="sb-chip ${b.status}">${b.status}</span></div>
      ${b.legs.map(l=>`<div class="sb-bet-leg"><span>${l.team} <span style="opacity:.6">(${l.label})</span></span><b>${l.odds.toFixed(2)}${l.res?' · '+l.res:''}</b></div>`).join('')}
      <div class="sb-bet-foot"><span>Stake ${usdFmt(b.stake)} · Odds ${b.odds.toFixed(2)}</span><b>${b.status==='won'?'+'+usdFmt(b.stake*b.odds):(b.status==='pending'?'to win '+usdFmt(b.stake*b.odds):(b.status==='void'?'refunded':'—'))}</b></div>
    </div>`).join('');
}
function renderMyN(){
  const n=BETS.filter(b=>b.status==='pending').length;
  const el=document.getElementById('sbMyN');
  if(el){el.textContent=n;el.hidden=!n;}
}
function render(){tab==='board'?renderBoard():renderMyBets();renderSlip();renderMyN();}

/* ---------- bot ticker ---------- */
function tickLine(){
  if(!window.VoltBots)return;
  const live=MATCHES.filter(m=>m.status!=='ended');
  if(!live.length)return;
  const m=pick(live),b=pick(VoltBots.roster);
  const side=Math.random()<.5?m.a:m.b;
  document.getElementById('sbTick').innerHTML=`<b>${b.n}</b> just put <b>${usdFmt(VoltBots.betSize(b.s))}</b> on <b>${side}</b>`;
}

/* ---------- open/close + rail/hash wiring ---------- */
function isOpen(){return document.body.classList.contains('insports');}
window.openSports=function(){
  if(document.body.classList.contains('ingame')&&window.closeGame)closeGame();
  document.body.classList.add('insports');
  view.hidden=false;
  window.scrollTo(0,0);
  if(location.hash!=='#sports'){try{history.pushState('','',location.pathname+location.search+'#sports');}catch{location.hash='sports';}}
  const link=document.querySelector('#railNav a[data-target="sportsView"]');
  if(link){
    document.querySelectorAll('#railNav a').forEach(a=>a.classList.toggle('active',a===link));
    if(window.movePill)movePill(link);
  }
  render();
};
window.closeSports=function(){
  document.body.classList.remove('insports');
  view.hidden=true;
  if(location.hash==='#sports'){try{history.pushState('','',location.pathname+location.search);}catch{location.hash='';}}
};
window.addEventListener('hashchange',()=>{
  if(location.hash==='#sports'&&!isOpen())openSports();
  else if(location.hash!=='#sports'&&isOpen())closeSports();
});
if(location.hash==='#sports')openSports();

/* timers */
setInterval(simTick,4000);
setInterval(()=>{if(isOpen())tickLine();},6000);
renderSlip();
})();
