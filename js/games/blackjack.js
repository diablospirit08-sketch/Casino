/* --- blackjack --- */
ORIGINALS['originals-blackjack']={
  rtp:'99.5%',auto:false,h:null,_t:[],
  mount(){
    engFields.innerHTML='';
    gvStage.innerHTML=`
      <div class="bj-wrap">
        <div class="bj-row"><div class="bj-lbl">Dealer <b id="bjDT">—</b></div><div class="bj-cards" id="bjD"></div></div>
        <div class="bj-msg" id="bjMsg">Place a bet and deal</div>
        <div class="bj-row"><div class="bj-lbl">You <b id="bjPT">—</b></div><div class="bj-cards" id="bjP"></div></div>
        <div class="bj-actions" id="bjA" hidden>
          <button class="bj-act" id="bjHit">Hit</button>
          <button class="bj-act" id="bjStand">Stand</button>
          <button class="bj-act" id="bjDbl">Double</button>
        </div>
      </div>`;
    $id('bjHit').addEventListener('click',()=>this.hit());
    $id('bjStand').addEventListener('click',()=>this.stand());
    $id('bjDbl').addEventListener('click',()=>this.dbl());
  },
  label(){return this.h?'In Play…':'Deal';},
  draw(){return{r:1+Math.floor(Math.random()*13),s:Math.floor(Math.random()*4)};},
  val(cs){
    let t=0,a=0;
    cs.forEach(c=>{t+=c.r>10?10:c.r===1?11:c.r;if(c.r===1)a++;});
    while(t>21&&a){t-=10;a--;}
    return t;
  },
  cardHtml(c,hole){
    if(hole)return'<div class="bjc back"></div>';
    const R=['A','2','3','4','5','6','7','8','9','10','J','Q','K'][c.r-1],S='♠♥♦♣'[c.s];
    return`<div class="bjc${c.s===1||c.s===2?' red':''}"><span class="r">${R}</span><span class="s">${S}</span></div>`;
  },
  render(holeHidden){
    const h=this.h;if(!h||!$id('bjP'))return;
    $id('bjP').innerHTML=h.p.map(c=>this.cardHtml(c)).join('');
    $id('bjD').innerHTML=h.d.map((c,i)=>this.cardHtml(c,holeHidden&&i===1)).join('');
    const pv=this.val(h.p),dv=holeHidden?this.val([h.d[0]]):this.val(h.d);
    const pt=$id('bjPT'),dt=$id('bjDT');
    pt.textContent=pv;dt.textContent=holeHidden?dv+' + ?':dv;
    pt.className=pv>21?'bust':pv===21&&h.p.length===2?'bj':'';
    dt.className=dv>21?'bust':'';
  },
  onBet(){
    if(this.h)return;
    const st=debitBet();if(!st)return;
    lockBet(true);gvBetBtn.disabled=true;
    this.h={st,p:[this.draw(),this.draw()],d:[this.draw(),this.draw()],nat:false,over:false};
    $id('bjMsg').textContent='';$id('bjMsg').className='bj-msg';
    this.render(true);
    syncBetBtn();gvBetBtn.disabled=true;
    if(this.val(this.h.p)===21){
      this.h.nat=true;
      $id('bjA').hidden=true;
      this._t.push(setTimeout(()=>this.stand(),650));
      return;
    }
    $id('bjA').hidden=false;
    this.acts();
  },
  acts(){
    const h=this.h;
    $id('bjDbl').disabled=!(h.p.length===2&&h.st.w.amt>=h.st.b);
  },
  hit(){
    const h=this.h;if(!h||h.over)return;
    h.p.push(this.draw());this.render(true);this.acts();
    const pv=this.val(h.p);
    if(pv>21)this.finish();
    else if(pv===21)this.stand();
  },
  dbl(){
    const h=this.h;if(!h||h.over||h.p.length!==2||h.st.w.amt<h.st.b)return;
    creditTo(h.st.w,-h.st.b);h.st.b*=2;
    h.p.push(this.draw());this.render(true);
    if(this.val(h.p)>21)this.finish();else this.stand();
  },
  stand(){
    const h=this.h;if(!h||h.over)return;
    h.over=true;
    $id('bjA').hidden=true;
    this.render(false);
    const step=()=>{
      if(!this.h)return;
      if(!h.nat&&this.val(h.d)<17){
        h.d.push(this.draw());this.render(false);
        this._t.push(setTimeout(step,420));
      }else this.finish();
    };
    this._t.push(setTimeout(step,420));
  },
  outcome(h){
    const pv=this.val(h.p),dv=this.val(h.d);
    const pBJ=h.p.length===2&&pv===21,dBJ=h.d.length===2&&dv===21;
    if(pv>21)return[0,'Bust','l'];
    if(pBJ&&dBJ)return[1,'Push — both blackjack','p'];
    if(pBJ)return[2.5,'Blackjack! Pays 3:2','w'];
    if(dBJ)return[0,'Dealer blackjack','l'];
    if(dv>21)return[2,'Dealer busts — you win','w'];
    if(pv>dv)return[2,'You win '+pv+' vs '+dv,'w'];
    if(pv===dv)return[1,'Push '+pv,'p'];
    return[0,'Dealer wins '+dv+' vs '+pv,'l'];
  },
  finish(){
    const h=this.h;if(!h)return;
    this._t.forEach(clearTimeout);this._t=[];
    $id('bjA').hidden=true;
    this.render(false);
    const[mult,msg,cls]=this.outcome(h);
    const msgEl=$id('bjMsg');msgEl.textContent=msg;msgEl.className='bj-msg '+cls;
    settleBet(h.st,mult);
    this.h=null;
    lockBet(false);gvBetBtn.disabled=false;syncBetBtn();
  },
  unmount(){
    this._t.forEach(clearTimeout);this._t=[];
    const h=this.h;
    if(h){
      if(this.val(h.p)<=21&&!h.nat)while(this.val(h.d)<17)h.d.push(this.draw());
      settleBet(h.st,this.outcome(h)[0]);
      this.h=null;
    }
  }
};
