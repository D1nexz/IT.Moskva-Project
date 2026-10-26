/**
 * IT.Москва — Голосование за обед
 * Frontend SPA приложение
 */

// ========== Состояние приложения ==========
const state = {
  student: null,       // { id, full_name, group_name }
  menu: { dishes: [], drinks: [] },
  currentView: 'auth',
  selectedDish: null,
  selectedDrink: null,
  votingOpen: false,
  alreadyVoted: false,
  votingTimer: null
};

// ========== DOM-ссылки ==========
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
  // Навигация
  navVoting: $('#navVoting'),
  navResults: $('#navResults'),
  navHistory: $('#navHistory'),
  logoutBtn: $('#logoutBtn'),
  burgerBtn: $('#burgerBtn'),
  mainNav: $('#mainNav'),

  // Авторизация
  viewAuth: $('#viewAuth'),
  loginForm: $('#loginForm'),
  loginError: $('#loginError'),
  loginName: $('#loginName'),
  loginGroup: $('#loginGroup'),

  // Голосование
  viewVoting: $('#viewVoting'),
  votingDate: $('#votingDate'),
  votingTimer: $('#votingTimer'),
  timerValue: $('#timerValue'),
  votingClosedMsg: $('#votingClosedMsg'),
  voteSuccess: $('#voteSuccess'),
  voteSuccessChoice: $('#voteSuccessChoice'),
  votingForm: $('#votingForm'),
  dishesGrid: $('#dishesGrid'),
  drinksGrid: $('#drinksGrid'),
  submitVoteBtn: $('#submitVoteBtn'),
  voteError: $('#voteError'),
  votingResults: $('#votingResults'),
  votingHeader: document.querySelector('.voting-header'),

  // Результаты
  viewResults: $('#viewResults'),
  resultsPage: $('#resultsPage'),

  // История
  viewHistory: $('#viewHistory'),
  historyList: $('#historyList'),

  // Футер
  footerYear: $('#footerYear')
};

// ========== Вспомогательные функции ==========

/** Форматирует дату в МСК */
function getMskDate() {
  const now = new Date();
  const mskOffset = 3 * 60;
  return new Date(now.getTime() + mskOffset * 60 * 1000);
}

/** Форматирует дату для отображения */
function formatDateDisplay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00+03:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Показывает ошибку */
function showError(el, msg) {
  if (el) el.textContent = msg;
}

/** Очищает ошибку */
function clearError(el) {
  if (el) el.textContent = '';
}

// ========== API-запросы ==========

// Флаг локального режима: включается, если бэкенд недоступен
// (например, при деплое на GitHub Pages, где /api/* отдаёт HTML вместо JSON)
let localMode = false;

/**
 * Показывает баннер о локальном режиме (один раз).
 * В этом режиме данные хранятся в localStorage браузера.
 */
function notifyLocalMode() {
  if (localMode) return;
  localMode = true;

  const banner = document.createElement('div');
  banner.id = 'localModeBanner';
  banner.setAttribute('role', 'status');
  Object.assign(banner.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '9999',
    background: '#fef3c7',
    color: '#92400e',
    padding: '10px 16px',
    fontSize: '0.85rem',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
  });
  banner.textContent = '⚠️ Сервер недоступен — включён локальный режим (данные хранятся в этом браузере).';
  document.body.prepend(banner);
}

// ========== Локальный API (для статического хостинга) ==========

const LS_STUDENTS = 'itm_students';
const LS_VOTES = 'itm_votes';
const LS_MENU = 'itm_menu';
const LS_SESSION = 'itm_session';
const LS_SETTINGS = 'itm_settings';

const MSK_OFFSET_MIN = 3 * 60;

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* ignore */
  }
}

function getMskDateString() {
  const now = new Date();
  const msk = new Date(now.getTime() + MSK_OFFSET_MIN * 60 * 1000);
  return msk.toISOString().split('T')[0];
}

function getMskMinuteOfDay() {
  const now = new Date();
  const msk = new Date(now.getTime() + MSK_OFFSET_MIN * 60 * 1000);
  return msk.getUTCHours() * 60 + msk.getUTCMinutes();
}

