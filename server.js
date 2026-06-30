require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'telegram-webhook-secret';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID ? parseInt(process.env.ADMIN_CHAT_ID, 10) : null;
const TELEGRAM_BOT_HANDLE = process.env.TELEGRAM_BOT_HANDLE || 'smpinbot';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const PORT = process.env.PORT || 3000;

if (!SUPABASE_URL || !SUPABASE_KEY || !JWT_SECRET) {
  console.error('ERROR: SUPABASE_URL, SUPABASE_KEY, and JWT_SECRET must be set.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  realtime: { timeout: 0 }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    return allowed.includes(ext) && mimeTypes.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Faqat jpg, png, pdf fayllar qabul qilinadi.'));
  }
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'https://ipapi.co'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json());
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept']
}));

// Serve static files BEFORE API routes
app.use(express.static(__dirname, { 
  index: 'index.html',
  maxAge: '1d'
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  message: 'Juda ko\'p urinish. Keyinroq qayta urinib ko\'ring.',
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 50,
  message: 'Juda ko\'p urinish. Keyinroq qayta urinib ko\'ring.',
  standardHeaders: true,
  legacyHeaders: false
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Buyurtmalar juda tez. Keyinroq qayta urinib ko\'ring.',
  standardHeaders: true,
  legacyHeaders: false
});

function generateJwt(user) {
  return jwt.sign({ userId: user.id, email: user.email, isAdmin: !!user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
}

function parseAuthToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

async function requireAuth(req, res, next) {
  const token = parseAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Autentifikatsiya talab qilinadi.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token yaroqsiz yoki muddati tugagan.' });
  }
}

async function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin ruxsati talab qilinadi.' });
  }
  next();
}

