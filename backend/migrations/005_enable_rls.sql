-- Enable RLS on all public tables.
-- The backend connects via the direct pooler URL (not PostgREST) so it
-- bypasses RLS entirely. Enabling RLS here only blocks direct anon-key
-- access through Supabase's REST API, which is the intended behaviour.

ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_addresses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_addresses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_nonces   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onchain_deposits    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._migrations         ENABLE ROW LEVEL SECURITY;

-- No policies added = deny all for anon / authenticated roles.
-- The service role key and direct TCP connections bypass RLS.
