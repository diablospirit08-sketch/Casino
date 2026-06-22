/* VOLT — lobby: header wallet/auth state, nav rail, categories, game rows, search/filter, providers, all-bets table */
/* ---------- wallet / auth ---------- */
const WALLETS=[
  {c:'BTC',  s:'₿', col:'#f7931a', amt:0.00421337, fiat:441.20},
  {c:'ETH',  s:'◆', col:'#6b7a99', amt:0.1582,     fiat:512.74},
  {c:'BNB',  s:'B', col:'#f0b90b', amt:0.5,         fiat:300.00},
  {c:'LTC',  s:'Ł', col:'#9aa0ad', amt:2.4407,     fiat:227.18},
  {c:'USDT', s:'₮', col:'#26a17b', amt:318.02,     fiat:318.02},
  {c:'USDC', s:'$', col:'#2775ca', amt:150.00,     fiat:150.00},
  {c:'SOL',  s:'S', col:'#9945ff', amt:1.0871,     fiat:189.40},
];
const LS_AUTH='volt-auth', LS_CUR='volt-wallet-cur';
let voltCur = localStorage.getItem(LS_CUR) || 'BTC';
if(!WALLETS.some(w=>w.c===voltCur)) voltCur='BTC';
const walletEl=document.getElementById('wallet'),
      walletBal=document.getElementById('walletBal'),
      walletIc=document.getElementById('walletIc'),
      walletAmt=document.getElementById('walletAmt'),
      walletCurEl=document.getElementById('walletCur'),
      walletMenu=document.getElementById('walletMenu'),
      avatarWrap=document.getElementById('avatarWrap');
const fmtAmt=w=> (w.c==='USDT'||w.c==='USDC') ? w.amt.toFixed(2) : (w.amt>0&&w.amt<0.001?w.amt.toFixed(6):w.amt.toFixed(4));
function timeAgo(iso){
  const s=Math.floor((Date.now()-new Date(iso))/1000);
  if(s<60)return s+'s ago';
  if(s<3600)return Math.floor(s/60)+'m ago';
  if(s<86400)return Math.floor(s/3600)+'h ago';
  return Math.floor(s/86400)+'d ago';
}
const TXN_CFG={
  deposit: {bg:'rgba(65,240,164,.12)', stroke:'#41f0a4', icon:'<path d="M12 4v16M5 15l7 7 7-7"/>'},
  withdraw:{bg:'rgba(248,113,113,.12)',stroke:'#f87171', icon:'<path d="M12 20V4M5 9l7-7 7 7"/>'},
  bet:     {bg:'rgba(255,255,255,.07)',stroke:'#8899bb', icon:'<circle cx="12" cy="12" r="5"/><path d="M12 8v4l3 3"/>'},
  win:     {bg:'rgba(65,240,164,.12)', stroke:'#41f0a4', icon:'<path d="M12 4v16M5 15l7 7 7-7"/>'},
};
const COIN_ICONS={
  BTC:'https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png',
  ETH:'https://coin-images.coingecko.com/coins/images/279/small/ethereum.png',
  BNB:'https://coin-images.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  LTC:'https://coin-images.coingecko.com/coins/images/2/small/litecoin.png',
  USDT:'https://coin-images.coingecko.com/coins/images/325/small/Tether.png',
  USDC:'https://coin-images.coingecko.com/coins/images/6319/small/usdc.png',
  SOL:'https://coin-images.coingecko.com/coins/images/4128/small/solana.png',
  XRP:'https://coin-images.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
  TRX:'https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png',
  DOGE:'https://coin-images.coingecko.com/coins/images/5/small/dogecoin.png',
  MATIC:'https://coin-images.coingecko.com/coins/images/4713/small/matic-token-icon.png',
};
const coinIconUrl=c=>COIN_ICONS[c]||'https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png';
const coinImg=(c)=>`<img src="${coinIconUrl(c)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex:none" alt="${c}" onerror="this.style.visibility='hidden'">`;
function renderWallet(){
  const w=WALLETS.find(x=>x.c===voltCur);
  walletIc.style.background='none';
  walletIc.innerHTML=`<img src="${coinIconUrl(w.c)}" style="width:24px;height:24px;object-fit:cover" alt="${w.c}" onerror="var p=this.parentElement;p.style.background='${w.col}';p.innerHTML='${w.s}'">`;
  walletAmt.textContent=fmtAmt(w);
  walletCurEl.textContent=w.c;
  walletMenu.innerHTML='<div class="mlbl">Balances</div>'+WALLETS.map(x=>`
    <button class="wmi ${x.c===voltCur?'sel':''}" data-cur="${x.c}">
      ${coinImg(x.c)}
      <span class="wnm">${x.c}</span>
      <span class="amts"><b>${fmtAmt(x)}</b><span>$${x.fiat.toFixed(2)}</span></span>
      <svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5 10-11"></path></svg>
    </button>`).join('')
  +`<hr class="txn-divider"><button class="txn-footer" id="txnOpenBtn">Transactions</button>`;
}
renderWallet();
function setAuth(on){
  document.body.classList.toggle('authed',on);
  localStorage.setItem(LS_AUTH,on?'in':'out');
  walletEl.classList.remove('open');
  avatarWrap.classList.remove('open');
  if(window.syncBetBtn)syncBetBtn();
}
setAuth(false); /* initial state; Supabase session restore runs in modals.js after load */
document.getElementById('loginBtn').addEventListener('click',()=>openAuth('in'));
document.getElementById('signupBtn').addEventListener('click',()=>openAuth('up'));
const walletPickerOverlay=document.getElementById('walletPickerOverlay');
const walletPickerMsg=document.getElementById('walletPickerMsg');
function openWalletPicker(){walletPickerOverlay.classList.add('open');}
function closeWalletPicker(){walletPickerOverlay.classList.remove('open');walletPickerMsg.textContent='';}
function wpConnect(fn,btn){
  const orig=btn.innerHTML;
  btn.disabled=true;btn.textContent='Connecting…';
  walletPickerMsg.textContent='';
  fn().then(()=>{closeWalletPicker();showToast({icon:'🔗',title:'Wallet connected',sub:'BNB balance is live'});})
     .catch(e=>{btn.disabled=false;btn.innerHTML=orig;walletPickerMsg.textContent=e.message;});
}
document.getElementById('walletPickerClose').addEventListener('click',closeWalletPicker);
walletPickerOverlay.addEventListener('click',e=>{if(e.target===walletPickerOverlay)closeWalletPicker();});
document.getElementById('wpMetaMask').addEventListener('click',function(){wpConnect(()=>window.bscCashier.connectMetaMask(),this);});
document.getElementById('wpWalletConnect').addEventListener('click',function(){wpConnect(()=>window.bscCashier.connectWalletConnect(),this);});
document.getElementById('wpCoinbase').addEventListener('click',function(){wpConnect(()=>window.bscCashier.connectCoinbase(),this);});
document.getElementById('wpTrust').addEventListener('click',function(){wpConnect(()=>window.bscCashier.connectTrust(),this);});
document.getElementById('logoutBtn').addEventListener('click',()=>{supa.auth.signOut();setAuth(false);});
walletBal.addEventListener('click',e=>{
  e.stopPropagation();
  avatarWrap.classList.remove('open');
  const open=walletEl.classList.toggle('open');
  walletBal.setAttribute('aria-expanded',open);
});
walletMenu.addEventListener('click',e=>{
  const b=e.target.closest('.wmi'); if(!b) return;
  e.stopPropagation();
  if(typeof autoRunning!=='undefined'&&autoRunning)return;
  voltCur=b.dataset.cur;
  localStorage.setItem(LS_CUR,voltCur);
  renderWallet();
  walletEl.classList.remove('open');
  if(window.gvCurSync)gvCurSync();
});
walletMenu.addEventListener('click',e=>{
  if(!e.target.closest('#txnOpenBtn'))return;
  e.stopPropagation();
  walletEl.classList.remove('open');
  openTxnModal();
});