async function findUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findUserById(id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createUser({ email, password, full_name }) {
  const hashed = await bcrypt.hash(password, 12);
  const { data, error } = await supabase
    .from('users')
    .insert([{ email, password: hashed, full_name, balance: 0, is_admin: false }])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function createTelegramToken(type, userId = null) {
  const token = crypto.randomBytes(18).toString('hex');
  const { data, error } = await supabase
    .from('telegram_tokens')
    .insert([{ token, type, user_id: userId, status: 'pending' }])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function getTelegramToken(token) {
  const { data, error } = await supabase
    .from('telegram_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function updateTelegramToken(token, updates) {
  const { data, error } = await supabase
    .from('telegram_tokens')
    .update(updates)
    .eq('token', token)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function createOrder(order) {
  const { data, error } = await supabase
    .from('orders')
    .insert([order])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function updateOrderStatus(orderId, status) {
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId);
  if (error) throw error;
}

async function findOrderById(id) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createNotification(userId, type, title, message, data = null) {
  const { error } = await supabase
    .from('notifications')
    .insert([{ user_id: userId, type, title, message, data: data ? JSON.stringify(data) : null }]);
  if (error) throw error;
}

async function lookupCity(ip) {
  if (!ip) return 'Noxira';
  const cleanIp = ip.replace('::ffff:', '');
  try {
    const res = await fetch(`https://ipapi.co/${cleanIp}/city/`);
    if (!res.ok) return 'Noxira';
    const city = (await res.text()).trim();
    return city || 'Noxira';
  } catch {
    return 'Noxira';
  }
}

function formatTelegramField(user) {
  if (!user?.telegram_id || !user?.telegram_username) return '➖';
  return `${user.telegram_username} (${user.telegram_id})`;
}

function formatName(user) {
  return user?.full_name || 'Noxira';
}

function formatPaymentMethod(method) {
  return method || 'Manual';
}

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())} | ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const SMM_SERVICE_CATALOG = {
  1: { label: '30 kunlik obunachi', price: 15000, unit: 'package' },
  2: { label: '60 kunlik obunachi', price: 18000, unit: 'package' },
  3: { label: '90 kunlik obunachi', price: 21000, unit: 'package' },
  4: { label: '120 kunlik obunachi', price: 24000, unit: 'package' },
  5: { label: '180 kunlik obunachi', price: 30000, unit: 'package' },
  6: { label: '365 kunlik obunachi', price: 40000, unit: 'package' },
  7: { label: '30 kunlik Uzbek obunachi', price: 20000, unit: 'package' },
  8: { label: '90 kunlik Uzbek aralash obunachi', price: 30000, unit: 'package' },
  9: { label: 'Oddiy ko\'rishlar', price: 500, unit: 'per1000' },
  10: { label: 'Instagram Kafolatsiz obunachi', price: 10000, unit: 'per1000' },
  11: { label: 'Instagram Oddiy Likelar', price: 5000, unit: 'per1000' },
  12: { label: 'Instagram Oddiy Ko\'rishlar', price: 500, unit: 'per1000' }
};

function calculateSmmPrice(serviceId, quantity) {
  const item = SMM_SERVICE_CATALOG[serviceId];
  if (!item) return null;
  if (item.unit === 'per1000') {
    return Math.ceil((item.price / 1000) * quantity);
  }
  return item.price * quantity;
}

async function placeSmmApiOrder(serviceId, link, quantity) {
  const config = (() => {
    if (serviceId >= 1 && serviceId <= 9) return { url: 'https://smmya.com/api/v2', key: process.env.SMM_API_KEY_1 };
    if (serviceId >= 10 && serviceId <= 11) return { url: 'https://niva-miners.com/api/v1/', key: process.env.SMM_API_KEY_2 };
    if (serviceId === 12) return { url: 'https://uzbek-seen.uz/api/v2', key: process.env.SMM_API_KEY_3 };
    return null;
  })();

  if (!config) return { provider: 'unknown', api_order_id: null, provider_response: 'No provider mapping.' };

  const payload = new URLSearchParams({
    key: config.key,
    action: 'add',
    service: String(serviceId),
    link,
    quantity: String(quantity)
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString(),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    const api_order_id = data.order || data.id || data.order_id || data.result || JSON.stringify(data);
    return { provider: config.url, api_order_id: api_order_id ? String(api_order_id) : 'unknown', provider_response: JSON.stringify(data) };
  } catch (err) {
    clearTimeout(timeout);
    return { provider: config.url, api_order_id: null, provider_response: `ERROR: ${err.message}` };
  }
}

const bot = TELEGRAM_BOT_TOKEN ? new TelegramBot(TELEGRAM_BOT_TOKEN) : null;

if (!TELEGRAM_BOT_TOKEN) {
  console.warn('Telegram bot token is not configured. Telegram webhook will be disabled.');
}

if (bot) {
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim();
    if (!text.startsWith('/start')) return;
    const payload = text.split(' ')[1] || '';
    const [action, token] = payload.split('_');
    if (!action || !token) {
      return bot.sendMessage(msg.chat.id, 'To\'g\'ri /start token yuboring.');
    }

    const telegramId = String(msg.from.id);
    const telegramUsername = msg.from.username ? '@' + msg.from.username : 'no_username';
    const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || telegramUsername;

    const tokenRow = await getTelegramToken(token).catch(() => null);
    if (!tokenRow) {
      return bot.sendMessage(msg.chat.id, 'Token topilmadi yoki muddati tugagan.');
    }

    if (tokenRow.type === 'link') {
      if (!tokenRow.user_id) return bot.sendMessage(msg.chat.id, 'Foydalanuvchi bilan bog\'liq emas.');
      await updateTelegramToken(token, {
        status: 'linked',
        telegram_id: telegramId,
        telegram_username: telegramUsername,
        telegram_full_name: fullName
      });
      return bot.sendMessage(msg.chat.id, 'Telegram hisobingiz muvaffaqiyatli ulandi.');
    }

    if (tokenRow.type === 'login') {
      if (!tokenRow.user_id) return bot.sendMessage(msg.chat.id, 'Token avvalgi foydalanuvchi bilan bog\'lanmagan.');
      await updateTelegramToken(token, {
        status: 'linked',
        telegram_id: telegramId,
        telegram_username: telegramUsername,
        telegram_full_name: fullName
      });
      return bot.sendMessage(msg.chat.id, 'Siz muvaffaqiyatli tizimga kirdingiz. Saytga qayting.');
    }

    return bot.sendMessage(msg.chat.id, 'Token turi noto\'g\'ri.');
  });

  bot.on('callback_query', async (query) => {
    const data = query.data || '';
    if (data.startsWith('approve_replenish_') || data.startsWith('reject_replenish_')) {
      const [action, , id] = data.split('_');
      const status = action === 'approve' ? 'approved' : 'rejected';
      await supabase.from('replenishment_requests').update({ status }).eq('id', id);
      await bot.editMessageText(`${query.message.text}\n\n✅ Status: ${status.toUpperCase()}`, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }).catch(() => null);
      await bot.answerCallbackQuery(query.id, { text: `So\'rov ${status} qilindi.` });
      return;
    }

    const [action, type, orderId] = data.split('_');
    if (!['approve', 'reject'].includes(action) || !['smm', 'topup'].includes(type) || !orderId) {
      return bot.answerCallbackQuery(query.id, { text: 'Noto\'g\'ri buyruq.' });
    }
    const status = action === 'approve' ? 'approved' : 'rejected';
    await updateOrderStatus(orderId, status);
    await bot.editMessageText(`${query.message.text}\n\n✅ Status: ${status.toUpperCase()}`, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    }).catch(() => null);
    await bot.answerCallbackQuery(query.id, { text: `Buyurtma ${status} qilindi.` });
  });
}

