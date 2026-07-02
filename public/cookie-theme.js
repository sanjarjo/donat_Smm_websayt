// ============================================================================
// cookie-theme.js - Dark/Light theme persistence using cookies
// ============================================================================
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (!window.CookieUtils) {
    console.error('[CookieTheme] CookieUtils not loaded.');
    return;
  }

  const U = window.CookieUtils;
  const THEME_COOKIE = U.COOKIE_NAMES.THEME;
  const THEME_EXPIRY_DAYS = 365;
  const VALID_THEMES = ['light', 'dark'];

  function isValidTheme(t) {
    return VALID_THEMES.indexOf(t) !== -1;
  }

  function getTheme() {
    const t = U.getCookie(THEME_COOKIE);
    if (isValidTheme(t)) return t;
    // Fallback to system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function setTheme(theme, persist) {
    if (!isValidTheme(theme)) {
      console.warn('[CookieTheme] Invalid theme:', theme);
      return false;
    }
    if (persist !== false) {
      U.createCookie(THEME_COOKIE, theme, THEME_EXPIRY_DAYS, {
        path: '/',
        sameSite: 'Strict',
        secure: U.isSecureContext,
        category: U.COOKIE_CATEGORIES.PREFERENCE
      });
    }
    applyTheme(theme);
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: theme } }));
    return true;
  }

  function applyTheme(theme) {
    if (!isValidTheme(theme)) theme = 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.body && document.body.setAttribute('data-theme', theme);
    // Update meta theme-color if present
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#0a0e1a' : '#ffffff');
    }
  }

  function toggleTheme() {
    const current = getTheme();
    return setTheme(current === 'dark' ? 'light' : 'dark');
  }

  function init() {
    applyTheme(getTheme());
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      try {
        mq.addEventListener('change', function (e) {
          // Only follow system if no explicit choice
          if (!U.hasCookie(THEME_COOKIE)) {
            setTheme(e.matches ? 'dark' : 'light', false);
          }
        });
      } catch (e) { /* older browsers */ }
    }
  }

  window.CookieTheme = {
    init: init,
    getTheme: getTheme,
    setTheme: setTheme,
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    VALID_THEMES: VALID_THEMES
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
