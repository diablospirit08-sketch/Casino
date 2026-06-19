(async function () {
'use strict';

/* ── live price fetch (CoinGecko free tier) ── */
const CG_IDS = {
  BTC:'bitcoin', ETH:'ethereum', BNB:'binancecoin', LTC:'litecoin',
  USDT:'tether', USDC:'usd-coin', SOL:'solana',
};
const LS_RATES    = 'volt-rates';
const LS_RATES_TS = 'volt-rates-ts';
const RATE_TTL    = 5 * 60 * 1000;

async function fetchRates() {
  const now = Date.now();
  const ts  = parseInt(localStorage.getItem(LS_RATES_TS) || '0');
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
    rates.USDT = 1; rates.USDC = 1;
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

/* ── load balances from backend ── */
async function loadBalances() {
  const { data: { session } } = await supa.auth.getSession();
  if (!session) return;

  const rates = await fetchRates();
  applyRates(rates);

  const res = await window.voltApi._fetch('/api/wallet/balances');
  if (!res.ok) { console.warn('Balance fetch failed:', res.status); return; }
  const balances = await res.json();

  WALLETS.forEach(w => {
    if (balances[w.c] !== undefined) {
      w.amt  = parseFloat(balances[w.c]) || 0;
      w.fiat = w.amt * (w.rate || 0);
    }
  });

  renderWallet();
}

/* Expose so place-bet.js can refresh balance after settlement */
window.loadBalances = loadBalances;

/* ── auth state changes ── */
supa.auth.onAuthStateChange((_, session) => {
  if (session) {
    loadBalances().catch(err => console.warn('loadBalances failed:', err));
  } else {
    WALLETS.forEach(w => { w.amt = 0; w.fiat = 0; });
    renderWallet();
  }
});

/* load immediately if already signed in */
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
