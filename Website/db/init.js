// db/init.js - Database initialization for paper trading
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(__dirname, 'trading.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
export function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      reset_otp_hash TEXT,
      reset_otp_expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS paper_wallets (
      user_id TEXT PRIMARY KEY,
      balance REAL NOT NULL DEFAULT 0,
      reserved REAL NOT NULL DEFAULT 0,
      intraday_leverage REAL NOT NULL DEFAULT 5,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const userColumns = db.prepare(`PRAGMA table_info(users)`).all();
  const columnNames = new Set(userColumns.map((col) => col.name));

  if (!columnNames.has('phone')) {
    db.exec(`ALTER TABLE users ADD COLUMN phone TEXT`);
  }
  if (!columnNames.has('reset_otp_hash')) {
    db.exec(`ALTER TABLE users ADD COLUMN reset_otp_hash TEXT`);
  }
  if (!columnNames.has('reset_otp_expires_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN reset_otp_expires_at DATETIME`);
  }

  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON users(phone)`);

  // Paper holdings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS paper_holdings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 0,
      avg_price REAL NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, symbol)
    )
  `);

  // Paper orders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS paper_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      product_type TEXT NOT NULL DEFAULT 'DELIVERY' CHECK(product_type IN ('DELIVERY', 'INTRADAY')),
      order_type TEXT NOT NULL DEFAULT 'MARKET' CHECK(order_type IN ('MARKET', 'LIMIT', 'STOP_LOSS')),
      side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
      qty INTEGER NOT NULL,
      price REAL NOT NULL,
      trigger_price REAL,
      reserved_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'FILLED' CHECK(status IN ('FILLED', 'PENDING', 'CANCELLED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  const orderColumns = db.prepare(`PRAGMA table_info(paper_orders)`).all();
  const orderColumnNames = new Set(orderColumns.map((col) => col.name));
  if (!orderColumnNames.has('product_type')) {
    db.exec(`ALTER TABLE paper_orders ADD COLUMN product_type TEXT NOT NULL DEFAULT 'DELIVERY' CHECK(product_type IN ('DELIVERY', 'INTRADAY'))`);
  }
  if (!orderColumnNames.has('order_type')) {
    db.exec(`ALTER TABLE paper_orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'MARKET' CHECK(order_type IN ('MARKET', 'LIMIT', 'STOP_LOSS'))`);
  }
  if (!orderColumnNames.has('trigger_price')) {
    db.exec(`ALTER TABLE paper_orders ADD COLUMN trigger_price REAL`);
  }
  if (!orderColumnNames.has('reserved_amount')) {
    db.exec(`ALTER TABLE paper_orders ADD COLUMN reserved_amount REAL NOT NULL DEFAULT 0`);
  }

  const orderTableInfo = db.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'paper_orders'
  `).get();
  const orderTableSql = String(orderTableInfo?.sql || '');
  if (orderTableSql && !orderTableSql.includes("'STOP_LOSS'")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS paper_orders_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        product_type TEXT NOT NULL DEFAULT 'DELIVERY' CHECK(product_type IN ('DELIVERY', 'INTRADAY')),
        order_type TEXT NOT NULL DEFAULT 'MARKET' CHECK(order_type IN ('MARKET', 'LIMIT', 'STOP_LOSS')),
        side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
        qty INTEGER NOT NULL,
        price REAL NOT NULL,
        trigger_price REAL,
        reserved_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'FILLED' CHECK(status IN ('FILLED', 'PENDING', 'CANCELLED')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec(`
      INSERT INTO paper_orders_new (
        id, user_id, symbol, product_type, order_type, side, qty, price, trigger_price, reserved_amount, status, created_at
      )
      SELECT
        id, user_id, symbol, product_type, order_type, side, qty, price, trigger_price, reserved_amount, status, created_at
      FROM paper_orders
    `);
    db.exec(`DROP TABLE paper_orders`);
    db.exec(`ALTER TABLE paper_orders_new RENAME TO paper_orders`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS paper_intraday_positions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      net_qty INTEGER NOT NULL DEFAULT 0,
      avg_price REAL NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, symbol)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS paper_intraday_squareoff_runs (
      market_date TEXT PRIMARY KEY,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_paper_orders_user_product_created ON paper_orders(user_id, product_type, created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_paper_orders_status_created ON paper_orders(status, created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_intraday_positions_user_symbol ON paper_intraday_positions(user_id, symbol)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_wallets_user ON paper_wallets(user_id)`);

  db.exec(`
    INSERT INTO paper_wallets (user_id)
    SELECT u.id
    FROM users u
    LEFT JOIN paper_wallets w ON w.user_id = u.id
    WHERE w.user_id IS NULL
  `);

  console.log('✅ Database initialized successfully');
}

// Initialize on import
initializeDatabase();

export default db;
