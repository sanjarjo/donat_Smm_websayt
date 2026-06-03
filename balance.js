// Balance Replenishment Logic
document.addEventListener('DOMContentLoaded', function() {
  const replenishBtns = document.querySelectorAll('.replenish-btn');
  const p2pForm = document.getElementById('p2pForm');
  const atmForm = document.getElementById('atmForm');
  const adminForm = document.getElementById('adminForm');
  const p2pAmount = document.getElementById('p2pAmount');
  const atmAmount = document.getElementById('atmAmount');
  const cardMessage = document.getElementById('cardMessage');
  const p2pReceipt = document.getElementById('p2pReceipt');
  const submitP2P = document.getElementById('submitP2P');
  const cancelP2P = document.getElementById('cancelP2P');
  const atmReceipt = document.getElementById('atmReceipt');
  const submitATM = document.getElementById('submitATM');
  const cancelATM = document.getElementById('cancelATM');
  const balanceAmount = document.getElementById('balanceAmount');

  // Switch between replenishment types
  replenishBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      replenishBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      const type = this.dataset.type;
      p2pForm.style.display = type === 'p2p' ? 'block' : 'none';
      atmForm.style.display = type === 'atm' ? 'block' : 'none';
      adminForm.style.display = type === 'admin' ? 'block' : 'none';

      p2pAmount.value = '';
      p2pReceipt.value = '';
      atmReceipt.value = '';
      cardMessage.style.display = 'none';
      submitP2P.style.display = 'none';
      submitATM.style.display = 'none';
    });
  });

  p2pAmount.addEventListener('input', function() {
    const amount = parseFloat(this.value);
    if (amount >= 2000 && amount <= 1000000) {
      cardMessage.style.display = 'block';
      submitP2P.style.display = 'inline-block';
    } else {
      cardMessage.style.display = 'none';
      submitP2P.style.display = 'none';
    }
  });

  atmReceipt.addEventListener('change', updateAtmSubmitVisibility);
  atmAmount.addEventListener('input', updateAtmSubmitVisibility);

  function updateAtmSubmitVisibility() {
    const hasReceipt = atmReceipt.files.length > 0;
    const atmAmountValue = parseFloat(atmAmount.value);
    const hasValidAmount = atmAmountValue >= 2000 && atmAmountValue <= 1000000;
    submitATM.style.display = (hasReceipt && hasValidAmount) ? 'inline-block' : 'none';
  }

  cancelP2P.addEventListener('click', function() {
    p2pAmount.value = '';
    p2pReceipt.value = '';
    cardMessage.style.display = 'none';
    submitP2P.style.display = 'none';
    showToast('Bekor qilindi', 'info');
  });

  cancelATM.addEventListener('click', function() {
    atmAmount.value = '';
    atmReceipt.value = '';
    submitATM.style.display = 'none';
    showToast('Bekor qilindi', 'info');
  });

  async function getCsrfToken() {
    try {
      const res = await fetch('/api/csrf-token', { credentials: 'same-origin' });
      const { csrfToken } = await res.json();
      return csrfToken || '';
    } catch {
      return '';
    }
  }

  function validateFile(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Faqat PNG, JPG, GIF va PDF fayllari qabul qilinadi', 'error');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Fayl 10MB dan kichik bolishi kerak', 'error');
      return false;
    }
    return true;
  }

  async function submitReplenishment(type, amount, file, onSuccess) {
    const csrfToken = await getCsrfToken();
    const formData = new FormData();
    formData.append('receipt', file);
    formData.append('amount', String(Math.round(amount)));
    formData.append('type', type);
    formData.append('_csrf', csrfToken);

    try {
      const res = await fetch('/api/replenishment-order', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken },
        credentials: 'same-origin',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showToast(type === 'p2p' ? 'P2P sorovi adminga yuborildi!' : 'ATM sorovi adminga yuborildi!', 'success');
        onSuccess && onSuccess();
        loadBalance();
      } else {
        showToast(data.error || 'Xatolik yuz berdi', 'error');
      }
    } catch (err) {
      showToast('Sorrovni yuborishda xatolik yuz berdi', 'error');
    }
  }

  submitP2P.addEventListener('click', async function() {
    const amount = parseFloat(p2pAmount.value);
    if (!amount || amount < 2000 || amount > 1000000) {
      showToast('Miqdor 2000 dan 1000000 gacha bolishi kerak', 'error');
      return;
    }
    if (!p2pReceipt.files.length) {
      showToast("Iltimos, to'lov kvitansiyasini yuklang", 'error');
      return;
    }
    const file = p2pReceipt.files[0];
    if (!validateFile(file)) return;

    submitP2P.disabled = true;
    await submitReplenishment('p2p', amount, file, () => {
      p2pAmount.value = '';
      p2pReceipt.value = '';
      cardMessage.style.display = 'none';
    });
    submitP2P.disabled = false;
    submitP2P.style.display = 'none';
  });

  submitATM.addEventListener('click', async function() {
    if (!atmReceipt.files.length) {
      showToast('Iltimos, ATM chekini yuklang', 'error');
      return;
    }
    const amount = parseFloat(atmAmount.value);
    if (!amount || amount < 2000 || amount > 1000000) {
      showToast('Miqdor 2000 dan 1000000 gacha bolishi kerak', 'error');
      return;
    }
    const file = atmReceipt.files[0];
    if (!validateFile(file)) return;

    submitATM.disabled = true;
    await submitReplenishment('atm', amount, file, () => {
      atmAmount.value = '';
      atmReceipt.value = '';
    });
    submitATM.disabled = false;
    submitATM.style.display = 'none';
  });

  loadBalance();
});

async function loadBalance() {
  try {
    const res = await fetch('/api/user', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = await res.json();
    const balanceAmount = document.getElementById('balanceAmount');
    if (balanceAmount) {
      balanceAmount.textContent = (data.user?.balance || 0).toLocaleString() + " so'm";
    }
  } catch (err) {
    console.error('Error loading balance:', err);
  }
}
