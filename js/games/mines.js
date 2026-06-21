/* --- mines --- */
const MINE_IMG='<img class="mine-img" src="art/mine/mine.webp" alt="mine">';
const GEM_IMG='<img class="mine-img" src="art/mine/gem.png" alt="gem">';

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
    if(!autoRunning){syncBetBtn();gvBetBtn.disabled=!!(r&&r._checking);}
  },
  label(){
    const r=this.round;
    if(!r)return'Bet';
    if(r.k===0)return'Cancel Bet';
    return'Cash Out '+fmtW(r.st.w,r.st.b*this.multAt(r.k))+' '+r.st.w.c;
  },
  onCur(){this.sync();},
  onBet(){
    if(this.round){
      if(this.round.k===0){this._cancel();return;}
      if(this.round.k>0)this.cashout();
      return;
    }
    this._deal();
  },
  _cancel(){
    const r=this.round;
    if(!r||r.done||r.k!==0)return;
    r.done=true;
    creditTo(r.st.w,r.st.b);
    const grid=$id('mnGrid');
    grid.classList.remove('live');
    grid.querySelectorAll('.mtile').forEach(t=>{t.className='mtile hid';t.innerHTML='';});
    $id('mnSegs').querySelectorAll('.auto-seg').forEach(btn=>btn.disabled=false);
    this.round=null;lockBet(false);this.sync();
  },
  _deal(){
    if(!document.body.classList.contains('authed')){openAuth('in');return;}
    const w=curW(),b=Math.min(parseFloat(gvBetIn.value)||0,w.amt);
    if(b<=0)return;

    const st=debitBet();
    if(!st)return;

    lockBet(true);
    $id('mnSegs').querySelectorAll('.auto-seg').forEach(btn=>btn.disabled=true);

    this.round={st,cells:[],k:0,done:false,_checking:false};
    const grid=$id('mnGrid');
    grid.classList.add('live');
    grid.querySelectorAll('.mtile').forEach(t=>{t.className='mtile hid';t.innerHTML='';});
    this.sync();
  },
  pick(t){
    const r=this.round;
    if(!r||r.done||r._checking||!t.classList.contains('hid'))return;

    const idx=+t.dataset.i;
    r._checking=true;
    r.cells.push(idx);
    r.k=r.cells.length;

    t.classList.remove('hid');
    t.classList.add('checking');
    t.innerHTML='<span class="mtile-spin"></span>';
    this.sync();

    setTimeout(()=>{
      if(!this.round||this.round.done)return;
      r._checking=false;
      t.classList.remove('checking');
      t.classList.add('safe');
      t.innerHTML=GEM_IMG;

      if(r.k===25-this.m){
        this.cashout();
      }else{
        this.sync();
      }
    },350);
  },
  cashout(){
    const r=this.round;if(!r||r.done||r.k===0)return;
    this._settle();
  },
  async _settle(){
    const r=this.round;
    r.done=true;
    const mult=this.multAt(r.k);
    const grid=$id('mnGrid');
    grid.classList.remove('live');

    grid.querySelectorAll('.mtile.hid').forEach(t=>{
      t.classList.remove('hid');t.classList.add('dim');
      t.innerHTML='<span class="mtile-unk">?</span>';
    });

    let res;
    try{
      res=await placeBet({
        game:'mines',
        currency:r.st.w.c,
        wager:r.st.b,
        params:{mineCount:this.m,revealedCells:r.cells},
      });
    }catch(err){
      /* server unreachable — refund the local debit, do not pay out */
      creditTo(r.st.w,r.st.b);
      this.round=null;lockBet(false);
      $id('mnSegs').querySelectorAll('.auto-seg').forEach(btn=>btn.disabled=false);
      this.sync();
      if(window.showToast)showToast({icon:'⚠',title:'Server error — bet refunded',sub:err.message});
      return;
    }

    const outcome=res.outcome||res.result||{};
    const hitMine=!!outcome.hitMine;
    const mines=outcome.mines||[];

    if(hitMine){
      const mineSet=new Set(mines);
      grid.querySelectorAll('.mtile').forEach(tile=>{
        const i=+tile.dataset.i;
        const picked=r.cells.includes(i);
        const isMine=mineSet.has(i);
        if(picked&&isMine){
          tile.classList.remove('safe','dim');tile.classList.add('boom');
          tile.innerHTML=MINE_IMG;
        }else if(tile.classList.contains('dim')&&!picked){
          tile.innerHTML=isMine?MINE_IMG:GEM_IMG;
        }
      });
      settleBet(r.st,0);
    }else{
      const actualMult=res.multiplier||mult;
      serverSettleBet(r.st,actualMult,null);
    }

    this.round=null;lockBet(false);
    $id('mnSegs').querySelectorAll('.auto-seg').forEach(btn=>btn.disabled=false);
    this.sync();
  },
  unmount(){
    const r=this.round;
    if(r&&!r.done){
      if(r.k>0){
        placeBet({game:'mines',currency:r.st.w.c,wager:r.st.b,
          params:{mineCount:this.m,revealedCells:r.cells}})
          .then(res=>{
            const outcome=res.outcome||res.result||{};
            if(!outcome.hitMine)serverSettleBet(r.st,res.multiplier||this.multAt(r.k),null);
            else settleBet(r.st,0);
          })
          .catch(()=>creditTo(r.st.w,r.st.b));
      }else{
        creditTo(r.st.w,r.st.b);
      }
    }
    this.round=null;
  }
};
