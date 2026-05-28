// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const sqlite3 = require('sqlite3').verbose();
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Startup validation
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'fallback-secret-change-in-production') {
  console.error('ERROR: SESSION_SECRET is not set or is using the default fallback value.');
  process.exit(1);
}

if (!process.env.ADMIN_CHAT_ID) {
  console.error('ERROR: ADMIN_CHAT_ID is not set in environment variables.');
  process.exit(1);
}

const app = express();
const DB_PATH = __dirname + '/database.sqlite';
const ADMIN_CHAT_ID = parseInt(process.env.ADMIN_CHAT_ID, 10);
const TELEGRAM_BOT_HANDLE = process.env.TELEGRAM_BOT_HANDLE || 'smpinbot';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const LOGS_DIR = path.join(__dirname, 'logs');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) return console.error('SQLite error:', err);
  console.log('SQLite database loaded.');
});

// Ensure uploads and logs directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    
    if (allowed.includes(ext) && mimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Faqat jpg, png, pdf fayllar qabul qilinadi.'));
    }
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting for auth endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Juda ko\'p urinish. Keyinroq qayta urinib ko\'ring.',
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Juda ko\'p urinish. Keyinroq qayta urinib ko\'ring.',
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting for order endpoints
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Buyurtmalar juda tez. Keyinroq qayta urinib ko\'ring.',
  standardHeaders: true,
  legacyHeaders: false
});

// Session configuration with production-aware security
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.sqlite',
    dir: __dirname,
    concurrentDB: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// CSRF Token Middleware
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// CSRF Token Verification for POST, PUT, DELETE
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    // Skip CSRF for file uploads and multipart/form-data
    if (req.is('multipart/form-data')) {
      return next();
    }
    const token = req.body._csrf || req.headers['x-csrf-token'] || req.query._csrf;
    if (!token || token !== req.session.csrfToken) {
      return res.status(403).json({ error: 'CSRF token yaroqsiz.' });
    }
  }
  next();
});

app.use(passport.initialize());
app.use(passport.session());

function initDb() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      full_name TEXT,
      telegram_id TEXT UNIQUE,
      telegram_username TEXT,
      balance INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      platform TEXT,
      service_label TEXT,
      service_id INTEGER,
      link TEXT,
      quantity INTEGER,
      price INTEGER,
      payment_method TEXT,
      balance_before INTEGER,
      balance_after INTEGER,
      status TEXT,
      provider TEXT,
      api_order_id TEXT,
      provider_response TEXT,
      server_info TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS telegram_tokens (
      token TEXT PRIMARY KEY,
      type TEXT,
      user_id INTEGER,
      status TEXT,
      telegram_id TEXT,
      telegram_username TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS replenishment_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      amount INTEGER,
      type TEXT,
      receipt_file TEXT,
      status TEXT DEFAULT 'pending',
      admin_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      title TEXT,
      message TEXT,
      data TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
  });
}

// ✅ FIX 1: bcrypt async — event loop bloklanmaydi
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function randomToken() {
  return crypto.randomBytes(18).toString('hex');
}

function getUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function getUserByTelegramId(telegramId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function createUser({ email, password, full_name, telegram_id, telegram_username }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (email, password, full_name, telegram_id, telegram_username) VALUES (?, ?, ?, ?, ?)`,
      [email, password, full_name, telegram_id, telegram_username],
      function (err) {
        if (err) return reject(err);
        getUserById(this.lastID).then(resolve).catch(reject);
      }
    );
  });
}

function createTelegramToken(type, userId = null) {
  return new Promise((resolve, reject) => {
    const token = randomToken();
    db.run(
      `INSERT INTO telegram_tokens (token, type, user_id, status) VALUES (?, ?, ?, ?)`,
      [token, type, userId, 'pending'],
      (err) => {
        if (err) return reject(err);
        resolve(token);
      }
    );
  });
}

function getTelegramToken(token) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM telegram_tokens WHERE token = ?', [token], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function updateTelegramToken(token, fields = {}) {
  const keys = Object.keys(fields);
  if (!keys.length) return Promise.resolve();
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => fields[k]);
  values.push(token);
  return new Promise((resolve, reject) => {
    db.run(`UPDATE telegram_tokens SET ${sets} WHERE token = ?`, values, function (err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

// ✅ FIX 3: SQL fix - completed ni boshqa joyga o'tdirdik
function createOrder(order) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`INSERT INTO orders
      (user_id, type, platform, service_label, service_id, link, quantity, price, payment_method, balance_before, balance_after, status, provider, api_order_id, provider_response, server_info, completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    stmt.run(
      order.user_id,
      order.type,
      order.platform,
      order.service_label,
      order.service_id,
      order.link,
      order.quantity,
      order.price,
      order.payment_method,
      order.balance_before,
      order.balance_after,
      order.status,
      order.provider,
      order.api_order_id,
      order.provider_response,
      order.server_info,
      order.completed,
      function (err) {
        if (err) return reject(err);
        db.get('SELECT * FROM orders WHERE id = ?', [this.lastID], (err2, row) => {
          if (err2) return reject(err2);
          resolve(row);
        });
      }
    );
  });
}

