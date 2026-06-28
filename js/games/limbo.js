/* --- limbo --- */
ORIGINALS['originals-limbo']={
  rtp:'99%',auto:true,busy:false,hist:[],

  sndOn:localStorage.getItem('volt-snd')!=='off',
  _ac:null,
  beep(f,d,g,t='sine'){
    if(!this.sndOn)return;
    try{
      const c=this._ac||(this._ac=new(window.AudioContext||window.webkitAudioContext)());
      if(c.state==='suspended')c.resume();
      const o=c.createOscillator(),gn=c.createGain();
      o.type=t;o.frequency.value=f;
      gn.gain.setValueAtTime(g,c.currentTime);
      gn.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+d);
      o.connect(gn);gn.connect(c.destination);o.start();o.stop(c.currentTime+d);
    }catch(e){}
  },
  sndWin(){this.beep(660,.1,.06);setTimeout(()=>this.beep(990,.14,.05),70);setTimeout(()=>this.beep(1320,.18,.04),140);},
  sndLose(){this.beep(160,.22,.07,'sawtooth');},
  sndRoll(){this.beep(300+Math.random()*200,.03,.025,'triangle');},

  mount(){
    engFields.innerHTML=`
      <div class="eng-readout"><span>Profit on Win</span><b id="lbProf">—</b></div>
      <div class="eng-readout"><span>Win Chance</span><b id="lbChance">—</b></div>`;
    gvStage.innerHTML=`
      <div class="lb-wrap">
        <div class="lb-result-wrap" id="lbResultWrap">
          <div class="lb-result" id="lbResult">—</div>
          <div class="lb-target-line" id="lbTargetLine"></div>
          <div class="lb-verdict" id="lbVerdict"></div>
        </div>
        <div class="lb-hist" id="lbHist"></div>
      </div>
      <style>
        .lb-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:24px;padding:24px}
        .lb-result-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;flex:1;justify-content:center}
        .lb-result{font-size:clamp(56px,10vw,96px);font-weight:900;letter-spacing:-.02em;color:#c4b5fd;transition:color .25s;font-variant-numeric:tabular-nums;text-shadow:0 0 40px rgba(139,92,246,.4);line-height:1}
        .lb-result.win{color:#4ade80;text-shadow:0 0 60px rgba(74,222,128,.5),0 0 120px rgba(74,222,128,.2)}
        .lb-result.lose{color:#f87171;text-shadow:0 0 60px rgba(248,113,113,.4)}
        .lb-result.rolling{animation:lbPulse .12s ease-in-out infinite alternate}
        @keyframes lbPulse{from{opacity:.7}to{opacity:1}}
        .lb-target-line{font-size:13px;font-weight:700;color:rgba(196,181,253,.45);letter-spacing:.04em}
        .lb-verdict{font-size:18px;font-weight:900;letter-spacing:.12em;min-height:26px;transition:all .2s}
        .lb-verdict.win{color:#4ade80}
        .lb-verdict.lose{color:#f87171}
        .lb-hist{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:520px}
        .lb-chip{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:800;letter-spacing:.03em}
        .lb-chip.win{background:rgba(74,222,128,.12);color:#4ade80;border:1px solid rgba(74,222,128,.25)}
        .lb-chip.lose{background:rgba(248,113,113,.1);color:#f87171;border:1px solid rgba(248,113,113,.2)}
      </style>`;
    $id('gvSndSlot').innerHTML=`<button class="pl-snd" id="lbSnd" aria-label="Toggle sound">${this.sndOn?'🔊':'🔇'}</button>`;
    $id('lbSnd').addEventListener('click',()=>{
      this.sndOn=!this.sndOn;
      localStorage.setItem('volt-snd',this.sndOn?'on':'off');
      $id('lbSnd').textContent=this.sndOn?'🔊':'🔇';
      if(this.sndOn)this.beep(660,.08,.05);
    });
    this.sync();this.renderHist();
  },

  sync(){
    const w=curW(),b=parseFloat(gvBetIn.value)||0,m=Math.max(1.01,parseFloat(gvMultIn.value)||2);
    if($id('lbProf'))$id('lbProf').textContent=fmtW(w,b*(m-1))+' '+w.c;
    if($id('lbChance'))$id('lbChance').textContent=(99/m).toFixed(2)+'%';
    const tl=$id('lbTargetLine');
    if(tl)tl.textContent=`TARGET  ${m.toFixed(2)}×`;
  },
  onCur(){this.sync();},

  renderHist(){
    const el=$id('lbHist');if(!el)return;
    el.innerHTML=this.hist.slice(0,18).map(h=>`<span class="lb-chip ${h.win?'win':'lose'}">${h.mult.toFixed(2)}×</span>`).join('');
  },

  onBet(){this.drop(null);},
  autoBet(done){this.drop(done);},

  async drop(done){
    if(this.busy){if(done)stopAuto();return;}
    window._sbActive=true;
    const st=debitBet();
    if(!st){window._sbActive=false;if(done)stopAuto();return;}
    this.busy=true;
    if(!autoRunning)gvBetBtn.disabled=true;
    const target=Math.max(1.01,parseFloat(gvMultIn.value)||2);
    const res_el=$id('lbResult'),vd=$id('lbVerdict');
    if(res_el){res_el.className='lb-result rolling';res_el.textContent='…';}
    if(vd){vd.className='lb-verdict';vd.textContent='';}

    // roll animation while waiting
    let rollInterval=setInterval(()=>{
      const fake=(Math.random()*target*3+1).toFixed(2);
      if(res_el)res_el.textContent=fake+'×';
      this.sndRoll();
    },80);

    let res;
    try{
      res=await placeBet({game:'limbo',currency:st.w.c,wager:st.b,params:{target}});
    }catch(err){
      clearInterval(rollInterval);
      this.busy=false;window._sbActive=false;
      if(res_el){res_el.className='lb-result';res_el.textContent='—';}
      gvBetBtn.disabled=false;
      showToast({icon:'⚠',title:'Bet failed',sub:err.message});
      if(done)stopAuto();return;
    }
    clearInterval(rollInterval);
    window._sbActive=false;

    const result=res.multiplier;   // rolled multiplier from server
    const win=result>=target;

    // reveal animation — count up quickly to result
    let frames=0,maxFrames=18;
    const reveal=setInterval(()=>{
      frames++;
      const progress=frames/maxFrames;
      const display=frames<maxFrames
        ? (1+(result-1)*Math.pow(progress,2)).toFixed(2)
        : result.toFixed(2);
      if(res_el)res_el.textContent=display+'×';
      if(frames>=maxFrames){
        clearInterval(reveal);
        if(res_el)res_el.className='lb-result '+(win?'win':'lose');
        if(vd){vd.className='lb-verdict '+(win?'win':'lose');vd.textContent=win?'WIN':'BUST';}
        if(win)this.sndWin();else this.sndLose();
        this.hist.unshift({mult:result,win});
        this.renderHist();
        serverSettleBet(st,res.multiplier,res.new_balance);
        if(done)done(win,st.b*(res.multiplier-1));
        setTimeout(()=>{
          this.busy=false;
          if(!autoRunning)gvBetBtn.disabled=false;
          this.sync();
        },win?900:600);
      }
    },50);
  },

  unmount(){
    this.busy=false;
    if(this._ac){try{this._ac.close();}catch(e){}this._ac=null;}
  }
};
