// ── HEADER SCROLL ──
const header = document.getElementById('siteHeader');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 20);
});

// ── GET CSRF TOKEN ──
async function getCsrfToken() {
  try {
    const res = await fetch('/api/csrf-token');
    const { csrfToken } = await res.json();
    return csrfToken;
  } catch (err) {
    console.warn('Failed to get CSRF token:', err);
    return '';
  }
}

// ── BURGER MENU ──
const burger = document.getElementById('burger');
const mobileNav = document.getElementById('mobileNav');
burger.addEventListener('click', () => {
  mobileNav.classList.toggle('open');
});
document.querySelectorAll('.mn-link').forEach(link => {
  link.addEventListener('click', () => mobileNav.classList.remove('open'));
});

// ── STATS COUNTER ANIMATION ──
const counters = document.querySelectorAll('.stat-num');
const animateCounters = () => {
  counters.forEach(counter => {
    const target = parseInt(counter.dataset.target);
    const duration = 1800;
    const step = target / (duration / 16);
    let current = 0;
    const update = () => {
      current = Math.min(current + step, target);
      if (target >= 1000) {
        counter.textContent = Math.floor(current).toLocaleString() + '+';
      } else {
        counter.textContent = Math.floor(current) + (target === 24 ? '/7' : '+');
      }
      if (current < target) requestAnimationFrame(update);
    };
    update();
  });
};

// Trigger on scroll
const heroStats = document.querySelector('.hero-stats');
const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) {
    animateCounters();
    observer.disconnect();
  }
}, { threshold: 0.5 });
if (heroStats) observer.observe(heroStats);

// ── TABS (GAMES) ──
const tabs = document.querySelectorAll('.tab');
const gameCards = document.querySelectorAll('.game-card');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const filter = tab.dataset.tab;
    gameCards.forEach(card => {
      if (filter === 'all' || card.dataset.cat === filter) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

// ── AUTH MODAL ──
const authModal = document.getElementById('authModal');
const orderModal = document.getElementById('orderModal');

function openAuthModal(mode = 'login') {
  authModal.classList.add('active');
  switchAuth(mode);
  document.body.style.overflow = 'hidden';
}

function closeAllModals() {
  if (authModal) authModal.classList.remove('active');
  if (orderModal) orderModal.classList.remove('active');
  document.body.style.overflow = '';
}

let authMode = 'login';

function switchAuth(mode) {
  authMode = mode;
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const authTitle = document.getElementById('authTitle');
  const authDesc = document.getElementById('authDesc');
  const authAction = document.getElementById('authAction');
  const authActions = document.querySelectorAll('.authAction');

  if (mode === 'login') {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    authTitle.textContent = 'Xush kelibsiz!';
    authDesc.textContent = 'smpin hisobingizga kiring.';
    if (authAction) authAction.textContent = 'kirish';
    authActions.forEach(el => el.textContent = 'kirish');
  } else {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    authTitle.textContent = "Ro'yxatdan o'ting";
    authDesc.textContent = "Yangi smpin hisobi yarating — bepul!";
    if (authAction) authAction.textContent = "ro'yxatdan o'tish";
    authActions.forEach(el => el.textContent = "ro'yxatdan o'tish");
  }
}

// Bind open buttons
['openLogin', 'mobileLogin'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', () => openAuthModal('login'));
});
['openRegister', 'mobileRegister', 'heroRegister', 'ctaRegister'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', () => openAuthModal('register'));
});

// Modal close tugmalari
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', closeAllModals);
});

// Auth tabs
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
if (loginTab) loginTab.addEventListener('click', () => switchAuth('login'));
if (registerTab) registerTab.addEventListener('click', () => switchAuth('register'));

// Social auth tugmalari
const googleAuthBtn = document.getElementById('googleAuthBtn');
if (googleAuthBtn) googleAuthBtn.addEventListener('click', handleGoogle);

const telegramAuthBtn = document.getElementById('telegramAuthBtn');
if (telegramAuthBtn) telegramAuthBtn.addEventListener('click', handleTelegram);

// Email auth submit
const emailAuthSubmit = document.getElementById('emailAuthSubmit');
if (emailAuthSubmit) emailAuthSubmit.addEventListener('click', handleEmailAuth);

// Order submit
const orderSubmitBtn = document.getElementById('orderSubmitBtn');
if (orderSubmitBtn) orderSubmitBtn.addEventListener('click', handleOrder);

// FAQ — event delegation orqali
document.addEventListener('click', (e) => {
  const faqBtn = e.target.closest('.faq-q');
  if (faqBtn) toggleFaq(faqBtn);
});
// Close on backdrop
[authModal, orderModal].forEach(modal => {
  if (modal) modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAllModals();
  });
});

// ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllModals();
});