/* ── Transactions modal ── */
const txnOverlay=document.getElementById('txnOverlay');
let txnFilter='all',txnPage=0,txnPageSize=20,txnLoading=false;

function txnRow(t){
  const cfg=TXN_CFG[t.type]||TXN_CFG.bet;
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

async function loadTxnPage(reset){
  if(txnLoading)return;
  txnLoading=true;
  if(reset)txnPage=0;
  const list=document.getElementById('txnList');
  if(reset)list.innerHTML='<div class="txn-empty">Loading…</div>';
  if(!document.body.classList.contains('authed')){
    list.innerHTML='<div class="txn-empty">Sign in to view transactions</div>';
    txnLoading=false;return;
  }
  const off=txnPage*txnPageSize;
  const rows=[];
  let hasMore=false;
  try{
    if(txnFilter!=='txns'){
      const r=await voltApi._fetch('/api/bets/history?limit='+txnPageSize+'&offset='+off);
      const j=r.ok?await r.json():{bets:[]};
      const bets=j.bets||[];
      if(bets.length===txnPageSize)hasMore=true;
      bets.forEach(b=>{
        const win=b.status==='won';
        const gameName=(b.game||'Game').replace('originals-','').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
        rows.push({type:win?'win':'bet',label:gameName,cur:b.currency,
          amt:win?+(b.payout-b.wager):-(b.wager||0),time:timeAgo(b.created_at),_ts:new Date(b.created_at).getTime()});
      });
    }
    if(txnFilter!=='bets'){
      const r=await voltApi._fetch('/api/wallet/history?limit='+txnPageSize+'&offset='+off);
      const j=r.ok?await r.json():{entries:[]};
      const entries=(j.entries||[]).filter(e=>e.type==='deposit'||e.type==='withdrawal');
      if(j.entries&&j.entries.length===txnPageSize)hasMore=true;
      entries.forEach(t=>{
        rows.push({type:t.type,label:t.type==='deposit'?'Deposit':'Withdraw',cur:t.currency,
          amt:t.type==='deposit'?+(t.amount||0):-(t.amount||0),time:timeAgo(t.created_at),_ts:new Date(t.created_at).getTime()});
      });
    }
  }catch(e){
    list.innerHTML='<div class="txn-empty">Failed to load transactions</div>';
    txnLoading=false;return;
  }
  rows.sort((a,b)=>b._ts-a._ts);
  if(reset)list.innerHTML='';
  if(!rows.length&&reset)list.innerHTML='<div class="txn-empty">No transactions yet</div>';
  else rows.forEach(r=>list.insertAdjacentHTML('beforeend',txnRow(r)));
  document.getElementById('txnMore').style.display=hasMore?'block':'none';
  txnPage++;
  txnLoading=false;
}

document.getElementById('txnClose').addEventListener('click',()=>txnOverlay.classList.remove('open'));
txnOverlay.addEventListener('click',e=>{if(e.target===txnOverlay)txnOverlay.classList.remove('open');});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&txnOverlay.classList.contains('open')){txnOverlay.classList.remove('open');e.stopPropagation();}
},true);
document.getElementById('txnMore').addEventListener('click',()=>loadTxnPage(false));
txnOverlay.addEventListener('click',e=>{
  const b=e.target.closest('.auto-seg[data-txf]');if(!b)return;
  txnFilter=b.dataset.txf;
  txnOverlay.querySelectorAll('.auto-seg[data-txf]').forEach(x=>x.classList.toggle('active',x===b));
  loadTxnPage(true);
});
document.getElementById('avatarBtn').addEventListener('click',e=>{
  e.stopPropagation();
  walletEl.classList.remove('open');
  avatarWrap.classList.toggle('open');
});
document.addEventListener('click',()=>{
  walletEl.classList.remove('open');
  avatarWrap.classList.remove('open');
  sortWrap.classList.remove('open');
  filterWrap.classList.remove('open');
});

