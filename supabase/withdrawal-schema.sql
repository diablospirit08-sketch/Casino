-- ============================================================
--  VOLT Casino — Withdrawal & Deposit SQL Functions
--  Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── create_withdrawal: atomically debit before signing a voucher ─
-- Called only by the create-withdrawal Edge Function (service role).
-- Debit happens here so the signed voucher can never exceed actual balance.
CREATE OR REPLACE FUNCTION public.create_withdrawal(
  p_user_id    UUID,
  p_currency   TEXT,
  p_amount_eth NUMERIC
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bal    NUMERIC;
  v_newbal NUMERIC;
BEGIN
  SELECT balance INTO v_bal
  FROM public.wallets
  WHERE user_id = p_user_id AND currency = p_currency
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found: % %', p_user_id, p_currency;
  END IF;

  IF v_bal < p_amount_eth THEN
    RAISE EXCEPTION 'Insufficient balance: have %, need %', v_bal, p_amount_eth;
  END IF;

  v_newbal := v_bal - p_amount_eth;

  UPDATE public.wallets
  SET balance    = v_newbal,
      updated_at = NOW()
  WHERE user_id = p_user_id AND currency = p_currency;

  -- Record as pending; mark completed after on-chain confirmation
  INSERT INTO public.transactions (user_id, type, currency, amount, status)
  VALUES (p_user_id, 'withdraw', p_currency, p_amount_eth, 'pending');

  RETURN json_build_object('new_balance', v_newbal);
END;
$$;

-- ── add_balance: used by alchemy-webhook to credit on-chain deposits ─
CREATE OR REPLACE FUNCTION public.add_balance(
  p_user_id  UUID,
  p_currency TEXT,
  p_amount   NUMERIC
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.wallets (user_id, currency, balance)
  VALUES (p_user_id, p_currency, p_amount)
  ON CONFLICT (user_id, currency)
  DO UPDATE SET
    balance    = wallets.balance + EXCLUDED.balance,
    updated_at = NOW();
END;
$$;
