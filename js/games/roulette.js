/* --- roulette (professional) --- */
ORIGINALS['originals-roulette']={
  rtp:'97.3%', auto:false,
  bets:[], spinning:false,
  _wheelAngle:0, _chipVal:1,
  _ballAngle:null, _ballRadius:null,
  _history:[], _lastBets:[],
  _undoStack:[],
  _ac:null, _nbTimer:null,
  _nbCount:2, _autoRunning:false, _racetrkVisible:true, _fast:false, _muted:false,
  _sessWag:0, _sessProf:0, _sessWins:0, _sessLoss:0,
  _idleRunning:false, _idleRaf:null,

  WHEEL:[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26],
  RED:new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]),
  PAYS:{straight:36,split:18,street:12,corner:9,sixline:6,dozen:3,column:3,half:2,color:2,evenodd:2},

  SECTORS:{
    voisins:[
      {type:'street',nums:[0,2,3]},{type:'street',nums:[0,2,3]},
      {type:'split',nums:[4,7]},{type:'split',nums:[12,15]},
      {type:'split',nums:[18,21]},{type:'split',nums:[19,22]},
      {type:'corner',nums:[25,26,28,29]},{type:'corner',nums:[25,26,28,29]},
      {type:'split',nums:[32,35]}
    ],
    tiers:[
      {type:'split',nums:[5,8]},{type:'split',nums:[10,11]},
      {type:'split',nums:[13,16]},{type:'split',nums:[23,24]},
      {type:'split',nums:[27,30]},{type:'split',nums:[33,36]}
    ],
    orphelins:[
      {type:'straight',nums:[1]},{type:'split',nums:[6,9]},
      {type:'split',nums:[14,17]},{type:'split',nums:[17,20]},
      {type:'split',nums:[31,34]}
    ],
    zero:[
      {type:'split',nums:[0,3]},{type:'split',nums:[12,15]},
      {type:'straight',nums:[26]},{type:'split',nums:[32,35]}
    ]
  },

  mount(){
    let s=document.getElementById('rl-css');
    if(!s){s=document.createElement('style');s.id='rl-css';document.head.appendChild(s);}
    s.textContent=this._css();
    document.querySelector('.gv-panel').classList.add('rl-panel-mode');
    this._sessWag=0;this._sessProf=0;this._sessWins=0;this._sessLoss=0;
    this._loadBallSnd();

    engFields.innerHTML=`
<div class="rl-tabs">
  <button class="rl-tab active" id="rlTabManual">MANUAL</button>
  <button class="rl-tab" id="rlTabAuto">AUTOPLAY</button>
</div>
<div id="rlManualPanel">
  <div class="gv-field"><label>Chip</label>
    <div class="rl-chips" id="rlChips">
      ${[1,5,10,25,100,500].map((v,i)=>`<button class="rl-chip${i===0?' active':''}" data-v="${v}"></button>`).join('')}
    </div>
  </div>
  <div class="rl-actions">
    <button class="rl-act" id="rlUndo">↩<span>UNDO</span></button>
    <button class="rl-act" id="rlDouble">×2<span>DOUBLE</span></button>
    <button class="rl-act" id="rlHalf">½<span>HALF</span></button>
    <button class="rl-act" id="rlClear">✕<span>CLEAR</span></button>
  </div>
  <div class="rl-toggle-row">
    <span>RACETRACK</span>
    <label class="rl-tog"><input type="checkbox" id="rlRtToggle" checked><span class="rl-tog-slider"></span></label>
  </div>
  <div class="rl-toggle-row">
    <span>FAST SPIN</span>
    <label class="rl-tog"><input type="checkbox" id="rlFastToggle"${this._fast?' checked':''}><span class="rl-tog-slider"></span></label>
  </div>
  <div class="rl-toggle-row">
    <span>SOUND</span>
    <label class="rl-tog"><input type="checkbox" id="rlSoundToggle"${this._muted?'':' checked'}><span class="rl-tog-slider"></span></label>
  </div>
  <div class="rl-nb-row">
    <span>NEIGHBORS</span>
    <div class="rl-nb-ctrl">
      <button class="rl-nb-btn" id="rlNbMinus">−</button>
      <span id="rlNbVal">${this._nbCount}</span>
      <button class="rl-nb-btn" id="rlNbPlus">+</button>
    </div>
  </div>
  <div class="rl-totals">
    <span>Total Bet <b id="rlTotal">—</b></span>
    <span>Max Win <b id="rlMaxWin">—</b></span>
  </div>
</div>
<div id="rlAutoPanel" style="display:none">
  <div class="rl-ap-field"><label>ROUNDS</label>
    <input class="rl-ap-inp" id="rlApSpins" type="number" value="10" min="1" max="999">
  </div>
  <div class="rl-ap-field"><label>STOP ON PROFIT ($)</label>
    <input class="rl-ap-inp" id="rlApWin" type="number" value="0" min="0" placeholder="0 = off">
  </div>
  <div class="rl-ap-field"><label>STOP ON LOSS ($)</label>
    <input class="rl-ap-inp" id="rlApLoss" type="number" value="0" min="0" placeholder="0 = off">
  </div>
  <div class="rl-ap-status" id="rlApStatus"></div>
</div>`;

    gvStage.style.overflowY='';gvStage.style.overflowX='';
    gvStage.innerHTML=`
<div class="rl-wrap">
  <div class="rl-left">
    <div class="rl-rt-wrap" id="rlRtWrap">
      ${this._buildRacetrack()}
    </div>
    <div class="rl-limits">
      <span>MIN <b>$1</b></span>
      <span class="rl-limits-name">European Roulette · 97.3% RTP</span>
      <span>MAX <b>$500</b></span>
    </div>
    <div class="rl-table-wrap">
      ${this._tableHTML()}
    </div>
  </div>
  <div class="rl-right">
    <div class="rl-wheel-area">
      ${this._buildWheelSVG()}
      <div class="rl-ptr">▼</div>
      <div class="rl-res" id="rlRes"></div>
      <div class="rl-payout" id="rlPayout"></div>
      <div class="rl-nb-label" id="rlNbLabel"></div>
    </div>
    <div class="rl-streak" id="rlStreak"></div>
  </div>
</div>`;

    /* chip canvases */
    document.querySelectorAll('.rl-chip').forEach(btn=>{
      const cv=makeChipCanvas(+btn.dataset.v,120);
      cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:50%';
      btn.appendChild(cv);
    });

    /* tab switching */
    document.getElementById('rlTabManual').addEventListener('click',()=>{
      document.getElementById('rlManualPanel').style.display='';
      document.getElementById('rlAutoPanel').style.display='none';
      document.getElementById('rlTabManual').classList.add('active');
      document.getElementById('rlTabAuto').classList.remove('active');
      this._syncBtn();
    });
    document.getElementById('rlTabAuto').addEventListener('click',()=>{
      document.getElementById('rlManualPanel').style.display='none';
      document.getElementById('rlAutoPanel').style.display='';
      document.getElementById('rlTabAuto').classList.add('active');
      document.getElementById('rlTabManual').classList.remove('active');
      this._syncBtn();
    });

    /* chips */
    document.getElementById('rlChips').addEventListener('click',e=>{
      const b=e.target.closest('.rl-chip');if(!b)return;
      this._chipVal=+b.dataset.v;
      document.querySelectorAll('.rl-chip').forEach(c=>c.classList.toggle('active',c===b));
    });

    /* table bets */
    document.getElementById('rlTable').addEventListener('click',e=>{
      if(this.spinning)return;
      const cell=e.target.closest('[data-bet-key]');if(!cell)return;
      this._addBet(cell.dataset.betType,cell.dataset.betKey,JSON.parse(cell.dataset.betNums));
    });
    document.getElementById('rlTable').addEventListener('contextmenu',e=>{
      e.preventDefault();
      if(this.spinning)return;
      const cell=e.target.closest('[data-bet-key]');if(!cell)return;
      const key=cell.dataset.betKey;
      const bet=this.bets.find(b=>b.key===key);if(!bet)return;
      let undoIdx=-1;
      for(let i=this._undoStack.length-1;i>=0;i--){if(this._undoStack[i].key===key){undoIdx=i;break;}}
      if(undoIdx!==-1){
        const entry=this._undoStack[undoIdx];
        bet.fiat-=entry.fiat;bet.amount-=entry.crypto;
        this._undoStack.splice(undoIdx,1);
      } else {
        const w=curW();const rate=(w&&w.rate)||1;
        bet.fiat-=this._chipVal;bet.amount-=this._chipVal/rate;
      }
      if(bet.fiat<0.001)this.bets=this.bets.filter(b=>b.key!==key);
      this._renderBets();this._syncInfo();this._syncBtn();
    });

    /* action buttons */
    document.getElementById('rlUndo').addEventListener('click',()=>{if(!this.spinning)this._doUndo();});
    document.getElementById('rlDouble').addEventListener('click',()=>{if(!this.spinning)this._doDouble();});
    document.getElementById('rlHalf').addEventListener('click',()=>{if(!this.spinning)this._doHalf();});
    const doClear=()=>{
      if(this.spinning)return;
      this.bets=[];this._undoStack=[];this._renderBets();this._syncInfo();this._syncBtn();
    };
    document.getElementById('rlClear').addEventListener('click',doClear);
    document.getElementById('rlClear2').addEventListener('click',doClear);
    document.getElementById('rlRebet').addEventListener('click',()=>{
      if(this.spinning||this._autoRunning||!this._lastBets.length)return;
      this.bets=this._lastBets.map(b=>({...b}));
      this._undoStack=[];
      this._renderBets();this._syncInfo();this._syncBtn();
    });

    /* racetrack toggle */
    document.getElementById('rlRtToggle').addEventListener('change',e=>{
      this._racetrkVisible=e.target.checked;
      document.getElementById('rlRtWrap').style.display=e.target.checked?'':'none';
    });
    /* fast spin toggle */
    document.getElementById('rlFastToggle').addEventListener('change',e=>{
      this._fast=e.target.checked;
    });
    /* sound toggle */
    document.getElementById('rlSoundToggle').addEventListener('change',e=>{
      this._muted=!e.target.checked;
      if(this._muted)this._muteSpin();
    });

    /* neighbors */
    const updateNb=()=>{
      const el=document.getElementById('rlNbVal');
      if(el)el.textContent=this._nbCount;
    };
    document.getElementById('rlNbMinus').addEventListener('click',()=>{
      this._nbCount=Math.max(0,this._nbCount-1);updateNb();
    });
    document.getElementById('rlNbPlus').addEventListener('click',()=>{
      this._nbCount=Math.min(4,this._nbCount+1);updateNb();
    });

    /* wheel neighbor clicks */
    document.getElementById('rlWheelSvg').addEventListener('click',e=>{
      if(this.spinning)return;
      const t=e.target.closest('[data-n]');if(!t)return;
      this._neighborBet(+t.dataset.n);
    });

    /* racetrack number clicks */
    document.getElementById('rlRtEl').addEventListener('click',e=>{
      if(this.spinning)return;
      const t=e.target.closest('.rl-rt-n[data-n]');if(!t)return;
      this._neighborBet(+t.dataset.n);
    });

    /* sector buttons */
    document.querySelectorAll('[data-sector]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if(!this.spinning)this._placeSector(btn.dataset.sector);
      });
    });

    this._updateWheelSVG(this._wheelAngle);
    this._renderBets();this._renderStreak();this._syncInfo();this._syncBtn();
    this._startIdleSpin();
  },

  _addBet(type,key,numbers,src='tbl'){
    const w=curW();
    const rate=(w&&w.rate)||1;
    const maxAmt=(w&&w.amt!=null)?w.amt:1e9;
    const chipCrypto=this._chipVal/rate;
    const totalSoFar=this.bets.reduce((s,b)=>s+b.amount,0);
    if(totalSoFar+chipCrypto>maxAmt+1e-9)return;
    const fullKey=src==='rt'?'rt:'+key:key;
    const ex=this.bets.find(b=>b.key===fullKey);
    if(ex){ex.amount+=chipCrypto;ex.fiat+=this._chipVal;}
    else this.bets.push({type,key:fullKey,numbers,amount:chipCrypto,fiat:this._chipVal,src});
    this._undoStack.push({key:fullKey,fiat:this._chipVal,crypto:chipCrypto});
    this._sndChip();
    this._renderBets();this._syncInfo();this._syncBtn();
  },

  _doUndo(){
    if(!this._undoStack.length)return;
    const {key,fiat,crypto}=this._undoStack.pop();
    const ex=this.bets.find(b=>b.key===key);
    if(ex){
      ex.fiat-=fiat;ex.amount-=crypto;
      if(ex.fiat<0.001)this.bets=this.bets.filter(b=>b.key!==key);
    }
    this._renderBets();this._syncInfo();this._syncBtn();
  },

  _doDouble(){
    if(!this.bets.length)return;
    this.bets.forEach(b=>{b.amount*=2;b.fiat*=2});
    const w=curW();const maxAmt=(w&&w.amt!=null)?w.amt:1e9;
    const total=this.bets.reduce((s,b)=>s+b.amount,0);
    if(total>maxAmt+1e-9){
      const scale=maxAmt/total;
      this.bets.forEach(b=>{b.amount*=scale;b.fiat*=scale});
      this.bets=this.bets.filter(b=>b.fiat>=0.005);
    }
    this._undoStack=[];
    this._renderBets();this._syncInfo();this._syncBtn();
  },

  _doHalf(){
    if(!this.bets.length)return;
    this.bets.forEach(b=>{b.amount/=2;b.fiat/=2});
    this.bets=this.bets.filter(b=>b.fiat>=0.005);
    this._undoStack=[];
    this._renderBets();this._syncInfo();this._syncBtn();
  },

  _placeSector(sector){
    const list=this.SECTORS[sector];if(!list)return;
    list.forEach(b=>{
      const s=b.nums.slice().sort((a,c)=>a-c);
      const prefix={straight:'str',split:'spl',street:'str',corner:'cor'}[b.type]||b.type;
      this._addBet(b.type,`${prefix}:${s.join(',')}`,s,'rt');
    });
  },

  _neighborBet(n){
    const W=this.WHEEL,len=W.length,idx=W.indexOf(n);
    const count=this._nbCount;
    const nums=[];
    for(let d=-count;d<=count;d++) nums.push(W[(idx+d+len)%len]);
    nums.forEach(ni=>this._addBet('straight',`str:${ni}`,[ni],'rt'));
    const lbl=document.getElementById('rlNbLabel');
    if(lbl){
      lbl.textContent=nums.join(' · ');
      lbl.classList.add('show');
      clearTimeout(this._nbTimer);
      this._nbTimer=setTimeout(()=>lbl.classList.remove('show'),2000);
    }
  },

  _renderBets(){
    document.querySelectorAll('.rl-bet-chip,.rl-rt-chip').forEach(e=>e.remove());

    const stackN=fiat=>fiat>=50?4:fiat>=10?3:fiat>=5?2:1;

    /* table chips — stacked canvases, each offset 3px upward */
    for(const bet of this.bets){
      if(bet.src==='rt')continue;
      const cell=document.querySelector(`[data-bet-key="${bet.key}"]`);if(!cell)continue;
      const n=stackN(bet.fiat);
      for(let i=0;i<n;i++){
        const cv=makeChipCanvas(Math.max(1,Math.round(bet.fiat)),40);
        cv.className='rl-bet-chip';
        cv.style.setProperty('--si',i);
        cell.appendChild(cv);
      }
    }

    /* racetrack — total fiat per number, racetrack bets only */
    const numAmt={};
    for(const bet of this.bets)
      if(bet.src==='rt')
        for(const n of bet.numbers) numAmt[n]=(numAmt[n]||0)+bet.fiat;

    document.querySelectorAll('#rlRtEl .rl-rt-n[data-n]').forEach(el=>{
      const n=+el.dataset.n;
      const has=n in numAmt;
      el.classList.toggle('rl-rt-active',has);
      if(has){
        const cv=makeChipCanvas(Math.max(1,Math.round(numAmt[n])),40);
        cv.className='rl-rt-chip';
        el.appendChild(cv);
      }
    });
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
    if(this._autoRunning){
      gvBetBtn.disabled=false;
    } else {
      gvBetBtn.disabled=!this.bets.length||this.spinning;
    }
    const rb=document.getElementById('rlRebet');
    if(rb)rb.disabled=this.spinning||this._autoRunning||!this._lastBets.length;
  },

  label(){
    if(this._autoRunning)return'Stop Auto';
    if(this.spinning)return'Spinning…';
    const isAuto=document.getElementById('rlAutoPanel')?.style.display!=='none';
    if(isAuto)return this.bets.length>0?'Start Autoplay':'Place Bets';
    return this.bets.length>0?'Spin':'Place Bets';
  },

  onBet(){
    if(this._autoRunning){this._autoRunning=false;return;}
    if(this.spinning||!this.bets.length)return;
    const isAuto=document.getElementById('rlAutoPanel')?.style.display!=='none';
    if(isAuto)this._startAutoplay();
    else this._spin();
  },

  async _startAutoplay(){
    const spins=parseInt(document.getElementById('rlApSpins')?.value)||10;
    const stopWin=parseFloat(document.getElementById('rlApWin')?.value)||0;
    const stopLoss=parseFloat(document.getElementById('rlApLoss')?.value)||0;
    const w0=curW();
    const startFiat=w0?w0.amt*w0.rate:0;
    this._autoRunning=true;this._syncBtn();
    let round=0;
    while(this._autoRunning&&round<spins&&this.bets.length>0){
      round++;
      const st=document.getElementById('rlApStatus');
      if(st)st.textContent=`Round ${round} / ${spins}`;
      const ok=await this._spin();
      if(ok===false||!this._autoRunning)break;
      const wc=curW();
      const currFiat=wc?wc.amt*wc.rate:0;
      if(stopWin>0&&(currFiat-startFiat)>=stopWin)break;
      if(stopLoss>0&&(startFiat-currFiat)>=stopLoss)break;
      if(round<spins&&this._autoRunning){
        this.bets=this._lastBets.map(b=>({...b}));
        this._renderBets();this._syncInfo();
        await new Promise(r=>setTimeout(r,500));
      }
    }
    this._autoRunning=false;
    const st=document.getElementById('rlApStatus');
    if(st)st.textContent=round>=spins?'Done':'Stopped';
    this._syncBtn();
  },

  async _spin(){
    const authed=document.body.classList.contains('authed');
    const w=authed?curW():null;
    const totalC=this.bets.reduce((s,b)=>s+b.amount,0);
    if(totalC<=0)return false;
    if(authed&&totalC>w.amt+1e-9)return false;
    this.spinning=true;lockBet(true);gvBetBtn.disabled=true;gvBetBtn.textContent='Spinning…';
    let res=null,spinResult=null;
    if(authed){
      w.amt-=totalC;w.fiat=w.amt*w.rate;renderWallet();
      try{
        res=await placeBet({game:'roulette',currency:w.c,wager:totalC,
          params:{bets:this.bets.map(b=>({type:b.type,numbers:b.numbers,amount:b.amount}))}});
        spinResult=res.gameData.result;
      }catch(err){
        w.amt+=totalC;w.fiat=w.amt*w.rate;renderWallet();res=null;
      }
    }
    if(spinResult===null||spinResult===undefined)
      spinResult=this.WHEEL[Math.floor(Math.random()*37)];
    await this._animateWheel(spinResult);
    this._stopSpinSrc();
    const col=spinResult===0?'green':this.RED.has(spinResult)?'red':'black';
    const rlRes=document.getElementById('rlRes');
    if(rlRes){rlRes.textContent=spinResult;rlRes.className='rl-res show '+col;}
    const totalFiat=this.bets.reduce((s,b)=>s+b.fiat,0);
    let payoutFiat=0;
    if(res){
      payoutFiat=totalFiat*res.multiplier;
      const st={w,b:totalC,name:'Roulette'};
      serverSettleBet(st,res.multiplier,res.new_balance);
      if(res.multiplier>1)this._sndWin();else this._sndLose();
    } else {
      payoutFiat=this.bets.filter(b=>b.numbers.includes(spinResult))
        .reduce((s,b)=>s+b.fiat*(this.PAYS[b.type]||0),0);
      if(payoutFiat>0)this._sndWin();else this._sndLose();
    }
    const netFiat=payoutFiat-totalFiat;
    this._sessWag+=totalFiat;
    this._sessProf+=netFiat;
    if(netFiat>0)this._sessWins++;else this._sessLoss++;
    this._updateSessionStats();
    this._showPayout(netFiat);
    this._history.unshift({n:spinResult,c:col});
    if(this._history.length>20)this._history.pop();
    this._renderStreak();
    this._flashWin(spinResult);
    this._placeDolly(spinResult);
    await new Promise(r=>setTimeout(r,this._fast?1400:2500));
    this._ballRadius=null;this._updateWheelSVG(this._wheelAngle);
    this.spinning=false;
    this._lastBets=this.bets.map(b=>({...b}));
    this.bets=[];this._undoStack=[];
    this._renderBets();this._syncInfo();
    this._removeDolly();
    if(rlRes)rlRes.className='rl-res';
    lockBet(false);this._syncBtn();
  },

  async _animateWheel(result){
    const seg=(Math.PI*2)/37;
    const idx=this.WHEEL.indexOf(result);
    const target=-idx*seg;
    const diff=((target-this._wheelAngle)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
    const wheelEnd=this._wheelAngle+(5+Math.random()*2)*Math.PI*2+diff;
    const wheelStart=this._wheelAngle;

    /* ball: wide outer orbit → drop → snap into pocket */
    const BALL_R_OUT=220; /* outside frets (~224), clear outer track */
    const BALL_R_IN=178;  /* pocket centre, between R2=195 and R1=168  */
    const ballStart=-Math.PI/2+(7+Math.random()*3)*Math.PI*2+Math.random()*Math.PI*2;

    const dur=this._fast?2200:5200,t0=performance.now();
    this._sndSpin(dur);this._scheduleBallClicks(dur);
    return new Promise(resolve=>{
      const frame=now=>{
        const t=Math.min((now-t0)/dur,1);

        /* wheel — ease-out cubic */
        this._wheelAngle=wheelStart+(wheelEnd-wheelStart)*(1-Math.pow(1-t,3));

        /* ball radius — flat outer orbit until 0.62, then sharp pow-0.35 drop */
        if(t<0.62){
          this._ballRadius=BALL_R_OUT;
        } else {
          const d=(t-0.62)/0.38;
          this._ballRadius=BALL_R_OUT+(BALL_R_IN-BALL_R_OUT)*Math.pow(d,0.35);
        }

        /* ball angle — free spin converges toward pocket top, then snap */
        const be=1-Math.pow(1-Math.min(t/0.88,1),2.8);
        const freeAngle=ballStart+((-Math.PI/2)-ballStart)*be;
        if(t<0.78){
          this._ballAngle=freeAngle;
        } else {
          /* pocket visual angle — normalize _wheelAngle mod 2π first to avoid huge accumulated value */
          const TAU=Math.PI*2;
          const wheelVis=((this._wheelAngle%TAU)+TAU)%TAU;
          let pocketAngle=-Math.PI/2+idx*seg+wheelVis;
          /* shortest-path diff so snap never sweeps more than π */
          let d=((pocketAngle-freeAngle)%TAU+TAU)%TAU;
          if(d>Math.PI)d-=TAU;
          const snap=Math.pow((t-0.78)/0.22,1.4);
          this._ballAngle=freeAngle+d*snap;
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
    /* _ballRadius is now a direct SVG radius — no mapping needed */
    ball.setAttribute('cx',(250+this._ballRadius*Math.cos(this._ballAngle)).toFixed(1));
    ball.setAttribute('cy',(250+this._ballRadius*Math.sin(this._ballAngle)).toFixed(1));
  },

  _buildWheelSVG(){
    const cx=250,cy=250,N=37,seg=360/N;
    const R2=195,R1=168,rT=181;
    const f=n=>n.toFixed(1);
    const rad=d=>d*Math.PI/180;
    let pockets='',numbers='',frets='';
    for(let i=0;i<N;i++){
      const n=this.WHEEL[i],theta=i*seg;
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
      const a=rad(i*45-90),x=cx+224*Math.cos(a),y=cy+224*Math.sin(a);
      deflectors+=`<rect x="${f(x-5)}" y="${f(y-5)}" width="10" height="10" rx="1.5" transform="rotate(${i*45-45} ${f(x)} ${f(y)})" fill="url(#rlDiamondGold)" stroke="#7E5E1C" stroke-width="0.5"/>`;
    }
    for(let i=0;i<8;i++){
      const a=rad(i*45-67.5),x=cx+224*Math.cos(a),y=cy+224*Math.sin(a);
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
    return`<svg id="rlWheelSvg" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:400px;filter:drop-shadow(0 20px 52px rgba(0,0,0,.85))">
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
<circle id="rlBall" cx="250" cy="98" r="8" fill="url(#rlBallGrad)" stroke="rgba(255,255,255,0.4)" stroke-width="0.8" style="display:none"/>
<circle cx="250" cy="250" r="146" fill="url(#rlCenterDisc)" stroke="#7E5E1C" stroke-width="1.5"/>
<circle cx="250" cy="250" r="146" fill="url(#rlGloss)" pointer-events="none"/>
${brushes}
<g id="rlTurretGroup">${turret}</g>
<circle cx="250" cy="250" r="26" fill="url(#rlGoldKnob)" stroke="#7E5E1C" stroke-width="1.5"/>
<circle cx="250" cy="250" r="15" fill="url(#rlGoldKnob)" stroke="#B58E32" stroke-width="0.75"/>
<ellipse cx="244" cy="244" rx="6" ry="3.5" fill="#fff" opacity="0.55" transform="rotate(-40 244 244)"/>
</svg>`;
  },

  _buildRacetrack(){
    const W=this.WHEEL,R=this.RED;
    const n=(v)=>{const cl=v===0?'g':(R.has(v)?'r':'b');return`<div class="rl-rt-n ${cl}" data-n="${v}">${v}</div>`;};
    const top=W.slice(19,36);                    // W[19..35] — 17 numbers
    const bot=[...W.slice(1,17)].reverse();      // W[1..16] reversed — 16 numbers
    return`<div class="rl-rt-h" id="rlRtEl">
  <div class="rl-rt-end">${n(W[18])}${n(W[17])}</div>
  <div class="rl-rt-body">
    <div class="rl-rt-row">${top.map(v=>n(v)).join('')}</div>
    <div class="rl-rt-secs">
      <div class="rl-rt-sec rl-sec-tiers"    data-sector="tiers">TIERS</div>
      <div class="rl-rt-sec rl-sec-orphelins" data-sector="orphelins">ORPHELINS</div>
      <div class="rl-rt-sec rl-sec-voisins"   data-sector="voisins">VOISINS</div>
      <div class="rl-rt-sec rl-sec-zero"      data-sector="zero">ZERO</div>
    </div>
    <div class="rl-rt-row">${bot.map(v=>n(v)).join('')}</div>
  </div>
  <div class="rl-rt-end">${n(W[36])}${n(W[0])}</div>
</div>`;
  },

  _flashWin(result){
    const betKeys=new Set(this.bets.map(b=>b.key));
    document.querySelectorAll('[data-bet-key]').forEach(cell=>{
      if(!betKeys.has(cell.dataset.betKey))return;
      const nums=JSON.parse(cell.dataset.betNums||'[]');
      if(nums.includes(result)){
        cell.classList.add('rl-flash');
        setTimeout(()=>cell.classList.remove('rl-flash'),2200);
      }
    });
  },

  _placeDolly(result){
    this._removeDolly();
    const cell=document.querySelector(`[data-bet-key="str:${result}"]`);if(!cell)return;
    const d=document.createElement('div');d.className='rl-dolly';d.id='rlDolly';
    cell.appendChild(d);
  },
  _removeDolly(){
    const d=document.getElementById('rlDolly');if(d)d.remove();
  },

  _showPayout(netFiat){
    const el=document.getElementById('rlPayout');if(!el)return;
    el.className='rl-payout';
    if(netFiat>0){
      el.textContent='+$'+netFiat.toFixed(netFiat<10?2:0);
      el.classList.add('show','win');
    } else if(netFiat<0){
      el.textContent='-$'+Math.abs(netFiat).toFixed(Math.abs(netFiat)<10?2:0);
      el.classList.add('show','lose');
    }
    clearTimeout(this._payoutTimer);
    this._payoutTimer=setTimeout(()=>{if(el)el.className='rl-payout';},this._fast?1300:2400);
  },

  _updateSessionStats(){
    const fmt=v=>'$'+Math.abs(v).toFixed(2);
    const sw=document.getElementById('sWag');if(sw)sw.textContent=fmt(this._sessWag);
    const sp=document.getElementById('sProf');
    if(sp){sp.textContent=(this._sessProf>=0?'+':'-')+fmt(this._sessProf);sp.style.color=this._sessProf>=0?'var(--mint)':'#e2596a';}
    const swi=document.getElementById('sWins');if(swi)swi.textContent=this._sessWins;
    const sl=document.getElementById('sLoss');if(sl)sl.textContent=this._sessLoss;
  },

  _getAC(){
    if(!this._ac)this._ac=new(window.AudioContext||window.webkitAudioContext)();
    if(this._ac.state==='suspended')this._ac.resume();
    return this._ac;
  },
  _loadBallSnd(){
    this._ballBuf=null;this._ballBufRaw=null;
    fetch('sounds/roulette/mixkit-casino-roulette-ball-1987.wav')
      .then(r=>r.arrayBuffer()).then(ab=>{this._ballBufRaw=ab;}).catch(()=>{});
  },
  _sndSpin(dur){
    if(this._muted)return;
    try{
      const ac=this._getAC();
      const masterGain=ac.createGain();
      masterGain.connect(ac.destination);
      this._spinGain=masterGain;
      if(this._ballBufRaw&&!this._ballBuf){
        ac.decodeAudioData(this._ballBufRaw.slice(0)).then(buf=>{
          this._ballBuf=buf;
        }).catch(()=>{});
      }
      if(this._ballBuf){
        const src=ac.createBufferSource();
        src.buffer=this._ballBuf;src.loop=true;
        src.connect(masterGain);src.start();
        masterGain.gain.setValueAtTime(0.7,ac.currentTime);
        masterGain.gain.setTargetAtTime(0,ac.currentTime+dur*0.65/1000,dur*0.25/1000);
        this._spinSrc=src;
      } else {
        /* fallback: synthetic noise */
        const buf=ac.createBuffer(1,Math.ceil(ac.sampleRate*dur/1000),ac.sampleRate);
        const d=buf.getChannelData(0);
        for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.8)*0.12;
        const src=ac.createBufferSource();src.buffer=buf;
        const filt=ac.createBiquadFilter();filt.type='bandpass';filt.frequency.value=280;filt.Q.value=4;
        src.connect(filt);filt.connect(masterGain);src.start();
      }
    }catch(e){}
  },
  _stopSpinSrc(){
    try{if(this._spinSrc){this._spinSrc.stop();this._spinSrc=null;}}catch(e){}
  },
  _muteSpin(){
    try{
      if(this._spinGain){this._spinGain.gain.setTargetAtTime(0,this._ac.currentTime,0.05);this._spinGain=null;}
      this._stopSpinSrc();
    }catch(e){}
  },
  _sndClick(){
    if(this._muted)return;
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
    if(this._muted)return;
    for(let i=0;i<28;i++){
      const t=i/28;
      setTimeout(()=>{try{if(this.spinning)this._sndClick();}catch(e){}},
        (1-Math.pow(1-t,2))*dur*0.88+70);
    }
  },
  _sndWin(){
    if(this._muted)return;
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
    if(this._muted)return;
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
  _startIdleSpin(){
    if(this._idleRunning)return; /* guard against double-start */
    const SPEED=(Math.PI*2)/8000; /* 1 full rotation per 8 seconds */
    let last=performance.now();
    const tick=now=>{
      if(!this._idleRunning)return;
      const dt=now-last; last=now;
      if(!this.spinning){
        this._wheelAngle+=SPEED*dt;
        this._updateWheelSVG(this._wheelAngle);
      }
      this._idleRaf=requestAnimationFrame(tick);
    };
    this._idleRunning=true;
    this._idleRaf=requestAnimationFrame(tick);
  },

  _stopIdleSpin(){
    this._idleRunning=false;
    if(this._idleRaf){cancelAnimationFrame(this._idleRaf);this._idleRaf=null;}
  },

  _sndChip(){
    if(this._muted)return;
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
    const stc=(nums,gc)=>{
      const s=nums.slice().sort((a,b)=>a-b);
      return`<div class="rl-str" style="grid-row:7;grid-column:${gc}"
        data-bet-type="street" data-bet-key="stt:${s.join(',')}" data-bet-nums="[${s.join(',')}]"
        title="Street ${s.join('-')} · 11:1"><span class="rl-str-dot"></span></div>`;
    };
    const slc=(nums,gc)=>{
      const s=nums.slice().sort((a,b)=>a-b);
      return`<div class="rl-sixl" style="grid-row:7;grid-column:${gc}"
        data-bet-type="sixline" data-bet-key="six:${s.join(',')}" data-bet-nums="[${s.join(',')}]"
        title="Six Line ${s[0]}-${s[5]} · 5:1"><span class="rl-sixl-dot"></span></div>`;
    };
    let cells='';
    for(let c=0;c<12;c++) cells+=nc(row1[c],1,2*c+1)+nc(row2[c],3,2*c+1)+nc(row3[c],5,2*c+1);
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
    for(let c=0;c<12;c++) cells+=stc([row1[c],row2[c],row3[c]],2*c+1);
    for(let c=0;c<11;c++) cells+=slc([row1[c],row2[c],row3[c],row1[c+1],row2[c+1],row3[c+1]],2*c+2);
    return`
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
  <button class="rl-clr2" id="rlClear2">✕ Clear</button>
</div>`;
  },

  _css(){return`
/* hide redundant panel fields when roulette is active */
.rl-panel-mode #gvTabs,
.rl-panel-mode .gv-field:has(#gvBet),
.rl-panel-mode #gvMultField,
.rl-panel-mode #gvProfitField,
.rl-panel-mode #autoPanel{display:none!important}
/* layout */
.rl-wrap{display:flex;flex-direction:row;align-items:flex-start;gap:12px;width:100%;padding:12px;
  background:radial-gradient(120% 85% at 50% -5%,#20273A 0%,#161B29 58%,#10141E 100%);
  border-radius:16px;box-sizing:border-box}
.rl-left{flex:1;min-width:0;display:flex;flex-direction:column;gap:7px}
.rl-right{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:6px}
/* wheel */
.rl-wheel-area{position:relative;display:flex;align-items:center;justify-content:center}
.rl-ptr{position:absolute;top:2px;left:50%;transform:translateX(-50%);
  color:#E6BE55;font-size:18px;line-height:1;filter:drop-shadow(0 2px 6px rgba(0,0,0,.9));pointer-events:none;z-index:2}
.rl-res{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);
  width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:16px;font-weight:900;color:#fff;opacity:0;transition:opacity .4s .1s;
  box-shadow:0 4px 20px rgba(0,0,0,.8);pointer-events:none;z-index:2}
.rl-res.show{opacity:1}
/* payout toast */
.rl-payout{position:absolute;top:18%;left:50%;transform:translateX(-50%);
  font-size:22px;font-weight:900;letter-spacing:.02em;opacity:0;transition:opacity .3s;
  pointer-events:none;z-index:3;text-shadow:0 2px 12px rgba(0,0,0,.9);white-space:nowrap}
.rl-payout.show{opacity:1;animation:rl-payout-in .3s cubic-bezier(.34,1.56,.64,1) both}
.rl-payout.win{color:#4AE68A}
.rl-payout.lose{color:#e2596a}
@keyframes rl-payout-in{from{transform:translateX(-50%) scale(.7)}to{transform:translateX(-50%) scale(1)}}
.rl-res.green{background:#1E7A3C}
.rl-res.red{background:#C81E29}
.rl-res.black{background:#14181F;border:1.5px solid rgba(255,255,255,.2)}
/* streak */
.rl-streak{display:flex;flex-wrap:wrap;justify-content:center;gap:3px;padding:0 4px;width:100%;max-width:400px}
.rl-sdot{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:6.5px;font-weight:800;color:#fff;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,.5)}
.rl-sdot.green{background:#1E7A3C}
.rl-sdot.red{background:#C81E29}
.rl-sdot.black{background:#232323;border:1px solid rgba(255,255,255,.18)}
/* left panel tabs */
.rl-tabs{display:flex;gap:4px;padding:2px;background:rgba(0,0,0,.3);border-radius:8px;margin-bottom:2px}
.rl-tab{flex:1;padding:5px 8px;background:transparent;border:none;border-radius:6px;
  color:rgba(255,255,255,.4);font-size:10px;font-weight:700;letter-spacing:.06em;cursor:pointer;font-family:inherit;transition:all .15s}
.rl-tab.active{background:#1E7A3C;color:#fff;box-shadow:0 2px 8px rgba(30,122,60,.4)}
/* chips */
.rl-chips{display:flex;gap:6px}
.rl-chip{position:relative;width:38px;height:38px;border-radius:50%;border:none;
  background:transparent;cursor:pointer;overflow:hidden;transition:transform .1s,filter .12s;font-family:inherit}
.rl-chip.active{transform:scale(1.18);box-shadow:0 0 0 2px #E6BE55,0 4px 14px rgba(0,0,0,.5)}
.rl-chip:hover:not(.active){filter:brightness(1.22)}
/* action buttons */
.rl-actions{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;margin-top:4px}
.rl-act{display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 2px;
  background:rgba(255,255,255,.05);border:1px solid #2E3649;border-radius:8px;
  color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;font-family:inherit;transition:all .12s}
.rl-act span{font-size:7px;letter-spacing:.05em;font-weight:700}
.rl-act:hover{background:rgba(255,255,255,.1);border-color:#E6BE55;color:#E6BE55}
.rl-act:disabled{opacity:.3;cursor:not-allowed}
/* racetrack toggle */
.rl-toggle-row{display:flex;justify-content:space-between;align-items:center;
  padding:6px 0;border-top:1px solid #1E2638;margin-top:4px;
  font-size:10px;font-weight:700;letter-spacing:.06em;color:rgba(255,255,255,.4)}
.rl-tog{position:relative;display:inline-block;width:34px;height:18px;cursor:pointer}
.rl-tog input{opacity:0;width:0;height:0}
.rl-tog-slider{position:absolute;inset:0;background:#1A2235;border:1px solid #2E3649;border-radius:9px;transition:.2s}
.rl-tog-slider::before{content:'';position:absolute;width:12px;height:12px;left:2px;top:2px;
  background:#3A4560;border-radius:50%;transition:.2s}
.rl-tog input:checked+.rl-tog-slider{background:#1E7A3C;border-color:#1E7A3C}
.rl-tog input:checked+.rl-tog-slider::before{transform:translateX(16px);background:#fff}
/* neighbors */
.rl-nb-row{display:flex;justify-content:space-between;align-items:center;
  padding:6px 0;border-top:1px solid #1E2638;
  font-size:10px;font-weight:700;letter-spacing:.06em;color:rgba(255,255,255,.4)}
.rl-nb-ctrl{display:flex;align-items:center;gap:6px}
.rl-nb-ctrl span{font-size:14px;font-weight:700;color:#E6BE55;min-width:16px;text-align:center}
.rl-nb-btn{width:22px;height:22px;border-radius:50%;border:1px solid #2E3649;
  background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);font-size:14px;
  cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;line-height:1;transition:all .12s}
.rl-nb-btn:hover{border-color:#E6BE55;color:#E6BE55;background:rgba(230,190,85,.1)}
/* manual panel — flex column so margin-top:auto works on totals */
#rlManualPanel{display:flex;flex-direction:column;flex:1;gap:14px}
/* totals */
.rl-totals{display:flex;flex-direction:column;gap:4px;font-size:11px;color:rgba(255,255,255,.4);
  padding-top:6px;border-top:1px solid #1E2638;margin-top:auto}
.rl-totals b{color:rgba(255,255,255,.7)}
/* autoplay panel */
.rl-ap-field{display:flex;flex-direction:column;gap:3px;margin-bottom:8px}
.rl-ap-field label{font-size:9px;font-weight:700;letter-spacing:.06em;color:rgba(255,255,255,.35)}
.rl-ap-inp{background:#0E1523;border:1px solid #2E3649;border-radius:6px;
  color:#fff;font-size:13px;padding:6px 8px;font-family:inherit;outline:none;width:100%;box-sizing:border-box}
.rl-ap-inp:focus{border-color:#E6BE55}
.rl-ap-status{font-size:11px;color:rgba(230,190,85,.7);text-align:center;min-height:18px;margin-top:4px}
/* limits bar */
.rl-limits{display:flex;justify-content:space-between;align-items:center;
  padding:4px 8px;background:rgba(255,255,255,.03);border:1px solid #2E3649;border-radius:7px}
.rl-limits>span{font-size:10px;color:rgba(255,255,255,.35)}
.rl-limits b{color:rgba(255,255,255,.6)}
.rl-limits-name{font-size:9px;color:rgba(255,255,255,.2);letter-spacing:.03em}
/* table */
.rl-table-wrap{width:100%;display:flex;flex-direction:column;gap:4px}
.rl-limits{width:100%;font-size:10px}
.rl-tbl{display:flex;flex-direction:column;gap:5px}
.rl-num-section{display:flex;gap:5px;align-items:stretch}
.rl-zero-col{flex-shrink:0;width:34px;align-self:stretch;display:flex}
.rl-zero{flex:1;min-height:132px;
  background:linear-gradient(158deg,#2E8A50,#10532C);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 4px 14px rgba(0,0,0,.34);border-radius:7px!important}
.rl-mid-wrap{flex:1;display:flex;flex-direction:column;gap:5px}
.rl-num-and-col{display:flex;gap:5px}
.rl-num-area{
  flex:1;display:grid;
  grid-template-columns:repeat(11,minmax(0,1fr) 6px) minmax(0,1fr);
  grid-template-rows:repeat(2,40px 6px) 40px 4px 10px;
  position:relative}
.rl-col-bets{flex-shrink:0;width:36px;display:flex;flex-direction:column;gap:6px}
.rl-col-bets .rl-cell{flex:0 0 40px;height:40px}
.rl-doz-row,.rl-out-row{display:flex;gap:5px}
/* base cell */
.rl-cell{display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:700;cursor:pointer;user-select:none;border-radius:7px;
  border:1px solid #3A4358;color:#C6CEDF;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 2px 4px rgba(0,0,0,.32);
  transition:border-color .12s,box-shadow .12s,transform .06s;position:relative;overflow:visible}
.rl-cell:hover{border-color:#E6BE55;box-shadow:0 0 0 1px rgba(230,190,85,.4),0 6px 18px rgba(0,0,0,.5);
  transform:translateY(-1px);z-index:4;color:#fff}
.rl-cell:active{transform:scale(.96)}
.rl-num{min-height:40px;border:none;color:#fff;font-size:13px;font-weight:700}
.rl-num.r{background:#C81E29;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 2px 4px rgba(0,0,0,.32)}
.rl-num.b{background:#14181F;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 2px 4px rgba(0,0,0,.32)}
.rl-num:hover{filter:brightness(1.28);border:none}
.rl-col{background:rgba(255,255,255,.03);font-size:9px}
.rl-doz{flex:1;background:rgba(255,255,255,.03);height:28px;min-height:28px;font-size:11px}
.rl-doz sup{font-size:7px}
.rl-out{flex:1;background:rgba(255,255,255,.03);height:28px;min-height:28px;font-size:11px;letter-spacing:.02em}
.rl-colr{background:#C81E29!important;border-color:#C81E29!important}
.rl-colb{background:#14181F!important}
.rl-diamond{width:18px;height:18px;transform:rotate(45deg);border-radius:3px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
/* street / six-line */
.rl-str,.rl-sixl{position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:5;border-radius:2px;transition:background .1s}
.rl-str::after,.rl-sixl::after{content:'';position:absolute;inset:-6px;z-index:0}
.rl-str:hover,.rl-sixl:hover{background:rgba(230,190,85,.18)}
.rl-str-dot,.rl-sixl-dot{width:18px;height:4px;border-radius:2px;background:rgba(255,255,255,0);border:1.5px solid rgba(255,255,255,0);transition:all .12s;position:relative;z-index:1}
.rl-str:hover .rl-str-dot,.rl-sixl:hover .rl-sixl-dot{background:#E6BE55;border-color:rgba(0,0,0,.2)}
.rl-sixl-dot{width:28px}
/* split/corner */
.rl-spl,.rl-cor{position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:5;border-radius:2px;transition:background .1s}
.rl-spl::after,.rl-cor::after{content:'';position:absolute;inset:-8px;z-index:0}
.rl-spl:hover,.rl-cor:hover{background:rgba(230,190,85,.12)}
.rl-spl-dot,.rl-cor-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0);border:1.5px solid rgba(255,255,255,0);transition:all .12s;position:relative;z-index:1}
.rl-spl:hover .rl-spl-dot{background:#E6BE55;border-color:rgba(0,0,0,.25)}
.rl-cor-dot{border-radius:1px;transform:rotate(45deg)}
.rl-cor:hover .rl-cor-dot{background:#E6BE55;border-color:rgba(0,0,0,.25)}
/* chip overlay — table */
.rl-bet-chip{position:absolute;top:calc(50% - var(--si,0)*3px);left:50%;transform:translate(-50%,-50%);
  width:20px;height:20px;border-radius:50%;pointer-events:none;z-index:calc(6 + var(--si,0));
  filter:drop-shadow(0 2px 5px rgba(0,0,0,.7))}
/* chip overlay — racetrack */
.rl-rt-n{position:relative;overflow:visible}
.rl-rt-chip{position:absolute;top:-6px;right:-6px;
  width:14px;height:14px;border-radius:50%;pointer-events:none;z-index:4;
  filter:drop-shadow(0 1px 3px rgba(0,0,0,.8))}
/* dolly — winning number marker */
.rl-dolly{position:absolute;top:4px;right:4px;width:12px;height:12px;border-radius:50%;
  background:radial-gradient(circle at 35% 32%,#fff 0%,#E6BE55 38%,#A07B2C 100%);
  border:1.5px solid rgba(255,255,255,.6);
  box-shadow:0 0 6px 2px rgba(230,190,85,.7),0 2px 6px rgba(0,0,0,.8);
  pointer-events:none;z-index:10;
  animation:rl-dolly-in .22s cubic-bezier(.34,1.56,.64,1) both}
@keyframes rl-dolly-in{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
/* table action buttons */
.rl-btns{display:flex;gap:5px;margin-top:2px}
.rl-rebet,.rl-clr2{flex:1;border-radius:7px;height:26px;font-size:10px;font-weight:700;
  cursor:pointer;font-family:inherit;transition:all .12s;letter-spacing:.04em}
.rl-rebet{background:rgba(230,190,85,.06);border:1px solid rgba(230,190,85,.25);color:rgba(230,190,85,.5)}
.rl-rebet:hover:not(:disabled){background:rgba(230,190,85,.14);border-color:#E6BE55;color:#E6BE55}
.rl-rebet:disabled{opacity:.3;cursor:not-allowed}
.rl-clr2{background:rgba(255,255,255,.04);border:1px solid #3A4358;color:rgba(255,255,255,.35)}
.rl-clr2:hover{background:rgba(255,255,255,.08);border-color:#E6BE55;color:#fff}
/* tooltip */
.rl-cell[data-tip]{overflow:visible}
.rl-cell[data-tip]:hover::before{
  content:attr(data-tip);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);
  background:#0C1220;border:1px solid #E6BE55;color:#E6BE55;
  font-size:9px;font-weight:700;letter-spacing:.08em;padding:2px 7px;border-radius:4px;
  white-space:nowrap;pointer-events:none;z-index:200}
.rl-cell[data-tip]:hover::after{
  content:'';position:absolute;bottom:calc(100% + 2px);left:50%;transform:translateX(-50%);
  border:3px solid transparent;border-top-color:#E6BE55;pointer-events:none;z-index:200}
/* racetrack — horizontal under table */
.rl-rt-wrap{width:100%}
.rl-rt-h{display:flex;align-items:stretch;background:#0D1322;border-radius:40px;
  border:1.5px solid #252D3D;padding:5px 0;overflow:hidden}
.rl-rt-end{display:flex;flex-direction:column;justify-content:space-around;align-items:center;
  padding:0 8px;min-width:42px;gap:3px}
.rl-rt-body{flex:1;display:flex;flex-direction:column;
  border-left:1px solid #252D3D;border-right:1px solid #252D3D}
.rl-rt-row{display:flex;justify-content:space-between;padding:3px 4px;gap:2px}
.rl-rt-secs{display:flex;border-top:1px solid #252D3D;border-bottom:1px solid #252D3D;min-height:24px}
.rl-rt-sec{display:flex;align-items:center;justify-content:center;flex:1;
  font-size:9px;font-weight:800;letter-spacing:.06em;cursor:pointer;
  border-right:1px solid #252D3D;transition:all .14s;padding:0 4px}
.rl-rt-sec:last-child{border-right:none}
.rl-sec-tiers{color:#4A90D9}
.rl-sec-tiers:hover{background:rgba(21,101,192,.2);color:#7AB8F0}
.rl-sec-orphelins{color:#D94A8A}
.rl-sec-orphelins:hover{background:rgba(173,26,87,.2);color:#EC7AB8}
.rl-sec-voisins{color:#C8960F}
.rl-sec-voisins:hover{background:rgba(184,134,11,.2);color:#E0B830}
.rl-sec-zero{color:#4CAF66}
.rl-sec-zero:hover{background:rgba(27,94,32,.25);color:#6DD98A}
/* racetrack number cells */
.rl-rt-n{width:26px;height:26px;border-radius:5px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  font-size:9px;font-weight:700;cursor:pointer;user-select:none;
  transition:transform .1s,filter .1s}
.rl-rt-n.r{background:#C81E29;color:#fff}
.rl-rt-n.b{background:#181F2E;color:#fff;border:1px solid #2A3148}
.rl-rt-n.g{background:#1E7A3C;color:#fff}
.rl-rt-n:hover{transform:scale(1.18);filter:brightness(1.35);z-index:2}
.rl-rt-n.rl-rt-active{box-shadow:0 0 0 2px #E6BE55}
/* neighbor label */
.rl-nb-label{position:absolute;top:calc(100% + 4px);left:50%;transform:translateX(-50%);
  background:#0C1220;border:1px solid #E6BE55;color:#E6BE55;
  font-size:9px;font-weight:700;padding:3px 10px;border-radius:5px;white-space:nowrap;
  pointer-events:none;opacity:0;transition:opacity .2s;z-index:20}
.rl-nb-label.show{opacity:1}
#rlSpinGroup [data-n]:hover{opacity:.82}
@keyframes rl-flash{0%,100%{filter:brightness(1)}45%{filter:brightness(2.2) saturate(1.6)}}
.rl-flash{animation:rl-flash .5s ease 3}
`},

  unmount(){
    this._stopIdleSpin();
    this.bets=[];this._undoStack=[];this.spinning=false;this._ballRadius=null;
    this._autoRunning=false;clearTimeout(this._nbTimer);
    document.querySelector('.gv-panel').classList.remove('rl-panel-mode');
    if(typeof gvStage!=='undefined'&&gvStage){gvStage.style.overflowY='';gvStage.style.overflowX='';}
  }
};
