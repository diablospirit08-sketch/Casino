/* Volt Casino — API client (replaces Supabase SDK)
   Mimics the supa.auth.* shape so existing code needs minimal changes. */
(function () {
  'use strict';

  const API    = 'https://casino-production-2759.up.railway.app';
  const LS_AT  = 'volt-access-token';
  const LS_RT  = 'volt-refresh-token';
  const LS_USR = 'volt-user';

  const _listeners = [];

  function _getUser() {
    try { return JSON.parse(localStorage.getItem(LS_USR)); } catch { return null; }
  }

  function _setSession(accessToken, refreshToken, user) {
    localStorage.setItem(LS_AT,  accessToken);
    localStorage.setItem(LS_RT,  refreshToken);
    localStorage.setItem(LS_USR, JSON.stringify(user));
    _listeners.forEach(fn => fn('SIGNED_IN', { access_token: accessToken, user }));
  }

  function _clearSession() {
    localStorage.removeItem(LS_AT);
    localStorage.removeItem(LS_RT);
    localStorage.removeItem(LS_USR);
    _listeners.forEach(fn => fn('SIGNED_OUT', null));
  }

  async function _refresh() {
    const rt = localStorage.getItem(LS_RT);
    if (!rt) return null;
    try {
      const res = await fetch(`${API}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) { _clearSession(); return null; }
      const j = await res.json();
      localStorage.setItem(LS_AT, j.accessToken);
      localStorage.setItem(LS_RT, j.refreshToken);
      return j.accessToken;
    } catch { return null; }
  }

  // Token-aware fetch — auto-refreshes on 401
  async function _fetch(path, opts = {}) {
    const at = localStorage.getItem(LS_AT);
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (at) headers['Authorization'] = 'Bearer ' + at;

    let res = await fetch(`${API}${path}`, { ...opts, headers });

    if (res.status === 401) {
      const newAt = await _refresh();
      if (newAt) {
        headers['Authorization'] = 'Bearer ' + newAt;
        res = await fetch(`${API}${path}`, { ...opts, headers });
      }
    }
    return res;
  }

  window.voltApi = {
    _fetch,
    _setSession,

    auth: {
      async getSession() {
        const at   = localStorage.getItem(LS_AT);
        const user = _getUser();
        if (!at || !user) return { data: { session: null } };
        // Auto-refresh if token looks expired (JWT exp claim check)
        try {
          const payload = JSON.parse(atob(at.split('.')[1]));
          if (payload.exp && payload.exp * 1000 < Date.now() + 60_000) {
            const fresh = await _refresh();
            if (!fresh) return { data: { session: null } };
          }
        } catch { /* malformed token — proceed, let API reject it */ }
        return { data: { session: { access_token: localStorage.getItem(LS_AT), user } } };
      },

      async getUser() {
        return { data: { user: _getUser() } };
      },

      async signUp({ email, password }) {
        // Auto-derive username from email local-part
        const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32) || 'user';
        const res = await fetch(`${API}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, username }),
        });
        const json = await res.json();
        if (!res.ok) return { data: null, error: { message: json.error } };
        _setSession(json.accessToken, json.refreshToken, json.user);
        return { data: { session: { access_token: json.accessToken, user: json.user } }, error: null };
      },

      async signInWithPassword({ email, password }) {
        const res = await fetch(`${API}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const json = await res.json();
        if (!res.ok) return { data: null, error: { message: json.error } };
        _setSession(json.accessToken, json.refreshToken, json.user);
        return { data: { session: { access_token: json.accessToken, user: json.user } }, error: null };
      },

      async signOut() {
        const rt = localStorage.getItem(LS_RT);
        if (rt) {
          fetch(`${API}/api/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt }),
          }).catch(() => {});
        }
        _clearSession();
      },

      onAuthStateChange(callback) {
        _listeners.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe() {
                const i = _listeners.indexOf(callback);
                if (i >= 0) _listeners.splice(i, 1);
              },
            },
          },
        };
      },

      async updateUser({ password } = {}) {
        if (!password) return { data: {}, error: null };
        const res = await _fetch('/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ password }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { error: { message: json.error || 'Update failed' } };
        return { data: {}, error: null };
      },

      async resetPasswordForEmail(email) {
        try {
          const res = await fetch(`${API}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) return { error: { message: json.error || 'Request failed' } };
          return { error: null };
        } catch {
          return { error: { message: 'Network error — check your connection.' } };
        }
      },

      async resetPassword(token, password) {
        try {
          const res = await fetch(`${API}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) return { error: { message: json.error || 'Reset failed' } };
          return { error: null };
        } catch {
          return { error: { message: 'Network error — check your connection.' } };
        }
      },

      async signInWithOAuth({ provider, options = {} } = {}) {
        if (window._supaReal) {
          return window._supaReal.auth.signInWithOAuth({
            provider,
            options: { redirectTo: location.origin + location.pathname, ...options },
          });
        }
        return { error: { message: 'OAuth not ready' } };
      },
    },
  };
})();
