/* --- roulette --- */
ORIGINALS['originals-roulette']={
  rtp:'97.3%',
  auto:false,
  bets:[],
  spinning:false,
  _wheelAngle:0,
  _chipVal:1,

  /* European wheel order clockwise */
  WHEEL:[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26],
  RED:new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]),
  /* total-return multipliers (includes stake) */
  PAYS:{straight:36,split:18,street:12,corner:9,sixline:6,dozen:3,column:3,half:2,color:2,evenodd:2},

  mount(){
    if(!document.getElementById('rl-css')){
      const s=document.createElement('style');s.id='rl-css';
      s.textContent=this._css();document.head.appendChild(s);
    }
    engFields.innerHTML=`
      <div class="gv-field"><label>Chip</label>
        <div class="rl-chips" id="rlChips">
          ${[1,5,25,100,500].map(v=>`<button class="rl-chip${v===1?' active':''}" data-v="${v}"
            style="background:${v>=500?'#c9a227':v>=100?'#8e44ad':v>=25?'#1e8449':v>=5?'#c0392b':'#2471a3'};color:${v>=500?'#1a1100':'#fff'}">\$${v}</button>`).join('')}
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
          <canvas id="rlWheel" class="rl-wheel" width="210" height="210"></canvas>
          <div class="rl-ptr">▼</div>
          <div class="rl-res" id="rlRes"></div>
        </div>
        <div class="rl-table-wrap">
          ${this._tableHTML()}
        </div>
      </div>`;
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
    this._drawWheel(this._wheelAngle);
    this._renderBets();this._syncInfo();this._syncBtn();
  },

  _addBet(type,key,numbers){
    const w=curW();
    const chipCrypto=this._chipVal/w.rate;
    const totalSoFar=this.bets.reduce((s,b)=>s+b.amount,0);
    if(totalSoFar+chipCrypto>w.amt+1e-9)return;
    const ex=this.bets.find(b=>b.key===key);
    if(ex){ex.amount+=chipCrypto;ex.fiat+=this._chipVal;}
    else this.bets.push({type,key,numbers,amount:chipCrypto,fiat:this._chipVal});
    this._renderBets();this._syncInfo();this._syncBtn();
  },

  _renderBets(){
    document.querySelectorAll('.rl-bet-chip').forEach(e=>e.remove());
    for(const bet of this.bets){
      const cell=document.querySelector(`[data-bet-key="${bet.key}"]`);if(!cell)continue;
      const chip=document.createElement('div');chip.className='rl-bet-chip';
      const v=bet.fiat;
      chip.style.cssText=`background:${v>=500?'#c9a227':v>=100?'#8e44ad':v>=25?'#1e8449':v>=5?'#c0392b':'#2471a3'};color:${v>=500?'#1a1100':'#fff'}`;
      chip.textContent=v>=1000?(v/1000).toFixed(1)+'k':'$'+Math.round(v);
      cell.appendChild(chip);
    }
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
  },

  label(){
    if(this.spinning)return'Spinning…';
    return this.bets.length>0?'Spin':'Place Bets';
  },

  onBet(){if(!this.spinning&&this.bets.length>0)this._spin();},

  async _spin(){
    if(!document.body.classList.contains('authed')){openAuth('in');return;}
    const w=curW();
    const totalC=this.bets.reduce((s,b)=>s+b.amount,0);
    if(totalC<=0||totalC>w.amt+1e-9)return;
    this.spinning=true;lockBet(true);gvBetBtn.disabled=true;gvBetBtn.textContent='Spinning…';
    w.amt-=totalC;w.fiat=w.amt*w.rate;renderWallet();
    const st={w,b:totalC,name:'Roulette'};
    let res;
    try{
      res=await placeBet({game:'roulette',currency:w.c,wager:totalC,
        params:{bets:this.bets.map(b=>({type:b.type,numbers:b.numbers,amount:b.amount}))}});
    }catch(err){
      w.amt+=totalC;w.fiat=w.amt*w.rate;renderWallet();
      this.spinning=false;lockBet(false);
      this.bets=[];this._renderBets();this._syncInfo();this._syncBtn();
      if(window.showToast)showToast({icon:'⚠',title:'Spin failed',sub:err.message});
      return;
    }
    const spinResult=res.gameData.result;
    await this._animateWheel(spinResult);
    const rlRes=document.getElementById('rlRes');
    if(rlRes){
      const col=spinResult===0?'green':this.RED.has(spinResult)?'red':'black';
      rlRes.textContent=spinResult;rlRes.className='rl-res show '+col;
    }
    serverSettleBet(st,res.multiplier,res.new_balance);
    this._flashWin(spinResult);
    await new Promise(r=>setTimeout(r,2500));
    this.spinning=false;this.bets=[];this._renderBets();this._syncInfo();
    if(rlRes)rlRes.className='rl-res';
    lockBet(false);this._syncBtn();
  },

  async _animateWheel(result){
    const seg=(Math.PI*2)/37;
    const idx=this.WHEEL.indexOf(result);
    /* rotate wheel so segment idx lands at top pointer */
    const target=-idx*seg;
    const diff=((target-this._wheelAngle)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
    const spins=5+Math.random()*2;
    const end=this._wheelAngle+spins*Math.PI*2+diff;
    const start=this._wheelAngle;
    const dur=4800;const t0=performance.now();
    return new Promise(resolve=>{
      const frame=now=>{
        const t=Math.min((now-t0)/dur,1);
        const e=1-Math.pow(1-t,3); /* ease-out cubic */
        this._wheelAngle=start+(end-start)*e;
        this._drawWheel(this._wheelAngle);
        if(t<1)requestAnimationFrame(frame);else resolve();
      };
      requestAnimationFrame(frame);
    });
  },

  _drawWheel(angle){
    const cv=document.getElementById('rlWheel');if(!cv)return;
    const ctx=cv.getContext('2d');
    const W=210,cx=105,cy=105,r=98,ri=26;
    ctx.clearRect(0,0,W,W);
    const seg=(Math.PI*2)/37;
    for(let i=0;i<37;i++){
      const n=this.WHEEL[i];
      const a0=angle+i*seg-Math.PI/2-seg/2,a1=a0+seg;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,a0,a1);ctx.closePath();
      ctx.fillStyle=n===0?'#1e8449':this.RED.has(n)?'#c92356':'#141414';ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=0.7;ctx.stroke();
      const mid=(a0+a1)/2;
      const tx=cx+(r-13)*Math.cos(mid),ty=cy+(r-13)*Math.sin(mid);
      ctx.save();ctx.translate(tx,ty);ctx.rotate(mid+Math.PI/2);
      ctx.fillStyle='#fff';ctx.font=`bold ${n>=10?6.5:7.5}px Inter,system-ui,sans-serif`;
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(n,0,0);ctx.restore();
    }
    /* ball track */
    ctx.beginPath();ctx.arc(cx,cy,r+1,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=3;ctx.stroke();
    /* hub */
    const hg=ctx.createRadialGradient(cx,cy-5,2,cx,cy,ri);
    hg.addColorStop(0,'#2a2a2a');hg.addColorStop(1,'#0d0d0d');
    ctx.beginPath();ctx.arc(cx,cy,ri,0,Math.PI*2);ctx.fillStyle=hg;ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1.5;ctx.stroke();
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

  _tableHTML(){
    const RED=this.RED;
    /* Top row = multiples of 3, mid = 3n-1, bot = 3n-2 */
    const row1=[],row2=[],row3=[];
    for(let c=1;c<=12;c++){row1.push(3*c);row2.push(3*c-1);row3.push(3*c-2);}
    const nc=(n)=>{
      const cl=RED.has(n)?'r':'b';
      return `<div class="rl-cell rl-num ${cl}" data-bet-type="straight" data-bet-key="str:${n}" data-bet-nums="[${n}]">${n}</div>`;
    };
    return`
<div class="rl-tbl" id="rlTable">
  <div class="rl-num-section">
    <div class="rl-zero-col">
      <div class="rl-cell rl-zero" data-bet-type="straight" data-bet-key="str:0" data-bet-nums="[0]">0</div>
    </div>
    <div class="rl-num-area">
      <div class="rl-nrow">${row1.map(nc).join('')}<div class="rl-cell rl-col" data-bet-type="column" data-bet-key="col:1" data-bet-nums="[${row1}]">2:1</div></div>
      <div class="rl-nrow">${row2.map(nc).join('')}<div class="rl-cell rl-col" data-bet-type="column" data-bet-key="col:2" data-bet-nums="[${row2}]">2:1</div></div>
      <div class="rl-nrow">${row3.map(nc).join('')}<div class="rl-cell rl-col" data-bet-type="column" data-bet-key="col:3" data-bet-nums="[${row3}]">2:1</div></div>
    </div>
  </div>
  <div class="rl-doz-row">
    <div class="rl-cell rl-doz" data-bet-type="dozen" data-bet-key="doz:1" data-bet-nums="[1,2,3,4,5,6,7,8,9,10,11,12]">1–12</div>
    <div class="rl-cell rl-doz" data-bet-type="dozen" data-bet-key="doz:2" data-bet-nums="[13,14,15,16,17,18,19,20,21,22,23,24]">13–24</div>
    <div class="rl-cell rl-doz" data-bet-type="dozen" data-bet-key="doz:3" data-bet-nums="[25,26,27,28,29,30,31,32,33,34,35,36]">25–36</div>
  </div>
  <div class="rl-out-row">
    <div class="rl-cell rl-out" data-bet-type="half"    data-bet-key="half:lo" data-bet-nums="[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]">1–18</div>
    <div class="rl-cell rl-out" data-bet-type="evenodd" data-bet-key="eo:even" data-bet-nums="[2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36]">Even</div>
    <div class="rl-cell rl-out rl-colr" data-bet-type="color" data-bet-key="clr:r" data-bet-nums="[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]">Red</div>
    <div class="rl-cell rl-out rl-colb" data-bet-type="color" data-bet-key="clr:b" data-bet-nums="[2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]">Black</div>
    <div class="rl-cell rl-out" data-bet-type="evenodd" data-bet-key="eo:odd"  data-bet-nums="[1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35]">Odd</div>
    <div class="rl-cell rl-out" data-bet-type="half"    data-bet-key="half:hi" data-bet-nums="[19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36]">19–36</div>
  </div>
</div>
<button class="rl-clr" id="rlClear">✕ Clear Bets</button>`;
  },

  _css(){return`
.rl-wrap{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;padding:6px 0 14px}
.rl-wheel-area{position:relative;display:flex;align-items:center;justify-content:center}
.rl-wheel{border-radius:50%;display:block;
  box-shadow:0 0 0 3px rgba(255,255,255,.07),0 8px 40px rgba(0,0,0,.7)}
.rl-ptr{position:absolute;top:-10px;left:50%;transform:translateX(-50%);
  color:#d4af37;font-size:22px;line-height:1;
  filter:drop-shadow(0 2px 5px rgba(0,0,0,.8));pointer-events:none}
.rl-res{position:absolute;bottom:-22px;left:50%;transform:translateX(-50%);
  width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:15px;font-weight:900;color:#fff;opacity:0;transition:opacity .4s .1s;
  box-shadow:0 4px 16px rgba(0,0,0,.7);pointer-events:none}
.rl-res.show{opacity:1}
.rl-res.green{background:#1e8449}
.rl-res.red{background:#c92356}
.rl-res.black{background:#1f1f1f;border:1.5px solid rgba(255,255,255,.2)}
.rl-chips{display:flex;gap:7px}
.rl-chip{width:40px;height:40px;border-radius:50%;border:2px dashed rgba(255,255,255,.28);
  font-size:9px;font-weight:900;cursor:pointer;
  transition:transform .1s,box-shadow .1s,filter .12s;font-family:inherit}
.rl-chip.active{transform:scale(1.18);box-shadow:0 0 0 2px #fff,0 4px 14px rgba(0,0,0,.5)}
.rl-chip:hover:not(.active){filter:brightness(1.22)}
.rl-totals{display:flex;flex-direction:column;gap:5px;font-size:12px;color:rgba(255,255,255,.55)}
.rl-totals b{color:#e8e8e8}
/* Table */
.rl-table-wrap{width:100%;max-width:640px}
.rl-tbl{display:flex;flex-direction:column;gap:2px}
.rl-num-section{display:flex;gap:2px}
.rl-zero-col{flex-shrink:0;width:34px}
.rl-zero{height:100%;min-height:108px;background:#1e8449;border-radius:5px}
.rl-num-area{flex:1;display:flex;flex-direction:column;gap:2px}
.rl-nrow{display:flex;gap:2px}
.rl-doz-row,.rl-out-row{display:flex;gap:2px;margin-left:36px}
.rl-cell{display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:700;cursor:pointer;user-select:none;border-radius:4px;
  border:1px solid rgba(255,255,255,.1);
  transition:filter .12s,transform .06s;min-height:34px;position:relative}
.rl-cell:hover{filter:brightness(1.45);transform:scale(1.06);z-index:2}
.rl-cell:active{transform:scale(.95)}
.rl-num{flex:1;min-width:28px}
.rl-num.r{background:#c92356}
.rl-num.b{background:#141414}
.rl-col{flex-shrink:0;width:36px;background:rgba(255,255,255,.07);font-size:8px}
.rl-doz{flex:1;background:rgba(255,255,255,.07);height:26px;min-height:26px}
.rl-out{flex:1;background:rgba(255,255,255,.07);height:26px;min-height:26px}
.rl-colr{background:#c92356!important}
.rl-colb{background:#141414!important}
.rl-bet-chip{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:20px;height:20px;border-radius:50%;
  font-size:6px;font-weight:900;
  display:flex;align-items:center;justify-content:center;
  border:1.5px solid rgba(255,255,255,.5);
  box-shadow:0 2px 6px rgba(0,0,0,.6);z-index:3;pointer-events:none}
.rl-clr{margin-top:6px;width:100%;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.08);border-radius:6px;height:26px;
  color:rgba(255,255,255,.38);font-size:11px;cursor:pointer;font-family:inherit;transition:background .1s}
.rl-clr:hover{background:rgba(255,255,255,.09);color:#fff}
@keyframes rl-flash{0%,100%{filter:brightness(1)}45%{filter:brightness(2.4) saturate(1.5)}}
.rl-flash{animation:rl-flash .5s ease 3}
`},

  unmount(){this.bets=[];this.spinning=false;}
};
