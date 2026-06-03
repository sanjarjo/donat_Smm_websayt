const db = require('sqlite3').verbose();
const d = new db.Database('database.sqlite');
const idx = [
  // ✅ FIX 7: Authentication indexes
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)',
  // Order indexes
  'CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
  'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)',
  // Notification indexes
  'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read)',
  // Replenishment indexes
  'CREATE INDEX IF NOT EXISTS idx_replenishment_user_id ON replenishment_requests(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_replenishment_status ON replenishment_requests(status)'
];
let i = 0;
function next() {
  if (i >= idx.length) {
    d.all("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'", (e, r) => {
      console.log('Indexes:', r);
      d.close();
    });
    return;
  }
  d.run(idx[i++], () => next());
}
next();
