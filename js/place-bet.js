/* VOLT — server-side bet settlement via backend API */

// Pre-fetched seed pool — we always keep one seed ready so placeBet
// only needs one round-trip instead of two (prepare + place).
var _nextSeed = null;
var _fetchingNextSeed = false;

function _prefetchSeed() {
  if (_fetchingNextSeed || _nextSeed) return;
  _fetchingNextSeed = true;
  window.voltApi._fetch('/api/bets/prepare', { method: 'POST', body: '{}' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(j) { _nextSeed = j; })
    .catch(function() {})
    .finally(function() { _fetchingNextSeed = false; });
}

// Prime the first seed as soon as the script loads
_prefetchSeed();

async function placeBet({ game, currency, wager, params = {} }) {
  const { data: { session } } = await supa.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Use pre-fetched seed if ready; fall back to live fetch if not
  let seed = _nextSeed;
  _nextSeed = null;
  _prefetchSeed(); // start fetching next seed in background immediately

  if (!seed) {
    const prepRes = await window.voltApi._fetch('/api/bets/prepare', { method: 'POST', body: '{}' });
    if (!prepRes.ok) throw new Error('Failed to prepare bet');
    seed = await prepRes.json();
  }

  const { serverSeedHash, clientSeed: suggestedSeed } = seed;
  const clientSeed = window._pfClient || suggestedSeed || 'default';
  const nonce = window._pfNonce !== undefined ? window._pfNonce++ : 0;

  // Place the bet — server debits, resolves, and credits in one transaction
  const res = await window.voltApi._fetch('/api/bets/place', {
    method: 'POST',
    body: JSON.stringify({ game, currency, wager, serverSeedHash, clientSeed, nonce, params }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'place-bet failed');

  if (window.pfRecordServer) pfRecordServer(json.serverSeed, json.serverSeedHash, json.clientSeed, json.nonce);

  // Update balance immediately from bet result — no extra round-trip needed
  const w = WALLETS.find(function(w) { return w.c === currency; });
  if (w) {
    w.amt = Math.max(0, w.amt - wager + (json.payout || 0));
    w.fiat = w.amt * (w.rate || 0);
    renderWallet();
  }

  return {
    ...json,
    new_balance: w ? w.amt : null,
    outcome:  json.result,
    gameData: json.result,
  };
}

/* Called by game engines after server settles — applies balance + side effects */
function serverSettleBet(st, mult, newBalance) {
  const w = st.w;
  // If newBalance was provided (legacy path), apply it directly
  if (newBalance != null && !isNaN(parseFloat(newBalance))) {
    w.amt  = Math.max(0, parseFloat(newBalance));
    w.fiat = w.amt * w.rate;
    renderWallet();
  }
  // Otherwise balance was already refreshed by loadBalances() in placeBet()

  const win = mult > 1;
  gsession.wag += st.b * w.rate;
  addXp(st.b * w.rate);
  if (window.addRakeback) addRakeback(st.b * w.rate);
  gsession.prof += st.b * (mult - 1) * w.rate;
  if (mult !== 1) win ? gsession.w++ : gsession.l++;
  renderSession();
  pushChip(mult, win);
  if (win) pushFeed('You', st.name, st.b * (mult - 1) * w.rate, true);
  if (window._pushBetHist) _pushBetHist(st, mult);
}