// ── GOOGLE AUTH ──
function handleGoogle() {
  closeAllModals();
  window.location.href = '/auth/google';
}

// ── TELEGRAM AUTH ──
async function handleTelegram() {
  closeAllModals();
  try {
    const response = await fetch('/api/telegram/start');
    const data = await response.json();
    if (!response.ok) {
      showToast(data.error || 'Telegram auth xatolik.', 'error');
      return;
    }
    window.open(data.url, '_blank');
    showToast('Telegram bot ochildi. /start tugmasini bosing!', 'success');
    await pollTelegramStatus(data.token);
  } catch (err) {
    showToast('Telegramga ulanishda xatolik yuz berdi.', 'error');
  }
}

async function pollTelegramStatus(token) {
  const timeoutAt = Date.now() + 45000;
  while (Date.now() < timeoutAt) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    try {
      const statusResponse = await fetch(`/api/telegram/status?token=${encodeURIComponent(token)}`);
      const statusData = await statusResponse.json();
      if (statusData.status === 'linked') {
        const completeResponse = await fetch('/api/telegram/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const completeData = await completeResponse.json();
        if (completeResponse.ok) {
          showToast('Telegram orqali muvaffaqiyatli tizimga kirdingiz.', 'success');
          return;
        }
        showToast(completeData.error || 'Telegram auth yakunlanmadi.', 'error');
        return;
      }
    } catch (err) {
      // continue polling
    }
  }
  showToast("Telegram auth vaqt tugadi. Iltimos, qayta urinib ko'ring.", 'warning');
}

// ── EMAIL AUTH ──
async function handleEmailAuth() {
  const inputs = document.querySelectorAll('#authModal .auth-input');
  const email = inputs[0]?.value.trim();
  const pass = inputs[1]?.value.trim();

  if (!email || !pass) {
    showToast("Iltimos, email va parolni kiriting.", 'error');
    return;
  }
  if (!email.includes('@')) {
    showToast("To'g'ri email manzil kiriting.", 'error');
    return;
  }
  // ✅ FIX 5: Parol validatsiyasi 8 belgiga yangilandi
  if (pass.length < 8) {
    showToast("Parol kamida 8 ta belgidan iborat bo'lishi kerak.", 'error');
    return;
  }

  const route = authMode === 'register' ? '/api/register' : '/api/login';
  const csrfToken = await getCsrfToken();
  const body = { email, password: pass, fullName: '', _csrf: csrfToken };

  try {
    const response = await fetch(route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) {
      showToast(data.error || 'Auth xatolik yuz berdi.', 'error');
      return;
    }
    showToast(authMode === 'register' ? "Muvaffaqiyatli ro'yxatdan o'tdingiz!" : 'Muvaffaqiyatli kirdingiz!', 'success');
    closeAllModals();
    
    // Redirect to dashboard after successful auth
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1000);
  } catch (err) {
    showToast('Auth sorovida xatolik yuz berdi.', 'error');
  }
}

// ── ORDER MODAL ──
function openOrderModal(gameName) {
  const orderGameName = document.getElementById('orderGameName');
  if (orderGameName) orderGameName.textContent = '🎮 ' + gameName;
  orderModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function handleOrder() {
  const inputs = document.querySelectorAll('#orderModal .auth-input');
  const userId = inputs[0]?.value.trim();
  if (!userId) {
    showToast("Iltimos, o'yin ID yoki username kiriting.", 'error');
    return;
  }
  showToast("Buyurtmangiz qabul qilindi! To'lov sahifasiga o'tilmoqda...", 'success');
  setTimeout(closeAllModals, 2000);
}

// ── FAQ ──
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const answer = item.querySelector('.faq-a');
  const isOpen = btn.classList.contains('open');

  document.querySelectorAll('.faq-q.open').forEach(q => {
    q.classList.remove('open');
    q.closest('.faq-item').querySelector('.faq-a').classList.remove('visible');
  });

  if (!isOpen) {
    btn.classList.add('open');
    answer.classList.add('visible');
  }
}

