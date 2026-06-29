/* VOLT — game view: open/close, default multiplier game (doBet), session stats, auto-bet, live feed */
/* ---------- game view ---------- */
const GAMES={};
ROWS.forEach(r=>r.games.forEach(g=>{GAMES[r.key+'-'+slugify(g.n)]=Object.assign({live:!!r.dealer},g);}));
WALLETS.forEach(w=>w.rate=w.fiat/w.amt);
const gvName=document.getElementById('gvName'),gvProv=document.getElementById('gvProv'),
      gvRtp=document.getElementById('gvRtp'),gvLiveChip=document.getElementById('gvLiveChip'),
      gvGlow=document.getElementById('gvGlow'),gvIdle=document.getElementById('gvIdle'),
      gvIdleName=document.getElementById('gvIdleName'),gvResult=document.getElementById('gvResult'),
      gvHistory=document.getElementById('gvHistory'),gvBetIn=document.getElementById('gvBet'),
      gvMultIn=document.getElementById('gvMult'),gvBetFiat=document.getElementById('gvBetFiat'),
      gvChance=document.getElementById('gvChance'),gvProfit=document.getElementById('gvProfit'),
      gvCoin=document.getElementById('gvCoin'),gvCoin2=document.getElementById('gvCoin2'),
      gvBetBtn=document.getElementById('gvBetBtn'),gvFeed=document.getElementById('gvFeed'),
      sWag=document.getElementById('sWag'),sProf=document.getElementById('sProf'),
      sWins=document.getElementById('sWins'),sLoss=document.getElementById('sLoss');
let curSlug=null,betBusy=false;
const gsession={wag:0,prof:0,w:0,l:0};
const curW=()=>WALLETS.find(x=>x.c===voltCur);
const fmtCoin=v=>voltCur==='USDT'?v.toFixed(2):(v>0&&v<0.001?parseFloat(v.toFixed(6)).toString():v.toFixed(4));

