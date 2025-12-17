const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

// Use in-memory database for testing, file-based for production
if (process.env.NODE_ENV === 'test') {
  db = new sqlite3.Database(':memory:');
} else {
  const dbPath = path.resolve(__dirname, '../database/warehouse.db');
  db = new sqlite3.Database(dbPath);
}

// Initialize database with tables
function init() {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      full_name TEXT NOT NULL
    )
  `);

  // Create zones table
  db.run(`
    CREATE TABLE IF NOT EXISTS zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT
    )
  `);

  // Create cells table
  db.run(`
    CREATE TABLE IF NOT EXISTS cells (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zone_id INTEGER NOT NULL,
      row_number INTEGER NOT NULL,
      cell_number INTEGER NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 0,
      current_fill INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (zone_id) REFERENCES zones (id)
    )
  `);

  // Create products table
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      category_id INTEGER,
      unit TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    )
  `);

  // Create inventory table
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cell_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      placed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cell_id) REFERENCES cells (id),
      FOREIGN KEY (product_id) REFERENCES products (id),
      UNIQUE(cell_id, product_id)
    )
  `);

  // Create categories table
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create operations table
  db.run(`
    CREATE TABLE IF NOT EXISTS operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('PUT', 'TAKE', 'MOVE')),
      product_id INTEGER NOT NULL,
      cell_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (cell_id) REFERENCES cells (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  console.log('Database initialized successfully');

  // Check if there are any users, and if not, create a default admin user
  db.get('SELECT COUNT(*) AS count FROM users', [], (err, row) => {
    if (err) {
      console.error('Error checking user count:', err);
    } else if (row.count === 0) {
      // Create a default admin user
      const bcrypt = require('bcrypt');
      bcrypt.hash('admin123', 10, (err, hashedPassword) => {
        if (err) {
          console.error('Error hashing password:', err);
        } else {
          db.run(
            'INSERT INTO users (login, password_hash, role, full_name) VALUES (?, ?, ?, ?)',
            ['admin', hashedPassword, 'admin', 'Administrator'],
            function (err) {
              if (err) {
                console.error('Error creating admin user:', err);
              } else {
                console.log('Default admin user created: login: admin, password: admin123');
              }
            }
          );
        }
      });
    }
  });

}

// Helper functions to query the database
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

module.exports = {
  init,
  query,
  all,
  get
};