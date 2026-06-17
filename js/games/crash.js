/* --- crash --- */
ORIGINALS['originals-crash']={
  rtp:'99%',auto:true,run:null,_raf:0,_t:0,_szT:0,GR:0.28,W:0,
  mount(){
    engFields.innerHTML=`
      <div class="gv-field"><label>Auto Cashout</label>
        <div class="gv-input"><input id="crAc" type="text" inputmode="decimal" value="2.00" aria-label="Auto cashout"/><span class="suf">×</span></div></div>`;
    gvStage.innerHTML=`
      <canvas class="crash-cv" id="crCv"></canvas>
      <div class="crash-hud">
        <div class="crash-mult run" id="crMult">1.00×</div>
        <div class="crash-sub" id="crSub">Place a bet to launch</div>
      </div>`;
    this.cv=$id('crCv');this.ctx=this.cv.getContext('2d');this.W=0;
    this._szT=setTimeout(()=>{this.sizeCv();this.drawIdle();},520);
    this._rs=()=>{this.sizeCv();if(!this.run)this.drawIdle();};
    window.addEventListener('resize',this._rs);
  },
  sizeCv(){
    const r=gvStage.getBoundingClientRect();
    if(!r.width)return;
    const dpr=window.devicePixelRatio||1;
    this.W=r.width;this.H=r.height;
    this.cv.width=Math.round(r.width*dpr);this.cv.height=Math.round(r.height*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
  },
  label(){return this.run&&!this.run.cashed?'Cash Out':'Bet';},
  onBet(){
    if(this.run){this.cash();return;}
    this.start(null);
  },
  autoBet(done){
    if(this.run){stopAuto();return;}
    this.start(done);
  },
  start(done){
    window._sbActive=true;
    const st=debitBet();if(!st){window._sbActive=false;if(done)stopAuto();return;}
    if(!this.W)this.sizeCv();
    this.run={st,t0:performance.now(),m:1,cashed:0,done};
    lockBet(true);
    $id('crSub').textContent='Click Cash Out anytime';
    $id('crSub').className='crash-sub';
    $id('crMult').className='crash-mult run';
    $id('crMult').textContent='1.00×';
    this.tick();
  },
  async cash(){
    const r=this.run;if(!r||r.cashed)return;
    cancelAnimationFrame(this._raf);
    const cashout=r.m;
    r.cashed=cashout;
    $id('crMult').textContent=cashout.toFixed(2)+'×';
    $id('crMult').className='crash-mult cash';
    $id('crSub').textContent='Verifying…';
    if(!autoRunning)gvBetBtn.disabled=true;
    let res;
    try{
      res=await placeBet({game:'crash',currency:r.st.w.c,wager:r.st.b,params:{cashout}});
    }catch(err){
      /* server rejected — treat as bust */
      r.cashed=0;
      $id('crMult').className='crash-mult bust';
      $id('crSub').textContent='Server bust: '+err.message;
      serverSettleBet(r.st,0,r.st.w.amt);
      window._sbActive=false;
      this.endSoon(900,false);
      return;
    }
    window._sbActive=false;
    const win=res.outcome==='win';
    if(win){
      serverSettleBet(r.st,cashout,res.new_balance);
      $id('crSub').textContent='Cashed out — +'+fmtW(r.st.w,r.st.b*(cashout-1))+' '+r.st.w.c;
      $id('crSub').className='crash-sub cash';
    }else{
      /* server's bust was lower than our cashout — lost */
      const serverBust=res.gameData?.bust||cashout;
      serverSettleBet(r.st,0,res.new_balance);
      $id('crMult').textContent=serverBust.toFixed(2)+'×';
      $id('crMult').className='crash-mult bust';
      $id('crSub').textContent='Busted at '+serverBust.toFixed(2)+'×';
    }
    this.endSoon(600,win);
  },
  tick(){
    const r=this.run;if(!r)return;
    const t=(performance.now()-r.t0)/1000;
    r.m=Math.exp(this.GR*t);
    const ac=parseFloat($id('crAc').value);
    if(ac>=1.01&&r.m>=ac){this.cash();return;}
    $id('crMult').textContent=r.m.toFixed(2)+'×';
    if(!autoRunning)gvBetBtn.textContent='Cash Out '+fmtW(r.st.w,r.st.b*r.m)+' '+r.st.w.c;
    this.draw(r.m,t,false);
    this._raf=requestAnimationFrame(()=>this.tick());
  },
  endSoon(ms,win){
    const r=this.run;
    this._t=setTimeout(()=>{
      this.run=null;
      lockBet(false);
      if(!autoRunning){syncBetBtn();gvBetBtn.disabled=false;}
      if(r.done)r.done(win,win?r.st.b*(r.cashed-1):-r.st.b);
    },ms);
  },
  draw(m,t,busted){
    const c=this.ctx;if(!this.W)return;
    const pad=24,pw=this.W-pad*2,ph=this.H-pad*2;
    c.clearRect(0,0,this.W,this.H);
    c.strokeStyle='rgba(235,240,255,.1)';c.lineWidth=1;
    c.beginPath();c.moveTo(pad,pad+ph);c.lineTo(this.W-pad,pad+ph);c.stroke();
    const tmax=Math.max(t,2.5),ymax=Math.max(m*1.15,1.5);
    const tipX=pad+t/tmax*pw;
    c.beginPath();c.moveTo(pad,pad+ph);
    const n=60;
    for(let i=1;i<=n;i++){
      const tt=t*i/n,mm=Math.exp(this.GR*tt);
      c.lineTo(pad+tt/tmax*pw,pad+ph-(mm-1)/(ymax-1)*ph);
    }
    if(busted){
      c.strokeStyle='#e2596a';c.shadowBlur=0;
      c.lineWidth=3;c.lineJoin='round';c.stroke();
      c.lineTo(tipX,pad+ph);c.closePath();
      c.fillStyle='rgba(226,89,106,.10)';
    }else{
      /* hue sweeps 155 (mint) → 55 (yellow) → 20 (orange) on a log scale */
      const h=Math.round(Math.max(20,155-Math.log(Math.max(m,1))/Math.log(20)*135));
      const tipColor=`hsl(${h},88%,60%)`;
      const sg=c.createLinearGradient(pad,0,tipX,0);
      sg.addColorStop(0,'#41f0a4');sg.addColorStop(1,tipColor);
      c.strokeStyle=sg;
      c.shadowBlur=Math.min(Math.log(Math.max(m,1))/Math.log(20),1)*20;
      c.shadowColor=tipColor;
      c.lineWidth=3;c.lineJoin='round';c.stroke();
      c.shadowBlur=0;
      c.lineTo(tipX,pad+ph);c.closePath();
      const fg=c.createLinearGradient(0,pad,0,pad+ph);
      fg.addColorStop(0,`hsla(${h},88%,60%,0)`);
      fg.addColorStop(1,`hsla(${h},88%,60%,.15)`);
      c.fillStyle=fg;
    }
    c.fill();
  },
  drawIdle(){
    const c=this.ctx;if(!this.W)return;
    c.clearRect(0,0,this.W,this.H);
    c.strokeStyle='rgba(235,240,255,.12)';c.lineWidth=2;
    c.beginPath();c.moveTo(24,this.H-24);c.lineTo(this.W-24,this.H-24);c.stroke();
  },
  unmount(){
    cancelAnimationFrame(this._raf);
    clearTimeout(this._t);clearTimeout(this._szT);
    window.removeEventListener('resize',this._rs);
    const r=this.run;
    if(r&&!r.cashed){
      /* player navigated away mid-round — cashout at current multiplier;
         server will settle as win or loss depending on the server's bust point */
      placeBet({game:'crash',currency:r.st.w.c,wager:r.st.b,params:{cashout:r.m}})
        .then(res=>{
          const win=res.outcome==='win';
          serverSettleBet(r.st,win?r.m:0,res.new_balance);
        })
        .catch(()=>serverSettleBet(r.st,0,r.st.w.amt));
    }
    window._sbActive=false;
    this.run=null;
  }
};