function updateOrderStatus(orderId, status) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId], function (err) {
      if (err) return reject(err);
      resolve();
    });
  });
}

function getOrderById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM orders WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function getApiConfig(serviceId) {
  if (serviceId >= 1 && serviceId <= 9) {
    return { url: 'https://smmya.com/api/v2', key: process.env.SMM_API_KEY_1 };
  }
  if (serviceId >= 10 && serviceId <= 11) {
    return { url: 'https://niva-miners.com/api/v1/', key: process.env.SMM_API_KEY_2 };
  }
  if (serviceId === 12) {
    return { url: 'https://uzbek-seen.uz/api/v2', key: process.env.SMM_API_KEY_3 };
  }
  return null;
}

async function placeSmmApiOrder(serviceId, link, quantity) {
  const config = getApiConfig(serviceId);
  if (!config) return { provider: 'unknown', api_order_id: null, provider_response: 'No provider mapping.' };

  const payload = new URLSearchParams({
    key: config.key,
    action: 'add',
    service: String(serviceId),
    link,
    quantity: String(quantity)
  });

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString()
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (err) { data = { raw: text }; }
    const api_order_id = data.order || data.id || data.order_id || data.result || JSON.stringify(data);
    return {
      provider: config.url,
      api_order_id: api_order_id ? String(api_order_id) : 'unknown',
      provider_response: JSON.stringify(data)
    };
  } catch (err) {
    return {
      provider: config.url,
      api_order_id: null,
      provider_response: `ERROR: ${err.message}`
    };
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

function buildSmmAdminMessage(order, user) {
  const telegramField = formatTelegramField(user);
  const userName = formatName(user);
  return `╔══════════════════════════════╗
║   📣 SMM BUYURTMA BAJARILDI  ║
╚══════════════════════════════╝

📋 BUYURTMA: ${order.id}

👤 MIJOZ:
├ Sayt ID: ${user.id}
├ Telegram ID: ${telegramField}
├ Ism: ${userName}
└ Email: ${user.email || '➖'}

📊 NATIJA:
├ Platforma: ${order.platform}
├ Xizmat: ${order.service_label}
├ Link: ${order.link}
├ Buyurtma: ${order.quantity} ta
├ Bajarildi: ${order.completed} ta ✅
└ API buyurtma ID: ${order.api_order_id || 'unknown'}

💰 TO'LOV:
├ Narx: ${order.price} so'm
└ Tranzaksiya: ${order.api_order_id || order.id}

🕐 ${formatTimestamp()}
`;
}

function buildTopupAdminMessage(order, user, city) {
  const telegramField = formatTelegramField(user);
  const userName = formatName(user);
  return `╔══════════════════════════════╗
║   🎮 YANGI TOP-UP BUYURTMA   ║
╚══════════════════════════════╝

📋 BUYURTMA: ${order.id}

👤 MIJOZ:
├ Sayt ID: ${user.id}
├ Telegram ID: ${telegramField}
├ Ism: ${userName}
└ Email: ${user.email || '➖'}

🎯 BUYURTMA:
├ O'yin: ${order.platform}
├ Paket: ${order.service_label}
├ O'yin ID: ${order.link}
└ Server: ${order.server_info || '➖'}

💰 TO'LOV:
├ Narx: ${order.price} so'm
├ To'lov usuli: ${formatPaymentMethod(order.payment_method)}
├ Balans (oldin): ${order.balance_before} so'm
└ Balans (keyin): ${order.balance_after} so'm

🕐 ${formatTimestamp()}
📍 ${city}

──────────────────────────────
[✅ Bajarildi]  [❌ Rad etish]
[💬 Mijozga yoz]
──────────────────────────────
`;
}

function sendAdminNotification(text, order) {
  if (!bot) {
    console.warn('Telegram bot is disabled; admin notification skipped.');
    return Promise.resolve(null);
  }
  const buttons = [
    [{ text: '✅ Bajarildi', callback_data: `approve_${order.type}_${order.id}` }, { text: '❌ Rad etish', callback_data: `reject_${order.type}_${order.id}` }]
  ];
  return bot.sendMessage(ADMIN_CHAT_ID, text, { reply_markup: { inline_keyboard: buttons } });
}

let bot = null;
if (TELEGRAM_TOKEN) {
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  console.log('Telegram bot initialized.');
} else {
  console.warn('TELEGRAM_BOT_TOKEN is not set. Telegram auth and admin notifications are disabled.');
}

if (bot) {
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim();
    if (!text.startsWith('/start')) return;
    const parts = text.split(' ');
    const payload = parts[1] || '';
    if (!payload) return bot.sendMessage(msg.chat.id, 'Salom! Iltimos, sayt orqali bog\'lang.');

    const [action, token] = payload.split('_');
    if (!action || !token) return bot.sendMessage(msg.chat.id, 'Noto\'g\'ri token.');

    const telegramId = String(msg.from.id);
    const telegramUsername = msg.from.username ? '@' + msg.from.username : 'no_username';
    const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ') || telegramUsername;

    const tokenRow = await getTelegramToken(token).catch(() => null);
    if (!tokenRow) return bot.sendMessage(msg.chat.id, 'Token topilmadi yoki yaroqsiz.');

    if (action === 'link') {
      if (!tokenRow.user_id) return bot.sendMessage(msg.chat.id, 'Bog\'lash uchun to\'g\'ri token emas.');
      const existing = await getUserByTelegramId(telegramId).catch(() => null);
      if (existing && existing.id !== tokenRow.user_id) {
        return bot.sendMessage(msg.chat.id, 'Bu Telegram ID boshqa hisobga ulangan.');
      }
      await new Promise((resolve, reject) => {
        db.run('UPDATE users SET telegram_id = ?, telegram_username = ? WHERE id = ?', [telegramId, telegramUsername, tokenRow.user_id], function (err) {
          if (err) return reject(err);
          resolve();
        });
      });
      await updateTelegramToken(token, { status: 'linked', telegram_id: telegramId, telegram_username: telegramUsername });
      return bot.sendMessage(msg.chat.id, `Telegram muvoffaqiyatli bog\'landi. Hisobingiz: ${fullName}`);
    }

    if (action === 'login') {
      let user = await getUserByTelegramId(telegramId).catch(() => null);
      if (!user) {
        const email = `telegram_${telegramUsername.replace('@', '')}_${telegramId}@smpin.uz`;
        user = await createUser({
          email,
          password: '',
          full_name: fullName,
          telegram_id: telegramId,
          telegram_username: telegramUsername
        });
      }
      await updateTelegramToken(token, { status: 'linked', user_id: user.id, telegram_id: telegramId, telegram_username: telegramUsername });
      return bot.sendMessage(msg.chat.id, `Siz muvaffaqiyatli tizimga kirdingiz. Sayt ID: ${user.id}`);
    }

    return bot.sendMessage(msg.chat.id, 'Token turi aniqlanmadi.');
  });

  bot.on('callback_query', async (query) => {
    const data = query.data || '';

    // Handle replenishment requests
    if (data.startsWith('approve_replenish_') || data.startsWith('reject_replenish_')) {
      const isApprove = data.startsWith('approve_replenish_');
      const replenishId = parseInt(data.split('_').pop(), 10);
      const status = isApprove ? 'approved' : 'rejected';

      await new Promise((resolve, reject) => {
        const sql = `UPDATE replenishment_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        db.run(sql, [status, replenishId], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });

      const replenish = await new Promise((resolve, reject) => {
        db.get(`SELECT * FROM replenishment_requests WHERE id = ?`, [replenishId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (replenish) {
        const user = await getUserById(replenish.user_id);
        if (isApprove && user) {
          // ✅ FIX 4: Tranzaksiya bilan atomic operation
          const newBalance = user.balance + replenish.amount;
          await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
              if (err) return reject(err);
              db.run(`UPDATE users SET balance = ? WHERE id = ?`, [newBalance, user.id], function(err) {
                if (err) {
                  db.run('ROLLBACK', () => reject(err));
                  return;
                }
                db.run('COMMIT', (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });
            });
          });

          await createNotification(
            user.id,
            'balance_approved',
            'Balans qo\'shildi ✅',
            `Sizning ${replenish.amount.toLocaleString()} so'm balans talab tasdiqlandi. Yangi balans: ${newBalance.toLocaleString()} so'm`,
            { amount: replenish.amount, new_balance: newBalance, replenish_id: replenishId }
          );

          if (user.telegram_id) {
            await bot.sendMessage(user.telegram_id,
              `✅ Sizning balans qo'shish so'rovi tasdiqlandi!\n\n💰 Qo'shilgan: ${replenish.amount.toLocaleString()} so'm\n💳 Yangi balans: ${newBalance.toLocaleString()} so'm`,
              { parse_mode: 'Markdown' }
            ).catch(() => null);
          }
        } else if (!isApprove && user) {
          await createNotification(
            user.id,
            'balance_rejected',
            'Balans talab rad etildi',
            `Sizning ${replenish.amount.toLocaleString()} so'm balans talab rad etildi.`,
            { amount: replenish.amount, replenish_id: replenishId }
          );
        }
      }

      await bot.editMessageText(`${query.message.text}\n\n✅ Admin qaror: ${status === 'approved' ? 'TASDIQLANDI' : 'RAD ETILDI'}`, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }).catch(() => null);

      return bot.answerCallbackQuery(query.id, { text: `So'rov ${status === 'approved' ? 'tasdiqlandi' : 'rad etildi'}` });
    }

    // Handle SMM and TopUp orders
    const [action, type, orderId] = data.split('_');
    if (!['approve', 'reject'].includes(action) || !['smm', 'topup'].includes(type) || !orderId) {
      return bot.answerCallbackQuery(query.id, { text: 'Noto\'g\'ri amal.' });
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    await updateOrderStatus(orderId, status);
    const order = await getOrderById(orderId);
    const user = order ? await getUserById(order.user_id) : null;

    await bot.editMessageText(`${query.message.text}\n\n✅ Status: ${status.toUpperCase()}`, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    }).catch(() => null);

    await bot.answerCallbackQuery(query.id, { text: `Buyurtma ${status} qilindi.` });

    if (user?.telegram_id) {
      await bot.sendMessage(user.telegram_id, `Sizning buyurtmangiz #${order.id} ${status} qilindi.`).catch(() => null);
    }
  });
}

