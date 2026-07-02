// ============================================================================
// cookie-utils.js - Core cookie management utilities
// Works in both browser (uses document.cookie) and Node.js (in-memory store)
// Implements OWASP secure cookie best practices: Secure, SameSite=Strict, Path
// ============================================================================
(function (root) {
  'use strict';

  // --------------------------------------------------------------------------
  // Environment detection
  // --------------------------------------------------------------------------
  const hasDocument = typeof document !== 'undefined' && document !== null;
  const isBrowser = hasDocument && typeof document.cookie === 'string';
  const isSecureContext = (function () {
    if (!isBrowser) return false;
    try {
      if (typeof window !== 'undefined' && window.isSecureContext) return true;
      if (typeof location !== 'undefined' && location.protocol === 'https:') return true;
    } catch (e) { /* ignore */ }
    return false;
  })();

  // --------------------------------------------------------------------------
  // Node.js in-memory store (only used when document.cookie is unavailable)
  // --------------------------------------------------------------------------
  const _nodeStore = new Map();
  const _nodeMeta = new Map();

  // --------------------------------------------------------------------------
  // Public constants
  // --------------------------------------------------------------------------
  const COOKIE_CATEGORIES = Object.freeze({
    ESSENTIAL: 'essential',
    ANALYTICS: 'analytics',
    MARKETING: 'marketing',
    PREFERENCE: 'preference'
  });

  const DEFAULT_SECURE_OPTIONS = Object.freeze({
    path: '/',
    sameSite: 'Strict',
    secure: true,
    httpOnly: false,
    category: COOKIE_CATEGORIES.ESSENTIAL
  });

  const COOKIE_NAMES = Object.freeze({
    CONSENT: 'smpin_consent',
    THEME: 'smpin_theme',
    LANGUAGE: 'smpin_lang',
    SESSION: 'smpin_sid',
    SESSION_ACTIVITY: 'smpin_sa',
    FIRST_VISIT: 'smpin_fv'
  });

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------
  function isValidName(name) {
    return typeof name === 'string' && /^[a-zA-Z0-9_\-]{1,128}$/.test(name);
  }

  function encodeValue(value) {
    if (value === null || value === undefined) return '';
    return encodeURIComponent(String(value));
  }

  function decodeValue(value) {
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  }

  function toGMTString(date) {
    return date.toUTCString();
  }

  function buildCookieString(name, value, days, options) {
    const opts = Object.assign({}, DEFAULT_SECURE_OPTIONS, options || {});
    const encodedValue = encodeValue(value);
    let str = name + '=' + encodedValue;

    if (typeof days === 'number' && isFinite(days) && days > 0) {
      const expires = new Date(Date.now() + days * 86400000);
      str += '; Expires=' + toGMTString(expires);
    } else if (days === 0 || days === null) {
      str += '; Max-Age=0';
    }

    str += '; Path=' + opts.path;
    if (opts.secure || isSecureContext) str += '; Secure';
    if (opts.httpOnly) str += '; HttpOnly';
    if (opts.sameSite) str += '; SameSite=' + opts.sameSite;
    return str;
  }

  function parseBrowserCookieString(cookieStr, name) {
    if (!cookieStr) return null;
    const parts = cookieStr.split(';');
    for (let i = 0; i < parts.length; i++) {
      const trimmed = parts[i].trim();
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.substring(0, eq);
      if (key === name) {
        return decodeValue(trimmed.substring(eq + 1));
      }
    }
    return null;
  }

  function parseAllBrowserCookies(cookieStr) {
    const out = {};
    if (!cookieStr) return out;
    const parts = cookieStr.split(';');
    for (let i = 0; i < parts.length; i++) {
      const trimmed = parts[i].trim();
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.substring(0, eq);
      if (!key) continue;
      out[key] = decodeValue(trimmed.substring(eq + 1));
    }
    return out;
  }

  // --------------------------------------------------------------------------
  // createCookie(name, value, days, options?)
  // --------------------------------------------------------------------------
  function createCookie(name, value, days, options) {
    if (!isValidName(name)) {
      throw new TypeError('Invalid cookie name: ' + name);
    }
    if (value === undefined || value === null) {
      throw new TypeError('Cookie value is required');
    }
    if (days !== undefined && days !== null && (typeof days !== 'number' || !isFinite(days))) {
      throw new TypeError('days must be a number');
    }

    const opts = Object.assign({}, DEFAULT_SECURE_OPTIONS, options || {});

    if (isBrowser) {
      const cookieStr = buildCookieString(name, value, days, opts);
      document.cookie = cookieStr;
    }

    _nodeStore.set(name, encodeValue(value));
    _nodeMeta.set(name, {
      value: encodeValue(value),
      days: (typeof days === 'number') ? days : null,
      category: opts.category || COOKIE_CATEGORIES.ESSENTIAL,
      sameSite: opts.sameSite,
      secure: !!(opts.secure || isSecureContext),
      httpOnly: !!opts.httpOnly,
      path: opts.path,
      createdAt: Date.now()
    });
    return true;
  }

  // --------------------------------------------------------------------------
  // getCookie(name)
  // --------------------------------------------------------------------------
  function getCookie(name) {
    if (!isValidName(name)) return null;
    if (isBrowser) {
      return parseBrowserCookieString(document.cookie, name);
    }
    if (!_nodeStore.has(name)) return null;
    return decodeValue(_nodeStore.get(name));
  }

  // --------------------------------------------------------------------------
  // updateCookie(name, value, days?, options?)
  // --------------------------------------------------------------------------
  function updateCookie(name, value, days, options) {
    if (!isValidName(name)) {
      throw new TypeError('Invalid cookie name: ' + name);
    }
    if (!_nodeStore.has(name) && (isBrowser ? !parseBrowserCookieString(document.cookie, name) : true)) {
      throw new Error('Cookie does not exist: ' + name);
    }
    return createCookie(name, value, days, options);
  }

  // --------------------------------------------------------------------------
  // deleteCookie(name, path?)
  // --------------------------------------------------------------------------
  function deleteCookie(name, path) {
    if (!isValidName(name)) {
      throw new TypeError('Invalid cookie name: ' + name);
    }
    const pathOpt = path || '/';

    if (isBrowser) {
      const cookieStr = name + '=; Path=' + pathOpt + '; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Strict';
      document.cookie = cookieStr;
      const cookieStr2 = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Strict';
      document.cookie = cookieStr2;
    }
    _nodeStore.delete(name);
    _nodeMeta.delete(name);
    return true;
  }

  // --------------------------------------------------------------------------
  // hasCookie(name)
  // --------------------------------------------------------------------------
  function hasCookie(name) {
    if (!isValidName(name)) return false;
    if (isBrowser) {
      return parseBrowserCookieString(document.cookie, name) !== null;
    }
    return _nodeStore.has(name);
  }

  // --------------------------------------------------------------------------
  // getAllCookies() - returns { name: value }
  // --------------------------------------------------------------------------
  function getAllCookies() {
    if (isBrowser) {
      return parseAllBrowserCookies(document.cookie);
    }
    const out = {};
    _nodeStore.forEach(function (v, k) {
      out[k] = decodeValue(v);
    });
    return out;
  }

  // --------------------------------------------------------------------------
  // getCookieMetadata(name) - returns { name, value, category, sameSite, secure, httpOnly, expiresAt }
  // --------------------------------------------------------------------------
  function getCookieMetadata(name) {
    if (!isValidName(name)) return null;
    const meta = _nodeMeta.get(name);
    if (!meta) {
      const value = getCookie(name);
      if (value === null) return null;
      return {
        name: name,
        value: value,
        category: COOKIE_CATEGORIES.ESSENTIAL,
        sameSite: DEFAULT_SECURE_OPTIONS.sameSite,
        secure: isSecureContext,
        httpOnly: false,
        path: DEFAULT_SECURE_OPTIONS.path,
        createdAt: null,
        expiresAt: null
      };
    }
    const expiresAt = (meta.days && meta.days > 0) ? new Date(meta.createdAt + meta.days * 86400000) : null;
    return Object.assign({}, meta, { name: name, expiresAt: expiresAt });
  }

  // --------------------------------------------------------------------------
  // getAllCookiesWithMetadata() - returns array of metadata objects
  // --------------------------------------------------------------------------
  function getAllCookiesWithMetadata() {
    const all = getAllCookies();
    const list = [];
    Object.keys(all).forEach(function (name) {
      const meta = getCookieMetadata(name);
      if (meta) list.push(meta);
    });
    return list;
  }

  // --------------------------------------------------------------------------
  // clearAll() - removes all cookies (used for testing/dev)
  // --------------------------------------------------------------------------
  function clearAll() {
    const names = Object.keys(getAllCookies());
    names.forEach(function (n) { deleteCookie(n); });
    _nodeStore.clear();
    _nodeMeta.clear();
    return names.length;
  }

  // --------------------------------------------------------------------------
  // _resetStore() - internal: only for testing
  // --------------------------------------------------------------------------
  function _resetStore() {
    _nodeStore.clear();
    _nodeMeta.clear();
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------
  const api = {
    createCookie: createCookie,
    getCookie: getCookie,
    updateCookie: updateCookie,
    deleteCookie: deleteCookie,
    hasCookie: hasCookie,
    getAllCookies: getAllCookies,
    getAllCookiesWithMetadata: getAllCookiesWithMetadata,
    getCookieMetadata: getCookieMetadata,
    clearAll: clearAll,
    _resetStore: _resetStore,
    COOKIE_CATEGORIES: COOKIE_CATEGORIES,
    COOKIE_NAMES: COOKIE_NAMES,
    DEFAULT_SECURE_OPTIONS: DEFAULT_SECURE_OPTIONS,
    isBrowser: isBrowser,
    isSecureContext: isSecureContext
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.CookieUtils = api;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.CookieUtils = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