/* ---------- nav rail ---------- */
/* cat: rail item activates the matching category chip; items without one scroll to their lobby section */
const railItems = [
  {l:'Lobby',        t:'sec-top',       cat:'lobby',     ic:'<img src="images/lobby%20icon.png" style="width:28px;height:28px;object-fit:contain;filter:drop-shadow(0 1px 3px rgba(0,0,0,.4))">'},
  {l:'Originals',    t:'sec-originals', cat:'originals', ic:'<path d="M7 2v11h3v9l7-12h-4l4-8z"/>'},
  {l:'Slots',        t:'sec-slots',     cat:'slots',     ic:'<img src="images/slots-777.png" style="width:36px;height:36px;object-fit:contain;filter:drop-shadow(0 1px 3px rgba(0,0,0,.4))">'},
  {l:'Hot Picks',    t:'sec-hot',                        ic:'<path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/>'},
  {l:'Live Casino',  t:'sec-live',      cat:'live',      ic:'<path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>'},
  {l:'Game Shows',   t:'sec-shows',     cat:'shows',     ic:'<path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>'},
  {l:'New Arrivals', t:'sec-new',       cat:'new',       ic:'<path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/>'},
  {l:'VIP Club',     t:'sec-vip',                        ic:'<path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>'},
  {l:'All Bets',     t:'sec-bets',                       ic:'<path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>'},
  {l:'Transactions', t:'',                               ic:'<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>'},
];
const _IC_SUPPORT='<path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/>';
const _IC_LANG='<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"/>';
function _ic(paths){
  if(paths.startsWith('<img')) return `<span class="it">${paths}</span>`;
  return `<span class="it"><svg viewBox="0 0 24 24" fill="currentColor">${paths}</svg></span>`;
}
document.getElementById('railNav').innerHTML = railItems.map((r,i)=>`
  <a href="#${r.t}" data-target="${r.t}" ${r.cat?`data-cat="${r.cat}"`:''} title="${r.l}" class="${i===0?'active':''}">
    ${_ic(r.ic)}<span class="lbl">${r.l}</span></a>
  ${i===2||i===5?'<span class="sep"></span>':''}
`).join('')+`
  <div class="rail-foot">
    <span class="sep"></span>
    <button class="auth-in" id="giftBtn" title="Daily Bonus">
      <span class="it" style="position:relative"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="24" height="24"><rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 8v13"/><path d="M12 8c-4.5 0-5.5-2-5.5-3.2C6.5 3.7 7.4 3 8.5 3c2.2 0 3.5 2.5 3.5 5Zm0 0c4.5 0 5.5-2 5.5-3.2C17.5 3.7 16.6 3 15.5 3 13.3 3 12 5.5 12 8Z"/></svg><i class="dot" id="giftDot" hidden></i></span>
      <span class="lbl">Daily Bonus</span>
    </button>
    <a href="#" id="railChat" title="Live support">
      ${_ic(_IC_SUPPORT)}<span class="lbl">Support</span></a>
    <span class="rail-lang" id="railLang">
      <a href="#" id="langBtn" title="Language" aria-haspopup="true">
        ${_ic(_IC_LANG)}<span class="lbl" id="langLbl">English</span></a>
      <div class="hdr-menu lang-menu" id="langMenu"></div>
    </span>
  </div>
  <div class="spine"><i id="spineFill"></i></div>`;
/* inject shared sliding pill indicator */
{const p=document.createElement('div');p.id='railPill';p.className='rail-pill';document.getElementById('railNav').prepend(p);}
const _rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
function movePill(a,instant){
  const pill=document.getElementById('railPill');
  if(!pill||!a)return;
  pill.style.left=a.offsetLeft+'px';
  pill.style.width=a.offsetWidth+'px';
  pill.style.height=a.offsetHeight+'px';
  if(instant){pill.style.transition='none';pill.style.top=a.offsetTop+'px';pill.offsetHeight;pill.style.transition='';return;}
  pill.style.top=a.offsetTop+'px';
  if(!_rm)pill.animate([{transform:'scaleY(1)'},{transform:'scaleY(1.13)',offset:.42},{transform:'scaleY(1)'}],{duration:240,easing:'ease-in-out'});
}

/* ---------- rail collapse toggle ---------- */
const LS_RAIL='volt-rail';
const railToggle=document.getElementById('railToggle');
const provRowEl=document.getElementById('provRow');
function setRailMin(min){
  document.body.classList.toggle('rail-min',min);
  localStorage.setItem(LS_RAIL,min?'min':'full');
  railToggle.setAttribute('aria-expanded',!min);
  /* re-fit tiles once the rail width transition lands */
  setTimeout(()=>{sizeTiles();updateFades();movePill(document.querySelector('#railNav a.active'),true);syncAllRowArrows();syncProvArrows();},230);
}
const storedRail=localStorage.getItem(LS_RAIL);
setRailMin(storedRail?storedRail==='min':window.innerWidth<1100);
railToggle.addEventListener('click',()=>setRailMin(!document.body.classList.contains('rail-min')));

/* ---------- rail scrollspy + category wiring ---------- */
const railLinks = [...document.querySelectorAll('#railNav a[data-target]')];
railLinks.forEach(a=>{
  a.addEventListener('click',e=>{
    e.preventDefault();
    if(a.title==='Transactions'){txnOverlay.classList.add('open');loadTxnPage(true);return;}
    if(document.body.classList.contains('ingame')&&window.closeGame)closeGame();
    const cat=a.dataset.cat;
    if(cat){
      /* mirror the category chip so rail and pill bar never disagree */
      if(activeCat!==cat){
        const chip=catsEl.querySelector(`.cat[data-cat="${cat}"]`);
        if(chip)chip.click();
      }
      if(cat==='lobby')window.scrollTo({top:0,behavior:'smooth'});
      else window.scrollTo({top:catsEl.getBoundingClientRect().top+window.scrollY-86,behavior:'smooth'});
    }else{
      /* section-only items live in the lobby view — reset any filter first */
      if(activeCat!=='lobby'){
        const chip=catsEl.querySelector('.cat[data-cat="lobby"]');
        if(chip)chip.click();
      }
      const el=document.getElementById(a.dataset.target);
      if(el)window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-86,behavior:'smooth'});
    }
    movePill(a);
  });
});
let spyTick=false;
const spineFill=document.getElementById('spineFill');
function spy(){
  spyTick=false;
  if(document.body.classList.contains('ingame'))return;
  const y=window.scrollY+150;
  let current=railLinks[0];
  for(const a of railLinks){
    const el=document.getElementById(a.dataset.target);
    if(el && el.getClientRects().length && el.getBoundingClientRect().top + window.scrollY <= y) current=a;
  }
  railLinks.forEach(a=>a.classList.toggle('active',a===current));
  movePill(current);
  const max=document.documentElement.scrollHeight-window.innerHeight;
  if(spineFill) spineFill.style.height=(max>0?Math.min(100,window.scrollY/max*100):0)+'%';
}
window.addEventListener('scroll',()=>{if(!spyTick){spyTick=true;requestAnimationFrame(spy);}},{passive:true});
spy();
movePill(document.querySelector('#railNav a.active'),true);