function createNotification(userId, type, title, message, data = null) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO notifications (user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [userId, type, title, message, data ? JSON.stringify(data) : null], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Autentifikatsiya talab qilinadi.' });
  }
  next();
}

app.post('/api/register', registerLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Parol kamida 8 ta belgidan iborat bo\'lishi kerak.'),
  body('fullName').trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  try {
    const { email, password, fullName } = req.body;
    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan.' });
    const user = await createUser({
      email,
      password: await hashPassword(password), // ✅ async
      full_name: fullName || '',
      telegram_id: null,
      telegram_username: null
    });
    req.session.userId = user.id;
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Ro\'yxatdan o\'tishda xatolik yuz berdi.' });
  }
});

app.post('/api/login', loginLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Parol talab qilinadi.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  try {
    const { email, password } = req.body;
    const user = await getUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.password))) { // ✅ async
      return res.status(401).json({ error: 'Email yoki parol noto\'g\'ri.' });
    }
    req.session.userId = user.id;
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Tizimga kirishda xatolik yuz berdi.' });
  }
});

app.get('/api/user', async (req, res) => {
  try {
    if (!req.session.userId) return res.json({ user: null });
    const user = await getUserById(req.session.userId);
    res.json({ user });
  } catch (err) {
    res.json({ user: null });
  }
});

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.session.csrfToken });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Chiqishda xatolik yuz berdi.' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.get('/api/telegram/start', async (req, res) => {
  if (!bot) return res.status(503).json({ error: 'Telegram xizmati hozirda mavjud emas.' });
  try {
    const type = req.session.userId ? 'link' : 'login';
    const token = await createTelegramToken(type, req.session.userId || null);
    const payload = `${type}_${token}`;
    const url = `https://t.me/${TELEGRAM_BOT_HANDLE}?start=${payload}`;
    res.json({ token, url, type });
  } catch (err) {
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
    res.status(500).json({ error: 'Status olishda xatolik yuz berdi.' });
  }
});

