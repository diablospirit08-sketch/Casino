/* --- dice --- */
(function(){

/* ── Web Audio sound system ── */
var _dAc=null;
function _getAc(){
  if(!_dAc||_dAc.state==='closed')
    _dAc=new(window.AudioContext||window.webkitAudioContext)();
  if(_dAc.state==='suspended')_dAc.resume();
  return _dAc;
}
function _noiseBuf(ac,dur){
  var n=Math.ceil(ac.sampleRate*dur),buf=ac.createBuffer(1,n,ac.sampleRate),d=buf.getChannelData(0);
  for(var i=0;i<n;i++)d[i]=Math.random()*2-1;
  var s=ac.createBufferSource();s.buffer=buf;return s;
}
function _sndRattle(){
  try{
    var ac=_getAc(),t=ac.currentTime;
    var ns=_noiseBuf(ac,0.022);
    var f=ac.createBiquadFilter();f.type='bandpass';
    f.frequency.value=450+Math.random()*450;f.Q.value=1.8;
    var g=ac.createGain();
    g.gain.setValueAtTime(0.26,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.022);
    ns.connect(f);f.connect(g);g.connect(ac.destination);ns.start();
  }catch(e){}
}
function _sndWin(){
  try{
    var ac=_getAc();
    /* ascending arpeggio C5→E5→G5→C6→E6 */
    [523,659,784,1047,1319].forEach(function(hz,i){
      var o=ac.createOscillator();o.type='triangle';o.frequency.value=hz;
      var g=ac.createGain(),t=ac.currentTime+i*0.072;
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(0.2,t+0.016);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.32);
      o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+0.36);
    });
    /* sparkle shimmer at the top */
    [2093,2637,3136,4186].forEach(function(hz,i){
      var o=ac.createOscillator();o.type='sine';o.frequency.value=hz;
      var g=ac.createGain(),t=ac.currentTime+0.32+i*0.042;
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(0.09,t+0.01);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.13);
      o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+0.16);
    });
  }catch(e){}
}
function _sndLose(){
  try{
    var ac=_getAc(),t=ac.currentTime;
    /* descending thud */
    var o=ac.createOscillator();o.type='sine';
    o.frequency.setValueAtTime(190,t);
    o.frequency.exponentialRampToValueAtTime(42,t+0.26);
    var g=ac.createGain();
    g.gain.setValueAtTime(0.42,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.29);
    o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+0.32);
    /* low impact noise */
    var ns=_noiseBuf(ac,0.055);
    var f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=160;
    var ng=ac.createGain();
    ng.gain.setValueAtTime(0.32,t);
    ng.gain.exponentialRampToValueAtTime(0.001,t+0.055);
    ns.connect(f);f.connect(ng);ng.connect(ac.destination);ns.start(t);
  }catch(e){}
}

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

  mult(){return 99/this.chance},

  _startSpin(){
    const cube=$id('diCube');if(!cube)return;
    cube.style.transition='none';
    cube.classList.remove('win','lose');
    this._spinX=0;this._spinY=0;
    this._spinTimer=setInterval(()=>{
      this._spinX+=40+Math.random()*65;
      this._spinY+=40+Math.random()*65;
      cube.style.transform=`rotateX(${this._spinX}deg) rotateY(${this._spinY}deg)`;
      _sndRattle();
    },80);
  },

  _stopSpin(win){
    clearInterval(this._spinTimer);this._spinTimer=null;
    const cube=$id('diCube');if(!cube)return;
    const[tx,ty]=FACE_TARGETS[Math.floor(Math.random()*6)];
    /* add 2 full extra rotations so it decelerates dramatically */
    const finalX=Math.round(this._spinX/360)*360+720+tx;
    const finalY=Math.round(this._spinY/360)*360+720+ty;
    requestAnimationFrame(()=>{
      cube.style.transition='transform .75s cubic-bezier(.16,1,.3,1)';
      cube.style.transform=`rotateX(${finalX}deg) rotateY(${finalY}deg)`;
      setTimeout(()=>{
        cube.classList.add(win?'win':'lose');
        if(win){_sndWin();setTimeout(()=>cube.classList.remove('win'),1800);}
        else   {_sndLose();setTimeout(()=>cube.classList.remove('lose'),500);}
      },680);
    });
  },

  mount(){
    this.hist=[];
    engFields.innerHTML=`
      <div class="gv-field"><label>Win Chance <span id="diLbl"></span></label>
        <input type="range" class="eng-range" id="diChance" min="2" max="98" step="1" value="${this.chance}" aria-label="Win chance"/></div>
      <div class="gv-field"><label>Roll Mode</label>
        <div class="auto-segs" id="diMode">
          <button class="auto-seg${this.over?' active':''}" data-v="1">Roll Over</button>
          <button class="auto-seg${this.over?'':' active'}" data-v="0">Roll Under</button>
        </div></div>
      <div class="eng-readout"><span>Payout</span><b id="diPay"></b></div>
      <div class="eng-readout"><span>Profit on Win</span><b id="diProf"></b></div>`;
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
    $id('diMode').addEventListener('click',e=>{
      const b=e.target.closest('.auto-seg');if(!b||b.disabled)return;
      this.over=b.dataset.v==='1';
      $id('diMode').querySelectorAll('.auto-seg').forEach(x=>x.classList.toggle('active',x===b));
      this.sync();
    });
    this.sync();
  },

  sync(){
    if(!$id('diLbl'))return;
    const t=this.over?100-this.chance:this.chance,w=curW(),b=parseFloat(gvBetIn.value)||0;
    $id('diLbl').textContent=this.chance+'% — roll '+(this.over?'over '+t.toFixed(0):'under '+t.toFixed(0));
    $id('diPay').textContent=this.mult().toFixed(2)+'×';
    $id('diProf').textContent=fmtW(w,b*(this.mult()-1))+' '+w.c;
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
    let spinning=true;
    const spinFn=()=>{if(spinning){rollEl.textContent=rnd(0,100).toFixed(2);this._raf=requestAnimationFrame(spinFn);}};
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
    pin.classList.add('show');
    pin.style.left=r+'%';
    pin.querySelector('.dpv').textContent=r.toFixed(0);
    this._stopSpin(win);
    this.hist.push({r,win});
    this.renderHist();
    serverSettleBet(st,win?m:0,res.new_balance);
    this.busy=false;gvBetBtn.disabled=false;
    this.sync();
    if(done)done(win,st.b*(win?m-1:-1));
  },

  unmount(){
    cancelAnimationFrame(this._raf);
    clearInterval(this._spinTimer);this._spinTimer=null;
    this.busy=false;
  }
};

})();
