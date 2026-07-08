/* VOLT — "The Sphere": a glass jackpot orb that hangs over the whole site.
   Fills with gold coins from a 0.5% cut of every lost bet (real losses via the
   settleBet wrap, bot losses on a timer) and drops weekly as a lottery among
   everyone who wagered in the last 24h. Client-side demo, like the sportsbook.
   Two views of one simulation: a hero monument in the lobby (#sec-sphere) and
   a corner widget everywhere that scrolls to it. Dev hooks: window.SPHERE. */
(function(){
'use strict';

const CUT=0.005, TARGET=25000, SEED=()=>6000+Math.random()*4000;
const LS='volt-sphere', LS_WAG='volt-sphere-wag';
const rr=(a,b)=>Math.random()*(b-a)+a;
const usd=v=>'$'+Math.round(v).toLocaleString('en-US');

/* ---------- persisted state ---------- */
function nextDrop(from){
  /* next Sunday 20:00 UTC */
  const d=new Date(from);
  d.setUTCHours(20,0,0,0);
  d.setUTCDate(d.getUTCDate()+((7-d.getUTCDay())%7||7));
  if(d.getTime()<=from)d.setUTCDate(d.getUTCDate()+7);
  return d.getTime();
}
let S;
try{S=JSON.parse(localStorage.getItem(LS));}catch{}
if(!S||typeof S.pot!=='number'){
  S={pot:SEED(),dropAt:nextDrop(Date.now()),seededBy:null,lastWin:null};
}
function save(){try{localStorage.setItem(LS,JSON.stringify(S));}catch{}}

/* user's rolling 24h wagering (their lottery tickets) */
let WAG=[];
try{WAG=JSON.parse(localStorage.getItem(LS_WAG)||'[]');}catch{}
function pruneWag(){const cut=Date.now()-864e5;WAG=WAG.filter(x=>x.t>cut);}
function userTickets(){pruneWag();return WAG.reduce((s,x)=>s+x.u,0);}
function addWager(usdAmt){
  WAG.push({t:Date.now(),u:usdAmt});
  pruneWag();
  try{localStorage.setItem(LS_WAG,JSON.stringify(WAG));}catch{}
}

/* ---------- styles ---------- */
const css=document.createElement('style');
css.textContent=`
@keyframes sphBlink{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes sphHot{0%,100%{filter:drop-shadow(0 6px 26px rgba(245,200,66,.45))}50%{filter:drop-shadow(0 6px 40px rgba(255,120,60,.75))}}
.sph-shake{animation:sphShake .09s 10!important}
@keyframes sphShake{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}
/* ---- lobby monument ---- */
#sec-sphere{position:relative;margin:26px 0;background:radial-gradient(ellipse at 28% 40%,rgba(245,200,66,.09),rgba(15,33,46,0) 60%),var(--bg-2);border:1px solid rgba(245,200,66,.14);border-radius:20px;padding:30px 34px;overflow:hidden}
.sphero{display:grid;grid-template-columns:auto 1fr;gap:38px;align-items:center}
@media(max-width:760px){.sphero{grid-template-columns:1fr;justify-items:center;text-align:center}}
.sphero-orbwrap{position:relative;padding-top:34px}
.sphero-cable{position:absolute;top:-30px;left:50%;width:3px;height:66px;background:linear-gradient(180deg,rgba(245,200,66,0),rgba(245,200,66,.55));transform:translateX(-50%)}
.sphero-orbwrap canvas{display:block;width:300px;height:300px;filter:drop-shadow(0 18px 50px rgba(245,200,66,.22))}
#sec-sphere.hot .sphero-orbwrap canvas{animation:sphHot 2.4s infinite}
.sphero-kicker{font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#8b93a7;font-style:italic}
.sphero-info h2{margin:6px 0 2px;font-size:52px;font-weight:900;color:#f5c842;font-variant-numeric:tabular-nums;line-height:1;text-shadow:0 0 34px rgba(245,200,66,.3)}
.sphero-cd{font-size:15px;color:#8b93a7;font-weight:700;margin-top:6px}
.sphero-cd b{color:#ebf0ff;font-variant-numeric:tabular-nums}
#sec-sphere.hot .sphero-cd b{color:#ff9d5c}
.sphero-cd b.urgent{color:#ff5c72;animation:sphBlink 1s infinite}
.sphero-rows{display:flex;gap:26px;margin-top:14px;flex-wrap:wrap}
@media(max-width:760px){.sphero-rows{justify-content:center}}
.sphero-rows>div{font-size:12px;color:#6d7688;font-weight:700}
.sphero-rows b{display:block;font-size:15px;color:#dfe6f5;margin-top:2px;font-variant-numeric:tabular-nums}
.sphero-note{margin:16px 0 0;font-size:12.5px;color:#6d7688;line-height:1.6;max-width:520px}
.sphero-note em{color:#a48bfd;font-style:normal;font-weight:700}`;
document.head.appendChild(css);

/* ---------- DOM: lobby monument ---------- */
let heroCv=null;
{
  const sec=document.createElement('div');
  sec.className='row';sec.id='sec-sphere';sec.setAttribute('data-screen-label','The Sphere');
  sec.innerHTML=`
    <div class="sphero">
      <div class="sphero-orbwrap"><div class="sphero-cable"></div><canvas width="600" height="600"></canvas></div>
      <div class="sphero-info">
        <span class="sphero-kicker">donated by the fallen<span id="spHeroSeed"></span></span>
        <h2 id="spHeroPot"></h2>
        <div class="sphero-cd">Falls in <b id="spHeroCd"></b> · every Sunday 20:00 UTC</div>
        <div class="sphero-rows">
          <div>YOUR TICKETS<b id="spHeroTk">none yet</b></div>
          <div>LAST DROP<b id="spHeroLast">—</b></div>
          <div>FILLS TO<b>${usd(TARGET)}</b></div>
        </div>
        <p class="sphero-note"><em>0.5% of every lost bet</em> on the floor lands in the Sphere. When it falls, the pot splits by lottery among everyone who wagered in the last 24 hours — your wagering is your tickets. Wager more, hold more.</p>
      </div>
    </div>`;
  const prov=document.getElementById('provSection'),lobby=document.getElementById('lobbyView');
  if(prov&&prov.parentNode)prov.parentNode.insertBefore(sec,prov);
  else if(lobby)lobby.appendChild(sec);
  heroCv=sec.querySelector('canvas');
}

const CW=236,R=CW/2-10,CXY=CW/2;

/* ---------- banknote physics — circles under the hood, bills on screen ----------
   Notes flutter down slowly (low gravity + sway + wobble) and settle into a
   messy pile; collision bodies stay circles so the stacking stays cheap. */
let coins=[];             /* {x,y,vy,vx,r,rot,ph,asleep} */
const MAX_COINS=70;
function coinsForPot(){return Math.max(4,Math.min(MAX_COINS,Math.round(S.pot/TARGET*MAX_COINS)));}
/* three green denominations + the rare gold VIO note: [top, bottom, ink] */
const NOTE_PALS=[
  ['#5fe8ac','#2bb37a','rgba(12,70,45,.6)'],
  ['#4ed19e','#1e9268','rgba(8,58,38,.6)'],
  ['#8af0c4','#3fbd8a','rgba(16,84,54,.55)'],
  ['#ffe27a','#d9a514','rgba(110,72,6,.6)'],   /* VIO note */
];
function spawnCoin(){
  const r=rr(8,12.5);
  coins.push({x:CXY+rr(-R*.4,R*.4),y:CXY-R+r+2,vy:0,vx:0,r,
    pi:Math.random()<.05?3:Math.floor(rr(0,3)),
    rot:rr(-.4,.4),ph:rr(0,6.28),asleep:false});
  if(coins.length>MAX_COINS)coins.splice(0,coins.length-MAX_COINS);
}
function phys(fast){
  for(const c of coins){
    if(c.asleep)continue;
    if(fast){c.vy+=.5;}
    else{
      /* paper falls slowly: weak gravity, terminal velocity, side-to-side sway */
      c.vy=Math.min(c.vy+.045,.9);
      c.ph+=.045;
      c.vx=Math.sin(c.ph)*.35;
      c.rot=Math.sin(c.ph*.7)*.45;   /* wobble while airborne */
    }
    c.y+=c.vy;c.x+=c.vx;
    /* stay inside the glass */
    let onGlass=false;
    const dx=c.x-CXY,dy=c.y-CXY,d=Math.hypot(dx,dy),lim=R-c.r-2;
    if(d>lim){
      const nx=dx/d,ny=dy/d;
      c.x=CXY+nx*lim;c.y=CXY+ny*lim;
      c.vy*=-.1;c.vx*=.5;
      if(ny>.3)onGlass=true; /* touching the lower bowl */
    }
    /* rest on other notes — slide off slopes instead of sticking to them */
    let sup=0,supSteep=false;
    for(const o of coins){
      if(o===c)continue;
      const ddx=c.x-o.x,ddy=c.y-o.y,dd=Math.hypot(ddx,ddy),min=c.r+o.r-3;
      if(dd>0&&dd<min){
        const push=(min-dd)/2,nx=ddx/dd,ny=ddy/dd;
        c.x+=nx*push;c.y+=ny*push;
        if(!o.asleep){o.x-=nx*push;o.y-=ny*push;}
        if(o.asleep&&ny<-.25){
          sup++;
          if(ny<-.8)supSteep=true;        /* support almost directly below */
          else c.x+=nx*.3;                /* perched on a slope — slide off */
        }
        c.vy*=.5;
      }
    }
    /* settle only when genuinely stable, at a lazy near-flat angle */
    if(Math.abs(c.vy)<.5&&(onGlass||sup>=2||supSteep)){
      c.vy=0;c.vx=0;c.asleep=true;
      c.rot=Math.max(-.55,Math.min(.55,c.rot+rr(-.15,.15)));
    }
  }
}
/* drop notes in one at a time and let them land before first paint */
function presettle(n){
  for(let i=0;i<n;i++){spawnCoin();for(let k=0;k<16;k++)phys(true);}
  for(let k=0;k<500;k++)phys(true);
}
presettle(coinsForPot());

let dropping=false,dropT=0;
function drawInto(c2,scale){
  c2.setTransform(scale,0,0,scale,0,0);
  c2.clearRect(0,0,CW,CW);
  /* the whole orb sways gently on its cable (~1°, slow pendulum) */
  const sway=Math.sin(performance.now()/2600)*.015;
  c2.translate(CXY,CXY-R);c2.rotate(sway);c2.translate(-CXY,-(CXY-R));
  /* glass body — nearly clear, just a whisper of tint and edge shading */
  c2.save();
  const g=c2.createRadialGradient(CXY-R*.35,CXY-R*.45,R*.1,CXY,CXY,R);
  g.addColorStop(0,'rgba(150,175,225,.10)');g.addColorStop(.65,'rgba(60,75,115,.07)');g.addColorStop(1,'rgba(25,32,55,.22)');
  c2.fillStyle=g;
  c2.beginPath();c2.arc(CXY,CXY,R,0,7);c2.fill();
  /* warm light glowing up off the money inside */
  const wg=c2.createRadialGradient(CXY,CXY+R*.55,R*.05,CXY,CXY+R*.55,R*.95);
  wg.addColorStop(0,'rgba(245,200,66,.13)');wg.addColorStop(1,'rgba(245,200,66,0)');
  c2.fillStyle=wg;
  c2.beginPath();c2.arc(CXY,CXY,R,0,7);c2.fill();
  /* contents (clipped) */
  c2.beginPath();c2.arc(CXY,CXY,R-2,0,7);c2.clip();
  /* ambient occlusion where the pile sits against the bowl */
  const ao=c2.createRadialGradient(CXY,CXY+R*.72,R*.05,CXY,CXY+R*.72,R*.85);
  ao.addColorStop(0,'rgba(0,0,8,.26)');ao.addColorStop(1,'rgba(0,0,8,0)');
  c2.fillStyle=ao;
  c2.fillRect(CXY-R,CXY,R*2,R);
  if(dropping)c2.translate(0,dropT);
  for(const c of coins){
    /* banknote: rounded bill, inner border, emblem with a V */
    const bw=c.r*2.5,bh=c.r*1.35,pal=NOTE_PALS[c.pi||0];
    c2.save();
    c2.translate(c.x,c.y);c2.rotate(c.rot);
    const bg=c2.createLinearGradient(0,-bh/2,0,bh/2);
    bg.addColorStop(0,pal[0]);bg.addColorStop(1,pal[1]);
    c2.fillStyle=bg;
    c2.beginPath();c2.roundRect(-bw/2,-bh/2,bw,bh,2.5);c2.fill();
    c2.strokeStyle='rgba(10,50,32,.6)';c2.lineWidth=1;c2.stroke();
    c2.strokeStyle='rgba(240,255,248,.5)';c2.lineWidth=.8;
    c2.strokeRect(-bw/2+2.2,-bh/2+2,bw-4.4,bh-4);
    c2.fillStyle=pal[2];
    c2.beginPath();c2.arc(0,0,bh*.28,0,7);c2.fill();
    c2.fillStyle='rgba(255,255,255,.85)';
    c2.font='700 '+(bh*.42)+'px Outfit,system-ui,sans-serif';
    c2.textAlign='center';c2.textBaseline='middle';
    c2.fillText('$',0,.5);
    c2.restore();
  }
  c2.restore();
  /* glass lighting: dark inner edge, gold rim, specular arcs */
  c2.strokeStyle='rgba(0,0,10,.35)';c2.lineWidth=4;
  c2.beginPath();c2.arc(CXY,CXY,R-3,0,7);c2.stroke();
  c2.strokeStyle='rgba(245,200,66,.5)';c2.lineWidth=2.5;
  c2.beginPath();c2.arc(CXY,CXY,R,0,7);c2.stroke();
  c2.lineCap='round';
  c2.strokeStyle='rgba(255,255,255,.10)';c2.lineWidth=13;          /* soft bloom */
  c2.beginPath();c2.arc(CXY,CXY,R-11,-2.55,-1.15);c2.stroke();
  c2.strokeStyle='rgba(255,255,255,.5)';c2.lineWidth=5;            /* main specular */
  c2.beginPath();c2.arc(CXY,CXY,R-10,-2.4,-1.5);c2.stroke();
  c2.strokeStyle='rgba(255,255,255,.6)';c2.lineWidth=2.5;          /* hot core */
  c2.beginPath();c2.arc(CXY,CXY,R-9,-2.25,-1.85);c2.stroke();
  c2.strokeStyle='rgba(190,220,255,.13)';c2.lineWidth=5;           /* bounce light */
  c2.beginPath();c2.arc(CXY,CXY,R-8,.45,1.05);c2.stroke();
  /* metal clamp where the cable grips the glass */
  const mg=c2.createLinearGradient(CXY-9,0,CXY+9,0);
  mg.addColorStop(0,'#3a4258');mg.addColorStop(.5,'#9aa6c2');mg.addColorStop(1,'#3a4258');
  c2.fillStyle=mg;
  c2.beginPath();c2.roundRect(CXY-9,CXY-R-9,18,13,3);c2.fill();
  c2.strokeStyle='rgba(0,0,10,.5)';c2.lineWidth=1;c2.stroke();
  c2.strokeStyle='#7f8baa';c2.lineWidth=2.4;
  c2.beginPath();c2.arc(CXY,CXY-R-11,3.4,0,7);c2.stroke();
}
const hctx=heroCv?heroCv.getContext('2d'):null;
function draw(){
  if(dropping)dropT+=6;
  if(hctx&&!document.body.classList.contains('ingame')&&!document.body.classList.contains('insports'))
    drawInto(hctx,600/CW);
}
(function loop(){phys();draw();requestAnimationFrame(loop);})();

/* ---------- feed ---------- */
let lastMilestone=Math.floor(S.pot/1000),lastAceLine=0;
function addPot(usdAmt){
  S.pot+=usdAmt;save();
  while(coins.length<coinsForPot())spawnCoin();
  renderNums();
  const m=Math.floor(S.pot/1000);
  if(m>lastMilestone){
    lastMilestone=m;
    if(window.addChat&&Date.now()-lastAceLine>600000&&Math.random()<.5){
      lastAceLine=Date.now();
      addChat('Ace · Host','The Sphere just passed '+usd(m*1000)+' 🔮 Every lost bet feeds it. Sunday it falls.');
    }
  }
}
/* real results: cut of losses feeds the pot, all wagers buy tickets */
function onSettle(st,mult){
  try{
    const stakeUsd=st.b*(st.w?st.w.rate:1);
    addWager(stakeUsd);
    if(mult<1)addPot(stakeUsd*CUT);
  }catch{}
}
if(typeof settleBet==='function'){
  const _s=settleBet;
  settleBet=function(st,mult){_s(st,mult);onSettle(st,mult);};
}
if(typeof serverSettleBet==='function'){
  const _ss=serverSettleBet;
  serverSettleBet=function(st,mult,nb){_ss(st,mult,nb);onSettle(st,mult);};
}
/* bot losses keep it alive between real bets */
setInterval(()=>{
  if(document.hidden||!window.VoltBots)return;
  const b=VoltBots.roster[Math.floor(Math.random()*VoltBots.roster.length)];
  if(Math.random()<.52)addPot(VoltBots.betSize(b.s)*CUT);
},4500);

/* ---------- render ---------- */
const $=id=>document.getElementById(id);
function fmtCd(ms){
  if(ms<=0)return'any moment';
  if(ms<6e4)return Math.ceil(ms/1000)+'s';
  const d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);
  return d>0?d+'d '+h+'h':(h>0?h+'h '+m+'m':m+'m '+Math.floor(ms%6e4/1000)+'s');
}
function renderNums(){
  const hp=$('spHeroPot');if(!hp)return;
  hp.textContent=usd(S.pot);
  $('spHeroTk').textContent=userTickets()>0?usd(userTickets()):'none yet';
  $('spHeroLast').textContent=S.lastWin?S.lastWin.name+' · '+usd(S.lastWin.amt):'—';
  $('spHeroSeed').textContent=S.seededBy?' · seeded by '+S.seededBy+'’s glory':'';
}
renderNums();

/* ---------- near-drop tension + countdown ---------- */
const ACE_CD=[60,30,10,5,1]; /* minutes-to-drop announcements */
let announced={};
setInterval(()=>{
  const ms=S.dropAt-Date.now();
  const hot=ms>0&&ms<36e5, urgent=ms>0&&ms<6e4;
  const sec=$('sec-sphere');if(sec)sec.classList.toggle('hot',hot);
  const cd=$('spHeroCd');
  if(cd){cd.textContent=fmtCd(ms);cd.classList.toggle('urgent',urgent);}
  if(hot){
    /* occasional impatient shake */
    if(sec&&Math.random()<.01){sec.classList.add('sph-shake');setTimeout(()=>sec.classList.remove('sph-shake'),1000);}
    const min=Math.ceil(ms/6e4);
    for(const t of ACE_CD){
      if(min<=t&&!announced[t]){
        announced[t]=true;
        if(window.addChat)addChat('Ace · Host',t<=1?'⏳ The Sphere falls in ONE minute. Last bets buy last tickets.':'⏳ The Sphere falls in '+t+' minutes — '+usd(S.pot)+' hanging by a thread.');
        break;
      }
    }
  }
},1000);

/* ---------- the drop ---------- */
function doDrop(silent){
  const t=userTickets();
  /* weighted lottery: user vs a crowd of bots */
  const entries=[];
  if(t>0)entries.push({name:'You',w:t});
  if(window.VoltBots)VoltBots.sample(14).forEach(b=>entries.push({name:b.n,w:VoltBots.betSize(b.s)*rr(4,30)}));
  if(!entries.length)entries.push({name:'ZeroCool',w:1});
  const tot=entries.reduce((s,e)=>s+e.w,0);
  let roll=Math.random()*tot,winner=entries[0];
  for(const e of entries){roll-=e.w;if(roll<=0){winner=e;break;}}
  const amt=S.pot;
  if(winner.name==='You'&&window.curW){
    const wl=curW();
    if(wl){wl.amt+=amt/wl.rate;wl.fiat=wl.amt*wl.rate;if(window.renderWallet)renderWallet();}
  }
  S.lastWin={name:winner.name,amt,at:Date.now()};
  S.seededBy=winner.name;
  S.pot=SEED();
  S.dropAt=nextDrop(Date.now());
  lastMilestone=Math.floor(S.pot/1000);
  announced={};
  save();
  if(!silent){
    const sec=$('sec-sphere');
    if(sec){sec.classList.add('sph-shake');setTimeout(()=>sec.classList.remove('sph-shake'),1200);}
    dropping=true;dropT=0;
    setTimeout(()=>{
      dropping=false;
      coins=[];for(let i=0;i<coinsForPot();i++)spawnCoin(); /* rain back in live */
      renderNums();
    },1800);
    if(window.addChat){
      addChat('Ace · Host','🚨 THE SPHERE HAS FALLEN. '+usd(amt)+' to '+winner.name+'. It begins to fill again — feed it well.');
    }
  }else{
    coins=[];presettle(coinsForPot());
    renderNums();
  }
}
/* fire on schedule; if the drop happened while nobody was here, settle it on load */
if(Date.now()>=S.dropAt)doDrop(true);
setInterval(()=>{if(Date.now()>=S.dropAt)doDrop(false);},15000);

/* dev/admin hooks */
window.SPHERE={drop:()=>doDrop(false),add:v=>addPot(v),soon:s=>{S.dropAt=Date.now()+s*1000;save();},state:()=>S};
})();
