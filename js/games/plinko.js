/* --- plinko --- */
ORIGINALS['originals-plinko']={
  rtp:'~99%',auto:true,risk:'medium',rows:12,
  balls:[],floats:[],confetti:[],pegFx:{},bktFx:{},squish:{},
  _raf:0,_idleRaf:0,_szT:0,
  W:0,H:0,cx:0,dx:0,bh:0,top:0,by:0,dy:0,dpr:1,
  PTCLS:[],shimmerT:0,turbo:false,

  T:{
    8:{low:[5.6,2.1,1.1,1,0.5,1,1.1,2.1,5.6],medium:[13,3,1.3,0.7,0.4,0.7,1.3,3,13],high:[29,4,1.5,0.3,0.2,0.3,1.5,4,29]},
    12:{low:[10,3,1.6,1.4,1.1,1,0.5,1,1.1,1.4,1.6,3,10],medium:[33,11,4,2,1.1,0.6,0.3,0.6,1.1,2,4,11,33],high:[170,24,8.1,2,0.7,0.2,0.2,0.2,0.7,2,8.1,24,170]},
    16:{low:[16,9,2,1.4,1.4,1.2,1.1,1,0.5,1,1.1,1.2,1.4,1.4,2,9,16],medium:[110,41,10,5,3,1.5,1,0.5,0.3,0.5,1,1.5,3,5,10,41,110],high:[1000,130,26,9,4,2,0.2,0.2,0.2,0.2,0.2,2,4,9,26,130,1000]}
  },
  fm(m){return m>=1000?(m/1000).toFixed(0)+'k':m>=10?String(Math.round(m)):String(m);},
  SEG(){return this.turbo?38:142;},

  /* ── audio ── */
  sndOn:localStorage.getItem('volt-snd')!=='off',
  _ac:null,_lastTick:0,
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
  tick(row){
    const now=performance.now();if(now-this._lastTick<26)return;this._lastTick=now;
    this.beep(400+row*28+rnd(-12,12),0.04,0.04,'triangle');
  },
  landSnd(mult){
    if(mult>=100){this.beep(880,0.08,0.06);setTimeout(()=>this.beep(1320,0.12,0.06),55);setTimeout(()=>this.beep(1760,0.18,0.07),120);}
    else if(mult>=10){this.beep(880,0.13,0.06);this.beep(1320,0.19,0.055);}
    else if(mult>1)this.beep(660,0.11,0.05);
    else if(mult===1)this.beep(440,0.08,0.04);
    else this.beep(140,0.18,0.05);
  },

  /* ── colour helpers ── */
  bHue(b,R){return(275+Math.abs(b-R/2)/(R/2)*275)%360;},
  bCol(b,R,l=64){return`hsl(${this.bHue(b,R)},100%,${l}%)`;},

  /* ── particle background ── */
  initParticles(){
    this.PTCLS=[];
    const sw=this.bgCv.width/this.dpr,sh=this.bgCv.height/this.dpr;
    for(let i=0;i<55;i++)this.PTCLS.push({x:rnd(0,sw),y:rnd(0,sh),r:rnd(0.4,1.6),vx:rnd(-0.12,0.12),vy:rnd(-0.18,-0.04),a:rnd(0.15,0.5),base:rnd(0.12,0.45)});
  },
  drawBg(now){
    if(!this.bgCv)return;
    const c=this.bgCtx,sw=this.bgCv.width/this.dpr,sh=this.bgCv.height/this.dpr;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    c.clearRect(0,0,sw,sh);
    const t=now*0.00028;
    const nb=c.createRadialGradient(sw*0.18+Math.sin(t)*sw*0.04,sh*0.5+Math.cos(t*0.7)*sh*0.08,0,sw*0.22,sh*0.5,sw*0.42);
    nb.addColorStop(0,'rgba(80,20,160,0.08)');nb.addColorStop(1,'transparent');
    c.fillStyle=nb;c.fillRect(0,0,sw,sh);
    const nb2=c.createRadialGradient(sw*0.82+Math.cos(t*0.9)*sw*0.04,sh*0.38+Math.sin(t*0.6)*sh*0.06,0,sw*0.82,sh*0.38,sw*0.38);
    nb2.addColorStop(0,'rgba(20,40,180,0.06)');nb2.addColorStop(1,'transparent');
    c.fillStyle=nb2;c.fillRect(0,0,sw,sh);
    this.PTCLS.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;
      if(p.y<-4){p.y=sh+4;p.x=rnd(0,sw);}
      if(p.x<-4)p.x=sw+4;if(p.x>sw+4)p.x=-4;
      c.beginPath();c.arc(p.x,p.y,p.r,0,Math.PI*2);
      c.fillStyle=`rgba(160,120,255,${p.base+Math.sin(now*0.001+p.a)*0.12})`;
      c.fill();
    });
  },

  /* ── draw primitives ── */
  drawPeg(c,px,py,r,shimmer,hitKf,adjKf){
    const glowA=Math.max(0,shimmer,hitKf<1?(1-hitKf)*0.7:0,adjKf<1?(1-adjKf)*0.25:0);
    if(glowA>0.01){
      const hue=hitKf<1?270:220;
      const gl=c.createRadialGradient(px,py,r*0.4,px,py,r*5);
      gl.addColorStop(0,`hsla(${hue},100%,70%,${glowA*0.7})`);gl.addColorStop(1,'transparent');
      c.beginPath();c.arc(px,py,r*5,0,Math.PI*2);c.fillStyle=gl;c.fill();
    }
    const sr=hitKf<1?r*(1+0.55*(1-hitKf)):r;
    const g2=c.createRadialGradient(px-sr*0.34,py-sr*0.38,sr*0.05,px,py,sr);
    g2.addColorStop(0,'#ffffff');g2.addColorStop(0.1,'#e8eeff');
    g2.addColorStop(0.45,'#5a6888');g2.addColorStop(1,'#151c2e');
    c.beginPath();c.arc(px,py,sr,0,Math.PI*2);c.fillStyle=g2;c.fill();
    c.beginPath();c.arc(px-sr*0.3,py-sr*0.33,sr*0.17,0,Math.PI*2);
    c.fillStyle='rgba(255,255,255,0.52)';c.fill();
    c.beginPath();c.ellipse(px,py+sr*1.15,sr*0.7,sr*0.22,0,0,Math.PI*2);
    c.fillStyle='rgba(0,0,0,0.22)';c.fill();
  },

  drawBallAt(c,x,y,r,spinAngle,sqX,sqY){
    const gl=c.createRadialGradient(x,y,r*0.5,x,y,r*4.2);
    gl.addColorStop(0,'rgba(145,60,255,0.55)');gl.addColorStop(1,'transparent');
    c.beginPath();c.arc(x,y,r*4.2,0,Math.PI*2);c.fillStyle=gl;c.fill();
    c.save();c.translate(x,y);c.scale(sqX,sqY);
    const g=c.createRadialGradient(-r*0.28,-r*0.3,r*0.05,0,0,r);
    g.addColorStop(0,'#e8d0ff');g.addColorStop(0.18,'#b060ff');
    g.addColorStop(0.6,'#5c10c0');g.addColorStop(1,'#1e0455');
    c.beginPath();c.arc(0,0,r,0,Math.PI*2);
    c.fillStyle=g;c.shadowColor='rgba(145,65,255,.85)';c.shadowBlur=14;c.fill();c.shadowBlur=0;
    const sx=Math.cos(spinAngle)*r*0.3,sy=Math.sin(spinAngle)*r*0.3;
    c.beginPath();c.arc(sx,sy,r*0.18,0,Math.PI*2);
    c.fillStyle='rgba(255,255,255,0.58)';c.fill();
    c.restore();
  },

  drawBucket(c,b,R,now){
    const x=this.cx+(b-R/2)*this.dx;
    const fx=this.bktFx[b],kf=fx?(now-fx)/540:1;
    const off=kf<1?6*Math.exp(-4.5*kf)*Math.sin(11*kf):0;
    const lit=kf<1?Math.max(0,1-kf):0;
    const hue=this.bHue(b,R);
    if(lit>0.02){
      const lg=c.createRadialGradient(x,this.by+off,0,x,this.by+off,this.dx*1.6);
      lg.addColorStop(0,`hsla(${hue},100%,60%,${0.5*lit})`);lg.addColorStop(1,'transparent');
      c.fillStyle=lg;c.fillRect(x-this.dx,this.by-this.bh*2+off,this.dx*2,this.bh*3.5);
    }
    const bg=c.createLinearGradient(x,this.by-this.bh/2+off,x,this.by+this.bh/2+off);
    bg.addColorStop(0,`hsla(${hue},80%,${20+12*lit}%,.94)`);
    bg.addColorStop(1,`hsla(${hue},80%,${11+7*lit}%,.94)`);
    c.fillStyle=bg;c.beginPath();c.roundRect(x-(this.dx-2)/2,this.by-this.bh/2+off,this.dx-2,this.bh,4);c.fill();
    const fillH=kf<1?this.bh*(0.92*(1-Math.pow(kf,1.6))):0;
    if(fillH>0){
      c.save();c.beginPath();c.roundRect(x-(this.dx-2)/2,this.by-this.bh/2+off,this.dx-2,this.bh,4);c.clip();
      c.fillStyle=`hsla(${hue},100%,${58+10*lit}%,${0.55*lit})`;
      c.fillRect(x-(this.dx-2)/2,this.by+this.bh/2-fillH+off,this.dx-2,fillH);
      c.restore();
    }
    const bord=c.createLinearGradient(x-(this.dx-2)/2,0,x+(this.dx-2)/2,0);
    bord.addColorStop(0,`hsla(${hue},100%,${45+28*lit}%,${0.3+0.55*lit})`);
    bord.addColorStop(1,`hsla(${hue},100%,${45+28*lit}%,${0.15+0.3*lit})`);
    c.strokeStyle=bord;c.lineWidth=lit>0?1.4:1;
    c.beginPath();c.roundRect(x-(this.dx-2)/2,this.by-this.bh/2+off,this.dx-2,this.bh,4);c.stroke();
    c.fillStyle=`hsl(${hue},100%,${78+16*lit}%)`;
    c.font=`900 ${Math.max(7,Math.min(10,this.dx*0.3))}px Segoe UI,sans-serif`;
    c.textAlign='center';c.textBaseline='middle';
    c.fillText(this.fm(this.T[R][this.risk][b])+'×',x,this.by+0.5+off);
  },

  spawnConfetti(x,y,hue){
    for(let i=0;i<22;i++)this.confetti.push({x,y,vx:rnd(-4,4),vy:rnd(-7,-1.5),r:rnd(2,4.5),hue:hue+rnd(-25,25),rot:rnd(0,Math.PI*2),vr:rnd(-0.18,0.18),t0:performance.now()});
  },
  triggerFlash(win){
    const ef=$id('plFlash');if(!ef)return;
    const col=win?'rgba(34,197,94,0.18)':'rgba(239,68,68,0.14)';
    ef.style.background=`radial-gradient(ellipse at 50% 50%, transparent 60%, ${col} 100%)`;
    ef.style.opacity='1';setTimeout(()=>{ef.style.opacity='0';},500);
  },

  /* ── lifecycle ── */
  mount(){
    engFields.innerHTML=`
      <div class="gv-field"><label>Risk</label><div class="auto-segs" id="plRisk">
        ${['low','medium','high'].map(r=>`<button class="auto-seg${r===this.risk?' active':''}" data-v="${r}">${r[0].toUpperCase()+r.slice(1)}</button>`).join('')}</div></div>
      <div class="gv-field"><label>Rows</label><div class="auto-segs" id="plRows">
        ${[8,12,16].map(r=>`<button class="auto-seg${r===this.rows?' active':''}" data-v="${r}">${r}</button>`).join('')}</div></div>
      <div class="gv-field" style="flex-direction:row;align-items:center;gap:8px">
        <input type="checkbox" id="plTurbo" style="width:14px;height:14px;accent-color:#7c3aed"${this.turbo?' checked':''}>
        <label for="plTurbo" style="font-size:12px;color:#7080a0;cursor:pointer">Turbo Mode</label>
      </div>
      <div class="eng-readout"><span>Max Win</span><b id="plMax">—</b></div>`;
    gvStage.innerHTML=`
      <canvas id="plBg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0"></canvas>
      <canvas class="plinko-cv" id="plCv" style="position:relative;z-index:1"></canvas>
      <div id="plFlash" style="position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .08s;z-index:2"></div>
      <div class="pl-tip" id="plTip" hidden></div>`;
    if(getComputedStyle(gvStage).position==='static')gvStage.style.position='relative';
    $id('gvSndSlot').innerHTML=`<button class="pl-snd" id="plSnd" aria-label="Toggle sound">${this.sndOn?'🔊':'🔇'}</button>`;
    this.cv=$id('plCv');this.ctx=this.cv.getContext('2d');
    this.bgCv=$id('plBg');this.bgCtx=this.bgCv.getContext('2d');
    this.W=0;this.pegFx={};this.bktFx={};this.squish={};this.floats=[];this.confetti=[];
    const seg=(id,fn)=>$id(id).addEventListener('click',e=>{
      const b=e.target.closest('.auto-seg');if(!b||b.disabled||this.balls.length)return;
      fn(b.dataset.v);
      $id(id).querySelectorAll('.auto-seg').forEach(x=>x.classList.toggle('active',x===b));
      this.geo();this.drawFrame(performance.now());this.sync();
    });
    seg('plRisk',v=>this.risk=v);
    seg('plRows',v=>this.rows=+v);
    $id('plTurbo').addEventListener('change',e=>this.turbo=e.target.checked);
    $id('plSnd').addEventListener('click',()=>{
      this.sndOn=!this.sndOn;
      localStorage.setItem('volt-snd',this.sndOn?'on':'off');
      $id('plSnd').textContent=this.sndOn?'🔊':'🔇';
      if(this.sndOn)this.beep(660,0.08,0.05);
    });
    this.cv.addEventListener('mousemove',e=>this.hover(e));
    this.cv.addEventListener('mouseleave',()=>{const t=$id('plTip');if(t)t.hidden=true;});
    this._szT=setTimeout(()=>{this.sizeCv();this.drawFrame(performance.now());this.idleLoop();},520);
    this._rs=()=>{if(!this.balls.length){this.sizeCv();this.drawFrame(performance.now());}};
    window.addEventListener('resize',this._rs);
    this.sync();
  },

  sizeCv(){
    const s=gvStage.getBoundingClientRect();if(!s.width)return;
    const aw=Math.max(260,s.width-52),ah=Math.max(240,s.height-84);
    const W=Math.min(720,aw,ah/0.95);
    this.dpr=window.devicePixelRatio||1;
    this.W=W;this.H=W*0.95;
    this.cv.style.width=W+'px';this.cv.style.height=this.H+'px';
    this.cv.width=Math.round(W*this.dpr);this.cv.height=Math.round(this.H*this.dpr);
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    this.bgCv.width=Math.round(s.width*this.dpr);this.bgCv.height=Math.round(s.height*this.dpr);
    this.geo();this.initParticles();
  },

  geo(){
    const R=this.rows;
    this.cx=this.W/2;this.dx=this.W/(R+3.5);
    this.bh=Math.min(24,this.dx*0.7);this.top=36;
    this.by=this.H-this.bh/2-6;
    this.dy=(this.by-this.bh/2-this.top-8)/R;
  },

  sync(){
    if(!$id('plMax'))return;
    const w=curW(),b=parseFloat(gvBetIn.value)||0;
    $id('plMax').textContent=fmtW(w,b*Math.max(...this.T[this.rows][this.risk]))+' '+w.c;
  },
  onCur(){this.sync();},

  nCr(n,k){let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return r;},
  hover(e){
    const tip=$id('plTip');if(!tip||!this.W)return;
    const rect=this.cv.getBoundingClientRect();
    const x=e.clientX-rect.left,y=e.clientY-rect.top,R=this.rows;
    const b=Math.round((x-this.cx)/this.dx+R/2);
    if(y<this.by-this.bh/2-8||y>this.by+this.bh/2+8||b<0||b>R){tip.hidden=true;return;}
    const mult=this.T[R][this.risk][b];
    const p=this.nCr(R,b)/Math.pow(2,R)*100;
    const w=curW(),bet=parseFloat(gvBetIn.value)||0;
    tip.innerHTML=`<b>${mult}×</b><span>chance ${p<0.01?p.toFixed(4):p.toFixed(2)}%</span><span>pays ${fmtW(w,bet*mult)} ${w.c}</span>`;
    const st=gvStage.getBoundingClientRect();
    tip.style.left=(rect.left-st.left+this.cx+(b-R/2)*this.dx)+'px';
    tip.style.top=(rect.top-st.top+this.by-this.bh/2-58)+'px';
    tip.hidden=false;
  },

  buildPts(path){
    const R=this.rows,pts=[{x:this.cx,y:this.top-6}];
    for(let j=1;j<=R;j++){
      const q=j===1?0:path[j-2];
      pts.push({x:this.cx+(q-(j-1)/2)*this.dx,y:this.top+j*this.dy});
    }
    pts.push({x:this.cx+(path[R-1]-R/2)*this.dx,y:this.by-this.bh/2-4});
    return pts;
  },
  ballPos(b,s){
    const j=Math.min(Math.floor(s),b.seg-1),f=s-j;
    const p0=b.pts[j],p1=b.pts[j+1],h=b.hs[j];
    return{x:p0.x+(p1.x-p0.x)*f,y:p0.y+(p1.y-p0.y+2*h)*f*f-2*h*f};
  },

  /* ── game logic ── */
  onBet(){this.drop(null);},
  autoBet(done){this.drop(done);},
  async drop(done){
    window._sbActive=true;
    const st=debitBet();
    if(!st){window._sbActive=false;if(done)stopAuto();return;}
    if(!this.W)this.sizeCv();
    creditTo(st.w,st.b);
    let res;
    try{
      res=await placeBet({game:'plinko',currency:st.w.c,wager:st.b,params:{rows:this.rows,risk:this.risk}});
    }catch(err){
      window._sbActive=false;
      showToast({icon:'⚠',title:'Bet failed',sub:err.message});
      if(done)stopAuto();return;
    }
    window._sbActive=false;
    const{path}=res.gameData,R=this.rows;
    const hs=Array.from({length:R+1},()=>this.dy*rnd(0.27,0.52));hs[0]=this.dy*0.11;
    const id=Math.random().toString(36).slice(2);
    this.balls.push({id,st,serverRes:res,path,pts:this.buildPts(path),hs,mult:res.multiplier,
                     t0:performance.now(),seg:R+1,last:0,trail:[],done,spinAngle:rnd(0,Math.PI*2)});
    this.beep(260,0.05,0.04,'triangle');
    cancelAnimationFrame(this._idleRaf);this._idleRaf=0;
    if(!this._raf)this.loop();
  },

  drawFrame(now){
    const c=this.ctx;if(!this.W)return;
    c.clearRect(0,0,this.W,this.H);
    this.drawBg(now);
    this.shimmerT=now*0.0018;
    const R=this.rows,T=this.T[R][this.risk];
    // top multiplier labels
    const fs=Math.max(8,Math.min(11,this.dx*0.33));
    c.font=`700 ${fs}px Segoe UI,sans-serif`;c.textAlign='center';c.textBaseline='middle';
    for(let b=0;b<=R;b++){c.fillStyle=this.bCol(b,R,68);c.fillText(this.fm(T[b])+'×',this.cx+(b-R/2)*this.dx,14);}
    // faint triangle outline
    const tw=(R/2+1)*this.dx;
    c.beginPath();c.moveTo(this.cx,this.top-2);c.lineTo(this.cx-tw,this.by+this.bh/2+4);c.lineTo(this.cx+tw,this.by+this.bh/2+4);c.closePath();
    c.strokeStyle='rgba(90,50,160,.15)';c.lineWidth=1;c.stroke();
    // pegs
    const pr=Math.max(3,this.dx*0.128);
    for(let i=0;i<R;i++)for(let k=0;k<i+3;k++){
      const px=this.cx+(k-(i+2)/2)*this.dx,py=this.top+(i+1)*this.dy;
      const fx=this.pegFx[i+':'+k],kf=fx?(now-fx)/380:1;
      const shimmer=Math.max(0,Math.sin(this.shimmerT-(i*2.1+k)*0.38)*0.5-0.3)*0.18;
      let adjKf=1;
      const af1=this.pegFx[(i-1)+':'+k],af2=this.pegFx[(i-1)+':'+(k-1)];
      if(af1&&now-af1<500)adjKf=Math.min(adjKf,(now-af1)/500);
      if(af2&&now-af2<500)adjKf=Math.min(adjKf,(now-af2)/500);
      this.drawPeg(c,px,py,pr,shimmer,kf,adjKf);
    }
    // buckets
    for(let b=0;b<=R;b++)this.drawBucket(c,b,R,now);
    // confetti
    this.confetti=this.confetti.filter(p=>{
      const k=(now-p.t0)/1100;if(k>=1)return false;
      p.x+=p.vx;p.y+=p.vy;p.vy+=0.18;p.rot+=p.vr;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot);
      c.globalAlpha=(1-k)*(1-k);
      c.fillStyle=`hsla(${p.hue},100%,65%,1)`;c.fillRect(-p.r,-p.r*0.5,p.r*2,p.r);
      c.restore();c.globalAlpha=1;return true;
    });
    // floats
    this.floats=this.floats.filter(fl=>{
      const k=(now-fl.t0)/950;if(k>=1)return false;
      c.globalAlpha=(1-k)*(1-k);c.fillStyle=fl.col;
      c.font='900 13px Segoe UI,sans-serif';c.textAlign='center';c.textBaseline='middle';
      c.fillText(fl.txt,fl.x,fl.y-44*k);c.globalAlpha=1;return true;
    });
  },

  loop(){
    const step=()=>{
      const now=performance.now(),c=this.ctx;
      this.drawFrame(now);
      const br=Math.max(5,this.dx*0.3);
      this.balls=this.balls.filter(b=>{
        const s=(now-b.t0)/this.SEG();
        while(b.last<Math.min(Math.floor(s),b.seg-1)){
          b.last++;
          const row=b.last-1,q=b.last===1?0:b.path[b.last-2];
          this.pegFx[row+':'+(q+1)]=now;
          this.squish[b.id]=now;
          this.tick(row);
        }
        if(s>=b.seg){
          const bkt=b.path[b.path.length-1];
          this.bktFx[bkt]=now;this.landSnd(b.mult);
          const col=b.mult>1?this.bCol(bkt,this.rows,68):b.mult===1?'#eef2fa':'#f87171';
          this.floats.push({x:b.pts[b.seg].x,y:this.by-this.bh-14,txt:b.mult+'×',col,t0:now});
          if(b.mult>=10)this.spawnConfetti(b.pts[b.seg].x,this.by-this.bh,this.bHue(bkt,this.rows));
          this.triggerFlash(b.mult>=1);
          serverSettleBet(b.st,b.mult,b.serverRes.new_balance);
          if(b.done)b.done(b.mult>1,b.st.b*(b.mult-1));
          return false;
        }
        const p=this.ballPos(b,s);
        b.trail.push({x:p.x,y:p.y});if(b.trail.length>10)b.trail.shift();
        // motion blur
        if(b.trail.length>2){
          const prev=b.trail[b.trail.length-3];
          const vx=p.x-prev.x,vy=p.y-prev.y,spd=Math.sqrt(vx*vx+vy*vy);
          if(spd>0.5){
            const ang=Math.atan2(vy,vx);
            c.save();c.translate(p.x,p.y);c.rotate(ang);
            const bl=Math.min(spd*2.2,br*4);
            const bg=c.createLinearGradient(-bl,0,0,0);
            bg.addColorStop(0,'rgba(140,60,255,0)');bg.addColorStop(1,'rgba(140,60,255,0.38)');
            c.fillStyle=bg;c.beginPath();c.ellipse(-bl/2,0,bl/2,br*0.45,0,0,Math.PI*2);c.fill();
            c.restore();
          }
        }
        const sqT=this.squish[b.id],sqKf=sqT?(now-sqT)/160:1;
        const sqX=sqKf<1?1+0.35*(1-sqKf):1,sqY=sqKf<1?1-0.28*(1-sqKf):1;
        b.spinAngle+=0.12;
        this.drawBallAt(c,p.x,p.y,br,b.spinAngle,sqX,sqY);
        return true;
      });
      const anyFx=Object.values(this.pegFx).some(t=>now-t<440)||Object.values(this.bktFx).some(t=>now-t<580);
      if(this.balls.length||this.floats.length||this.confetti.length||anyFx){
        this._raf=requestAnimationFrame(step);
      }else{
        this._raf=0;this.drawFrame(now);this.idleLoop();
      }
    };
    this._raf=requestAnimationFrame(step);
  },

  idleLoop(){
    const step=t=>{this.drawBg(t);this._idleRaf=this._raf?0:requestAnimationFrame(step);};
    this._idleRaf=requestAnimationFrame(step);
  },

  unmount(){
    cancelAnimationFrame(this._raf);this._raf=0;
    cancelAnimationFrame(this._idleRaf);this._idleRaf=0;
    clearTimeout(this._szT);
    window.removeEventListener('resize',this._rs);
    this.balls.forEach(b=>{serverSettleBet(b.st,b.mult,b.serverRes.new_balance);if(b.done)b.done(b.mult>1,b.st.b*(b.mult-1));});
    this.balls=[];this.floats=[];this.confetti=[];this.pegFx={};this.bktFx={};this.squish={};
    if(this._ac){try{this._ac.close();}catch(e){}this._ac=null;}
  }
};
