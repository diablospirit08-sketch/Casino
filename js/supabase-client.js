// Real Supabase client — used only for Google OAuth redirect flow.
// All other API calls still go through voltApi (Railway backend).
const SUPA_URL  = 'https://czqqdwmifcqoiyphjqjk.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6cXFkd21pZmNxb2l5cGhqcWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjU5NDEsImV4cCI6MjA5Njg0MTk0MX0.xoYsYBGeGunm-_svxmNPtm3paM8JWQJcOJQSTSOkVD4';

const API = 'https://casino-production-2759.up.railway.app';

window._supaReal = supabase.createClient(SUPA_URL, SUPA_ANON);

// After Google OAuth redirect, Supabase fires SIGNED_IN with the session.
// We exchange the Supabase token for a Railway JWT so all wallet/bet
// operations continue to work normally.
window._supaReal.auth.onAuthStateChange(async (event, session) => {
  if (event !== 'SIGNED_IN' || !session) return;
  // Only handle OAuth (Google) sign-ins — email/password goes through voltApi directly
  const provider = session.user?.app_metadata?.provider;
  if (provider !== 'google') return;

  const u = session.user;
  try {
    // Try Railway endpoint for OAuth exchange
    const res = await fetch(`${API}/api/auth/google-oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token,
      },
      body: JSON.stringify({
        supabaseToken: session.access_token,
        email: u.email,
        name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0],
        avatarUrl: u.user_metadata?.avatar_url,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      window.voltApi._setSession(j.accessToken, j.refreshToken, j.user);
      return;
    }
  } catch {}

  // Fallback: use Supabase token directly as Railway Bearer.
  // Works when Railway validates against the same Supabase JWT secret.
  window.voltApi._setSession(session.access_token, session.refresh_token, {
    id: u.id,
    email: u.email,
    username: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Player',
  });
});

// supa stays as the voltApi alias for all non-OAuth operations
const supa = window.voltApi;