app.post('/api/telegram/complete', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token talab qilinadi.' });
    const row = await getTelegramToken(token);
    if (!row || row.status !== 'linked') return res.status(400).json({ error: 'Token hali tasdiqlanmadi.' });
    let user = null;
    if (row.user_id) {
      user = await getUserById(row.user_id);
    } else if (row.telegram_id) {
      user = await getUserByTelegramId(row.telegram_id);
    }
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    req.session.userId = user.id;
    res.json({ user });
  } catch (err) {
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
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  try {
    const user = await getUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Foydalanuvchi topilmadi.' });

    const { platform, serviceLabel, serviceId, link, quantity, price } = req.body;

    if (user.balance < Number(price)) {
      return res.status(400).json({ error: 'Balans yetarli emas.' });
    }

    // ✅ FIX 4: Tranzaksiya bilan atomic operation
    const newBalance = user.balance - Number(price);
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) return reject(err);
        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, user.id], function(err) {
          if (err) {
            db.run('ROLLBACK', () => reject(err));
            return;
          }
          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
    });

    const apiResult = await placeSmmApiOrder(Number(serviceId), link, Number(quantity));
    const order = await createOrder({
      user_id: user.id,
      type: 'smm',
      platform,
      service_label: serviceLabel,
      service_id: Number(serviceId),
      link,
      quantity: Number(quantity),
      price: Number(price),
      payment_method: 'API SMM',
      balance_before: user.balance,
      balance_after: newBalance,
      status: 'processing',
      provider: apiResult.provider,
      api_order_id: apiResult.api_order_id,
      provider_response: apiResult.provider_response,
      server_info: null,
      completed: Number(quantity)
    });

    await sendAdminNotification(buildSmmAdminMessage(order, user), order);
    res.json({ order });
  } catch (err) {
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
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  try {
    const user = await getUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Foydalanuvchi topilmadi.' });

    const { platform, serviceLabel, link, quantity, price, payment_method, server_info } = req.body;

    let balanceBefore = user.balance;
    let balanceAfter = user.balance;

    if (payment_method === 'balance') {
      if (user.balance < Number(price)) {
        return res.status(400).json({ error: 'Balans yetarli emas.' });
      }
      balanceAfter = user.balance - Number(price);
      // ✅ FIX 4: Tranzaksiya bilan atomic operation
      await new Promise((resolve, reject) => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) return reject(err);
          db.run('UPDATE users SET balance = ? WHERE id = ?', [balanceAfter, user.id], function(err) {
            if (err) {
              db.run('ROLLBACK', () => reject(err));
              return;
            }
            db.run('COMMIT', (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        });
      });
    }

    const order = await createOrder({
      user_id: user.id,
      type: 'topup',
      platform,
      service_label: serviceLabel,
      service_id: null,
      link,
      quantity: Number(quantity),
      price: Number(price),
      payment_method,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      status: 'pending',
      provider: null,
      api_order_id: null,
      provider_response: null,
      server_info: server_info || null,
      completed: Number(quantity)
    });

    const city = await lookupCity(req.ip);
    await sendAdminNotification(buildTopupAdminMessage(order, user, city), order);
    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: 'Top-up buyurtmasi yuborishda xatolik yuz berdi.' });
  }
});

