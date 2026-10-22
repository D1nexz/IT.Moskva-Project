/**
 * Главный файл сервера
 * IT.Москва — голосование за обед
 */

const express = require('express');
const session = require('express-session');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// ========== Настройка безопасности ==========

// Helmet для базовой защиты
app.use(helmet({
  contentSecurityPolicy: false, // отключаем для простоты с EJS и встроенными скриптами
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 200,
  message: { error: 'Слишком много запросов, попробуйте позже' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Слишком много попыток входа, попробуйте позже' }
});

app.use(generalLimiter);

// ========== Парсинг тела запроса ==========

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== Статические файлы ==========

app.use(express.static(path.join(__dirname, '../public')));

// ========== Сессии ==========

app.use(session({
  secret: process.env.SESSION_SECRET || 'super-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 дней
  }
}));

// ========== Маршруты ==========

const studentsRouter = require('../routes/students');
const adminRouter = require('../routes/admin');

app.use('/api/students', authLimiter, studentsRouter);
app.use('/api', studentsRouter);
app.use('/api/admin', adminRouter);

// ========== Страницы ==========

// Главная страница — SPA (отдаём index.html для всех путей)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin-login.html'));
});

// ========== Запуск сервера ==========

async function start() {
  try {
    // Инициализируем БД при запуске
    const { initDatabase } = require('./utils/initDb');
    await initDatabase();

    // Создаём администратора по умолчанию
    const { createAdmin } = require('./utils/createAdmin');
    await createAdmin();

    app.listen(PORT, () => {
      console.log(`========================================`);
      console.log(`  🎓 IT.Москва — Голосование за обед`);
      console.log(`  Сервер запущен: http://localhost:${PORT}`);
      console.log(`  Админка: http://localhost:${PORT}/admin`);
      console.log(`========================================`);
    });
  } catch (err) {
    console.error('Ошибка запуска сервера:', err);
    process.exit(1);
  }
}

start();

module.exports = app;