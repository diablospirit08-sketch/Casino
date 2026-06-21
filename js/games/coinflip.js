/* --- coinflip (the omertà coin) --- */
ORIGINALS['originals-coinflip']={
  rtp:'99%',auto:true,side:'don',busy:false,_t:0,_bt:0,_pend:null,
  MULT:1.98,

  /* tiny synth — same approach (and volt-snd pref) as plinko/keno */
  sndOn:localStorage.getItem('volt-snd')!=='off',
  _ac:null,_t2:0,
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

  mount(){
    engFields.innerHTML=`
      <div class="gv-field"><label>Call Your Fate</label>
        <div class="auto-segs" id="cfSide">
          <button class="auto-seg${this.side==='don'?' active':''}" data-v="don">🎩 The Don</button>
          <button class="auto-seg${this.side==='snitch'?' active':''}" data-v="snitch">🐀 The Snitch</button>
        </div></div>
      <div class="eng-readout"><span>Payout</span><b>${this.MULT.toFixed(2)}×</b></div>
      <div class="eng-readout"><span>Profit on Win</span><b id="cfProf"></b></div>`;
    gvStage.innerHTML=`
      <div class="cf-wrap">
        <div class="cf-quote">“Heads you double, tails you sleep with the fishes.”</div>
        <div class="cf-scene" id="cfScene">
          <div class="cf-hop" id="cfHop">
            <div class="cf-coin" id="cfCoin">
              ${Array.from({length:5},(_,i)=>`<div class="cf-rim" style="transform:translateZ(${((i-2)*2.7).toFixed(1)}px)"></div>`).join('')}
              <div class="cf-face cf-don"><i>🎩</i><span>The Don</span></div>
              <div class="cf-face cf-snitch"><i>🐀</i><span>The Snitch</span></div>
            </div>
          </div>
          <div class="cf-shadow" id="cfShadow"></div>
          <div class="cf-burst" id="cfBurst"></div>
        </div>
        <div class="cf-msg" id="cfMsg">Toss the coin, wiseguy.</div>
        <div class="cf-hist" id="cfHist"></div>
      </div>`;
    $id('gvSndSlot').innerHTML=`<button class="pl-snd" id="cfSnd" aria-label="Toggle sound">${this.sndOn?'🔊':'🔇'}</button>`;
    $id('cfSide').addEventListener('click',e=>{
      const b=e.target.closest('.auto-seg');if(!b||b.disabled||this.busy)return;
      this.side=b.dataset.v;
      $id('cfSide').querySelectorAll('.auto-seg').forEach(x=>x.classList.toggle('active',x===b));
      this.beep(this.side==='don'?640:520,0.06,0.045,'triangle');
    });
    $id('cfSnd').addEventListener('click',()=>{
      this.sndOn=!this.sndOn;
      localStorage.setItem('volt-snd',this.sndOn?'on':'off');
      $id('cfSnd').textContent=this.sndOn?'🔊':'🔇';
      if(this.sndOn)this.beep(660,0.08,0.05);
    });
    this.sync();
  },
  sync(){
    if(!$id('cfProf'))return;
    const w=curW(),b=parseFloat(gvBetIn.value)||0;
    $id('cfProf').textContent=fmtW(w,b*(this.MULT-1))+' '+w.c;
  },
  onCur(){this.sync();},
  onBet(){this.flip(null);},
  autoBet(done){this.flip(done);},
  async flip(done){
    if(this.busy){if(done)stopAuto();return;}
    window._sbActive=true;
    const st=debitBet();
    if(!st){window._sbActive=false;if(done)stopAuto();return;}
    this.busy=true;
    if(!autoRunning)gvBetBtn.disabled=true;
    $id('cfSide').querySelectorAll('.auto-seg').forEach(b=>b.disabled=true);
    const msg=$id('cfMsg');
    msg.className='cf-msg';msg.textContent='The coin is spinning…';
    /* start coin animation while waiting for server */
    const coin=$id('cfCoin'),hop=$id('cfHop'),shadow=$id('cfShadow'),dur=autoRunning?700:1200;
    coin.style.transition='none';
    coin.style.transform='rotateY(0deg)';
    $id('cfScene').classList.remove('shake');
    hop.classList.remove('toss');shadow.classList.remove('toss');
    void coin.offsetHeight;
    /* spin without revealing face until server responds */
    coin.style.transition='transform '+dur+'ms cubic-bezier(0.25,1,0.5,1)';
    coin.style.transform='rotateY(1080deg)';
    hop.style.animationDuration=shadow.style.animationDuration=dur+'ms';
    hop.classList.add('toss');shadow.classList.add('toss');
    this.beep(220,0.18,0.05,'triangle');
    creditTo(st.w,st.b);
    let res;
    try{
      res=await placeBet({game:'coinflip',currency:st.w.c,wager:st.b,params:{side:this.side}});
    }catch(err){
      window._sbActive=false;this.busy=false;gvBetBtn.disabled=false;
      $id('cfSide').querySelectorAll('.auto-seg').forEach(b=>b.disabled=false);
      msg.textContent='Toss the coin, wiseguy.';
      showToast({icon:'⚠',title:'Bet failed',sub:err.message});
      if(done)stopAuto();
      return;
    }
    window._sbActive=false;
    const gameResult=res.gameData||{};
    const outcome=gameResult.side||'don';
    const win=!!gameResult.win;
    const m=res.multiplier||0;
    /* snap to final face after spin */
    this._t=setTimeout(()=>{
      void coin.offsetHeight;
      coin.style.transition='transform 120ms ease-out';
      coin.style.transform='rotateY('+(1440+(outcome==='snitch'?180:0))+'deg)';
    },dur-80);
    this._t2=setTimeout(()=>{
      if(win){
        msg.classList.add('w');
        msg.textContent=(outcome==='don'?'The Don smiles upon you.':'The Snitch pays his debts.')
          +' +'+fmtW(st.w,st.b*(this.MULT-1))+' '+st.w.c;
        this.beep(660,0.12,0.06);this.beep(990,0.18,0.05);
        $id('cfBurst').innerHTML=Array.from({length:14},()=>{
          const a=Math.random()*Math.PI*2,d=62+Math.random()*55;
          return `<i style="--dx:${(Math.cos(a)*d).toFixed(0)}px;--dy:${(Math.sin(a)*d).toFixed(0)}px;animation-delay:${(Math.random()*80)|0}ms"></i>`;
        }).join('');
        clearTimeout(this._bt);
        this._bt=setTimeout(()=>{const b=$id('cfBurst');if(b)b.innerHTML='';},900);
      }else{
        msg.classList.add('l');
        msg.textContent=outcome==='snitch'?'Treason! The Snitch took your tribute.':'The Don keeps your tribute. Capisce?';
        this.beep(170,0.16,0.06);
        $id('cfScene').classList.add('shake');
      }
      const hist=$id('cfHist');
      hist.insertAdjacentHTML('afterbegin',`<span class="cf-chip ${outcome}" title="${outcome==='don'?'The Don':'The Snitch'}">${outcome==='don'?'🎩':'🐀'}</span>`);
      while(hist.children.length>8)hist.lastElementChild.remove();
      serverSettleBet(st,win?m:0,res.new_balance);
      this.busy=false;gvBetBtn.disabled=false;
      $id('cfSide').querySelectorAll('.auto-seg').forEach(b=>b.disabled=autoRunning);
      this.sync();
      if(done)done(win,st.b*(win?this.MULT-1:-1));
    },dur+120);
  },
  unmount(){
    clearTimeout(this._t);clearTimeout(this._t2);clearTimeout(this._bt);
    this.busy=false;
  }
};
