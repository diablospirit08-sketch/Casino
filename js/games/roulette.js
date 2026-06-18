/* --- roulette (new SVG design) --- */
ORIGINALS['originals-roulette']={
  rtp:'97.3%',
  auto:false,
  bets:[],
  spinning:false,
  _wheelAngle:0,
  _chipVal:1,
  _ballAngle:null,
  _ballRadius:null,
  _history:[],
  _lastBets:[],
  _ac:null,
  _nbTimer:null,

  WHEEL:[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26],
  RED:new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]),
  PAYS:{straight:36,split:18,street:12,corner:9,sixline:6,dozen:3,column:3,half:2,color:2,evenodd:2},

  mount(){
    let s=document.getElementById('rl-css');
    if(!s){s=document.createElement('style');s.id='rl-css';document.head.appendChild(s);}
    s.textContent=this._css();
    engFields.innerHTML=`
      <div class="gv-field"><label>Chip</label>
        <div class="rl-chips" id="rlChips">
          ${[1,5,10,25,100,500].map((v,i)=>`<button class="rl-chip${i===0?' active':''}" data-v="${v}"></button>`).join('')}
        </div>
      </div>
      <div class="gv-field">
        <div class="rl-totals">
          <span>Total Bet <b id="rlTotal">—</b></span>
          <span>Max Win <b id="rlMaxWin">—</b></span>
        </div>
      </div>`;
    gvStage.innerHTML=`
      <div class="rl-wrap">
        <div class="rl-wheel-area">
          ${this._buildWheelSVG()}
          <div class="rl-ptr">▼</div>
          <div class="rl-res" id="rlRes"></div>
          <div class="rl-nb-label" id="rlNbLabel"></div>
        </div>
        <div class="rl-streak" id="rlStreak"></div>
        <div class="rl-table-wrap">
          ${this._tableHTML()}
        </div>
      </div>`;
    document.querySelectorAll('.rl-chip').forEach(btn=>{
      const cv=makeChipCanvas(+btn.dataset.v,120);
      cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:50%';
      btn.appendChild(cv);
    });
    document.getElementById('rlChips').addEventListener('click',e=>{
      const b=e.target.closest('.rl-chip');if(!b)return;
      this._chipVal=+b.dataset.v;
      document.querySelectorAll('.rl-chip').forEach(c=>c.classList.toggle('active',c===b));
    });
    document.getElementById('rlTable').addEventListener('click',e=>{
      if(this.spinning)return;
      const cell=e.target.closest('[data-bet-key]');if(!cell)return;
      this._addBet(cell.dataset.betType,cell.dataset.betKey,JSON.parse(cell.dataset.betNums));
    });
    document.getElementById('rlClear').addEventListener('click',()=>{
      if(this.spinning)return;
      this.bets=[];this._renderBets();this._syncInfo();this._syncBtn();
    });
    document.getElementById('rlRebet').addEventListener('click',()=>{
      if(this.spinning||!this._lastBets.length)return;
      this.bets=this._lastBets.map(b=>({...b}));
      this._renderBets();this._syncInfo();this._syncBtn();
    });
    document.getElementById('rlWheelSvg').addEventListener('click',e=>{
      if(this.spinning)return;
      const t=e.target.closest('[data-n]');if(!t)return;
      this._neighborBet(+t.dataset.n);
    });
    this._updateWheelSVG(this._wheelAngle);
    this._renderBets();this._renderStreak();this._syncInfo();this._syncBtn();
  },

  _addBet(type,key,numbers){
    const w=curW();
    const chipCrypto=this._chipVal/w.rate;
    const totalSoFar=this.bets.reduce((s,b)=>s+b.amount,0);
    if(totalSoFar+chipCrypto>w.amt+1e-9)return;
    const ex=this.bets.find(b=>b.key===key);
    if(ex){ex.amount+=chipCrypto;ex.fiat+=this._chipVal;}
    else this.bets.push({type,key,numbers,amount:chipCrypto,fiat:this._chipVal});
    this._sndChip();
    this._renderBets();this._syncInfo();this._syncBtn();
  },

  _renderBets(){
    document.querySelectorAll('.rl-bet-chip').forEach(e=>e.remove());
    for(const bet of this.bets){
      const cell=document.querySelector(`[data-bet-key="${bet.key}"]`);if(!cell)continue;
      const chip=document.createElement('div');chip.className='rl-bet-chip';
      chip.style.background=chipCfg(Math.round(bet.fiat)).c1;
      cell.appendChild(chip);
    }
  },

  _renderStreak(){
    const el=document.getElementById('rlStreak');if(!el)return;
    el.innerHTML=this._history.map(h=>`<span class="rl-sdot ${h.c}" title="${h.n}">${h.n}</span>`).join('');
  },

  _syncInfo(){
    const totalF=this.bets.reduce((s,b)=>s+b.fiat,0);
    const maxW=this.bets.reduce((s,b)=>s+b.fiat*(this.PAYS[b.type]||0),0);
    const rlTotal=document.getElementById('rlTotal');
    const rlMaxWin=document.getElementById('rlMaxWin');
    if(!rlTotal)return;
    rlTotal.textContent=totalF>0?'$'+totalF.toFixed(totalF<10?2:0):'—';
    rlMaxWin.textContent=maxW>0?'$'+maxW.toFixed(maxW<10?2:0):'—';
  },

  _syncBtn(){
    syncBetBtn();
    gvBetBtn.disabled=!this.bets.length||this.spinning;
    const rb=document.getElementById('rlRebet');
    if(rb)rb.disabled=this.spinning||!this._lastBets.length;
  },

  _neighborBet(n){
    const W=this.WHEEL,len=W.length,idx=W.indexOf(n);
    const nums=[-2,-1,0,1,2].map(d=>W[(idx+d+len)%len]);
    nums.forEach(ni=>this._addBet('straight',`str:${ni}`,[ni]));
    const lbl=document.getElementById('rlNbLabel');
    if(lbl){
      lbl.textContent=`Neighbors: ${nums.join(' · ')}`;
      lbl.classList.add('show');
      clearTimeout(this._nbTimer);
      this._nbTimer=setTimeout(()=>lbl.classList.remove('show'),2000);
    }
  },

  label(){
    if(this.spinning)return'Spinning…';
    return this.bets.length>0?'Spin':'Place Bets';
  },

  onBet(){if(!this.spinning&&this.bets.length>0)this._spin();},

  async _spin(){
    const authed=document.body.classList.contains('authed');
    const w=authed?curW():null;
    const totalC=this.bets.reduce((s,b)=>s+b.amount,0);
    if(totalC<=0)return;
    if(authed&&totalC>w.amt+1e-9)return;
    this.spinning=true;lockBet(true);gvBetBtn.disabled=true;gvBetBtn.textContent='Spinning…';
    let res=null,spinResult=null;
    if(authed){
      w.amt-=totalC;w.fiat=w.amt*w.rate;renderWallet();
      const st={w,b:totalC,name:'Roulette'};
      try{
        res=await placeBet({game:'roulette',currency:w.c,wager:totalC,
          params:{bets:this.bets.map(b=>({type:b.type,numbers:b.numbers,amount:b.amount}))}});
        spinResult=res.gameData.result;
      }catch(err){
        /* live call failed — refund and fall through to demo spin */
        w.amt+=totalC;w.fiat=w.amt*w.rate;renderWallet();
        res=null;
      }
    }
    /* demo / fallback: pick random result locally */
    if(spinResult===null||spinResult===undefined)
      spinResult=this.WHEEL[Math.floor(Math.random()*37)];
    await this._animateWheel(spinResult);
    const col=spinResult===0?'green':this.RED.has(spinResult)?'red':'black';
    const rlRes=document.getElementById('rlRes');
    if(rlRes){rlRes.textContent=spinResult;rlRes.className='rl-res show '+col;}
    if(res){
      const st={w,b:totalC,name:'Roulette'};
      serverSettleBet(st,res.multiplier,res.new_balance);
      if(res.multiplier>1)this._sndWin();else this._sndLose();
    }else{
      const won=this.bets.some(b=>b.numbers.includes(spinResult));
      if(won)this._sndWin();else this._sndLose();
    }
    this._history.unshift({n:spinResult,c:col});
    if(this._history.length>20)this._history.pop();
    this._renderStreak();
    this._flashWin(spinResult);
    await new Promise(r=>setTimeout(r,2500));
    this._ballRadius=null;
    this._updateWheelSVG(this._wheelAngle);
    this.spinning=false;this._lastBets=this.bets.map(b=>({...b}));this.bets=[];this._renderBets();this._syncInfo();
    if(rlRes)rlRes.className='rl-res';
    lockBet(false);this._syncBtn();
  },

  async _animateWheel(result){
    const seg=(Math.PI*2)/37;
    const idx=this.WHEEL.indexOf(result);
    const target=-idx*seg;
    const diff=((target-this._wheelAngle)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
    const spins=5+Math.random()*2;
    const wheelEnd=this._wheelAngle+spins*Math.PI*2+diff;
    const wheelStart=this._wheelAngle;
    const ballSpins=8+Math.random()*2;
    const extraOffset=Math.random()*Math.PI*2;
    const ballStart=-Math.PI/2+ballSpins*Math.PI*2+extraOffset;
    const ballEnd=-Math.PI/2;
    const BALL_OUT=83,BALL_IN=60;
    const dur=4800,t0=performance.now();
    this._sndSpin(dur);
    this._scheduleBallClicks(dur);
    return new Promise(resolve=>{
      const frame=now=>{
        const t=Math.min((now-t0)/dur,1);
        const we=1-Math.pow(1-t,3);
        this._wheelAngle=wheelStart+(wheelEnd-wheelStart)*we;
        const be=1-Math.pow(1-Math.min(t/0.9,1),2.5);
        this._ballAngle=ballStart+(ballEnd-ballStart)*be;
        if(t<0.65){
          this._ballRadius=BALL_OUT;
        }else{
          const dr=(t-0.65)/0.35,de=dr*dr;
          this._ballRadius=BALL_OUT-(BALL_OUT-BALL_IN)*de;
        }
        this._updateWheelSVG(this._wheelAngle);
        if(t<1)requestAnimationFrame(frame);else resolve();
      };
      requestAnimationFrame(frame);
    });
  },

  _updateWheelSVG(angle){
    const deg=(angle*180/Math.PI).toFixed(2);
    const spin=document.getElementById('rlSpinGroup');
    const turret=document.getElementById('rlTurretGroup');
    if(spin)spin.setAttribute('transform',`rotate(${deg} 250 250)`);
    if(turret)turret.setAttribute('transform',`rotate(${deg} 250 250)`);
    const ball=document.getElementById('rlBall');
    if(!ball)return;
    if(this._ballRadius===null){ball.style.display='none';return;}
    ball.style.display='';
    /* map canvas r (60-83) → SVG r (181-210): inside pocket zone to outer track */
    const r_svg=181+(210-181)*(this._ballRadius-60)/(83-60);
    ball.setAttribute('cx',(250+r_svg*Math.cos(this._ballAngle)).toFixed(1));
    ball.setAttribute('cy',(250+r_svg*Math.sin(this._ballAngle)).toFixed(1));
  },

  _buildWheelSVG(){
    const cx=250,cy=250,N=37,seg=360/N;
    const R2=195,R1=168,rT=181;
    const f=n=>n.toFixed(1);
    const rad=d=>d*Math.PI/180;
    let pockets='',numbers='',frets='';
    for(let i=0;i<N;i++){
      const n=this.WHEEL[i];
      const theta=i*seg;
      const a1=rad(-90+theta-seg/2),a2=rad(-90+theta+seg/2);
      const x1o=cx+R2*Math.cos(a1),y1o=cy+R2*Math.sin(a1);
      const x2o=cx+R2*Math.cos(a2),y2o=cy+R2*Math.sin(a2);
      const x1i=cx+R1*Math.cos(a1),y1i=cy+R1*Math.sin(a1);
      const x2i=cx+R1*Math.cos(a2),y2i=cy+R1*Math.sin(a2);
      const d=`M${f(x1o)} ${f(y1o)} A${R2} ${R2} 0 0 1 ${f(x2o)} ${f(y2o)} L${f(x2i)} ${f(y2i)} A${R1} ${R1} 0 0 0 ${f(x1i)} ${f(y1i)} Z`;
      const fill=n===0?'#1E7A3C':(this.RED.has(n)?'#C81E29':'#14181F');
      pockets+=`<path d="${d}" fill="${fill}" stroke="#0E0E12" stroke-width="0.5" data-n="${n}" style="cursor:pointer"/>`;
      const at=rad(-90+theta);
      const tx=cx+rT*Math.cos(at),ty=cy+rT*Math.sin(at);
      numbers+=`<text x="${f(tx)}" y="${f(ty)}" transform="rotate(${f(theta)} ${f(tx)} ${f(ty)})" fill="#fff" font-size="12" font-weight="700" font-family="Sora,Inter,system-ui,sans-serif" text-anchor="middle" dominant-baseline="central" data-n="${n}" style="cursor:pointer;pointer-events:all">${n}</text>`;
      frets+=`<line x1="${f(cx+130*Math.cos(a1))}" y1="${f(cy+130*Math.sin(a1))}" x2="${f(cx+R2*Math.cos(a1))}" y2="${f(cy+R2*Math.sin(a1))}" stroke="#E8C765" stroke-width="2.2" stroke-linecap="round"/>`;
    }
    let deflectors='';
    for(let i=0;i<8;i++){
      const a=rad(i*45-90);
      const x=cx+224*Math.cos(a),y=cy+224*Math.sin(a);
      deflectors+=`<rect x="${f(x-5)}" y="${f(y-5)}" width="10" height="10" rx="1.5" transform="rotate(${i*45-45} ${f(x)} ${f(y)})" fill="url(#rlDiamondGold)" stroke="#7E5E1C" stroke-width="0.5"/>`;
    }
    for(let i=0;i<8;i++){
      const a=rad(i*45-67.5);
      const x=cx+224*Math.cos(a),y=cy+224*Math.sin(a);
      deflectors+=`<circle cx="${f(x)}" cy="${f(y)}" r="3" fill="url(#rlDiamondGold)" stroke="#7E5E1C" stroke-width="0.4"/>`;
    }
    let brushes='';
    [138,122,106,90,74,58].forEach((r,i)=>{
      brushes+=`<circle cx="250" cy="250" r="${r}" fill="none" stroke="${i%2===0?'#FFF4CE':'#8A6A22'}" stroke-width="0.5" stroke-opacity="${i%2===0?0.3:0.35}"/>`;
    });
    let turret='';
    for(let i=0;i<5;i++){
      turret+=`<g transform="rotate(${i*72} 250 250)"><polygon points="246.5,250 253.5,250 251,150 249,150" fill="url(#rlGoldArm)" stroke="#7E5E1C" stroke-width="0.4"/><line x1="250" y1="246" x2="250" y2="153" stroke="#FFF4CE" stroke-opacity="0.5" stroke-width="0.8"/><circle cx="250" cy="150" r="7" fill="url(#rlGoldKnob)" stroke="#7E5E1C" stroke-width="0.6"/></g>`;
    }
    return`<svg id="rlWheelSvg" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:340px;filter:drop-shadow(0 20px 52px rgba(0,0,0,.85))">
<defs>
<radialGradient id="rlWoodGrad" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#8A552E"/><stop offset="60%" stop-color="#5C3318"/><stop offset="100%" stop-color="#2E1809"/></radialGradient>
<radialGradient id="rlWoodInner" cx="50%" cy="40%" r="58%"><stop offset="0%" stop-color="#7A4824"/><stop offset="100%" stop-color="#3A2010"/></radialGradient>
<linearGradient id="rlGoldRing" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FBE9A6"/><stop offset="40%" stop-color="#D9AE45"/><stop offset="100%" stop-color="#8A6A1E"/></linearGradient>
<linearGradient id="rlGoldArm" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#A87C28"/><stop offset="34%" stop-color="#FBEDB0"/><stop offset="56%" stop-color="#C99A36"/><stop offset="100%" stop-color="#E8CF7C"/></linearGradient>
<radialGradient id="rlGoldKnob" cx="40%" cy="34%" r="74%"><stop offset="0%" stop-color="#FFF4CE"/><stop offset="55%" stop-color="#E0B84E"/><stop offset="100%" stop-color="#946E1E"/></radialGradient>
<radialGradient id="rlCenterDisc" cx="42%" cy="36%" r="78%"><stop offset="0%" stop-color="#FBEFC4"/><stop offset="60%" stop-color="#DDB957"/><stop offset="100%" stop-color="#A07B2C"/></radialGradient>
<radialGradient id="rlGreenBowl" cx="50%" cy="40%" r="62%"><stop offset="0%" stop-color="#2E8A50"/><stop offset="100%" stop-color="#10532C"/></radialGradient>
<radialGradient id="rlBallGrad" cx="34%" cy="30%" r="74%"><stop offset="0%" stop-color="#fff"/><stop offset="100%" stop-color="#9FA7B6"/></radialGradient>
<linearGradient id="rlDiamondGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FBEDB0"/><stop offset="100%" stop-color="#9A7320"/></linearGradient>
<radialGradient id="rlDepth" cx="50%" cy="50%" r="50%"><stop offset="74%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.5"/></radialGradient>
<linearGradient id="rlGloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity="0.16"/><stop offset="36%" stop-color="#fff" stop-opacity="0.03"/><stop offset="60%" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<circle cx="250" cy="250" r="249" fill="url(#rlWoodGrad)" stroke="#1E0E04" stroke-width="2"/>
<circle cx="250" cy="250" r="247" fill="none" stroke="#B98A4E" stroke-width="1" opacity="0.4"/>
<circle cx="250" cy="250" r="214" fill="url(#rlWoodInner)"/>
<circle cx="250" cy="250" r="214" fill="none" stroke="#1E0E04" stroke-width="1.5"/>
${deflectors}
<circle cx="250" cy="250" r="200" fill="none" stroke="url(#rlGoldRing)" stroke-width="6"/>
<g id="rlSpinGroup">
<circle cx="250" cy="250" r="195" fill="#10532C"/>
${pockets}
<circle cx="250" cy="250" r="168" fill="url(#rlGreenBowl)"/>
${frets}
${numbers}
</g>
<circle cx="250" cy="250" r="232" fill="url(#rlGloss)" pointer-events="none"/>
<circle cx="250" cy="250" r="249" fill="url(#rlDepth)" pointer-events="none"/>
<circle id="rlBall" cx="250" cy="98" r="7" fill="url(#rlBallGrad)" style="display:none"/>
<circle cx="250" cy="250" r="146" fill="url(#rlCenterDisc)" stroke="#7E5E1C" stroke-width="1.5"/>
<circle cx="250" cy="250" r="146" fill="url(#rlGloss)" pointer-events="none"/>
${brushes}
<g id="rlTurretGroup">${turret}</g>
<circle cx="250" cy="250" r="26" fill="url(#rlGoldKnob)" stroke="#7E5E1C" stroke-width="1.5"/>
<circle cx="250" cy="250" r="15" fill="url(#rlGoldKnob)" stroke="#B58E32" stroke-width="0.75"/>
<ellipse cx="244" cy="244" rx="6" ry="3.5" fill="#fff" opacity="0.55" transform="rotate(-40 244 244)"/>
</svg>`;
  },

  _flashWin(result){
    document.querySelectorAll('[data-bet-key]').forEach(cell=>{
      const nums=JSON.parse(cell.dataset.betNums||'[]');
      if(nums.includes(result)){
        cell.classList.add('rl-flash');
        setTimeout(()=>cell.classList.remove('rl-flash'),2200);
      }
    });
  },

  /* ── sounds (Web Audio API, synthesised) ── */
  _getAC(){
    if(!this._ac)this._ac=new(window.AudioContext||window.webkitAudioContext)();
    if(this._ac.state==='suspended')this._ac.resume();
    return this._ac;
  },
  _sndSpin(dur){
    try{
      const ac=this._getAC();
      const buf=ac.createBuffer(1,Math.ceil(ac.sampleRate*dur/1000),ac.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.8)*0.12;
      const src=ac.createBufferSource();src.buffer=buf;
      const filt=ac.createBiquadFilter();filt.type='bandpass';filt.frequency.value=280;filt.Q.value=4;
      src.connect(filt);filt.connect(ac.destination);src.start();
    }catch(e){}
  },
  _sndClick(){
    try{
      const ac=this._getAC();
      const osc=ac.createOscillator(),gain=ac.createGain();
      osc.type='sine';
      osc.frequency.setValueAtTime(880,ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(480,ac.currentTime+0.045);
      gain.gain.setValueAtTime(0.16,ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.065);
      osc.connect(gain);gain.connect(ac.destination);
      osc.start();osc.stop(ac.currentTime+0.07);
    }catch(e){}
  },
  _scheduleBallClicks(dur){
    for(let i=0;i<28;i++){
      const t=i/28;
      const delay=(1-Math.pow(1-t,2))*dur*0.88+70;
      setTimeout(()=>{try{if(this.spinning)this._sndClick();}catch(e){}},delay);
    }
  },
  _sndWin(){
    try{
      const ac=this._getAC();
      [523.25,659.25,783.99,1046.5].forEach((freq,i)=>{
        const osc=ac.createOscillator(),gain=ac.createGain();
        osc.type='sine';osc.frequency.value=freq;
        const t=ac.currentTime+i*0.11;
        gain.gain.setValueAtTime(0,t);
        gain.gain.linearRampToValueAtTime(0.22,t+0.02);
        gain.gain.exponentialRampToValueAtTime(0.001,t+0.28);
        osc.connect(gain);gain.connect(ac.destination);
        osc.start(t);osc.stop(t+0.3);
      });
    }catch(e){}
  },
  _sndLose(){
    try{
      const ac=this._getAC();
      const osc=ac.createOscillator(),gain=ac.createGain();
      osc.type='triangle';
      osc.frequency.setValueAtTime(220,ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110,ac.currentTime+0.42);
      gain.gain.setValueAtTime(0.14,ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.48);
      osc.connect(gain);gain.connect(ac.destination);
      osc.start();osc.stop(ac.currentTime+0.5);
    }catch(e){}
  },
  _sndChip(){
    try{
      const ac=this._getAC();
      const osc=ac.createOscillator(),gain=ac.createGain();
      osc.type='sine';
      osc.frequency.setValueAtTime(560,ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(280,ac.currentTime+0.07);
      gain.gain.setValueAtTime(0.1,ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.09);
      osc.connect(gain);gain.connect(ac.destination);
      osc.start();osc.stop(ac.currentTime+0.1);
    }catch(e){}
  },

  /* ── betting table HTML ── */
  _tableHTML(){
    const RED=this.RED;
    const row1=[],row2=[],row3=[];
    for(let c=1;c<=12;c++){row1.push(3*c);row2.push(3*c-1);row3.push(3*c-2);}
    const nc=(n,gr,gc)=>{
      const cl=RED.has(n)?'r':'b';
      return `<div class="rl-cell rl-num ${cl}" style="grid-row:${gr};grid-column:${gc}"
        data-bet-type="straight" data-bet-key="str:${n}" data-bet-nums="[${n}]" data-tip="35 : 1">${n}</div>`;
    };
    const sc=(nums,gr,gc)=>{
      const s=nums.slice().sort((a,b)=>a-b);
      return `<div class="rl-spl" style="grid-row:${gr};grid-column:${gc}"
        data-bet-type="split" data-bet-key="spl:${s.join(',')}" data-bet-nums="[${s.join(',')}]"
        title="Split ${s.join('+')} · 17:1"><span class="rl-spl-dot"></span></div>`;
    };
    const cc=(nums,gr,gc)=>{
      const s=nums.slice().sort((a,b)=>a-b);
      return `<div class="rl-cor" style="grid-row:${gr};grid-column:${gc}"
        data-bet-type="corner" data-bet-key="cor:${s.join(',')}" data-bet-nums="[${s.join(',')}]"
        title="Corner ${s.join('+')} · 8:1"><span class="rl-cor-dot"></span></div>`;
    };
    let cells='';
    for(let c=0;c<12;c++){
      cells+=nc(row1[c],1,2*c+1)+nc(row2[c],3,2*c+1)+nc(row3[c],5,2*c+1);
    }
    for(let c=0;c<11;c++){
      cells+=sc([row1[c],row1[c+1]],1,2*c+2);
      cells+=sc([row2[c],row2[c+1]],3,2*c+2);
      cells+=sc([row3[c],row3[c+1]],5,2*c+2);
    }
    for(let c=0;c<12;c++){
      cells+=sc([row1[c],row2[c]],2,2*c+1);
      cells+=sc([row2[c],row3[c]],4,2*c+1);
    }
    for(let c=0;c<11;c++){
      cells+=cc([row1[c],row1[c+1],row2[c],row2[c+1]],2,2*c+2);
      cells+=cc([row2[c],row2[c+1],row3[c],row3[c+1]],4,2*c+2);
    }
    return`
<div class="rl-limits">
  <span>MIN <b>$1</b></span>
  <span class="rl-limits-name">European Roulette &nbsp;·&nbsp; 97.3% RTP &nbsp;·&nbsp; Click wheel numbers for neighbor bets</span>
  <span>MAX <b>$500</b></span>
</div>
<div class="rl-tbl" id="rlTable">
  <div class="rl-num-section">
    <div class="rl-zero-col">
      <div class="rl-cell rl-zero" data-bet-type="straight" data-bet-key="str:0" data-bet-nums="[0]" data-tip="35 : 1">0</div>
    </div>
    <div class="rl-mid-wrap">
      <div class="rl-num-and-col">
        <div class="rl-num-area">${cells}</div>
        <div class="rl-col-bets">
          <div class="rl-cell rl-col" data-bet-type="column" data-bet-key="col:1" data-bet-nums="[${row1}]" data-tip="2 : 1">2:1</div>
          <div class="rl-cell rl-col" data-bet-type="column" data-bet-key="col:2" data-bet-nums="[${row2}]" data-tip="2 : 1">2:1</div>
          <div class="rl-cell rl-col" data-bet-type="column" data-bet-key="col:3" data-bet-nums="[${row3}]" data-tip="2 : 1">2:1</div>
        </div>
      </div>
      <div class="rl-doz-row">
        <div class="rl-cell rl-doz" data-bet-type="dozen" data-bet-key="doz:1" data-bet-nums="[1,2,3,4,5,6,7,8,9,10,11,12]" data-tip="2 : 1">1<sup>ST</sup> 12</div>
        <div class="rl-cell rl-doz" data-bet-type="dozen" data-bet-key="doz:2" data-bet-nums="[13,14,15,16,17,18,19,20,21,22,23,24]" data-tip="2 : 1">2<sup>ND</sup> 12</div>
        <div class="rl-cell rl-doz" data-bet-type="dozen" data-bet-key="doz:3" data-bet-nums="[25,26,27,28,29,30,31,32,33,34,35,36]" data-tip="2 : 1">3<sup>RD</sup> 12</div>
      </div>
      <div class="rl-out-row">
        <div class="rl-cell rl-out" data-bet-type="half"    data-bet-key="half:lo" data-bet-nums="[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]" data-tip="1 : 1">1–18</div>
        <div class="rl-cell rl-out" data-bet-type="evenodd" data-bet-key="eo:even" data-bet-nums="[2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36]" data-tip="1 : 1">EVEN</div>
        <div class="rl-cell rl-out rl-colr" data-bet-type="color" data-bet-key="clr:r" data-bet-nums="[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]" data-tip="1 : 1"><div class="rl-diamond" style="background:#9E1620"></div></div>
        <div class="rl-cell rl-out rl-colb" data-bet-type="color" data-bet-key="clr:b" data-bet-nums="[2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]" data-tip="1 : 1"><div class="rl-diamond" style="background:#05070A"></div></div>
        <div class="rl-cell rl-out" data-bet-type="evenodd" data-bet-key="eo:odd"  data-bet-nums="[1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35]" data-tip="1 : 1">ODD</div>
        <div class="rl-cell rl-out" data-bet-type="half"    data-bet-key="half:hi" data-bet-nums="[19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36]" data-tip="1 : 1">19–36</div>
      </div>
    </div>
  </div>
</div>
<div class="rl-btns">
  <button class="rl-rebet" id="rlRebet" disabled>↺ Rebet</button>
  <button class="rl-clr" id="rlClear">✕ Clear</button>
</div>`;
  },

  _css(){return`
.rl-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;padding:20px 12px 16px;
  background:radial-gradient(120% 85% at 50% -5%,#20273A 0%,#161B29 58%,#10141E 100%);border-radius:16px}
.rl-wheel-area{position:relative;display:flex;align-items:center;justify-content:center;width:100%}
.rl-ptr{position:absolute;top:2px;left:50%;transform:translateX(-50%);
  color:#E6BE55;font-size:18px;line-height:1;
  filter:drop-shadow(0 2px 6px rgba(0,0,0,.9));pointer-events:none;z-index:2}
.rl-res{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);
  width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:16px;font-weight:900;color:#fff;opacity:0;transition:opacity .4s .1s;
  box-shadow:0 4px 20px rgba(0,0,0,.8);pointer-events:none;z-index:2}
.rl-res.show{opacity:1}
.rl-res.green{background:#1E7A3C;box-shadow:0 4px 20px rgba(30,122,60,.5)}
.rl-res.red{background:#C81E29;box-shadow:0 4px 20px rgba(200,30,41,.5)}
.rl-res.black{background:#14181F;border:1.5px solid rgba(255,255,255,.2)}
/* streak */
.rl-streak{display:flex;flex-wrap:wrap;justify-content:center;gap:3px;min-height:20px;
  padding:0 4px;max-width:600px;width:100%}
.rl-sdot{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:7px;font-weight:800;color:#fff;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,.5)}
.rl-sdot.green{background:#1E7A3C}
.rl-sdot.red{background:#C81E29}
.rl-sdot.black{background:#232323;border:1px solid rgba(255,255,255,.18)}
/* chips */
.rl-chips{display:flex;gap:7px}
.rl-chip{position:relative;width:40px;height:40px;border-radius:50%;border:none;
  background:transparent;cursor:pointer;overflow:hidden;transition:transform .1s,filter .12s;font-family:inherit}
.rl-chip.active{transform:scale(1.18);box-shadow:0 0 0 2px #E6BE55,0 4px 14px rgba(0,0,0,.5)}
.rl-chip:hover:not(.active){filter:brightness(1.22)}
.rl-totals{display:flex;flex-direction:column;gap:5px;font-size:12px;color:rgba(255,255,255,.55)}
.rl-totals b{color:#e8e8e8}
/* table */
.rl-table-wrap{width:100%;max-width:620px}
.rl-tbl{display:flex;flex-direction:column;gap:6px}
.rl-num-section{display:flex;gap:6px;align-items:stretch}
.rl-zero-col{flex-shrink:0;width:36px;align-self:stretch;display:flex}
.rl-zero{flex:1;min-height:118px;
  background:linear-gradient(158deg,#2E8A50,#10532C);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 4px 14px rgba(0,0,0,.34);border-radius:8px!important}
.rl-mid-wrap{flex:1;display:flex;flex-direction:column;gap:6px}
.rl-num-and-col{display:flex;gap:6px}
.rl-num-area{
  flex:1;display:grid;
  grid-template-columns:repeat(11,minmax(0,1fr) 7px) minmax(0,1fr);
  grid-template-rows:repeat(2,38px 7px) 38px;
  position:relative}
.rl-col-bets{flex-shrink:0;width:38px;display:flex;flex-direction:column;gap:7px}
.rl-col-bets .rl-cell{flex:0 0 38px;height:38px}
.rl-doz-row,.rl-out-row{display:flex;gap:6px}
/* base cell */
.rl-cell{display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:700;cursor:pointer;user-select:none;border-radius:8px;
  border:1px solid #3A4358;color:#C6CEDF;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 2px 4px rgba(0,0,0,.32);
  transition:border-color .12s,box-shadow .12s,transform .06s,filter .12s;position:relative}
.rl-cell:hover{border-color:#E6BE55;box-shadow:0 0 0 1px rgba(230,190,85,.4),0 6px 18px rgba(0,0,0,.5);
  transform:translateY(-2px);z-index:4;color:#fff}
.rl-cell:active{transform:scale(.96)}
/* number cells */
.rl-num{min-height:38px;border:none;color:#fff;font-size:13px;font-weight:700}
.rl-num.r{background:#C81E29;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 2px 4px rgba(0,0,0,.32)}
.rl-num.b{background:#14181F;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 2px 4px rgba(0,0,0,.32)}
.rl-num:hover{filter:brightness(1.3);border:none}
.rl-col{background:rgba(255,255,255,.03);font-size:10px;color:#C6CEDF}
.rl-doz{flex:1;background:rgba(255,255,255,.03);height:30px;min-height:30px;font-size:11px}
.rl-doz sup{font-size:7px}
.rl-out{flex:1;background:rgba(255,255,255,.03);height:30px;min-height:30px;font-size:11px;letter-spacing:.04em}
.rl-colr{background:#C81E29!important;border-color:#C81E29!important}
.rl-colb{background:#14181F!important}
.rl-diamond{width:20px;height:20px;transform:rotate(45deg);border-radius:3px;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
/* split / corner hit areas */
.rl-spl,.rl-cor{display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:5;border-radius:2px;transition:background .1s}
.rl-spl:hover,.rl-cor:hover{background:rgba(230,190,85,.12)}
.rl-spl-dot,.rl-cor-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,0);border:1.5px solid rgba(255,255,255,0);transition:background .12s,border-color .12s}
.rl-spl:hover .rl-spl-dot{background:#E6BE55;border-color:rgba(0,0,0,.25)}
.rl-cor-dot{border-radius:1px;transform:rotate(45deg)}
.rl-cor:hover .rl-cor-dot{background:#E6BE55;border-color:rgba(0,0,0,.25)}
/* chip overlay */
.rl-bet-chip{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:18px;height:18px;border-radius:50%;
  font-size:6px;font-weight:900;display:flex;align-items:center;justify-content:center;
  border:1.5px solid rgba(255,255,255,.5);box-shadow:0 2px 6px rgba(0,0,0,.6);z-index:6;pointer-events:none}
/* limits bar */
.rl-limits{display:flex;justify-content:space-between;align-items:center;
  padding:5px 10px;background:rgba(255,255,255,.03);
  border:1px solid #2E3649;border-radius:8px;margin-bottom:2px}
.rl-limits>span{font-size:11px;color:rgba(255,255,255,.35)}
.rl-limits b{color:rgba(255,255,255,.6)}
.rl-limits-name{font-size:9.5px;color:rgba(255,255,255,.2);letter-spacing:.03em;text-align:center}
/* buttons row */
.rl-btns{display:flex;gap:6px;margin-top:4px}
.rl-clr{flex:1;background:rgba(255,255,255,.04);
  border:1px solid #3A4358;border-radius:8px;height:28px;
  color:rgba(255,255,255,.35);font-size:11px;cursor:pointer;font-family:inherit;transition:background .1s,border-color .1s}
.rl-clr:hover{background:rgba(255,255,255,.08);border-color:#E6BE55;color:#fff}
.rl-rebet{flex:1;background:rgba(230,190,85,.06);
  border:1px solid rgba(230,190,85,.25);border-radius:8px;height:28px;
  color:rgba(230,190,85,.5);font-size:11px;cursor:pointer;font-family:inherit;transition:background .1s,border-color .1s,color .1s}
.rl-rebet:hover:not(:disabled){background:rgba(230,190,85,.14);border-color:#E6BE55;color:#E6BE55}
.rl-rebet:disabled{opacity:.3;cursor:not-allowed}
/* tooltip */
.rl-cell[data-tip]{position:relative;overflow:visible}
.rl-cell[data-tip]:hover::before{
  content:attr(data-tip);
  position:absolute;bottom:calc(100% + 7px);left:50%;transform:translateX(-50%);
  background:#0C1220;border:1px solid #E6BE55;
  color:#E6BE55;font-size:10px;font-weight:700;letter-spacing:.08em;
  padding:3px 8px;border-radius:5px;white-space:nowrap;pointer-events:none;z-index:200}
.rl-cell[data-tip]:hover::after{
  content:'';position:absolute;bottom:calc(100% + 3px);left:50%;transform:translateX(-50%);
  border:4px solid transparent;border-top-color:#E6BE55;pointer-events:none;z-index:200}
/* neighbor bet label */
.rl-nb-label{position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);
  background:#0C1220;border:1px solid #E6BE55;color:#E6BE55;
  font-size:10px;font-weight:700;letter-spacing:.04em;
  padding:4px 12px;border-radius:6px;white-space:nowrap;
  pointer-events:none;opacity:0;transition:opacity .2s;z-index:20}
.rl-nb-label.show{opacity:1}
/* wheel hover on pockets */
#rlSpinGroup [data-n]:hover{opacity:.82}
@keyframes rl-flash{0%,100%{filter:brightness(1)}45%{filter:brightness(2.2) saturate(1.6)}}
.rl-flash{animation:rl-flash .5s ease 3}
`},

  unmount(){this.bets=[];this.spinning=false;this._ballRadius=null;}
};
