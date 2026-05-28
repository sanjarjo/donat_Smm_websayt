# smpin.uz - SMM Panel & O'yin To'ldirish Xizmati

Uzbekiston'ning #1 SMM paneli va o'yin hisob to'ldirish xizmati. Instagram, TikTok, Telegram va 50+ o'yin uchun tezkor va xavfsiz xizmatlar.

## ✨ Xususiyatlari

- 📱 **SMM Xizmatlari**: Instagram (followers, likes, views), Telegram (subscribers, views)
- 🎮 **O'yin To'ldirish**: PUBG, Free Fire, Mobile Legends va boshqalar
- 💳 **To'lovlar**: Payme, Click, Uzcard, Humo, Bank kartasi
- 🔐 **Xavfsizlik**: CSRF protection, bcrypt parol hashlash, rate limiting
- 📧 **Telegram Bot**: Yo'qnavoy bot orqali to'g'ridan-to'g'ri buyurtma berish
- 👥 **Admin Panel**: Buyurtmalar va balans talab boshqaruvi

## 🚀 Tezkor O'rnatish

### Talablar
- Node.js 20.x+
- npm yoki yarn
- SQLite3

### O'rnatish Bosqichlari

1. **Repository ni klonlang**:
```bash
git clone https://github.com/sanjarjo/donat_Smm_websayt.git
cd donat_Smm_websayt
```

2. **Qaramliklar o'rnating**:
```bash
npm install
```

3. **.env faylini sozlang**:
```bash
cp .env.example .env
```

Keyin `.env` faylda quyidagilarni to'ldiring:
```
SESSION_SECRET=your-random-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_BOT_HANDLE=your_bot_username
ADMIN_CHAT_ID=your-admin-chat-id-number
SMM_API_KEY_1=your-smmya-api-key
SMM_API_KEY_2=your-niva-miners-api-key
SMM_API_KEY_3=your-uzbek-seen-api-key
```

4. **Serverni ishga tushiring**:
```bash
npm start
```

Server `http://localhost:3000` da ishga tushadi.

## 📁 Loyiha Tuzilishi

```
.
├── index.html              # Asosiy sahifa
├── topup.html              # O'yin to'ldirish sahifasi
├── smm.html                # SMM xizmatlari sahifasi
├── balance.html            # Balans to'ldirish sahifasi
├── profile.html            # Foydalanuvchi profili
├── notifications.html      # Bildirishnomalar sahifasi
├── order-history.html      # Buyurtmalar tarixi
├── admin.html              # Admin paneli
├── server.js               # Express server
├── script.js               # Asosiy frontend logikasi
├── topup.js                # Topup buyurtma logikasi
├── smm.js                  # SMM buyurtma logikasi
├── balance.js              # Balans logikasi
├── notifications.js        # Bildirishnomalar logikasi
├── styles.css              # CSS stillar
├── database.sqlite         # SQLite database (auto-created)
└── .env.example            # Environment o'zgaruvchilari namunasi
```

## 🔑 Asosiy Xususiyatlar

### Autentifikatsiya
- Email/Parol ro'yxatdan o'tish va kirish
- Google OAuth 2.0 integratsiyasi
- Telegram bot orqali kirish va bog'lash

### Buyurtma Tizimi
- SMM buyurtmalari (Instagram, Telegram)
- O'yin hisob to'ldirish (PUBG, Free Fire, Mobile Legends)
- Balans to'ldirish (P2P o'tkazma, ATM cheki yuklash)
- Admin orqali tasdiqlash/rad etish

### Xavfsizlik
- CSRF token validation
- Bcrypt parol hashlash (12 rounds)
- Rate limiting (login, register, orders)
- Helmet.js CSP headers
- HTTPS ready

## 📝 Environment Sozlamalari

### SESSION_SECRET
Express session uchun random string. Production'da 32+ belgili random qator ishlating.

