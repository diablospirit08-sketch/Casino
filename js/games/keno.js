/* --- keno --- */
ORIGINALS['originals-keno']={
  rtp:'99%',auto:true,N:40,DRAW:10,MAX:10,diff:'medium',picks:new Set(),busy:false,_timers:[],_pend:null,
  TABLES:{
    low:{
      1:[0.7,1.85],
      2:[0,2,3.8],
      3:[0,1.1,1.38,26],
      4:[0,0,2.2,7.9,90],
      5:[0,0,1.5,4.2,13,300],
      6:[0,0,1.1,2,6.2,100,700],
      7:[0,0,1.1,1.6,3.5,15,225,700],
      8:[0,0,1.1,1.5,2,5.5,39,100,800],
      9:[0,0,1.1,1.3,1.7,2.5,7.5,50,250,1000],
      10:[0,0,1.1,1.2,1.3,1.8,3.5,13,50,250,1000],
    },
    medium:{
      1:[0.4,2.75],
      2:[0,1.8,5.1],
      3:[0,0,2.8,50],
      4:[0,0,1.7,10,100],
      5:[0,0,1.4,4,14,390],
      6:[0,0,0,3,9,180,710],
      7:[0,0,0,2,7,30,400,800],
      8:[0,0,0,2,4,11,67,400,900],
      9:[0,0,0,2,2.5,5,15,100,500,1000],
      10:[0,0,0,1.6,2,4,7,26,100,500,1000],
    },
    high:{
      1:[0,3.96],
      2:[0,0,17.1],
      3:[0,0,0,81.5],
      4:[0,0,0,10,259],
      5:[0,0,0,4.5,48,450],
      6:[0,0,0,0,11,350,710],
      7:[0,0,0,0,7,90,400,800],
      8:[0,0,0,0,5,20,270,600,900],
      9:[0,0,0,0,4,11,56,500,800,1000],
      10:[0,0,0,0,3.5,8,13,63,500,800,1000],
    },
  },
  tbl(){return this.TABLES[this.diff][this.picks.size];},
  fmtM(m){return m>=1000?m.toLocaleString('en-US')+'×':m>=100?m.toFixed(1)+'×':m.toFixed(2)+'×';},

  /* tiny synth — same approach (and volt-snd pref) as plinko */
  sndOn:localStorage.getItem('volt-snd')!=='off',
  _ac:null,
  beep(freq,dur,gain,type){
    if(!this.sndOn)return;
    try{
      const c=this._ac||(this._ac=new (window.AudioContext||window.webkitAudioContext)());
      if(c.state==='suspended')c.resume();
      const o=c.createOscillator(),g=c.createGain();
      o.type=type||'sine';o.frequency.value=freq;
      g.gain.setValueAtTime(gain,c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+dur);
      o.connect(g);g.connect(c.destination);
      o.start();o.stop(c.currentTime+dur);
    }catch(e){}
  },
  endSnd(mult){
    if(mult>=10){this.beep(880,0.16,0.07);this.beep(1320,0.22,0.06);}
    else if(mult>1)this.beep(660,0.12,0.06);
    else if(mult>0)this.beep(440,0.08,0.04);
    else this.beep(170,0.16,0.06);
  },

  mount(){
    engFields.innerHTML=`
      <div class="gv-field"><label>Numbers <span id="knLbl"></span></label>
        <div class="auto-segs">
          <button class="auto-seg" id="knRand">Auto Pick</button>
          <button class="auto-seg" id="knClear">Clear</button>
        </div></div>
      <div class="gv-field"><label>Difficulty</label>
        <div class="auto-segs" id="knDiff">
          ${['low','medium','high'].map(d=>`<button class="auto-seg${d===this.diff?' active':''}" data-v="${d}">${d[0].toUpperCase()+d.slice(1)}</button>`).join('')}
        </div></div>
      <div class="eng-readout"><span>Top Payout</span><b id="knTop">—</b></div>`;
    gvStage.innerHTML=`
      <div class="keno-wrap">
        <div class="keno-gwrap">
          <div class="keno-grid" id="knGrid">${Array.from({length:this.N},(_,i)=>`<button class="ktile" data-i="${i+1}" aria-label="Number ${i+1}">${i+1}</button>`).join('')}</div>
          <div class="keno-pop" id="knPop" hidden><b id="knPopM"></b><span id="knPopP"></span></div>
        </div>
        <div class="keno-pays" id="knPays"></div>
      </div>`;
    $id('gvSndSlot').innerHTML=`<button class="pl-snd" id="knSnd" aria-label="Toggle sound">${this.sndOn?'🔊':'🔇'}</button>`;
    $id('knGrid').addEventListener('click',e=>{
      const t=e.target.closest('.ktile');if(t)this.toggle(t);
    });
    $id('knDiff').addEventListener('click',e=>{
      const b=e.target.closest('.auto-seg');if(!b||b.disabled||this.busy||autoRunning)return;
      this.diff=b.dataset.v;
      $id('knDiff').querySelectorAll('.auto-seg').forEach(x=>x.classList.toggle('active',x===b));
      this.clearMarks();this.sync();
    });
    $id('knSnd').addEventListener('click',()=>{
      this.sndOn=!this.sndOn;
      localStorage.setItem('volt-snd',this.sndOn?'on':'off');
      $id('knSnd').textContent=this.sndOn?'🔊':'🔇';
      if(this.sndOn)this.beep(660,0.08,0.05);
    });
    $id('knRand').addEventListener('click',()=>{
      if(this.busy||autoRunning)return;
      this.clearMarks();
      this.picks.clear();
      while(this.picks.size<this.MAX)this.picks.add(1+Math.floor(Math.random()*this.N));
      this.beep(700,0.07,0.05,'triangle');
      this.paint();this.sync();
    });
    $id('knClear').addEventListener('click',()=>{
      if(this.busy||autoRunning)return;
      this.clearMarks();
      this.picks.clear();
      this.beep(380,0.06,0.04,'triangle');
      this.paint();this.sync();
    });
    this.paint();this.sync();
  },
  toggle(t){
    if(this.busy||autoRunning)return;
    this.clearMarks();
    const i=+t.dataset.i;
    if(this.picks.has(i)){this.picks.delete(i);this.beep(420,0.05,0.04,'triangle');}
    else if(this.picks.size<this.MAX){this.picks.add(i);this.beep(600+this.picks.size*22,0.05,0.045,'triangle');}
    this.paint();this.sync();
  },
  paint(){
    $id('knGrid').querySelectorAll('.ktile').forEach(t=>t.classList.toggle('pick',this.picks.has(+t.dataset.i)));
  },
  clearMarks(){
    $id('knGrid').querySelectorAll('.ktile').forEach(t=>t.classList.remove('hit','draw','dud'));
    $id('knPop').hidden=true;
  },
  markHits(h){
    $id('knPays').querySelectorAll('.khit').forEach(c=>c.classList.toggle('cur',+c.dataset.h===h));
  },
  sync(){
    if(!$id('knLbl'))return;
    const p=this.picks.size,w=curW(),b=parseFloat(gvBetIn.value)||0;
    $id('knLbl').textContent=p+' of '+this.MAX;
    const tbl=this.tbl();
    $id('knTop').textContent=tbl?fmtW(w,b*tbl[tbl.length-1])+' '+w.c:'—';
    const pays=$id('knPays');
    if(!tbl){pays.innerHTML='<div class="kpay note">Pick up to 10 numbers</div>';}
    else pays.innerHTML=
      '<div class="kp-row">'+tbl.map(m=>`<div class="kpay"><b>${this.fmtM(m)}</b></div>`).join('')+'</div>'+
      '<div class="kp-row hits">'+tbl.map((m,h)=>`<div class="khit" data-h="${h}">${h}×<i></i></div>`).join('')+'</div>';
    if(!autoRunning)syncBetBtn();
  },
  label(){return this.picks.size?'Bet':'Pick numbers…';},
  onCur(){this.sync();},
  onBet(){this.play(null);},
  autoBet(done){this.play(done);},
  async play(done){
    if(this.busy){if(done)stopAuto();return;}
    if(!this.picks.size){if(done)stopAuto();return;}
    window._sbActive=true;
    const st=debitBet();if(!st){window._sbActive=false;if(done)stopAuto();return;}
    let res;
    try{
      res=await placeBet({game:'keno',currency:st.w.c,wager:st.b,params:{picks:[...this.picks],diff:this.diff}});
    }catch(err){
      st.w.amt+=st.b;st.w.fiat=st.w.amt*st.w.rate;renderWallet();
      window._sbActive=false;
      showToast({icon:'⚠',title:'Bet failed',sub:err.message});
      if(done)stopAuto();
      return;
    }
    window._sbActive=false;
    const{draws,hits}=res.gameData,mult=res.multiplier;
    const drawn=new Set(draws);
    this.busy=true;
    if(!autoRunning)gvBetBtn.disabled=true;
    lockBet(true);
    ['knRand','knClear'].forEach(id=>$id(id).disabled=true);
    $id('knDiff').querySelectorAll('.auto-seg').forEach(b=>b.disabled=true);
    this.clearMarks();
    this.markHits(0);
    let live=0;
    const order=[...drawn],step=autoRunning?60:110;
    order.forEach((n,k)=>{
      this._timers.push(setTimeout(()=>{
        const t=$id('knGrid').querySelector(`.ktile[data-i="${n}"]`);
        const hit=this.picks.has(n);
        if(t)t.classList.add(hit?'hit':'draw');
        if(hit){live++;this.markHits(live);this.beep(820+k*30,0.09,0.06);}
        else this.beep(440+k*16,0.04,0.035,'triangle');
      },140+k*step));
    });
    this._timers.push(setTimeout(()=>{
      $id('knGrid').querySelectorAll('.ktile.pick:not(.hit)').forEach(t=>t.classList.add('dud'));
      if(mult>0){
        $id('knPopM').textContent=this.fmtM(mult);
        $id('knPopP').textContent=fmtW(st.w,st.b*mult)+' '+st.w.c;
        $id('knPop').hidden=false;
      }
      this.endSnd(mult);
      serverSettleBet(st,mult,res.new_balance);
      this._timers=[];
      this.busy=false;gvBetBtn.disabled=false;
      lockBet(false);
      ['knRand','knClear'].forEach(id=>$id(id).disabled=false);
      $id('knDiff').querySelectorAll('.auto-seg').forEach(b=>b.disabled=false);
      this.sync();
      this.markHits(hits);
      if(done)done(mult>1,st.b*(mult-1));
    },140+order.length*step+220));
  },
  unmount(){
    this._timers.forEach(clearTimeout);this._timers=[];
    this.busy=false;
    this.picks.clear();
  }
};
