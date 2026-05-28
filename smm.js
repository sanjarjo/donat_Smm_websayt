// SMM Order Logic
const serviceCards = document.querySelectorAll('.service-card');
const productSelect = document.getElementById('productSelect');
const linkInput = document.getElementById('linkInput');
const quantityInput = document.getElementById('quantityInput');
const quantityNote = document.getElementById('quantityNote');
const orderSummary = document.getElementById('orderSummary');
const summaryNetwork = document.getElementById('summaryNetwork');
const summaryProduct = document.getElementById('summaryProduct');
const summaryLink = document.getElementById('summaryLink');
const summaryQuantity = document.getElementById('summaryQuantity');
const summaryTotal = document.getElementById('summaryTotal');
const cancelOrder = document.getElementById('cancelOrder');
const confirmOrder = document.getElementById('confirmOrder');

const products = {
  instagram: [
    { value: 'insta_unsubscribed', serviceId: 10, label: '🆔 10 - Instagram Kafolatsiz obunachi (10000 so\'m per 1000)', price: 10000, unit: 'per1000' },
    { value: 'insta_likes', serviceId: 11, label: '🆔 11 - Instagram Oddiy Likelar (5000 so\'m per 1000)', price: 5000, unit: 'per1000' },
    { value: 'insta_views', serviceId: 12, label: '🆔 12 - Instagram Oddiy Ko\'rishlar (500 so\'m per 1000)', price: 500, unit: 'per1000' }
  ],
  telegram: [
    { value: 'tg_30', serviceId: 1, label: '🆔 01 - 30 kunlik obunachi (15000 so\'m)', price: 15000, unit: 'package' },
    { value: 'tg_60', serviceId: 2, label: '🆔 02 - 60 kunlik obunachi (18000 so\'m)', price: 18000, unit: 'package' },
    { value: 'tg_90', serviceId: 3, label: '🆔 03 - 90 kunlik obunachi (21000 so\'m)', price: 21000, unit: 'package' },
    { value: 'tg_120', serviceId: 4, label: '🆔 04 - 120 kunlik obunachi (24000 so\'m)', price: 24000, unit: 'package' },
    { value: 'tg_180', serviceId: 5, label: '🆔 05 - 180 kunlik obunachi (30000 so\'m)', price: 30000, unit: 'package' },
    { value: 'tg_365', serviceId: 6, label: '🆔 06 - 365 kunlik obunachi (40000 so\'m)', price: 40000, unit: 'package' },
    { value: 'tg_30_uz', serviceId: 7, label: '🆔 07 - 30 kunlik Uzbek obunachi (20000 so\'m)', price: 20000, unit: 'package' },
    { value: 'tg_90_uz', serviceId: 8, label: '🆔 08 - 90 kunlik Uzbek aralash obunachi (30000 so\'m)', price: 30000, unit: 'package' },
    { value: 'tg_views', serviceId: 9, label: '🆔 09 - Oddiy ko\'rishlar (500 so\'m per 1000)', price: 500, unit: 'per1000' }
  ]
};

const quantityRules = {
  insta_unsubscribed: { min: 100, max: 5000, step: 100, note: '100 dan 5000 gacha, 100 qadam bilan kiritilsin.' },
  insta_likes: { min: 100, max: 100000, step: 1, note: '100 dan 100000 gacha miqdorni kiriting.' },
  insta_views: { min: 100, max: 100000, step: 1, note: '100 dan 100000 gacha miqdorni kiriting.' }
};

let selectedService = 'instagram';
let selectedProduct = null;

// Service selection
serviceCards.forEach(card => {
  card.addEventListener('click', () => {
    serviceCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    selectedService = card.dataset.service;
    updateProductOptions();
    updateSummary();
  });
});

function getQuantityRule() {
  return selectedProduct ? quantityRules[selectedProduct.value] : null;
}

function applyQuantityRules() {
  const rule = getQuantityRule();
  if (rule) {
    quantityInput.min = rule.min;
    quantityInput.max = rule.max;
    quantityInput.step = rule.step;
    quantityInput.placeholder = `Masalan: ${rule.min}`;
    quantityNote.textContent = rule.note;
  } else {
    quantityInput.min = 1;
    quantityInput.max = 100000;
    quantityInput.step = 1;
    quantityInput.placeholder = 'Masalan: 1000';
    quantityNote.textContent = 'Miqdorni kiriting.';
  }
}

function isValidQuantity(quantity) {
  const rule = getQuantityRule();
  if (!rule) return quantity > 0;
  if (quantity < rule.min || quantity > rule.max) return false;
  return rule.step === 1 || quantity % rule.step === 0;
}

