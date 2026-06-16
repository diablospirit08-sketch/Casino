/* --- blackjack v2 --- */
ORIGINALS['originals-blackjack']={
  rtp:'99.5%',auto:false,
  h:null,
  ruleMode:'H17',
  _T:[],_kh:null,_betChips:[],

  /* ── sound ── */
  sndOn:localStorage.getItem('volt-snd')!=='off',
  _ac:null,
  _beep(freq,dur,gain,type,delay){
    if(!this.sndOn)return;
    try{
      const c=this._ac||(this._ac=new(window.AudioContext||window.webkitAudioContext)());
      if(c.state==='suspended')c.resume();
      const o=c.createOscillator(),g=c.createGain();
      o.type=type||'sine';o.frequency.value=freq;
      const t=c.currentTime+(delay||0);
      g.gain.setValueAtTime(gain||0.15,t);
      g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
      o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+dur);
    }catch(e){}
  },
  _noise(dur,vol,delay){
    if(!this.sndOn)return;
    try{
      const c=this._ac||(this._ac=new(window.AudioContext||window.webkitAudioContext)());
      if(c.state==='suspended')c.resume();
      const buf=c.createBuffer(1,c.sampleRate*dur,c.sampleRate);
      const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      const src=c.createBufferSource(),g=c.createGain(),f=c.createBiquadFilter();
      f.type='bandpass';f.frequency.value=2000;f.Q.value=0.5;
      src.buffer=buf;src.connect(f);f.connect(g);g.connect(c.destination);
      const t=c.currentTime+(delay||0);
      g.gain.setValueAtTime(vol||0.08,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
      src.start(t);src.stop(t+dur);
    }catch(e){}
  },
  sndCard(d){
    const p=240+Math.random()*80,v=0.07+Math.random()*0.06;
    this._noise(0.034+Math.random()*0.012,0.09+Math.random()*0.05,d);
    this._beep(p,0.05+Math.random()*0.025,v,'triangle',d);
  },
  sndThud(){
    this._beep(55,0.11,0.3,'sine',0);this._beep(110,0.06,0.15,'sine',0);
    this._noise(0.055,0.2,0);
  },
  _chipSnd:localStorage.getItem('volt-chip-snd')||'casino',
  _customBuf:null,_customName:'',_chipAudio:null,
  sndChip(){
    // light tick on tray pickup
    this._beep(1600,0.03,0.07,'sine',0);
  },
  sndChipLand(){
    if(!this.sndOn)return;
    // use loaded audio file if available
    if(this._chipAudio){
      this._chipAudio.currentTime=0;
      this._chipAudio.play().catch(()=>{});
      return;
    }
    ({
      casino:()=>this._sndCasino(),
      coin:  ()=>this._sndCoin(),
      soft:  ()=>this._sndSoft(),
      glass: ()=>this._sndGlass(),
      retro: ()=>this._sndRetro(),
    }[this._chipSnd]||this._sndCasino).call(this);
  },
  _sndCasino(){
    // clay chip: crack + ceramic ring + thud
    try{
      const c=this._ac||(this._ac=new(window.AudioContext||window.webkitAudioContext)());
      if(c.state==='suspended')c.resume();const t=c.currentTime;
      const buf=c.createBuffer(1,Math.ceil(c.sampleRate*0.009),c.sampleRate);
      const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
      const src=c.createBufferSource(),bf=c.createBiquadFilter(),bg=c.createGain();
      bf.type='bandpass';bf.frequency.value=3800+Math.random()*600;bf.Q.value=3;
      bg.gain.setValueAtTime(0.5,t);bg.gain.exponentialRampToValueAtTime(0.001,t+0.009);
      src.buffer=buf;src.connect(bf);bf.connect(bg);bg.connect(c.destination);src.start(t);src.stop(t+0.01);
      const ro=c.createOscillator(),rg=c.createGain();
      ro.type='sine';ro.frequency.value=1900+Math.random()*400;
      rg.gain.setValueAtTime(0.16,t);rg.gain.exponentialRampToValueAtTime(0.001,t+0.13);
      ro.connect(rg);rg.connect(c.destination);ro.start(t);ro.stop(t+0.14);
      const to=c.createOscillator(),tg=c.createGain();
      to.type='sine';to.frequency.setValueAtTime(200,t);to.frequency.exponentialRampToValueAtTime(65,t+0.05);
      tg.gain.setValueAtTime(0.25,t);tg.gain.exponentialRampToValueAtTime(0.001,t+0.06);
      to.connect(tg);tg.connect(c.destination);to.start(t);to.stop(t+0.06);
    }catch(e){}
  },
  _sndCoin(){
    // metallic coin: bright harmonics, medium ring
    try{
      const c=this._ac||(this._ac=new(window.AudioContext||window.webkitAudioContext)());
      if(c.state==='suspended')c.resume();const t=c.currentTime;
      [[800,0.35,0.22],[1600,0.25,0.14],[2400,0.18,0.08]].forEach(([f,dur,gain])=>{
        const o=c.createOscillator(),g=c.createGain();
        o.type='sine';o.frequency.value=f+Math.random()*30;
        g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);
        o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+dur);
      });
      const buf=c.createBuffer(1,Math.ceil(c.sampleRate*0.006),c.sampleRate);
      const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
      const src=c.createBufferSource(),bf=c.createBiquadFilter(),bg=c.createGain();
      bf.type='highpass';bf.frequency.value=4000;
      bg.gain.setValueAtTime(0.3,t);bg.gain.exponentialRampToValueAtTime(0.001,t+0.006);
      src.buffer=buf;src.connect(bf);bf.connect(bg);bg.connect(c.destination);src.start(t);src.stop(t+0.007);
    }catch(e){}
  },
  _sndSoft(){
    // muted felt thump — quiet, low, no ring
    this._noise(0.018,0.22,0);
    this._beep(180,0.04,0.12,'sine',0);
    this._beep(90,0.06,0.08,'sine',0.005);
  },
  _sndGlass(){
    // crystal ping — high freq, long sustain
    try{
      const c=this._ac||(this._ac=new(window.AudioContext||window.webkitAudioContext)());
      if(c.state==='suspended')c.resume();const t=c.currentTime;
      [[3200,0.7,0.14],[6400,0.4,0.06],[1600,0.3,0.05]].forEach(([f,dur,gain])=>{
        const o=c.createOscillator(),g=c.createGain();
        o.type='sine';o.frequency.value=f;
        g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+0.004);
        g.gain.exponentialRampToValueAtTime(0.001,t+dur);
        o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+dur+0.01);
      });
    }catch(e){}
  },
  _sndRetro(){
    // 8-bit arcade bleep
    this._beep(880,0.04,0.18,'square',0);
    this._beep(1320,0.03,0.10,'square',0.03);
    this._beep(660,0.05,0.08,'square',0.05);
  },
  _sndCustom(){
    if(!this._customBuf)return this._sndCasino();
    try{
      const c=this._ac||(this._ac=new(window.AudioContext||window.webkitAudioContext)());
      if(c.state==='suspended')c.resume();
      const src=c.createBufferSource(),g=c.createGain();
      src.buffer=this._customBuf;g.gain.value=0.9;
      src.connect(g);g.connect(c.destination);src.start();
    }catch(e){}
  },
  async _loadCustomFile(file){
    try{
      const c=this._ac||(this._ac=new(window.AudioContext||window.webkitAudioContext)());
      const ab=await file.arrayBuffer();
      this._customBuf=await c.decodeAudioData(ab);
      this._customName=file.name;
      this._chipSnd='custom';
      localStorage.setItem('volt-chip-snd','custom');
      // update button label
      const btn=document.querySelector('.bj2sndopt[data-v="custom"]');
      if(btn)btn.textContent='📁 '+file.name.replace(/\.[^.]+$/,'').slice(0,10);
      document.querySelectorAll('.bj2sndopt').forEach(b=>b.classList.toggle('on',b===btn));
      this._sndCustom(); // preview
    }catch(e){
      if(window.showToast)showToast({icon:'⚠',title:'Audio error',sub:'Could not decode file: '+e.message});
    }
  },
  async _tryLoadProjectFile(){
    // silently try to load sounds/chip.wav or sounds/chip.mp3 if present
    for(const f of['sounds/GAMEMisc_blackjack Poker chips (ID 0942)_com.mp3','sounds/chip.wav','sounds/chip.mp3','sounds/chip.ogg']){
      try{
        const res=await fetch(f);if(!res.ok)continue;
        const ab=await res.arrayBuffer();
        const c=this._ac||(this._ac=new(window.AudioContext||window.webkitAudioContext)());
        this._customBuf=await c.decodeAudioData(ab);
        this._customName=f;
        if(this._chipSnd==='custom'){
          const btn=document.querySelector('.bj2sndopt[data-v="custom"]');
          if(btn)btn.textContent='📁 '+f.split('/').pop().replace(/\.[^.]+$/,'');
        }
        return true;
      }catch(e){continue;}
    }
    return false;
  },
  sndWin(){[523,659,784,1047].forEach((f,i)=>this._beep(f,0.3,0.15,'sine',i*0.1));},
  sndBJ(){
    [523,659,784,1047,1319].forEach((f,i)=>this._beep(f,0.4,0.2,'sine',i*0.08));
    this._T.push(setTimeout(()=>this._beep(1047,0.6,0.25,'sine'),500));
  },
  sndLose(){[300,240,200].forEach((f,i)=>this._beep(f,0.2,0.1,'sawtooth',i*0.12));},
  sndFlip(){this._beep(400,0.1,0.1,'sine',0);this._beep(600,0.08,0.08,'sine',0.05);},

  /* ── confetti ── */
  _cv:null,_cctx:null,_cp:[],_craf:0,
  _launchConfetti(){
    if(!this._cv)return;
    this._cv.width=window.innerWidth;this._cv.height=window.innerHeight;
    const cols=['#f5c842','#22dd66','#1a9fff','#e8304a','#c0a0ff','#fff'];
    this._cp=Array.from({length:110},()=>({
      x:Math.random()*this._cv.width,y:-10,
      vx:(Math.random()-0.5)*6,vy:Math.random()*4+2,
      rot:Math.random()*360,rotV:(Math.random()-0.5)*8,
      w:Math.random()*10+6,h:Math.random()*5+4,
      color:cols[Math.floor(Math.random()*cols.length)],life:1
    }));
    cancelAnimationFrame(this._craf);
    const tick=()=>{
      this._cctx.clearRect(0,0,this._cv.width,this._cv.height);
      this._cp=this._cp.filter(p=>p.life>0.01);
      this._cp.forEach(p=>{
        p.x+=p.vx;p.y+=p.vy;p.vy+=0.12;p.rot+=p.rotV;
        if(p.y>this._cv.height)p.life=0;
        this._cctx.save();this._cctx.globalAlpha=p.life;
        this._cctx.translate(p.x,p.y);this._cctx.rotate(p.rot*Math.PI/180);
        this._cctx.fillStyle=p.color;this._cctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
        this._cctx.restore();
      });
      if(this._cp.length)this._craf=requestAnimationFrame(tick);
      else this._cctx.clearRect(0,0,this._cv.width,this._cv.height);
    };
    this._craf=requestAnimationFrame(tick);
  },

  /* ── chip helpers ── */
  _chipCol(v){
    if(v>=100)return{bg:'#c0392b',label:'$100'};
    if(v>=50) return{bg:'#8e44ad',label:'$50'};
    if(v>=25) return{bg:'#1e8449',label:'$25'};
    if(v>=10) return{bg:'#1a6fa8',label:'$10'};
    if(v>=5)  return{bg:'#cb4335',label:'$5'};
    return          {bg:'#2471a3',label:'$1'};
  },
  _drawChipCanvas(val,SIZE,label){
    const PAD=6,cv=document.createElement('canvas');
    cv.width=SIZE+PAD*2;cv.height=SIZE+PAD*2;
    const cc=this._chipCol(val),ctx=cv.getContext('2d');
    const cx=SIZE/2+PAD,cy=SIZE/2+PAD,r=SIZE/2-2;
    ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=cc.bg;ctx.fill();
    ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=2.2;ctx.stroke();
    ctx.setLineDash([3,3]);
    ctx.beginPath();ctx.arc(cx,cy,r-5,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=1.2;ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='#fff';
    ctx.font=`bold ${SIZE>40?10:8}px Inter,system-ui,sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(label||cc.label,cx,cy);
    return cv;
  },

  /* ── chip toss animation ── */
  _throwChip(fromEl,toX,toY,cryptoAmt,onDone){
    const w=curW(),fiat=Math.max(1,Math.round(cryptoAmt*w.rate));
    const from=fromEl.getBoundingClientRect();
    const SIZE=48,PAD=8;
    const cv=this._drawChipCanvas(fiat,SIZE);
    cv.style.cssText=`position:fixed;pointer-events:none;z-index:9999;
      left:${from.left+from.width/2-SIZE/2-PAD}px;
      top:${from.top+from.height/2-SIZE/2-PAD}px;will-change:transform`;
    document.body.appendChild(cv);
    const startX=parseFloat(cv.style.left),startY=parseFloat(cv.style.top);
    const destX=toX-SIZE/2-PAD,destY=toY-SIZE/2-PAD;
    const dur=500,start=performance.now();
    this.sndChip();
    const frame=now=>{
      const t=Math.min((now-start)/dur,1);
      const ease=t<0.5?2*t*t:-1+(4-2*t)*t;
      const x=startX+(destX-startX)*ease;
      const y=startY+(destY-startY)*ease-110*Math.sin(Math.PI*t);
      cv.style.left=x+'px';cv.style.top=y+'px';
      cv.style.transform=`rotate(${t*360}deg)`;
      cv.style.opacity=t>0.82?1-(t-0.82)/0.18:1;
      if(t<1)requestAnimationFrame(frame);
      else{cv.remove();if(onDone)onDone();}
    };
    requestAnimationFrame(frame);
  },

  /* ── bet stack on table ── */
  /* ── betting ring ── */
  _throwChipToCircle(fromBtn,usd){
    const ring=$id('bj2BetRing');if(!ring)return;
    const from=fromBtn.getBoundingClientRect();
    const to=ring.getBoundingClientRect();
    const SIZE=40,PAD=5;
    const cv=this._drawChipCanvas(Math.max(1,Math.round(usd)),SIZE);
    const sx=from.left+from.width/2-SIZE/2-PAD,sy=from.top+from.height/2-SIZE/2-PAD;
    const dx=to.left+to.width/2-SIZE/2-PAD,dy=to.top+to.height/2-SIZE/2-PAD;
    cv.style.cssText=`position:fixed;pointer-events:none;z-index:9999;left:${sx}px;top:${sy}px`;
    document.body.appendChild(cv);
    const dur=340,t0=performance.now();
    this.sndChip();
    const frame=now=>{
      const t=Math.min((now-t0)/dur,1);
      const e=t<0.5?2*t*t:-1+(4-2*t)*t;
      cv.style.left=(sx+(dx-sx)*e)+'px';
      cv.style.top=(sy+(dy-sy)*e-60*Math.sin(Math.PI*t))+'px';
      cv.style.transform=`rotate(${t*240}deg)`;
      cv.style.opacity=t>0.88?1-(t-0.88)/0.12:1;
      if(t<1)requestAnimationFrame(frame);
      else{
        cv.remove();
        this._betChips.push(usd);
        this._renderBetRing();
        this.sndChipLand();
      }
    };
    requestAnimationFrame(frame);
  },
  _renderBetRing(){
    const ring=$id('bj2BetRing'),stk=$id('bj2BRStk'),lbl=$id('bj2BRLbl');
    if(!ring||!stk)return;
    stk.innerHTML='';
    const chips=this._betChips;
    if(!chips.length){
      ring.classList.remove('has-chips');
      if(lbl){lbl.textContent='BET';lbl.classList.remove('active');}
      return;
    }
    ring.classList.add('has-chips');
    const S=40,show=chips.slice(-5);
    show.forEach((usd,i)=>{
      const c=this._drawChipCanvas(Math.max(1,Math.round(usd)),S);
      c.style.cssText=`position:absolute;left:50%;transform:translateX(-50%);bottom:${i*5}px;z-index:${i}`;
      stk.appendChild(c);
    });
    const w=curW(),totalUsd=chips.reduce((a,b)=>a+b,0);
    if(lbl){lbl.textContent=fmtW(w,totalUsd/w.rate)+' '+w.c;lbl.classList.add('active');}
  },
  _clearBetRing(){
    const ring=$id('bj2BetRing');
    if(ring){
      ring.style.transition='transform .12s ease-in,opacity .22s';
      ring.style.transform='scale(0.88)';ring.style.opacity='0';
      setTimeout(()=>{
        ring.style.cssText='';
        this._betChips=[];this._renderBetRing();
      },230);
    }else{this._betChips=[];}
  },

  /* ── win/loss float ── */
  _floatPnl(prof,w){
    const pz=$id('bj2PZ')||$id('bj2Sp');if(!pz)return;
    const rect=pz.getBoundingClientRect();if(!rect.width)return;
    const el=document.createElement('div');
    const isWin=prof>0,isPush=Math.abs(prof)<0.001;
    el.className='bj2float'+(isWin?' w':isPush?' p':' l');
    el.textContent=(isWin?'+':prof<0?'-':'')+'$'+(Math.abs(prof)*w.rate).toFixed(2);
    el.style.cssText=`left:${rect.left+rect.width/2}px;top:${rect.top+20}px`;
    document.body.appendChild(el);
    this._T.push(setTimeout(()=>{if(el.parentNode)el.remove();},1300));
  },

  /* ── card logic ── */
  _deck:[],
  _drawCard(){
    if(!this._deck.length){
      const suits='♠♥♦♣',ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
      this._deck=[];
      for(const s of suits)for(const r of ranks)
        this._deck.push({r,s,v:r==='A'?11:['J','Q','K','10'].includes(r)?10:+r});
      this._deck.sort(()=>Math.random()-0.5);
    }
    return this._deck.pop();
  },
  _val(hand){
    let t=hand.reduce((s,c)=>s+c.v,0),a=hand.filter(c=>c.r==='A').length;
    while(t>21&&a){t-=10;a--;}return t;
  },
  _isSoft(hand){
    let t=hand.reduce((s,c)=>s+c.v,0);
    const ta=hand.filter(c=>c.r==='A').length;if(!ta)return false;
    let a=ta,fl=0;while(t>21&&a){t-=10;a--;fl++;}
    return t<=21&&fl<ta;
  },
  _isNat(hand){return hand.length===2&&this._val(hand)===21;},
  _isPair(hand){return hand.length===2&&hand[0].v===hand[1].v;},

  /* ── card DOM ── */
  _OV:56,// card overlap offset px
  _ROTS:[0,-0.7,1.0,-0.5,0.8,-0.6],
  _SHADS:['0 6px 18px rgba(0,0,0,.48)','0 10px 26px rgba(0,0,0,.54)',
           '0 13px 30px rgba(0,0,0,.6)','0 15px 34px rgba(0,0,0,.63)',
           '0 17px 36px rgba(0,0,0,.65)','0 18px 38px rgba(0,0,0,.67)'],
  _makeCard(card,hidden,isPlayer,delayMs,idx){
    const el=document.createElement('div');
    el.className='bj2c'+(hidden?' back':'')+(isPlayer?' p':'');
    if(!hidden){
      const red=card.s==='♥'||card.s==='♦';
      if(red)el.classList.add('red');
      el.innerHTML=
        `<div class="bj2corner tl"><span class="cr">${card.r}</span><span class="cs">${card.s}</span></div>`+
        `<div class="bj2center-suit">${card.s}</div>`+
        `<div class="bj2corner br"><span class="cr">${card.r}</span><span class="cs">${card.s}</span></div>`;
    }
    const i=Math.min(idx||0,5);
    if(i>0)el.style.boxShadow=this._SHADS[i];
    if(delayMs)el.style.animationDelay=delayMs+'ms';
    el.classList.add('dealing');
    el.addEventListener('animationend',()=>{
      el.classList.remove('dealing');
      if(i>0)el.style.transform=`rotate(${this._ROTS[i]}deg)`;
    },{once:true});
    return el;
  },
  _renderStack(container,hand,hidden,isPlayer,stagger){
    container.innerHTML='';
    const OV=this._OV,totalW=Math.max(112,(hand.length-1)*OV+112);
    hand.forEach((card,i)=>{
      const isHidden=hidden&&i===0;
      const delay=stagger?i*120:0;
      const el=this._makeCard(card,isHidden,isPlayer,delay,i);
      el.style.left=i*OV+'px';
      container.appendChild(el);
      if(stagger&&!isHidden)this.sndCard(delay/1000);
    });
    container.style.width=totalW+'px';
  },
  _revealHole(){
    const h=this.h,el=$id('bj2DS')?.querySelector('.bj2c.back');if(!el)return;
    this.sndFlip();
    // phase 1: fold away to 90deg
    el.style.transition='transform .19s ease-in';
    el.style.transform='rotateY(90deg)';
    setTimeout(()=>{
      // swap to face
      const c=h.dealer[0],red=c.s==='♥'||c.s==='♦';
      el.className='bj2c'+(red?' red':'');
      el.innerHTML=
        `<div class="bj2corner tl"><span class="cr">${c.r}</span><span class="cs">${c.s}</span></div>`+
        `<div class="bj2center-suit">${c.s}</div>`+
        `<div class="bj2corner br"><span class="cr">${c.r}</span><span class="cs">${c.s}</span></div>`;
      // phase 2: unfold from -90deg
      el.style.transition='none';el.style.transform='rotateY(-90deg)';
      void el.offsetHeight;
      el.style.transition='transform .21s ease-out';
      el.style.transform='rotateY(0deg)';
      // thud + micro bounce on landing
      setTimeout(()=>{
        this.sndThud();
        el.style.transition='transform .1s ease-out';
        el.style.transform='scale(1.06) translateY(-3px)';
        setTimeout(()=>{
          el.style.transition='transform .12s ease-in';
          el.style.transform='scale(1) translateY(0)';
        },100);
      },210);
    },190);
  },
  _pill(hand,isDealer,hidden){
    if(!hand.length)return'';
    const v=this._val(hand);
    const cls=v>21?'bust':(!hidden&&this._isNat(hand))?'bj':isDealer?'d':'';
    return`<span class="bj2pill${cls?' '+cls:''}">${hidden?'?':v}</span>`;
  },

  /* ── render ── */
  render(stagger){
    const h=this.h;if(!h)return;
    const ds=$id('bj2DS'),ps=$id('bj2PS'),dl=$id('bj2DL'),pl=$id('bj2PL');
    if(!ds)return;
    this._renderStack(ds,h.dealer,h.hidden,false,stagger);
    dl.innerHTML='Dealer '+this._pill(h.dealer,true,h.hidden);
    if(h.splitDone){
      $id('bj2PZ').hidden=true;$id('bj2Sp').hidden=false;
      [0,1].forEach(i=>{
        if(!$id('bj2SS'+i))return;
        this._renderStack($id('bj2SS'+i),h.hands[i]||[],false,true,stagger);
        $id('bj2SL'+i).innerHTML='Hand '+(i+1)+' '+this._pill(h.hands[i]||[],false,false);
        $id('bj2SH'+i).classList.toggle('active',h.activeHand===i);
      });
    }else{
      $id('bj2PZ').hidden=false;$id('bj2Sp').hidden=true;
      this._renderStack(ps,h.hands[0],false,true,stagger);
      pl.innerHTML='You '+this._pill(h.hands[0],false,false);
    }
  },
  setMsg(txt,cls){
    const el=$id('bj2Msg');if(!el)return;
    el.textContent=txt;el.className='bj2msg'+(cls?' '+cls:'');
  },
  setFlush(cls){
    const el=$id('bj2Fl');if(!el)return;
    el.className='bj2fl';void el.offsetWidth;if(cls)el.classList.add(cls);
  },
  colorCards(cls){
    document.querySelectorAll('#bj2PS .bj2c.p,#bj2SS0 .bj2c.p,#bj2SS1 .bj2c.p').forEach(c=>{
      c.classList.remove('win','lose');if(cls)c.classList.add(cls);
    });
  },

  /* ── button state ── */
  label(){return this.h?'In Play…':'Deal';},
  syncBtn(){
    gvBetBtn.textContent=this.h?'In Play…':'Deal';gvBetBtn.disabled=!!this.h;
    document.querySelectorAll('.bj2traychip,.bj2tray-clr').forEach(b=>b.disabled=!!this.h);
  },
  _acts(on){
    const h=this.h,hit=$id('bj2Hit'),st=$id('bj2St'),db=$id('bj2Db'),sp=$id('bj2Sp2');
    if(!hit)return;
    const curH=h?h.hands[h.activeHand]:[];
    const curB=h?h.handBets[h.activeHand]:0;
    hit.disabled=!on||(h&&h.splitAces);st.disabled=!on;
    db.disabled=!(on&&curH.length===2&&curB>0&&curW().amt>=curB);
    sp.disabled=!(on&&this._isPair(curH)&&!h?.splitDone&&curW().amt>=curB);
  },

  /* ── sync bet ring with manual input edits ── */
  sync(){
    if(this.h||!this._betChips.length)return;
    const w=curW();
    const ringCrypto=this._betChips.reduce((a,b)=>a+b,0)/w.rate;
    const betCrypto=parseFloat(gvBetIn.value)||0;
    const tol=Math.max(ringCrypto,betCrypto)*1e-4+1e-9;
    if(Math.abs(betCrypto-ringCrypto)>tol){
      this._betChips=[];this._renderBetRing();
    }
  },
  onCur(){this.sync();},

  /* ── game flow ── */
  onBet(){this.deal();},
  deal(){
    if(this.h)return;
    const st=debitBet();if(!st)return;
    lockBet(true);gvBetBtn.disabled=true;
    this._T.forEach(clearTimeout);this._T=[];
    this._deck=[];
    const dealer=[this._drawCard(),this._drawCard()];
    const hand=[this._drawCard(),this._drawCard()];
    this.h={st,dealer,hands:[hand],handBets:[st.b],activeHand:0,
             hidden:true,splitDone:false,splitAces:false,insBet:0};
    this.setMsg('');
    this.syncBtn();
    // chip toss from ring (or deal button if ring empty) → card area
    const sr=gvStage.getBoundingClientRect();
    const toX=sr.left+sr.width/2,toY=sr.top+sr.height*0.28;
    const fromEl=this._betChips.length?($id('bj2BetRing')||gvBetBtn):gvBetBtn;
    this._throwChip(fromEl,toX,toY,st.b,()=>{
      this.render(true);
      this._T.push(setTimeout(()=>{
        if(dealer[1].r==='A'){
          this._acts(false);$id('bj2Ins').hidden=false;
        }else if(this._isNat(hand)){
          this._acts(false);this.setMsg('Blackjack!');
          this._T.push(setTimeout(()=>this.stand(),600));
        }else{
          this._acts(true);this.setMsg('Your move.');
        }
      },4*120+300));
    });
  },
  _cur(){return this.h.hands[this.h.activeHand];},
  hit(){
    const h=this.h;if(!h||h.splitAces)return;
    this._cur().push(this._drawCard());this.sndCard(0);this.render();
    const v=this._val(this._cur());
    if(v>21){this.setMsg('Bust!','l');this._acts(false);this._T.push(setTimeout(()=>this._next(),700));}
    else if(v===21)this._T.push(setTimeout(()=>this.stand(),300));
    else this._acts(true);
  },
  stand(){if(!this.h)return;this._next();},
  dbl(){
    const h=this.h;if(!h)return;
    const bet=h.handBets[h.activeHand];
    if(curW().amt<bet)return this.setMsg('Not enough to double.','l');
    creditTo(h.st.w,-bet);h.handBets[h.activeHand]*=2;
    const db=$id('bj2Db');
    if(db)this._throwChipToCircle(db,bet*h.st.w.rate);
    this._cur().push(this._drawCard());this.sndCard(0.08);this.render();
    this._T.push(setTimeout(()=>this._next(),300));
  },
  spl(){
    const h=this.h;if(!h||h.splitDone||!this._isPair(this._cur()))return;
    const bet=h.handBets[h.activeHand];
    if(curW().amt<bet)return this.setMsg('Not enough to split.','l');
    this.sndChip();creditTo(h.st.w,-bet);
    const isAce=h.hands[0][0].r==='A';
    const[c1,c2]=[h.hands[0][0],h.hands[0][1]];
    h.hands=[[c1,this._drawCard()],[c2,this._drawCard()]];
    h.handBets=[h.st.b,h.st.b];
    h.splitDone=true;h.splitAces=isAce;h.activeHand=0;
    this.setMsg(isAce?'Split Aces — one card each.':'Split — play Hand 1.');
    this.render(true);
    if(isAce)this._T.push(setTimeout(()=>this._next(),500));
    else this._acts(true);
  },
  _next(){
    const h=this.h;
    if(h.splitDone&&h.activeHand===0){
      h.activeHand=1;
      if(!h.splitAces){this.setMsg('Play Hand 2.');this.render();this._acts(true);}
      else{this.render();this._T.push(setTimeout(()=>this._resolve(),400));}
      return;
    }
    this._resolve();
  },
  _shouldHit(hand){
    const t=this._val(hand);
    if(t<17)return true;
    if(t===17&&this._isSoft(hand)&&this.ruleMode==='H17')return true;
    return false;
  },
  _resolve(){
    this._revealHole();
    this._T.push(setTimeout(()=>{
      const h=this.h;h.hidden=false;this.render();
      const allBust=h.hands.every(hand=>this._val(hand)>21);

      const hits=[];
      if(!allBust){
        const tmp=[...h.dealer];
        while(this._shouldHit(tmp)){const c=this._drawCard();h.dealer.push(c);tmp.push(c);hits.push(c);}
      }
      let hitDelay=0;
      hits.forEach((card,i)=>{
        hitDelay=(i+1)*420;
        this._T.push(setTimeout(()=>{
          const OV=this._OV,idx=2+i;
          const el=this._makeCard(h.dealer[idx],false,false,0,idx);
          el.style.left=idx*OV+'px';
          const ds=$id('bj2DS');if(ds)ds.appendChild(el);
          this.sndCard(0);
          const dl=$id('bj2DL');
          if(dl)dl.innerHTML='Dealer '+this._pill(h.dealer.slice(0,idx+1),true,false);
        },hitDelay));
      });
      this._T.push(setTimeout(()=>this._finish(),hitDelay+350));
    },520));
  },
  _settleHand(hand,bet){
    const p=this._val(hand),d=this._val(this.h.dealer);
    if(p>21)return{payout:0,r:'bust'};
    if(d>21)return{payout:bet*2,r:'win'};
    if(p>d) return{payout:bet*2,r:'win'};
    if(p<d) return{payout:0,   r:'lose'};
    return{payout:bet,r:'push'};
  },
  async _finish(){
    const h=this.h;
    this._acts(false);h.hidden=false;this.render();
    const dealerNat=this._isNat(h.dealer);
    let mainPayout=0,msgs=[],state='';

    if(!h.splitDone){
      const hand=h.hands[0],bet=h.handBets[0],p=this._val(hand);
      if(this._isNat(hand)&&!dealerNat){
        mainPayout=Math.round(bet*2.5*100)/100;
        msgs.push('Blackjack! Pays 3:2');state='w';this.sndBJ();this._launchConfetti();
      }else{
        const{payout,r}=this._settleHand(hand,bet);mainPayout=payout;
        const d=this._val(h.dealer);
        if(r==='bust'){msgs.push('Bust!');state='l';this.sndLose();}
        else if(r==='win'){msgs.push('You win! '+p+' vs '+d);state='w';this.sndWin();}
        else if(r==='lose'){msgs.push('Dealer wins. '+d+' vs '+p);state='l';this.sndLose();}
        else{msgs.push('Push — '+p);state='p';}
      }
    }else{
      h.hands.forEach((hand,i)=>{
        const bet=h.handBets[i],{payout,r}=this._settleHand(hand,bet);
        mainPayout+=payout;
        const lbl='Hand '+(i+1)+' ('+this._val(hand)+')';
        if(r==='bust'){msgs.push(lbl+': Bust');if(state!=='w')state='l';}
        else if(r==='win'){msgs.push(lbl+': Win');state='w';}
        else if(r==='lose'){msgs.push(lbl+': Loss');if(state!=='w')state='l';}
        else{msgs.push(lbl+': Push');if(!state)state='p';}
      });
      if(state==='w')this.sndWin();else if(state==='l')this.sndLose();
    }
    let insPayout=0;
    if(h.insBet&&dealerNat){insPayout=h.insBet*3;msgs.push('Insurance wins 2:1');}

    const w=h.st.w;
    const totalWagered=h.handBets.reduce((a,b)=>a+b,0)+(h.insBet||0);
    const totalPayout=mainPayout+insPayout;
    const mult=totalWagered>0?totalPayout/totalWagered:0;
    const prof=totalPayout-totalWagered;

    // visual updates — immediate
    this._floatPnl(prof,w);
    this._clearBetRing();
    this.colorCards(state==='w'?'win':state==='l'?'lose':'');
    this.setMsg(msgs.join(' · '),state);
    this.setFlush(state==='w'?'w':state==='l'?'l':'');

    // session stats — immediate
    gsession.wag+=totalWagered*w.rate;gsession.prof+=prof*w.rate;
    if(prof>0)gsession.w++;else if(prof<0)gsession.l++;
    addXp(totalWagered*w.rate);
    if(window.addRakeback)addRakeback(totalWagered*w.rate);
    renderSession();
    pushChip(mult,state==='w');
    if(state==='w')pushFeed('You','Blackjack',Math.max(0,prof)*w.rate,true);

    // clear round state; keep button locked until server responds
    this.h=null;
    gvBetBtn.disabled=true;gvBetBtn.textContent='Settling…';

    // server settlement
    try{
      const res=await placeBet({
        game:'blackjack',
        currency:w.c,
        wager:totalWagered,
        params:{
          outcome:state==='w'?'win':state==='l'?'lose':'push',
          multiplier:parseFloat(mult.toFixed(6)),
          dealer:h.dealer.map(c=>c.r+c.s).join(','),
          hands:h.hands.map(hand=>hand.map(c=>c.r+c.s).join(',')).join('|'),
          insBet:h.insBet||0
        }
      });
      // server is source of truth for balance
      w.amt=res.new_balance;w.fiat=w.amt*w.rate;renderWallet();
    }catch(err){
      // server unreachable — apply payout client-side so player isn't stuck
      if(totalPayout>0)creditTo(w,totalPayout);
      if(window.showToast)showToast({icon:'⚠',title:'Settlement error',sub:err.message});
    }

    lockBet(false);this.syncBtn();
  },

  /* ── insurance ── */
  _insYes(){
    const h=this.h,side=h.st.b/2;
    if(side<=0||curW().amt<side){$id('bj2Ins').hidden=true;this._insNo();return;}
    this.sndChip();creditTo(h.st.w,-side);h.insBet=side;
    $id('bj2Ins').hidden=true;this.render();
    if(this._val(h.dealer)===21){
      h.hidden=false;this.render();this._T.push(setTimeout(()=>this._finish(),400));
    }else{
      this._acts(true);this.setMsg('No dealer Blackjack. Your move.');
      if(this._isNat(h.hands[0]))this._T.push(setTimeout(()=>this.stand(),600));
    }
  },
  _insNo(){
    const h=this.h;$id('bj2Ins').hidden=true;
    if(this._val(h.dealer)===21){
      h.hidden=false;this.render();this._T.push(setTimeout(()=>this._finish(),400));
    }else{
      this._acts(true);this.setMsg('Your move.');
      if(this._isNat(h.hands[0]))this._T.push(setTimeout(()=>this.stand(),600));
    }
  },

  /* ── mount ── */
  mount(){
    if(!document.getElementById('bj2css')){
      const s=document.createElement('style');s.id='bj2css';
      s.textContent=`
/* TABLE — casino felt green */
.bj2tbl{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:space-between;padding:14px 12px 44px;overflow:hidden;
  background:radial-gradient(ellipse at 50% 30%,#2d8a52 0%,#1c6639 40%,#0e4225 72%,#071c10 100%)}
/* felt weave texture */
.bj2tbl::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:
    repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(0,0,0,.04) 3px,rgba(0,0,0,.04) 6px),
    repeating-linear-gradient(-45deg,transparent,transparent 3px,rgba(0,0,0,.04) 3px,rgba(0,0,0,.04) 6px)}
/* vignette */
.bj2tbl::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse at 50% 50%,transparent 38%,rgba(0,0,0,.42) 100%)}