/* ---------- categories ---------- */
/* ic is inner-SVG markup; shapes tagged .fl get a solid fill while the chip is active */
const cats = [
  {l:'Lobby', key:'lobby', cnt:3214, active:true, ic:'<path class="fl" d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5Z"/><path d="M9.5 21v-5.5h5V21"/>'},
  {l:'Originals', key:'originals', cnt:24, rows:['originals'], ic:'<path class="fl" d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>'},
  {l:'Slots', key:'slots', cnt:2418, rows:['slots','hot'], ic:'<path d="M7.2 12.5C7.6 8.5 9.8 5.2 13.5 3.5"/><path d="M16.6 12.8c-1.2-3.3-1.7-6.4-3.1-9.3"/><path d="M13.5 3.5c1.6-.6 3.3-.7 4.9-.2-1 1.3-2.6 2-4.4 2.1"/><circle class="fl" cx="7" cy="15.8" r="3.4"/><circle class="fl" cx="16.2" cy="16.4" r="3.4"/>'},
  {l:'Live Casino', key:'live', cnt:312, rows:['live'], ic:'<circle cx="12" cy="12" r="8.5"/><circle class="fl" cx="12" cy="12" r="2.6"/><path d="M12 3.5v6M12 14.6v5.9M3.5 12h6M14.6 12h5.9M6.2 6.2l4 4M13.8 13.8l4 4"/>'},
  {l:'Game Shows', key:'shows', cnt:38, rows:['shows'], ic:'<circle cx="12" cy="13.5" r="7.3"/><path d="M12 6.2v7.3M5.9 10.1l6.1 3.4M18.1 10.1 12 13.5M8.6 19.9 12 13.5M15.4 19.9 12 13.5"/><path class="fl" d="M9.8 2h4.4L12 5.4 9.8 2Z"/>'},
  {l:'Table Games', key:'table', cnt:146, match:'baccarat|blackjack|roulette|board bonanza', ic:'<path class="fl" d="M12 2.5 18.5 12 12 21.5 5.5 12 12 2.5Z"/>'},
  {l:'New Arrivals', key:'new', cnt:89, rows:['new'], ic:'<path class="fl" d="M11 4l1.6 5.4L18 11l-5.4 1.6L11 18l-1.6-5.4L4 11l5.4-1.6L11 4Z"/><path d="M18.5 16.5v4M16.5 18.5h4"/>'},
];
document.getElementById('cats').innerHTML = cats.map(c=>`
  <div class="cat ${c.active?'active':''}" data-cat="${c.key}" role="button" tabindex="0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${c.ic}</svg>${c.l}<span class="cnt">${c.cnt.toLocaleString('en-US')}</span></div>
`).join('');

