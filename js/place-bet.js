/* VOLT — server-side bet settlement via Supabase Edge Function */

const PLACE_BET_URL = 'https://czqqdwmifcqoiyphjqjk.supabase.co/functions/v1/place-bet';

async function placeBet({ game, currency, wager, params = {} }) {
  const { data: { session } } = await supa.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  /* Snapshot-and-increment before the fetch so concurrent auto-bets each
     get a distinct nonce. JS is single-threaded between awaits, so ++ here
     is atomic — no two calls in flight can read the same value. */
  const nonce = window._pfNonce !== undefined ? window._pfNonce++ : 0;

  const res = await fetch(PLACE_BET_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + session.access_token,
    },
    body: JSON.stringify({
      game, currency, wager, params,
      clientSeed: window._pfClient || 'default',
      nonce,
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'place-bet failed');

  if (window.pfRecordServer) pfRecordServer(json.serverSeed, json.serverSeedHash, json.clientSeed, json.nonce);

  return json; // { new_balance, profit, outcome, multiplier, gameData, serverSeed, serverSeedHash, clientSeed, nonce }
}

/* Called after server settles — applies authoritative balance + side effects */
function serverSettleBet(st, mult, newBalance) {
  const w = st.w;
  w.amt = (newBalance != null && !isNaN(parseFloat(newBalance)))
    ? Math.max(0, parseFloat(newBalance))
    : Math.max(0, w.amt + st.b * mult);
  w.fiat = w.amt * w.rate;
  renderWallet();

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