/* zones */
.bj2zone{display:flex;flex-direction:column;align-items:center;gap:8px;z-index:2}
.bj2lbl{font-size:9px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;
  color:rgba(255,255,255,.45);display:flex;align-items:center;gap:7px;min-height:22px}
.bj2pill{background:#1fcc55;color:#003a18;padding:2px 8px;border-radius:999px;
  font-size:11px;font-weight:800;min-width:24px;text-align:center}
.bj2pill.bust{background:#e8304a;color:#fff}
.bj2pill.bj{background:#f5c842;color:#3a2000}
.bj2pill.d{background:rgba(0,0,0,.45);color:#c8dff0;border:1px solid rgba(255,255,255,.15)}

/* card stacks */
.bj2stk{position:relative;min-height:148px;min-width:112px;display:flex;align-items:center;perspective:700px}

/* cards */
.bj2c{position:absolute;width:104px;height:144px;border-radius:12px;background:#fff;
  box-shadow:0 6px 18px rgba(0,0,0,.48);overflow:hidden;user-select:none}
.bj2corner{position:absolute;display:flex;flex-direction:column;align-items:center;gap:0px;line-height:1;padding:8px 9px}
.bj2corner.tl{top:0;left:0}
.bj2corner.br{bottom:0;right:0;transform:rotate(180deg)}
.bj2c .cr{font-size:26px;font-weight:900;color:#1a2634;line-height:1}
.bj2c .cs{font-size:18px;color:#1a2634;line-height:1.1}
.bj2center-suit{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  font-size:42px;opacity:.12;pointer-events:none;line-height:1}
.bj2c.red .cr,.bj2c.red .cs{color:#cc1a2e}
.bj2c.back{background:linear-gradient(145deg,#1a6fd6 0%,#0d55b8 55%,#0840a0 100%);
  border:2px solid rgba(255,255,255,.28)}
.bj2c.back::after{content:"";position:absolute;inset:6px;border-radius:5px;
  border:1.5px solid rgba(255,255,255,.2);
  background:repeating-linear-gradient(45deg,rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 2px,transparent 2px,transparent 6px)}
.bj2c.p{border:2px solid rgba(255,255,255,.5)}
.bj2c.p.win{border-color:#22dd66;box-shadow:0 0 0 2px rgba(34,221,102,.2),0 8px 22px rgba(0,0,0,.5)}
.bj2c.p.lose{border-color:#e8304a;box-shadow:0 0 0 2px rgba(232,48,74,.2),0 8px 22px rgba(0,0,0,.5)}
@keyframes bj2deal{from{opacity:0;transform:translateY(-28px) scale(.84) rotate(-5deg)}to{opacity:1;transform:none}}
.bj2c.dealing{animation:bj2deal .32s cubic-bezier(.22,1,.36,1) both}

/* chip tray */
.bj2tray{display:flex;gap:7px;margin-bottom:4px;flex-wrap:wrap}
.bj2traychip{width:46px;height:46px;border-radius:50%;border:none;cursor:pointer;
  font-size:10px;font-weight:900;color:#fff;letter-spacing:-.01em;
  box-shadow:0 4px 10px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.25),inset 0 -2px 0 rgba(0,0,0,.25);
  outline:2px dashed rgba(255,255,255,.3);outline-offset:-5px;
  transition:transform .1s,filter .1s;font-family:inherit}
.bj2traychip:hover:not(:disabled){transform:translateY(-3px) scale(1.1);filter:brightness(1.18)}
.bj2traychip:active:not(:disabled){transform:scale(.93)}
.bj2traychip:disabled{opacity:.3;cursor:not-allowed}
.bj2traychip[data-v="1"]  {background:#2471a3}
.bj2traychip[data-v="5"]  {background:#c0392b}
.bj2traychip[data-v="25"] {background:#1e8449}
.bj2traychip[data-v="100"]{background:#8e44ad}
.bj2traychip[data-v="500"]{background:#c9a227;color:#1a1100}
.bj2tray-bar{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.bj2tray-clr{height:26px;padding:0 11px;border:1px solid rgba(255,255,255,.1);border-radius:6px;
  background:rgba(255,255,255,.05);color:rgba(255,255,255,.38);
  font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:.1s}
.bj2tray-clr:hover{background:rgba(255,255,255,.1);color:rgba(255,255,255,.65)}

/* center section: arc + ribbon */
.bj2center{display:flex;flex-direction:column;align-items:center;gap:6px;z-index:2;width:100%}
.bj2arc-svg{width:min(460px,88%);height:22px;overflow:visible}
.bj2rib{font-size:7.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;
  color:rgba(255,255,255,.22);padding:3px 0;width:100%;text-align:center;
  border-top:1px solid rgba(195,155,55,.2);border-bottom:1px solid rgba(195,155,55,.2)}

/* betting ring */
.bj2ring-wrap{display:flex;flex-direction:column;align-items:center;gap:6px;z-index:2}
.bj2betring{
  position:relative;width:90px;height:90px;border-radius:50%;
  border:2.5px dashed rgba(195,155,55,.4);
  box-shadow:0 0 0 5px rgba(195,155,55,.05),inset 0 0 22px rgba(0,0,0,.22);
  display:flex;align-items:center;justify-content:center;
  transition:border-color .25s,box-shadow .25s;
}
.bj2betring.has-chips{
  border-color:rgba(245,200,66,.8);border-style:solid;
  box-shadow:0 0 0 5px rgba(245,200,66,.1),0 0 22px rgba(245,200,66,.2),inset 0 0 22px rgba(0,0,0,.22);
}
.bj2br-stk{position:relative;width:50px;height:50px}
.bj2br-lbl{
  font-size:9.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
  color:rgba(255,255,255,.25);padding:2px 9px;border-radius:5px;
  background:rgba(0,0,0,.35);white-space:nowrap;transition:color .25s,background .25s;
}
.bj2br-lbl.active{color:#f5c842;background:rgba(0,0,0,.6)}

/* split */
.bj2sp{display:flex;gap:40px;z-index:2;align-items:flex-start}
.bj2sh{display:flex;flex-direction:column;align-items:center;gap:8px}
.bj2sh .bj2lbl{font-size:8.5px}
.bj2sh.active .bj2lbl{color:#4dc8ff}

/* overlays */
.bj2msg{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);
  font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
  padding:5px 14px;border-radius:7px;white-space:nowrap;pointer-events:none;z-index:10;
  transition:background .2s,border-color .2s,color .2s;
  background:transparent;color:transparent;border:1px solid transparent}
.bj2msg.w{background:rgba(14,70,38,.96);border-color:#2a9a5a;color:#a0ffcc}
.bj2msg.l{background:rgba(74,14,22,.96);border-color:#c03040;color:#ffaaaa}
.bj2msg.p{background:rgba(30,46,66,.96);border-color:#4a6a94;color:#a0c8e8}
.bj2fl{position:absolute;inset:0;pointer-events:none;z-index:1}
@keyframes bj2fw{0%{opacity:0}20%{opacity:1}80%{opacity:1}100%{opacity:0}}
.bj2fl.w{background:radial-gradient(ellipse at 50% 75%,rgba(34,200,90,.22),transparent 65%);animation:bj2fw 1.4s ease forwards}
.bj2fl.l{background:radial-gradient(ellipse at 50% 75%,rgba(220,50,50,.2),transparent 65%);animation:bj2fw 1.4s ease forwards}

/* win/loss float */
.bj2float{position:fixed;pointer-events:none;z-index:999;font-size:21px;font-weight:900;
  letter-spacing:-.02em;transform:translateX(-50%);animation:bj2float 1.25s ease forwards}
.bj2float.w{color:#22dd66;text-shadow:0 2px 20px rgba(34,221,102,.6)}
.bj2float.l{color:#e8304a;text-shadow:0 2px 20px rgba(232,48,74,.5)}
.bj2float.p{color:#7ac8ff}
@keyframes bj2float{
  0%{opacity:0;transform:translateX(-50%) translateY(0)}
  18%{opacity:1}
  82%{opacity:1}
  100%{opacity:0;transform:translateX(-50%) translateY(-58px)}}

/* insurance */
.bj2ins{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:20;
  background:#112418;border:1px solid rgba(195,155,55,.35);border-radius:12px;
  padding:18px 20px;text-align:center;display:flex;flex-direction:column;gap:10px;
  align-items:center;min-width:200px;box-shadow:0 16px 48px rgba(0,0,0,.7)}
.bj2ins strong{font-size:13px;color:#f5e6a0}
.bj2ins p{font-size:10px;color:rgba(255,255,255,.5);line-height:1.55}
.bj2ins-btns{display:flex;gap:7px;width:100%}
.bj2ins-btn{flex:1;height:36px;border:none;border-radius:7px;font-size:12px;font-weight:700;
  cursor:pointer;font-family:inherit}
.bj2ins-btn.y{background:#1a5c30;color:#a0ffc8}
.bj2ins-btn.n{background:#1e2a38;color:#7a9ab4}

/* sidebar action buttons */
.bj2acts{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.bj2act{height:42px;border:none;border-radius:9px;font-size:13px;font-weight:800;
  cursor:pointer;transition:.12s;font-family:inherit}
.bj2act:hover:not(:disabled){filter:brightness(1.14);transform:translateY(-1px)}
.bj2act:disabled{opacity:.32;cursor:not-allowed;transform:none;filter:none}
.bj2act.hit{background:#1a7a40;color:#a0ffc0}
.bj2act.std{background:#2a3e52;color:#a0c8e8}
.bj2act.dbl{background:#7a4a10;color:#ffd080}
.bj2act.spl{background:#3a2a60;color:#c0a0ff}
.bj2rule{display:flex;gap:6px}
.bj2rbtn{flex:1;height:30px;border:1px solid rgba(255,255,255,.07);border-radius:7px;
  background:var(--panel-2,#1a2634);color:var(--muted,#4a6a84);font-size:11px;font-weight:700;
  cursor:pointer;transition:.12s;font-family:inherit}
.bj2rbtn.on{background:#1a3a54;color:#7ac8ff;border-color:rgba(26,159,255,.3)}`;
      document.head.appendChild(s);
    }

    // confetti canvas
    this._cv=document.createElement('canvas');
    this._cv.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:1000';
    document.body.appendChild(this._cv);
    this._cctx=this._cv.getContext('2d');

    engFields.innerHTML=`
      <div class="gv-field"><label>Bet Amount</label>
        <div class="bj2tray" id="bj2Tray">
          <button class="bj2traychip" data-v="1">$1</button>
          <button class="bj2traychip" data-v="5">$5</button>
          <button class="bj2traychip" data-v="25">$25</button>
          <button class="bj2traychip" data-v="100">$100</button>
          <button class="bj2traychip" data-v="500">$500</button>
        </div>
        <div class="bj2tray-bar">
          <button class="bj2tray-clr" id="bj2TrayClr">Clear</button>
        </div>
      </div>
      <div class="bj2acts">
        <button class="bj2act hit" id="bj2Hit">Hit <small>H</small></button>
        <button class="bj2act std" id="bj2St">Stand <small>S</small></button>
        <button class="bj2act dbl" id="bj2Db">Double <small>D</small></button>
        <button class="bj2act spl" id="bj2Sp2">Split <small>P</small></button>
      </div>
      <div class="eng-readout"><span>Dealer Rule</span>
        <div class="bj2rule">
          <button class="bj2rbtn${this.ruleMode==='H17'?' on':''}" id="bj2H17">H17</button>
          <button class="bj2rbtn${this.ruleMode==='S17'?' on':''}" id="bj2S17">S17</button>
        </div>
      </div>
      <input type="file" id="bj2SndFile" accept="audio/*" style="display:none">`;

    gvStage.innerHTML=`
      <div class="bj2tbl">
        <div class="bj2zone">
          <div class="bj2lbl" id="bj2DL">Dealer</div>
          <div class="bj2stk" id="bj2DS"></div>
        </div>
        <div class="bj2center">
          <svg class="bj2arc-svg" viewBox="0 0 500 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12,18 Q250,-6 488,18" stroke="rgba(195,155,55,.5)" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M12,21 Q250,-3 488,21" stroke="rgba(255,235,140,.18)" stroke-width="1" stroke-linecap="round"/>
          </svg>
          <div class="bj2rib">BLACKJACK PAYS 3:2 &nbsp;·&nbsp; INSURANCE PAYS 2:1 &nbsp;·&nbsp; DEALER STANDS ON 17</div>
        </div>
        <div class="bj2ring-wrap">
          <div class="bj2betring" id="bj2BetRing">
            <div class="bj2br-stk" id="bj2BRStk"></div>
          </div>
          <div class="bj2br-lbl" id="bj2BRLbl">BET</div>
        </div>
        <div class="bj2sp" id="bj2Sp" hidden>
          <div class="bj2sh" id="bj2SH0">
            <div class="bj2stk" id="bj2SS0"></div>
            <div class="bj2lbl" id="bj2SL0">Hand 1</div>
          </div>
          <div class="bj2sh" id="bj2SH1">
            <div class="bj2stk" id="bj2SS1"></div>
            <div class="bj2lbl" id="bj2SL1">Hand 2</div>
          </div>
        </div>
        <div class="bj2zone" id="bj2PZ">
          <div class="bj2stk" id="bj2PS"></div>
          <div class="bj2lbl" id="bj2PL">You</div>
        </div>
        <div class="bj2msg" id="bj2Msg">Place a bet and deal</div>
        <div class="bj2fl"  id="bj2Fl"></div>
        <div class="bj2ins" id="bj2Ins" hidden>
          <strong>🛡 Insurance?</strong>
          <p>Dealer shows Ace. Side bet costs ½ wager<br>— pays 2:1 if dealer has Blackjack.</p>
          <div class="bj2ins-btns">
            <button class="bj2ins-btn y" id="bj2IY">Take (2:1)</button>
            <button class="bj2ins-btn n" id="bj2IN">Decline</button>
          </div>
        </div>
      </div>`;

    $id('bj2Tray').addEventListener('click',e=>{
      const btn=e.target.closest('.bj2traychip');if(!btn||this.h)return;
      const usd=+btn.dataset.v,w=curW();
      const cur=parseFloat(gvBetIn.value)||0;
      const next=Math.min(+(cur+usd/w.rate).toFixed(8),w.amt);
      gvBetIn.value=fmtW(w,next);
      if(window.syncBetUI)syncBetUI();
      this._throwChipToCircle(btn,usd);
    });
    $id('bj2TrayClr').addEventListener('click',()=>{
      if(this.h)return;
      this._clearBetRing();
      const w=curW();gvBetIn.value=fmtW(w,0);
      if(window.syncBetUI)syncBetUI();
    });
    $id('bj2Hit').addEventListener('click',()=>this.hit());
    $id('bj2St').addEventListener('click', ()=>this.stand());
    $id('bj2Db').addEventListener('click', ()=>this.dbl());
    $id('bj2Sp2').addEventListener('click',()=>this.spl());
    $id('bj2IY').addEventListener('click', ()=>this._insYes());
    $id('bj2IN').addEventListener('click', ()=>this._insNo());
    $id('bj2SndFile').addEventListener('change',e=>{
      const file=e.target.files[0];if(file)this._loadCustomFile(file);
      e.target.value=''; // reset so same file can be re-picked
    });
    $id('bj2H17').addEventListener('click',()=>{
      if(this.h)return;this.ruleMode='H17';
      $id('bj2H17').classList.add('on');$id('bj2S17').classList.remove('on');
    });
    $id('bj2S17').addEventListener('click',()=>{
      if(this.h)return;this.ruleMode='S17';
      $id('bj2S17').classList.add('on');$id('bj2H17').classList.remove('on');
    });
    $id('gvSndSlot').innerHTML=`<button class="pl-snd" id="bj2Snd" aria-label="Toggle sound">${this.sndOn?'🔊':'🔇'}</button>`;
    $id('bj2Snd').addEventListener('click',()=>{
      this.sndOn=!this.sndOn;
      localStorage.setItem('volt-snd',this.sndOn?'on':'off');
      $id('bj2Snd').textContent=this.sndOn?'🔊':'🔇';
    });
    this._kh=e=>{
      if(e.target.tagName==='INPUT'||!this.h)return;
      const k=e.key.toUpperCase();
      if(k==='H'){const b=$id('bj2Hit');if(b&&!b.disabled)this.hit();}
      else if(k==='S'){const b=$id('bj2St');if(b&&!b.disabled)this.stand();}
      else if(k==='D'){const b=$id('bj2Db');if(b&&!b.disabled)this.dbl();}
      else if(k==='P'){const b=$id('bj2Sp2');if(b&&!b.disabled)this.spl();}
    };
    document.addEventListener('keydown',this._kh);
    this._acts(false);this.syncBtn();
    // preload chip sound file
    const chipFile='sounds/GAMEMisc_blackjack Poker chips (ID 0942)_com.mp3';
    const a=new Audio(chipFile);
    a.addEventListener('canplaythrough',()=>{this._chipAudio=a;},{once:true});
    a.addEventListener('error',()=>{this._tryLoadProjectFile();},{once:true});
    a.load();
  },

  /* ── unmount ── */
  unmount(){
    this._T.forEach(clearTimeout);this._T=[];
    cancelAnimationFrame(this._craf);
    if(this._cv){this._cv.remove();this._cv=null;this._cctx=null;}
    if(this._kh){document.removeEventListener('keydown',this._kh);this._kh=null;}
    if(this._chipAudio){this._chipAudio.pause();this._chipAudio=null;}
    const h=this.h;
    if(h){
      // refund all locally-deducted amounts on mid-round close
      const totalWagered=h.handBets.reduce((a,b)=>a+b,0)+(h.insBet||0);
      // attempt server refund; fallback to local credit
      placeBet({game:'blackjack',currency:h.st.w.c,wager:totalWagered,
        params:{outcome:'push',multiplier:1,dealer:'',hands:'',insBet:0}})
        .then(r=>{h.st.w.amt=r.new_balance;h.st.w.fiat=h.st.w.amt*h.st.w.rate;renderWallet();})
        .catch(()=>{creditTo(h.st.w,totalWagered);});
    }
    this.h=null;
  }
};