// ── TOAST NOTIFICATIONS ──
// ✅ FIX 6: innerHTML → textContent XSS zararliligini oldini olish
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const span = document.createElement('span');
  span.textContent = message; // ✅ textContent ishlatildi - XSS oldini olingan
  toast.appendChild(span);

  const colors = {
    success: 'rgba(0,229,160,0.12)',
    error: 'rgba(255,80,80,0.12)',
    warning: 'rgba(255,179,0,0.12)',
  };
  const borders = {
    success: 'rgba(0,229,160,0.3)',
    error: 'rgba(255,80,80,0.3)',
    warning: 'rgba(255,179,0,0.3)',
  };

  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    background: colors[type] || colors.success,
    border: `1px solid ${borders[type] || borders.success}`,
    backdropFilter: 'blur(12px)',
    color: '#eef2ff',
    padding: '14px 20px',
    borderRadius: '12px',
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.9rem',
    fontWeight: '600',
    zIndex: '9999',
    maxWidth: '340px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    animation: 'slideIn 0.3s ease',
  });

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
  `;
  document.head.appendChild(style);

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── SMOOTH SCROLL FOR MOBILE NAV ──
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const id = anchor.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ── CARD HOVER GLOW ──
document.querySelectorAll('.game-card, .smm-card, .plan-card, .review-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mx', x + '%');
    card.style.setProperty('--my', y + '%');
  });
});

// ── AUTH STATUS VA DUMALOQ AVATAR (YANGI QO'SHILGAN KOD) ──

// Sayt yuklanganda ishga tushadi
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/user');
    if (!res.ok) return; // Login qilinmagan — hech narsa qilmaymiz
    const data = await res.json();
    if (data && data.user) {
      updateHeaderForLoggedInUser(data.user);
    }
  } catch (err) {
    console.error("Auth status tekshirishda xatolik:", err);
  }
});

// "Kirish" tugmalarini dumaloq avatar va Dashboard tugmalariga almashtirish
function updateHeaderForLoggedInUser(user) {
  const headerActions = document.querySelector('.header-actions');
  const mnActions = document.querySelector('.mn-actions');

  // Ismning yoki emailning birinchi harfini ajratib olish (Avatar uchun)
  const initial = (user.full_name || user.email || 'U').charAt(0).toUpperCase();
  const displayName = user.full_name || user.email || 'Foydalanuvchi';
  const balanceText = (user.balance || 0).toLocaleString() + " so'm";

  // Desktop versiyasi uchun avatar va ochiladigan menyu (dropdown)
  if (headerActions) {
    headerActions.textContent = '';

    const userProfile = document.createElement('div');
    userProfile.className = 'user-profile';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.id = 'avatarBtn';
    avatar.textContent = initial;

    const dropdown = document.createElement('div');
    dropdown.className = 'profile-dropdown';
    dropdown.id = 'profileDropdown';

    const dropdownHeader = document.createElement('div');
    dropdownHeader.className = 'dropdown-header';
    const nameEl = document.createElement('strong');
    nameEl.textContent = displayName;
    const balanceEl = document.createElement('span');
    balanceEl.textContent = balanceText;
    dropdownHeader.appendChild(nameEl);
    dropdownHeader.appendChild(balanceEl);

    const dashLink = document.createElement('a');
    dashLink.href = 'dashboard.html';
    dashLink.className = 'dropdown-item';
    dashLink.textContent = 'Dashboard';

    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'dropdown-item text-danger';
    logoutBtn.id = 'logoutBtn';
    logoutBtn.textContent = 'Chiqish';

    dropdown.appendChild(dropdownHeader);
    dropdown.appendChild(dashLink);
    dropdown.appendChild(logoutBtn);

    userProfile.appendChild(avatar);
    userProfile.appendChild(dropdown);
    headerActions.appendChild(userProfile);

    avatar.addEventListener('click', toggleProfileDropdown);
    logoutBtn.addEventListener('click', logoutUser);
  }

  if (mnActions) {
    mnActions.textContent = '';

    const dashLink = document.createElement('a');
    dashLink.href = 'dashboard.html';
    dashLink.className = 'btn-primary w100 text-center';
    dashLink.style.display = 'block';
    dashLink.style.marginBottom = '10px';
    dashLink.textContent = 'Dashboard';

    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn-outline w100 text-danger';
    logoutBtn.id = 'mobileLogoutBtn';
    logoutBtn.textContent = 'Chiqish';

    mnActions.appendChild(dashLink);
    mnActions.appendChild(logoutBtn);
    logoutBtn.addEventListener('click', logoutUser);
  }
}

// Avatarga bosganda menyuni ochib/yopish
function toggleProfileDropdown() {
  const dropdown = document.getElementById('profileDropdown');
  if (dropdown) {
    dropdown.classList.toggle('active');
  }
}

// Ekranning boshqa joyiga bosganda menyuni yopish
window.addEventListener('click', (e) => {
  const dropdown = document.getElementById('profileDropdown');
  if (dropdown && dropdown.classList.contains('active') && !e.target.closest('.user-profile')) {
    dropdown.classList.remove('active');
  }
});

// Tizimdan chiqish (Logout)
async function logoutUser() {
  try {
    const csrfRes = await fetch('/api/csrf-token');
    const { csrfToken } = await csrfRes.json();
    await fetch('/api/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ _csrf: csrfToken })
    });
  } catch (err) {
    console.warn('Logout failed:', err);
  }
  window.location.href = 'index.html';
}