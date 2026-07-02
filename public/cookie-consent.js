// ============================================================================
// cookie-consent.js - Cookie consent banner + settings modal
// Manages user consent for Essential, Analytics, Marketing, Preference cookies
// ============================================================================
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (!window.CookieUtils) {
    console.error('[CookieConsent] CookieUtils not loaded. Include cookie-utils.js first.');
    return;
  }

  const U = window.CookieUtils;
  const CONSENT_COOKIE = U.COOKIE_NAMES.CONSENT;
  const FIRST_VISIT_COOKIE = U.COOKIE_NAMES.FIRST_VISIT;
  const CONSENT_VERSION = '1.0.0';
  const CONSENT_EXPIRY_DAYS = 365;

  const DEFAULT_PREFERENCES = {
    essential: true,    // always on
    analytics: false,
    marketing: false,
    preference: false,
    timestamp: 0,
    version: CONSENT_VERSION
  };

  // --------------------------------------------------------------------------
  // Storage (with consent state)
  // --------------------------------------------------------------------------
  function getConsent() {
    const raw = U.getCookie(CONSENT_COOKIE);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      parsed.essential = true; // essential cookies always enabled
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(prefs) {
    const merged = Object.assign({}, DEFAULT_PREFERENCES, prefs, {
      essential: true,
      timestamp: Date.now(),
      version: CONSENT_VERSION
    });
    U.createCookie(CONSENT_COOKIE, JSON.stringify(merged), CONSENT_EXPIRY_DAYS, {
      path: '/',
      sameSite: 'Strict',
      secure: U.isSecureContext,
      category: U.COOKIE_CATEGORIES.ESSENTIAL
    });
    // Mark that the user has visited at least once
    if (!U.getCookie(FIRST_VISIT_COOKIE)) {
      U.createCookie(FIRST_VISIT_COOKIE, '1', CONSENT_EXPIRY_DAYS, {
        path: '/',
        sameSite: 'Strict',
        secure: U.isSecureContext,
        category: U.COOKIE_CATEGORIES.ESSENTIAL
      });
    }
    document.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: merged }));
    return merged;
  }

  function hasConsent() {
    return getConsent() !== null;
  }

  function isCategoryAllowed(category) {
    const consent = getConsent();
    if (!consent) return category === U.COOKIE_CATEGORIES.ESSENTIAL;
    return !!consent[category];
  }

  // --------------------------------------------------------------------------
  // Banner UI
  // --------------------------------------------------------------------------
  function ensureBanner() {
    if (document.getElementById('cookieConsentBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'cookieConsentBanner';
    banner.className = 'cc-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML = `
      <div class="cc-banner-inner">
        <div class="cc-banner-text">
          <div class="cc-banner-title">🍪 Cookie foydalanamiz</div>
          <p class="cc-banner-desc">
            Sizning tajribangizni yaxshilash uchun cookie fayllaridan foydalanamiz.
            Faqat zarur cookie-lar yoqilgan. Qolganlarini xohishingizga ko'ra yoqishingiz yoki o'chirishingiz mumkin.
            <a href="#" class="cc-banner-link" data-action="open-settings">Sozlamalar</a>
          </p>
        </div>
        <div class="cc-banner-actions">
          <button type="button" class="cc-btn cc-btn-ghost" data-action="reject">Faqat zarurlari</button>
          <button type="button" class="cc-btn cc-btn-outline" data-action="open-settings">Sozlamalar</button>
          <button type="button" class="cc-btn cc-btn-primary" data-action="accept-all">Hammasini qabul qilish</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);
  }

  function showBanner() {
    ensureBanner();
    requestAnimationFrame(function () {
      const b = document.getElementById('cookieConsentBanner');
      if (b) b.classList.add('cc-visible');
    });
  }

  function hideBanner() {
    const b = document.getElementById('cookieConsentBanner');
    if (b) b.classList.remove('cc-visible');
  }

  // --------------------------------------------------------------------------
  // Settings modal
  // --------------------------------------------------------------------------
  function ensureSettingsModal() {
    if (document.getElementById('cookieSettingsModal')) return;
    const modal = document.createElement('div');
    modal.id = 'cookieSettingsModal';
    modal.className = 'cc-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Cookie sozlamalari');
    modal.innerHTML = `
      <div class="cc-modal-backdrop" data-action="close"></div>
      <div class="cc-modal-box">
        <div class="cc-modal-head">
          <h3>Cookie sozlamalari</h3>
          <button class="cc-modal-close" data-action="close" aria-label="Yopish">✕</button>
        </div>
        <div class="cc-modal-body">
          <p class="cc-modal-desc">Quyidagi toifalardan qaysi cookie-larni yoqishni xohlayotganingizni tanlang.</p>
          <div class="cc-category" data-cat="essential">
            <div class="cc-category-head">
              <div>
                <div class="cc-cat-title">Zarur cookie-lar</div>
                <div class="cc-cat-desc">Sayt ishlashi uchun zarur. O'chirib bo'lmaydi.</div>
              </div>
              <label class="cc-switch cc-switch-locked">
                <input type="checkbox" checked disabled />
                <span class="cc-switch-slider"></span>
              </label>
            </div>
          </div>
          <div class="cc-category" data-cat="analytics">
            <div class="cc-category-head">
              <div>
                <div class="cc-cat-title">Analitika cookie-lari</div>
                <div class="cc-cat-desc">Sayt statistikasi va foydalanuvchi tajribasini yaxshilash.</div>
              </div>
              <label class="cc-switch">
                <input type="checkbox" data-cat="analytics" />
                <span class="cc-switch-slider"></span>
              </label>
            </div>
          </div>
          <div class="cc-category" data-cat="marketing">
            <div class="cc-category-head">
              <div>
                <div class="cc-cat-title">Marketing cookie-lari</div>
                <div class="cc-cat-desc">Reklama va takliflarni shaxsiylashtirish.</div>
              </div>
              <label class="cc-switch">
                <input type="checkbox" data-cat="marketing" />
                <span class="cc-switch-slider"></span>
              </label>
            </div>
          </div>
          <div class="cc-category" data-cat="preference">
            <div class="cc-category-head">
              <div>
                <div class="cc-cat-title">Afzallik cookie-lari</div>
                <div class="cc-cat-desc">Til, mavzu va boshqa sozlamalarni eslab qolish.</div>
              </div>
              <label class="cc-switch">
                <input type="checkbox" data-cat="preference" />
                <span class="cc-switch-slider"></span>
              </label>
            </div>
          </div>
        </div>
        <div class="cc-modal-foot">
          <button class="cc-btn cc-btn-ghost" data-action="reject">Faqat zarurlari</button>
          <button class="cc-btn cc-btn-outline" data-action="save">Tanlanganlarni saqlash</button>
          <button class="cc-btn cc-btn-primary" data-action="accept-all">Hammasini qabul qilish</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function showSettings() {
    ensureSettingsModal();
    const consent = getConsent() || DEFAULT_PREFERENCES;
    const modal = document.getElementById('cookieSettingsModal');
    modal.querySelectorAll('input[type="checkbox"][data-cat]').forEach(function (cb) {
      cb.checked = !!consent[cb.getAttribute('data-cat')];
    });
    modal.classList.add('cc-visible');
  }

  function hideSettings() {
    const modal = document.getElementById('cookieSettingsModal');
    if (modal) modal.classList.remove('cc-visible');
  }

  function readSettingsFromModal() {
    const modal = document.getElementById('cookieSettingsModal');
    if (!modal) return null;
    const prefs = { essential: true };
    modal.querySelectorAll('input[type="checkbox"][data-cat]').forEach(function (cb) {
      prefs[cb.getAttribute('data-cat')] = cb.checked;
    });
    return prefs;
  }

  // --------------------------------------------------------------------------
  // Event wiring
  // --------------------------------------------------------------------------
  function handleAction(action, ev) {
    if (ev) ev.preventDefault();
    if (action === 'accept-all') {
      saveConsent({ analytics: true, marketing: true, preference: true });
      hideSettings();
      hideBanner();
    } else if (action === 'reject') {
      saveConsent({ analytics: false, marketing: false, preference: false });
      hideSettings();
      hideBanner();
    } else if (action === 'open-settings') {
      showSettings();
    } else if (action === 'save') {
      const prefs = readSettingsFromModal();
      if (prefs) saveConsent(prefs);
      hideSettings();
      hideBanner();
    } else if (action === 'close') {
      hideSettings();
    }
  }

  function bindEvents() {
    document.addEventListener('click', function (ev) {
      const target = ev.target.closest('[data-action]');
      if (!target) return;
      const action = target.getAttribute('data-action');
      handleAction(action, ev);
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') hideSettings();
    });
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------
  function resetConsent() {
    U.deleteCookie(CONSENT_COOKIE);
    U.deleteCookie(FIRST_VISIT_COOKIE);
    showBanner();
  }

  function init() {
    bindEvents();
    if (!hasConsent()) {
      showBanner();
    } else {
      // Re-apply already-saved preferences by emitting the event
      const c = getConsent();
      if (c) document.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: c }));
    }
  }

  window.CookieConsent = {
    init: init,
    showBanner: showBanner,
    hideBanner: hideBanner,
    showSettings: showSettings,
    hideSettings: hideSettings,
    getConsent: getConsent,
    saveConsent: saveConsent,
    hasConsent: hasConsent,
    isCategoryAllowed: isCategoryAllowed,
    resetConsent: resetConsent,
    CONSENT_VERSION: CONSENT_VERSION
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
