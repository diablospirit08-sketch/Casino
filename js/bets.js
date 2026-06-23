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

/* ── record a transaction — server ledger is authoritative; refresh balance display ── */
window.recordTransaction = async function() {
  if (window.loadBalances) loadBalances().catch(() => {});
};

})();
