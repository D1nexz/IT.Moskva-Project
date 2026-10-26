/**
 * Маршруты администратора
 * Управление меню, просмотр результатов, экспорт
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { dbRun, dbGet, dbQuery } = require('../src/utils/dbHelpers');
const { requireAdmin } = require('../middleware/auth');

// Ограничение попыток входа (защита от перебора пароля)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 20,
  message: { error: 'Слишком много попыток входа, попробуйте позже' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * GET /api/admin/check — проверка сессии администратора
 */
router.get('/check', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

/**
 * POST /api/admin/login — вход администратора
 */
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const admin = await dbGet('SELECT * FROM admins WHERE username = ?', [username]);

    if (!admin) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    req.session.isAdmin = true;
    req.session.adminUsername = admin.username;

    res.json({ message: 'Вход выполнен', admin: { username: admin.username } });
  } catch (err) {
    console.error('Ошибка входа админа:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/admin/logout — выход администратора
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Ошибка' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Выход выполнен' });
  });
});

/**
 * Мини-хелпер: сегодняшняя дата в МСК (ISO YYYY-MM-DD)
 */
function mskToday() {
  const now = new Date();
  const msk = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return msk.toISOString().split('T')[0];
}

/**
 * GET /api/admin/results — результаты за указанную дату
 */
router.get('/results', requireAdmin, async (req, res) => {
  try {
    const date = req.query.date || mskToday();

    const votes = await dbQuery(
      `SELECT v.*, s.full_name, s.group_name
       FROM votes v
       JOIN students s ON v.student_id = s.id
       WHERE v.vote_date = ?
       ORDER BY s.group_name, s.full_name`,
      [date]
    );

    const totalVotes = await dbGet(
      'SELECT COUNT(*) as count FROM votes WHERE vote_date = ?',
      [date]
    );

    const allStudents = await dbQuery(
      `SELECT s.*,
        CASE WHEN v.id IS NOT NULL THEN 1 ELSE 0 END as has_voted
       FROM students s
       LEFT JOIN votes v ON s.id = v.student_id AND v.vote_date = ?
       ORDER BY s.group_name, s.full_name`,
      [date]
    );

    res.json({
      date,
      totalVotes: totalVotes.count,
      votes,
      allStudents
    });
  } catch (err) {
    console.error('Ошибка получения результатов админа:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/admin/results/export — экспорт результатов в CSV
 */
router.get('/results/export', requireAdmin, async (req, res) => {
  try {
    const date = req.query.date || mskToday();

    const votes = await dbQuery(
      `SELECT v.vote_date, s.full_name, s.group_name, v.dish, v.drink, v.created_at
       FROM votes v
       JOIN students s ON v.student_id = s.id
       WHERE v.vote_date = ?
       ORDER BY s.group_name, s.full_name`,
      [date]
    );

    // Формируем CSV
    const headers = 'Дата;ФИО;Группа;Блюдо;Напиток;Время голосования\n';
    const rows = votes.map(v =>
      `${v.vote_date};${v.full_name};${v.group_name};${v.dish};${v.drink};${v.created_at}`
    ).join('\n');

    const csv = '\uFEFF' + headers + rows; // BOM для Excel

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="results-${date}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Ошибка экспорта:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/admin/students — список всех студентов
 */
router.get('/students', requireAdmin, async (req, res) => {
  try {
    const students = await dbQuery(
      'SELECT id, full_name, group_name, created_at FROM students ORDER BY group_name, full_name'
    );
    res.json({ students });
  } catch (err) {
    console.error('Ошибка получения студентов:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/admin/students/:id — удаление студента (и его голосов)
 */
router.delete('/students/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;

    // Удаляем голоса студента
    await dbRun('DELETE FROM votes WHERE student_id = ?', [id]);
    // Удаляем студента
    const result = await dbRun('DELETE FROM students WHERE id = ?', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Студент не найден' });
    }

    res.json({ message: 'Студент удалён' });
  } catch (err) {
    console.error('Ошибка удаления студента:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/admin/menu — управление меню
 */
router.get('/menu', requireAdmin, async (req, res) => {
  try {
    const dishes = await dbQuery(
      "SELECT * FROM menu_items WHERE type = 'dish' ORDER BY sort_order"
    );
    const drinks = await dbQuery(
      "SELECT * FROM menu_items WHERE type = 'drink' ORDER BY sort_order"
    );
    res.json({ dishes, drinks });
  } catch (err) {
    console.error('Ошибка получения меню:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/admin/menu — добавить блюдо
 */
router.post('/menu', requireAdmin, async (req, res) => {
  try {
    const { name, type, emoji } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Заполните название и тип' });
    }

    if (!['dish', 'drink'].includes(type)) {
      return res.status(400).json({ error: 'Тип должен быть dish или drink' });
    }

    const maxSort = await dbGet(
      'SELECT MAX(sort_order) as max FROM menu_items WHERE type = ?',
      [type]
    );

    const result = await dbRun(
      'INSERT INTO menu_items (name, type, emoji, sort_order) VALUES (?, ?, ?, ?)',
      [name, type, emoji || '', (maxSort?.max || 0) + 1]
    );

    res.status(201).json({ message: 'Блюдо добавлено', id: result.lastID });
  } catch (err) {
    console.error('Ошибка добавления блюда:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * PUT /api/admin/menu/:id — обновить блюдо
 */
router.put('/menu/:id', requireAdmin, async (req, res) => {
  try {
    const { name, emoji, is_active } = req.body;
    const id = req.params.id;

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (emoji !== undefined) {
      updates.push('emoji = ?');
      params.push(emoji);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    params.push(id);

    await dbRun(
      `UPDATE menu_items SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ message: 'Блюдо обновлено' });
  } catch (err) {
    console.error('Ошибка обновления блюда:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * DELETE /api/admin/menu/:id — удалить блюдо
 */
router.delete('/menu/:id', requireAdmin, async (req, res) => {
  try {
    const result = await dbRun('DELETE FROM menu_items WHERE id = ?', [req.params.id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Блюдо не найдено' });
    }

    res.json({ message: 'Блюдо удалено' });
  } catch (err) {
    console.error('Ошибка удаления блюда:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/admin/settings — получение настроек
 */
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await dbQuery('SELECT key, value FROM settings');
    const settingsObj = {};
    settings.forEach(s => { settingsObj[s.key] = s.value; });
    res.json({ settings: settingsObj });
  } catch (err) {
    console.error('Ошибка получения настроек:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * Валидация времени в формате ЧЧ:ММ (00:00–23:59)
 */
function isValidTime(str) {
  if (typeof str !== 'string' || !/^\d{2}:\d{2}$/.test(str)) return false;
  const [h, m] = str.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/**
 * PUT /api/admin/settings — обновление настроек
 */
router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const { voting_start, voting_end } = req.body;

    if (voting_start !== undefined && voting_start !== null && voting_start !== '') {
      if (!isValidTime(voting_start)) {
        return res.status(400).json({ error: 'Время должно быть в формате ЧЧ:ММ (00:00–23:59)' });
      }
      await dbRun('UPDATE settings SET value = ? WHERE key = ?', [voting_start, 'voting_start']);
    }

    if (voting_end !== undefined && voting_end !== null && voting_end !== '') {
      if (!isValidTime(voting_end)) {
        return res.status(400).json({ error: 'Время должно быть в формате ЧЧ:ММ (00:00–23:59)' });
      }
      await dbRun('UPDATE settings SET value = ? WHERE key = ?', [voting_end, 'voting_end']);
    }

    res.json({ message: 'Настройки обновлены' });
  } catch (err) {
    console.error('Ошибка обновления настроек:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;