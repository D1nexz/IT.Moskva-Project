/**
 * Маршруты для студентов (регистрация, вход, голосование)
 */

const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbQuery } = require('../src/utils/dbHelpers');
const { checkVotingTime } = require('../middleware/votingTime');

// ФИО: фамилия + имя/инициалы (кириллица), например: Иванов Иван, Иванов И.И., Иванов Иван Иванович
const FULL_NAME_REGEX = /^[А-ЯЁ][а-яё]+(?:\s+(?:[А-ЯЁ][а-яё]+|(?:[А-ЯЁ]\.)+)){1,2}$/;

// Формат группы: например 1ИИ-4-26, 1ИИ-1-26, 1ИИ-2-26, ИС-21
const GROUP_REGEX = /^(\d[А-ЯЁ]{2,4}-\d(-\d{1,2})?|[А-ЯЁ]{2,4}-\d{2})$/;

/**
 * POST /api/students/register — регистрация нового студента
 */
router.post('/register', async (req, res) => {
  try {
    const { full_name, group_name } = req.body;

    // Валидация
    if (!full_name || !group_name) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }

    const trimmedName = full_name.trim().replace(/\s+/g, ' ');
    const trimmedGroup = group_name.trim().toUpperCase();

    if (!FULL_NAME_REGEX.test(trimmedName)) {
      return res.status(400).json({
        error: 'ФИО должно содержать минимум 2 слова кириллицей (например: Иванов Иван Иванович)'
      });
    }

    if (!GROUP_REGEX.test(trimmedGroup)) {
      return res.status(400).json({
        error: 'Группа должна быть в формате: 1ИИ-4-26 или ИС-21'
      });
    }

    // Проверка дубликатов
    const existing = await dbGet(
      'SELECT id FROM students WHERE full_name = ? AND group_name = ?',
      [trimmedName, trimmedGroup]
    );

    if (existing) {
      return res.status(409).json({
        error: 'Студент с таким ФИО и группой уже зарегистрирован. Используйте вход.',
        studentId: existing.id
      });
    }

    // Создаём студента
    const result = await dbRun(
      'INSERT INTO students (full_name, group_name) VALUES (?, ?)',
      [trimmedName, trimmedGroup]
    );

    // Создаём сессию
    req.session.studentId = result.lastID;
    req.session.fullName = trimmedName;
    req.session.groupName = trimmedGroup;

    res.status(201).json({
      message: 'Регистрация успешна!',
      student: {
        id: result.lastID,
        full_name: trimmedName,
        group_name: trimmedGroup
      }
    });
  } catch (err) {
    console.error('Ошибка регистрации:', err);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

/**
 * POST /api/students/login — вход по ФИО и группе
 */
router.post('/login', async (req, res) => {
  try {
    const { full_name, group_name } = req.body;

    if (!full_name || !group_name) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }

    const trimmedName = full_name.trim().replace(/\s+/g, ' ');
    const trimmedGroup = group_name.trim().toUpperCase();

    // Валидация: ФИО (можно с инициалами) и группа
    if (!FULL_NAME_REGEX.test(trimmedName)) {
      return res.status(400).json({
        error: 'Введите фамилию и имя (например: Иванов Иван или Иванов И.И.)'
      });
    }

    if (!GROUP_REGEX.test(trimmedGroup)) {
      return res.status(400).json({
        error: 'Группа должна быть в формате: 1ИИ-4-26 или ИС-21'
      });
    }

    let student = await dbGet(
      'SELECT id, full_name, group_name FROM students WHERE full_name = ? AND group_name = ?',
      [trimmedName, trimmedGroup]
    );

    // Регистрация не нужна: если студента нет — создаём автоматически
    if (!student) {
      const result = await dbRun(
        'INSERT INTO students (full_name, group_name) VALUES (?, ?)',
        [trimmedName, trimmedGroup]
      );
      student = {
        id: result.lastID,
        full_name: trimmedName,
        group_name: trimmedGroup
      };
    }

    // Создаём сессию
    req.session.studentId = student.id;
    req.session.fullName = student.full_name;
    req.session.groupName = student.group_name;

    res.json({
      message: 'Вход выполнен!',
      student: {
        id: student.id,
        full_name: student.full_name,
        group_name: student.group_name
      }
    });
  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

/**
 * POST /api/students/logout — выход из системы
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Ошибка при выходе' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Вы вышли из системы' });
  });
});

/**
 * GET /api/students/me — информация о текущем студенте
 */
router.get('/me', (req, res) => {
  if (!req.session || !req.session.studentId) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  res.json({
    student: {
      id: req.session.studentId,
      full_name: req.session.fullName,
      group_name: req.session.groupName
    }
  });
});

/**
 * POST /api/vote — голосование
 */
router.post('/vote', checkVotingTime, async (req, res) => {
  try {
    // Проверка авторизации
    if (!req.session || !req.session.studentId) {
      return res.status(401).json({ error: 'Требуется регистрация' });
    }

    // Проверка времени голосования (серверная)
    if (!req.votingTime.isOpen) {
      return res.status(403).json({
        error: 'Голосование закрыто',
        votingTime: req.votingTime
      });
    }

    const { dish, drink } = req.body;

    if (!dish || !drink) {
      return res.status(400).json({ error: 'Выберите блюдо и напиток' });
    }

    // Проверяем, что блюдо и напиток есть в активном меню
    const validDish = await dbGet(
      "SELECT id FROM menu_items WHERE name = ? AND type = 'dish' AND is_active = 1",
      [dish]
    );

    const validDrink = await dbGet(
      "SELECT id FROM menu_items WHERE name = ? AND type = 'drink' AND is_active = 1",
      [drink]
    );

    if (!validDish || !validDrink) {
      return res.status(400).json({ error: 'Неверный выбор. Пожалуйста, выберите из предложенного меню.' });
    }

    // Получаем сегодняшнюю дату в МСК
    const now = new Date();
    const mskOffset = 3 * 60;
    const mskDate = new Date(now.getTime() + mskOffset * 60 * 1000);
    const today = mskDate.toISOString().split('T')[0];

    // Пытаемся вставить голос (уникальность на уровне БД)
    try {
      const result = await dbRun(
        'INSERT INTO votes (student_id, vote_date, dish, drink) VALUES (?, ?, ?, ?)',
        [req.session.studentId, today, dish, drink]
      );

      res.json({
        message: 'Спасибо, ваш голос учтён!',
        vote: {
          id: result.lastID,
          dish,
          drink,
          date: today
        }
      });
    } catch (dbErr) {
      if (dbErr.message && dbErr.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Вы уже голосовали сегодня' });
      }
      throw dbErr;
    }
  } catch (err) {
    console.error('Ошибка голосования:', err);
    res.status(500).json({ error: 'Ошибка сервера при голосовании' });
  }
});

/**
 * GET /api/vote/status — статус голосования сегодня
 */
router.get('/vote/status', checkVotingTime, async (req, res) => {
  try {
    const now = new Date();
    const mskOffset = 3 * 60;
    const mskDate = new Date(now.getTime() + mskOffset * 60 * 1000);
    const today = mskDate.toISOString().split('T')[0];

    const response = {
      votingOpen: req.votingTime.isOpen,
      votingTime: {
        start: req.votingTime.startTime,
        end: req.votingTime.endTime,
        currentMinutes: req.votingTime.currentMinutes,
        startMinutes: req.votingTime.startMinutes,
        endMinutes: req.votingTime.endMinutes
      }
    };

    // Если студент авторизован — проверяем, голосовал ли он сегодня
    if (req.session && req.session.studentId) {
      const vote = await dbGet(
        'SELECT dish, drink, created_at FROM votes WHERE student_id = ? AND vote_date = ?',
        [req.session.studentId, today]
      );

      response.alreadyVoted = !!vote;
      if (vote) {
        response.myVote = { dish: vote.dish, drink: vote.drink };
      }
    }

    res.json(response);
  } catch (err) {
    console.error('Ошибка получения статуса:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/vote/menu — получение активного меню
 */
router.get('/vote/menu', async (req, res) => {
  try {
    const dishes = await dbQuery(
      "SELECT id, name, emoji FROM menu_items WHERE type = 'dish' AND is_active = 1 ORDER BY sort_order"
    );

    const drinks = await dbQuery(
      "SELECT id, name, emoji FROM menu_items WHERE type = 'drink' AND is_active = 1 ORDER BY sort_order"
    );

    res.json({ dishes, drinks });
  } catch (err) {
    console.error('Ошибка получения меню:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/vote/results — результаты голосования за сегодня
 */
router.get('/vote/results', async (req, res) => {
  try {
    const now = new Date();
    const mskOffset = 3 * 60;
    const mskDate = new Date(now.getTime() + mskOffset * 60 * 1000);
    const today = mskDate.toISOString().split('T')[0];

    // Если передан параметр date, используем его
    const date = req.query.date || today;

    const totalVotes = await dbGet(
      'SELECT COUNT(DISTINCT id) as count FROM votes WHERE vote_date = ?',
      [date]
    );

    const dishResults = await dbQuery(
      `SELECT dish as name, COUNT(*) as votes
       FROM votes WHERE vote_date = ?
       GROUP BY dish
       ORDER BY votes DESC`,
      [date]
    );

    const drinkResults = await dbQuery(
      `SELECT drink as name, COUNT(*) as votes
       FROM votes WHERE vote_date = ?
       GROUP BY drink
       ORDER BY votes DESC`,
      [date]
    );

    // Добавляем проценты
    const total = totalVotes.count || 0;

    const dishResultsWithPercent = dishResults.map(r => ({
      ...r,
      percent: total > 0 ? Math.round((r.votes / total) * 100) : 0
    }));

    const drinkResultsWithPercent = drinkResults.map(r => ({
      ...r,
      percent: total > 0 ? Math.round((r.votes / total) * 100) : 0
    }));

    const winnerDish = dishResultsWithPercent.length > 0 ? dishResultsWithPercent[0] : null;
    const winnerDrink = drinkResultsWithPercent.length > 0 ? drinkResultsWithPercent[0] : null;

    // Проверяем, закрыто ли голосование
    const endSetting = await dbGet("SELECT value FROM settings WHERE key = 'voting_end'");
    const endTime = endSetting ? endSetting.value : '23:59';
    const [endH, endM] = endTime.split(':').map(Number);
    const endMinutes = endH * 60 + endM;
    const currentMinutes = mskDate.getUTCHours() * 60 + mskDate.getUTCMinutes();
    const isClosed = currentMinutes >= endMinutes;

    res.json({
      date,
      totalVotes: total,
      dishes: dishResultsWithPercent,
      drinks: drinkResultsWithPercent,
      winner: isClosed && winnerDish && winnerDrink ? {
        dish: winnerDish.name,
        drink: winnerDrink.name
      } : null,
      votingClosed: isClosed
    });
  } catch (err) {
    console.error('Ошибка получения результатов:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/**
 * GET /api/history — история результатов за последние 7 дней
 */
router.get('/history', async (req, res) => {
  try {
    const days = await dbQuery(
      `SELECT
        vote_date,
        dish,
        drink,
        COUNT(*) OVER (PARTITION BY vote_date, dish) as dish_count
       FROM votes
       WHERE vote_date >= date('now', '-7 days', '+3 hours')
       ORDER BY vote_date DESC, dish_count DESC`
    );

    // Группируем по дням
    const historyMap = {};
    const winnersMap = {};

    for (const row of days) {
      if (!historyMap[row.vote_date]) {
        historyMap[row.vote_date] = { dishes: {}, drinks: {} };
      }
      if (row.dish) {
        historyMap[row.vote_date].dishes[row.dish] = (historyMap[row.vote_date].dishes[row.dish] || 0) + 1;
      }
      if (row.drink) {
        historyMap[row.vote_date].drinks[row.drink] = (historyMap[row.vote_date].drinks[row.drink] || 0) + 1;
      }
    }

    // Определяем победителей каждого дня
    const history = [];
    for (const [date, data] of Object.entries(historyMap)) {
      const bestDish = Object.entries(data.dishes).sort((a, b) => b[1] - a[1])[0];
      const bestDrink = Object.entries(data.drinks).sort((a, b) => b[1] - a[1])[0];
      history.push({
        date,
        winnerDish: bestDish ? bestDish[0] : null,
        winnerDrink: bestDrink ? bestDrink[0] : null
      });
    }

    history.sort((a, b) => b.date.localeCompare(a.date));

    res.json({ history });
  } catch (err) {
    console.error('Ошибка получения истории:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;