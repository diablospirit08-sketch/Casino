/* --- mines --- */
const MINE_IMG='<img class="mine-img" src="art/mine/mine.webp.webp" alt="mine">';
const GEM_IMG='<img class="mine-img" src="art/mine/gem.png.png" alt="gem">';
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
    if(!autoRunning){syncBetBtn();gvBetBtn.disabled=!!r&&r.k===0;}
  },
  label(){
    const r=this.round;
    if(!r)return'Bet';
    return r.k>0?'Cash Out '+fmtW(r.st.w,r.st.b*this.multAt(r.k))+' '+r.st.w.c:'Pick a tile…';
  },
  onCur(){this.sync();},
  onBet(){
    if(this.round){if(this.round.k>0)this.cashout();return;}
    const st=debitBet();if(!st)return;
    const mines=new Set();while(mines.size<this.m)mines.add(Math.floor(Math.random()*25));
    this.round={st,mines,k:0,done:false};
    lockBet(true);
    $id('mnSegs').querySelectorAll('.auto-seg').forEach(b=>b.disabled=true);
    const grid=$id('mnGrid');grid.classList.add('live');
    grid.querySelectorAll('.mtile').forEach(t=>{t.className='mtile hid';t.textContent='';});
    this.sync();
  },
  pick(t){
    const r=this.round;if(!r||r.done||!t.classList.contains('hid'))return;
    const i=+t.dataset.i;
    t.classList.remove('hid');
    if(r.mines.has(i)){
      t.classList.add('boom');t.innerHTML=MINE_IMG;
      this.end(0);
    }else{
      t.classList.add('safe');t.innerHTML=GEM_IMG;
      r.k++;
      if(r.k===25-this.m)this.cashout();
      else this.sync();
    }
  },
  cashout(){
    const r=this.round;if(!r||r.done||r.k===0)return;
    this.end(this.multAt(r.k));
  },
  async end(mult){
    const r=this.round;r.done=true;
    const grid=$id('mnGrid');grid.classList.remove('live');
    grid.querySelectorAll('.mtile.hid').forEach(t=>{
      t.classList.remove('hid');t.classList.add('dim');
      t.innerHTML=r.mines.has(+t.dataset.i)?MINE_IMG:GEM_IMG;
    });
    let res;
    try{
      res=await placeBet({game:'mines',currency:r.st.w.c,wager:r.st.b,
        params:{action:'cashout',mines:this.m,k:r.k}});
    }catch(err){
      settleBet(r.st,mult);
      this.round=null;lockBet(false);
      $id('mnSegs').querySelectorAll('.auto-seg').forEach(b=>b.disabled=false);
      this.sync();return;
    }
    serverSettleBet(r.st,mult,res.new_balance);
    this.round=null;lockBet(false);
    $id('mnSegs').querySelectorAll('.auto-seg').forEach(b=>b.disabled=false);
    this.sync();
  },
  unmount(){
    const r=this.round;
    if(r&&!r.done){
      const mult=r.k>0?this.multAt(r.k):0;
      placeBet({game:'mines',currency:r.st.w.c,wager:r.st.b,params:{action:'cashout',mines:this.m,k:r.k}})
        .then(res=>serverSettleBet(r.st,mult,res.new_balance))
        .catch(()=>settleBet(r.st,mult));
    }
    this.round=null;
  }
};