### Google OAuth
1. [Google Cloud Console](https://console.cloud.google.com) ga kiring
2. Yangi OAuth 2.0 credentials yarating
3. `GOOGLE_CLIENT_ID` va `GOOGLE_CLIENT_SECRET` ni nusxalang

### Telegram Bot
1. [@BotFather](https://t.me/botfather) ga yozing
2. `/newbot` bilan yangi bot yarating
3. `TELEGRAM_BOT_TOKEN` ni oling
4. `ADMIN_CHAT_ID` ni olish uchun [@userinfobot](https://t.me/userinfobot) ga yozing

### SMM API Keys
- **API 1**: [smmya.com](https://smmya.com) - Telegram, TikTok xizmatlari
- **API 2**: [niva-miners.com](https://niva-miners.com) - Instagram followers, likes
- **API 3**: [uzbek-seen.uz](https://uzbek-seen.uz) - Instagram views

## 🐛 Buglar va To'liqlamalar

### Tuzatilgan Buglar ✅
1. **Balance text o'zgaruvchisi** - `som` → `so'm`
2. **SMM link validation** - Faqat URL tekshiruvi (platform-specific validation qo'shildi)
3. **Topup link validation** - URL tekshiruvi o'chirildi (game ID qabul qiladi)
4. **MIME type validation** - Fayl upload'da MIME type tekshiruvi qo'shildi
5. **CSRF Protection** - Token-based CSRF protection qo'shildi
6. **Async operations** - Bcrypt va database operatsiyalari async qilindi

### Qo'shilgan Xususiyatlar ✨
1. `/api/orders` endpoint - Foydalanuvchi buyurtmalarini yuklash
2. `/api/csrf-token` endpoint - CSRF token olish
3. **Notifications Hub** (`notifications.html`) - Barcha bildirishnomalarni ko'rish
4. **Profile Page** (`profile.html`) - Shaxsiy ma'lumot va balans ko'rish
5. **Order History** (`order-history.html`) - Barcha buyurtmalarni ko'rish
6. **Admin Panel** (`admin.html`) - Balans talab va buyurtmalarni boshqarish
7. **.env.example** - Environment sozlamalari namunasi

## 🔧 API Endpoints

### Authentication
- `POST /api/register` - Ro'yxatdan o'tish
- `POST /api/login` - Kirish
- `POST /api/logout` - Chiqish
- `GET /api/user` - Joriy foydalanuvchi ma'lumoti
- `GET /api/csrf-token` - CSRF token olish

### Orders
- `POST /api/smm-order` - SMM buyurtma berish
- `POST /api/topup-order` - O'yin to'ldirish buyurtma berish
- `GET /api/orders` - Foydalanuvchi buyurtmalarini yuklash

### Telegram
- `GET /api/telegram/start` - Telegram bot link yaratish
- `GET /api/telegram/status` - Bot link statusini tekshirish
- `POST /api/telegram/complete` - Telegram autentifikatsiyasini yakunlash

### Balance
- `POST /api/replenishment-order` - Balans to'ldirish talab jo'natish
- `GET /api/notifications` - Bildirishnomalarni yuklash
- `POST /api/notifications/:id/read` - Bildirishnomani o'qilgan deb belgilash

## 🚀 Production Deploy

### Heroku
```bash
git push heroku main
```

### VPS (Ubuntu)
```bash
# Node.js o'rnating
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Loyihani klonlang va o'rnating
git clone <repo> && cd <repo>
npm install

# Supervisor orqali service ya'ratish
sudo apt-get install supervisor
```

### PM2
```bash
npm install -g pm2
pm2 start server.js --name "smpin"
pm2 save
pm2 startup
```

## 📚 Dokumentatsiya

- [Express.js](https://expressjs.com/)
- [Passport.js](http://www.passportjs.org/)
- [SQLite](https://www.sqlite.org/docs.html)
- [Telegram Bot API](https://core.telegram.org/bots/api)

## 📞 Qo'llab-quvvatlash

- **Telegram Bot**: [@smpinbot](https://t.me/smpinbot)
- **Email**: smpinuz@gmail.com

## 📄 Litsenziya

MIT License - Batafsil [LICENSE](LICENSE) faylini ko'ring.

---

**Oxirgi yangilash**: 2026-05-28
