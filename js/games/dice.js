/* --- dice --- */
ORIGINALS['originals-dice']={
  rtp:'99%',auto:true,chance:50,over:true,busy:false,_raf:0,_pend:null,
  mult(){return 99/this.chance},
  mount(){
    engFields.innerHTML=`
      <div class="gv-field"><label>Win Chance <span id="diLbl"></span></label>
        <input type="range" class="eng-range" id="diChance" min="2" max="98" step="1" value="${this.chance}" aria-label="Win chance"/></div>
      <div class="gv-field"><label>Roll Mode</label>
        <div class="auto-segs" id="diMode">
          <button class="auto-seg${this.over?' active':''}" data-v="1">Roll Over</button>
          <button class="auto-seg${this.over?'':' active'}" data-v="0">Roll Under</button>
        </div></div>
      <div class="eng-readout"><span>Payout</span><b id="diPay"></b></div>
      <div class="eng-readout"><span>Profit on Win</span><b id="diProf"></b></div>`;
    gvStage.innerHTML=`
      <div class="dice-wrap">
        <div class="dice-roll idle" id="diRoll">—</div>
        <div class="dice-track"><div class="dice-fill" id="diFill"></div><div class="dice-pin" id="diPin">0</div></div>
        <div class="dice-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
      </div>`;
    $id('diChance').addEventListener('input',()=>{this.chance=+$id('diChance').value;this.sync();});
    $id('diMode').addEventListener('click',e=>{
      const b=e.target.closest('.auto-seg');if(!b||b.disabled)return;
      this.over=b.dataset.v==='1';
      $id('diMode').querySelectorAll('.auto-seg').forEach(x=>x.classList.toggle('active',x===b));
      this.sync();
    });
    this.sync();
  },
  sync(){
    if(!$id('diLbl'))return;
    const t=this.over?100-this.chance:this.chance,w=curW(),b=parseFloat(gvBetIn.value)||0;
    $id('diLbl').textContent=this.chance+'% — roll '+(this.over?'over '+t.toFixed(0):'under '+t.toFixed(0));
    $id('diPay').textContent=this.mult().toFixed(2)+'×';
    $id('diProf').textContent=fmtW(w,b*(this.mult()-1))+' '+w.c;
    const f=$id('diFill');
    if(this.over){f.style.left=t+'%';f.style.right='0';}
    else{f.style.left='0';f.style.right=(100-t)+'%';}
  },
  onCur(){this.sync();},
  onBet(){this.roll(null);},
  autoBet(done){this.roll(done);},
  async roll(done){
    if(this.busy){if(done)stopAuto();return;}
    window._sbActive=true;
    const st=debitBet();
    if(!st){window._sbActive=false;if(done)stopAuto();return;}
    this.busy=true;
    if(!autoRunning)gvBetBtn.disabled=true;
    const rollEl=$id('diRoll'),pin=$id('diPin');
    rollEl.className='dice-roll';
    /* start spinner while waiting for server */
    let spinning=true;
    const spinFn=()=>{if(spinning){rollEl.textContent=rnd(0,100).toFixed(2);this._raf=requestAnimationFrame(spinFn);}};
    this._raf=requestAnimationFrame(spinFn);
    let res;
    try{
      res=await placeBet({game:'dice',currency:st.w.c,wager:st.b,params:{chance:this.chance,over:this.over}});
    }catch(err){
      spinning=false;cancelAnimationFrame(this._raf);
      /* rollback optimistic deduction */
      st.w.amt+=st.b;st.w.fiat=st.w.amt*st.w.rate;renderWallet();
      window._sbActive=false;this.busy=false;gvBetBtn.disabled=false;
      showToast({icon:'⚠',title:'Bet failed',sub:err.message});
      if(done)stopAuto();
      return;
    }
    spinning=false;cancelAnimationFrame(this._raf);
    window._sbActive=false;
    const{roll:r,target:t}=res.gameData,win=res.outcome==='win',m=res.multiplier;
    rollEl.textContent=r.toFixed(2);
    rollEl.classList.add(win?'win':'lose');
    pin.classList.add('show');pin.style.left=r+'%';pin.textContent=r.toFixed(0);
    serverSettleBet(st,win?m:0,res.new_balance);
    this.busy=false;gvBetBtn.disabled=false;
    this.sync();
    if(done)done(win,st.b*(win?m-1:-1));
  },
  unmount(){
    cancelAnimationFrame(this._raf);
    this.busy=false;
  }
};
