-- ============================================================
--  VOLT Casino — Security Schema
--  Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Atomic bet settlement (SECURITY DEFINER bypasses RLS) ───
-- This is the ONLY function that may update wallet balances for game bets.
-- Called exclusively by the place-bet Edge Function (service role).
CREATE OR REPLACE FUNCTION public.settle_bet(
  p_user_id    UUID,
  p_currency   TEXT,
  p_wager      NUMERIC,
  p_profit     NUMERIC,          -- wager*(mult-1) for win; -wager for loss
  p_game       TEXT,
  p_outcome    TEXT,
  p_multiplier NUMERIC,
  p_game_data  JSONB DEFAULT '{}'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bal    NUMERIC;
  v_newbal NUMERIC;
BEGIN
  -- Lock this wallet row for the duration of the transaction
  SELECT balance INTO v_bal
  FROM public.wallets
  WHERE user_id = p_user_id AND currency = p_currency
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found: % %', p_user_id, p_currency;
  END IF;

  IF v_bal < p_wager THEN
    RAISE EXCEPTION 'Insufficient balance: have %, need %', v_bal, p_wager;
  END IF;

  -- profit = wager*(mult-1): positive for wins, negative for losses
  v_newbal := GREATEST(0, v_bal + p_profit);

  UPDATE public.wallets
  SET balance    = v_newbal,
      updated_at = NOW()
  WHERE user_id = p_user_id AND currency = p_currency;

  INSERT INTO public.bets (user_id, game, currency, wager, multiplier, profit, outcome, game_data)
  VALUES (p_user_id, p_game, p_currency, p_wager, p_multiplier, p_profit, p_outcome, p_game_data);

  RETURN json_build_object('new_balance', v_newbal, 'profit', p_profit, 'outcome', p_outcome);
END;
$$;