// Update product options
function updateProductOptions() {
  productSelect.innerHTML = '<option value="">Xizmat turini tanlang...</option>';
  products[selectedService].forEach(product => {
    const option = document.createElement('option');
    option.value = product.value;
    option.textContent = product.label;
    productSelect.appendChild(option);
  });
  selectedProduct = null;
  applyQuantityRules();
}

// Product selection
productSelect.addEventListener('change', () => {
  selectedProduct = products[selectedService].find(p => p.value === productSelect.value);
  applyQuantityRules();
  updateSummary();
});

// Quantity input
quantityInput.addEventListener('input', updateSummary);

function getSelectedServiceName() {
  return selectedService === 'instagram' ? 'Instagram' : 'Telegram';
}

async function submitSmmOrder() {
  if (!selectedProduct || !quantityInput.value || !linkInput.value) {
    showToast('Iltimos, barcha maydonlarni to‘ldiring.', 'error');
    return;
  }

  const quantity = parseInt(quantityInput.value, 10);
  if (isNaN(quantity) || quantity <= 0 || !isValidQuantity(quantity)) {
    showToast('Iltimos, to‘g‘ri miqdorni kiriting.', 'error');
    return;
  }

  const productName = selectedProduct.label.split(' (')[0];
  let total;
  if (selectedProduct.unit === 'per1000') {
    total = Math.ceil((selectedProduct.price / 1000) * quantity);
  } else if (selectedProduct.unit === 'per100') {
    total = Math.ceil((selectedProduct.price / 100) * quantity);
  } else if (selectedProduct.unit === 'per10') {
    total = Math.ceil((selectedProduct.price / 10) * quantity);
  } else {
    total = selectedProduct.price * quantity;
  }

  const csrfToken = await (async () => {
    try {
      const res = await fetch('/api/csrf-token');
      const { csrfToken } = await res.json();
      return csrfToken;
    } catch { return ''; }
  })();

  const response = await fetch('/api/smm-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({
      platform: getSelectedServiceName(),
      serviceLabel: productName,
      serviceId: selectedProduct.serviceId,
      link: linkInput.value.trim(),
      quantity,
      price: total,
      _csrf: csrfToken
    })
  });
  const data = await response.json();
  if (!response.ok) {
    showToast(data.error || 'SMM buyurtmasi yuborilmadi.', 'error');
    return;
  }

  showToast('SMM buyurtmangiz yuborildi. Admin tasdiqlaydi.', 'success');
  linkInput.value = '';
  quantityInput.value = '';
  productSelect.value = '';
  selectedProduct = null;
  applyQuantityRules();
  updateSummary();
}

// Update summary
function updateSummary() {
  if (!selectedProduct || !quantityInput.value || !linkInput.value) {
    orderSummary.style.display = 'none';
    return;
  }

  const quantity = parseInt(quantityInput.value, 10);
  if (isNaN(quantity) || quantity <= 0 || !isValidQuantity(quantity)) {
    orderSummary.style.display = 'none';
    const rule = getQuantityRule();
    if (rule) {
      quantityNote.textContent = `Iltimos, ${rule.min} dan ${rule.max} gacha va ${rule.step === 1 ? 'butun son' : rule.step + ' qadam'} bilan kiriting.`;
    }
    return;
  }

  const serviceName = selectedService === 'instagram' ? 'Instagram' : 'Telegram';
  const productName = selectedProduct.label.split(' (')[0];
  let total;

  if (selectedProduct.unit === 'per1000') {
    total = Math.ceil((selectedProduct.price / 1000) * quantity);
  } else if (selectedProduct.unit === 'per100') {
    total = Math.ceil((selectedProduct.price / 100) * quantity);
  } else if (selectedProduct.unit === 'per10') {
    total = Math.ceil((selectedProduct.price / 10) * quantity);
  } else {
    total = selectedProduct.price * quantity;
  }

  summaryNetwork.textContent = serviceName;
  summaryProduct.textContent = productName;
  summaryLink.textContent = linkInput.value;
  summaryQuantity.textContent = quantity.toLocaleString();
  summaryTotal.textContent = total.toLocaleString() + ' so\'m';

  orderSummary.style.display = 'block';
}

// Cancel order
cancelOrder.addEventListener('click', () => {
  linkInput.value = '';
  quantityInput.value = '';
  productSelect.value = '';
  selectedProduct = null;
  applyQuantityRules();
  updateSummary();
  showToast('Buyurtma bekor qilindi.', 'warning');
});

// Confirm order
confirmOrder.addEventListener('click', submitSmmOrder);

// Initialize
updateProductOptions();

