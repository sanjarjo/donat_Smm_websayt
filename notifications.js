// ============================================================================
// notifications.js - Notification bell + panel for logged-in users.
// Renders a 🔔 bell in the first .header-actions container (if any).
// Skips silently if user is not logged in.
// ============================================================================
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  // Module-scoped references so that event handlers can see them.
  let notificationBell = null;
  let notificationPanel = null;
  let panelOpen = false;
  let pollTimer = null;
  let mounted = false;

  function getCsrfToken() {
    return fetch('/api/csrf-token', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (j) { return j.csrfToken || ''; })
      .catch(function () { return ''; });
  }

  function loadNotifications() {
    if (!notificationPanel) return Promise.resolve();
    return fetch('/api/notifications', { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) return { notifications: [] };
        return res.json();
      })
      .then(function (data) {
        const notifications = (data && data.notifications) || [];
        const unreadCount = notifications.filter(function (n) { return !n.is_read; }).length;
        if (notificationBell) {
          if (unreadCount > 0) notificationBell.classList.add('has-unread');
          else notificationBell.classList.remove('has-unread');
        }
        renderPanel(notifications);
      })
      .catch(function (err) {
        console.error('Error loading notifications:', err);
      });
  }

  function renderPanel(notifications) {
    if (!notificationPanel) return;
    notificationPanel.textContent = '';

    const header = document.createElement('div');
    header.className = 'notification-panel-header';
    header.textContent = '🔔 Bildirishnomalar';
    notificationPanel.appendChild(header);

    if (notifications.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'notification-panel-empty';
      empty.textContent = "Bildirishnomalar yo'q";
      notificationPanel.appendChild(empty);
      return;
    }

    notifications.slice(0, 10).forEach(function (notif) {
      const item = document.createElement('div');
      item.className = 'notification-item' + (notif.is_read ? '' : ' unread');

      const title = document.createElement('div');
      title.className = 'notification-title';
      title.textContent = notif.title || '';

      const msg = document.createElement('div');
      msg.className = 'notification-message';
      msg.textContent = notif.message || '';

      const time = document.createElement('div');
      time.className = 'notification-time';
      try {
        time.textContent = new Date(notif.created_at).toLocaleString('uz-UZ');
      } catch (e) {
        time.textContent = notif.created_at || '';
      }

      item.appendChild(title);
      item.appendChild(msg);
      item.appendChild(time);

      item.addEventListener('click', function () {
        markNotificationAsRead(notif.id);
      });
      notificationPanel.appendChild(item);
    });
  }

  function markNotificationAsRead(notifId) {
    return getCsrfToken().then(function (csrfToken) {
      return fetch('/api/notifications/' + notifId + '/read', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ _csrf: csrfToken })
      });
    }).then(function () { return loadNotifications(); })
      .catch(function (err) { console.error('Mark as read failed', err); });
  }

  function togglePanel(ev) {
    if (ev) ev.stopPropagation();
    if (!notificationPanel) return;
    panelOpen = !panelOpen;
    notificationPanel.classList.toggle('open', panelOpen);
    if (panelOpen) loadNotifications();
  }

  function bindOutsideClick() {
    document.addEventListener('click', function (e) {
      if (!panelOpen || !notificationBell) return;
      if (!notificationBell.contains(e.target)) {
        panelOpen = false;
        if (notificationPanel) notificationPanel.classList.remove('open');
      }
    });
  }

  function mount() {
    if (mounted) return;
    const host = document.querySelector('.header-actions');
    if (!host) return;

    // Build the bell.
    const bell = document.createElement('div');
    bell.className = 'notification-bell';
    bell.id = 'notificationBell';
    bell.innerHTML =
      '<span class="bell-icon" aria-label="Bildirishnomalar">🔔</span>' +
      '<span class="unread-dot" aria-hidden="true"></span>' +
      '<div class="notification-panel" id="notificationPanel" role="region" aria-label="Bildirishnomalar ro\'yxati"></div>';

    host.insertBefore(bell, host.firstChild);

    notificationBell = bell;
    notificationPanel = bell.querySelector('#notificationPanel');
    bell.addEventListener('click', togglePanel);
    mounted = true;

    loadNotifications();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(loadNotifications, 30000);
  }

  function init() {
    // Only show the bell for logged-in users.
    fetch('/api/user', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { user: null }; })
      .then(function (data) {
        if (data && data.user) {
          mount();
          bindOutsideClick();
        }
      })
      .catch(function () { /* silent */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