function getLocalSettings() {
  return Object.assign(
    { voting_start: '18:00', voting_end: '23:59' },
    lsGet(LS_SETTINGS, {})
  );
}

function getLocalMenu() {
  const cached = lsGet(LS_MENU, null);
  if (cached) return cached;

  const menu = {
    dishes: [
      { id: 1, name: 'Бургер и картошка фри', emoji: '🍔' },
      { id: 2, name: 'Пицца', emoji: '🍕' },
      { id: 3, name: 'Оладьи', emoji: '🥞' },
      { id: 4, name: 'Шашлык', emoji: '🥩' },
      { id: 5, name: 'Салат Цезарь', emoji: '🥗' },
      { id: 6, name: 'Овощной салат', emoji: '🥬' },
      { id: 7, name: 'Куриные крылышки с картошкой', emoji: '🍗' },
      { id: 8, name: 'Лапша', emoji: '🍜' },
      { id: 9, name: 'Хот-дог', emoji: '🌭' },
      { id: 10, name: 'Шаурма', emoji: '🥙' },
      { id: 11, name: 'Ролл', emoji: '🍣' }
    ],
    drinks: [
      { id: 12, name: 'Сок', emoji: '🧃' },
      { id: 13, name: 'Чай', emoji: '🫖' },
      { id: 14, name: 'Какао', emoji: '☕' }
    ]
  };
  lsSet(LS_MENU, menu);
  return menu;
}

function getLocalSession() {
  return lsGet(LS_SESSION, null);
}

function setLocalSession(studentId) {
  if (studentId) {
    lsSet(LS_SESSION, { studentId });
  } else {
    try { localStorage.removeItem(LS_SESSION); } catch (e) { /* ignore */ }
  }
}

function localLogin(body) {
  const full_name = (body && body.full_name) || '';
  const group_name = (body && body.group_name) || '';

  if (!full_name || !group_name) throw new Error('Заполните все поля');

  const trimmedName = full_name.trim().replace(/\s+/g, ' ');
  const trimmedGroup = group_name.trim().toUpperCase();

  const nameRegex = /^[А-ЯЁ][а-яё]+(?:\s+(?:[А-ЯЁ][а-яё]+|(?:[А-ЯЁ]\.)+)){1,2}$/;
  const groupRegex = /^(\d[А-ЯЁ]{2,4}-\d(-\d{1,2})?|[А-ЯЁ]{2,4}-\d{2})$/;

  if (!nameRegex.test(trimmedName)) {
    throw new Error('Введите фамилию и имя (например: Иванов Иван или Иванов И.И.)');
  }
  if (!groupRegex.test(trimmedGroup)) {
    throw new Error('Группа должна быть в формате: 1ИИ-4-26 или ИС-21');
  }

  const students = lsGet(LS_STUDENTS, []);

  // Без регистрации: если студента нет — создаём автоматически
  let student = students.find(s => s.full_name === trimmedName && s.group_name === trimmedGroup);
  if (!student) {
    student = {
      id: students.length ? Math.max(...students.map(s => s.id)) + 1 : 1,
      full_name: trimmedName,
      group_name: trimmedGroup,
      created_at: new Date().toISOString()
    };
    students.push(student);
    lsSet(LS_STUDENTS, students);
  }

  setLocalSession(student.id);

  return {
    message: 'Вход выполнен!',
    student: { id: student.id, full_name: student.full_name, group_name: student.group_name }
  };
}

function localVoteStatus() {
  const settings = getLocalSettings();
  const [sh, sm] = settings.voting_start.split(':').map(Number);
  const [eh, em] = settings.voting_end.split(':').map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const currentMinutes = getMskMinuteOfDay();

  const response = {
    votingOpen: currentMinutes >= startMinutes && currentMinutes < endMinutes,
    votingTime: {
      start: settings.voting_start,
      end: settings.voting_end,
      currentMinutes,
      startMinutes,
      endMinutes
    }
  };

  const session = getLocalSession();
  if (session && session.studentId) {
    const today = getMskDateString();
    const vote = lsGet(LS_VOTES, []).find(v =>
      v.student_id === session.studentId && v.vote_date === today
    );
    response.alreadyVoted = !!vote;
    if (vote) response.myVote = { dish: vote.dish, drink: vote.drink };
  }

  return response;
}