app.post('/api/telegram-webhook', express.json({ type: 'application/json' }), async (req, res) => {
  if (!bot) return res.status(503).json({ error: 'Telegram bot yoqilmagan.' });
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];
  if (TELEGRAM_WEBHOOK_SECRET && secretToken !== TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Webhook token noto\'g\'ri.' });
  }
  try {
    await bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error('Telegram webhook error:', err);
    res.sendStatus(500);
  }
});

app.post('/api/register', registerLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Parol kamida 8 ta belgidan iborat bo\'lishi kerak.'),
  body('fullName').trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  try {
    const { email, password, fullName } = req.body;
    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan.' });
    const user = await createUser({ email, password, full_name: fullName || '' });
    res.json({ user, token: generateJwt(user) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Ro\'yxatdan o\'tishda xatolik yuz berdi.' });
  }
});

app.post('/api/login', loginLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Parol talab qilinadi.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail(email);
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri.' });
    }
    res.json({ user, token: generateJwt(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Tizimga kirishda xatolik yuz berdi.' });
  }
});

app.get('/api/user', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    res.json({ user });
  } catch (err) {
    console.error('User fetch error:', err);
    res.status(500).json({ error: 'Foydalanuvchi ma\'lumotini olishda xatolik yuz berdi.' });
  }
});

app.post('/api/telegram/start', requireAuth, async (req, res) => {
  try {
    const token = await createTelegramToken('link', req.user.userId);
    const url = `https://t.me/${TELEGRAM_BOT_HANDLE}?start=link_${token.token}`;
    res.json({ token: token.token, url, type: 'link' });
  } catch (err) {
    console.error('Telegram start error:', err);
    res.status(500).json({ error: 'Telegram token yaratishda xatolik yuz berdi.' });
  }
});

app.get('/api/telegram/status', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ error: 'Token talab qilinadi.' });
    const row = await getTelegramToken(token);
    if (!row) return res.status(404).json({ error: 'Token topilmadi.' });
    res.json({ status: row.status, user_id: row.user_id, telegram_id: row.telegram_id, telegram_username: row.telegram_username });
  } catch (err) {
    console.error('Telegram status error:', err);
    res.status(500).json({ error: 'Status olishda xatolik yuz berdi.' });
  }
});

app.post('/api/telegram/complete', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token talab qilinadi.' });
    const row = await getTelegramToken(token);
    if (!row || row.status !== 'linked') {
      return res.status(400).json({ error: 'Token hali bog\'lanmagan yoki yaroqsiz.' });
    }
    const user = await findUserById(row.user_id);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    res.json({ user, token: generateJwt(user) });
  } catch (err) {
    console.error('Telegram complete error:', err);
    res.status(500).json({ error: 'Telegram kirishini yakunlashda xatolik yuz berdi.' });
  }
});

