-- Revoke public/anon/authenticated execute rights on SECURITY DEFINER
-- functions. These are only called by the backend via direct TCP connection
-- (service role), never via PostgREST RPC.

REVOKE EXECUTE ON FUNCTION public.add_balance(uuid, text, numeric)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_deposit_address_slot(uuid, text)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_withdrawal(uuid, text, numeric, text)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_stats()                                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin()                                     FROM PUBLIC, anon, authenticated;

-- Fix mutable search_path on set_updated_at trigger function.
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Revoke execute on set_updated_at from public too.
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
