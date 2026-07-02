/* VOLT — simulated player population ("bots").
   Presentation-only: bots never touch real balances or the server.
   Consumers: crash.js (round players), host.js (chat ambience), sportsbook.js (bet ticker). */
(function(){
'use strict';

/* style: cautious = small bets, early cashouts · typical = median · degen = chases tails · whale = big bets */
const ROSTER=[
  {n:'Volty_88',    s:'typical'},{n:'Nina_X',      s:'cautious'},{n:'Krakn',      s:'whale'},
  {n:'Joules',      s:'typical'},{n:'Mx_Turbo',    s:'degen'},  {n:'Ohmies',     s:'cautious'},
  {n:'spinz4dayz',  s:'degen'},  {n:'0xLuna',      s:'typical'},{n:'BetWizard',  s:'typical'},
  {n:'gg_marek',    s:'cautious'},{n:'HodlHanna',  s:'whale'},  {n:'ping_god',   s:'degen'},
  {n:'TiltedTony',  s:'degen'},  {n:'satoshi_lite',s:'typical'},{n:'MoonMirna',  s:'typical'},
  {n:'ZeroCool',    s:'cautious'},{n:'Vexa',       s:'typical'},{n:'BigDripDre', s:'whale'},
  {n:'cl0ver',      s:'cautious'},{n:'RushHourRui',s:'degen'},  {n:'PocketAce',  s:'typical'},
  {n:'nyx_nyx',     s:'typical'},{n:'Stakkato',    s:'whale'},  {n:'LowballLena',s:'cautious'},
  {n:'ape_together',s:'degen'},  {n:'QuietQuinn',  s:'cautious'},{n:'Voltaire_9', s:'typical'},
  {n:'redline_rex', s:'degen'},  {n:'MissMultiplier',s:'typical'},{n:'ChadGPT',  s:'degen'},
];

const rr=(a,b)=>Math.random()*(b-a)+a;
const pick=arr=>arr[Math.floor(Math.random()*arr.length)];

/* USD bet size by personality */
function betSize(s){
  switch(s){
    case 'whale':   return rr(80,1200);
    case 'degen':   return rr(5,90);
    case 'cautious':return rr(0.5,12);
    default:        return rr(2,45);
  }
}

/* crash cashout target by personality — heavy-tailed for degens, tight for cautious */
function crashTarget(s){
  const u=Math.random();
  switch(s){
    case 'cautious':return 1.05+rr(0,0.55);                       /* 1.05–1.6 */
    case 'whale':   return 1.15+rr(0,1.1);                        /* 1.15–2.25 */
    case 'degen':   return Math.min(200,1.5+Math.pow(1/(1-u*0.985),1.15)); /* long tail */
    default:        return 1.3+Math.pow(1/(1-u*0.9),0.9);         /* mostly 1.5–4 */
  }
}

/* sample n distinct bots */
function sample(n){
  const pool=[...ROSTER];
  const out=[];
  while(out.length<n&&pool.length)out.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  return out;
}

/* chat flavor */
const BRAG=['LETS GOOO {m}× 🚀','{m}× on Crash, printing today','told you the rocket had fuel — {m}×','{m}× cashed, rent is safe','easy {m}×, who doubted'];
const BUST=['rip, rode it too long 💀','I was ONE second from cashing','bust again, uninstalling (not really)','pain. absolute pain.','the graph personally hates me'];
const AMBIENT=[
  'just hit 12.4× on Plinko 🤯','anyone grinding the race this week?','gm legends ⚡',
  'Mines on 24 is pure pain lol','Berry Rush paying today fr','one more spin then I sleep (lie)',
  'streak day 6, do not talk to me tomorrow','who else camping Dice 98%?','finally hit Capo 🎉',
  'sportsbook parlay hit 3 legs, sweating the 4th','crash lobby is juiced rn, get in','keno slander will not be tolerated',
  'that 170× bucket exists, I refuse to believe otherwise','blackjack dealer pulling 21 like it\'s a job',
];

window.VoltBots={
  roster:ROSTER,
  sample,
  betSize,
  crashTarget,
  ambientLine(){return pick(AMBIENT);},
  bragLine(mult){return pick(BRAG).replace('{m}',mult.toFixed(2));},
  bustLine(){return pick(BUST);},
  /* post into community chat if it exists (addChat is a global from extras.js) */
  chat(name,txt){if(window.addChat)addChat(name,txt);},
};
})();