app.post('/api/smm-order', orderLimiter, requireAuth, [
  body('platform').trim().notEmpty().withMessage('Platform talab qilinadi.'),
  body('serviceLabel').trim().notEmpty().withMessage('Xizmat nomi talab qilinadi.'),
  body('serviceId').isInt({ min: 1 }).withMessage('Xizmat ID noto\'g\'ri.'),
  body('link').trim().notEmpty().withMessage('Link talab qilinadi.'),
  body('quantity').isInt({ min: 1 }).withMessage('Miqdor kamida 1 bo\'lishi kerak.'),
  body('price').isInt({ min: 1 }).withMessage('Narx kamida 1 bo\'lishi kerak.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  try {
    const user = await findUserById(req.user.userId);
    if (!user) return res.status(401).json({ error: 'Foydalanuvchi topilmadi.' });

    const { platform, serviceLabel, serviceId, link, quantity, price } = req.body;
    const serviceIdNum = Number(serviceId);
    const quantityNum = Number(quantity);
    const expectedPrice = calculateSmmPrice(serviceIdNum, quantityNum);
    if (expectedPrice === null) return res.status(400).json({ error: 'Xizmat ID noto\'g\'ri.' });
    if (Number(price) !== expectedPrice) return res.status(400).json({ error: 'Narx noto\'g\'ri.' });
    if (user.balance < expectedPrice) return res.status(400).json({ error: 'Balans yetarli emas.' });

    const newBalance = Number(user.balance) - expectedPrice;
    const { error: balanceError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', user.id);
    if (balanceError) throw balanceError;

    const apiResult = await placeSmmApiOrder(serviceIdNum, link, quantityNum);
    const order = await createOrder({
      user_id: user.id,
      type: 'smm',
      platform,
      service_label: serviceLabel,
      service_id: serviceIdNum,
      link,
      quantity: quantityNum,
      price: expectedPrice,
      payment_method: 'API SMM',
      balance_before: Number(user.balance),
      balance_after: newBalance,
      status: 'processing',
      provider: apiResult.provider,
      api_order_id: apiResult.api_order_id,
      provider_response: apiResult.provider_response,
      server_info: null,
      completed: quantityNum
    });

    await createNotification(user.id, 'smm_order', 'SMM buyurtmangiz qabul qilindi', `Sizning ${serviceLabel} uchun buyurtmangiz qabul qilindi.`, { order_id: order.id });
    res.json({ order });
  } catch (err) {
    console.error('SMM order error:', err);
    res.status(500).json({ error: 'SMM buyurtmasi yuborishda xatolik yuz berdi.' });
  }
});

app.post('/api/topup-order', orderLimiter, requireAuth, [
  body('platform').trim().notEmpty().withMessage('Platform talab qilinadi.'),
  body('serviceLabel').trim().notEmpty().withMessage('Paket nomi talab qilinadi.'),
  body('link').trim().notEmpty().withMessage('O\'yin ID talab qilinadi.'),
  body('quantity').isInt({ min: 1 }).withMessage('Miqdor kamida 1 bo\'lishi kerak.'),
  body('price').isInt({ min: 1 }).withMessage('Narx kamida 1 bo\'lishi kerak.'),
  body('payment_method').trim().notEmpty().withMessage('To\'lov usuli talab qilinadi.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  try {
    const user = await findUserById(req.user.userId);
    if (!user) return res.status(401).json({ error: 'Foydalanuvchi topilmadi.' });

    const { platform, serviceLabel, link, quantity, price, payment_method } = req.body;
    const quantityNum = Number(quantity);
    const priceNum = Number(price);
    const newBalance = Number(user.balance) + priceNum;

    const { error: balanceError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', user.id);
    if (balanceError) throw balanceError;

    const order = await createOrder({
      user_id: user.id,
      type: 'topup',
      platform,
      service_label: serviceLabel,
      service_id: null,
      link,
      quantity: quantityNum,
      price: priceNum,
      payment_method,
      balance_before: Number(user.balance),
      balance_after: newBalance,
      status: 'pending',
      provider: null,
      api_order_id: null,
      provider_response: null,
      server_info: null,
      completed: quantityNum
    });

    const city = await lookupCity(req.ip);
    await createNotification(user.id, 'topup_order', 'Top-up buyurtmangiz qabul qilindi', `Sizning ${priceNum} so\'m top-up buyurtmangiz qabul qilindi.`, { order_id: order.id });

    if (bot && ADMIN_CHAT_ID) {
      await bot.sendMessage(ADMIN_CHAT_ID, `Yangi top-up buyurtma #${order.id}: ${user.email} -> ${priceNum} so\'m`, { parse_mode: 'Markdown' }).catch(() => null);
    }

    res.json({ order });
  } catch (err) {
    console.error('Topup order error:', err);
    res.status(500).json({ error: 'Top-up buyurtmasi yuborishda xatolik yuz berdi.' });
  }
});

app.post('/api/replenishment-order', orderLimiter, requireAuth, upload.single('receipt'), [
  body('amount').isInt({ min: 2000, max: 1000000 }).withMessage('Miqdor 2000 dan 1000000 gacha bo\'lishi kerak.'),
  body('type').isIn(['p2p', 'atm', 'admin']).withMessage('Turi noto\'g\'ri.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  try {
    const user = await findUserById(req.user.userId);
    if (!user) return res.status(401).json({ error: 'Foydalanuvchi topilmadi.' });
    if (!req.file) return res.status(400).json({ error: 'To\'lov kvitansiyasi yuborilishi kerak.' });

    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('smpin-uploads')
      .upload(uniqueName, req.file.buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: req.file.mimetype
      });
    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ error: 'Faylni Supabase Storage-ga yuklashda xatolik yuz berdi.' });
    }

    const { data: urlData, error: urlError } = supabase.storage
      .from('smpin-uploads')
      .getPublicUrl(uniqueName);
    if (urlError || !urlData?.publicUrl) {
      console.error('Supabase public URL error:', urlError);
      return res.status(500).json({ error: 'Fayl URLini olishda xatolik yuz berdi.' });
    }

    const receiptFile = urlData.publicUrl;
    const { data: requestData, error: requestError } = await supabase
      .from('replenishment_requests')
      .insert([{ user_id: user.id, amount: Number(req.body.amount), type: req.body.type, receipt_file: receiptFile, status: 'pending' }])
      .select('*')
      .single();
    if (requestError) throw requestError;

    await createNotification(user.id, 'replenishment_request', 'Balans qo\'shish so\'rovi yuborildi', `Sizning ${req.body.amount} so\'m so\'rovingiz adminga yuborildi.`, { replenish_id: requestData.id });

    if (bot && ADMIN_CHAT_ID) {
      await bot.sendMessage(ADMIN_CHAT_ID, `Yangi balans qo\'shish so\'rovi #${requestData.id} foydalanuvchi: ${user.email}`, { parse_mode: 'Markdown' }).catch(() => null);
    }

    res.json({ message: 'Balans qo\'shish so\'rovi yuborildi.', replenish_id: requestData.id, receipt_url: receiptFile });
  } catch (err) {
    console.error('Replenishment order error:', err);
    res.status(500).json({ error: 'Balans so\'rovida xatolik yuz berdi.' });
  }
});

