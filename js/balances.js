(async function(){
'use strict';

const CURRENCIES = ['BTC','ETH','BNB','LTC','USDT','SOL'];

/* ── live price fetch (CoinGecko free tier) ── */
const CG_IDS = {
  BTC:'bitcoin', ETH:'ethereum', BNB:'binancecoin', LTC:'litecoin',
  USDT:'tether', SOL:'solana',
};
const LS_RATES = 'volt-rates';
const LS_RATES_TS = 'volt-rates-ts';
const RATE_TTL = 5 * 60 * 1000; // 5 min cache

async function fetchRates() {
  const now = Date.now();
  const ts = parseInt(localStorage.getItem(LS_RATES_TS) || '0');
  if (now - ts < RATE_TTL) {
    try { return JSON.parse(localStorage.getItem(LS_RATES) || '{}'); } catch {}
  }
  try {
    const ids = Object.values(CG_IDS).join(',');
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
    );
    const json = await res.json();
    const rates = {};
    for (const [sym, cgId] of Object.entries(CG_IDS)) {
      rates[sym] = json[cgId]?.usd ?? 0;
    }
    rates.USDT = 1;
    localStorage.setItem(LS_RATES, JSON.stringify(rates));
    localStorage.setItem(LS_RATES_TS, String(now));
    return rates;
  } catch {
    try { return JSON.parse(localStorage.getItem(LS_RATES) || '{}'); } catch {}
    return {};
  }
}

function applyRates(rates) {
  WALLETS.forEach(w => {
    w.rate = rates[w.c] || w.rate || 0;
    w.fiat = w.amt * w.rate;
  });
}

/* ── load balances from Supabase ── */
async function loadBalances() {
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return;

  /* fetch live rates first */
  const rates = await fetchRates();
  applyRates(rates);

  /* fetch wallet rows */
  const { data, error } = await supa.from('wallets')
    .select('currency, balance')
    .eq('user_id', user.id);

  if (error) { console.warn('Balance fetch failed:', error.message); return; }

  const rows = data || [];
  const existing = rows.map(r => r.currency);
  const missing = CURRENCIES.filter(c => !existing.includes(c));

  /* create missing wallet rows */
  if (missing.length) {
    await supa.from('wallets').insert(
      missing.map(c => ({ user_id: user.id, currency: c, balance: 0 }))
    );
  }

  /* apply to WALLETS array */
  rows.forEach(row => {
    const w = WALLETS.find(x => x.c === row.currency);
    if (w) { w.amt = parseFloat(row.balance) || 0; w.fiat = w.amt * (w.rate || 0); }
  });
  missing.forEach(c => {
    const w = WALLETS.find(x => x.c === c);
    if (w) { w.amt = 0; w.fiat = 0; }
  });

  renderWallet();
}

/* Balance changes are now owned exclusively by the place-bet Edge Function
   via settle_bet() (SECURITY DEFINER). No direct wallet UPDATE from the browser. */

/* ── auth state changes ── */
supa.auth.onAuthStateChange((_, session) => {
  if (session) {
    loadBalances().catch(err => console.warn('loadBalances failed:', err));
  } else {
    WALLETS.forEach(w => { w.amt = 0; w.fiat = 0; });
    renderWallet();
  }
});

/* load immediately if already logged in */
const { data: { session } } = await supa.auth.getSession();
if (session) loadBalances().catch(err => console.warn('loadBalances failed:', err));

/* refresh rates every 5 min while tab is open */
setInterval(async () => {
  const { data: { session } } = await supa.auth.getSession();
  if (!session) return;
  const rates = await fetchRates();
  applyRates(rates);
  renderWallet();
}, RATE_TTL);

})();