function localCastVote(body) {
  const session = getLocalSession();
  if (!session || !session.studentId) throw new Error('Требуется регистрация');

  const dish = (body && body.dish) || '';
  const drink = (body && body.drink) || '';

  if (!dish || !drink) throw new Error('Выберите блюдо и напиток');

  const menu = getLocalMenu();
  const validDish = menu.dishes.find(d => d.name === dish);
  const validDrink = menu.drinks.find(d => d.name === drink);

  if (!validDish || !validDrink) {
    throw new Error('Неверный выбор. Пожалуйста, выберите из предложенного меню.');
  }

  const status = localVoteStatus();
  if (!status.votingOpen) throw new Error('Голосование закрыто');

  const today = getMskDateString();
  const votes = lsGet(LS_VOTES, []);
  const existing = votes.find(v =>
    v.student_id === session.studentId && v.vote_date === today
  );
  if (existing) throw new Error('Вы уже голосовали сегодня');

  const vote = {
    id: votes.length ? Math.max(...votes.map(v => v.id)) + 1 : 1,
    student_id: session.studentId,
    vote_date: today,
    dish,
    drink,
    created_at: new Date().toISOString()
  };
  votes.push(vote);
  lsSet(LS_VOTES, votes);

  return {
    message: 'Спасибо, ваш голос учтён!',
    vote: { id: vote.id, dish, drink, date: today }
  };
}

function localResults(date) {
  const votes = lsGet(LS_VOTES, []).filter(v => v.vote_date === date);
  const total = votes.length;

  const dishMap = {};
  const drinkMap = {};
  votes.forEach(v => {
    dishMap[v.dish] = (dishMap[v.dish] || 0) + 1;
    drinkMap[v.drink] = (drinkMap[v.drink] || 0) + 1;
  });

  const dishes = Object.entries(dishMap)
    .map(([name, count]) => ({
      name,
      votes: count,
      percent: total ? Math.round((count / total) * 100) : 0
    }))
    .sort((a, b) => b.votes - a.votes);

  const drinks = Object.entries(drinkMap)
    .map(([name, count]) => ({
      name,
      votes: count,
      percent: total ? Math.round((count / total) * 100) : 0
    }))
    .sort((a, b) => b.votes - a.votes);

  const settings = getLocalSettings();
  const [eh, em] = settings.voting_end.split(':').map(Number);
  const isClosed = getMskMinuteOfDay() >= (eh * 60 + em);

  return {
    date,
    totalVotes: total,
    dishes,
    drinks,
    winner: isClosed && dishes[0] && drinks[0]
      ? { dish: dishes[0].name, drink: drinks[0].name }
      : null,
    votingClosed: isClosed
  };
}

function localHistory() {
  const votes = lsGet(LS_VOTES, []);
  const daysMap = {};

  votes.forEach(v => {
    if (!daysMap[v.vote_date]) {
      daysMap[v.vote_date] = { dishes: {}, drinks: {} };
    }
    daysMap[v.vote_date].dishes[v.dish] = (daysMap[v.vote_date].dishes[v.dish] || 0) + 1;
    daysMap[v.vote_date].drinks[v.drink] = (daysMap[v.vote_date].drinks[v.drink] || 0) + 1;
  });

  const history = Object.entries(daysMap).map(([date, data]) => {
    const bestDish = Object.entries(data.dishes).sort((a, b) => b[1] - a[1])[0];
    const bestDrink = Object.entries(data.drinks).sort((a, b) => b[1] - a[1])[0];
    return {
      date,
      winnerDish: bestDish ? bestDish[0] : null,
      winnerDrink: bestDrink ? bestDrink[0] : null
    };
  });
  history.sort((a, b) => b.date.localeCompare(a.date));

  return { history };
}