function rtpFor(slug,g){
  if(g.boost){const m=g.boost.match(/([\d.]+)%/);if(m)return m[1]+'%';}
  let h=0;for(const ch of slug)h=(h*31+ch.charCodeAt(0))%89;
  return (95.8+h/35).toFixed(1)+'%';
}
function syncBetBtn(){
  const b=document.getElementById('gvBetBtn');
  if(!b||b.classList.contains('running'))return;
  const authed=document.body.classList.contains('authed');
  const _ap=document.getElementById('autoPanel');
  const onAutoTab=_ap&&!_ap.hidden;
  if(onAutoTab)b.textContent=authed?'Start Auto':'Log In to Play';
  else if(!authed)b.textContent='Log In to Play';
  else b.textContent=(window.ENG&&ENG.label)?ENG.label():'Bet';
  const sub=document.getElementById('gvIdleSub');
  const signin=document.getElementById('gvIdleSignin');
  if(sub)sub.textContent=authed?'Set a bet amount and press Bet':'Sign in to play for real';
  if(signin)signin.hidden=authed;
}
function syncDerived(){
  const w=curW(),b=parseFloat(gvBetIn.value)||0,m=Math.max(1.01,parseFloat(gvMultIn.value)||2);
  gvBetFiat.textContent='$'+(b*w.rate).toFixed(2);
  gvChance.textContent=(99/m).toFixed(1)+'% win chance';
  gvProfit.textContent=fmtCoin(b*(m-1));
}
function setCoinIc(el,w){
  el.style.background='none';
  el.innerHTML=`<img src="${coinIconUrl(w.c)}" style="width:22px;height:22px;object-fit:cover;border-radius:50%" alt="${w.c}" onerror="var p=this.parentElement;p.style.background='${w.col}';p.innerHTML='${w.s}'">`;
}
function syncBetUI(resetAmt){
  const w=curW();
  setCoinIc(gvCoin,w);setCoinIc(gvCoin2,w);
  if(resetAmt)gvBetIn.value=fmtCoin(Math.max(w.amt/20,voltCur==='USDT'?1:0.0001));
  syncDerived();syncBetBtn();
  const _ap=document.getElementById('autoPanel');if(_ap&&!_ap.hidden){syncAutoCoins();syncAutoFiat();}
  if(window.ENG&&ENG&&ENG.onCur)ENG.onCur();
}
function gvCurSync(){if(curSlug)syncBetUI(true);}
let _viewBusy=false,_t1=0,_t2=0;
function _abortTransition(){
  clearTimeout(_t1);clearTimeout(_t2);_t1=_t2=0;_viewBusy=false;
  const gameEl=document.getElementById('gameView');
  const lobbyEl=document.getElementById('lobbyView');
  if(gameEl)gameEl.classList.remove('view-out','view-in');
  if(lobbyEl)lobbyEl.classList.remove('view-out','view-in');
}
function openGame(slug,mode){
  const g=GAMES[slug];if(!g||_viewBusy)return;
  if(autoRunning)stopAuto();
  // Prepare game data immediately so it's ready when the view appears
  curSlug=slug;
  gvName.textContent=g.n;gvIdleName.textContent=g.n;
  gvProv.textContent=g.p;
  gvRtp.textContent='RTP '+rtpFor(slug,g);
  gvLiveChip.hidden=!g.live;
  // Show Fun/Real toggle only for non-original slot games
  const playToggle=document.getElementById('gvPlayToggle');
  const togPill=document.getElementById('gvTogPill');
  const funLbl=document.getElementById('gvFunLbl');
  const realLbl=document.getElementById('gvRealLbl');
  if(playToggle){
    const showTog=!!g.demo&&!slug.startsWith('originals-');
    playToggle.hidden=!showTog;
    if(showTog){
      const isFun=mode==='fun';
      togPill.classList.toggle('real',!isFun);
      funLbl.classList.toggle('active',isFun);
      realLbl.classList.toggle('active',!isFun);
    }
  }
  gvGlow.style.background=`linear-gradient(160deg,${g.g[0]},${g.g[1]})`;
  gvIdle.hidden=false;gvResult.hidden=true;gvHistory.innerHTML='';
  if(location.hash!=='#play='+slug)location.hash='play='+slug;
  // Real game iframe vs Volt Originals fake canvas
  const iframeEl=document.getElementById('gameIframe');
  const iframeLoader=document.getElementById('iframeLoader');
  const freeBadge=document.getElementById('gvFreeBadge');
  const fsBtn=document.getElementById('gvFsBtn');
  const frameEl=document.querySelector('.gv-frame');
  const pfBtn=document.getElementById('gvPfBtn');
  if(g.demo){
    frameEl.classList.add('real-game');
    iframeLoader.hidden=false;
    iframeLoader.classList.remove('error');
    iframeLoader.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Loading game…';
    iframeEl.hidden=false;
    let _iframeTimer=setTimeout(()=>_iframeError('Game took too long to load.'),15000);
    function _iframeError(msg){
      clearTimeout(_iframeTimer);
      iframeEl.hidden=true;
      iframeLoader.classList.add('error');
      iframeLoader.innerHTML=`
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span class="err-msg">Game unavailable</span>
        <span class="err-sub">${msg}</span>
        <button class="err-retry">Try Again</button>`;
      iframeLoader.querySelector('.err-retry').addEventListener('click',()=>openGame(curSlug));
    }
    iframeEl.onload=()=>{clearTimeout(_iframeTimer);iframeLoader.hidden=true;};
    iframeEl.onerror=()=>_iframeError('Failed to connect to the game server.');
    iframeEl.src=g.demo;
    freeBadge.hidden=false;
    fsBtn.href=g.demo;fsBtn.hidden=false;
    pfBtn.hidden=true;
  }else{
    frameEl.classList.remove('real-game');
    iframeEl.hidden=true;iframeEl.src='';
    iframeLoader.hidden=true;
    freeBadge.hidden=true;fsBtn.hidden=true;
    pfBtn.hidden=false;
    pfInit();
    syncBetUI(true);
  }
  if(window.mountEngine)mountEngine(slug);
  const lobbyEl=document.getElementById('lobbyView');
  const gameEl=document.getElementById('gameView');
  _viewBusy=true;
  lobbyEl.classList.add('view-out');
  _t1=setTimeout(()=>{
    _t1=0;
    lobbyEl.classList.remove('view-out');
    document.body.classList.add('ingame');
    window.scrollTo(0,0);
    gameEl.classList.add('view-in');
    _t2=setTimeout(()=>{_t2=0;gameEl.classList.remove('view-in');_viewBusy=false;},280);
  },180);
}
function closeGame(){
  if(_viewBusy)return;
  if(autoRunning)stopAuto();
  if(window.unmountEngine)unmountEngine();
  const iframeEl=document.getElementById('gameIframe');
  if(iframeEl){iframeEl.src='';iframeEl.hidden=true;}
  const iframeLoader=document.getElementById('iframeLoader');
  if(iframeLoader){iframeLoader.hidden=true;iframeLoader.classList.remove('error');}
  document.querySelector('.gv-frame').classList.remove('real-game');
  document.getElementById('gvFreeBadge').hidden=true;
  document.getElementById('gvFsBtn').hidden=true;
  const gameEl=document.getElementById('gameView');
  const lobbyEl=document.getElementById('lobbyView');
  _viewBusy=true;
  gameEl.classList.add('view-out');
  _t1=setTimeout(()=>{
    _t1=0;
    curSlug=null;
    document.body.classList.remove('ingame');
    gameEl.classList.remove('view-out');
    lobbyEl.classList.add('view-in');
    _t2=setTimeout(()=>{_t2=0;lobbyEl.classList.remove('view-in');_viewBusy=false;},280);
    try{history.pushState('','',location.pathname+location.search);}catch(err){location.hash='';}
    spy();
  },180);
}
function applyHash(){
  const m=location.hash.match(/^#play=(.+)$/);
  if(m&&GAMES[m[1]]){if(curSlug!==m[1])openGame(m[1]);}
  else if(document.body.classList.contains('ingame')||curSlug){
    // Cancel any in-progress open/close transition first
    _abortTransition();
    if(autoRunning)stopAuto();
    if(window.unmountEngine)unmountEngine();
    const iframeEl=document.getElementById('gameIframe');
    if(iframeEl){iframeEl.src='';iframeEl.hidden=true;}
    const iframeLoader=document.getElementById('iframeLoader');
    if(iframeLoader){iframeLoader.hidden=true;iframeLoader.classList.remove('error');}
    const frameEl=document.querySelector('.gv-frame');
    if(frameEl)frameEl.classList.remove('real-game');
    const freeBadge=document.getElementById('gvFreeBadge');
    if(freeBadge)freeBadge.hidden=true;
    const fsBtn=document.getElementById('gvFsBtn');
    if(fsBtn)fsBtn.hidden=true;
    curSlug=null;
    document.body.classList.remove('ingame');
    spy();
  }
}
window.addEventListener('hashchange',applyHash);
applyHash();

function renderSession(){
  sWag.textContent='$'+gsession.wag.toFixed(2);
  sProf.textContent=(gsession.prof<0?'-$':'+$')+Math.abs(gsession.prof).toFixed(2);
  sProf.className='sv '+(gsession.prof<0?'neg':'pos');
  sWins.textContent=gsession.w;sLoss.textContent=gsession.l;
}
function pushChip(r,win){
  gvHistory.insertAdjacentHTML('afterbegin',`<span class="rchip ${win?'w':'l'}">${r.toFixed(2)}×</span>`);
  while(gvHistory.children.length>6)gvHistory.lastElementChild.remove();
}
function pushFeed(name,game,usd,me){
  gvFeed.insertAdjacentHTML('afterbegin',`<div class="frow${me?' me':''}"><span class="fn">${name}</span><b>+$${usd.toFixed(2)}</b><span class="fg">${game}</span></div>`);
  while(gvFeed.children.length>8)gvFeed.lastElementChild.remove();
}
function doBet(onDone){
  if(window.ENG&&ENG){
    if(onDone){if(ENG.autoBet)ENG.autoBet(onDone);return;}
    if(ENG.onBet)ENG.onBet();
    return;
  }
  if(!document.body.classList.contains('authed')){openAuth('in');return;}
  if(betBusy)return;
  const w=curW();
  let b=Math.min(parseFloat(gvBetIn.value)||0,w.amt);
  if(b<=0)return;
  const m=Math.max(1.01,parseFloat(gvMultIn.value)||2);
  const r=Math.min(1000,0.99/Math.max(.001,Math.random()));
  const win=r>=m;
  betBusy=true;
  if(!onDone)gvBetBtn.disabled=true;
  gvIdle.hidden=true;gvResult.hidden=false;
  gvResult.className='gv-result';
  const t0=performance.now(),dur=520;
  requestAnimationFrame(function tick(now){
    const k=Math.min(1,(now-t0)/dur),v=1+(r-1)*k*k;
    gvResult.textContent=v.toFixed(2)+'×';
    if(k<1){requestAnimationFrame(tick);return;}
    gvResult.textContent=r.toFixed(2)+'×';
    gvResult.classList.add(win?'win':'lose');
    const delta=win?b*(m-1):-b;
    w.amt=Math.max(0,w.amt+delta);w.fiat=w.amt*w.rate;
    renderWallet();
    gsession.wag+=b*w.rate;gsession.prof+=delta*w.rate;win?gsession.w++:gsession.l++;
    if(window.addXp)addXp(b*w.rate);
    if(window.addRakeback)addRakeback(b*w.rate);
    if(window.pfRecord)pfRecord();
    renderSession();
    pushChip(r,win);
    if(win)pushFeed('You',gvName.textContent,delta*w.rate,true);
    betBusy=false;
    if(!onDone)gvBetBtn.disabled=false;
    syncDerived();
    if(onDone)onDone(win,delta);
  });
}
document.getElementById('rows').addEventListener('click',e=>{
  // Mini-window button on slot cards
  const mini=e.target.closest('.gc-mini-btn');
  if(mini){
    const t=mini.closest('.gtile');
    if(t&&window.openMiniGame)openMiniGame(t.dataset.slug);
    return;
  }
  // Any other card click → full-screen game view
  const t=e.target.closest('.gtile');
  if(t&&t.dataset.slug)openGame(t.dataset.slug);
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&document.body.classList.contains('ingame'))closeGame();
});
gvBetIn.addEventListener('input',syncDerived);
gvMultIn.addEventListener('input',syncDerived);
document.getElementById('gvHalf').addEventListener('click',()=>{
  const b=parseFloat(gvBetIn.value)||0;
  gvBetIn.value=fmtCoin(Math.max(voltCur==='USDT'?0.01:0.0001,b/2));syncDerived();
});
document.getElementById('gvDouble').addEventListener('click',()=>{
  const w=curW(),b=parseFloat(gvBetIn.value)||0;
  const min=voltCur==='USDT'?0.01:0.0001;
  gvBetIn.value=fmtCoin(Math.min(w.amt,Math.max(min,b*2)));syncDerived();
});
/* ---------- auto-bet ---------- */
const autoPanel=document.getElementById('autoPanel'),
      autoRoundsEl=document.getElementById('autoRoundsEl'),
      autoOnWin=document.getElementById('autoOnWin'),
      autoOnLoss=document.getElementById('autoOnLoss'),
      autoOnWinFiat=document.getElementById('autoOnWinFiat'),
      autoOnLossFiat=document.getElementById('autoOnLossFiat'),
      autoProgEl=document.getElementById('autoProgEl'),
      autoProgTxt=document.getElementById('autoProgTxt'),
      autoProgPnl=document.getElementById('autoProgPnl'),
      autoBarFill=document.getElementById('autoBarFill'),
      autoPCoin=document.getElementById('autoPCoin'),
      autoLCoin=document.getElementById('autoLCoin');