app.post('/api/replenishment-order', orderLimiter, requireAuth, upload.single('receipt'), [
  body('amount').isInt({ min: 2000, max: 1000000 }).withMessage('Miqdor 2000 dan 1000000 gacha bo\'lishi kerak.'),
  body('type').isIn(['p2p', 'atm', 'admin']).withMessage('Turi noto\'g\'ri.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  try {
    const user = await getUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Foydalanuvchi topilmadi.' });

    if (!bot) {
      return res.status(503).json({ error: 'Telegram bot hozirda mavjud emas.' });
    }

    const amount = parseInt(req.body.amount, 10);
    const type = req.body.type || 'p2p';

    if (!req.file) {
      return res.status(400).json({ error: 'To\'lov kvitansiyasi (fayl) yuborilishi kerak.' });
    }

    const receipt_file = `/uploads/${req.file.filename}`;

    const replenishId = await new Promise((resolve, reject) => {
      const sql = `INSERT INTO replenishment_requests (user_id, amount, type, receipt_file, status)
                   VALUES (?, ?, ?, ?, 'pending')`;
      db.run(sql, [user.id, amount, type, receipt_file], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    let telegramMessage = `
🔔 *BALANS QOʻSHISH SOʻROVI*

👤 *Foydalanuvchi:* ${formatName(user)}
📧 *Email:* ${user.email}
💬 *Telegram:* ${formatTelegramField(user)}
💰 *Miqdor:* ${amount.toLocaleString()} so\'m
💳 *Turi:* ${type === 'p2p' ? 'P2P O\'tkazma' : type === 'atm' ? 'ATM' : 'Admin orqali'}
📝 *Soʻrov ID:* ${replenishId}
⏰ *Vaqti:* ${formatTimestamp()}
🌍 *IP:* ${req.ip}

*📎 To\'lov kvitansiyasi yuborilgan*
    `.trim();

    await bot.sendMessage(ADMIN_CHAT_ID, telegramMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Tasdiqlash', callback_data: `approve_replenish_${replenishId}` },
            { text: '❌ Rad etish', callback_data: `reject_replenish_${replenishId}` }
          ]
        ]
      }
    });

    if (type === 'admin' && bot) {
      const adminMsg = `[BALANS TALAB] ${formatName(user)} - ${amount.toLocaleString()} so\'m (ID: ${replenishId})`;
      await bot.sendMessage('@sanjarf', adminMsg).catch(() => null);
    }

    await createNotification(
      user.id,
      'replenish_request',
      'Balans qo\'shish so\'rovi yuborildi',
      `Sizning ${amount.toLocaleString()} so\'m balans qo\'shish so\'rovi adminga yuborildi. Soʻrov ID: ${replenishId}`,
      { replenish_id: replenishId, amount, type }
    );

    res.json({ message: 'Balans qoʻshish soʻrovi adminga yuborildi.', replenish_id: replenishId });
  } catch (err) {
    console.error('Replenishment error:', err);
    res.status(500).json({ error: 'Balans qoʻshish soʻrovida xatolik yuz berdi.' });
  }
});