function localApiRequest(url, method = 'GET', body = null) {
  const path = url.split('?')[0];

  if (method === 'POST' && path === '/api/students/login') return localLogin(body);

  if (method === 'POST' && path === '/api/students/logout') {
    setLocalSession(null);
    return { message: 'Вы вышли из системы' };
  }

  if (method === 'GET' && path === '/api/students/me') {
    const session = getLocalSession();
    const student = session && session.studentId
      ? lsGet(LS_STUDENTS, []).find(s => s.id === session.studentId)
      : null;
    if (!student) throw new Error('Не авторизован');
    return {
      student: { id: student.id, full_name: student.full_name, group_name: student.group_name }
    };
  }

  if (method === 'GET' && path === '/api/vote/menu') {
    const menu = getLocalMenu();
    return { dishes: menu.dishes, drinks: menu.drinks };
  }

  if (method === 'GET' && path === '/api/vote/status') return localVoteStatus();
  if (method === 'POST' && path === '/api/vote') return localCastVote(body);

  if (method === 'GET' && path === '/api/vote/results') {
    const date = new URLSearchParams(url.split('?')[1] || '').get('date') || getMskDateString();
    return localResults(date);
  }

  if (method === 'GET' && path === '/api/history') return localHistory();

  throw new Error('Маршрут не найден: ' + url);
}

// Основная функция запросов к API.
// Если сервер отвечает не-JSON (например, HTML-404 от статического хостинга),
// автоматически переключается на локальный режим — ошибка "not valid JSON" исчезает.
async function apiRequest(url, method = 'GET', body = null) {
  // Уже в локальном режиме — не пытаемся снова стучаться на сервер
  if (localMode) return localApiRequest(url, method, body);

  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    // Сеть недоступна → локальный режим
    notifyLocalMode();
    return localApiRequest(url, method, body);
  }

  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    // Сервер вернул HTML (типично для GitHub Pages и других статических хостингов)
    notifyLocalMode();
    return localApiRequest(url, method, body);
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    // Некорректный JSON → считаем, что бэкенда нет
    notifyLocalMode();
    return localApiRequest(url, method, body);
  }

  if (!res.ok) {
    throw new Error(data.error || 'Ошибка сервера');
  }

  return data;
}

// ========== Управление представлениями ==========

function showView(viewName) {
  // Скрываем все представления
  $$('.view').forEach(v => v.style.display = 'none');

  // Показываем нужное
  const view = document.getElementById('view' + viewName.charAt(0).toUpperCase() + viewName.slice(1));
  if (view) view.style.display = 'block';

  state.currentView = viewName;

  // Обновляем активную кнопку навигации
  $$('.header__nav-btn[data-view]').forEach(btn => {
    btn.classList.toggle('header__nav-btn--active', btn.dataset.view === viewName);
  });
}

function showAuthView() {
  showView('auth');
  DOM.navVoting.style.display = 'none';
  DOM.navResults.style.display = 'none';
  DOM.navHistory.style.display = 'none';
  DOM.logoutBtn.style.display = 'none';
}

function showAppView() {
  showView('voting');
  DOM.navVoting.style.display = 'inline-flex';
  DOM.navResults.style.display = 'inline-flex';
  DOM.navHistory.style.display = 'inline-flex';
  DOM.logoutBtn.style.display = 'inline-flex';
}

// ========== Авторизация ==========

