/**
 * Инициализация базы данных SQLite
 * Создаёт все таблицы и начальные данные.
 * Использует единое подключение из db.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { getDb } = require('../db');

/** Promise-обёртка для db.run */
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/** Promise-обёртка для db.get */
function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function initDatabase() {
  console.log('Инициализация базы данных...');

  // Включаем WAL режим и внешние ключи
  getDb().run('PRAGMA journal_mode = WAL');
  getDb().run('PRAGMA foreign_keys = ON');

  // Создаём таблицы
  await runAsync(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      group_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', '+3 hours')),
      UNIQUE(full_name, group_name)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      vote_date TEXT NOT NULL,
      dish TEXT NOT NULL,
      drink TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', '+3 hours')),
      FOREIGN KEY (student_id) REFERENCES students(id),
      UNIQUE(student_id, vote_date)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('dish', 'drink')),
      emoji TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);

  // Заполняем меню по умолчанию, если таблица пуста
  const menuCount = await getAsync('SELECT COUNT(*) as count FROM menu_items');

  if (menuCount.count === 0) {
    const items = [
      ['Бургер и картошка фри', 'dish', '🍔', 0],
      ['Пицца', 'dish', '🍕', 1],
      ['Оладьи', 'dish', '🥞', 2],
      ['Шашлык', 'dish', '🥩', 3],
      ['Салат Цезарь', 'dish', '🥗', 4],
      ['Овощной салат', 'dish', '🥬', 5],
      ['Куриные крылышки с картошкой', 'dish', '🍗', 6],
      ['Лапша', 'dish', '🍜', 7],
      ['Хот-дог', 'dish', '🌭', 8],
      ['Шаурма', 'dish', '🥙', 9],
      ['Ролл', 'dish', '🍣', 10],
      ['Сок', 'drink', '🧃', 100],
      ['Чай', 'drink', '🫖', 101],
      ['Какао', 'drink', '☕', 102]
    ];

    const stmt = getDb().prepare(
      'INSERT INTO menu_items (name, type, emoji, sort_order) VALUES (?, ?, ?, ?)'
    );

    for (const [name, type, emoji, order] of items) {
      stmt.run(name, type, emoji, order);
    }
    stmt.finalize();
  }

  // Устанавливаем настройки по умолчанию
  const defaultSettings = [
    ['voting_start', process.env.VOTING_START_TIME || '18:00'],
    ['voting_end', process.env.VOTING_END_TIME || '23:59'],
    ['timezone', 'Europe/Moscow']
  ];

  for (const [key, value] of defaultSettings) {
    await runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  console.log('База данных успешно инициализирована');
}

// При прямом запуске — инициализируем БД
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Ошибка:', err);
      process.exit(1);
    });
}

module.exports = { initDatabase };