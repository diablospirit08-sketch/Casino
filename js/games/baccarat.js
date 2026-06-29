/* --- baccarat --- */
ORIGINALS['originals-baccarat']={
  rtp:'98.94%',auto:false,

  bets:{player:0,tie:0,banker:0},
  betHistory:[],
  chipVal:10,
  gameState:'betting',

  deck:[],road:[],
  stats:{rounds:0,wins:0,streak:0,streakType:'',bigWin:0,bigLoss:0,balHistory:[]},

  _muted:false,_ac:null,_T:[],
  _auto:{running:false,rounds:0,roundsLeft:0,stopProfit:0,stopLoss:0,startBal:0,bets:null},

  SSYM:{spades:'♠',hearts:'♥',diamonds:'♦',clubs:'♣'},
  RANKS:['A','2','3','4','5','6','7','8','9','10','J','Q','K'],
  OF2:[-50,50],OF3:[-90,0,90],

  /* ── audio ── */
  _ga(){if(!this._ac)this._ac=new(window.AudioContext||window.webkitAudioContext)();if(this._ac.state==='suspended')this._ac.resume();return this._ac;},
  _sfxChip(){if(this._muted)return;try{const c=this._ga(),t=c.currentTime,n=Math.floor(c.sampleRate*.04),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++){const e=Math.exp(-i/(n*.08));d[i]=(Math.random()*2-1)*e*.6+Math.sin(2*Math.PI*3400*i/c.sampleRate)*e*.4}const s=c.createBufferSource(),g=c.createGain();s.buffer=b;g.gain.value=.45;s.connect(g);g.connect(c.destination);s.start(t)}catch(e){}},
  _sfxDeal(){if(this._muted)return;try{const c=this._ga(),t=c.currentTime,n=Math.floor(c.sampleRate*.11),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++){const e=i<n*.3?i/(n*.3):Math.exp(-(i-n*.3)/(n*.22));d[i]=(Math.random()*2-1)*e}const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();f.type='bandpass';f.frequency.value=1900;f.Q.value=.8;g.gain.value=.16;s.buffer=b;s.connect(f);f.connect(g);g.connect(c.destination);s.start(t)}catch(e){}},
  _sfxWin(){if(this._muted)return;try{const c=this._ga();[523,659,784,1047].forEach((f,i)=>{const t=c.currentTime+i*.09,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.2,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+.45);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.5)})}catch(e){}},
  _sfxLoss(){if(this._muted)return;try{const c=this._ga(),t=c.currentTime,o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();o.type='sawtooth';o.frequency.setValueAtTime(210,t);o.frequency.exponentialRampToValueAtTime(75,t+.45);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.13,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+.6);f.type='lowpass';f.frequency.value=380;o.connect(f);f.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.65)}catch(e){}},
  _sfxTie(){if(this._muted)return;try{const c=this._ga();[660,880].forEach((f,i)=>{const t=c.currentTime+i*.13,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.13,t);g.gain.exponentialRampToValueAtTime(.001,t+.55);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.6)})}catch(e){}},

  /* ── deck ── */
  buildDeck(){
    this.deck=[];
    const suits=['spades','hearts','diamonds','clubs'];
    for(let d=0;d<6;d++)
      for(const s of suits)
        for(const r of this.RANKS)
          this.deck.push({r,s:this.SSYM[s],red:s==='hearts'||s==='diamonds'});
    for(let i=this.deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this.deck[i],this.deck[j]]=[this.deck[j],this.deck[i]];}
  },
  _cv(r){if(r==='J'||r==='Q'||r==='K'||r==='10')return 0;if(r==='A')return 1;return parseInt(r,10);},
  _hv(h){return h.reduce((s,c)=>s+this._cv(c.r),0)%10;},
  _draw(){return this.deck.pop();},
  _sl(ms){return new Promise(r=>setTimeout(r,ms));},

  /* ── card DOM ── */
  _makeCard(c,tx,sx,sy,sr,drop){
    const d=document.createElement('div');
    d.className='bac-card '+(c.red?'red':'black');
    d.style.setProperty('--tx',tx+'px');
    if(drop){
      d.style.animation='bacDropIn .6s cubic-bezier(.34,1.56,.64,1) both';
    }else{
      d.style.setProperty('--sx',(sx+tx)+'px');
      d.style.setProperty('--sy',sy+'px');
      d.style.setProperty('--sr',sr+'deg');
      d.style.animation='bacFanIn .7s cubic-bezier(.34,1.56,.64,1) both';
    }
    d.innerHTML=`<div class="bac-ci"><div class="bac-tl"><div class="bac-rk">${c.r}</div><div class="bac-su">${c.s}</div></div><div class="bac-cnt"><div class="bac-slg">${c.s}</div></div><div class="bac-br"><div class="bac-rk">${c.r}</div><div class="bac-su">${c.s}</div></div></div>`;
    return d;
  },

  /* ── chip stacks ── */
  _chipCol(v){
    if(v>=10000)return{b:'#3b82f6',l:'#3b82f6'};
    if(v>=1000) return{b:'#a855f7',l:'#a855f7'};
    if(v>=100)  return{b:'#ff4444',l:'#ff4444'};
    return{b:'#00e701',l:'#00e701'};
  },
  _chipLbl(v){if(v>=10000)return'10K';if(v>=1000)return'1K';if(v>=100)return'100';return'10';},
  _renderStack(zone){
    const el=$id('bac-chips-'+zone);if(!el)return;
    const hist=this.betHistory.filter(b=>b.zone===zone);
    if(!hist.length){el.innerHTML='';return;}
    const vis=hist.slice(-5),W=38,H=10,R=17,svgH=R*2+(vis.length-1)*H+6;
    let out=`<svg width="${W}" height="${svgH}" viewBox="0 0 ${W} ${svgH}" xmlns="http://www.w3.org/2000/svg">`;
    vis.forEach((item,i)=>{
      const cy=svgH-R-(i*H),col=this._chipCol(item.v),lbl=this._chipLbl(item.v),fid=`bf${zone}${i}`;
      out+=`<defs><filter id="${fid}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.5" result="blur"/><feFlood flood-color="${col.b}" flood-opacity="0.7" result="col"/><feComposite in="col" in2="blur" operator="in" result="glow"/><feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
      out+=`<ellipse cx="${W/2}" cy="${cy+5}" rx="${R-3}" ry="4" fill="rgba(0,0,0,0.4)"/>`;
      out+=`<circle cx="${W/2}" cy="${cy}" r="${R-1}" fill="#080c14" stroke="${col.b}" stroke-width="2" filter="url(#${fid})"/>`;
      out+=`<circle cx="${W/2}" cy="${cy}" r="${R-6}" fill="none" stroke="${col.b}" stroke-width="1" stroke-opacity="0.35"/>`;
      out+=`<text x="${W/2}" y="${cy+4}" text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="900" font-family="Inter,sans-serif" fill="${col.l}">${lbl}</text>`;
    });
    out+='</svg>';el.innerHTML=out;
  },

  /* ── bet management (chips deduct immediately) ── */
  _placeChip(zone){
    if(this.gameState!=='betting')return;
    const w=curW(),v=this.chipVal;
    if(v<=0||v>w.amt)return;
    this._sfxChip();
    this.betHistory.push({zone,v});
    this.bets[zone]+=v;
    w.amt-=v;w.fiat=w.amt*(w.rate||1);renderWallet();
    this._updateUI();
  },
  _clearBets(){
    if(this.gameState!=='betting')return;
    const w=curW();
    const total=this.bets.player+this.bets.tie+this.bets.banker;
    if(total>0){w.amt+=total;w.fiat=w.amt*(w.rate||1);renderWallet();}
    this.bets={player:0,tie:0,banker:0};this.betHistory=[];
    this._updateUI();
  },
  _undoBet(){
    if(this.gameState!=='betting'||!this.betHistory.length)return;
    const l=this.betHistory.pop();
    this.bets[l.zone]-=l.v;
    const w=curW();w.amt+=l.v;w.fiat=w.amt*(w.rate||1);renderWallet();
    this._updateUI();
  },
  _doubleBet(){
    if(this.gameState!=='betting')return;
    const w=curW();
    const snap=this.betHistory.slice();
    const addTotal=snap.reduce((s,b)=>s+b.v,0);
    if(addTotal>w.amt)return;
    snap.forEach(item=>{
      this.betHistory.push({zone:item.zone,v:item.v});
      this.bets[item.zone]+=item.v;
      w.amt-=item.v;
    });
    w.fiat=w.amt*(w.rate||1);renderWallet();
    this._updateUI();
  },
  _halfBet(){
    if(this.gameState!=='betting')return;
    const w=curW();
    ['player','tie','banker'].forEach(k=>{
      const r=Math.floor(this.bets[k]/2);
      w.amt+=r;this.bets[k]-=r;
    });
    // Rebuild betHistory so undo refunds match actual remaining bets
    this.betHistory=[];
    ['player','tie','banker'].forEach(k=>{if(this.bets[k]>0)this.betHistory.push({zone:k,v:this.bets[k]});});
    w.fiat=w.amt*(w.rate||1);renderWallet();
    this._updateUI();
  },
  _selChip(v,el){
    this._sfxChip();
    this.chipVal=v;
    document.querySelectorAll('.bac-chip').forEach(c=>c.classList.remove('selected'));
    el.classList.add('selected');
    const inp=$id('bac-cv');if(inp)inp.value=v;
  },

  _updateUI(){
    const total=this.bets.player+this.bets.tie+this.bets.banker;
    const tot=$id('bac-tot');if(tot)tot.textContent='$'+total.toFixed(2);
    ['player','tie','banker'].forEach(k=>{
      const ba=$id('bac-ba-'+k);if(ba)ba.textContent='$'+this.bets[k].toFixed(2);
      const z=$id('bac-z-'+k);if(z)z.classList.toggle('has-bet',this.bets[k]>0);
      this._renderStack(k);
    });
    if(!autoRunning)syncBetBtn();
  },

  /* ── scores & display ── */
  _updScores(pv,bv){
    const ps=$id('bac-ps'),bs=$id('bac-bs'),dp=$id('bac-dsp'),db=$id('bac-dsb');
    if(ps)ps.textContent=pv;if(bs)bs.textContent=bv;
    if(dp){dp.textContent=pv;dp.style.transform=pv>bv?'scale(1.2)':'scale(1)';}
    if(db){db.textContent=bv;db.style.transform=bv>pv?'scale(1.2)':'scale(1)';}
  },
  _setStatus(t){const el=$id('bac-status');if(el)el.textContent=t;},
  _setSuit(winner){
    const el=$id('bac-suit');if(!el)return;
    el.classList.remove('bac-spin');void el.offsetWidth;el.classList.add('bac-spin');
    if(winner==='player'){el.textContent='♥';el.style.color='#818cf8';el.style.textShadow='0 0 14px rgba(129,140,248,.8)';}
    else if(winner==='banker'){el.textContent='♦';el.style.color='#f87171';el.style.textShadow='0 0 14px rgba(248,113,113,.8)';}
    else{el.textContent='♣';el.style.color='#f59e0b';el.style.textShadow='0 0 14px rgba(245,158,11,.8)';}
  },
  _resetSuit(){
    const el=$id('bac-suit');if(!el)return;
    el.textContent='♠';el.style.color='#4f46e5';el.style.textShadow='0 0 14px rgba(79,70,229,.7)';el.classList.remove('bac-spin');
    const dp=$id('bac-dsp'),db=$id('bac-dsb');
    if(dp){dp.style.transform='scale(1)';dp.textContent='0';}
    if(db){db.style.transform='scale(1)';db.textContent='0';}
  },

  /* ── game flow ── */
  label(){
    if(this.gameState==='done')return'Bet Again';
    if(this.gameState==='dealing')return'In Play…';
    return'Deal';
  },
  onBet(){
    if(this.gameState==='done'){this._resetRound();return;}
    if(this.gameState==='dealing')return;
    if(!document.body.classList.contains('authed')){openAuth('in');return;}
    const total=this.bets.player+this.bets.tie+this.bets.banker;
    if(total<=0)return;
    this._deal();
  },

  async _deal(){
    this.gameState='dealing';
    lockBet(true);gvBetBtn.disabled=true;gvBetBtn.textContent='In Play…';
    this._setStatus('DEALING...');
    if(this.deck.length<20)this.buildDeck();

    const pH=[this._draw(),this._draw()];
    const bH=[this._draw(),this._draw()];
    const pb=$id('bac-pb'),bb=$id('bac-bb');
    if(!pb||!bb){this.gameState='betting';lockBet(false);syncBetBtn();return;}
    pb.innerHTML='';bb.innerHTML='';

    const c0=this._makeCard(pH[0],this.OF2[0],120,-30,25,false);
    c0.style.zIndex=1;pb.appendChild(c0);this._sfxDeal();await this._sl(550);

    const c1=this._makeCard(bH[0],this.OF2[0],-120,-30,-25,false);
    c1.style.zIndex=1;bb.appendChild(c1);this._sfxDeal();await this._sl(550);

    const c2=this._makeCard(pH[1],this.OF2[1],-120,-30,-25,false);
    c2.style.zIndex=2;pb.appendChild(c2);this._sfxDeal();await this._sl(550);

    const c3=this._makeCard(bH[1],this.OF2[1],120,-30,25,false);
    c3.style.zIndex=2;bb.appendChild(c3);this._sfxDeal();await this._sl(800);

    let pv=this._hv(pH),bv=this._hv(bH);
    this._updScores(pv,bv);
    if(pv>=8||bv>=8){await this._sl(400);this._finalize(pH,bH);return;}

    // Player third card
    let pDrew=false;
    if(pv<=5){
      await this._sl(600);
      const nc=this._draw();pH.push(nc);
      const pcards=pb.querySelectorAll('.bac-card');
      if(pcards[0])pcards[0].style.cssText+=`transform:translateX(${this.OF3[0]}px);transition:transform .3s ease;z-index:1`;
      if(pcards[1])pcards[1].style.cssText+=`transform:translateX(${this.OF3[1]}px);transition:transform .3s ease;z-index:2`;
      await this._sl(320);
      const pc2=this._makeCard(nc,this.OF3[2],0,-50,0,true);
      pc2.style.zIndex=3;pb.appendChild(pc2);this._sfxDeal();pDrew=true;
      await this._sl(750);this._updScores(this._hv(pH),bv);
    }

    // Banker third card
    let bd=false;
    if(!pDrew){bd=bv<=5;}
    else{
      const pt=this._cv(pH[2].r);
      if(bv<=2)bd=true;
      else if(bv===3&&pt!==8)bd=true;
      else if(bv===4&&[2,3,4,5,6,7].indexOf(pt)>=0)bd=true;
      else if(bv===5&&[4,5,6,7].indexOf(pt)>=0)bd=true;
      else if(bv===6&&[6,7].indexOf(pt)>=0)bd=true;
    }
    if(bd){
      await this._sl(600);
      const nc=this._draw();bH.push(nc);
      const bcards=bb.querySelectorAll('.bac-card');
      if(bcards[0])bcards[0].style.cssText+=`transform:translateX(${this.OF3[0]}px);transition:transform .3s ease;z-index:1`;
      if(bcards[1])bcards[1].style.cssText+=`transform:translateX(${this.OF3[1]}px);transition:transform .3s ease;z-index:2`;
      await this._sl(320);
      const bc2=this._makeCard(nc,this.OF3[2],0,-50,0,true);
      bc2.style.zIndex=3;bb.appendChild(bc2);this._sfxDeal();
      await this._sl(750);this._updScores(this._hv(pH),this._hv(bH));
    }

    await this._sl(400);
    this._finalize(pH,bH);
  },

  async _finalize(pH,bH){
    const pv=this._hv(pH),bv=this._hv(bH);
    const winner=pv>bv?'player':bv>pv?'banker':'tie';
    const total=this.bets.player+this.bets.tie+this.bets.banker;
    const pb=this.bets.player,tb=this.bets.tie,bb2=this.bets.banker;

    let winAmt=0;
    if(winner==='player')winAmt=pb*2;
    else if(winner==='banker')winAmt=bb2*1.95;
    else winAmt=tb*9+(pb+bb2);

    const net=Math.round((winAmt-total)*100)/100;

    // Server settlement (provably fair) — restore chips, let server deduct+credit
    const w=curW();
    if(typeof placeBet==='function'&&w&&total>0){
      try{
        creditTo(w,total); // restore optimistic chip deductions
        const r=await placeBet({game:'originals-baccarat',currency:w.c,wager:total,params:{playerBet:pb,tieBet:tb,bankerBet:bb2}});
        if(r&&typeof serverSettleBet==='function')serverSettleBet(r);
      }catch(e){
        // Server unavailable — keep client-side result
        creditTo(w,winAmt);
      }
    }else{
      if(winAmt>0)creditTo(w,winAmt);
    }

    // Session tracking
    const mult=total>0?winAmt/total:0;
    gsession.wag+=total*(w.rate||1);
    gsession.prof+=net*(w.rate||1);
    addXp(total*(w.rate||1));
    if(window.addRakeback)addRakeback(total*(w.rate||1));
    if(net>0)gsession.w++;else if(net<0)gsession.l++;
    renderSession();
    pushChip(mult,net>0);
    if(net>0)pushFeed('You','Baccarat',net*(w.rate||1),true);
    if(window._pushBetHist)_pushBetHist({w,b:total,name:'Baccarat'},mult);

    // Visual
    this._setStatus({player:'PLAYER WINS',banker:'BANKER WINS',tie:'TIE'}[winner]);
    const pbEl=$id('bac-pb'),bbEl=$id('bac-bb');
    if(winner==='player'&&pbEl)pbEl.style.filter='drop-shadow(0 0 18px rgba(79,70,229,.7))';
    else if(winner==='banker'&&bbEl)bbEl.style.filter='drop-shadow(0 0 18px rgba(220,38,38,.6))';
    this._setSuit(winner);

    // Road + stats
    this.road.push(winner);if(this.road.length>38)this.road.shift();
    this._renderRoad();
    this._updateStats(net);

    // Sound
    if(net>0)this._sfxWin();else if(net===0)this._sfxTie();else this._sfxLoss();

    // Result overlay
    const ov=$id('bac-ov'),bn=$id('bac-bn');
    if(ov&&bn){
      ov.style.display='flex';
      bn.className='bac-banner '+(net>0?'bac-win':net===0?'bac-push':'bac-loss');
      const rt=$id('bac-rt'),ra=$id('bac-ra');
      if(rt)rt.textContent=net>0?'WIN!':net===0?'PUSH':'LOSS';
      if(ra){ra.textContent=(net>=0?'+':'')+' $'+Math.abs(net).toFixed(2);ra.style.color=net>0?'#00e701':net===0?'#f59e0b':'#ff4444';}
      this._T.push(setTimeout(()=>{const o=$id('bac-ov');if(o)o.style.display='none';},3000));
    }

    this.gameState='done';
    lockBet(false);
    if(!this._auto.running)syncBetBtn();

    // Autoplay continuation
    if(this._auto.running){
      this._auto.roundsLeft--;
      const bal=curW().amt;
      const profit=bal-this._auto.startBal;
      const loss=this._auto.startBal-bal;
      const stopProfit=this._auto.stopProfit;
      const stopLoss=this._auto.stopLoss;
      if(
        this._auto.roundsLeft<=0||
        (stopProfit>0&&profit>=stopProfit)||
        (stopLoss>0&&loss>=stopLoss)
      ){this._stopAuto();return;}
      this._T.push(setTimeout(()=>this._autoNext(),1400));
    }
  },

  _renderRoad(){
    const el=$id('bac-road');if(!el)return;
    el.innerHTML=this.road.map(r=>{
      const cls=r==='player'?'bac-rp':r==='banker'?'bac-rb':'bac-rt2';
      const lbl=r==='player'?'P':r==='banker'?'B':'T';
      return`<div class="bac-dot ${cls}">${lbl}</div>`;
    }).join('');
  },

  _updateStats(net){
    this.stats.rounds++;
    if(net>0){
      this.stats.wins++;
      if(this.stats.streakType==='W')this.stats.streak++;
      else{this.stats.streakType='W';this.stats.streak=1;}
      if(net>this.stats.bigWin)this.stats.bigWin=net;
    }else if(net<0){
      if(this.stats.streakType==='L')this.stats.streak++;
      else{this.stats.streakType='L';this.stats.streak=1;}
      if(Math.abs(net)>this.stats.bigLoss)this.stats.bigLoss=Math.abs(net);
    }else{this.stats.streakType='';this.stats.streak=0;}
    const w=curW();
    this.stats.balHistory.push(w.amt);
    if(this.stats.balHistory.length>30)this.stats.balHistory.shift();
    this._renderStats();
  },
  _renderStats(){
    const s=this.stats;
    const sr=$id('bac-sr');if(sr)sr.textContent=s.rounds;
    const wr=s.rounds>0?Math.round(s.wins/s.rounds*100):null;
    const wrEl=$id('bac-wr');
    if(wrEl){wrEl.textContent=wr!==null?wr+'%':'—';wrEl.className='bac-sv '+(wr!==null?(wr>=50?'bac-g':'bac-r'):'');}
    const stEl=$id('bac-st');
    if(stEl){
      if(s.streak>0){stEl.textContent=s.streakType+s.streak;stEl.className='bac-sv '+(s.streakType==='W'?'bac-g':'bac-r');}
      else{stEl.textContent='—';stEl.className='bac-sv';}
    }
    const bw=$id('bac-bw');if(bw)bw.textContent=s.bigWin>0?'+$'+s.bigWin.toFixed(0):'—';
    const bl=$id('bac-bl');if(bl)bl.textContent=s.bigLoss>0?'-$'+s.bigLoss.toFixed(0):'—';
    this._renderSparkline();
  },
  _renderSparkline(){
    const svg=$id('bac-spark'),h=this.stats.balHistory;
    if(!svg||h.length<2){if(svg)svg.innerHTML='';return;}
    const W=120,H=32,pad=3;let mn=h[0],mx=h[0];
    for(const v of h){if(v<mn)mn=v;if(v>mx)mx=v;}
    const range=mx-mn||1;let pts='',area='';
    h.forEach((v,i)=>{
      const px=pad+(i/(h.length-1))*(W-pad*2),py=H-pad-((v-mn)/range)*(H-pad*2);
      pts+=px+','+py+(i<h.length-1?' ':'');
      if(i===0)area+=pad+','+H+' '+px+','+py+' ';
      else if(i===h.length-1)area+=px+','+py+' '+(W-pad)+','+H;
      else area+=px+','+py+' ';
    });
    const last=h[h.length-1],col=last>=h[0]?'#00e701':'#ff4444';
    const lx=pad+1*(W-pad*2),ly=H-pad-((last-mn)/range)*(H-pad*2);
    svg.innerHTML=`<defs><linearGradient id="bspg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${col}" stop-opacity="0.25"/><stop offset="100%" stop-color="${col}" stop-opacity="0"/></linearGradient></defs><polygon points="${area}" fill="url(#bspg)"/><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${lx}" cy="${ly}" r="2.5" fill="${col}"/>`;
  },

  _resetRound(){
    if(this.gameState==='dealing')return;
    this.bets={player:0,tie:0,banker:0};this.betHistory=[];
    this.gameState='betting';
    const pb=$id('bac-pb'),bb=$id('bac-bb');
    if(pb){pb.innerHTML='';pb.style.filter='';}
    if(bb){bb.innerHTML='';bb.style.filter='';}
    this._updScores(0,0);this._resetSuit();
    this._setStatus('PLACE YOUR BETS');
    const ov=$id('bac-ov');if(ov)ov.style.display='none';
    this._updateUI();
  },

  _startAuto(){
    const rounds=parseInt($id('bac-ap-rounds')?.value)||0;
    const stopProfit=parseFloat($id('bac-ap-profit')?.value)||0;
    const stopLoss=parseFloat($id('bac-ap-loss')?.value)||0;
    const total=this.bets.player+this.bets.tie+this.bets.banker;
    if(total<=0){alert('Place a bet first');return;}
    this._auto={running:true,rounds,roundsLeft:rounds>0?rounds:Infinity,stopProfit,stopLoss,startBal:curW().amt,bets:{...this.bets}};
    autoRunning=true;
    const sb=$id('bac-auto-start');if(sb){sb.textContent='STOP';sb.classList.add('bac-astop');}
    const rc=$id('bac-auto-rc');if(rc)rc.textContent=rounds>0?rounds+'':'∞';
    this._deal();
  },
  _stopAuto(){
    this._auto.running=false;
    autoRunning=false;
    const sb=$id('bac-auto-start');if(sb){sb.textContent='START AUTO';sb.classList.remove('bac-astop');}
    syncBetBtn();
  },
  _autoNext(){
    if(!this._auto.running)return;
    // Re-place same bets (balance was already settled; re-deduct same amounts)
    const w=curW();
    const saved=this._auto.bets;
    const newTotal=saved.player+saved.tie+saved.banker;
    if(newTotal>w.amt){this._stopAuto();return;}
    this._resetRound();
    ['player','tie','banker'].forEach(k=>{
      if(saved[k]>0){
        this.bets[k]=saved[k];
        this.betHistory.push({zone:k,v:saved[k]});
        w.amt-=saved[k];
      }
    });
    w.fiat=w.amt*(w.rate||1);renderWallet();
    this._updateUI();
    const rc=$id('bac-auto-rc');if(rc)rc.textContent=isFinite(this._auto.roundsLeft)?this._auto.roundsLeft:'∞';
    this._deal();
  },

  sync(){},
  onCur(){
    if(!this.stats.balHistory.length){const w=curW();this.stats.balHistory.push(w.amt);}
  },

  /* ── mount ── */
  mount(){
    if(!$id('bac-css')){
      const s=document.createElement('style');s.id='bac-css';
      s.textContent=`
/* baccarat layout */
.bac-wrap{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:12px;height:100%;padding:14px 14px 10px;position:relative;overflow:hidden}
.bac-wrap::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 60% 30% at 50% 20%,rgba(0,231,1,.022) 0%,transparent 100%)}
.bac-status{font-size:11px;color:#374151;text-align:center;font-weight:700;letter-spacing:1.5px;min-height:16px}

/* hands row */
.bac-hands{display:flex;gap:0;align-items:center;justify-content:center;width:100%}
.bac-hzone{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;min-width:0}
.bac-sbadge{padding:4px 16px;border-radius:22px;font-size:13px;font-weight:900;min-width:34px;text-align:center;display:inline-block}
.bac-sb-p{background:#4f46e5;color:#fff;box-shadow:0 2px 10px rgba(79,70,229,.4)}
.bac-sb-b{background:#dc2626;color:#fff;box-shadow:0 2px 10px rgba(220,38,38,.4)}
.bac-hlbl{font-size:10px;font-weight:800;letter-spacing:3.5px;color:#4b5563}
.bac-cards{position:relative;height:130px;width:100%;display:flex;align-items:center;justify-content:center}

/* cards */
.bac-card{width:82px;height:118px;background:#fff;border-radius:10px;position:absolute;display:flex;flex-direction:column;box-shadow:0 8px 24px rgba(0,0,0,.6);overflow:hidden;flex-shrink:0}
.bac-card::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.5) 0%,transparent 50%);pointer-events:none}
.bac-ci{display:flex;flex-direction:column;padding:6px 7px;height:100%}
.bac-tl{display:flex;flex-direction:column;line-height:1}
.bac-rk{font-size:15px;font-weight:900;line-height:1}
.bac-su{font-size:12px;line-height:1}
.bac-cnt{flex:1;display:flex;align-items:center;justify-content:center}
.bac-slg{font-size:36px;line-height:1}
.bac-br{display:flex;flex-direction:column;align-items:flex-end;line-height:1;transform:rotate(180deg)}
.bac-card.red .bac-rk,.bac-card.red .bac-su,.bac-card.red .bac-slg{color:#dc2626}
.bac-card.black .bac-rk,.bac-card.black .bac-su,.bac-card.black .bac-slg{color:#111827}
@keyframes bacFanIn{
  0%{opacity:0;transform:translate(var(--sx),var(--sy)) rotate(var(--sr)) scale(.8)}
  65%{opacity:1}
  100%{opacity:1;transform:translate(var(--tx),0px) rotate(0deg) scale(1)}
}
@keyframes bacDropIn{
  0%{opacity:0;transform:translate(var(--tx),-50px) scale(.88)}
  65%{transform:translate(var(--tx),5px) scale(1.02)}
  100%{opacity:1;transform:translate(var(--tx),0px) scale(1)}
}

/* center divider */
.bac-div{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:0 14px;flex-shrink:0;min-width:64px;align-self:center}
.bac-suit{font-size:24px;color:#4f46e5;text-shadow:0 0 14px rgba(79,70,229,.7);transition:color .4s,text-shadow .4s}
@keyframes bac-spin{0%{transform:rotateY(0)}50%{transform:rotateY(90deg)}100%{transform:rotateY(0)}}
.bac-spin{animation:bac-spin .5s ease-in-out}
.bac-ds{display:flex;flex-direction:column;align-items:center;gap:4px}
.bac-dsc{font-size:22px;font-weight:900;line-height:1;transition:all .3s;min-width:28px;text-align:center}
.bac-dsline{width:24px;height:1.5px;background:linear-gradient(90deg,transparent,#2d3f6b,transparent)}
.bac-divlbl{font-size:7px;font-weight:800;letter-spacing:2px;color:#2d3f6b}

/* bet zones */
.bac-zones{display:flex;gap:8px;width:100%;max-width:720px}
.bac-zone{flex:1;background:#0d1120;border-radius:12px;padding:12px 10px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;border:1px solid #1e2840;transition:all .18s;position:relative;overflow:hidden}
.bac-zone::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;border-radius:2px 2px 0 0}
.bac-zp::before{background:linear-gradient(90deg,transparent,#4f46e5,transparent)}
.bac-zt::before{background:linear-gradient(90deg,transparent,#00e701,transparent)}
.bac-zb::before{background:linear-gradient(90deg,transparent,#dc2626,transparent)}
.bac-zone:hover{background:#111827;border-color:#2d3f6b;transform:translateY(-1px)}
.bac-zone.has-bet{border-color:#4f46e5;background:#0f1428}
.bac-zname{font-size:12px;font-weight:900;letter-spacing:.8px}
.bac-zodds{font-size:10px;color:#374151;font-weight:700}
.bac-zchips{height:42px;display:flex;align-items:flex-end;justify-content:center}
.bac-zamt{font-size:10px;color:#00e701;font-weight:800}

/* road */
.bac-road-wrap{width:100%;max-width:720px}
.bac-road-lbl{font-size:9px;font-weight:700;letter-spacing:1.5px;color:#2d3f6b;margin-bottom:4px}
.bac-road-grid{display:flex;gap:3px;flex-wrap:nowrap;overflow:hidden;height:20px}
.bac-dot{width:16px;height:16px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:900}
.bac-rp{background:rgba(79,70,229,.2);border:1.5px solid #4f46e5;color:#818cf8}
.bac-rb{background:rgba(220,38,38,.2);border:1.5px solid #dc2626;color:#f87171}
.bac-rt2{background:rgba(0,231,1,.15);border:1.5px solid #00e701;color:#00e701}

/* stats bar */
.bac-stats{width:100%;max-width:720px;background:#0d1120;border:1px solid #1e2840;border-radius:10px;padding:8px 12px;display:flex;align-items:center}
.bac-scell{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:0 5px;border-right:1px solid #1e2840}
.bac-scell:last-child{border-right:none;flex:1.6}
.bac-slbl{font-size:8px;font-weight:700;letter-spacing:1px;color:#2d3f6b}
.bac-sv{font-size:12px;font-weight:900;color:#e2e8f0}
.bac-g{color:#00e701}
.bac-r{color:#ff4444}

/* result overlay */
.bac-ov{position:absolute;inset:0;display:none;align-items:center;justify-content:center;z-index:10;pointer-events:none;background:rgba(8,12,20,.4);backdrop-filter:blur(2px)}
.bac-banner{background:linear-gradient(135deg,#0d1628,#0f1e38);border:1.5px solid rgba(255,255,255,.1);border-radius:18px;padding:24px 48px;text-align:center;animation:bacPop .28s cubic-bezier(.34,1.56,.64,1);box-shadow:0 20px 60px rgba(0,0,0,.6)}
.bac-win{border-color:rgba(0,231,1,.3);box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 40px rgba(0,231,1,.1)}
.bac-loss{border-color:rgba(220,38,38,.3)}
.bac-push{border-color:rgba(245,158,11,.3)}
.bac-rt{font-size:32px;font-weight:900;letter-spacing:3px}
.bac-ra{font-size:16px;font-weight:700;margin-top:6px}
@keyframes bacPop{from{transform:scale(.65);opacity:0}to{transform:scale(1);opacity:1}}

/* sidebar engine fields */
.bac-tabs{display:flex;background:#0d1120;border-radius:8px;padding:3px;gap:3px;border:1px solid #1e2840;margin-bottom:2px}
.bac-tab{flex:1;padding:7px;text-align:center;border-radius:6px;cursor:pointer;font-size:10px;font-weight:800;letter-spacing:1.5px;color:#4b5563;border:none;background:none;transition:all .2s;font-family:inherit}
.bac-tab.active{background:#00e701;color:#000}
.bac-cv-wrap{display:flex;align-items:center;gap:7px;margin-top:8px}
.bac-cv-box{flex:1;display:flex;align-items:center;gap:6px;background:#0d1120;border:1px solid #1e2840;border-radius:8px;padding:8px 11px}
.bac-dollar{font-size:12px;font-weight:900;color:#00e701}
.bac-cv-inp{background:none;border:none;color:#fff;font-size:17px;font-weight:700;width:100%;outline:none;font-family:inherit}
.bac-hx{display:flex;gap:4px}
.bac-hx-btn{background:#0d1120;border:1px solid #1e2840;border-radius:6px;padding:6px 9px;font-size:10px;font-weight:800;color:#6b7280;cursor:pointer;font-family:inherit}
.bac-hx-btn:hover{background:#161e30;color:#e2e8f0}
.bac-rack{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.bac-chip{width:50px;height:50px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;transition:transform .15s,box-shadow .15s;position:relative;background:#0a0d16;border:2px solid}
.bac-chip::before{content:'';position:absolute;inset:4px;border-radius:50%;border:1px solid rgba(255,255,255,.15)}
.bac-chip:hover{transform:translateY(-3px) scale(1.08)}
@keyframes bac-pulse{0%,100%{opacity:1}50%{opacity:.55}}
.bac-chip.selected{animation:bac-pulse 1.4s ease-in-out infinite}
.bc10{border-color:#00e701;color:#00e701;box-shadow:0 0 8px rgba(0,231,1,.6),0 0 22px rgba(0,231,1,.25)}
.bc10.selected{box-shadow:0 0 14px rgba(0,231,1,.95),0 0 36px rgba(0,231,1,.5)}
.bc100{border-color:#ff4444;color:#ff4444;box-shadow:0 0 8px rgba(255,68,68,.6),0 0 22px rgba(255,68,68,.25)}
.bc100.selected{box-shadow:0 0 14px rgba(255,68,68,.95),0 0 36px rgba(255,68,68,.5)}
.bc1k{border-color:#a855f7;color:#a855f7;box-shadow:0 0 8px rgba(168,85,247,.6),0 0 22px rgba(168,85,247,.25)}
.bc1k.selected{box-shadow:0 0 14px rgba(168,85,247,.95),0 0 36px rgba(168,85,247,.5)}
.bc10k{border-color:#3b82f6;color:#3b82f6;box-shadow:0 0 8px rgba(59,130,246,.6),0 0 22px rgba(59,130,246,.25)}
.bc10k.selected{box-shadow:0 0 14px rgba(59,130,246,.95),0 0 36px rgba(59,130,246,.5)}
.bac-tog-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0}
.bac-tog-lbl{font-size:10px;font-weight:700;color:#4b5563;letter-spacing:.5px}
.bac-ctrl{display:flex;gap:5px;margin-top:2px}
.bac-cbtn{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer}
.bac-cbtn:hover .bac-cicon{background:#161e30;border-color:#2d3f6b}
.bac-cicon{width:38px;height:38px;border-radius:50%;background:#0d1120;border:1px solid #1e2840;display:flex;align-items:center;justify-content:center;font-size:13px;transition:all .15s}
.bac-clbl{font-size:8px;color:#4b5563;letter-spacing:.8px;font-weight:700}
.bac-totrow{display:flex;justify-content:space-between;align-items:center;padding:6px 0 0;border-top:1px solid #1e2840;font-size:10px;color:#4b5563;font-weight:700;margin-top:4px}
.bac-totrow b{color:#e2e8f0}
.bac-astop{background:#ff4444!important;color:#fff!important}
      `;
      document.head.appendChild(s);
    }

    // Init
    if(!this.stats.balHistory.length){const w=curW();this.stats.balHistory.push(w.amt);}
    this.buildDeck();
    this.gameState='betting';
    this.bets={player:0,tie:0,banker:0};this.betHistory=[];

    const muted=this._muted;
    engFields.innerHTML=`
      <div class="bac-tabs">
        <button class="bac-tab active" id="bac-tab-m">MANUAL</button>
        <button class="bac-tab" id="bac-tab-a">AUTOPLAY</button>
      </div>
      <div id="bac-panel-m">
        <div class="gv-field" style="margin-top:6px">
          <label style="font-size:10px;color:#4b5563;font-weight:700;letter-spacing:.8px">CHIP VALUE</label>
          <div class="bac-cv-wrap">
            <div class="bac-cv-box">
              <span class="bac-dollar">$</span>
              <input class="bac-cv-inp" id="bac-cv" type="number" value="${this.chipVal}" min="1" step="1">
            </div>
            <div class="bac-hx">
              <button class="bac-hx-btn" id="bac-half">1/2</button>
              <button class="bac-hx-btn" id="bac-x2">X2</button>
            </div>
          </div>
        </div>
        <div style="font-size:10px;color:#4b5563;font-weight:700;letter-spacing:.8px;margin-top:6px">CHIPS (USD)</div>
        <div class="bac-rack">
          <div class="bac-chip bc10 selected" data-v="10">10</div>
          <div class="bac-chip bc100" data-v="100">100</div>
          <div class="bac-chip bc1k" data-v="1000">1K</div>
          <div class="bac-chip bc10k" data-v="10000">10K</div>
        </div>
        <div class="bac-ctrl" style="margin-top:8px">
          <div class="bac-cbtn" id="bac-btn-clear"><div class="bac-cicon">🗑</div><span class="bac-clbl">CLEAR</span></div>
          <div class="bac-cbtn" id="bac-btn-undo"><div class="bac-cicon">↩</div><span class="bac-clbl">UNDO</span></div>
          <div class="bac-cbtn" id="bac-btn-dbl"><div class="bac-cicon">×2</div><span class="bac-clbl">DOUBLE</span></div>
          <div class="bac-cbtn" id="bac-btn-half"><div class="bac-cicon">½</div><span class="bac-clbl">HALF</span></div>
        </div>
        <div class="bac-totrow">TOTAL BET <b id="bac-tot">$0.00</b></div>
        <div class="bac-tog-row" style="margin-top:6px">
          <span class="bac-tog-lbl">SOUND</span>
          <button id="bac-snd" class="bac-hx-btn" style="font-size:14px;padding:4px 10px">${muted?'🔇':'🔊'}</button>
        </div>
      </div>
      <div id="bac-panel-a" style="display:none">
        <div style="font-size:10px;color:#4b5563;font-weight:700;letter-spacing:.8px;margin-top:6px">NUMBER OF ROUNDS</div>
        <div class="bac-cv-wrap" style="margin-top:4px">
          <div class="bac-cv-box"><input class="bac-cv-inp" id="bac-ap-rounds" type="number" value="10" min="0" step="1" placeholder="0 = ∞"></div>
        </div>
        <div style="font-size:10px;color:#4b5563;font-weight:700;letter-spacing:.8px;margin-top:8px">STOP ON PROFIT ($)</div>
        <div class="bac-cv-wrap" style="margin-top:4px">
          <div class="bac-cv-box"><span class="bac-dollar">$</span><input class="bac-cv-inp" id="bac-ap-profit" type="number" value="0" min="0" step="1" placeholder="0 = off"></div>
        </div>
        <div style="font-size:10px;color:#4b5563;font-weight:700;letter-spacing:.8px;margin-top:8px">STOP ON LOSS ($)</div>
        <div class="bac-cv-wrap" style="margin-top:4px">
          <div class="bac-cv-box"><span class="bac-dollar">$</span><input class="bac-cv-inp" id="bac-ap-loss" type="number" value="0" min="0" step="1" placeholder="0 = off"></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;font-size:10px;color:#4b5563;font-weight:700">
          <span>ROUNDS LEFT</span><span id="bac-auto-rc">—</span>
        </div>
        <button id="bac-auto-start" style="margin-top:10px;width:100%;padding:10px;border-radius:8px;background:#00e701;color:#000;font-weight:900;font-size:12px;letter-spacing:1px;border:none;cursor:pointer;font-family:inherit">START AUTO</button>
      </div>`;

    gvStage.innerHTML=`
      <div class="bac-wrap">
        <div class="bac-status" id="bac-status">PLACE YOUR BETS</div>
        <div class="bac-hands">
          <div class="bac-hzone">
            <div class="bac-sbadge bac-sb-p" id="bac-ps">0</div>
            <div class="bac-hlbl">P L A Y E R</div>
            <div class="bac-cards" id="bac-pb"></div>
          </div>
          <div class="bac-div">
            <div class="bac-suit" id="bac-suit">♠</div>
            <div class="bac-ds">
              <div class="bac-dsc" id="bac-dsp" style="color:#818cf8">0</div>
              <div class="bac-dsline"></div>
              <div class="bac-dsc" id="bac-dsb" style="color:#f87171">0</div>
            </div>
            <div class="bac-divlbl">BACCARAT</div>
          </div>
          <div class="bac-hzone">
            <div class="bac-sbadge bac-sb-b" id="bac-bs">0</div>
            <div class="bac-hlbl">B A N K E R</div>
            <div class="bac-cards" id="bac-bb"></div>
          </div>
        </div>
        <div class="bac-zones">
          <div class="bac-zone bac-zp" id="bac-z-player">
            <div class="bac-zname">PLAYER</div>
            <div class="bac-zodds">1:1</div>
            <div class="bac-zchips" id="bac-chips-player"></div>
            <div class="bac-zamt" id="bac-ba-player">$0.00</div>
          </div>
          <div class="bac-zone bac-zt" id="bac-z-tie">
            <div class="bac-zname">TIE</div>
            <div class="bac-zodds">8:1</div>
            <div class="bac-zchips" id="bac-chips-tie"></div>
            <div class="bac-zamt" id="bac-ba-tie">$0.00</div>
          </div>
          <div class="bac-zone bac-zb" id="bac-z-banker">
            <div class="bac-zname">BANKER</div>
            <div class="bac-zodds">0.95:1</div>
            <div class="bac-zchips" id="bac-chips-banker"></div>
            <div class="bac-zamt" id="bac-ba-banker">$0.00</div>
          </div>
        </div>
        <div class="bac-road-wrap">
          <div class="bac-road-lbl">BEAD PLATE</div>
          <div class="bac-road-grid" id="bac-road"></div>
        </div>
        <div class="bac-stats">
          <div class="bac-scell"><div class="bac-slbl">ROUNDS</div><div class="bac-sv" id="bac-sr">0</div></div>
          <div class="bac-scell"><div class="bac-slbl">WIN RATE</div><div class="bac-sv" id="bac-wr">—</div></div>
          <div class="bac-scell"><div class="bac-slbl">STREAK</div><div class="bac-sv" id="bac-st">—</div></div>
          <div class="bac-scell"><div class="bac-slbl">BEST WIN</div><div class="bac-sv bac-g" id="bac-bw">—</div></div>
          <div class="bac-scell"><div class="bac-slbl">WORST LOSS</div><div class="bac-sv bac-r" id="bac-bl">—</div></div>
          <div class="bac-scell"><div class="bac-slbl">BALANCE</div><svg id="bac-spark" width="100%" height="32" viewBox="0 0 120 32" preserveAspectRatio="none"></svg></div>
        </div>
        <div class="bac-ov" id="bac-ov">
          <div class="bac-banner" id="bac-bn">
            <div class="bac-rt" id="bac-rt">WIN!</div>
            <div class="bac-ra" id="bac-ra">+$0.00</div>
          </div>
        </div>
      </div>`;

    // Chip rack clicks
    document.querySelectorAll('.bac-chip').forEach(chip=>{
      chip.addEventListener('click',()=>this._selChip(+chip.dataset.v,chip));
    });

    // Chip value input
    const cvInp=$id('bac-cv');
    if(cvInp)cvInp.addEventListener('input',()=>{this.chipVal=parseFloat(cvInp.value)||1;});

    // Half / x2 chip value
    $id('bac-half').addEventListener('click',()=>{
      const inp=$id('bac-cv');
      this.chipVal=Math.max(1,Math.floor((this.chipVal||0)*.5));
      if(inp)inp.value=this.chipVal;
    });
    $id('bac-x2').addEventListener('click',()=>{
      const inp=$id('bac-cv');
      this.chipVal=Math.max(1,(this.chipVal||0)*2);
      if(inp)inp.value=this.chipVal;
    });

    // Bet zone clicks
    $id('bac-z-player').addEventListener('click',()=>this._placeChip('player'));
    $id('bac-z-tie').addEventListener('click',()=>this._placeChip('tie'));
    $id('bac-z-banker').addEventListener('click',()=>this._placeChip('banker'));

    // Control buttons
    $id('bac-btn-clear').addEventListener('click',()=>this._clearBets());
    $id('bac-btn-undo').addEventListener('click',()=>this._undoBet());
    $id('bac-btn-dbl').addEventListener('click',()=>this._doubleBet());
    $id('bac-btn-half').addEventListener('click',()=>this._halfBet());

    // Tabs
    $id('bac-tab-m').addEventListener('click',()=>{
      $id('bac-tab-m').classList.add('active');$id('bac-tab-a').classList.remove('active');
      $id('bac-panel-m').style.display='';$id('bac-panel-a').style.display='none';
    });
    $id('bac-tab-a').addEventListener('click',()=>{
      $id('bac-tab-a').classList.add('active');$id('bac-tab-m').classList.remove('active');
      $id('bac-panel-a').style.display='';$id('bac-panel-m').style.display='none';
    });

    // Sound toggle
    $id('bac-snd').addEventListener('click',()=>{
      this._muted=!this._muted;
      $id('bac-snd').textContent=this._muted?'🔇':'🔊';
    });

    // Autoplay start/stop
    $id('bac-auto-start').addEventListener('click',()=>{
      if(this._auto.running){this._stopAuto();}else{this._startAuto();}
    });

    this._updateUI();
    this._renderRoad();
    this._renderStats();
  },

  unmount(){
    if(this._auto.running){this._auto.running=false;autoRunning=false;}
    this._T.forEach(clearTimeout);this._T=[];
    // Refund chips that were placed but game not started
    const total=this.bets.player+this.bets.tie+this.bets.banker;
    if(total>0&&this.gameState==='betting'){
      const w=curW();w.amt+=total;w.fiat=w.amt*(w.rate||1);renderWallet();
      this.bets={player:0,tie:0,banker:0};this.betHistory=[];
    }
    const css=$id('bac-css');if(css)css.remove();
  }
};
