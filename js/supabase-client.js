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
  const provider = session.user?.app_metadata?.provider;
  if (provider !== 'google') return;

  const u = session.user;
  const username = (u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Player')
    .replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);
  // Deterministic Railway password tied to the Supabase user ID
  const googlePw = 'google_oauth_' + u.id;

  // Try login first; if the account doesn't exist yet, register it
  let res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: googlePw }),
  });
  if (!res.ok) {
    res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: googlePw, username }),
    });
  }
  if (res.ok) {
    const j = await res.json();
    window.voltApi._setSession(j.accessToken, j.refreshToken, j.user);
  } else {
    console.warn('Google→Railway bridge failed:', await res.text());
  }
});

// supa stays as the voltApi alias for all non-OAuth operations
const supa = window.voltApi;