/* ---------- game rows ---------- */
const ROWS = [
  {key:'originals', title:'Volt Originals', icon:'M12 3l2.5 6H21l-5 4 2 7-6-4.5L6 20l2-7-5-4h6.5L12 3Z', games:[
    {n:'Dice',      p:'Volt Originals', g:['#1e9ad6','#41cdf0']},
    {n:'Mines',     p:'Volt Originals', g:['#c93a2e','#f0763d'], corner:'New'},
    {n:'Plinko',    p:'Volt Originals', g:['#11936b','#2ec98f']},
    {n:'Crash',     p:'Volt Originals', g:['#c92356','#f05a8a'], corner:'New'},
    {n:'Blackjack', p:'Volt Originals', g:['#16365c','#2356c9'], corner:'New'},
    {n:'Keno',      p:'Volt Originals', g:['#5a2ea6','#9a3df0']},
    {n:'Limbo',     p:'Volt Originals', g:['#a63aba','#e052b8']},
    {n:'Baccarat',  p:'Volt Originals', g:['#d4452e','#f0763d']},
    {n:'Roulette',  p:'Volt Originals', g:['#1a6a2e','#2dbd54'], corner:'New'},
    {n:'Coinflip',  p:'Volt Originals', g:['#8a6d1c','#d4af37'], corner:'New'},
  ]},
  {key:'slots', title:'Slots', icon:'M5 4h14v16H5zM9 4v16M15 4v16', img:'images/slots-777.png', games:[
    {n:'Sin City',       p:'TaDa Gaming',    g:['#2b1660','#e052b8'], corner:'New', demo:'https://tadagaming.com/PlusTrial/171/en-us'},
    {n:'Berry Rush',     p:'Pragmatic Play', g:['#1c7d4b','#52c66e'], boost:'Boosted RTP 97.9%', demo:'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=USD&gameid=vs20fruitsweets'},
    {n:'Eternal Clash',  p:'Pragmatic Play', g:['#16365c','#3a6db0'], demo:'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=USD&gameid=vs20olympgate'},
    {n:'Duck Hunters',   p:'Pragmatic Play', g:['#7d1c28','#c63a44'], corner:'Hot', demo:'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=USD&gameid=vs20doghouse'},
    {n:'Wanted Outlaws', p:'Pragmatic Play', g:['#7d4a16','#c68b3a'], demo:'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=USD&gameid=vs25wolfgold'},
    {n:'Fisherman Le',   p:'Pragmatic Play', g:['#14716b','#2eb0a6'], demo:'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=USD&gameid=vs10fishin'},
    {n:'Sugar Merge',    p:'Pragmatic Play', g:['#8a2a8a','#d052d0'], boost:'Boosted RTP 97.1%', demo:'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=USD&gameid=vs20sugarrush'},
  ]},
  {key:'hot', title:'Hot Picks', icon:'M12 2c2 4-3 5-1 9 1.5 3-1 4-2 4 4 3 10 1 10-4 0-4-4-5-3-9-2 1-3 2-4 0Z', games:[
    {n:'Mortal Bromance', p:'Pragmatic Play', g:['#202736','#4a5670'], corner:'Hot', demo:'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=USD&gameid=vs20starlight'},
    {n:'Clash of Gods',   p:'Pragmatic Play', g:['#5a2ea6','#e0529a'], demo:'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=USD&gameid=vs20olympgate'},
    {n:'Jelly Express',   p:'Pragmatic Play', g:['#d052a0','#f07bc0'], boost:'Boosted RTP 97.0%', demo:'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=USD&gameid=vs20fruitparty'},
    {n:'Lucky Streak 3',  p:'Pragmatic Play', g:['#8a1c1c','#d04a2e'], corner:'77', demo:'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=USD&gameid=vs5jokersjewels'},
    {n:'Sugar Merge Up',  p:'Pragmatic Play', g:['#7b2ad6','#b052f0'], demo:'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=USD&gameid=vs20sugarrush'},
    {n:'Penalty Duel',    p:'Pragmatic Play', g:['#168a4a','#3ac670'], demo:'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?lang=en&cur=USD&gameid=vs25mustang'},
  ]},
  {key:'live', title:'Live Casino', icon:'M2 8h20v8H2zM6 8v8M18 8v8', dealer:true, games:[
    {n:'Board Bonanza',  p:'Live Studio', g:['#c98b2e','#f0c05a']},
    {n:'Olympus Roulette', p:'Live Studio',  g:['#9a4ad6','#d07bf0']},
    {n:'Blackjack',       p:'Live Studio',  g:['#16365c','#2356c9']},
    {n:'Roulette',        p:'Live Studio',  g:['#7d1c28','#c63a44']},
    {n:'Blackjack VIP',   p:'Live Studio',  g:['#3a3f4d','#5d6478']},
  ]},
  {key:'shows', title:'Game Shows', icon:'M4 7h16v10H4zM8 21h8M12 17v4', dealer:true, games:[
    {n:'Crazy Hour',        p:'Live Studio', g:['#d6451e','#f0a03d']},
    {n:'Money Minute',      p:'Live Studio', g:['#8aa61e','#c6d63a']},
    {n:'Lightning Wheel',   p:'Live Studio', g:['#5a2ea6','#9a3df0']},
    {n:'Storm Roulette',    p:'Live Studio', g:['#2356c9','#41cdf0']},
    {n:'Mega Spin',         p:'Live Studio', g:['#c92356','#f05a8a']},
  ]},
  {key:'new', title:'New Arrivals', icon:'M12 2v6M12 16v6M2 12h6M16 12h6', games:[
    {n:'Plinko of Mine',  p:'TaDa Gaming', g:['#8a4a0e','#f0931a'], corner:'New', demo:'https://tadagaming.com/PlusTrial/551/en-us'},
    {n:'Tank Brigade 3',  p:'Zenith City', g:['#5c1631','#a62e5a'], corner:'New'},
    {n:'Le Hooligan',     p:'Sawtooth', g:['#1e6ad6','#52a0f0']},
    {n:'Joker Returns',   p:'Volt Picks',    g:['#7d1c8a','#c63ad0']},
    {n:'Fortune Bankers', p:'Encore',        g:['#9a6b1e','#d6a93a'], corner:'Early'},
    {n:'Raid Marauder',   p:'Ace Roll',      g:['#8a4a16','#d0823a'], corner:'Early'},
  ]},
];

const slugify=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-');
/* tile art lives in art/*.webp (extracted from the image-slot sidecar so the page
   doesn't fetch one huge base64 JSON); a fresh drop on a slot still overrides src */
const ART=new Set(['originals-dice','originals-plinko','originals-keno','originals-limbo',
  'originals-baccarat','originals-coinflip','slots-sin-city','slots-berry-rush',
  'slots-eternal-clash','slots-duck-hunters','slots-wanted-outlaws','slots-fisherman-le',
  'slots-sugar-merge','new-plinko-of-mine']);
const EXT_ART={
  'originals-crash':    'art/art-originals-crash.svg',
  'originals-mines':    'art/art-originals-mines.svg',
  'originals-blackjack':'art/art-originals-blackjack.svg',
};
const GAME_ART_LS=(()=>{try{return JSON.parse(localStorage.getItem('volt-game-art')||'{}');}catch{return{};}})();
document.getElementById('rows').innerHTML = ROWS.map(row=>`
  <div class="row" id="sec-${row.key}">
    <div class="row-head">
      <span class="ic">${row.img?`<img src="${row.img}" style="width:22px;height:22px;object-fit:contain;filter:drop-shadow(0 1px 3px rgba(0,0,0,.4))">`:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="${row.icon}"/></svg>`}</span>
      <h2>${row.title}</h2>
      <div class="row-nav">
        <button class="rbtn" data-scroll="${row.key}" data-dir="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m15 6-6 6 6 6"/></svg></button>
        <button class="rbtn" data-scroll="${row.key}" data-dir="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 6 6 6-6 6"/></svg></button>
      </div>
    </div>
    <div class="row-track" id="track-${row.key}">
      ${row.games.map(g=>{const slug=row.key+'-'+slugify(g.n);return`
        <div class="gtile" data-slug="${slug}">
          <div class="gcover ${row.dealer?'dealer':''}" style="background:linear-gradient(160deg,${g.g[0]},${g.g[1]})">
            <image-slot id="art-${slug}"${(()=>{const s=GAME_ART_LS[slug]||(ART.has(slug)?`art/art-${slug}.webp`:EXT_ART[slug]||'');return s?` src="${s}"`:'';})()} shape="rect" fit="cover" placeholder="Drop game art"></image-slot>
            <span class="prov">${g.p}</span>
            ${row.dealer?'<span class="silh"></span><span class="livechip"><i></i>Live</span>':''}
            <span class="nm">${g.n}</span>
            ${g.corner?`<span class="corner${g.corner==='Hot'?' hot':''}">${g.corner}</span>`:''}
            ${g.boost?`<span class="boost">⚡ ${g.boost}</span>`:''}
            <div class="gc-ov"><div class="gc-ov-ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7-11-7Z"/></svg></div><span class="gc-ov-lbl">Play Now</span></div>
          </div>
          <div class="under"><b>${g.n}</b>${g.boost?'<span class="rtp">RTP+</span>':''}</div>
        </div>`;}).join('')}
    </div>
  </div>
