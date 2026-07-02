// ============================================================================
// cookie-language.js - Language preference persistence using cookies
// ============================================================================
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (!window.CookieUtils) {
    console.error('[CookieLanguage] CookieUtils not loaded.');
    return;
  }

  const U = window.CookieUtils;
  const LANG_COOKIE = U.COOKIE_NAMES.LANGUAGE;
  const LANG_EXPIRY_DAYS = 365;

  const SUPPORTED_LANGUAGES = [
    { code: 'uz', name: "O'zbek", flag: '🇺🇿' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'en', name: 'English', flag: '🇬🇧' }
  ];

  const DEFAULT_LANGUAGE = 'uz';

  function isValidLanguage(code) {
    return SUPPORTED_LANGUAGES.some(function (l) { return l.code === code; });
  }

  function detectBrowserLanguage() {
    const nav = (navigator && (navigator.language || navigator.userLanguage)) || '';
    const short = String(nav).substring(0, 2).toLowerCase();
    if (isValidLanguage(short)) return short;
    return DEFAULT_LANGUAGE;
  }

  function getLanguage() {
    const saved = U.getCookie(LANG_COOKIE);
    if (isValidLanguage(saved)) return saved;
    return detectBrowserLanguage();
  }

  function setLanguage(code, persist) {
    if (!isValidLanguage(code)) {
      console.warn('[CookieLanguage] Unsupported language:', code);
      return false;
    }
    if (persist !== false) {
      U.createCookie(LANG_COOKIE, code, LANG_EXPIRY_DAYS, {
        path: '/',
        sameSite: 'Strict',
        secure: U.isSecureContext,
        category: U.COOKIE_CATEGORIES.PREFERENCE
      });
    }
    applyLanguage(code);
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: code } }));
    return true;
  }

  function applyLanguage(code) {
    if (!isValidLanguage(code)) code = DEFAULT_LANGUAGE;
    document.documentElement.setAttribute('lang', code);
    if (document.body) document.body.setAttribute('data-lang', code);
    // Update meta if present
    const meta = document.querySelector('meta[name="language"]');
    if (meta) meta.setAttribute('content', code);
    // Update any element with data-i18n (best-effort; full i18n out of scope)
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      if (window.translations && window.translations[code] && window.translations[code][key]) {
        el.textContent = window.translations[code][key];
      }
    });
  }

  function getSupportedLanguages() {
    return SUPPORTED_LANGUAGES.slice();
  }

  function init() {
    applyLanguage(getLanguage());
  }

  window.CookieLanguage = {
    init: init,
    getLanguage: getLanguage,
    setLanguage: setLanguage,
    applyLanguage: applyLanguage,
    detectBrowserLanguage: detectBrowserLanguage,
    getSupportedLanguages: getSupportedLanguages,
    DEFAULT_LANGUAGE: DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES: SUPPORTED_LANGUAGES
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
