/* --- plinko --- */
ORIGINALS['originals-plinko']={
  rtp:'~99%',auto:true,risk:'medium',rows:12,balls:[],floats:[],pegFx:{},bktFx:{},_raf:0,_szT:0,W:0,
  SEG:150,
  T:{
    8:{low:[5.6,2.1,1.1,1,0.5,1,1.1,2.1,5.6],medium:[13,3,1.3,0.7,0.4,0.7,1.3,3,13],high:[29,4,1.5,0.3,0.2,0.3,1.5,4,29]},
    12:{low:[10,3,1.6,1.4,1.1,1,0.5,1,1.1,1.4,1.6,3,10],medium:[33,11,4,2,1.1,0.6,0.3,0.6,1.1,2,4,11,33],high:[170,24,8.1,2,0.7,0.2,0.2,0.2,0.7,2,8.1,24,170]},
    16:{low:[16,9,2,1.4,1.4,1.2,1.1,1,0.5,1,1.1,1.2,1.4,1.4,2,9,16],medium:[110,41,10,5,3,1.5,1,0.5,0.3,0.5,1,1.5,3,5,10,41,110],high:[1000,130,26,9,4,2,0.2,0.2,0.2,0.2,0.2,2,4,9,26,130,1000]}
  },
  fm(m){return m>=1000?(m/1000)+'k':m>=10?String(Math.round(m)):String(m);},

  /* tiny synth — no audio assets; pitch rises as the ball descends */
  sndOn:localStorage.getItem('volt-snd')!=='off',
  _ac:null,_lastTick:0,
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
  tick(row){
    const now=performance.now();
    if(now-this._lastTick<28)return; // don't stack ticks when many balls fly
    this._lastTick=now;
    this.beep(520+row*36+rnd(-15,15),0.045,0.05,'triangle');
  },
  landSnd(mult){
    if(mult>=10){this.beep(880,0.16,0.07);this.beep(1320,0.22,0.06);}
    else if(mult>1)this.beep(660,0.12,0.06);
    else if(mult===1)this.beep(440,0.08,0.04);
    else this.beep(170,0.16,0.06);
  },

  mount(){
    engFields.innerHTML=`
      <div class="gv-field"><label>Risk</label><div class="auto-segs" id="plRisk">
        ${['low','medium','high'].map(r=>`<button class="auto-seg${r===this.risk?' active':''}" data-v="${r}">${r[0].toUpperCase()+r.slice(1)}</button>`).join('')}</div></div>
      <div class="gv-field"><label>Rows</label><div class="auto-segs" id="plRows">
        ${[8,12,16].map(r=>`<button class="auto-seg${r===this.rows?' active':''}" data-v="${r}">${r}</button>`).join('')}</div></div>
      <div class="eng-readout"><span>Max Win</span><b id="plMax">—</b></div>`;
    gvStage.innerHTML=`
      <canvas class="plinko-cv" id="plCv"></canvas>
      <div class="pl-tip" id="plTip" hidden></div>`;
    $id('gvSndSlot').innerHTML=`<button class="pl-snd" id="plSnd" aria-label="Toggle sound">${this.sndOn?'🔊':'🔇'}</button>`;
    this.cv=$id('plCv');this.ctx=this.cv.getContext('2d');
    this.W=0;this.pegFx={};this.bktFx={};this.floats=[];
    const seg=(id,fn)=>$id(id).addEventListener('click',e=>{
      const b=e.target.closest('.auto-seg');if(!b||b.disabled||this.balls.length)return;
      fn(b.dataset.v);
      $id(id).querySelectorAll('.auto-seg').forEach(x=>x.classList.toggle('active',x===b));
      this.geo();this.drawFrame(performance.now());this.sync();
    });
    seg('plRisk',v=>this.risk=v);
    seg('plRows',v=>this.rows=+v);
    $id('plSnd').addEventListener('click',()=>{
      this.sndOn=!this.sndOn;
      localStorage.setItem('volt-snd',this.sndOn?'on':'off');
      $id('plSnd').textContent=this.sndOn?'🔊':'🔇';
      if(this.sndOn)this.beep(660,0.08,0.05);
    });
    this.cv.addEventListener('mousemove',e=>this.hover(e));
    this.cv.addEventListener('mouseleave',()=>{const t=$id('plTip');if(t)t.hidden=true;});
    this._szT=setTimeout(()=>{this.sizeCv();this.drawFrame(performance.now());},520);
    this._rs=()=>{if(!this.balls.length){this.sizeCv();this.drawFrame(performance.now());}};
    window.addEventListener('resize',this._rs);
    this.sync();
  },
  sizeCv(){
    const s=gvStage.getBoundingClientRect();
    if(!s.width)return;
    const aw=Math.max(260,s.width-52),ah=Math.max(240,s.height-84);
    const W=Math.min(720,aw,ah/0.84);
    const dpr=window.devicePixelRatio||1;
    this.W=W;this.H=W*0.84;
    this.cv.style.width=W+'px';this.cv.style.height=this.H+'px';
    this.cv.width=Math.round(W*dpr);this.cv.height=Math.round(this.H*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.geo();
  },
  geo(){
    const R=this.rows;
    this.cx=this.W/2;
    this.dx=this.W/(R+3);
    this.bh=Math.min(30,this.dx*0.85);
    this.top=12;
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
    const r=this.cv.getBoundingClientRect();
    const x=e.clientX-r.left,y=e.clientY-r.top,R=this.rows;
    const b=Math.round((x-this.cx)/this.dx+R/2);
    if(y<this.by-this.bh/2-8||y>this.by+this.bh/2+8||b<0||b>R){tip.hidden=true;return;}
    const mult=this.T[R][this.risk][b];
    const p=this.nCr(R,b)/Math.pow(2,R)*100;
    const w=curW(),bet=parseFloat(gvBetIn.value)||0;
    tip.innerHTML=`<b>${mult}×</b><span>chance ${p<0.01?p.toFixed(4):p.toFixed(2)}%</span><span>pays ${fmtW(w,bet*mult)} ${w.c}</span>`;
    const st=gvStage.getBoundingClientRect();
    tip.style.left=(r.left-st.left+this.cx+(b-R/2)*this.dx)+'px';
    tip.style.top=(r.top-st.top+this.by-this.bh/2-12)+'px';
    tip.hidden=false;
  },

  /* trajectory: points[j] are peg hits; segment is a projectile arc that
     kicks up off the peg, then gravity brings it down to the next one */
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
    const p0=b.pts[j],p1=b.pts[j+1];
    const h=b.hs[j];
    return{
      x:p0.x+(p1.x-p0.x)*f,
      y:p0.y+(p1.y-p0.y+2*h)*f*f-2*h*f // parabola: leaves peg upward, lands on the next
    };
  },

  onBet(){this.drop(null);},
  autoBet(done){this.drop(done);},
  async drop(done){
    window._sbActive=true;
    const st=debitBet();
    if(!st){window._sbActive=false;if(done)stopAuto();return;}
    if(!this.W)this.sizeCv();
    let res;
    try{
      res=await placeBet({game:'plinko',currency:st.w.c,wager:st.b,params:{rows:this.rows,risk:this.risk}});
    }catch(err){
      st.w.amt+=st.b;st.w.fiat=st.w.amt*st.w.rate;renderWallet();
      window._sbActive=false;
      showToast({icon:'⚠',title:'Bet failed',sub:err.message});
      if(done)stopAuto();
      return;
    }
    window._sbActive=false;
    const{path,pos}=res.gameData,R=this.rows;
    const hs=Array.from({length:R+1},()=>this.dy*rnd(0.3,0.55));
    hs[0]=this.dy*0.15;
    this.balls.push({st,serverRes:res,path,pts:this.buildPts(path),hs,mult:res.multiplier,
                     t0:performance.now(),seg:R+1,last:0,trail:[],done});
    this.beep(300,0.05,0.04,'triangle');
    if(!this._raf)this.loop();
  },

  drawFrame(now){
    const c=this.ctx;if(!this.W)return;
    c.clearRect(0,0,this.W,this.H);
    const R=this.rows,T=this.T[R][this.risk];
    // pegs (lit ones glow and swell briefly after a hit)
    for(let i=0;i<R;i++)for(let k=0;k<i+3;k++){
      const px=this.cx+(k-(i+2)/2)*this.dx,py=this.top+(i+1)*this.dy;
      const fx=this.pegFx[i+':'+k],kf=fx?(now-fx)/300:1;
      const r=Math.max(2,this.dx*0.1);
      c.beginPath();
      if(kf<1){
        c.fillStyle='#9ff7cf';
        c.shadowColor='rgba(65,240,164,.9)';c.shadowBlur=12*(1-kf);
        c.arc(px,py,r*(1+0.7*(1-kf)),0,7);
        c.fill();c.shadowBlur=0;
      }else{
        c.fillStyle='#39435a';
        c.arc(px,py,r,0,7);
        c.fill();
      }
    }
    // buckets (damped spring bounce on landing)
    for(let b=0;b<=R;b++){
      const x=this.cx+(b-R/2)*this.dx,d=Math.abs(b-R/2)/(R/2);
      const fx=this.bktFx[b],kf=fx?(now-fx)/450:1;
      const off=kf<1?7*Math.exp(-4*kf)*Math.sin(10*kf):0;
      const lit=kf<1?Math.max(0,1-kf):0;
      c.fillStyle=`hsl(${48*(1-d)} 94% ${57+18*lit}%)`;
      c.beginPath();c.roundRect(x-(this.dx-3)/2,this.by-this.bh/2+off,this.dx-3,this.bh,5);c.fill();
      c.fillStyle=`hsl(${48*(1-d)} 80% 40%)`; // bottom lip for depth
      c.beginPath();c.roundRect(x-(this.dx-3)/2,this.by+this.bh/2-3+off,this.dx-3,3,[0,0,5,5]);c.fill();
      c.fillStyle='#10141d';
      c.font='900 '+Math.max(8,this.dx*0.3)+'px Archivo,sans-serif';
      c.textAlign='center';c.textBaseline='middle';
      c.fillText(this.fm(T[b]),x,this.by+0.5+off);
    }
    // floating results rise from the bucket and fade
    this.floats=this.floats.filter(fl=>{
      const k=(now-fl.t0)/900;
      if(k>=1)return false;
      c.globalAlpha=1-k;
      c.fillStyle=fl.col;
      c.font='900 14px Archivo,sans-serif';
      c.textAlign='center';c.textBaseline='middle';
      c.fillText(fl.txt,fl.x,fl.y-36*k);
      c.globalAlpha=1;
      return true;
    });
  },
  loop(){
    const step=()=>{
      const now=performance.now(),c=this.ctx;
      this.drawFrame(now);
      this.balls=this.balls.filter(b=>{
        const s=(now-b.t0)/this.SEG;
        // peg strikes since last frame
        while(b.last<Math.min(Math.floor(s),b.seg-1)){
          b.last++;
          const row=b.last-1,q=b.last===1?0:b.path[b.last-2];
          this.pegFx[row+':'+(q+1)]=now;
          this.tick(row);
        }
        if(s>=b.seg){
          const bkt=b.path[b.path.length-1];
          this.bktFx[bkt]=now;
          this.landSnd(b.mult);
          this.floats.push({x:b.pts[b.seg].x,y:this.by-this.bh-8,txt:b.mult+'×',
                            col:b.mult>1?'#41f0a4':b.mult===1?'#eef2fa':'#e2596a',t0:now});
          serverSettleBet(b.st,b.mult,b.serverRes.new_balance);
          if(b.done)b.done(b.mult>1,b.st.b*(b.mult-1));
          return false;
        }
        const p=this.ballPos(b,s);
        b.trail.push(p);if(b.trail.length>7)b.trail.shift();
        b.trail.forEach((t,i)=>{
          c.globalAlpha=0.22*(i+1)/b.trail.length;
          c.beginPath();c.arc(t.x,t.y,this.dx*0.32*(0.55+0.45*(i+1)/b.trail.length),0,7);
          c.fillStyle='#41f0a4';c.fill();
        });
        c.globalAlpha=1;
        const g=c.createRadialGradient(p.x-this.dx*0.1,p.y-this.dx*0.12,1,p.x,p.y,this.dx*0.34);
        g.addColorStop(0,'#c9fce4');g.addColorStop(0.45,'#41f0a4');g.addColorStop(1,'#1da86b');
        c.beginPath();c.arc(p.x,p.y,this.dx*0.32,0,7);
        c.fillStyle=g;c.shadowColor='rgba(65,240,164,.7)';c.shadowBlur=9;
        c.fill();c.shadowBlur=0;
        return true;
      });
      const fx=now-Math.max(0,...Object.values(this.pegFx),...Object.values(this.bktFx))<460;
      if(this.balls.length||this.floats.length||fx)this._raf=requestAnimationFrame(step);
      else{this._raf=0;this.drawFrame(now);}
    };
    this._raf=requestAnimationFrame(step);
  },
  unmount(){
    cancelAnimationFrame(this._raf);this._raf=0;
    clearTimeout(this._szT);
    window.removeEventListener('resize',this._rs);
    this.balls.forEach(b=>{serverSettleBet(b.st,b.mult,b.serverRes.new_balance);if(b.done)b.done(b.mult>1,b.st.b*(b.mult-1));});
    this.balls=[];this.floats=[];this.pegFx={};this.bktFx={};
    if(this._ac){try{this._ac.close();}catch(e){}this._ac=null;}
  }
};