/* var, not let: openGame runs during initial applyHash(), before this line evaluates */
var autoRunning=false,autoTimer=null,autoRounds=10,autoRound=0,autoStartAmt=0;

function syncAutoCoins(){
  const w=curW();
  [autoPCoin,autoLCoin].forEach(el=>setCoinIc(el,w));
}
function syncAutoFiat(){
  const w=curW();
  const pv=parseFloat(autoOnWin.value);
  const lv=parseFloat(autoOnLoss.value);
  autoOnWinFiat.textContent=pv>0?'≈$'+(pv*w.rate).toFixed(2):'';
  autoOnLossFiat.textContent=lv>0?'≈$'+(lv*w.rate).toFixed(2):'';
}
function updateAutoProgress(){
  const w=curW(),pnl=(w.amt-autoStartAmt)*w.rate;
  autoProgPnl.textContent=(pnl<0?'-$':'+$')+Math.abs(pnl).toFixed(2);
  autoProgPnl.className='sv '+(pnl>=0?'pos':'neg');
  if(autoRounds>0){
    autoProgTxt.textContent='Round '+autoRound+' / '+autoRounds;
    autoBarFill.style.width=(autoRound/autoRounds*100)+'%';
  }else{
    autoProgTxt.textContent='Round '+autoRound;
    autoBarFill.style.width='100%';
  }
}
function setAutoInputsDisabled(on){
  [gvBetIn,gvMultIn,autoOnWin,autoOnLoss].forEach(el=>el.disabled=on);
  document.getElementById('gvHalf').disabled=on;
  document.getElementById('gvDouble').disabled=on;
  document.getElementById('gvCurBtn').disabled=on;
  autoRoundsEl.querySelectorAll('.auto-seg').forEach(s=>s.disabled=on);
  const ef=document.getElementById('engFields');
  if(ef)ef.querySelectorAll('input,button').forEach(el=>el.disabled=on);
}
function stopAuto(){
  autoRunning=false;
  clearTimeout(autoTimer);
  setAutoInputsDisabled(false);
  gvBetBtn.textContent='Start Auto';
  gvBetBtn.classList.remove('running');
}
function checkAutoStop(){
  const w=curW(),pnl=w.amt-autoStartAmt;
  if(autoRounds>0&&autoRound>=autoRounds)return true;
  const sp=parseFloat(autoOnWin.value);
  const sl=parseFloat(autoOnLoss.value);
  if(sp>0&&pnl>=sp)return true;
  if(sl>0&&pnl<=-sl)return true;
  if(w.amt<=0)return true;
  return false;
}
function runAutoRound(){
  if(!autoRunning)return;
  if(checkAutoStop()){stopAuto();return;}
  autoRound++;
  updateAutoProgress();
  doBet(()=>{
    updateAutoProgress();
    if(!autoRunning)return;
    if(checkAutoStop()){stopAuto();return;}
    autoTimer=setTimeout(runAutoRound,80);
  });
}
function startAuto(){
  if(!document.body.classList.contains('authed')){openAuth('in');return;}
  autoRunning=true;
  autoRound=0;
  autoStartAmt=curW().amt;
  setAutoInputsDisabled(true);
  gvBetBtn.textContent='Stop Auto';
  gvBetBtn.classList.add('running');
  autoProgEl.hidden=false;
  updateAutoProgress();
  runAutoRound();
}
autoRoundsEl.addEventListener('click',e=>{
  const s=e.target.closest('.auto-seg');if(!s||s.disabled)return;
  autoRoundsEl.querySelectorAll('.auto-seg').forEach(x=>x.classList.remove('active'));
  s.classList.add('active');
  autoRounds=parseInt(s.dataset.v);
});
autoOnWin.addEventListener('input',syncAutoFiat);
autoOnLoss.addEventListener('input',syncAutoFiat);

