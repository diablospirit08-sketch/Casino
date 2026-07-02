/* VOLT — "Ace", the casino host. A scripted persona living in community chat:
   greets, reacts to your results (by wrapping settleBet/serverSettleBet),
   and answers rules/RTP/VIP questions via keyword matching. No API calls. */
(function(){
'use strict';

const NAME='Ace · Host';
let greeted=false,lossStreak=0,rgNudged=false,lastHype=0,typingEl=null;

/* ---- styles ---- */
const css=document.createElement('style');
css.textContent=`
.cmsg.host{background:linear-gradient(135deg,rgba(139,92,246,.14),rgba(65,240,164,.07));border:1px solid rgba(139,92,246,.28);border-radius:10px;padding:7px 9px}
.cmsg.host .cu{color:#a48bfd}
.cmsg.host .cu::after{content:'🎙';margin-left:4px;font-size:10px}
.cmsg.typing .dots i{display:inline-block;width:4px;height:4px;margin:0 1.5px;border-radius:50%;background:#8b93a7;animation:hostDot 1s infinite}
.cmsg.typing .dots i:nth-child(2){animation-delay:.15s}
.cmsg.typing .dots i:nth-child(3){animation-delay:.3s}
@keyframes hostDot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-3px);opacity:1}}`;
document.head.appendChild(css);

/* ---- chat plumbing (chatMsgs markup mirrors addChat in extras.js) ---- */
function msgs(){return document.getElementById('chatMsgs');}
function put(txt,cls){
  const box=msgs();if(!box)return null;
  const el=document.createElement('div');
  el.className='cmsg host'+(cls?' '+cls:'');
  const cu=document.createElement('span');
  cu.className='cu';cu.textContent=NAME;
  el.appendChild(cu);
  if(cls==='typing'){
    const d=document.createElement('span');
    d.className='dots';d.innerHTML='<i></i><i></i><i></i>';
    el.appendChild(d);
  }else{
    el.appendChild(document.createTextNode(txt));
  }
  box.appendChild(el);
  while(box.children.length>60)box.firstElementChild.remove();
  box.scrollTop=box.scrollHeight;
  return el;
}
/* type for a human-ish delay, then speak */
function say(txt,extraDelay){
  if(!msgs())return;
  if(typingEl)typingEl.remove();
  typingEl=put('','typing');
  const delay=(extraDelay||0)+400+Math.min(2200,txt.length*22);
  setTimeout(()=>{
    if(typingEl){typingEl.remove();typingEl=null;}
    put(txt);
  },delay);
}

/* ---- knowledge base: [regex, reply | replies[]] ---- */
const pick=a=>Array.isArray(a)?a[Math.floor(Math.random()*a.length)]:a;
const KB=[
  [/\b(hi|hello|hey|gm|good (morning|evening)|yo)\b/i,['Hey hey, welcome to Volt ⚡ Need a game recommendation?','gm! The crash lobby is buzzing today.','Welcome in! I\'m Ace — ask me anything about the games.']],
  [/who are (you|u)|what are you|are you (a )?bot/i,'I\'m Ace, your Volt host 🎙 I know every game on the floor — rules, odds, RTP. Try me.'],
  [/\bcrash\b/i,'Crash: the multiplier climbs from 1.00× and can bust at any moment. Cash out before it busts to lock your bet × multiplier. Set an Auto Cashout if your nerves need it. RTP 99%.'],
  [/\bdice\b/i,'Dice: pick a target and roll over/under it. Lower win chance = bigger multiplier. It\'s the purest odds game we have — 99% RTP.'],
  [/\bmines?\b/i,'Mines: 25 tiles, you choose how many mines hide among them. Every safe tile bumps your multiplier — cash out any time. More mines, more money, more pain.'],
  [/\bplinko\b/i,'Plinko: drop a ball, watch it bounce into a payout bucket. Higher risk setting pushes the big multipliers to the edges. The 170× bucket is real, I\'ve seen it.'],
  [/\blimbo\b/i,'Limbo: pick a target multiplier, and if the roll lands above it you win. Simple, brutal, 99% RTP.'],
  [/\bkeno\b/i,'Keno: pick up to 10 numbers out of 40, we draw 10. More hits, bigger payout. Zero hits also pays on some boards — the universe apologizing.'],
  [/\bblack\s?jack|21\b/i,'Blackjack: beat the dealer to 21. Dealer stands on 17, blackjack pays 3:2. Basic strategy is your friend — hit me with "strategy" if you want the cheat sheet.'],
  [/\bstrategy\b/i,'Quick blackjack crib: always split A/A and 8/8, stand on 17+, double on 11, and never take insurance. You\'re welcome.'],
  [/\broulette\b/i,'Roulette: straight numbers pay 35:1, colors and odd/even pay even money. One zero on our wheel, so the edge is a slim 2.7%.'],
  [/\bbaccarat\b/i,'Baccarat: bet Player, Banker or Tie. Banker wins slightly more often (5% commission applies). Tie pays 8:1 but hits rarely — high roller classic.'],
  [/\bcoin\s?flip\b/i,'Coinflip: heads or tails, 1.98× on a win. Chain flips for streak multipliers if you like living dangerously.'],
  [/\brtp|house edge|odds\b/i,'Most Volt Originals run at 99% RTP — a 1% house edge. Slots vary by title (check the game page). Long run, the house edge is the price of the show.'],
  [/\bvip|rakeback|loyalty|rank\b/i,'The VIP club ranks up with your wagering — each tier adds rakeback, bonuses and perks. Check the Loyalty Program section in the lobby to see your progress.'],
  [/\bdeposit|cash ?in\b/i,'Hit the Wallet button up top to deposit — crypto lands after network confirmation. Demo balance is on the house if you just want to play around.'],
  [/\bwithdraw|cash ?out\b/i,'Withdrawals go from the Wallet menu — pick currency, paste your address, done. Vault funds need to be un-vaulted first.'],
  [/\bvault\b/i,'The Vault keeps winnings out of your itchy trigger fingers — move funds in from the Wallet menu, withdraw them back whenever you like.'],
  [/\brace|leaderboard\b/i,'The weekly race ranks total wagered — top spots split the prize pool. Every bet counts automatically, no opt-in needed.'],
  [/\bbonus|daily|gift|free\b/i,'Daily Bonus lives at the bottom of the left rail — the gift box. Come back every day, streaks make it fatter.'],
  [/\bprovably|fair|rigged|scam\b/i,'Every Original is provably fair — server seed committed before your bet, verifiable after. Check the fairness button on any game page. The math doesn\'t lie, even when the dice do.'],
  [/\bsport|parlay|football|soccer|match/i,'Sportsbook is in the left rail ⚽ Live odds, singles and parlays. Parlays multiply the odds — and the heartbreak.'],
  [/\bvio|token\b/i,'VIO is our reward token — you earn it as you wager. Track it in the rail banner.'],
  [/\bthank|thx|ty\b/i,['Anytime ⚡','That\'s what I\'m here for.','Go get \'em.']],
  [/\blove (you|u)|marry\b/i,'I\'m flattered, but I\'m contractually married to the house edge.'],
  [/\btilt|angry|lost every|hate this\b/i,'Deep breath. The games will still be here tomorrow — the Responsible Gaming tools in the menu can set limits or a cooldown if you want a guardrail.'],
];
const FALLBACK_Q=['Good question — not my department, but the games I know cold. Ask me about any of them.','Hmm, above my pay grade. Rules, odds, VIP — that\'s my lane.'];
const FALLBACK=['Respect.','Big talk from someone up against a 1% edge 😏','The rocket waits for no one.','Noted. Now go win something.'];

/* ---- public surface ---- */
window.VoltHost={
  onChatOpen(){
    if(greeted)return;greeted=true;
    say('Welcome to Volt ⚡ I\'m Ace, your host. Ask me about any game — rules, odds, RTP — or just tell me your lucky number.',600);
  },
  onUserMessage(t){
    for(const[re,ans]of KB){
      if(re.test(t)){say(pick(ans));return;}
    }
    say(pick(/\?\s*$/.test(t)?FALLBACK_Q:FALLBACK));
  },
  onResult(st,mult){
    const usd=st.b*(mult-1)*(st.w?st.w.rate:1);
    if(mult<1){
      lossStreak++;
      if(lossStreak>=6&&!rgNudged){
        rgNudged=true;
        say('Rough patch — happens to everyone. No shame in a break; the Responsible Gaming menu can set a session timer if you want one. I\'ll keep your seat warm.');
      }
      return;
    }
    lossStreak=0;
    const now=Date.now();
    if((mult>=10||usd>=100)&&now-lastHype>90000){
      lastHype=now;
      const g=st.name||'that one';
      say(pick([
        `📢 Big cash on ${g} — ${mult.toFixed(2)}×! Someone\'s buying dinner tonight.`,
        `${mult.toFixed(2)}× on ${g}?! Pit boss just spilled his coffee.`,
        `Certified heater alert 🔥 ${mult.toFixed(2)}× on ${g}.`,
      ]));
    }
  },
};

/* ---- observe game results by wrapping the settle functions (engines.js / place-bet.js) ---- */
if(typeof settleBet==='function'){
  const _s=settleBet;
  settleBet=function(st,mult){_s(st,mult);try{VoltHost.onResult(st,mult);}catch{}};
}
if(typeof serverSettleBet==='function'){
  const _ss=serverSettleBet;
  serverSettleBet=function(st,mult,nb){_ss(st,mult,nb);try{VoltHost.onResult(st,mult);}catch{}};
}
})();
