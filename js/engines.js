/* VOLT — originals engine framework: bet debit/settle helpers, engine mount/unmount.
   Games register themselves on ORIGINALS (js/games/*.js, loaded after this file). */
/* ---------- volt originals engines ---------- */
var ENG=null,ORIGINALS={};
const $id=id=>document.getElementById(id);
const gvStage=$id('gvStage'),engFields=$id('engFields'),gvMultField=$id('gvMultField'),
      gvProfitFieldEl=$id('gvProfitField'),gvHalfBtn=$id('gvHalf'),gvDoubleBtn=$id('gvDouble'),
      autoTabEl=document.querySelectorAll('#gvTabs .gv-tab')[1];
const fmtW=(w,v)=>w.c==='USDT'?v.toFixed(2):(Math.abs(v)>0&&Math.abs(v)<0.001?v.toFixed(6):v.toFixed(4));
/* round DOWN at fmtW's display precision — "Max" must never exceed the true balance */
const floorW=(w,v)=>{const d=w.c==='USDT'?100:(v>0&&v<0.001?1e6:1e4);return Math.floor(v*d)/d;};

function debitBet(){
  if(!document.body.classList.contains('authed')){openAuth('in');return null;}
  const w=curW(),b=Math.min(parseFloat(gvBetIn.value)||0,w.amt);
  if(b<=0)return null;
  w.amt-=b;w.fiat=w.amt*w.rate;renderWallet();
  return{w,b,name:gvName.textContent};
}
function creditTo(w,x){w.amt=Math.max(0,w.amt+x);w.fiat=w.amt*w.rate;renderWallet();}
function _pushBetHist(st,mult){
  if(!window._clientBetHist)window._clientBetHist=[];
  window._clientBetHist.unshift({game:st.name,cur:st.w.c,wager:st.b,mult:mult,profit:st.b*(mult-1),ts:Date.now()});
  if(window._clientBetHist.length>100)window._clientBetHist.length=100;
}
function settleBet(st,mult){
  if(mult>0)creditTo(st.w,st.b*mult);
  const win=mult>1;
  gsession.wag+=st.b*st.w.rate;
  addXp(st.b*st.w.rate);
  if(window.addRakeback)addRakeback(st.b*st.w.rate);
  if(window.pfRecord)pfRecord();
  gsession.prof+=st.b*(mult-1)*st.w.rate;
  if(mult!==1)win?gsession.w++:gsession.l++;
  renderSession();
  pushChip(mult,win);
  if(win)pushFeed('You',st.name,st.b*(mult-1)*st.w.rate,true);
  _pushBetHist(st,mult);
}
function lockBet(on){
  if(!on&&autoRunning)return;
  gvBetIn.disabled=on;gvHalfBtn.disabled=on;gvDoubleBtn.disabled=on;
}
function mountEngine(slug){
  unmountEngine();
  const eng=window.ORIGINALS&&ORIGINALS[slug];
  if(!eng)return;
  ENG=eng;
  gvMultField.hidden=true;gvProfitFieldEl.hidden=true;
  gvIdle.hidden=true;gvResult.hidden=true;
  gvStage.hidden=false;
  autoTabEl.style.display=eng.auto?'':'none';
  if(!eng.auto&&isAutoTab){
    const tabs=document.querySelectorAll('#gvTabs .gv-tab');
    tabs[1].classList.remove('active');tabs[0].classList.add('active');
    isAutoTab=false;autoPanel.hidden=true;
  }
  gvRtp.textContent='RTP '+eng.rtp;
  eng.mount();
  syncBetBtn();
}
function unmountEngine(){
  if(!ENG)return;
  if(ENG.unmount)ENG.unmount();
  ENG=null;
  gvStage.hidden=true;gvStage.innerHTML='';engFields.innerHTML='';
  const snd=$id('gvSndSlot');if(snd)snd.innerHTML='';
  gvMultField.hidden=false;
  gvProfitFieldEl.hidden=isAutoTab;
  autoTabEl.style.display='';
  lockBet(false);
  gvBetBtn.disabled=false;
  syncBetBtn();
}

/* engine readouts follow the bet amount */
gvBetIn.addEventListener('input',()=>{if(ENG&&ENG.sync)ENG.sync();});
gvHalfBtn.addEventListener('click',()=>{if(ENG&&ENG.sync)ENG.sync();});
gvDoubleBtn.addEventListener('click',()=>{if(ENG&&ENG.sync)ENG.sync();});
