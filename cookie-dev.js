// ============================================================================
// cookie-dev.js - Developer testing page logic
// ============================================================================
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  const U = window.CookieUtils;
  const $ = function (id) { return document.getElementById(id); };

  // --------------------------------------------------------------------------
  // Render cookie table
  // --------------------------------------------------------------------------
  function renderTable() {
    const container = $('cookieTableContainer');
    const list = U.getAllCookiesWithMetadata();

    if (!list || list.length === 0) {
      container.innerHTML = '<div class="empty">Hech qanday cookie topilmadi.</div>';
      return;
    }

    const rows = list.map(function (c) {
      const expires = c.expiresAt ? c.expiresAt.toISOString() : 'session';
      const safeValue = String(c.value).replace(/[<>&]/g, function (ch) {
        return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch];
      });
      const flags = [];
      if (c.secure) flags.push('Secure');
      if (c.httpOnly) flags.push('HttpOnly');
      if (c.sameSite) flags.push('SameSite=' + c.sameSite);
      return `<tr>
        <td><code>${c.name}</code></td>
        <td><code>${safeValue.length > 60 ? safeValue.substring(0, 60) + '…' : safeValue}</code></td>
        <td>${c.category || '—'}</td>
        <td>${expires}</td>
        <td style="font-size:11.5px; color:var(--cc-muted);">${flags.join(', ') || '—'}</td>
        <td>
          <button class="btn-del" data-name="${c.name}" style="font-size:11px; padding:3px 8px; border-radius:6px; border:1px solid var(--cc-border); background:transparent; color:#ef4444; cursor:pointer;">O'chirish</button>
        </td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Nomi</th>
            <th>Qiymati</th>
            <th>Toifa</th>
            <th>Muddati</th>
            <th>Bayroqlar</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    container.querySelectorAll('.btn-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        U.deleteCookie(btn.getAttribute('data-name'));
        renderAll();
      });
    });
  }

  // --------------------------------------------------------------------------
  // Stats summary
  // --------------------------------------------------------------------------
  function renderStats() {
    const cookies = U.getAllCookies();
    const names = Object.keys(cookies);
    $('statTotal').textContent = names.length + ' ta';

    const consent = window.CookieConsent && window.CookieConsent.getConsent();
    $('statConsent').textContent = consent ? '✓ berilgan' : '✗ berilmagan';

    const theme = window.CookieTheme && window.CookieTheme.getTheme();
    $('statTheme').textContent = theme || '—';

    const lang = window.CookieLanguage && window.CookieLanguage.getLanguage();
    $('statLang').textContent = lang || '—';

    const sess = window.CookieSession && window.CookieSession.getSession();
    $('statSession').textContent = sess && sess.id ? sess.id.substring(0, 8) + '…' : '—';

    const info = {
      sessionId: sess ? sess.id : null,
      lastActivity: sess ? new Date(sess.lastActivity).toISOString() : null,
      idleSeconds: window.CookieSession ? Math.round((window.CookieSession.getIdleMs() || 0) / 1000) : null,
      sessionExpired: window.CookieSession ? window.CookieSession.isExpired() : null,
      expiryDays: window.CookieSession ? window.CookieSession.SESSION_EXPIRY_DAYS : null
    };
    $('sessionInfo').textContent = JSON.stringify(info, null, 2);
  }

  function renderAll() {
    renderTable();
    renderStats();
  }

  // --------------------------------------------------------------------------
  // Console capture
  // --------------------------------------------------------------------------
  let consoleBuffer = [];
  function appendLine(text, cls) {
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = text + '\n';
    $('testOutput').appendChild(span);
    $('testOutput').scrollTop = $('testOutput').scrollHeight;
    consoleBuffer.push({ text: text, cls: cls });
  }

  function clearOutput() {
    $('testOutput').textContent = '';
    $('testReport').textContent = '';
    consoleBuffer = [];
  }

  function captureConsole(fn) {
    const origLog = console.log;
    const origInfo = console.info;
    const origWarn = console.warn;
    const origError = console.error;
    console.log = function () {
      const args = Array.prototype.slice.call(arguments);
      appendLine(args.join(' '), 'info');
      origLog.apply(console, args);
    };
    console.info = function () {
      const args = Array.prototype.slice.call(arguments);
      appendLine(args.join(' '), 'info');
      origInfo.apply(console, args);
    };
    console.warn = function () {
      const args = Array.prototype.slice.call(arguments);
      appendLine(args.join(' '), 'warn');
      origWarn.apply(console, args);
    };
    console.error = function () {
      const args = Array.prototype.slice.call(arguments);
      appendLine(args.join(' '), 'fail');
      origError.apply(console, args);
    };
    return function () {
      console.log = origLog;
      console.info = origInfo;
      console.warn = origWarn;
      console.error = origError;
    };
  }

  // --------------------------------------------------------------------------
  // Browser test runner (mirrors the Node test suite)
  // --------------------------------------------------------------------------
  function runBrowserTests() {
    clearOutput();
    appendLine('========== COOKIE SYSTEM TEST SUITE (Browser) ==========', 'info');
    appendLine('Environment: ' + (U.isBrowser ? 'Browser' : 'Node-like'), 'info');
    appendLine('Secure context: ' + U.isSecureContext, 'info');
    appendLine('', 'info');

    const results = [];
    function test(name, fn) {
      try {
        U._resetStore();
        const ok = fn();
        if (ok === false) {
          appendLine('✗ ' + name + ' test failed', 'fail');
          results.push({ name: name, ok: false, error: 'Returned false' });
        } else {
          appendLine('✓ ' + name + ' test passed', 'ok');
          results.push({ name: name, ok: true });
        }
      } catch (e) {
        appendLine('✗ ' + name + ' test failed: ' + e.message, 'fail');
        results.push({ name: name, ok: false, error: e.message });
      }
    }

    test('Cookie creation', function () {
      U.createCookie('test_create', 'value1', 7);
      const v = U.getCookie('test_create');
      if (v !== 'value1') throw new Error('Value mismatch: ' + v);
      return true;
    });

    test('Cookie read', function () {
      U.createCookie('test_read', 'readvalue', 7);
      const v = U.getCookie('test_read');
      if (v !== 'readvalue') throw new Error('Got: ' + v);
      const none = U.getCookie('non_existent_cookie_xyz');
      if (none !== null) throw new Error('Expected null for missing cookie');
      return true;
    });

    test('Cookie update', function () {
      U.createCookie('test_update', 'initial', 7);
      U.updateCookie('test_update', 'updated', 7);
      const v = U.getCookie('test_update');
      if (v !== 'updated') throw new Error('Got: ' + v);
      return true;
    });

    test('Cookie delete', function () {
      U.createCookie('test_delete', 'bye', 7);
      if (!U.hasCookie('test_delete')) throw new Error('Cookie not created');
      U.deleteCookie('test_delete');
      if (U.hasCookie('test_delete')) throw new Error('Cookie still present after delete');
      return true;
    });

    test('Cookie consent persistence', function () {
      U._resetStore();
      const prefs = { essential: true, analytics: true, marketing: false, preference: true };
      window.CookieConsent.saveConsent(prefs);
      const c = window.CookieConsent.getConsent();
      if (!c) throw new Error('No consent returned');
      if (c.analytics !== true) throw new Error('Analytics not saved');
      if (c.marketing !== false) throw new Error('Marketing not saved');
      if (c.preference !== true) throw new Error('Preference not saved');
      if (c.essential !== true) throw new Error('Essential should be true');
      return true;
    });

    test('Theme persistence', function () {
      U._resetStore();
      window.CookieTheme.setTheme('dark');
      if (window.CookieTheme.getTheme() !== 'dark') throw new Error('Dark not set');
      window.CookieTheme.setTheme('light');
      if (window.CookieTheme.getTheme() !== 'light') throw new Error('Light not set');
      return true;
    });

    test('Language persistence', function () {
      U._resetStore();
      window.CookieLanguage.setLanguage('ru');
      if (window.CookieLanguage.getLanguage() !== 'ru') throw new Error('RU not set');
      window.CookieLanguage.setLanguage('en');
      if (window.CookieLanguage.getLanguage() !== 'en') throw new Error('EN not set');
      window.CookieLanguage.setLanguage('uz');
      if (window.CookieLanguage.getLanguage() !== 'uz') throw new Error('UZ not set');
      return true;
    });

    test('Session cookie functionality', function () {
      U._resetStore();
      const id = window.CookieSession.createSession();
      if (!id || id.length < 16) throw new Error('Session id too short: ' + id);
      const s = window.CookieSession.getSession();
      if (s.id !== id) throw new Error('Session id mismatch');
      if (s.lastActivity <= 0) throw new Error('Activity not tracked');
      window.CookieSession.destroySession();
      if (U.hasCookie(U.COOKIE_NAMES.SESSION)) throw new Error('Session not destroyed');
      return true;
    });

    // Report
    const total = results.length;
    const passed = results.filter(function (r) { return r.ok; }).length;
    const failed = total - passed;
    const rate = total ? Math.round((passed / total) * 100) : 0;

    appendLine('', 'info');
    appendLine('===================================', 'info');
    appendLine('COOKIE SYSTEM TEST REPORT', 'info');
    appendLine('===================================', 'info');
    appendLine('Total Tests: ' + total, 'info');
    appendLine('Passed: ' + passed, passed === total ? 'ok' : 'info');
    appendLine('Failed: ' + failed, failed === 0 ? 'ok' : 'fail');
    appendLine('Success Rate: ' + rate + '%', rate === 100 ? 'ok' : 'warn');
    appendLine('===================================', 'info');

    const report = $('testReport');
    if (failed === 0) {
      report.innerHTML = '<div class="pill" style="background:rgba(34,197,94,0.15); color:#16a34a; border-color:rgba(34,197,94,0.3);">✓ Barcha testlar muvaffaqiyatli o\'tdi</div>';
    } else {
      report.innerHTML = '<div class="pill" style="background:rgba(239,68,68,0.15); color:#ef4444; border-color:rgba(239,68,68,0.3);">✗ ' + failed + ' ta test muvaffaqiyatsiz</div>';
    }
    renderAll();
  }

  // --------------------------------------------------------------------------
  // Event wiring
  // --------------------------------------------------------------------------
  function wireEvents() {
    $('btnRefresh').addEventListener('click', renderAll);
    $('btnRunTests').addEventListener('click', runBrowserTests);
    $('btnOpenSettings').addEventListener('click', function () { window.CookieConsent.showSettings(); });
    $('btnShowBanner').addEventListener('click', function () { window.CookieConsent.showBanner(); });
    $('btnClearAll').addEventListener('click', function () {
      if (confirm('Barcha cookie\'larni o\'chirmoqchimisiz?')) {
        U.clearAll();
        window.CookieSession.ensureSession();
        renderAll();
      }
    });

    $('btnCreate').addEventListener('click', function () {
      try {
        U.createCookie($('qcName').value, $('qcValue').value, parseInt($('qcDays').value, 10));
        $('qcResult').textContent = 'OK: yaratildi';
        renderAll();
      } catch (e) { $('qcResult').textContent = 'Xato: ' + e.message; }
    });
    $('btnRead').addEventListener('click', function () {
      $('qcResult').textContent = 'Qiymat: ' + U.getCookie($('qcName').value);
    });
    $('btnUpdate').addEventListener('click', function () {
      try {
        U.updateCookie($('qcName').value, $('qcValue').value, parseInt($('qcDays').value, 10));
        $('qcResult').textContent = 'OK: yangilandi';
        renderAll();
      } catch (e) { $('qcResult').textContent = 'Xato: ' + e.message; }
    });
    $('btnDelete').addEventListener('click', function () {
      U.deleteCookie($('qcName').value);
      $('qcResult').textContent = 'OK: o\'chirildi';
      renderAll();
    });

    $('btnThemeLight').addEventListener('click', function () { window.CookieTheme.setTheme('light'); renderAll(); });
    $('btnThemeDark').addEventListener('click', function () { window.CookieTheme.setTheme('dark'); renderAll(); });
    $('btnThemeToggle').addEventListener('click', function () { window.CookieTheme.toggleTheme(); renderAll(); });
    document.querySelectorAll('[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.CookieLanguage.setLanguage(btn.getAttribute('data-lang'));
        renderAll();
      });
    });

    $('btnRegenSession').addEventListener('click', function () {
      window.CookieSession.createSession();
      renderAll();
    });
    $('btnDestroySession').addEventListener('click', function () {
      window.CookieSession.destroySession();
      renderAll();
    });
  }

  function init() {
    wireEvents();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
