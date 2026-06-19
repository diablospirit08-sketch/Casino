/* VOLT — server-side bet settlement via backend API */

async function placeBet({ game, currency, wager, params = {} }) {
  const { data: { session } } = await supa.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Step 1: reserve a server seed
  const prepRes = await window.voltApi._fetch('/api/bets/prepare', { method: 'POST' });
  if (!prepRes.ok) throw new Error('Failed to prepare bet');
  const { serverSeedHash, clientSeed: suggestedSeed } = await prepRes.json();

  const clientSeed = window._pfClient || suggestedSeed || 'default';
  // _pfNonce is incremented atomically between awaits (JS single-threaded)
  const nonce = window._pfNonce !== undefined ? window._pfNonce++ : 0;

  // Step 2: place the bet — server debits, resolves, and credits in one transaction
  const res = await window.voltApi._fetch('/api/bets/place', {
    method: 'POST',
    body: JSON.stringify({ game, currency, wager, serverSeedHash, clientSeed, nonce, params }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'place-bet failed');

  if (window.pfRecordServer) pfRecordServer(json.serverSeed, json.serverSeedHash, json.clientSeed, json.nonce);

  // Refresh wallet display with authoritative balance from server
  if (window.loadBalances) loadBalances().catch(() => {});

  // Return shape compatible with what the game engines expect
  return {
    ...json,
    new_balance: null,  // balance refreshed async via loadBalances()
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
  if (window.pfRecord) pfRecord();
  gsession.prof += st.b * (mult - 1) * w.rate;
  if (mult !== 1) win ? gsession.w++ : gsession.l++;
  renderSession();
  pushChip(mult, win);
  if (win) pushFeed('You', st.name, st.b * (mult - 1) * w.rate, true);
}