let isAutoTab=false;
document.getElementById('gvTabs').addEventListener('click',e=>{
  const t=e.target.closest('.gv-tab');if(!t||autoRunning)return;
  document.querySelectorAll('.gv-tab').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  isAutoTab=Array.from(t.parentElement.children).indexOf(t)===1;
  autoPanel.hidden=!isAutoTab;
  document.getElementById('gvProfitField').hidden=isAutoTab;
  if(isAutoTab){
    gvBetBtn.textContent=document.body.classList.contains('authed')?'Start Auto':'Log In to Play';
    syncAutoCoins();syncAutoFiat();
    autoProgEl.hidden=true;
  }else{
    syncBetBtn();
  }
});
gvBetBtn.addEventListener('click',()=>{
  if(isAutoTab){
    if(autoRunning)stopAuto();else startAuto();
  }else{
    doBet();
  }
});
const feedNames=['Volty_88','Nina_X','Krakn','Joules','Mx_Turbo','Ohmies','Hidden'];
setInterval(()=>{
  if(!document.body.classList.contains('ingame'))return;
  pushFeed(feedNames[Math.floor(rnd(0,feedNames.length))],ballgames[Math.floor(rnd(0,ballgames.length))],rnd(4,900),false);
},3400);

/* ===== Provably Fair ===== */
function _randHex(n){return Array.from(crypto.getRandomValues(new Uint8Array(n))).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function _sha256(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}

/* exposed globals — place-bet.js reads these */
window._pfClient = _randHex(8);
window._pfNonce  = 0;

/* last server-returned seeds for display — var (not let) so pfInit() can be
   called from applyHash() at line 139 before this declaration is reached */
var _pfLastServerSeed='', _pfLastServerHash='', _pfLastClientSeed='', _pfLastNonce=0;

var _pfLog = [];

/* called by place-bet.js after every successful bet */
window.pfRecordServer = function(serverSeed, serverSeedHash, clientSeed, nonce){
  _pfLastServerSeed = serverSeed;
  _pfLastServerHash = serverSeedHash;
  _pfLastClientSeed = clientSeed;
  _pfLastNonce      = nonce;
  const gameName = ENG ? (Object.keys(ORIGINALS).find(k=>ORIGINALS[k]===ENG)||'').replace('originals-','') : '';
  _pfLog.unshift({game:gameName||'game', serverSeed, serverSeedHash, clientSeed, nonce, mult:null, ts:Date.now()});
  if(_pfLog.length>50)_pfLog.length=50;
  /* backfill multiplier from bet history */
  const h=window._clientBetHist;
  if(h&&h.length&&_pfLog[0])_pfLog[0].mult=h[0].mult;
};


function pfInit(){
  window._pfClient = _randHex(8);
  window._pfNonce  = 0;
  _pfLastServerSeed='';_pfLastServerHash='';
}

async function _pfHmacFloat(serverSeed, clientSeed, nonce, index){
  /* Match backend deriveFloats: one HMAC per base nonce, read 4-byte chunk at index*4.
     Overflow (index >= 8, beyond 32 bytes): new HMAC with extended nonce suffix. */
  const msg = index < 8 ? `${clientSeed}:${nonce}` : `${clientSeed}:${nonce}-${index}`;
  const byteOff = index < 8 ? index * 4 : 0;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(serverSeed),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(msg));
  const b=new Uint8Array(sig);
  return((b[byteOff]<<24|b[byteOff+1]<<16|b[byteOff+2]<<8|b[byteOff+3])>>>0)/0x100000000;
}