app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ notifications: data });
  } catch (err) {
    console.error('Notifications fetch error:', err);
    res.status(500).json({ error: 'Xabarlar olishda xatolik yuz berdi.' });
  }
});

app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const notificationId = Number(req.params.id);
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', req.user.userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Notification read error:', err);
    res.status(500).json({ error: 'Xabarni o\'qilgan deb belgilashda xatolik yuz berdi.' });
  }
});

app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', req.user.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ orders: data });
  } catch (err) {
    console.error('Orders fetch error:', err);
    res.status(500).json({ error: 'Buyurtmalarni olishda xatolik yuz berdi.' });
  }
});

app.get('/api/admin/replenishments', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('replenishment_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ replenishments: data });
  } catch (err) {
    console.error('Admin replenishments error:', err);
    res.status(500).json({ error: 'Admin uchun so\'rovlar yuklanmadi.' });
  }
});

app.get('/api/admin/orders', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ orders: data });
  } catch (err) {
    console.error('Admin orders error:', err);
    res.status(500).json({ error: 'Admin buyurtmalar yuklanmadi.' });
  }
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ users: data });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Foydalanuvchilar yuklanmadi.' });
  }
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Fallback catchall for SPA routing (must be LAST route)
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.listen(PORT, () => {
  console.log(`Server ishlayapti: http://localhost:${PORT}`);
});
