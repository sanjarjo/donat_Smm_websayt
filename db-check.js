const db = require('sqlite3').verbose();
const d = new db.Database('database.sqlite');

d.serialize(() => {
  d.all("SELECT name FROM sqlite_master WHERE type='table'", (e, r) => {
    console.log('=== TABLES ===');
    console.log(r);
  });

  d.all("SELECT * FROM users LIMIT 5", (e, r) => {
    console.log('=== USERS (first 5) ===');
    console.log('Error:', e);
    console.log('Rows:', r);
  });

  d.all("SELECT * FROM orders LIMIT 5", (e, r) => {
    console.log('=== ORDERS (first 5) ===');
    console.log('Error:', e);
    console.log('Rows:', r);
  });

  d.all("SELECT * FROM replenishment_requests LIMIT 5", (e, r) => {
    console.log('=== REPLENISHMENT REQUESTS (first 5) ===');
    console.log('Error:', e);
    console.log('Rows:', r);
  });

  d.all("SELECT * FROM notifications LIMIT 5", (e, r) => {
    console.log('=== NOTIFICATIONS (first 5) ===');
    console.log('Error:', e);
    console.log('Rows:', r);
  });

  d.all("SELECT * FROM telegram_tokens LIMIT 5", (e, r) => {
    console.log('=== TELEGRAM TOKENS (first 5) ===');
    console.log('Error:', e);
    console.log('Rows:', r);
  });

  d.all("PRAGMA table_info(users)", (e, r) => {
    console.log('=== USERS SCHEMA ===');
    console.log(r);
  });

  d.all("PRAGMA integrity_check", (e, r) => {
    console.log('=== INTEGRITY CHECK ===');
    console.log(r);
  });

  setTimeout(() => d.close(), 500);
});