`).join('');

/* row scrolling — arrows page by one full set of tiles, disabled at limits */
function syncRowArrows(track){
  if(!track)return;
  const atStart=track.scrollLeft<=1;
  const atEnd=track.scrollLeft>=track.scrollWidth-track.clientWidth-1;
  const key=track.id.replace('track-','');
  document.querySelectorAll(`[data-scroll="${key}"]`).forEach(b=>{
    b.disabled=(+b.dataset.dir<0&&atStart)||(+b.dataset.dir>0&&atEnd);
  });
}
function syncAllRowArrows(){
  document.querySelectorAll('.row-track').forEach(syncRowArrows);
}
document.querySelectorAll('[data-scroll]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const track=document.getElementById('track-'+btn.dataset.scroll);
    track.scrollBy({left:(+btn.dataset.dir)*track.clientWidth,behavior:'smooth'});
  });
});
document.querySelectorAll('.row-track').forEach(t=>{
  t.addEventListener('scroll',()=>syncRowArrows(t),{passive:true});
});
/* ---------- fluid tile sizing: a whole number of tiles always fits ---------- */
function sizeTiles(){
  const gap=14;
  const t=document.querySelector('.row-track');
  if(t){
    const w=t.clientWidth-4;
    document.documentElement.style.setProperty('--tiles',Math.max(2,Math.floor((w+gap)/(170+gap))));
  }
  const p=document.getElementById('provRow');
  if(p){
    const w=p.clientWidth-4;
    document.documentElement.style.setProperty('--ptiles',Math.max(2,Math.floor((w+gap)/(185+gap))));
  }
}
sizeTiles();
syncAllRowArrows();

/* ---------- scroll-edge fades (chip bar only — tiles fit exactly) ---------- */
const _fadeUpds=[];
function wireFade(el){
  const upd=()=>{
    const max=el.scrollWidth-el.clientWidth;
    el.classList.toggle('fade-l',el.scrollLeft>4);
    el.classList.toggle('fade-r',el.scrollLeft<max-4);
  };
  el.addEventListener('scroll',upd,{passive:true});
  _fadeUpds.push(upd);
  upd();
}
function updateFades(){_fadeUpds.forEach(f=>f());}
document.querySelectorAll('.cats').forEach(wireFade);
window.addEventListener('resize',()=>{sizeTiles();updateFades();syncAllRowArrows();syncProvArrows();});

/* ---------- category + search filtering ---------- */
const catsEl=document.getElementById('cats'),
      searchEl=document.getElementById('gameSearch'),
      filterEmpty=document.getElementById('filterEmpty'),
      provSection=document.getElementById('provSection'),
      betsSection=document.getElementById('sec-bets');
let activeCat='lobby',activeProv=null;
const activeFlags=new Set();
const GAME_BY_SLUG={};
ROWS.forEach(r=>r.games.forEach(g=>{GAME_BY_SLUG[r.key+'-'+slugify(g.n)]=Object.assign({live:!!r.dealer},g);}));
const TILE_META=[];
document.querySelectorAll('#rows .row').forEach(rowEl=>{
  const rowKey=rowEl.id.replace('sec-','');
  rowEl.querySelectorAll('.gtile').forEach((tile,i)=>{
    const g=GAME_BY_SLUG[tile.dataset.slug]||{};
    TILE_META.push({tile,rowEl,rowKey,ord:i,
      name:(tile.querySelector('.under b')||{}).textContent||'',
      boost:!!tile.querySelector('.boost'),
      prov:g.p||'',isNew:g.corner==='New',live:!!g.live,demo:!!g.demo});
  });
});
function applyFilter(){
  const q=(searchEl.value||'').trim().toLowerCase();
  const cat=cats.find(c=>c.key===activeCat)||cats[0];
  const isLobby=cat.key==='lobby'&&!q&&!activeProv&&!activeFlags.size;
  const matchRe=cat.match?new RegExp(cat.match,'i'):null;
  const rowVisible={};
  TILE_META.forEach(m=>{
    let ok=true;
    if(cat.rows)ok=cat.rows.includes(m.rowKey);
    else if(matchRe)ok=matchRe.test(m.name);
    else if(cat.boost)ok=m.boost;
    if(ok&&q)ok=m.name.toLowerCase().includes(q);
    if(ok&&activeProv)ok=m.prov===activeProv;
    if(ok)for(const f of activeFlags){
      if(f==='boost'&&!m.boost||f==='new'&&!m.isNew||f==='live'&&!m.live||f==='demo'&&!m.demo){ok=false;break;}
    }
    m.tile.style.display=ok?'':'none';
    if(ok)rowVisible[m.rowKey]=true;
  });
  let any=false;
  document.querySelectorAll('#rows .row').forEach(rowEl=>{
    const vis=!!rowVisible[rowEl.id.replace('sec-','')];
    rowEl.style.display=vis?'':'none';
    if(vis)any=true;
  });
  filterEmpty.hidden=any;
  /* keep the provider row reachable while a provider filter is active */
  provSection.style.display=(cat.key==='lobby'&&!q)?'':'none';
  const vipSec=document.getElementById('sec-vip');
  if(vipSec)vipSec.style.display=isLobby?'':'none';
  betsSection.style.display=isLobby?'':'none';
  spy();
  updateFades();
}
catsEl.addEventListener('click',e=>{
  const c=e.target.closest('.cat');if(!c)return;
  activeCat=c.dataset.cat;
  catsEl.querySelectorAll('.cat').forEach(x=>x.classList.toggle('active',x===c));
  applyFilter();
});
catsEl.addEventListener('keydown',e=>{
  if(e.key==='Enter'||e.key===' '){
    const c=e.target.closest('.cat');
    if(c){e.preventDefault();c.click();}
  }
});
searchEl.addEventListener('input',applyFilter);

/* ---------- sort + filter pills ---------- */
const sortWrap=document.getElementById('sortWrap'),sortPill=document.getElementById('sortPill'),
      sortMenu=document.getElementById('sortMenu'),sortVal=document.getElementById('sortVal'),
      filterWrap=document.getElementById('filterWrap'),filterPill=document.getElementById('filterPill'),
      filterMenu=document.getElementById('filterMenu'),filterVal=document.getElementById('filterVal');
let activeSort='featured';
const SORTS=[['featured','Featured'],['az','Name A–Z'],['za','Name Z–A'],['boost','Boosted first']];
const FILTERS=[['boost','⚡ Boosted RTP'],['new','✨ New releases'],['live','🔴 Live games'],['demo','🎮 Free play demo']];
const TICK_SVG='<svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5 10-11"></path></svg>';
function renderSortMenu(){
  sortMenu.innerHTML='<div class="mlbl">Sort by</div>'+SORTS.map(([k,l])=>`
    <button class="wmi ${k===activeSort?'sel':''}" data-k="${k}"><span class="wnm">${l}</span>${TICK_SVG}</button>`).join('');
  sortVal.textContent=activeSort==='featured'?'':SORTS.find(s=>s[0]===activeSort)[1];
}
function renderFilterMenu(){
  filterMenu.innerHTML='<div class="mlbl">Show only</div>'+FILTERS.map(([k,l])=>`
    <button class="wmi ${activeFlags.has(k)?'sel':''}" data-k="${k}"><span class="wnm">${l}</span>${TICK_SVG}</button>`).join('')
    +(activeFlags.size?'<button class="wmi" data-k=""><span class="wnm" style="color:var(--muted)">Clear filters</span></button>':'');
  filterVal.textContent=activeFlags.size?String(activeFlags.size):'';
}
function applySort(){
  document.querySelectorAll('#rows .row-track').forEach(track=>{
    TILE_META.filter(m=>m.tile.parentElement===track).sort((a,b)=>{
      if(activeSort==='az')return a.name.localeCompare(b.name);
      if(activeSort==='za')return b.name.localeCompare(a.name);
      if(activeSort==='boost')return (b.boost?1:0)-(a.boost?1:0)||a.ord-b.ord;
      return a.ord-b.ord;
    }).forEach(m=>track.appendChild(m.tile));
  });
}
sortPill.addEventListener('click',e=>{
  e.stopPropagation();
  filterWrap.classList.remove('open');walletEl.classList.remove('open');avatarWrap.classList.remove('open');
  sortWrap.classList.toggle('open');
});
sortMenu.addEventListener('click',e=>{
  const b=e.target.closest('.wmi');if(!b)return;
  e.stopPropagation();
  activeSort=b.dataset.k;
  renderSortMenu();applySort();
  sortWrap.classList.remove('open');
});
filterPill.addEventListener('click',e=>{
  e.stopPropagation();
  sortWrap.classList.remove('open');walletEl.classList.remove('open');avatarWrap.classList.remove('open');
  filterWrap.classList.toggle('open');
});
filterMenu.addEventListener('click',e=>{
  const b=e.target.closest('.wmi');if(!b)return;
  e.stopPropagation();
  const k=b.dataset.k;
  if(!k)activeFlags.clear();
  else activeFlags.has(k)?activeFlags.delete(k):activeFlags.add(k);
  renderFilterMenu();applyFilter();
});
[sortPill,filterPill].forEach(p=>p.addEventListener('keydown',e=>{
  if(e.key==='Enter'||e.key===' '){e.preventDefault();p.click();}
}));
renderSortMenu();renderFilterMenu();

/* ---------- promo banner: new releases ---------- */
document.getElementById('promoNew')?.addEventListener('click',()=>{
  const chip=catsEl.querySelector('.cat[data-cat="new"]');
  if(chip&&activeCat!=='new')chip.click();
  window.scrollTo({top:catsEl.getBoundingClientRect().top+window.scrollY-86,behavior:'smooth'});
});
document.getElementById('promoNew')?.addEventListener('keydown',e=>{
  if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.click();}
});

/* ---------- providers ---------- */
const provs=['Volt Originals','Pragmatic Play','TaDa Gaming','Live Studio','Sawtooth','Zenith City','Encore','Ace Roll','Volt Picks'];
provRowEl.innerHTML = provs.map(p=>`<div class="prov-card" data-p="${p}" role="button" tabindex="0">${p}</div>`).join('');
provRowEl.addEventListener('click',e=>{
  const c=e.target.closest('.prov-card');if(!c)return;
  activeProv=activeProv===c.dataset.p?null:c.dataset.p;
  provRowEl.querySelectorAll('.prov-card').forEach(x=>x.classList.toggle('active',x.dataset.p===activeProv));
  applyFilter();
  if(activeProv){
    const rowsEl=document.getElementById('rows');
    window.scrollTo({top:rowsEl.getBoundingClientRect().top+window.scrollY-150,behavior:'smooth'});
  }
});
provRowEl.addEventListener('keydown',e=>{
  if(e.key==='Enter'||e.key===' '){
    const c=e.target.closest('.prov-card');
    if(c){e.preventDefault();c.click();}
  }
});
const _pBtns=[...document.querySelectorAll('[data-pscroll]')];
function syncProvArrows(){
  const atStart=provRowEl.scrollLeft<=1;
  const atEnd=provRowEl.scrollLeft>=provRowEl.scrollWidth-provRowEl.clientWidth-1;
  _pBtns.forEach(b=>{b.disabled=(+b.dataset.pscroll<0&&atStart)||(+b.dataset.pscroll>0&&atEnd);});
}
_pBtns.forEach(btn=>{
  btn.addEventListener('click',()=>{
    provRowEl.scrollBy({left:(+btn.dataset.pscroll)*provRowEl.clientWidth,behavior:'smooth'});
  });
});
provRowEl.addEventListener('scroll',syncProvArrows,{passive:true});
syncProvArrows();

/* ---------- bets table ---------- */
const bplayers=['Hidden','Volty_88','Nina_X','Hidden','Krakn','Joules','Hidden','Mx_Turbo','Hidden','Ohmies'];
const ballgames=['Berry Rush','Limbo','Plinko','Crazy Hour','Blackjack','Dice','Jelly Express','Storm Roulette','Keno','Coinflip'];
function rnd(a,b){return Math.random()*(b-a)+a}
function makeBetRow(){
  const bet=rnd(0.5,800),mult=Math.random()<0.55?0:rnd(1.01,80);
  return{game:ballgames[Math.floor(rnd(0,ballgames.length))],
         player:bplayers[Math.floor(rnd(0,bplayers.length))],
         bet,mult,win:mult>0};
}
function betRowHtml(r){
  return`<tr>
    <td class="g">${r.game}</td>
    <td class="u">${r.player}</td>
    <td>$${r.bet.toFixed(2)}</td>
    <td class="mult">${r.mult>0?r.mult.toFixed(2)+'×':'—'}</td>
    <td class="${r.win?'win':'lose'}">${r.win?'+$'+(r.bet*(r.mult-1)).toFixed(2):'-$'+r.bet.toFixed(2)}</td>
  </tr>`;
}
const BET_POOL=[];
const MAX_POOL=60;
for(let i=0;i<MAX_POOL;i++)BET_POOL.push(makeBetRow());
const BET_TAB_KEYS=['all','high','races','lucky'];
let activeBetTab='all';
function filterBets(tab){
  switch(tab){
    case'high':return BET_POOL.filter(r=>r.bet>=200);
    case'races':return BET_POOL.filter(r=>r.win&&r.mult>=5).sort((a,b)=>b.mult-a.mult);
    case'lucky':return BET_POOL.filter(r=>r.win).sort((a,b)=>b.mult-a.mult);
    default:return BET_POOL;
  }
}
const betBody=document.getElementById('betBody');
function renderBets(){
  betBody.innerHTML=filterBets(activeBetTab).slice(0,8).map(betRowHtml).join('');
}
renderBets();
setInterval(()=>{
  BET_POOL.unshift(makeBetRow());
  if(BET_POOL.length>MAX_POOL)BET_POOL.pop();
  renderBets();
},2600);

/* ---------- header search overlay ---------- */
const searchOverlay=document.getElementById('searchOverlay');
const srchInput=document.getElementById('srchInput');
const srchGrid=document.getElementById('srchGrid');
const srchCount=document.getElementById('srchCount');

function openSearch(){
  searchOverlay.classList.add('open');
  srchInput.value='';
  renderSearch('');
  setTimeout(()=>srchInput.focus(),40);
}
function closeSearch(){
  searchOverlay.classList.remove('open');
}
document.getElementById('srchClose').addEventListener('click',closeSearch);
searchOverlay.addEventListener('click',e=>{if(e.target===searchOverlay)closeSearch();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&searchOverlay.classList.contains('open')){closeSearch();e.stopPropagation();}
},true);
srchInput.addEventListener('input',()=>renderSearch(srchInput.value.trim().toLowerCase()));

function srchCardHTML(slug,name,prov,gradColors){
  const g=gradColors||(GAME_BY_SLUG[slug]&&GAME_BY_SLUG[slug].g)||['#1a2236','#2a3447'];
  const playing=Math.floor(Math.random()*380)+2;
  return`<div class="srch-card" data-slug="${slug}" style="background:linear-gradient(160deg,${g[0]},${g[1]})" role="button" tabindex="0">
    <div class="srch-card-body"><b>${name}</b><span>${prov}</span><em>${playing} playing</em></div>
  </div>`;
}

function renderSearch(q){
  const MAX=48;
  if(q){
    const results=TILE_META.filter(m=>m.name.toLowerCase().includes(q)||m.prov.toLowerCase().includes(q)).slice(0,MAX);
    srchCount.textContent=results.length?results.length+' result'+(results.length===1?'':'s'):'';
    if(!results.length){srchGrid.innerHTML=`<p class="srch-empty">No games found for "<b>${q}</b>"</p>`;return;}
    srchGrid.innerHTML=`<div class="srch-flat">${results.map(m=>srchCardHTML(m.tile.dataset.slug,m.name,m.prov)).join('')}</div>`;
  }else{
    srchCount.textContent='';
    srchGrid.innerHTML=ROWS.map(row=>`
      <div class="srch-section">
        <div class="srch-sec-head">${row.img?`<img src="${row.img}" style="width:18px;height:18px;object-fit:contain">`:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="${row.icon}"/></svg>`}<span>${row.title}</span></div>
        <div class="srch-row">${row.games.map(g=>srchCardHTML(row.key+'-'+slugify(g.n),g.n,g.p,g.g)).join('')}</div>
      </div>`).join('');
  }
  srchGrid.querySelectorAll('[data-slug]').forEach(t=>{
    t.addEventListener('click',()=>{closeSearch();openGame(t.dataset.slug);});
    t.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();closeSearch();openGame(t.dataset.slug);}});
  });
}

/* bet tabs */
document.getElementById('betTabs').addEventListener('click',e=>{
  const t=e.target.closest('.btab');if(!t)return;
  document.querySelectorAll('.btab').forEach((x,i)=>{
    x.classList.toggle('active',x===t);
    if(x===t)activeBetTab=BET_TAB_KEYS[i]||'all';
  });
  renderBets();
});
