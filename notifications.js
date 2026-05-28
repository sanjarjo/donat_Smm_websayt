// ── NOTIFICATION BELL ──
// Faqat login bo'lgan foydalanuvchi uchun — 401 spam yo'q

(async function initNotifications() {
  try {
    const res = await fetch('/api/user');
    if (!res.ok) return; // Login qilinmagan — hech narsa qilmaymiz

    const data = await res.json();
    if (!data || !data.user) return;

    const headerActionsContainer = document.querySelector('.header-actions');
    if (headerActionsContainer) {
      const bellDiv = document.createElement('div');
      bellDiv.className = 'notification-bell';
      bellDiv.id = 'notificationBell';
      bellDiv.innerHTML = `
        <span class="bell-icon">🔔</span>
        <div class="unread-dot"></div>
        <div class="notification-panel" id="notificationPanel"></div>
      `;
      headerActionsContainer.insertBefore(bellDiv, headerActionsContainer.firstChild);
    }

    const notificationBell = document.getElementById('notificationBell');
    const notificationPanel = document.getElementById('notificationPanel');

    if (notificationBell) {
      notificationBell.addEventListener('click', toggleNotificationPanel);
      document.addEventListener('click', function (e) {
        if (!notificationBell.contains(e.target) &&
            notificationPanel &&
            notificationPanel.classList.contains('open')) {
          notificationPanel.classList.remove('open');
        }
      });
      await loadNotifications();
      setInterval(loadNotifications, 30000); // faqat login bo'lganda ishga tushadi
    }
  } catch (err) {
    // jimgina o'tib ketamiz
  }
})();

async function loadNotifications() {
  try {
    const res = await fetch('/api/notifications');
    if (!res.ok) return;
    
    const data = await res.json();
    const notifications = data.notifications || [];
    
    if (!notificationPanel) return;
    
    const unreadCount = notifications.filter(n => !n.is_read).length;
    if (unreadCount > 0) {
      notificationBell.classList.add('has-unread');
    } else {
      notificationBell.classList.remove('has-unread');
    }
    
    notificationPanel.innerHTML = '';
    
    if (notifications.length === 0) {
      notificationPanel.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--muted);">Xatolar yoq</div>';
      return;
    }
    
    notifications.slice(0, 10).forEach(notif => {
      const item = document.createElement('div');
      item.className = 'notification-item' + (notif.is_read ? '' : ' unread');

      const titleEl = document.createElement('div');
      titleEl.className = 'notification-title';
      titleEl.textContent = notif.title;

      const msgEl = document.createElement('div');
      msgEl.className = 'notification-message';
      msgEl.textContent = notif.message;

      const timeEl = document.createElement('div');
      timeEl.className = 'notification-time';
      timeEl.textContent = new Date(notif.created_at).toLocaleString('uz-UZ');

      item.appendChild(titleEl);
      item.appendChild(msgEl);
      item.appendChild(timeEl);
      item.addEventListener('click', () => markNotificationAsRead(notif.id));
      notificationPanel.appendChild(item);
    });
  } catch (err) {
    console.error('Error loading notifications:', err);
  }
}

function toggleNotificationPanel() {
  if (notificationPanel) {
    notificationPanel.classList.toggle('open');
  }
}

async function markNotificationAsRead(notifId) {
  try {
    await fetch(`/api/notifications/${notifId}/read`, { method: 'POST' });
    loadNotifications();
  } catch (err) {
    console.error('Error marking notification as read:', err);
  }
}
