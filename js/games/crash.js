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
      </div>
      <div class="crash-players" id="crPl">
        <div class="crash-pl-head"><span id="crPlN"></span><b id="crPlPot"></b></div>
        <div class="crash-pl-list" id="crPlList"></div>
      </div>`;
    this._plCss();this.plIdle();
    this.cv=$id('crCv');this.ctx=this.cv.getContext('2d');this.W=0;
    this._szT=setTimeout(()=>{this.sizeCv();this.drawIdle();},520);
    this._rs=()=>{this.sizeCv();if(!this.run)this.drawIdle();};
    window.addEventListener('resize',this._rs);
    $id('crAc').addEventListener('blur',()=>{
      const v=parseFloat($id('crAc').value);
      if(isNaN(v)||v<1.01)$id('crAc').value='';
    });
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
    this.plStart(st);
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
    this.plUserCash(cashout);
    $id('crMult').textContent=cashout.toFixed(2)+'×';
    $id('crMult').className='crash-mult cash';
    $id('crSub').textContent='Verifying…';
    if(!autoRunning)gvBetBtn.disabled=true;
    creditTo(r.st.w,r.st.b);
    let res;
    try{
      res=await placeBet({game:'crash',currency:r.st.w.c,wager:r.st.b,params:{cashout}});
    }catch(err){
      r.cashed=0;
      $id('crMult').className='crash-mult bust';
      $id('crSub').textContent='Server error: '+err.message;
      serverSettleBet(r.st,0,r.st.w.amt);
      window._sbActive=false;
      this.plFinish(r.m);
      this.endSoon(900,false);
      return;
    }
    window._sbActive=false;
    const win=res.gameData?.win===true;
    if(win){
      serverSettleBet(r.st,cashout,res.new_balance);
      $id('crSub').textContent='Cashed out — +'+fmtW(r.st.w,r.st.b*(cashout-1))+' '+r.st.w.c;
      $id('crSub').className='crash-sub cash';
      this.plPhantom(cashout);
    }else{
      /* server's bust was lower than our cashout — lost */
      const serverBust=res.gameData?.bust||cashout;
      serverSettleBet(r.st,0,res.new_balance);
      $id('crMult').textContent=serverBust.toFixed(2)+'×';
      $id('crMult').className='crash-mult bust';
      $id('crSub').textContent='Busted at '+serverBust.toFixed(2)+'×';
      this.plFinish(serverBust);
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
    this.plTick(r.m);
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
  /* ---- simulated round players (VoltBots) ---- */
  _plCss(){
    if($id('crashPlCss'))return;
    const s=document.createElement('style');s.id='crashPlCss';
    s.textContent=`
    .crash-players{position:absolute;top:10px;left:10px;width:196px;max-height:calc(100% - 20px);display:flex;flex-direction:column;gap:6px;background:rgba(15,33,46,.78);border:1px solid rgba(235,240,255,.08);border-radius:12px;padding:10px 10px 8px;backdrop-filter:blur(6px);font-size:11.5px;pointer-events:none;z-index:3}
    .crash-pl-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;color:#8b93a7;font-weight:700;letter-spacing:.4px;font-size:10.5px;text-transform:uppercase}
    .crash-pl-head b{color:#ebf0ff;font-size:11.5px;letter-spacing:0}
    .crash-pl-list{overflow:hidden;display:flex;flex-direction:column;gap:3px}
    .crash-pl-row{display:flex;align-items:center;gap:6px;line-height:1.45;color:#aab2c5;font-weight:600}
    .crash-pl-row .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .crash-pl-row .amt{color:#6d7688;font-weight:700}
    .crash-pl-row .st{min-width:52px;text-align:right;font-weight:800;color:#57607a}
    .crash-pl-row.you .nm{color:#a48bfd}
    .crash-pl-row.cashed .st{color:#41f0a4}
    .crash-pl-row.cashed{color:#dfe6f5}
    .crash-pl-row.busted .st,.crash-pl-row.busted .nm,.crash-pl-row.busted .amt{color:#e2596a;opacity:.75}
    @media(max-width:860px){.crash-players{display:none}}`;
    document.head.appendChild(s);
  },
  plIdle(){
    this.pl=null;
    const bots=window.VoltBots?VoltBots.sample(6):[];
    $id('crPlN').textContent=(bots.length?14+Math.floor(Math.random()*22):0)+' watching';
    $id('crPlPot').textContent='';
    $id('crPlList').innerHTML=bots.map(b=>`<div class="crash-pl-row"><span class="nm">${b.n}</span><span class="st">ready</span></div>`).join('');
  },
  plStart(st){
    cancelAnimationFrame(this._phRaf);
    if(!window.VoltBots){this.pl=null;return;}
    const bots=VoltBots.sample(9+Math.floor(Math.random()*6));
    const rows=bots.map(b=>({n:b.n,s:b.s,bet:VoltBots.betSize(b.s),t:VoltBots.crashTarget(b.s),cashed:0,bust:false}));
    rows.sort((a,b)=>b.bet-a.bet);
    const userUsd=st.b*st.w.rate;
    this.pl={rows,userCash:0,userBust:false,over:false};
    $id('crPlN').textContent=(rows.length+1)+' players';
    $id('crPlPot').textContent='$'+(rows.reduce((s,r)=>s+r.bet,0)+userUsd).toFixed(0);
    $id('crPlList').innerHTML=
      `<div class="crash-pl-row you" id="crPlYou"><span class="nm">You</span><span class="amt">$${userUsd<10?userUsd.toFixed(2):userUsd.toFixed(0)}</span><span class="st">—</span></div>`+
      rows.map((r,i)=>`<div class="crash-pl-row" id="crPlR${i}"><span class="nm">${r.n}</span><span class="amt">$${r.bet<10?r.bet.toFixed(2):r.bet.toFixed(0)}</span><span class="st">—</span></div>`).join('');
  },
  plTick(m){
    const p=this.pl;if(!p||p.over)return;
    p.rows.forEach((r,i)=>{
      if(r.cashed||r.bust||m<r.t)return;
      r.cashed=r.t;
      const el=$id('crPlR'+i);if(!el)return;
      el.classList.add('cashed');
      el.querySelector('.st').textContent=r.t.toFixed(2)+'×';
      if(r.t>=8&&Math.random()<.35&&window.VoltBots)VoltBots.chat(r.n,VoltBots.bragLine(r.t));
    });
  },
  plUserCash(m){
    const p=this.pl;if(!p)return;
    p.userCash=m;
    const el=$id('crPlYou');if(!el)return;
    el.classList.add('cashed');
    el.querySelector('.st').textContent=m.toFixed(2)+'×';
  },
  /* user cashed out — the round keeps flying for everyone else until it crashes */
  plPhantom(fromM){
    const p=this.pl;if(!p||p.over)return;
    const bust=Math.min(1000,fromM*Math.max(1,0.99/Math.random()));
    const t0=performance.now(),m0=fromM;
    const step=()=>{
      if(!this.pl||this.pl.over)return;
      const m=m0*Math.exp(this.GR*(performance.now()-t0)/1000);
      if(m>=bust){this.plFinish(bust);return;}
      this.plTick(m);
      this._phRaf=requestAnimationFrame(step);
    };
    this._phRaf=requestAnimationFrame(step);
  },
  plFinish(bust){
    const p=this.pl;if(!p||p.over)return;
    p.over=true;
    cancelAnimationFrame(this._phRaf);
    if(bust)this.plTick(bust); /* anyone at or below the bust point made it */
    p.rows.forEach((r,i)=>{
      if(r.cashed)return;
      r.bust=true;
      const el=$id('crPlR'+i);if(!el)return;
      el.classList.add('busted');
      el.querySelector('.st').textContent='bust';
    });
    if(!p.userCash){
      const el=$id('crPlYou');
      if(el){el.classList.add('busted');el.querySelector('.st').textContent='bust';}
    }
    if(bust&&window.VoltBots&&Math.random()<.4){
      const losers=p.rows.filter(r=>r.bust&&r.s==='degen');
      if(losers.length)VoltBots.chat(losers[0].n,VoltBots.bustLine());
    }
    $id('crPlN').textContent=bust?'crashed @ '+bust.toFixed(2)+'×':'round over';
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
    cancelAnimationFrame(this._phRaf);
    this.pl=null;
    clearTimeout(this._t);clearTimeout(this._szT);
    window.removeEventListener('resize',this._rs);
    const r=this.run;
    if(r&&!r.cashed){
      /* player navigated away mid-round — cashout at current multiplier;
         server will settle as win or loss depending on the server's bust point */
      creditTo(r.st.w,r.st.b);
      placeBet({game:'crash',currency:r.st.w.c,wager:r.st.b,params:{cashout:r.m}})
        .then(res=>{
          const win=res.gameData?.win===true;
          serverSettleBet(r.st,win?r.m:0,res.new_balance);
        })
        .catch(()=>{});
    }
    window._sbActive=false;
    this.run=null;
  }
};
