/**
 * Создание администратора по умолчанию
 * Запуск: npm run create-admin
 */

const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { dbGet, dbRun } = require('./dbHelpers');

async function createAdmin(username, password) {
  username = username || process.env.ADMIN_USERNAME || 'admin';
  password = password || process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await dbGet('SELECT id FROM admins WHERE username = ?', [username]);

  if (existing) {
    console.log(`Администратор "${username}" уже существует.`);
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await dbRun('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [username, hash]);
  console.log(`Администратор "${username}" успешно создан!`);
}

if (require.main === module) {
  createAdmin().catch(err => {
    console.error('Ошибка:', err.message);
    process.exit(1);
  });
}

module.exports = { createAdmin };