async function pfVerify(serverSeed, clientSeed, nonce, game, params){
  const rnd=i=>_pfHmacFloat(serverSeed,clientSeed,nonce,i);
  if(game==='dice'){
    const chance=Math.max(2,Math.min(98,Number(params.chance)||50));
    const over=Boolean(params.over??true);
    const roll=+((await rnd(0))*100).toFixed(2);
    const target=over?100-chance:chance;
    const win=over?roll>target:roll<target;
    const mult=win?+(99/chance).toFixed(4):0;
    return{rows:[['Roll',roll],['Target',over?'> '+target:'< '+target],['Direction',over?'Over':'Under']],win,mult};
  }
  if(game==='limbo'){
    const target=Math.max(1.01,Number(params.target)||2);
    const r=await rnd(0);
    const result=+Math.max(1,Math.min(1000000,0.99/Math.max(0.000001,r))).toFixed(2);
    const win=result>=target;
    const mult=win?+(target*0.99).toFixed(4):0;
    return{rows:[['Result',result+'×'],['Target','≥ '+target+'×']],win,mult};
  }
  if(game==='coinflip'){
    const side=params.side||'don';
    const flip=(await rnd(0))<0.5?'heads':'tails';
    const result=flip==='heads'?'don':'snitch';
    const win=result===side;
    return{rows:[['Flip',flip],['Result',result],['Your pick',side]],win,mult:win?1.98:0};
  }
  if(game==='crash'){
    const r=await rnd(0);
    const bust=r<0.01?1.00:+Math.min(1000,Math.max(1,0.99/(1-r))).toFixed(2);
    const cashout=Number(params.cashout)||0;
    const win=cashout>0&&cashout<=bust;
    return{rows:[['Bust point',bust+'×'],['Cashout',cashout?cashout+'×':'—']],win,mult:win?cashout:0};
  }
  if(game==='mines'){
    const mineCount=Math.max(1,Math.min(24,Number(params.mineCount)||3));
    const revealedCells=(params.revealedCells||[]).map(Number);
    const gridSize=25;
    const positions=Array.from({length:gridSize},(_,i)=>i);
    for(let i=0;i<mineCount;i++){const f=await rnd(i);const j=i+Math.floor(f*(gridSize-i));[positions[i],positions[j]]=[positions[j],positions[i]];}
    const mines=positions.slice(0,mineCount).sort((a,b)=>a-b);
    const mineSet=new Set(mines);
    const hitMine=revealedCells.some(c=>mineSet.has(c));
    const safe=gridSize-mineCount;
    const picks=revealedCells.length;
    let mult=0;if(!hitMine&&picks>0){let m=1;for(let i=0;i<picks;i++)m*=(safe-i)/(gridSize-mineCount-i);mult=+((m*0.99)).toFixed(4);}
    return{rows:[['Mine positions',mines.join(', ')],['Mines count',mineCount],['Hit mine',hitMine?'Yes':'No']],win:!hitMine&&picks>0,mult};
  }
  if(game==='plinko'){
    const rows=Math.max(8,Math.min(16,Number(params.rows)||12));
    const risk=params.risk||'medium';
    const T={low:{8:[5.6,2.1,1.1,1,0.5,1,1.1,2.1,5.6],12:[10,3,1.6,1.4,1.1,1,0.5,1,1.1,1.4,1.6,3,10],16:[16,9,2,1.4,1.4,1.2,1.1,1,0.5,1,1.1,1.2,1.4,1.4,2,9,16]},medium:{8:[13,3,1.3,0.7,0.4,0.7,1.3,3,13],12:[33,11,4,2,1.1,0.6,0.3,0.6,1.1,2,4,11,33],16:[110,41,10,5,3,1.5,1,0.5,0.3,0.5,1,1.5,3,5,10,41,110]},high:{8:[29,4,1.5,0.3,0.2,0.3,1.5,4,29],12:[170,24,8.1,2,0.7,0.2,0.2,0.2,0.7,2,8.1,24,170],16:[1000,130,26,9,4,2,0.2,0.2,0.2,0.2,0.2,2,4,9,26,130,1000]}};
    let pos=0;for(let i=0;i<rows;i++)pos+=(await rnd(i))<0.5?0:1;
    const mult=(T[risk]||T.medium)[rows]?.[pos]??1;
    return{rows:[['Rows',rows],['Risk',risk],['Bucket',pos],['Multiplier',mult+'×']],win:mult>1,mult};
  }
  if(game==='keno'){
    const picks=(params.picks||[]).map(Number);
    const pool=Array.from({length:40},(_,i)=>i+1);
    const draws=[];
    for(let i=0;i<10;i++){const idx=Math.floor((await rnd(i))*pool.length);draws.push(pool.splice(idx,1)[0]);}
    draws.sort((a,b)=>a-b);
    const hits=picks.filter(p=>draws.includes(p)).length;
    return{rows:[['Drawn',draws.join(', ')],['Your picks',picks.join(', ')||'—'],['Hits',hits]],win:hits>0,mult:0};
  }
  if(game==='baccarat'){
    const RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const SUITS=['♠','♥','♦','♣'];
    const cv=r=>r===0?1:r>=9?0:r;
    const hv=cards=>cards.reduce((s,c)=>s+cv(c%13),0)%10;
    // shuffleDeck uses same HMAC deriveFloats — replicate Fisher-Yates with index-based floats
    const indices=Array.from({length:52},(_,i)=>i);
    for(let i=51;i>0;i--){const f=await rnd(51-i);const j=Math.floor(f*(i+1));[indices[i],indices[j]]=[indices[j],indices[i]];}
    const cardName=i=>RANKS[i%13]+SUITS[Math.floor(i/13)];
    const pH=[indices[0],indices[2]];const bH=[indices[1],indices[3]];
    let pDrew=false;
    const pv0=hv(pH),bv0=hv(bH);
    if(pv0<8&&bv0<8){
      if(pv0<=5){pH.push(indices[4]);pDrew=true;}
      let bd=false;const bv1=hv(bH);
      if(!pDrew){bd=bv1<=5;}
      else{const pt=cv(pH[2]%13);if(bv1<=2)bd=true;else if(bv1===3&&pt!==8)bd=true;else if(bv1===4&&[2,3,4,5,6,7].includes(pt))bd=true;else if(bv1===5&&[4,5,6,7].includes(pt))bd=true;else if(bv1===6&&[6,7].includes(pt))bd=true;}
      if(bd)bH.push(indices[pDrew?5:4]);
    }
    const pv=hv(pH),bv=hv(bH);
    const winner=pv>bv?'Player':bv>pv?'Banker':'Tie';
    return{rows:[['Player hand',pH.map(cardName).join(' ')],['Player score',pv],['Banker hand',bH.map(cardName).join(' ')],['Banker score',bv],['Winner',winner]],win:true,mult:0};
  }
  if(game==='roulette'){
    // Simple spin — 37 pockets (0-36)
    const r=await rnd(0);
    const pocket=Math.floor(r*37);
    return{rows:[['Pocket',pocket],['Color',pocket===0?'Green':[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(pocket)?'Red':'Black']],win:false,mult:0};
  }
  return null;
}

function _pfRender(){
  document.getElementById('pfClientSeed').value=window._pfClient;
  document.getElementById('pfNonce').textContent=window._pfNonce;
  const hasPrev=!!_pfLastServerSeed;
  document.getElementById('pfServerHash').textContent=_pfLastServerHash||'Place a bet to reveal hash';
  const sec=document.getElementById('pfResultSection');
  sec.hidden=!hasPrev;
  if(hasPrev){
    document.getElementById('pfLastSeed').textContent=_pfLastServerSeed;
    document.getElementById('pfLastHash').textContent=_pfLastServerHash;
    document.getElementById('pfVerifySeed').value=_pfLastServerSeed;
    document.getElementById('pfVerifyClient').value=_pfLastClientSeed;
    document.getElementById('pfVerifyNonce').value=_pfLastNonce;
    // Pre-select game
    const gameName=ENG?Object.keys(ORIGINALS).find(k=>ORIGINALS[k]===ENG)||'':'';
    const sel=document.getElementById('pfGameSel');
    if(sel&&gameName)sel.value=gameName.replace('originals-','');
    _pfUpdateParams();
  }
  const logEl=document.getElementById('pfLog');
  if(logEl){
    if(!_pfLog.length){logEl.innerHTML='<div class="pf-log-empty">No bets yet this session</div>';}
    else logEl.innerHTML=_pfLog.map(b=>{
      const t=Math.floor((Date.now()-b.ts)/1000);
      const ago=t<60?t+'s':t<3600?Math.floor(t/60)+'m':Math.floor(t/3600)+'h';
      const m=b.mult!=null?b.mult.toFixed(2)+'×':'—';
      return`<div class="pf-log-row" title="Click to verify" data-seed="${b.serverSeed}" data-cs="${b.clientSeed}" data-nc="${b.nonce}" data-game="${b.game}">
        <span class="pf-log-game">${b.game}</span>
        <span class="pf-log-nc">#${b.nonce}</span>
        <span class="pf-log-mult" style="color:${b.mult>1?'#41f0a4':b.mult===1?'var(--txt)':'#f87171'}">${m}</span>
        <code class="pf-log-seed">${b.serverSeed.slice(0,12)}…</code>
        <span class="pf-log-ago">${ago}</span>
      </div>`;
    }).join('');
  }
}

const PF_PARAMS={
  dice:[{id:'pfChance',label:'Win Chance %',type:'number',def:50,min:2,max:98},{id:'pfOver',label:'Direction',type:'select',opts:['over','under']}],
  limbo:[{id:'pfTarget',label:'Target ×',type:'number',def:2,min:1.01}],
  coinflip:[{id:'pfSide',label:'Side',type:'select',opts:['don','snitch']}],
  crash:[{id:'pfCashout',label:'Cashout ×',type:'number',def:2,min:1}],
  mines:[{id:'pfMineCount',label:'Mine Count',type:'number',def:3,min:1,max:24},{id:'pfRevealed',label:'Revealed cells (comma)',type:'text',def:''}],
  plinko:[{id:'pfRows',label:'Rows',type:'select',opts:['8','12','16']},{id:'pfRisk',label:'Risk',type:'select',opts:['low','medium','high']}],
  keno:[{id:'pfPicks',label:'Picks (comma)',type:'text',def:''}],
  baccarat:[],
  roulette:[],
};
function _pfUpdateParams(){
  const game=document.getElementById('pfGameSel')?.value||'';
  const defs=PF_PARAMS[game]||[];
  const el=document.getElementById('pfParams');if(!el)return;
  if(!defs.length){el.innerHTML='';return;}
  el.innerHTML=defs.map(p=>{
    if(p.type==='select')return`<div class="pf-param-group"><label class="pf-param-label">${p.label}</label><select id="${p.id}" class="pf-game-sel" style="margin:0;width:auto">${p.opts.map(o=>`<option value="${o}">${o}</option>`).join('')}</select></div>`;
    return`<div class="pf-param-group"><label class="pf-param-label">${p.label}</label><input id="${p.id}" class="pf-param-input" type="${p.type}" value="${p.def??''}"${p.min!==undefined?' min="'+p.min+'"':''}${p.max!==undefined?' max="'+p.max+'"':''}></div>`;
  }).join('');
}
function _pfGetParams(game){
  const p={};
  if(game==='dice'){p.chance=Number(document.getElementById('pfChance')?.value)||50;p.over=(document.getElementById('pfOver')?.value||'over')==='over';}
  if(game==='limbo')p.target=Number(document.getElementById('pfTarget')?.value)||2;
  if(game==='coinflip')p.side=document.getElementById('pfSide')?.value||'don';
  if(game==='crash')p.cashout=Number(document.getElementById('pfCashout')?.value)||0;
  if(game==='mines'){p.mineCount=Number(document.getElementById('pfMineCount')?.value)||3;p.revealedCells=(document.getElementById('pfRevealed')?.value||'').split(',').map(s=>s.trim()).filter(Boolean).map(Number);}
  if(game==='plinko'){p.rows=Number(document.getElementById('pfRows')?.value)||12;p.risk=document.getElementById('pfRisk')?.value||'medium';}
  if(game==='keno')p.picks=(document.getElementById('pfPicks')?.value||'').split(',').map(s=>s.trim()).filter(Boolean).map(Number);
  return p;
}
function _pfRenderResult(r,hashOk){
  const out=document.getElementById('pfVerifyOut');if(!out)return;
  if(!r){out.innerHTML='<div style="color:var(--muted);font-size:12px;padding:8px 0">Unknown game or invalid seeds.</div>';return;}
  const cls=r.win?'win':'loss';
  const badge=r.win?'WIN':'LOSS';
  const multStr=r.mult>0?r.mult.toFixed(4)+'×':'0×';
  const hashBadge=hashOk===null?'':hashOk?
    `<div class="pf-hash-badge ok">✓ Hash verified</div>`:
    `<div class="pf-hash-badge fail">✗ Hash mismatch — seed may be wrong</div>`;
  out.innerHTML=`${hashBadge}<div class="pf-outcome ${cls}">
    <div class="pf-outcome-head">
      <span class="pf-outcome-badge ${cls}">${badge}</span>
      <span class="pf-outcome-mult ${cls}">${multStr}</span>
    </div>
    ${r.rows.map(([k,v])=>`<div class="pf-outcome-row"><span>${k}</span><b>${v}</b></div>`).join('')}
  </div>`;
}

const pfOverlay=document.getElementById('pfOverlay');
const _pfCopy=text=>{navigator.clipboard?.writeText(text).catch(()=>{});};
document.getElementById('gvPfBtn').addEventListener('click',()=>{_pfRender();pfOverlay.classList.add('open');});
document.getElementById('pfClose').addEventListener('click',()=>pfOverlay.classList.remove('open'));
pfOverlay.addEventListener('click',e=>{if(e.target===pfOverlay)pfOverlay.classList.remove('open');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pfOverlay.classList.contains('open')){pfOverlay.classList.remove('open');e.stopPropagation();}},true);
document.getElementById('pfClientSeed').addEventListener('input',e=>{window._pfClient=e.target.value||_randHex(8);});
document.getElementById('pfNewClient').addEventListener('click',()=>{window._pfClient=_randHex(8);document.getElementById('pfClientSeed').value=window._pfClient;});
document.getElementById('pfCopyClient').addEventListener('click',()=>_pfCopy(document.getElementById('pfClientSeed').value));
document.getElementById('pfCopyHash').addEventListener('click',()=>_pfCopy(document.getElementById('pfServerHash').textContent));
document.getElementById('pfCopyLastSeed').addEventListener('click',()=>_pfCopy(document.getElementById('pfLastSeed').textContent));
document.getElementById('pfRotate').addEventListener('click',()=>{window._pfClient=_randHex(8);window._pfNonce=0;_pfRender();});
document.getElementById('pfGameSel').addEventListener('change',_pfUpdateParams);
document.getElementById('pfLog').addEventListener('click',e=>{
  const row=e.target.closest('.pf-log-row');if(!row)return;
  document.getElementById('pfVerifySeed').value=row.dataset.seed;
  document.getElementById('pfVerifyClient').value=row.dataset.cs;
  document.getElementById('pfVerifyNonce').value=row.dataset.nc;
  const game=(row.dataset.game||'').replace('originals-','');
  const sel=document.getElementById('pfGameSel');if(sel&&game)sel.value=game;
  _pfUpdateParams();
  document.getElementById('pfVerifyOut').innerHTML='';
  document.getElementById('pfVerifySeed').scrollIntoView({behavior:'smooth',block:'nearest'});
});
document.getElementById('pfVerifyBtn').addEventListener('click',async()=>{
  const btn=document.getElementById('pfVerifyBtn');
  const seed=document.getElementById('pfVerifySeed').value.trim();
  const cs=document.getElementById('pfVerifyClient').value.trim();
  const nc=parseInt(document.getElementById('pfVerifyNonce').value)||0;
  const game=document.getElementById('pfGameSel')?.value||'';
  if(!seed||!cs){document.getElementById('pfVerifyOut').innerHTML='<div style="color:#f87171;font-size:12px;padding:6px 0">Enter server seed and client seed.</div>';return;}
  if(!game){document.getElementById('pfVerifyOut').innerHTML='<div style="color:#f87171;font-size:12px;padding:6px 0">Select a game.</div>';return;}
  btn.textContent='Verifying…';btn.disabled=true;
  try{
    const hash=await _sha256(seed);
    const hashOk=_pfLastServerHash?hash===_pfLastServerHash:null;
    const params=_pfGetParams(game);
    const r=await pfVerify(seed,cs,nc,game,params);
    _pfRenderResult(r,hashOk);
  }catch(err){
    document.getElementById('pfVerifyOut').innerHTML=`<div style="color:#f87171;font-size:12px;padding:6px 0">Error: ${err.message}</div>`;
  }finally{btn.textContent='Verify';btn.disabled=false;}
});
