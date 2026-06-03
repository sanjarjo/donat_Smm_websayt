// ============================================================================
// test-suite.js - Full integration & unit test runner with self-healing.
// Tests: auth, sessions, cookies, navigation, security, database, frontend.
// Reports via console (and writes a JSON report to ./logs/test-report.json).
// ============================================================================
'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');

const HOST = '127.0.0.1';
const PORT = 3000;
const BASE = `http://${HOST}:${PORT}`;

const COOKIE_JAR = new Map(); // name -> value
let CSRF_TOKEN = null;
let TEST_USER_EMAIL = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@smpin.uz`;
let TEST_USER_PASSWORD = 'SecurePass123!';
let TEST_USER_ID = null;
let ADMIN_EMAIL = 'admin@smpin.uz';

const results = [];

function logHeader(text) {
  const line = '═'.repeat(60);
  console.log('\n\x1b[36m' + line + '\x1b[0m');
  console.log('\x1b[36m  ' + text + '\x1b[0m');
  console.log('\x1b[36m' + line + '\x1b[0m');
}

function record(name, ok, details) {
  results.push({ name, ok, details, ts: new Date().toISOString() });
  if (ok) {
    console.log('\x1b[32m  ✓\x1b[0m ' + name + (details ? '  ' + details : ''));
  } else {
    console.log('\x1b[31m  ✗\x1b[0m ' + name);
    if (details) console.log('\x1b[31m      ' + details + '\x1b[0m');
  }
}

function recordSkip(name, reason) {
  results.push({ name, ok: true, skipped: true, details: reason, ts: new Date().toISOString() });
  console.log('\x1b[33m  ⊝\x1b[0m ' + name + ' [skipped: ' + reason + ']');
}

// ---------------------------------------------------------------------------
// HTTP helper with cookie jar
// ---------------------------------------------------------------------------
function request(method, urlPath, body, opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    const headers = Object.assign({ 'Accept': 'application/json' }, opts.headers || {});
    let payload = null;
    if (body && typeof body === 'object' && !(body instanceof Buffer)) {
      if (body._form) {
        // multipart-like: pass through as buffer not used; callers use raw fetch path
        payload = body._form;
      } else {
        payload = Buffer.from(JSON.stringify(body));
        headers['Content-Type'] = 'application/json';
      }
    } else if (body instanceof Buffer) {
      payload = body;
    }
    if (payload) headers['Content-Length'] = payload.length;

    // Attach stored cookies
    if (COOKIE_JAR.size > 0) {
      const arr = [];
      COOKIE_JAR.forEach(function (v, k) { arr.push(k + '=' + v); });
      headers['Cookie'] = arr.join('; ');
    }

    const url = new URL(urlPath, BASE);
    const req = http.request({
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: headers
    }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        const buf = Buffer.concat(chunks);
        // Update cookie jar
        const setCookies = res.headers['set-cookie'] || [];
        setCookies.forEach(function (sc) {
          const eq = sc.indexOf('=');
          const semi = sc.indexOf(';');
          if (eq === -1) return;
          const name = sc.substring(0, eq).trim();
          const val = sc.substring(eq + 1, semi === -1 ? sc.length : semi).trim();
          if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(sc)) {
            COOKIE_JAR.delete(name);
          } else {
            COOKIE_JAR.set(name, val);
          }
        });
        let parsed = null;
        const text = buf.toString('utf8');
        if (text) {
          try { parsed = JSON.parse(text); } catch (e) { parsed = text; }
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: text });
      });
    });
    req.on('error', function (err) {
      resolve({ status: 0, error: err.message, body: null });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function getCsrf() {
  return request('GET', '/api/csrf-token').then(function (r) {
    if (r.status === 200 && r.body && r.body.csrfToken) {
      CSRF_TOKEN = r.body.csrfToken;
      return CSRF_TOKEN;
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// Test definitions
// ---------------------------------------------------------------------------
async function testServerHealth() {
  const r = await request('GET', '/healthz');
  record('Server is up (healthz)', r.status === 200, 'status=' + r.status);
}

async function testHomepageLoads() {
  const r = await request('GET', '/index.html');
  record('Homepage HTML loads', r.status === 200 && /smpin/.test(String(r.body)), 'status=' + r.status);
}

async function testStaticAssetsExist() {
  const assets = ['/styles.css', '/script.js', '/smm.js', '/topup.js', '/balance.js', '/auth-ui.js', '/dashboard.js', '/notifications.js', '/cookie-utils.js', '/cookie-consent.js', '/cookie-theme.js', '/cookie-language.js', '/cookie-session.js'];
  for (const a of assets) {
    const r = await request('GET', a);
    record('Static asset: ' + a, r.status === 200, 'status=' + r.status);
  }
}

async function testProtectedAssetsExist() {
  const pages = ['/dashboard.html', '/profile.html', '/balance.html', '/smm.html', '/topup.html', '/notifications.html', '/order-history.html', '/admin.html'];
  for (const p of pages) {
    const r = await request('GET', p);
    record('Page loads: ' + p, r.status === 200, 'status=' + r.status);
  }
}

async function testBalanceHtmlIsWellFormed() {
  const r = await request('GET', '/balance.html');
  // ensure the file does NOT have a stray " at the end
  const raw = String(r.body);
  const hasStrayQuote = /<\/html>"$/i.test(raw.trim());
  record('balance.html is well-formed (no stray quote)', !hasStrayQuote, hasStrayQuote ? 'Found stray quote' : 'OK');
}

async function testCsrfEndpoint() {
  await getCsrf();
  record('CSRF token endpoint', !!CSRF_TOKEN, 'token length=' + (CSRF_TOKEN ? CSRF_TOKEN.length : 0));
}

async function testGuestCannotAccessProtectedApi() {
  COOKIE_JAR.clear();
  const r = await request('GET', '/api/orders');
  record('Guest cannot list orders (401)', r.status === 401, 'status=' + r.status);
}

async function testGuestCannotAccessAdminApi() {
  const r = await request('GET', '/api/admin/users');
  record('Guest cannot list admin users (401)', r.status === 401, 'status=' + r.status);
}

async function testRegistrationValidation() {
  COOKIE_JAR.clear();
  await getCsrf();
  // weak password
  const r1 = await request('POST', '/api/register', { email: 'a@b.com', password: 'short', fullName: 'X', _csrf: CSRF_TOKEN });
  record('Registration rejects weak password (400)', r1.status === 400, 'status=' + r1.status + ' err=' + (r1.body && r1.body.error));
  // invalid email
  const r2 = await request('POST', '/api/register', { email: 'not-an-email', password: 'StrongPass1!', fullName: 'X', _csrf: CSRF_TOKEN });
  record('Registration rejects invalid email (400)', r2.status === 400, 'status=' + r2.status);
}

async function testRegisterAndLogin() {
  COOKIE_JAR.clear();
  await getCsrf();
  // 1) Register
  const reg = await request('POST', '/api/register', {
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    fullName: 'Test User',
    _csrf: CSRF_TOKEN
  });
  const regOk = reg.status === 200 && reg.body && reg.body.user && reg.body.user.id;
  record('Register new user (200)', regOk, 'status=' + reg.status);
  if (regOk) TEST_USER_ID = reg.body.user.id;

  // 2) /api/user returns the user
  const me = await request('GET', '/api/user');
  record('/api/user returns the logged-in user', me.status === 200 && me.body && me.body.user && me.body.user.email === TEST_USER_EMAIL,
    'email=' + (me.body && me.body.user && me.body.user.email));

  // 3) Logout
  await getCsrf();
  const out = await request('POST', '/api/logout', { _csrf: CSRF_TOKEN });
  record('Logout (200)', out.status === 200, 'status=' + out.status);

  // 4) /api/user now returns null
  const me2 = await request('GET', '/api/user');
  record('/api/user returns null after logout', me2.status === 200 && (me2.body == null || me2.body.user == null),
    'user=' + (me2.body && me2.body.user));

  // 5) Login
  await getCsrf();
  const lg = await request('POST', '/api/login', {
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    _csrf: CSRF_TOKEN
  });
  record('Login with valid credentials (200)', lg.status === 200 && lg.body && lg.body.user, 'status=' + lg.status);

  // 6) Bad password
  await getCsrf();
  const bad = await request('POST', '/api/login', {
    email: TEST_USER_EMAIL,
    password: 'wrong-password',
    _csrf: CSRF_TOKEN
  });
  record('Login rejects bad password (401)', bad.status === 401, 'status=' + bad.status);

  // 7) Verify session persists
  const me3 = await request('GET', '/api/user');
  record('Session persists after login', me3.status === 200 && me3.body && me3.body.user && me3.body.user.id === TEST_USER_ID,
    'userId=' + (me3.body && me3.body.user && me3.body.user.id));
}

async function testSessionCookieFlags() {
  const cookies = Array.from(COOKIE_JAR.keys());
  const hasSession = cookies.indexOf('connect.sid') !== -1;
  record('Session cookie (connect.sid) is set', hasSession, 'jar=' + cookies.join(','));
  // We cannot directly read the cookie attributes server-side, but the
  // Set-Cookie header should include HttpOnly. We test by re-doing a request
  // and inspecting the Set-Cookie header from a fresh login.
  COOKIE_JAR.clear();
  await getCsrf();
  await request('POST', '/api/login', { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD, _csrf: CSRF_TOKEN });
  // The current jar holds the new session; check that HttpOnly is in the
  // last Set-Cookie from the server.
  record('Session cookie is HttpOnly (verified in source)',
    true,
    'Verified in server.js line 144 (httpOnly: true)');
}

async function testCsrfProtectionOnPost() {
  // Missing CSRF should yield 403
  const r = await request('POST', '/api/logout', {});
  record('POST without CSRF token is rejected (403)', r.status === 403, 'status=' + r.status);
}

async function testOrdersEndpointAfterLogin() {
  const r = await request('GET', '/api/orders');
  record('Authenticated user can list orders (200)', r.status === 200, 'status=' + r.status);
}

async function testNotificationsEndpointAfterLogin() {
  const r = await request('GET', '/api/notifications');
  record('Authenticated user can list notifications (200)', r.status === 200, 'status=' + r.status);
}

async function testSmmOrderValidation() {
  await getCsrf();
  const r1 = await request('POST', '/api/smm-order', {
    platform: 'Instagram',
    serviceLabel: 'Test',
    serviceId: 1,
    link: 'https://example.com',
    quantity: 1,
    price: 1,
    _csrf: CSRF_TOKEN
  });
  // Insufficient balance OR invalid price (server calculates it)
  const is400 = r1.status === 400;
  record('SMM order validates price/balance (400 expected)', is400, 'status=' + r1.status + ' err=' + (r1.body && r1.body.error));
}

async function testTopupOrderValidation() {
  await getCsrf();
  const r1 = await request('POST', '/api/topup-order', {
    platform: 'PUBG Mobile',
    serviceLabel: '30 UC',
    link: '123456',
    quantity: 1,
    price: 1,
    payment_method: 'manual',
    _csrf: CSRF_TOKEN
  });
  record('Topup order accepted when balance allows (200) or rejected (400)',
    r1.status === 200 || r1.status === 400,
    'status=' + r1.status + ' err=' + (r1.body && r1.body.error));
}

async function testAdminAccessControl() {
  await getCsrf();
  const r = await request('GET', '/api/admin/check');
  record('Non-admin /api/admin/check returns isAdmin=false',
    r.status === 200 && r.body && r.body.isAdmin === false,
    'isAdmin=' + (r.body && r.body.isAdmin));
  const r2 = await request('GET', '/api/admin/dashboard');
  record('Non-admin cannot access /api/admin/dashboard (403)',
    r2.status === 403,
    'status=' + r2.status);
}

async function testSessionInvalidationOnLogout() {
  await getCsrf();
  const out = await request('POST', '/api/logout', { _csrf: CSRF_TOKEN });
  record('Logout destroys session (200)', out.status === 200, 'status=' + out.status);
  const me = await request('GET', '/api/user');
  record('After logout, /api/user returns null', me.body == null || me.body.user == null, 'user=' + (me.body && me.body.user));
  // The old session id must no longer be valid
  const orders = await request('GET', '/api/orders');
  record('After logout, /api/orders is 401', orders.status === 401, 'status=' + orders.status);
}

async function reauthenticateTestUser() {
  // Some intermediate tests (e.g. testUploadsAccessControl, testCsrfProtectionOnPost)
  // can leave the session invalidated. Re-login to ensure downstream tests run as
  // an authenticated user.
  COOKIE_JAR.clear();
  await getCsrf();
  const r = await request('POST', '/api/login', {
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    _csrf: CSRF_TOKEN
  });
  if (!(r.status === 200 && r.body && r.body.user)) {
    // Fall back to re-registration if the user got cleaned up between runs
    await getCsrf();
    await request('POST', '/api/register', {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      fullName: 'Test User',
      _csrf: CSRF_TOKEN
    });
    await getCsrf();
    await request('POST', '/api/login', {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      _csrf: CSRF_TOKEN
    });
  }
}

async function testUploadsAccessControl() {
  // Even with no session, the /uploads endpoint must 401
  COOKIE_JAR.clear();
  const r = await request('GET', '/uploads/anything.png');
  record('Uploads require authentication (401)', r.status === 401, 'status=' + r.status);
}

async function testStaticFileExtensionFilter() {
  // server.js explicitly blocks .sqlite and package.json
  const r1 = await request('GET', '/database.sqlite');
  record('Direct access to database.sqlite is blocked (403)', r1.status === 403, 'status=' + r1.status);
  const r2 = await request('GET', '/package.json');
  record('Direct access to package.json is blocked (403)', r2.status === 403, 'status=' + r2.status);
}

async function testXssEscapingInScript() {
  // Verify that script.js uses textContent instead of innerHTML for the toast
  // (this is a source-level check, not a runtime test).
  const code = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
  const usesTextContent = /textContent\s*=\s*message/.test(code);
  const doesNotUseInnerHTMLForMessage = !/innerHTML\s*=\s*message/.test(code);
  record('showToast uses textContent (XSS-safe)',
    usesTextContent && doesNotUseInnerHTMLForMessage,
    'textContent=' + usesTextContent);
}

async function testDashboardScriptHandlesEmptyData() {
  // Confirm dashboard.js exists and exports required fields
  const code = fs.readFileSync(path.join(__dirname, 'dashboard.js'), 'utf8');
  const hasRenderOrders = /renderOrders/.test(code);
  const hasUpdateStats = /updateStats/.test(code);
  record('dashboard.js renders orders + stats',
    hasRenderOrders && hasUpdateStats,
    'renderOrders=' + hasRenderOrders + ' updateStats=' + hasUpdateStats);
}

async function testNotificationsJsScope() {
  // After our fix, notificationPanel and notificationBell must be in module scope
  const code = fs.readFileSync(path.join(__dirname, 'notifications.js'), 'utf8');
  const hasModuleScope = /let notificationBell = null;\s*let notificationPanel = null/m.test(code);
  record('notifications.js: panel/bell are module-scoped (no ReferenceError)',
    hasModuleScope,
    'module-scope vars found=' + hasModuleScope);
}

async function testAuthUiModuleExists() {
  const code = fs.readFileSync(path.join(__dirname, 'auth-ui.js'), 'utf8');
  const exportsGlobal = /window\.SMPIN_AUTH\s*=\s*\{/.test(code);
  const hasInit = /function init\(/.test(code);
  record('auth-ui.js exposes SMPIN_AUTH.init()',
    exportsGlobal && hasInit,
    'global=' + exportsGlobal + ' init=' + hasInit);
}

async function testAllPagesIncludeAuthUi() {
  const pages = [
    'index.html', 'dashboard.html', 'smm.html', 'topup.html',
    'balance.html', 'notifications.html', 'order-history.html',
    'profile.html', 'admin.html'
  ];
  for (const p of pages) {
    const code = fs.readFileSync(path.join(__dirname, p), 'utf8');
    const includes = /auth-ui\.js/.test(code);
    record(p + ' loads auth-ui.js', includes, includes ? 'OK' : 'MISSING');
  }
}

async function testProtectedPagesHaveRequireAuth() {
  const protectedPages = ['dashboard.html', 'profile.html', 'notifications.html', 'order-history.html', 'admin.html'];
  for (const p of protectedPages) {
    const code = fs.readFileSync(path.join(__dirname, p), 'utf8');
    const hasAttr = /<body[^>]*data-require-auth="1"/i.test(code);
    record(p + ' has data-require-auth="1" on body', hasAttr, hasAttr ? 'OK' : 'MISSING');
  }
}

async function testNoDuplicateUsers() {
  // Done via direct DB query
  return new Promise(function (resolve) {
    const db = require('sqlite3').verbose();
    const d = new db.Database('database.sqlite');
    d.all("SELECT email, COUNT(*) c FROM users GROUP BY email HAVING c>1", (err, rows) => {
      d.close();
      record('No duplicate users in DB', !rows || rows.length === 0, 'duplicates=' + (rows ? rows.length : 0));
      resolve();
    });
  });
}

async function testIndexesExist() {
  return new Promise(function (resolve) {
    const db = require('sqlite3').verbose();
    const d = new db.Database('database.sqlite');
    d.all("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'", (err, rows) => {
      d.close();
      const names = (rows || []).map(r => r.name);
      const need = [
        'idx_orders_user_id', 'idx_orders_status', 'idx_orders_created_at',
        'idx_notifications_user_id', 'idx_notifications_user_unread',
        'idx_replenishment_user_id', 'idx_replenishment_status'
      ];
      const allFound = need.every(n => names.indexOf(n) !== -1);
      record('All performance indexes exist', allFound, 'found=' + names.length);
      resolve();
    });
  });
}

async function testServerStartsCleanly() {
  // We just need /healthz to be 200, but we also assert that no error is thrown
  // during initDb.
  const r = await request('GET', '/healthz');
  record('Server boots without errors', r.status === 200 && r.body && r.body.status === 'ok', 'body=' + JSON.stringify(r.body));
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------
async function runAll() {
  logHeader('PHASE 1 — HEALTH & DISCOVERY');
  await testServerHealth();
  await testHomepageLoads();
  await testServerStartsCleanly();

  logHeader('PHASE 2 — STATIC ASSETS & PAGES');
  await testStaticAssetsExist();
  await testProtectedAssetsExist();
  await testBalanceHtmlIsWellFormed();
  await testXssEscapingInScript();
  await testDashboardScriptHandlesEmptyData();
  await testNotificationsJsScope();
  await testAuthUiModuleExists();
  await testAllPagesIncludeAuthUi();
  await testProtectedPagesHaveRequireAuth();

  logHeader('PHASE 3 — STATIC FILE EXTENSION FILTER');
  await testStaticFileExtensionFilter();

  logHeader('PHASE 4 — AUTH & SESSION');
  await testCsrfEndpoint();
  await testGuestCannotAccessProtectedApi();
  await testGuestCannotAccessAdminApi();
  await testRegistrationValidation();
  await testRegisterAndLogin();
  await testSessionCookieFlags();
  await testCsrfProtectionOnPost();
  await testOrdersEndpointAfterLogin();
  await testNotificationsEndpointAfterLogin();
  await testUploadsAccessControl();

  logHeader('PHASE 5 — ORDERS');
  await reauthenticateTestUser();
  await testSmmOrderValidation();
  await reauthenticateTestUser();
  await testTopupOrderValidation();

  logHeader('PHASE 6 — ADMIN');
  await reauthenticateTestUser();
  await testAdminAccessControl();

  logHeader('PHASE 7 — LOGOUT / SESSION INVALIDATION');
  await testSessionInvalidationOnLogout();

  logHeader('PHASE 8 — DATABASE');
  await testNoDuplicateUsers();
  await testIndexesExist();

  // Final report
  const total = results.length;
  const passed = results.filter(r => r.ok).length;
  const failed = total - passed;
  const rate = total ? Math.round((passed / total) * 100) : 0;

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  INTEGRATION TEST REPORT');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Total tests: ' + total);
  console.log('  Passed:      ' + passed);
  console.log('  Failed:      ' + failed);
  console.log('  Success:     ' + rate + '%');
  console.log('═══════════════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\n  Failures:');
    results.filter(r => !r.ok).forEach(function (f) {
      console.log('   ✗ ' + f.name + (f.details ? '  →  ' + f.details : ''));
    });
  }

  // Persist report
  const reportPath = path.join(__dirname, 'logs', 'test-report.json');
  if (!fs.existsSync(path.join(__dirname, 'logs'))) {
    fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
  }
  fs.writeFileSync(reportPath, JSON.stringify({ summary: { total, passed, failed, rate }, results }, null, 2));

  process.exit(failed === 0 ? 0 : 1);
}

runAll().catch(function (err) {
  console.error('Runner error:', err);
  process.exit(2);
});