// Вход (без регистрации — создаётся автоматически на сервере)
DOM.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(DOM.loginError);
  const submitBtn = DOM.loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = '⏳ Входим...';

  const full_name = DOM.loginName.value.trim();
  const group_name = DOM.loginGroup.value.trim();

  // Валидация на клиенте
  const nameRegex = /^[А-ЯЁ][а-яё]+(?:\s+(?:[А-ЯЁ][а-яё]+|(?:[А-ЯЁ]\.)+)){1,2}$/;
  const groupRegex = /^(\d[А-ЯЁ]{2,4}-\d(-\d{1,2})?|[А-ЯЁ]{2,4}-\d{2})$/;

  if (!nameRegex.test(full_name)) {
    showError(DOM.loginError, 'Введите фамилию и имя (например: Иванов Иван или Иванов И.И.)');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    return;
  }

  if (!groupRegex.test(group_name.toUpperCase())) {
    showError(DOM.loginError, 'Группа должна быть в формате: 1ИИ-4-26 или ИС-21');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    return;
  }

  try {
    const data = await apiRequest('/api/students/login', 'POST', { full_name, group_name });
    state.student = data.student;
    showAppView();
    initVoting();
    updateNavForStudent();
  } catch (err) {
    showError(DOM.loginError, err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

// Выход
DOM.logoutBtn.addEventListener('click', async () => {
  try {
    await apiRequest('/api/students/logout', 'POST');
  } catch (e) { /* ignore */ }
  state.student = null;
  state.selectedDish = null;
  state.selectedDrink = null;
  state.alreadyVoted = false;
  showAuthView();
  DOM.loginForm.reset();
  clearTimeout(state.votingTimer);
});

function updateNavForStudent() {
  if (state.student) {
    // Показываем имя пользователя в nav
    DOM.navVoting.textContent = `🍽️ ${state.student.full_name}`;
  }
}

// ========== Голосование ==========

async function initVoting() {
  // Показываем дату
  const mskDate = getMskDate();
  DOM.votingDate.textContent = mskDate.toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Загружаем меню
  try {
    const menuData = await apiRequest('/api/vote/menu');
    state.menu = menuData;
    renderMenu();
  } catch (err) {
    console.error('Ошибка загрузки меню:', err);
  }

  // Загружаем статус голосования
  await loadVotingStatus();

  // Загружаем результаты
  await loadResults();
}

function renderMenu() {
  // Блюда
  DOM.dishesGrid.innerHTML = state.menu.dishes.map(d => `
    <div class="menu-card" data-type="dish" data-name="${d.name}" data-id="${d.id}" role="button" tabindex="0" aria-label="${d.name}">
      <span class="menu-card__emoji">${d.emoji || '🍽️'}</span>
      <span class="menu-card__name">${d.name}</span>
    </div>
  `).join('');

  // Напитки
  DOM.drinksGrid.innerHTML = state.menu.drinks.map(d => `
    <div class="menu-card" data-type="drink" data-name="${d.name}" data-id="${d.id}" role="button" tabindex="0" aria-label="${d.name}">
      <span class="menu-card__emoji">${d.emoji || '🥤'}</span>
      <span class="menu-card__name">${d.name}</span>
    </div>
  `).join('');

  // Обработчики выбора
  $$('.menu-card').forEach(card => {
    card.addEventListener('click', () => selectMenuItem(card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectMenuItem(card);
      }
    });
  });
}

function selectMenuItem(card) {
  const type = card.dataset.type;
  const name = card.dataset.name;

  // Снимаем выделение с других карточек того же типа
  $$(`.menu-card[data-type="${type}"]`).forEach(c => {
    c.classList.remove('menu-card--selected');
  });

  // Выделяем выбранную
  card.classList.add('menu-card--selected');

  if (type === 'dish') {
    state.selectedDish = name;
  } else {
    state.selectedDrink = name;
  }

  // Активируем кнопку если оба выбраны
  DOM.submitVoteBtn.disabled = !(state.selectedDish && state.selectedDrink);
}

async function loadVotingStatus() {
  try {
    const status = await apiRequest('/api/vote/status');

    state.votingOpen = status.votingOpen;
    state.alreadyVoted = status.alreadyVoted;

    // Обновляем таймер
    updateTimerUI(status.votingTime);

    if (state.alreadyVoted && status.myVote) {
      showVotedState(status.myVote);
    } else if (state.votingOpen) {
      enableVotingForm();
    } else {
      disableVotingForm();
    }
  } catch (err) {
    console.error('Ошибка статуса голосования:', err);
  }
}

function updateTimerUI(votingTime) {
  if (!votingTime) return;

  const now = getMskDate();
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (state.votingOpen) {
    DOM.votingTimer.style.display = 'none';
    DOM.votingClosedMsg.style.display = 'none';
    DOM.submitVoteBtn.disabled = !(state.selectedDish && state.selectedDrink);
    return;
  }

  if (state.alreadyVoted) {
    DOM.votingTimer.style.display = 'none';
    DOM.votingClosedMsg.style.display = 'none';
    return;
  }

  DOM.votingClosedMsg.style.display = 'block';
  DOM.votingTimer.style.display = 'block';

  // Вычисляем время до открытия (на следующий день) или до закрытия
  if (currentMinutes < votingTime.startMinutes) {
    // До открытия сегодня
    DOM.timerValue.textContent = formatTimeUntil(votingTime.startMinutes - currentMinutes);
    DOM.votingTimer.querySelector('.voting-timer__label').textContent = 'Голосование откроется через:';
    DOM.votingClosedMsg.textContent = 'Голосование ещё не началось';
    startCountdown(votingTime.startMinutes);
  } else {
    // До открытия завтра
    DOM.votingTimer.querySelector('.voting-timer__label').textContent = 'Голосование откроется завтра в ' + votingTime.start;
    const minsUntilTomorrow = (24 * 60 - currentMinutes) + votingTime.startMinutes;
    DOM.timerValue.textContent = formatTimeUntil(minsUntilTomorrow);
    DOM.votingClosedMsg.textContent = 'Голосование закрыто';
    startCountdown(null);
  }
}

function formatTimeUntil(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = 0; // начальное значение
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startCountdown(targetMinutes) {
  clearTimeout(state.votingTimer);

  function tick() {
    const now = getMskDate();
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

    if (targetMinutes !== null && currentMinutes >= targetMinutes) {
      // Время пришло — обновляем статус
      loadVotingStatus();
      return;
    }

    // Обновляем время
    let remaining;
    if (targetMinutes !== null) {
      remaining = targetMinutes - currentMinutes;
    } else {
      const startSetting = { value: '18:00' }; // fallback
      const [h, m] = startSetting.value.split(':').map(Number);
      const startMin = h * 60 + m;
      remaining = (24 * 60 - currentMinutes) + startMin;
    }

    const h = Math.floor(remaining / 60);
    const m = Math.floor(remaining % 60);
    const s = 59 - now.getUTCSeconds();
    DOM.timerValue.textContent =
      `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    state.votingTimer = setTimeout(tick, 1000);
  }

  tick();
}

function enableVotingForm() {
  DOM.votingForm.style.display = 'block';
  DOM.voteSuccess.style.display = 'none';
  DOM.submitVoteBtn.disabled = true;
  DOM.votingTimer.style.display = 'none';
  DOM.votingClosedMsg.style.display = 'none';
}

function disableVotingForm() {
  DOM.votingForm.style.display = 'none';
  DOM.voteSuccess.style.display = 'none';
}

function showVotedState(myVote) {
  DOM.votingForm.style.display = 'none';
  DOM.voteSuccess.style.display = 'block';
  DOM.voteSuccessChoice.textContent = `Ваш выбор: ${myVote.dish} + ${myVote.drink}`;
  DOM.votingTimer.style.display = 'none';
  DOM.votingClosedMsg.style.display = 'none';
  DOM.submitVoteBtn.disabled = true;
}

// Отправка голоса
DOM.submitVoteBtn.addEventListener('click', async () => {
  clearError(DOM.voteError);

  if (!state.selectedDish || !state.selectedDrink) {
    showError(DOM.voteError, 'Выберите блюдо и напиток');
    return;
  }

  DOM.submitVoteBtn.disabled = true;
  DOM.submitVoteBtn.textContent = '⏳ Отправка...';

  try {
    const data = await apiRequest('/api/vote', 'POST', {
      dish: state.selectedDish,
      drink: state.selectedDrink
    });

    state.alreadyVoted = true;
    showVotedState({ dish: state.selectedDish, drink: state.selectedDrink });

    // Обновляем результаты
    await loadResults();
  } catch (err) {
    showError(DOM.voteError, err.message);
    DOM.submitVoteBtn.disabled = false;
  } finally {
    DOM.submitVoteBtn.textContent = 'Проголосовать';
  }
});

// ========== Результаты ==========

async function loadResults() {
  try {
    const data = await apiRequest('/api/vote/results');

    // Показываем результаты на странице голосования
    renderResults(DOM.votingResults, data, true);

    if (data.votingClosed && data.winner) {
      DOM.votingResults.style.display = 'block';
    }
  } catch (err) {
    console.error('Ошибка загрузки результатов:', err);
  }
}

function renderResults(container, data, compact) {
  if (!data || data.totalVotes === 0) {
    container.innerHTML = `
      <div class="text-center" style="padding: 20px; color: var(--color-text-secondary);">
        Пока нет голосов
      </div>
    `;
    container.style.display = 'block';
    return;
  }

  let html = '';

  // Победитель
  if (data.winner) {
    html += `
      <div class="results-winner">
        <p class="results-winner__label">Завтра на обед</p>
        <p class="results-winner__text">${data.winner.dish} + ${data.winner.drink}</p>
      </div>
    `;
  }

  // Блюда
  html += `<div class="result-section"><h4>🍽️ Блюда (${data.totalVotes} голосов)</h4>`;
  data.dishes.forEach(d => {
    const pct = d.percent;
    html += `
      <div class="result-bar">
        <span class="result-bar__label">${d.name}</span>
        <div class="result-bar__track">
          <div class="result-bar__fill" style="width: ${pct}%"></div>
        </div>
        <span class="result-bar__value">${d.votes} (${pct}%)</span>
      </div>
    `;
  });
  html += '</div>';

  // Напитки
  html += `<div class="result-section"><h4>🥤 Напитки</h4>`;
  data.drinks.forEach(d => {
    const pct = d.percent;
    html += `
      <div class="result-bar">
        <span class="result-bar__label">${d.name}</span>
        <div class="result-bar__track">
          <div class="result-bar__fill" style="width: ${pct}%"></div>
        </div>
        <span class="result-bar__value">${d.votes} (${pct}%)</span>
      </div>
    `;
  });
  html += '</div>';

  container.innerHTML = html;
  container.style.display = 'block';
}

// Страница результатов
DOM.navResults.addEventListener('click', async () => {
  showView('results');
  try {
    const data = await apiRequest('/api/vote/results');
    DOM.resultsPage.innerHTML = `
      <p style="text-align:center;color:var(--color-text-secondary);margin-bottom:16px;">
        Результаты за ${formatDateDisplay(data.date)}
      </p>
    `;
    const resultsContainer = document.createElement('div');
    DOM.resultsPage.appendChild(resultsContainer);
    renderResults(resultsContainer, data, false);
  } catch (err) {
    DOM.resultsPage.innerHTML = `<p class="text-center" style="color:var(--color-error)">Ошибка загрузки результатов</p>`;
  }
});

// ========== История ==========

DOM.navHistory.addEventListener('click', async () => {
  showView('history');
  DOM.historyList.innerHTML = '<div class="text-center"><div class="spinner"></div></div>';

  try {
    const data = await apiRequest('/api/history');
    renderHistory(data.history);
  } catch (err) {
    DOM.historyList.innerHTML = `<p class="text-center" style="color:var(--color-error)">Ошибка загрузки истории</p>`;
  }
});

function renderHistory(history) {
  if (!history || history.length === 0) {
    DOM.historyList.innerHTML = `
      <div class="history-empty">
        <div class="history-empty__icon">📅</div>
        <p>История голосований пока пуста</p>
      </div>
    `;
    return;
  }

  DOM.historyList.innerHTML = history.map(h => `
    <div class="history-card">
      <span class="history-card__date">${formatDateDisplay(h.date)}</span>
      <span class="history-card__winner">
        🍽️ ${h.winnerDish || '—'} + 🥤 ${h.winnerDrink || '—'}
      </span>
    </div>
  `).join('');
}

// ========== Навигация ==========

// Бургер-меню
DOM.burgerBtn.addEventListener('click', () => {
  DOM.mainNav.classList.toggle('header__nav--open');
});

// Закрываем меню при клике на ссылку
DOM.mainNav.addEventListener('click', (e) => {
  if (e.target.closest('.header__nav-btn')) {
    DOM.mainNav.classList.remove('header__nav--open');
  }
});

// ========== Инициализация ==========

async function initApp() {
  // Год в футере
  DOM.footerYear.textContent = new Date().getFullYear();

  // Проверяем, авторизован ли пользователь
  try {
    const data = await apiRequest('/api/students/me');
    state.student = data.student;
    showAppView();
    await initVoting();
    updateNavForStudent();
  } catch (err) {
    // Не авторизован
    showAuthView();
  }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', initApp);