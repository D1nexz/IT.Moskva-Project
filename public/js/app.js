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
  registerForm: $('#registerForm'),
  loginError: $('#loginError'),
  registerError: $('#registerError'),
  loginName: $('#loginName'),
  loginGroup: $('#loginGroup'),
  regName: $('#regName'),
  regGroup: $('#regGroup'),

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

async function apiRequest(url, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();

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

// Переключение табов
$$('.auth-tabs__btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.auth-tabs__btn').forEach(b => b.classList.remove('auth-tabs__btn--active'));
    btn.classList.add('auth-tabs__btn--active');

    $$('.auth-form').forEach(f => f.classList.remove('auth-form--active'));
    const form = document.getElementById(btn.dataset.tab + 'Form');
    if (form) form.classList.add('auth-form--active');

    clearError(DOM.loginError);
    clearError(DOM.registerError);
  });
});

// Регистрация
DOM.registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(DOM.registerError);

  const full_name = DOM.regName.value.trim();
  const group_name = DOM.regGroup.value.trim();

  // Валидация на клиенте
  const nameRegex = /^[А-ЯЁ][а-яё]+[-]?[а-яё]*\s[А-ЯЁ][а-яё]+(\s[А-ЯЁ][а-яё]+)?$/;
  const groupRegex = /^(\d[А-ЯЁ]{2,4}-\d(-\d{1,2})?|[А-ЯЁ]{2,4}-\d{2})$/;

  if (!nameRegex.test(full_name)) {
    showError(DOM.registerError, 'ФИО должно содержать минимум 2 слова кириллицей');
    return;
  }

  if (!groupRegex.test(group_name.toUpperCase())) {
    showError(DOM.registerError, 'Группа должна быть в формате: 1ИИ-4-26 или ИС-21');
    return;
  }

  try {
    const data = await apiRequest('/api/students/register', 'POST', { full_name, group_name });
    state.student = data.student;
    showAppView();
    initVoting();
    updateNavForStudent();
  } catch (err) {
    showError(DOM.registerError, err.message);
  }
});

// Вход
DOM.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(DOM.loginError);

  const full_name = DOM.loginName.value.trim();
  const group_name = DOM.loginGroup.value.trim();

  try {
    const data = await apiRequest('/api/students/login', 'POST', { full_name, group_name });
    state.student = data.student;
    showAppView();
    initVoting();
    updateNavForStudent();
  } catch (err) {
    showError(DOM.loginError, err.message);
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
  DOM.registerForm.reset();
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