app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const notifications = await new Promise((resolve, reject) => {
      const sql = `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`;
      db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: 'Xatolar yuklashda xatolik yuz berdi.' });
  }
});

app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const notifId = parseInt(req.params.id, 10);
    await new Promise((resolve, reject) => {
      const sql = `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`;
      db.run(sql, [notifId, req.session.userId], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Xatoni o\'qish belgilashda xatolik yuz berdi.' });
  }
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const orders = await new Promise((resolve, reject) => {
      const sql = `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`;
      db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Buyurtmalarni yuklashda xatolik yuz berdi.' });
  }
});

// Google OAuth
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
},
(accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  async (req, res) => {
    const profile = req.user;
    const email = profile.emails?.[0]?.value || `google_${profile.id}@smpin.uz`;
    const fullName = profile.displayName || email;
    let user = await getUserByEmail(email).catch(() => null);
    if (!user) {
      user = await createUser({
        email,
        password: '',
        full_name: fullName,
        telegram_id: null,
        telegram_username: null
      });
    }
    req.session.userId = user.id;
    res.redirect('/dashboard.html');
  }
);

// ✅ FIX 2: /uploads/ faqat login qilgan foydalanuvchilarga
app.get('/uploads/:filename', requireAuth, (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Fayl topilmadi.');
  }
  res.sendFile(filePath);
});

const ALLOWED_EXTENSIONS = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.pdf', '.doc', '.docx'];

app.use((req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  const basename = path.basename(req.path);
  if (
    basename === 'server.js' ||
    basename === 'database.sqlite' ||
    basename === 'package.json' ||
    basename === 'package-lock.json' ||
    basename.startsWith('.') ||
    (ext && !ALLOWED_EXTENSIONS.includes(ext))
  ) {
    return res.status(403).send('Forbidden');
  }
  next();
});
app.use(express.static(__dirname));

initDb();

app.listen(3000, () => console.log('Server ishlayapti: http://localhost:3000'));
