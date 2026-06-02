// ============================================================================
// cookie-session.js - Client-side session identifier management
// Generates secure session IDs and tracks inactivity-based expiration
// NOTE: This is supplementary to the server-side express-session (which is
//       HttpOnly + Secure). The session ID stored here is a CLIENT-side
//       helper (e.g. for analytics correlation), not the auth session.
// ============================================================================
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (!window.CookieUtils) {
    console.error('[CookieSession] CookieUtils not loaded.');
    return;
  }

  const U = window.CookieUtils;
  const SESSION_COOKIE = U.COOKIE_NAMES.SESSION;
  const ACTIVITY_COOKIE = U.COOKIE_NAMES.SESSION_ACTIVITY;
  const SESSION_EXPIRY_DAYS = 30;       // hard expiry
  const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 min idle -> expire
  const ACTIVITY_UPDATE_MS = 60 * 1000; // 1 min throttle

  // --------------------------------------------------------------------------
  // Secure ID generation
  // --------------------------------------------------------------------------
  function generateSessionId() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const arr = new Uint8Array(24);
      crypto.getRandomValues(arr);
      return Array.from(arr).map(function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    }
    // Fallback (less secure)
    let s = '';
    for (let i = 0; i < 48; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  }

  // --------------------------------------------------------------------------
  // Activity / idle tracking
  // --------------------------------------------------------------------------
  let _lastActivityUpdate = 0;
  function touch() {
    const now = Date.now();
    // Always write if the activity cookie is missing (e.g. cleared or first call)
    const activityExists = U.hasCookie(ACTIVITY_COOKIE);
    if (activityExists && (now - _lastActivityUpdate) < ACTIVITY_UPDATE_MS) return;
    _lastActivityUpdate = now;
    U.createCookie(ACTIVITY_COOKIE, String(now), 1, { // 1 day - we re-write often
      path: '/',
      sameSite: 'Strict',
      secure: U.isSecureContext,
      category: U.COOKIE_CATEGORIES.ESSENTIAL
    });
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------
  function getSession() {
    return {
      id: U.getCookie(SESSION_COOKIE),
      lastActivity: parseInt(U.getCookie(ACTIVITY_COOKIE), 10) || 0
    };
  }

  function createSession() {
    const id = generateSessionId();
    U.createCookie(SESSION_COOKIE, id, SESSION_EXPIRY_DAYS, {
      path: '/',
      sameSite: 'Strict',
      secure: U.isSecureContext,
      httpOnly: false, // must be readable by client analytics
      category: U.COOKIE_CATEGORIES.ESSENTIAL
    });
    touch();
    document.dispatchEvent(new CustomEvent('sessionCreated', { detail: { id: id } }));
    return id;
  }

  function isExpired() {
    const s = getSession();
    if (!s.id) return true;
    if (!s.lastActivity) return false;
    return (Date.now() - s.lastActivity) > IDLE_LIMIT_MS;
  }

  function ensureSession() {
    let s = getSession();
    if (!s.id || isExpired()) {
      return createSession();
    }
    touch();
    return s.id;
  }

  function destroySession() {
    U.deleteCookie(SESSION_COOKIE);
    U.deleteCookie(ACTIVITY_COOKIE);
    document.dispatchEvent(new CustomEvent('sessionDestroyed'));
  }

  function getIdleMs() {
    const last = parseInt(U.getCookie(ACTIVITY_COOKIE), 10) || 0;
    if (!last) return null;
    return Date.now() - last;
  }

  // --------------------------------------------------------------------------
  // Activity listeners (throttled)
  // --------------------------------------------------------------------------
  let _bound = false;
  function bindActivity() {
    if (_bound) return;
    _bound = true;
    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(function (ev) {
      window.addEventListener(ev, touch, { passive: true, capture: true });
    });
  }

  function init() {
    bindActivity();
    ensureSession();
  }

  window.CookieSession = {
    init: init,
    createSession: createSession,
    getSession: getSession,
    ensureSession: ensureSession,
    isExpired: isExpired,
    destroySession: destroySession,
    getIdleMs: getIdleMs,
    generateSessionId: generateSessionId,
    _resetForTesting: function () { _lastActivityUpdate = 0; },
    SESSION_EXPIRY_DAYS: SESSION_EXPIRY_DAYS,
    IDLE_LIMIT_MS: IDLE_LIMIT_MS
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
