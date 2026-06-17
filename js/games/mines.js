/* --- mines --- */
const MINE_IMG='<img class="mine-img" src="art/mine/mine.webp.webp" alt="mine">';
const GEM_IMG='<img class="mine-img" src="art/mine/gem.png.png" alt="gem">';
const DEAL_MINES_URL='https://czqqdwmifcqoiyphjqjk.supabase.co/functions/v1/deal-mines';
const PICK_MINES_URL='https://czqqdwmifcqoiyphjqjk.supabase.co/functions/v1/pick-mines-tile';

ORIGINALS['originals-mines']={
  rtp:'99%',auto:false,m:3,round:null,

  mount(){
    engFields.innerHTML=`
      <div class="gv-field"><label>Mines <span id="mnLbl"></span></label>
        <div class="auto-segs" id="mnSegs">
          ${[1,3,5,10,24].map(v=>`<button class="auto-seg${v===this.m?' active':''}" data-v="${v}">${v}</button>`).join('')}
        </div></div>
      <div class="eng-readout"><span>Next Tile Pays</span><b id="mnNextPay">—</b></div>`;
    gvStage.innerHTML=`
      <div class="mines-wrap">
        <div class="mines-pot"><span>Multiplier <b id="mnMult">—</b></span><span>Profit <b id="mnProf">—</b></span></div>
        <div class="mines-grid" id="mnGrid">${Array.from({length:25},(_,i)=>`<button class="mtile hid" data-i="${i}" aria-label="Tile ${i+1}"></button>`).join('')}</div>
      </div>`;
    $id('mnSegs').addEventListener('click',e=>{
      const b=e.target.closest('.auto-seg');if(!b||b.disabled||this.round)return;
      this.m=+b.dataset.v;
      $id('mnSegs').querySelectorAll('.auto-seg').forEach(x=>x.classList.toggle('active',x===b));
      this.sync();
    });
    $id('mnGrid').addEventListener('click',e=>{
      const t=e.target.closest('.mtile');if(t)this.pick(t);
    });
    this.sync();
  },
  multAt(k){let f=1;for(let i=0;i<k;i++)f*=(25-i)/(25-this.m-i);return 0.99*f;},
  sync(){
    if(!$id('mnLbl'))return;
    $id('mnLbl').textContent=this.m+' of 25';
    const r=this.round,k=r?r.k:0;
    $id('mnNextPay').textContent=this.multAt(k+1).toFixed(2)+'×';
    $id('mnMult').textContent=r&&r.k>0?this.multAt(r.k).toFixed(2)+'×':'—';
    $id('mnProf').textContent=r&&r.k>0?fmtW(r.st.w,r.st.b*(this.multAt(r.k)-1))+' '+r.st.w.c:'—';
    if(!autoRunning){syncBetBtn();gvBetBtn.disabled=!!r&&r.k===0&&!r.picking;}
  },
  label(){
    const r=this.round;
    if(!r)return'Bet';
    return r.k>0?'Cash Out '+fmtW(r.st.w,r.st.b*this.multAt(r.k))+' '+r.st.w.c:'Pick a tile…';
  },
  onCur(){this.sync();},
  onBet(){
    if(this.round){if(this.round.k>0)this.cashout();return;}
    this._deal();
  },
  async _deal(){
    if(!document.body.classList.contains('authed')){openAuth('in');return;}
    const w=curW(),b=Math.min(parseFloat(gvBetIn.value)||0,w.amt);
    if(b<=0)return;

    gvBetBtn.disabled=true;gvBetBtn.textContent='Dealing…';
    lockBet(true);
    $id('mnSegs').querySelectorAll('.auto-seg').forEach(btn=>btn.disabled=true);

    /* get server-committed round before debiting */
    let dealData;
    try{
      const{data:{session}}=await supa.auth.getSession();
      if(!session)throw new Error('Not signed in');
      const res=await fetch(DEAL_MINES_URL,{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
        body:JSON.stringify({mines:this.m})});
      dealData=await res.json();
      if(!res.ok)throw new Error(dealData.error||'Deal failed');
    }catch(err){
      lockBet(false);gvBetBtn.disabled=false;
      $id('mnSegs').querySelectorAll('.auto-seg').forEach(btn=>btn.disabled=false);
      this.sync();
      if(window.showToast)showToast({icon:'⚠',title:'Deal failed',sub:err.message});
      return;
    }

    /* debit only after server committed to a layout */
    const st=debitBet();
    if(!st){
      lockBet(false);gvBetBtn.disabled=false;
      $id('mnSegs').querySelectorAll('.auto-seg').forEach(btn=>btn.disabled=false);
      this.sync();
      return;
    }

    this.round={st,roundId:dealData.roundId,k:0,done:false,picking:false};
    const grid=$id('mnGrid');grid.classList.add('live');
    grid.querySelectorAll('.mtile').forEach(t=>{t.className='mtile hid';t.textContent='';});
    this.sync();
  },
  async pick(t){
    const r=this.round;
    if(!r||r.done||r.picking||!t.classList.contains('hid'))return;
    const tileIndex=+t.dataset.i;
    r.picking=true;
    t.classList.add('picking');

    let pickData;
    try{
      const{data:{session}}=await supa.auth.getSession();
      if(!session)throw new Error('Not signed in');
      const res=await fetch(PICK_MINES_URL,{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
        body:JSON.stringify({roundId:r.roundId,tile:tileIndex})});
      pickData=await res.json();
      if(!res.ok)throw new Error(pickData.error||'Pick failed');
    }catch(err){
      t.classList.remove('picking');
      r.picking=false;
      if(window.showToast)showToast({icon:'⚠',title:'Pick failed',sub:err.message});
      return;
    }

    t.classList.remove('picking','hid');
    r.picking=false;

    if(pickData.result==='mine'){
      t.classList.add('boom');t.innerHTML=MINE_IMG;
      /* server already deleted the round; reveal positions it returned */
      if(Array.isArray(pickData.mines)){
        $id('mnGrid').querySelectorAll('.mtile.hid').forEach(tile=>{
          const i=+tile.dataset.i;
          tile.classList.remove('hid');tile.classList.add('dim');
          tile.innerHTML=pickData.mines.includes(i)?MINE_IMG:GEM_IMG;
        });
      }
      r.done=true;
      const grid=$id('mnGrid');grid.classList.remove('live');
      /* settle loss — round already deleted by pick-mines-tile, use wager=0 path */
      settleBet(r.st,0);
      this.round=null;lockBet(false);
      $id('mnSegs').querySelectorAll('.auto-seg').forEach(btn=>btn.disabled=false);
      this.sync();
    }else{
      t.classList.add('safe');t.innerHTML=GEM_IMG;
      r.k=pickData.safeCount;
      if(r.k===25-this.m){
        /* all safe tiles revealed — auto-cashout */
        this.cashout();
      }else{
        this.sync();
      }
    }
  },
  cashout(){
    const r=this.round;if(!r||r.done||r.k===0||r.picking)return;
    this._settle(this.multAt(r.k));
  },
  async _settle(mult){
    const r=this.round;r.done=true;
    const grid=$id('mnGrid');grid.classList.remove('live');
    grid.querySelectorAll('.mtile.hid').forEach(t=>{
      t.classList.remove('hid');t.classList.add('dim');
      /* positions not known client-side — show question mark placeholders */
      t.innerHTML='<span class="mtile-unk">?</span>';
    });
    let res;
    try{
      res=await placeBet({game:'mines',currency:r.st.w.c,wager:r.st.b,
        params:{roundId:r.roundId}});
    }catch(err){
      /* server unreachable — apply payout locally */
      settleBet(r.st,mult);
      this.round=null;lockBet(false);
      $id('mnSegs').querySelectorAll('.auto-seg').forEach(btn=>btn.disabled=false);
      this.sync();return;
    }
    serverSettleBet(r.st,mult,res.new_balance);
    this.round=null;lockBet(false);
    $id('mnSegs').querySelectorAll('.auto-seg').forEach(btn=>btn.disabled=false);
    this.sync();
  },
  unmount(){
    const r=this.round;
    if(r&&!r.done){
      if(r.k>0){
        /* cashout what's been earned */
        placeBet({game:'mines',currency:r.st.w.c,wager:r.st.b,params:{roundId:r.roundId}})
          .then(res=>serverSettleBet(r.st,this.multAt(r.k),res.new_balance))
          .catch(()=>settleBet(r.st,this.multAt(r.k)));
      }else{
        /* no tiles revealed yet — forfeit the bet (round still in DB, will expire) */
        settleBet(r.st,0);
      }
    }
    this.round=null;
  }
};
