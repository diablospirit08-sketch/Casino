-- Revoke execute on all public-schema functions from anon/authenticated roles.
-- The backend connects via direct TCP (service role) so it is unaffected.
-- This covers add_balance, create_withdrawal, claim_deposit_address_slot,
-- admin_stats, is_admin, set_updated_at, and any future functions.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Fix mutable search_path on the set_updated_at trigger function.
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
