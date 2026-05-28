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

  atmReceipt.addEventListener('change', function() {
    const hasReceipt = this.files.length > 0;
    const atmAmountValue = parseFloat(atmAmount.value);
    const hasValidAmount = atmAmountValue >= 2000 && atmAmountValue <= 1000000;
    submitATM.style.display = (hasReceipt && hasValidAmount) ? 'inline-block' : 'none';
  });

  atmAmount.addEventListener('input', function() {
    const amount = parseFloat(this.value);
    const hasReceipt = atmReceipt.files.length > 0;
    const hasValidAmount = amount >= 2000 && amount <= 1000000;
    submitATM.style.display = (hasReceipt && hasValidAmount) ? 'inline-block' : 'none';
  });

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

  submitP2P.addEventListener('click', async function() {
    const amount = parseFloat(p2pAmount.value);
    if (!amount || amount < 2000 || amount > 1000000) {
      showToast('Miqdor 2000 dan 1000000 gacha bolishi kerak', 'error');
      return;
    }
    if (!p2pReceipt.files.length) {
      showToast('Iltimos, tòlov kvitansiyasini yuklang', 'error');
      return;
    }
    const file = p2pReceipt.files[0];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Faqat PNG, JPG, GIF va PDF fayllari qabul qilinadi', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Fayl 5MB dan kichik bolishi kerak', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const receipt = e.target.result;
        const csrfToken = await (async () => {
          try {
            const res = await fetch('/api/csrf-token');
            const { csrfToken } = await res.json();
            return csrfToken;
          } catch { return ''; }
        })();
        const res = await fetch('/api/replenishment-order', {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          body: JSON.stringify({ amount, type: 'p2p', receipt, _csrf: csrfToken })
        });
        const data = await res.json();
        if (res.ok) {
          showToast('P2P sòrovi adminga yuborildi!', 'success');
          p2pAmount.value = '';
          p2pReceipt.value = '';
          cardMessage.style.display = 'none';
          submitP2P.style.display = 'none';
        } else {
          showToast(data.error || 'Xatolik yuz berdi', 'error');
        }
      } catch (err) {
        showToast('Sòrovni yuborishda xatolik yuz berdi', 'error');
      }
    };
    reader.readAsDataURL(file);
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
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Faqat PNG, JPG, GIF va PDF fayllari qabul qilinadi', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Fayl 5MB dan kichik bolishi kerak', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const receipt = e.target.result;
        const csrfToken = await (async () => {
          try {
            const res = await fetch('/api/csrf-token');
            const { csrfToken } = await res.json();
            return csrfToken;
          } catch { return ''; }
        })();
        const res = await fetch('/api/replenishment-order', {
          method: 'POST',
          headers: { 'X-CSRF-Token': csrfToken },
          body: JSON.stringify({ amount, type: 'atm', receipt, _csrf: csrfToken })
        });
        const data = await res.json();
        if (res.ok) {
          showToast('ATM sòrovi adminga yuborildi!', 'success');
          atmAmount.value = '';
          atmReceipt.value = '';
          submitATM.style.display = 'none';
        } else {
          showToast(data.error || 'Xatolik yuz berdi', 'error');
        }
      } catch (err) {
        showToast('Sòrovni yuborishda xatolik yuz berdi', 'error');
      }
    };
    reader.readAsDataURL(file);
  });

  loadBalance();
});

async function loadBalance() {
  try {
    const res = await fetch('/api/user');
    if (!res.ok) return;
    const data = await res.json();
    const balanceAmount = document.getElementById('balanceAmount');
    if (balanceAmount) {
      balanceAmount.textContent = (data.user?.balance || 0).toLocaleString() + ' so\'m';
    }
  } catch (err) {
    console.error('Error loading balance:', err);
  }
}
