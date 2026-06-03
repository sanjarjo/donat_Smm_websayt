document.addEventListener('DOMContentLoaded', function () {

  /* ── ELEMENTLAR ── */
  const gameCards      = document.querySelectorAll('.game-select-card');
  const productSelect  = document.getElementById('productSelect');
  const orderSummary   = document.getElementById('orderSummary');
  const summaryGame    = document.getElementById('summaryGame');
  const summaryProduct = document.getElementById('summaryProduct');
  const summaryUserId  = document.getElementById('summaryUserId');
  const summaryTotal   = document.getElementById('summaryTotal');
  const cancelOrder    = document.getElementById('cancelOrder');
  const confirmOrder   = document.getElementById('confirmOrder');
  const pubgInputs     = document.getElementById('pubgInputs');
  const freefireInputs = document.getElementById('freefireInputs');
  const mlInputs       = document.getElementById('mlInputs');
  const pubgIdInput    = document.getElementById('pubgIdInput');
  const freefireIdInput= document.getElementById('freefireIdInput');
  const mlIdInput      = document.getElementById('mlIdInput');
  const mlZoneInput    = document.getElementById('mlZoneInput');

  /* ── MAHSULOTLAR ── */
  const products = {
    'pubg': [
      { value: '30uc',   label: '🆔 18 - 30 UC',   price: 7000   },
      { value: '60uc',   label: '🆔 19 - 60 UC',   price: 13000  },
      { value: '325uc',  label: '🆔 20 - 325 UC',  price: 65000  },
      { value: '660uc',  label: '🆔 21 - 660 UC',  price: 125000 },
      { value: 'premium1', label: '🆔 22 - Premium 1 Month', price: 18000 },
      { value: 'premium3', label: '🆔 23 - Premium 3 Months', price: 45000 },
      { value: 'premium6', label: '🆔 24 - Premium 6 Months', price: 85000 },
      { value: 'premiumplus1', label: '🆔 25 - Premium Plus 1 Month', price: 135000 }
    ],
    'mobile-legends': [
      { value: '11d',   label: '🆔 13 - 11 Diamonds',   price: 3000   },
      { value: '22d',   label: '🆔 14 - 22 Diamonds',   price: 5000   },
      { value: '56d',   label: '🆔 15 - 56 Diamonds',   price: 12000  },
      { value: '86d',   label: '🆔 16 - 86 Diamonds',   price: 17000  },
      { value: 'weekly',label: '🆔 17 - Weekly Diamonds', price: 21000 }
    ],
    'free-fire': [
      { value: '100d',  label: '100 Diamonds',  price: 12000  },
      { value: '310d',  label: '310 Diamonds',  price: 35000  },
      { value: '520d',  label: '520 Diamonds',  price: 60000  },
      { value: '1080d', label: '1080 Diamonds', price: 120000 }
    ]
  };

  const gameNames = {
    'pubg':           'PUBG Mobile',
    'mobile-legends': 'Mobile Legends',
    'free-fire':      'Free Fire'
  };

  let selectedGame    = 'pubg';
  let selectedProduct = null;

  /* ── O'YIN TANLASH ── */
  gameCards.forEach(function (card) {
    card.addEventListener('click', function () {
      gameCards.forEach(function (c) { c.classList.remove('active'); });
      card.classList.add('active');
      selectedGame    = card.getAttribute('data-game');
      selectedProduct = null;
      updateProductOptions();
      updateInputFields();
      updateSummary();
    });
  });

  /* ── MAHSULOT TANLASH ── */
  productSelect.addEventListener('change', function () {
    var list = products[selectedGame] || [];
    selectedProduct = list.find(function (p) { return p.value === productSelect.value; }) || null;
    updateSummary();
  });

  /* ── INPUT O'ZGARISHI ── */
  [pubgIdInput, freefireIdInput, mlIdInput, mlZoneInput].forEach(function (inp) {
    inp.addEventListener('input', updateSummary);
  });

  /* ── BEKOR QILISH ── */
  cancelOrder.addEventListener('click', function () {
    pubgIdInput.value    = '';
    freefireIdInput.value = '';
    mlIdInput.value      = '';
    mlZoneInput.value    = '';
    productSelect.value  = '';
    selectedProduct      = null;
    updateSummary();
    showToast('Buyurtma bekor qilindi.', 'warning');
  });

  /* ── TASDIQLASH ── */
  confirmOrder.addEventListener('click', async function () {
    if (!selectedProduct) {
      showToast('Iltimos, mahsulotni tanlang.', 'error');
      return;
    }

    let gameId = '';
    let serverInfo = '';
    if (selectedGame === 'pubg') {
      gameId = pubgIdInput.value.trim();
    } else if (selectedGame === 'free-fire') {
      gameId = freefireIdInput.value.trim();
    } else if (selectedGame === 'mobile-legends') {
      gameId = mlIdInput.value.trim();
      serverInfo = mlZoneInput.value.trim();
    }

    if (!gameId) {
      showToast('Iltimos, o‘yin ID yoki foydalanuvchi nomini kiriting.', 'error');
      return;
    }

    const price = selectedProduct.price;
    const csrfToken = await (async () => {
      try {
        const res = await fetch('/api/csrf-token');
        const { csrfToken } = await res.json();
        return csrfToken;
      } catch { return ''; }
    })();
    const body = {
      platform: gameNames[selectedGame],
      serviceLabel: selectedProduct.label,
      link: gameId,
      quantity: 1,
      price: price,
      payment_method: 'Manual',
      server_info: serverInfo,
      _csrf: csrfToken
    };

    try {
      const response = await fetch('/api/topup-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) {
        showToast(data.error || 'Top-up buyurtmasi yuborilmadi.', 'error');
        return;
      }
      showToast('Top-up buyurtmangiz yuborildi. Admin tekshiradi.', 'success');
      pubgIdInput.value = '';
      freefireIdInput.value = '';
      mlIdInput.value = '';
      mlZoneInput.value = '';
      productSelect.value = '';
      selectedProduct = null;
      updateSummary();
    } catch (err) {
      showToast('Top-up buyurtmasi yuborishda xatolik yuz berdi.', 'error');
    }
  });

  /* ── FUNKSIYALAR ── */
  function updateInputFields() {
    pubgInputs.style.display     = selectedGame === 'pubg'             ? 'block' : 'none';
    freefireInputs.style.display = selectedGame === 'free-fire'        ? 'block' : 'none';
    mlInputs.style.display       = selectedGame === 'mobile-legends'   ? 'block' : 'none';
  }

  function updateProductOptions() {
    productSelect.innerHTML = '<option value="">Mahsulot turini tanlang...</option>';
    var list = products[selectedGame] || [];
    list.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value       = p.value;
      opt.textContent = p.label + ' — ' + p.price.toLocaleString() + " so'm";
      productSelect.appendChild(opt);
    });
  }

  function updateSummary() {
    var userId = '';
    if (selectedGame === 'pubg')
      userId = pubgIdInput.value.trim();
    else if (selectedGame === 'free-fire')
      userId = freefireIdInput.value.trim();
    else if (selectedGame === 'mobile-legends') {
      userId = mlIdInput.value.trim();
      if (mlZoneInput.value.trim()) userId += ' (' + mlZoneInput.value.trim() + ')';
    }

    if (!selectedProduct || !userId) {
      orderSummary.style.display = 'none';
      return;
    }

    summaryGame.textContent    = gameNames[selectedGame];
    summaryProduct.textContent = selectedProduct.label;
    summaryUserId.textContent  = userId;
    summaryTotal.textContent   = selectedProduct.price.toLocaleString() + " so'm";
    orderSummary.style.display = 'block';
  }

  /* ── BOSHLANG'ICH HOLAT ── */
  updateProductOptions();
  updateInputFields();
  updateSummary();

  /* ── BALANSNI YUKLASH ── */
  function loadTopupBalance() {
    fetch('/api/user', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { user: null }; })
      .then(function (data) {
        const el = document.getElementById('topupBalanceAmount');
        if (el) {
          el.textContent = (data.user && data.user.balance != null ? data.user.balance : 0).toLocaleString() + " so'm";
        }
      })
      .catch(function () { /* silent */ });
  }
  loadTopupBalance();

});
