-- ============================================================
--  VOLT Casino — Deposit Address Schema
--  Run in Supabase Dashboard → SQL Editor after schema.sql
-- ============================================================

-- ── deposit_addresses: one HD-derived address per user per currency ──
CREATE TABLE IF NOT EXISTS public.deposit_addresses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  currency      TEXT NOT NULL,
  address       TEXT NOT NULL,
  address_index INT  NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (currency, address_index),
  UNIQUE (user_id, currency)
);

ALTER TABLE public.deposit_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deposit_addresses: own read" ON public.deposit_addresses;
CREATE POLICY "deposit_addresses: own read"
  ON public.deposit_addresses FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_deposit_addresses_user
  ON public.deposit_addresses (user_id, currency);

-- ── claim_deposit_address_slot: atomically reserves the next HD index ──
-- Uses a session-level advisory lock keyed on the currency so concurrent
-- calls for the same chain are serialized and each gets a unique index.
-- The Edge Function then derives the address and updates the placeholder row.
CREATE OR REPLACE FUNCTION public.claim_deposit_address_slot(
  p_user_id  UUID,
  p_currency TEXT
)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_idx INT;
BEGIN
  -- Serialize concurrent callers for this currency
  PERFORM pg_advisory_xact_lock(hashtext('deposit_idx_' || p_currency));

  SELECT COALESCE(MAX(address_index) + 1, 0) INTO v_idx
  FROM public.deposit_addresses WHERE currency = p_currency;

  -- Insert placeholder to claim the slot; Edge Function updates it with the real address
  INSERT INTO public.deposit_addresses (user_id, currency, address, address_index)
  VALUES (p_user_id, p_currency, '', v_idx);

  RETURN v_idx;
END;
$$;
