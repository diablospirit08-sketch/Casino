/* VOLT — bet recorder: logs every settled bet to Supabase */
(function(){
'use strict';

let _userId = null;

supa.auth.onAuthStateChange((_, session) => {
  _userId = session?.user?.id ?? null;
});
supa.auth.getSession().then(({ data: { session } }) => {
  _userId = session?.user?.id ?? null;
});

/* ── record a single bet to Supabase ── */
async function _recordBet({ game, currency, wager, multiplier, profit, outcome, gameData = {} }) {
  if (!_userId) return;
  try {
    await supa.from('bets').insert({
      user_id:    _userId,
      game,
      currency,
      wager:      Math.abs(wager),
      multiplier: multiplier ?? null,
      profit:     profit ?? null,
      outcome,
      game_data:  gameData,
    });
  } catch (e) {
    console.warn('Bet record failed:', e.message);
  }
}

/* ── record a transaction (deposit/withdraw/bonus) ── */
window.recordTransaction = async function({ type, currency, amount, status = 'completed', txHash, address, note }) {
  if (!_userId) return;
  try {
    await supa.from('transactions').insert({
      user_id:  _userId,
      type,
      currency,
      amount:   Math.abs(amount),
      status,
      tx_hash:  txHash ?? null,
      address:  address ?? null,
      note:     note ?? null,
    });
  } catch (e) {
    console.warn('Transaction record failed:', e.message);
  }
};

/* ── wrap settleBet — intercepts every game outcome ── */
const _origSettle = window.settleBet;
window.settleBet = function(st, mult) {
  _origSettle.apply(this, arguments);
  _recordBet({
    game:       st.name,
    currency:   st.w.c,
    wager:      st.b,
    multiplier: mult,
    profit:     st.b * (mult - 1),
    outcome:    mult > 1 ? 'win' : mult === 1 ? 'push' : 'loss',
  });
};

/* expose for direct calls if needed */
window.recordBet = _recordBet;

})();
