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

/* ── record a single bet — no-op; backend records via /api/bets/place ── */
async function _recordBet() {}

/* ── record a transaction — server ledger is authoritative; refresh balance display ── */
window.recordTransaction = async function() {
  if (window.loadBalances) loadBalances().catch(() => {});
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
