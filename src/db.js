/**
 * Модуль подключения к базе данных SQLite
 * Единое подключение для всего приложения
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DB_PATH = path.resolve(__dirname, '..', process.env.DB_PATH || './db/voting.db');

let db = null;

function getDb() {
  if (db) return db;

  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Ошибка подключения к БД:', err.message);
      process.exit(1);
    }
  });

  // Включаем WAL-режим для лучшей производительности
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  return db;
}

function closeDb() {
  if (db) {
    db.close((err) => {
      if (err) console.error('Ошибка при закрытии БД:', err.message);
      db = null;
    });
  }
}

module.exports = { getDb, closeDb, DB_PATH };