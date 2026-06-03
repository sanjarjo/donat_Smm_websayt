// ============================================================================
// auth-ui.js - Shared authentication UI for ALL pages
// Detects login state, renders the right header/nav, and exposes a global
// `window.SMPIN_AUTH` API. Loaded by every page that has a .header-actions
// element (i.e. every public page).
// ============================================================================
(function () {
  'use strict';

  const AUTH_CACHE_MS = 5000; // avoid hammering /api/user
  let _cachedUser = null;
  let _cachedAt = 0;
  let _inflight = null;

  function escapeText(s) {
    if (s == null) return '';
    return String(s);
  }

  function getCsrfToken() {
    return fetch('/api/csrf-token', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (j) { return j.csrfToken || ''; })
      .catch(function () { return ''; });
  }

  function logout() {
    return getCsrfToken().then(function (csrfToken) {
      return fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        credentials: 'same-origin',
        body: JSON.stringify({ _csrf: csrfToken })
      });
    }).catch(function () { return null; });
  }

  function fetchUser(force) {
    if (_inflight) return _inflight;
    if (!force && _cachedUser && (Date.now() - _cachedAt) < AUTH_CACHE_MS) {
      return Promise.resolve(_cachedUser);
    }
    _inflight = fetch('/api/user', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { user: null }; })
      .then(function (data) {
        _cachedUser = (data && data.user) || null;
        _cachedAt = Date.now();
        return _cachedUser;
      })
      .catch(function () { return null; })
      .then(function (u) {
        _inflight = null;
        return u;
      });
    return _inflight;
  }

  function clearCache() {
    _cachedUser = null;
    _cachedAt = 0;
  }

  // --------------------------------------------------------------------------
  // Render helpers
  // --------------------------------------------------------------------------
  function renderLoggedInHeader(user, desktopContainer, mobileContainer) {
    const initial = (user.full_name || user.email || 'U').charAt(0).toUpperCase();
    const displayName = user.full_name || user.email || 'Foydalanuvchi';
    const balanceText = (user.balance || 0).toLocaleString() + " so'm";

    if (desktopContainer) {
      desktopContainer.textContent = '';
      const wrap = document.createElement('div');
      wrap.className = 'user-profile';

      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.id = 'avatarBtn';
      avatar.textContent = initial;
      avatar.setAttribute('aria-label', displayName);

      const dropdown = document.createElement('div');
      dropdown.className = 'profile-dropdown';
      dropdown.id = 'profileDropdown';

      const headerEl = document.createElement('div');
      headerEl.className = 'dropdown-header';
      const nameEl = document.createElement('strong');
      nameEl.textContent = displayName;
      const balanceEl = document.createElement('span');
      balanceEl.textContent = balanceText;
      headerEl.appendChild(nameEl);
      headerEl.appendChild(balanceEl);

      const dashLink = document.createElement('a');
      dashLink.href = 'dashboard.html';
      dashLink.className = 'dropdown-item';
      dashLink.textContent = '📊 Dashboard';

      const profileLink = document.createElement('a');
      profileLink.href = 'profile.html';
      profileLink.className = 'dropdown-item';
      profileLink.textContent = '👤 Profil';

      const ordersLink = document.createElement('a');
      ordersLink.href = 'order-history.html';
      ordersLink.className = 'dropdown-item';
      ordersLink.textContent = '📋 Buyurtmalar';

      const notifsLink = document.createElement('a');
      notifsLink.href = 'notifications.html';
      notifsLink.className = 'dropdown-item';
      notifsLink.textContent = '🔔 Bildirishnomalar';

      const logoutBtn = document.createElement('button');
      logoutBtn.className = 'dropdown-item text-danger';
      logoutBtn.id = 'logoutBtn';
      logoutBtn.textContent = '🚪 Chiqish';

      dropdown.appendChild(headerEl);
      dropdown.appendChild(dashLink);
      dropdown.appendChild(profileLink);
      dropdown.appendChild(ordersLink);
      dropdown.appendChild(notifsLink);
      dropdown.appendChild(logoutBtn);

      wrap.appendChild(avatar);
      wrap.appendChild(dropdown);
      desktopContainer.appendChild(wrap);

      avatar.addEventListener('click', function (ev) {
        ev.stopPropagation();
        dropdown.classList.toggle('active');
      });
      logoutBtn.addEventListener('click', function (ev) {
        ev.preventDefault();
        logout().finally(function () {
          clearCache();
          window.location.href = 'index.html';
        });
      });
    }

    if (mobileContainer) {
      mobileContainer.textContent = '';
      const dashLink = document.createElement('a');
      dashLink.href = 'dashboard.html';
      dashLink.className = 'btn-primary w100 text-center';
      dashLink.style.display = 'block';
      dashLink.style.marginBottom = '10px';
      dashLink.textContent = '📊 Dashboard';

      const profileLink = document.createElement('a');
      profileLink.href = 'profile.html';
      profileLink.className = 'btn-outline w100 text-center';
      profileLink.style.display = 'block';
      profileLink.style.marginBottom = '10px';
      profileLink.textContent = '👤 Profil';

      const logoutBtn = document.createElement('button');
      logoutBtn.className = 'btn-outline w100 text-danger';
      logoutBtn.id = 'mobileLogoutBtn';
      logoutBtn.textContent = '🚪 Chiqish';

      mobileContainer.appendChild(dashLink);
      mobileContainer.appendChild(profileLink);
      mobileContainer.appendChild(logoutBtn);
      logoutBtn.addEventListener('click', function () {
        logout().finally(function () {
          clearCache();
          window.location.href = 'index.html';
        });
      });
    }
  }

  function bindOutsideClick() {
    window.addEventListener('click', function (e) {
      const dropdown = document.getElementById('profileDropdown');
      if (dropdown && dropdown.classList.contains('active') && !e.target.closest('.user-profile')) {
        dropdown.classList.remove('active');
      }
    });
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------
  function init(opts) {
    opts = opts || {};
    const requireAuth = !!opts.requireAuth;
    const redirectTo = opts.redirectTo || 'index.html';

    const desktop = document.querySelector('.header-actions');
    const mobile = document.querySelector('.mn-actions');
    // Some pages have no mobile nav; bail silently.

    fetchUser().then(function (user) {
      if (!user) {
        if (requireAuth) {
          window.location.href = redirectTo;
          return;
        }
        // Guest — leave default Login/Register buttons in place (or no-op if missing).
        return;
      }
      renderLoggedInHeader(user, desktop, mobile);
    }).catch(function () {
      if (requireAuth) window.location.href = redirectTo;
    });
  }

  // Logout helpers (used by other inline scripts).
  function doLogout(redirect) {
    return logout().finally(function () {
      clearCache();
      window.location.href = redirect || 'index.html';
    });
  }

  window.SMPIN_AUTH = {
    init: init,
    fetchUser: fetchUser,
    clearCache: clearCache,
    logout: doLogout,
    getCsrfToken: getCsrfToken,
    renderLoggedInHeader: renderLoggedInHeader
  };

  // Auto-init if a marker element exists. Pages can opt into requireAuth via
  // <body data-require-auth="1"> or by calling SMPIN_AUTH.init({ requireAuth: true }).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      const requireAuth = document.body && document.body.dataset && document.body.dataset.requireAuth === '1';
      init({ requireAuth: requireAuth });
      bindOutsideClick();
    });
  } else {
    const requireAuth = document.body && document.body.dataset && document.body.dataset.requireAuth === '1';
    init({ requireAuth: requireAuth });
    bindOutsideClick();
  }
})();
