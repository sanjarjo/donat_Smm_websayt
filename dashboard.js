// ============================================================================
// dashboard.js - Loads and renders the dashboard for an authenticated user.
// Redirects guests to index.html. Also refreshes the user balance/orders
// after the page loads.
// ============================================================================
(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }

  function setText(id, text) {
    const node = el(id);
    if (node) node.textContent = text;
  }

  function formatPrice(n) {
    return (Number(n) || 0).toLocaleString() + " so'm";
  }

  function escapeText(s) {
    return String(s == null ? '' : s);
  }

  function statusBadge(status) {
    const span = document.createElement('span');
    span.className = 'status-badge status-' + (status || 'pending');
    span.textContent = status || 'pending';
    return span;
  }

  function renderOrders(orders) {
    const wrap = el('ordersTable');
    if (!wrap) return;
    wrap.textContent = '';
    if (!orders || orders.length === 0) {
      const empty = document.createElement('div');
      empty.style.textAlign = 'center';
      empty.style.padding = '40px 20px';
      empty.style.color = 'var(--muted, #94a3b8)';
      empty.textContent = "Hozircha buyurtmalar yo'q";
      wrap.appendChild(empty);
      return;
    }

    orders.slice(0, 10).forEach(function (order) {
      const row = document.createElement('div');
      row.className = 'order-row';

      const idCell = document.createElement('div');
      idCell.textContent = '#' + order.id;

      const svcCell = document.createElement('div');
      svcCell.textContent = escapeText(order.service_label || order.platform || '-');

      const qtyCell = document.createElement('div');
      qtyCell.textContent = (order.quantity || 0).toLocaleString();

      const priceCell = document.createElement('div');
      priceCell.textContent = formatPrice(order.price);

      const statusCell = document.createElement('div');
      statusCell.appendChild(statusBadge(order.status));

      const dateCell = document.createElement('div');
      try {
        dateCell.textContent = new Date(order.created_at).toLocaleDateString('uz-UZ');
      } catch (e) {
        dateCell.textContent = order.created_at || '';
      }

      row.appendChild(idCell);
      row.appendChild(svcCell);
      row.appendChild(qtyCell);
      row.appendChild(priceCell);
      row.appendChild(statusCell);
      row.appendChild(dateCell);
      wrap.appendChild(row);
    });
  }

  function updateStats(orders) {
    const total = orders.length;
    const completed = orders.filter(function (o) { return o.status === 'approved' || o.status === 'completed'; }).length;
    const pending = orders.filter(function (o) { return o.status === 'pending' || o.status === 'processing'; }).length;
    setText('totalOrders', total.toString());
    setText('completedOrders', completed.toString());
    setText('pendingOrders', pending.toString());
  }

  function load() {
    if (window.SMPIN_AUTH && window.SMPIN_AUTH.fetchUser) {
      window.SMPIN_AUTH.fetchUser(true).then(function (user) {
        if (!user) {
          window.location.href = 'index.html';
          return;
        }
        setText('dashboardBalance', formatPrice(user.balance));
        // Update the welcome heading with the user's name.
        const heading = document.querySelector('.dashboard-header h1');
        if (heading) {
          const name = user.full_name || user.email || 'Foydalanuvchi';
          heading.textContent = 'Xush kelibsiz, ' + name + '!';
        }
      });
    }

    fetch('/api/orders', { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) {
          window.location.href = 'index.html';
          return null;
        }
        return r.json();
      })
      .then(function (data) {
        if (!data) return;
        const orders = data.orders || [];
        renderOrders(orders);
        updateStats(orders);
      })
      .catch(function (err) {
        console.error('Dashboard load error:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
