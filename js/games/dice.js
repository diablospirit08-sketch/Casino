/* --- dice --- */
(function(){

/* ── audio files ── */
var _snd={roll:new Audio('sounds/dice.game.mp3'),win:null,lose:null};
(function(){var w=new Audio('sounds/win.mp3');w.addEventListener('canplaythrough',function(){_snd.win=w;},{once:true});w.load();
 var l=new Audio('sounds/lose.mp3');l.addEventListener('canplaythrough',function(){_snd.lose=l;},{once:true});l.load();})();
function _sndRollStart(){try{_snd.roll.currentTime=0;_snd.roll.play().catch(function(){});}catch(e){}}
function _sndRollStop(){try{_snd.roll.pause();_snd.roll.currentTime=0;}catch(e){}}
function _sndWin(){try{if(_snd.win){_snd.win.currentTime=0;_snd.win.play().catch(function(){});}}catch(e){}}
function _sndLose(){try{if(_snd.lose){_snd.lose.currentTime=0;_snd.lose.play().catch(function(){});}}catch(e){}}

/* cube face rotations — rotate the cube so each face faces the camera */
const FACE_TARGETS=[
  [0,0],    // 1 front
  [-90,0],  // 2 top
  [0,-90],  // 3 right
  [0,90],   // 4 left
  [90,0],   // 5 bottom
  [0,180],  // 6 back
];

/* dot layouts — 9-cell 3×3 grid, active positions for each face value */
const DOT_POS=[[4],[2,6],[2,4,6],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]];
function makeFace(n){
  const cells=Array(9).fill(0);DOT_POS[n].forEach(i=>cells[i]=1);
  return'<div class="dice-dots">'+cells.map(v=>`<span class="dice-dot${v?'':' hide'}"></span>`).join('')+'</div>';
}

ORIGINALS['originals-dice']={
  rtp:'99%',auto:true,chance:50,over:true,busy:false,_raf:0,
  hist:[],_spinX:0,_spinY:0,_spinTimer:null,
  _baseBet:0,_winStrat:'reset',_winPct:50,_lossStrat:'inc',_lossPct:100,

  mult(){return 99/this.chance},

  _startSpin(){
    const cube=$id('diCube');if(!cube)return;
    cube.style.transition='none';
    cube.classList.remove('win','lose');
    this._spinX=0;this._spinY=0;
    _sndRollStart();
    this._spinTimer=setInterval(()=>{
      this._spinX+=40+Math.random()*65;
      this._spinY+=40+Math.random()*65;
      cube.style.transform=`rotateX(${this._spinX}deg) rotateY(${this._spinY}deg)`;
    },80);
  },

  _stopSpin(win){
    clearInterval(this._spinTimer);this._spinTimer=null;_sndRollStop();
    const cube=$id('diCube');if(!cube)return;
    const[tx,ty]=FACE_TARGETS[Math.floor(Math.random()*6)];
    /* add 2 full extra rotations so it decelerates dramatically */
    const finalX=Math.round(this._spinX/360)*360+720+tx;
    const finalY=Math.round(this._spinY/360)*360+720+ty;
    requestAnimationFrame(()=>{
      cube.style.transition='none';
      cube.style.transform=`rotateX(${finalX}deg) rotateY(${finalY}deg)`;
      setTimeout(()=>{
        cube.classList.add(win?'win':'lose');
        const fill=$id('diFill');
        if(fill){fill.classList.remove('flash-win','flash-lose');void fill.offsetWidth;fill.classList.add(win?'flash-win':'flash-lose');}
        if(win){_sndWin();setTimeout(()=>cube.classList.remove('win'),1800);}
        else   {_sndLose();setTimeout(()=>cube.classList.remove('lose'),500);}
      },0);
    });
  },

  mount(){
    this.hist=[];
    const _tv=this.over?100-this.chance:this.chance;
    engFields.innerHTML=`
      <div class="gv-field"><label>Win Chance <span id="diLbl"></span></label>
        <input type="range" class="eng-range" id="diChance" min="2" max="98" step="1" value="${this.chance}" aria-label="Win chance"/></div>
      <div class="gv-field"><label>Target Number</label>
        <input type="number" class="eng-num" id="diTarget" min="1" max="99" step="0.5" value="${_tv.toFixed(1)}"/></div>
      <div class="gv-field"><label>Roll Mode</label>
        <div class="auto-segs" id="diMode">
          <button class="auto-seg${this.over?' active':''}" data-v="1">Roll Over</button>
          <button class="auto-seg${this.over?'':' active'}" data-v="0">Roll Under</button>
        </div></div>
      <div class="eng-readout"><span>Payout</span><b id="diPay"></b></div>
      <div class="eng-readout"><span>Profit on Win</span><b id="diProf"></b></div>
      <div class="gv-field"><label>On Win</label>
        <div class="strat-row">
          <div class="auto-segs" id="diWinSeg">
            <button class="auto-seg${this._winStrat==='reset'?' active':''}" data-v="reset">Reset</button>
            <button class="auto-seg${this._winStrat==='inc'?' active':''}" data-v="inc">Increase</button>
          </div>
          <input type="number" class="eng-num-sm" id="diWinPct" min="1" max="999" value="${this._winPct}" placeholder="%"/>
        </div></div>
      <div class="gv-field"><label>On Loss</label>
        <div class="strat-row">
          <div class="auto-segs" id="diLossSeg">
            <button class="auto-seg${this._lossStrat==='reset'?' active':''}" data-v="reset">Reset</button>
            <button class="auto-seg${this._lossStrat==='inc'?' active':''}" data-v="inc">Increase</button>
          </div>
          <input type="number" class="eng-num-sm" id="diLossPct" min="1" max="999" value="${this._lossPct}" placeholder="%"/>
        </div></div>`;
    gvStage.innerHTML=`
      <div class="dice-wrap">
        <div class="dice-3d-wrap"><div class="dice-cube" id="diCube">
          <div class="dice-face f">${makeFace(0)}</div>
          <div class="dice-face b">${makeFace(5)}</div>
          <div class="dice-face r">${makeFace(2)}</div>
          <div class="dice-face l">${makeFace(3)}</div>
          <div class="dice-face t">${makeFace(1)}</div>
          <div class="dice-face d">${makeFace(4)}</div>
        </div></div>
        <div class="dice-roll idle" id="diRoll">—</div>
        <div class="dice-arena">
          <div class="dice-pin" id="diPin"><span class="dpv"></span></div>
          <div class="dice-track"><div class="dice-fill" id="diFill"></div></div>
          <div class="dice-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
        </div>
        <div class="dice-hist" id="diHist"></div>
      </div>`;
    $id('diChance').addEventListener('input',()=>{this.chance=+$id('diChance').value;this.sync();});
    $id('diTarget').addEventListener('input',()=>{
      const v=Math.min(99,Math.max(1,parseFloat($id('diTarget').value)||50));
      this.chance=this.over?Math.round(100-v):Math.round(v);
      this.chance=Math.min(98,Math.max(2,this.chance));
      $id('diChance').value=this.chance;this.sync();
    });
    $id('diMode').addEventListener('click',e=>{
      const b=e.target.closest('.auto-seg');if(!b||b.disabled)return;
      this.over=b.dataset.v==='1';
      $id('diMode').querySelectorAll('.auto-seg').forEach(x=>x.classList.toggle('active',x===b));
      this.sync();
    });
    ['Win','Loss'].forEach(k=>{
      $id('di'+k+'Seg').addEventListener('click',e=>{
        const b=e.target.closest('.auto-seg');if(!b||b.disabled)return;
        $id('di'+k+'Seg').querySelectorAll('.auto-seg').forEach(x=>x.classList.toggle('active',x===b));
        this['_'+k.toLowerCase()+'Strat']=b.dataset.v;
      });
    });
    $id('diWinPct').addEventListener('input',()=>{this._winPct=parseFloat($id('diWinPct').value)||50;});
    $id('diLossPct').addEventListener('input',()=>{this._lossPct=parseFloat($id('diLossPct').value)||100;});
    this.sync();
  },

  sync(){
    if(!$id('diLbl'))return;
    const t=this.over?100-this.chance:this.chance,w=curW(),b=parseFloat(gvBetIn.value)||0;
    $id('diLbl').textContent=this.chance+'% — roll '+(this.over?'over '+t.toFixed(0):'under '+t.toFixed(0));
    $id('diPay').textContent=this.mult().toFixed(2)+'×';
    $id('diProf').textContent=fmtW(w,b*(this.mult()-1))+' '+w.c;
    const tEl=$id('diTarget');if(tEl&&document.activeElement!==tEl)tEl.value=t.toFixed(1);
    const f=$id('diFill');
    if(this.over){f.style.left=t+'%';f.style.right='0';}
    else{f.style.left='0';f.style.right=(100-t)+'%';}
  },

  renderHist(){
    const el=$id('diHist');if(!el)return;
    el.innerHTML=this.hist.slice(-15).reverse().map(h=>
      `<div class="dice-chip ${h.win?'win':'lose'}">${h.r.toFixed(0)}</div>`
    ).join('');
  },

  onCur(){this.sync();},
  onBet(){this.roll(null);},
  autoBet(done){this.roll(done);},

  async roll(done){
    if(this.busy){if(done)stopAuto();return;}
    window._sbActive=true;
    const st=debitBet();
    if(!st){window._sbActive=false;if(done)stopAuto();return;}
    this.busy=true;
    if(!autoRunning)gvBetBtn.disabled=true;
    const rollEl=$id('diRoll'),pin=$id('diPin');
    rollEl.className='dice-roll';
    pin.classList.remove('show');
    this._startSpin();
    let spinning=true,_fc=0;
    const spinFn=()=>{if(spinning){if(++_fc%3===0)rollEl.textContent=rnd(0,100).toFixed(2);this._raf=requestAnimationFrame(spinFn);}};
    this._raf=requestAnimationFrame(spinFn);
    creditTo(st.w,st.b);
    let res;
    try{
      res=await placeBet({game:'dice',currency:st.w.c,wager:st.b,params:{chance:this.chance,over:this.over}});
    }catch(err){
      spinning=false;cancelAnimationFrame(this._raf);
      clearInterval(this._spinTimer);this._spinTimer=null;
      window._sbActive=false;this.busy=false;gvBetBtn.disabled=false;
      showToast({icon:'⚠',title:'Bet failed',sub:err.message});
      if(done)stopAuto();
      return;
    }
    spinning=false;cancelAnimationFrame(this._raf);
    window._sbActive=false;
    const{roll:r}=res.gameData,win=res.gameData?.win===true,m=res.multiplier;
    rollEl.textContent=r.toFixed(2);
    rollEl.classList.add(win?'win':'lose');
    rollEl.classList.remove('punch');void rollEl.offsetWidth;rollEl.classList.add('punch');
    pin.classList.remove('show','win','lose');void pin.offsetWidth;
    pin.classList.add('show',win?'win':'lose');
    pin.style.left=r+'%';
    pin.querySelector('.dpv').textContent=r.toFixed(0);
    this._stopSpin(win);
    this.hist.push({r,win});
    this.renderHist();
    serverSettleBet(st,win?m:0,res.new_balance);
    this.busy=false;gvBetBtn.disabled=false;
    this.sync();
    if(autoRunning&&done){
      if(!this._baseBet)this._baseBet=st.b;
      const strat=win?this._winStrat:this._lossStrat;
      const pct=(win?this._winPct:this._lossPct)/100;
      const cur=parseFloat(gvBetIn.value)||st.b;
      const w=curW();
      gvBetIn.value=fmtW(w,Math.min(w.amt,strat==='inc'?cur*(1+pct):this._baseBet));
      if(ENG&&ENG.sync)ENG.sync();
    }
    if(!autoRunning)this._baseBet=0;
    if(done)done(win,st.b*(win?m-1:-1));
  },

  unmount(){
    cancelAnimationFrame(this._raf);
    clearInterval(this._spinTimer);this._spinTimer=null;
    this.busy=false;
  }
};

})();
