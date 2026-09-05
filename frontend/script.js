const API_HOST = window.location.hostname || 'localhost';
const API_BASE_URL = window.HABIT_API_URL || `${window.location.protocol}//${API_HOST}:5000/api`;
const AUTH_TOKEN_KEY = 'habitTrackerToken';
const APP_THEME_KEY = 'habitTrackerThemeV2';

const defaultState = {
  user: null,
  habits: [],
  completions: [],
  stats: null,
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),
  selectedDate: getDateKey(new Date()),
};

const appState = { ...defaultState };
let dateRolloverTimer = null;

function setTheme(theme) {
  const root = document.body;
  const isDark = theme === 'dark';
  root.classList.toggle('dark', isDark);
  localStorage.setItem(APP_THEME_KEY, theme);
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.textContent = isDark ? '☀️' : '🌙';
  }
}

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function logout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  window.location.href = 'login.html';
}

async function apiRequest(endpoint, method = 'GET', body = null, auth = true) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (auth) {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

function showMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? '#ef4444' : '#16a34a';
}

function setSidebarUser(user) {
  const avatarElements = document.querySelectorAll('.avatar');
  avatarElements.forEach((element) => {
    element.textContent = user && user.name ? user.name.charAt(0).toUpperCase() : 'U';
  });

  const nameEl = document.getElementById('sidebarUserName');
  const emailEl = document.getElementById('sidebarUserEmail');

  if (nameEl) nameEl.textContent = user ? user.name : 'User';
  if (emailEl) emailEl.textContent = user ? user.email : 'user@email.com';
}

async function fetchCurrentUser() {
  try {
    const data = await apiRequest('/auth/me');
    appState.user = data.user;
    setSidebarUser(appState.user);
  } catch (error) {
    console.error('User fetch error:', error);
    logout();
  }
}

async function fetchHabits() {
  const data = await apiRequest('/habits');
  appState.habits = data.habits || [];

  if (document.getElementById('todayHabitsList')) {
    renderDashboard();
  }

  if (document.getElementById('habitTableBody')) {
    renderHabitManagement();
  }

  if (document.getElementById('calendarGrid')) {
    renderCalendar();
  }
}

async function fetchCompletions() {
  await apiRequest('/completions/sync-missed', 'POST', { today: getTodayKey() });
  const data = await apiRequest('/completions/history');
  appState.completions = data.completions || [];

  if (document.getElementById('calendarGrid')) {
    renderCalendar();
  }

  if (document.getElementById('chartBox')) {
    renderStatistics();
  }
}

async function fetchStats() {
  const data = await apiRequest('/statistics');
  appState.stats = data;

  if (document.getElementById('completionPercentValue')) {
    renderDashboard();
  }

  if (document.getElementById('chartBox')) {
    renderStatistics();
  }
}

function formatDate(dateString) {
  const date = new Date(`${getCompletionDateKey(dateString)}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatShortDate(dateString) {
  const date = new Date(`${getCompletionDateKey(dateString)}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateKey(date) {
  const next = new Date(date);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

function getCompletionDateKey(date) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const next = new Date(date);
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

function startDateRolloverWatcher() {
  if (dateRolloverTimer) return;
  let knownToday = getTodayKey();
  dateRolloverTimer = window.setInterval(async () => {
    const currentToday = getTodayKey();
    if (currentToday === knownToday) return;
    knownToday = currentToday;
    appState.selectedDate = currentToday;
    appState.calendarMonth = new Date().getMonth();
    appState.calendarYear = new Date().getFullYear();
    try {
      await fetchCompletions();
      if (document.getElementById('chartBox')) await fetchStats();
      if (document.getElementById('todayHabitsList')) renderDashboard();
    } catch (error) {
      console.error('Date rollover refresh error:', error);
    }
  }, 30000);
}

function getHabitCompletionMap() {
  const map = new Map();
  appState.completions.forEach((completion) => {
    if (completion.habit && completion.completed !== false) {
      map.set(`${completion.habit._id || completion.habit}:${getCompletionDateKey(completion.date)}`, 'completed');
    } else if (completion.habit) {
      map.set(`${completion.habit._id || completion.habit}:${getCompletionDateKey(completion.date)}`, 'missed');
    }
  });
  return map;
}

function isCompletedStatus(completionMap, key) {
  return completionMap.get(key) === 'completed';
}

function renderDashboard() {
  if (!document.getElementById('todayLabel')) return;

  const todayLabel = document.getElementById('todayLabel');
  const ribbonTodayStatus = document.getElementById('ribbonTodayStatus');
  if (ribbonTodayStatus) {
    ribbonTodayStatus.textContent = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date());
  }
  todayLabel.textContent = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const completionMap = getHabitCompletionMap();
  const totalHabits = appState.habits.length;
  const todayKey = getTodayKey();
  const completedHabits = appState.habits.filter((habit) => isCompletedStatus(completionMap, `${habit._id}:${todayKey}`)).length;
  const pendingHabits = Math.max(totalHabits - completedHabits, 0);
  const completionRate = totalHabits ? Math.round((completedHabits / totalHabits) * 100) : 0;

  const totalHabitsValue = document.getElementById('totalHabitsValue');
  const completedHabitsValue = document.getElementById('completedHabitsValue');
  const pendingHabitsValue = document.getElementById('pendingHabitsValue');
  const completionPercentValue = document.getElementById('completionPercentValue');
  const currentStreakValue = document.getElementById('currentStreakValue');
  const longestStreakValue = document.getElementById('longestStreakValue');

  if (totalHabitsValue) totalHabitsValue.textContent = totalHabits;
  if (completedHabitsValue) completedHabitsValue.textContent = completedHabits;
  if (pendingHabitsValue) pendingHabitsValue.textContent = pendingHabits;
  if (completionPercentValue) completionPercentValue.textContent = `${completionRate}%`;

  const dashboardOverallProgress = document.getElementById('dashboardOverallProgress');
  const dashboardProgressFill = document.getElementById('dashboardProgressFill');
  if (dashboardOverallProgress) dashboardOverallProgress.textContent = `${completionRate}%`;
  if (dashboardProgressFill) dashboardProgressFill.style.width = `${completionRate}%`;

  if (appState.stats && appState.stats.overview) {
    if (currentStreakValue) currentStreakValue.textContent = appState.stats.overview.currentStreak || 0;
    if (longestStreakValue) longestStreakValue.textContent = appState.stats.overview.longestStreak || 0;
  }

  const todayHabitsList = document.getElementById('todayHabitsList');
  if (todayHabitsList) {
    if (!appState.habits.length) {
      todayHabitsList.innerHTML = '<div class="habit-item"><div class="habit-main"><div class="habit-meta"><div class="habit-name">No habits yet</div><div class="habit-sub">Create a habit to start tracking.</div></div></div></div>';
      return;
    }

    todayHabitsList.innerHTML = appState.habits
      .slice(0, 6)
      .map((habit) => {
        const checked = isCompletedStatus(completionMap, `${habit._id}:${todayKey}`) ? 'completed' : '';
        return `
          <div class="habit-item">
            <div class="habit-main">
              <div class="habit-badge" style="background:${getCategoryColor(habit.category)}">${habit.name.charAt(0).toUpperCase()}</div>
              <div class="habit-meta">
                <div class="habit-name">${habit.name}</div>
                <div class="habit-sub">${habit.category} • ${habit.frequency}</div>
              </div>
            </div>
            <div class="habit-item-actions">
              <button class="check-toggle ${checked}" data-habit-id="${habit._id}" data-date="${todayKey}" type="button" aria-label="Toggle completion"></button>
              <button class="habit-action-button" data-edit-habit-id="${habit._id}" type="button" aria-label="Edit ${habit.name}">Edit</button>
              <button class="habit-action-button danger" data-delete-habit-id="${habit._id}" type="button" aria-label="Delete ${habit.name}">Delete</button>
            </div>
          </div>
        `;
      })
      .join('');

    todayHabitsList.querySelectorAll('.check-toggle').forEach((button) => {
        button.addEventListener('click', async () => {
        const habitId = button.dataset.habitId;
        const date = button.dataset.date;
        try {
          if (button.classList.contains('completed')) {
            await apiRequest('/completions/undo', 'POST', { habitId, date, today: getTodayKey() });
          } else {
            await apiRequest('/completions/complete', 'POST', { habitId, date, today: getTodayKey() });
          }
          await fetchCompletions();
          await fetchStats();
          renderDashboard();
        } catch (error) {
          alert(error.message);
        }
      });
    });

    todayHabitsList.querySelectorAll('[data-edit-habit-id]').forEach((button) => {
      button.addEventListener('click', () => openHabitModal(button.dataset.editHabitId));
    });

    todayHabitsList.querySelectorAll('[data-delete-habit-id]').forEach((button) => {
      button.addEventListener('click', async () => {
        const habitId = button.dataset.deleteHabitId;
        if (!confirm('Delete this habit and its completion history?')) return;
        try {
          await apiRequest(`/habits/${habitId}`, 'DELETE');
          await fetchHabits();
          await fetchCompletions();
          await fetchStats();
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  const progressStack = document.getElementById('progressStack');
  if (progressStack) {
    progressStack.innerHTML = appState.habits.slice(0, 4).map((habit) => {
      const habitCompletions = appState.completions.filter((c) => c.habit && (c.habit._id || c.habit) === habit._id).length;
      const progress = Math.min(100, Math.round((habitCompletions / Math.max(habit.dailyGoal || 1, 1)) * 100));
      return `
        <div class="progress-item">
          <div class="progress-meta">
            <span>${habit.name}</span>
            <span>${progress}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${progress}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderDashboardInsights();
}

function renderDashboardInsights() {
  const monthLabel = document.getElementById('dashboardMonthLabel');
  const monthName = document.getElementById('dashboardMonthName');
  const completedWork = document.getElementById('dashboardCompletedWork');
  const bestDay = document.getElementById('bestDayValue');
  const bestWeek = document.getElementById('bestWeekValue');
  if (!monthLabel || !monthName || !completedWork) return;

  const monthDate = new Date(appState.calendarYear, appState.calendarMonth, 1);
  const formattedMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(monthDate);
  monthLabel.textContent = formattedMonth;
  monthName.textContent = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(monthDate);

  const monthCompletions = appState.completions.filter((completion) => {
    const [year, month] = getCompletionDateKey(completion.date).split('-').map(Number);
    return completion.completed !== false && year === appState.calendarYear && month - 1 === appState.calendarMonth;
  });
  completedWork.textContent = monthCompletions.length;

  const completionMap = getHabitCompletionMap();
  const todayKey = getTodayKey();
  const daysInMonth = new Date(appState.calendarYear, appState.calendarMonth + 1, 0).getDate();
  const dailyValues = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(appState.calendarYear, appState.calendarMonth, index + 1);
    const key = getDateKey(date);
    const count = key <= todayKey ? appState.habits.filter((habit) => isCompletedStatus(completionMap, `${habit._id}:${key}`)).length : 0;
    return { date, count, rate: appState.habits.length ? Math.round((count / appState.habits.length) * 100) : 0 };
  });
  const highestDay = dailyValues.reduce((highest, value) => value.rate > highest.rate ? value : highest, { rate: 0 });
  if (bestDay) bestDay.textContent = highestDay.rate ? `${new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(highestDay.date)} ${highestDay.rate}%` : '-';

  const totalWeeks = Math.ceil((new Date(appState.calendarYear, appState.calendarMonth, 1).getDay() + daysInMonth) / 7);
  const weeklyValues = Array.from({ length: totalWeeks }, (_, week) => {
    const start = week * 7 - new Date(appState.calendarYear, appState.calendarMonth, 1).getDay() + 1;
    const weekDays = dailyValues.filter((value) => value.date.getDate() >= Math.max(1, start) && value.date.getDate() <= Math.min(daysInMonth, start + 6));
    const count = weekDays.reduce((sum, value) => sum + value.count, 0);
    const trackedWeekDays = weekDays.filter((value) => getDateKey(value.date) <= todayKey);
    const possible = appState.habits.length * trackedWeekDays.length;
    return { week: week + 1, rate: possible ? Math.round((count / possible) * 100) : 0 };
  });
  const highestWeek = weeklyValues.reduce((highest, value) => value.rate > highest.rate ? value : highest, { rate: 0, week: 0 });
  if (bestWeek) bestWeek.textContent = highestWeek.rate ? `Week ${highestWeek.week} ${highestWeek.rate}%` : '-';
}

function renderHabitManagement() {
  const tableBody = document.getElementById('habitTableBody');
  if (!tableBody) return;

  if (!appState.habits.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; color: var(--muted); padding: 24px;">No habits found. Add your first habit.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = appState.habits.map((habit) => `
    <tr>
      <td><strong>${habit.name}</strong><br><small>${habit.description || 'No description'}</small></td>
      <td><span class="chip">${habit.category}</span></td>
      <td>${habit.frequency}</td>
      <td>${formatShortDate(habit.startDate)}</td>
      <td>${habit.dailyGoal}</td>
      <td>${habit.isActive ? '<span class="chip success">Active</span>' : '<span class="chip">Inactive</span>'}</td>
      <td>
        <div class="table-actions">
          <button type="button" class="secondary-btn" data-edit-id="${habit._id}">Edit</button>
          <button type="button" class="danger-btn" data-delete-id="${habit._id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  tableBody.querySelectorAll('[data-edit-id]').forEach((button) => {
    button.addEventListener('click', () => openHabitModal(button.dataset.editId));
  });

  tableBody.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const habitId = button.dataset.deleteId;
      if (!confirm('Delete this habit and its completion history?')) return;
      try {
        await apiRequest(`/habits/${habitId}`, 'DELETE');
        await fetchHabits();
        await fetchCompletions();
        await fetchStats();
      } catch (error) {
        alert(error.message);
      }
    });
  });
}

async function initializeHabitsPage() {
  const theme = localStorage.getItem(APP_THEME_KEY) || 'light';
  setTheme(theme);
  const token = getAuthToken();
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  setSidebarUser({ name: 'User', email: 'user@email.com' });
  await fetchCurrentUser();
  await fetchHabits();
  await fetchCompletions();
  await fetchStats();

  const addHabitBtn = document.getElementById('addHabitBtn');
  if (addHabitBtn) {
    addHabitBtn.addEventListener('click', () => openHabitModal());
  }

  const closeHabitModalBtn = document.getElementById('closeHabitModal');
  if (closeHabitModalBtn) {
    closeHabitModalBtn.addEventListener('click', closeHabitModal);
  }

  const habitForm = document.getElementById('habitForm');
  if (habitForm) {
    habitForm.addEventListener('submit', handleHabitSubmit);
  }

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
      setTheme(nextTheme);
    });
  }

  const logoutLink = Array.from(document.querySelectorAll('.nav-item')).find((item) => item.textContent.includes('Logout'));
  if (logoutLink) {
    logoutLink.addEventListener('click', (event) => {
      event.preventDefault();
      logout();
    });
  }
}

async function initializeSettingsPage() {
  const theme = localStorage.getItem(APP_THEME_KEY) || 'light';
  setTheme(theme);
  const token = getAuthToken();
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  await fetchCurrentUser();
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.value = document.body.classList.contains('dark') ? 'dark' : 'light';
  }

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
      setTheme(nextTheme);
      if (themeSelect) themeSelect.value = nextTheme;
    });
  }

  const saveThemeBtn = document.getElementById('saveThemeBtn');
  if (saveThemeBtn) {
    saveThemeBtn.addEventListener('click', async () => {
      const nextTheme = themeSelect.value;
      try {
        await apiRequest('/auth/theme', 'PUT', { theme: nextTheme });
        setTheme(nextTheme);
        alert('Theme saved');
      } catch (error) {
        alert(error.message);
      }
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => logout());
  }
}

function openHabitModal(habitId = null) {
  const modal = document.getElementById('habitModal');
  const title = document.getElementById('habitModalTitle');
  const form = document.getElementById('habitForm');

  if (!modal) return;

  modal.classList.remove('hidden');

  if (habitId) {
    const currentHabit = appState.habits.find((habit) => habit._id === habitId);
    if (!currentHabit) return;
    title.textContent = 'Edit Habit';
    document.getElementById('habitId').value = currentHabit._id;
    document.getElementById('habitName').value = currentHabit.name;
    document.getElementById('habitDescription').value = currentHabit.description || '';
    document.getElementById('habitCategory').value = currentHabit.category || 'Other';
    document.getElementById('habitFrequency').value = currentHabit.frequency || 'Daily';
    document.getElementById('habitDailyGoal').value = currentHabit.dailyGoal || 1;
    document.getElementById('habitStartDate').value = currentHabit.startDate ? getCompletionDateKey(currentHabit.startDate) : '';
  } else {
    title.textContent = 'Add Habit';
    form.reset();
    document.getElementById('habitId').value = '';
    document.getElementById('habitDailyGoal').value = 1;
    document.getElementById('habitStartDate').value = getTodayKey();
  }
}

function closeHabitModal() {
  const modal = document.getElementById('habitModal');
  if (modal) modal.classList.add('hidden');
}

async function handleHabitSubmit(event) {
  event.preventDefault();

  const habitId = document.getElementById('habitId').value;
  const payload = {
    name: document.getElementById('habitName').value.trim(),
    description: document.getElementById('habitDescription').value.trim(),
    category: document.getElementById('habitCategory').value,
    frequency: document.getElementById('habitFrequency').value,
    dailyGoal: Number(document.getElementById('habitDailyGoal').value),
    startDate: document.getElementById('habitStartDate').value,
  };

  try {
    if (habitId) await apiRequest(`/habits/${habitId}`, 'PUT', payload);
    else await apiRequest('/habits', 'POST', payload);
    closeHabitModal();
    await fetchHabits();
    await fetchCompletions();
    await fetchStats();
  } catch (error) {
    alert(error.message);
  }
}

function getCategoryColor(category) {
  const colors = {
    Health: '#22c55e',
    Study: '#3b82f6',
    Fitness: '#f59e0b',
    Personal: '#8b5cf6',
    Other: '#6b7280',
  };
  return colors[category] || colors.Other;
}

function renderCalendar() {
  const calendarGrid = document.getElementById('calendarGrid');
  const calendarMonthLabel = document.getElementById('calendarMonthLabel');
  if (!calendarGrid || !calendarMonthLabel) return;
  const year = appState.calendarYear;
  const month = appState.calendarMonth;
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay();
  calendarMonthLabel.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(firstDay);
  const completionMap = getHabitCompletionMap();
  const monthDone = appState.completions.filter((completion) => {
    const [completionYear, completionMonth] = getCompletionDateKey(completion.date).split('-').map(Number);
    return completion.completed !== false && completionYear === year && completionMonth - 1 === month;
  }).length;
  const possible = appState.habits.length * daysInMonth;
  const calendarHabitCount = document.getElementById('calendarHabitCount');
  const calendarCompletedCount = document.getElementById('calendarCompletedCount');
  const calendarProgress = document.getElementById('calendarProgress');
  const dashboardMonthName = document.getElementById('dashboardMonthName');
  const formattedMonth = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(firstDay);
  if (calendarHabitCount) calendarHabitCount.textContent = appState.habits.length;
  if (calendarCompletedCount) calendarCompletedCount.textContent = monthDone;
  if (calendarProgress) calendarProgress.textContent = `${possible ? Math.round(monthDone / possible * 100) : 0}%`;
  if (dashboardMonthName) dashboardMonthName.textContent = formattedMonth;

  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const weeks = Math.ceil((startWeekday + daysInMonth) / 7);
  const sections = [];
  const weeklySummaries = [];
  for (let week = 0; week < weeks; week++) {
    const cells = ['<div class="tracker-corner">My Habits</div>'];
    for (let weekday = 0; weekday < 7; weekday++) {
      const day = week * 7 + weekday - startWeekday + 1;
      cells.push(`<div class="day-heading ${day < 1 || day > daysInMonth ? 'muted' : ''}">${day > 0 && day <= daysInMonth ? `<span>${days[weekday]}</span><strong>${day}</strong>` : ''}</div>`);
    }
    appState.habits.forEach((habit) => {
      cells.push(`<div class="tracker-habit-label"><span class="habit-badge" style="background:${getCategoryColor(habit.category)}">${habit.name.charAt(0).toUpperCase()}</span>${habit.name}</div>`);
      for (let weekday = 0; weekday < 7; weekday++) {
        const day = week * 7 + weekday - startWeekday + 1;
        if (day < 1 || day > daysInMonth) { cells.push('<div class="tracker-cell muted"></div>'); continue; }
        const date = getDateKey(new Date(year, month, day));
        const storedStatus = completionMap.get(`${habit._id}:${date}`);
        const todayKey = getTodayKey();
        const isToday = date === todayKey;
        const isFuture = date > todayKey;
        const status = isFuture ? null : storedStatus;
        const isMissed = status === 'missed' && !isFuture;
        cells.push(`<button class="tracker-cell ${status === 'completed' ? 'checked' : ''} ${isMissed ? 'missed' : ''} ${isToday ? 'today' : ''}" type="button" data-habit-id="${habit._id}" data-calendar-date="${date}" ${isToday ? '' : 'disabled'} aria-label="${isFuture ? 'Future' : status === 'completed' ? 'Completed' : isMissed ? 'Missed' : 'Past'} ${habit.name} for ${date}"><span class="tracker-checkbox">${status === 'completed' ? '✓' : isMissed ? '❌' : ''}</span></button>`);
      }
    });
    ['Progress', 'Done', 'Not Done'].forEach((label) => {
      cells.push(`<div class="tracker-summary-label">${label}</div>`);
      for (let weekday = 0; weekday < 7; weekday++) {
        const day = week * 7 + weekday - startWeekday + 1;
        const date = day >= 1 && day <= daysInMonth ? getDateKey(new Date(year, month, day)) : null;
        const done = date ? appState.habits.filter((habit) => isCompletedStatus(completionMap, `${habit._id}:${date}`)).length : 0;
        const value = label === 'Progress' ? (date && appState.habits.length ? `${Math.round(done / appState.habits.length * 100)}%` : '-') : label === 'Done' ? (date ? done : '-') : (date ? appState.habits.length - done : '-');
        cells.push(`<div class="${label === 'Progress' ? 'tracker-progress' : 'tracker-count'} ${date ? '' : 'muted'}">${value}</div>`);
      }
    });
    const validDays = Array.from({ length: 7 }, (_, index) => week * 7 - startWeekday + index + 1).filter((day) => day >= 1 && day <= daysInMonth);
    const done = validDays.reduce((total, day) => total + appState.habits.filter((habit) => isCompletedStatus(completionMap, `${habit._id}:${getDateKey(new Date(year, month, day))}`)).length, 0);
    const weekPossible = validDays.length * appState.habits.length;
    weeklySummaries.push({ label: `Week ${week + 1}`, done, possible: weekPossible, rate: weekPossible ? Math.round(done / weekPossible * 100) : 0 });
    sections.push(`<section class="week-section"><div class="week-heading">Week ${week + 1}</div><div class="tracker-grid week-grid">${cells.join('')}</div></section>`);
  }
  calendarGrid.innerHTML = sections.join('');
  calendarGrid.querySelectorAll('.tracker-cell[data-habit-id]').forEach((button) => button.addEventListener('click', async () => {
    const payload = { habitId: button.dataset.habitId, date: button.dataset.calendarDate, today: getTodayKey() };
    try {
      if (button.classList.contains('checked')) await apiRequest('/completions/undo', 'POST', payload);
      else await apiRequest('/completions/complete', 'POST', payload);
      await fetchCompletions();
      renderCalendar();
    } catch (error) { alert(error.message); }
  }));
  const weeklyProgress = document.getElementById('weeklyProgress');
  if (weeklyProgress) weeklyProgress.innerHTML = weeklySummaries.map((summary) => `<div class="weekly-progress-item"><span>${summary.label}</span><strong>${summary.rate}%</strong><small>${summary.done} / ${summary.possible} completed</small></div>`).join('');
  renderDailyCalendarChart();
}

/* Remove stale duplicated calendar block. */
/*
        const calendarGrid = document.getElementById('calendarGrid');
        const calendarMonthLabel = document.getElementById('calendarMonthLabel');
        if (!calendarGrid || !calendarMonthLabel) return;
        const year = appState.calendarYear;
        const month = appState.calendarMonth;
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startWeekday = firstDay.getDay();
        calendarMonthLabel.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(firstDay);
        const monthCompletions = appState.completions.filter((completion) => {
          const date = new Date(completion.date);
          return completion.completed !== false && date.getFullYear() === year && date.getMonth() === month;
        });
        const expected = appState.habits.length * daysInMonth;
        document.getElementById('calendarHabitCount').textContent = appState.habits.length;
        document.getElementById('calendarCompletedCount').textContent = monthCompletions.length;
        document.getElementById('calendarProgress').textContent = `${expected ? Math.round(monthCompletions.length / expected * 100) : 0}%`;

        const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        const completionMap = getHabitCompletionMap();
        const todayKey = getTodayKey();
        const totalWeeks = Math.ceil((startWeekday + daysInMonth) / 7);
        const sections = [];
        const weeklySummaries = [];

        for (let week = 0; week < totalWeeks; week++) {
          const cells = ['<div class="tracker-corner">My Habits</div>'];
          for (let weekday = 0; weekday < 7; weekday++) {
            const day = week * 7 + weekday - startWeekday + 1;
            cells.push(`<div class="day-heading ${day < 1 || day > daysInMonth ? 'muted' : ''}">${day >= 1 && day <= daysInMonth ? `<span>${weekdays[weekday]}</span><strong>${day}</strong>` : ''}</div>`);
          }
          appState.habits.forEach((habit) => {
            cells.push(`<div class="tracker-habit-label"><span class="habit-badge" style="background:${getCategoryColor(habit.category)}">${habit.name.charAt(0).toUpperCase()}</span>${habit.name}</div>`);
            for (let weekday = 0; weekday < 7; weekday++) {
              const day = week * 7 + weekday - startWeekday + 1;
              if (day < 1 || day > daysInMonth) { cells.push('<div class="tracker-cell muted"></div>'); continue; }
              const dateKey = getDateKey(new Date(year, month, day));
              const checked = completionMap.has(`${habit._id}:${dateKey}`);
              cells.push(`<button class="tracker-cell ${checked ? 'checked' : ''} ${dateKey === todayKey ? 'today' : ''}" type="button" data-habit-id="${habit._id}" data-calendar-date="${dateKey}" aria-label="${checked ? 'Undo' : 'Mark'} ${habit.name} for ${dateKey}"><span class="tracker-checkbox">${checked ? '✓' : ''}</span></button>`);
            }
          });
          ['Progress', 'Done', 'Not Done'].forEach((label) => {
            cells.push(`<div class="tracker-summary-label">${label}</div>`);
            for (let weekday = 0; weekday < 7; weekday++) {
              const day = week * 7 + weekday - startWeekday + 1;
              const dateKey = day >= 1 && day <= daysInMonth ? getDateKey(new Date(year, month, day)) : null;
              const done = dateKey ? appState.habits.filter((habit) => completionMap.has(`${habit._id}:${dateKey}`)).length : 0;
              const value = label === 'Progress' ? (dateKey && appState.habits.length ? `${Math.round(done / appState.habits.length * 100)}%` : '-') : label === 'Done' ? (dateKey ? done : '-') : (dateKey ? Math.max(appState.habits.length - done, 0) : '-');
              cells.push(`<div class="${label === 'Progress' ? 'tracker-progress' : 'tracker-count'} ${dateKey ? '' : 'muted'}">${value}</div>`);
            }
          });
          const weekStart = week * 7 - startWeekday + 1;
          const weekDays = Array.from({ length: 7 }, (_, index) => weekStart + index).filter((day) => day >= 1 && day <= daysInMonth);
          const done = weekDays.reduce((sum, day) => sum + appState.habits.filter((habit) => completionMap.has(`${habit._id}:${getDateKey(new Date(year, month, day))}`)).length, 0);
          const possible = weekDays.length * appState.habits.length;
          weeklySummaries.push({ label: `Week ${week + 1}`, done, possible, rate: possible ? Math.round(done / possible * 100) : 0 });
          sections.push(`<section class="week-section"><div class="week-heading">Week ${week + 1}</div><div class="tracker-grid week-grid">${cells.join('')}</div></section>`);
        }
        calendarGrid.innerHTML = sections.join('');
        calendarGrid.querySelectorAll('.tracker-cell[data-habit-id]').forEach((button) => {
          button.addEventListener('click', async () => {
            const payload = { habitId: button.dataset.habitId, date: button.dataset.calendarDate };
            try {
              if (button.classList.contains('checked')) await apiRequest('/completions/undo', 'POST', payload);
              else await apiRequest('/completions/complete', 'POST', payload);
              await fetchCompletions();
              renderCalendar();
            } catch (error) { alert(error.message); }
          });
        });
        const weeklyProgress = document.getElementById('weeklyProgress');
        if (weeklyProgress) weeklyProgress.innerHTML = weeklySummaries.map((summary) => `<div class="weekly-progress-item"><span>${summary.label}</span><strong>${summary.rate}%</strong><small>${summary.done} / ${summary.possible} completed</small></div>`).join('');
        renderDailyCalendarChart();
}

*/

function renderDailyCalendarChart() {
  const chart = document.getElementById('dailyChartBox');
  const labels = document.getElementById('dailyChartLabels');
  if (!chart || !labels) return;
  const daysInMonth = new Date(appState.calendarYear, appState.calendarMonth + 1, 0).getDate();
  const completionMap = getHabitCompletionMap();
  const todayKey = getTodayKey();
  const points = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(appState.calendarYear, appState.calendarMonth, index + 1);
    const key = getDateKey(date);
    const isFuture = key > todayKey;
    const count = !isFuture ? appState.habits.filter((habit) => isCompletedStatus(completionMap, `${habit._id}:${key}`)).length : 0;
    return { day: index + 1, value: appState.habits.length ? Math.round((count / appState.habits.length) * 100) : 0, isFuture };
  });
  chart.innerHTML = points.map((point) => `<div class="daily-chart-bar ${point.isFuture ? 'future' : ''}" title="Day ${point.day}: ${point.isFuture ? 'Future' : `${point.value}% complete`}" style="height:${Math.max(point.value, 2)}%"></div>`).join('');
  labels.innerHTML = points.map((point) => `<span><b>${point.day}</b><small>${point.isFuture ? '-' : `${point.value}%`}</small></span>`).join('');
}

function renderSelectedDay() {
  const list = document.getElementById('selectedDayHabits');
  const label = document.getElementById('selectedDayLabel');
  const progress = document.getElementById('selectedDayProgress');
  if (!list || !label || !progress) return;

  const selectedDate = new Date(`${appState.selectedDate}T00:00:00`);
  label.textContent = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(selectedDate);

  const completionMap = getHabitCompletionMap();
  const completedCount = appState.habits.filter((habit) => isCompletedStatus(completionMap, `${habit._id}:${appState.selectedDate}`)).length;
  progress.textContent = `${completedCount} / ${appState.habits.length} done`;

  if (!appState.habits.length) {
    list.innerHTML = '<div class="empty-state">Add a habit from the dashboard to build your daily plan.</div>';
    return;
  }

  list.innerHTML = appState.habits.map((habit) => {
    const checked = isCompletedStatus(completionMap, `${habit._id}:${appState.selectedDate}`);
    return `
      <div class="day-habit-row ${checked ? 'is-done' : ''}">
        <div class="habit-main">
          <div class="habit-badge" style="background:${getCategoryColor(habit.category)}">${habit.name.charAt(0).toUpperCase()}</div>
          <div class="habit-meta"><div class="habit-name">${habit.name}</div><div class="habit-sub">${habit.category} • ${habit.frequency}</div></div>
        </div>
        <button class="check-toggle ${checked ? 'completed' : ''}" type="button" data-day-habit-id="${habit._id}" aria-label="${checked ? 'Undo' : 'Mark'} ${habit.name} complete"></button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-day-habit-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const habitId = button.dataset.dayHabitId;
      try {
        if (button.classList.contains('completed')) {
          await apiRequest('/completions/undo', 'POST', { habitId, date: appState.selectedDate });
        } else {
          await apiRequest('/completions/complete', 'POST', { habitId, date: appState.selectedDate });
        }
        await fetchCompletions();
        renderCalendar();
      } catch (error) {
        alert(error.message);
      }
    });
  });
}

function renderStatistics() {
  const chartBox = document.getElementById('chartBox');
  const dailyRateValue = document.getElementById('dailyRateValue');
  const weeklyRateValue = document.getElementById('weeklyRateValue');
  const monthlyRateValue = document.getElementById('monthlyRateValue');
  const statCurrentStreak = document.getElementById('statCurrentStreak');
  const statLongestStreak = document.getElementById('statLongestStreak');
  const statTotalCompleted = document.getElementById('statTotalCompleted');
  const statTotalMissed = document.getElementById('statTotalMissed');
  const recentHistoryList = document.getElementById('recentHistoryList');

  if (!appState.stats) return;

  if (dailyRateValue) dailyRateValue.textContent = `${appState.stats.daily?.rate ?? 0}%`;
  if (weeklyRateValue) weeklyRateValue.textContent = `${appState.stats.weekly?.rate ?? 0}%`;
  if (monthlyRateValue) monthlyRateValue.textContent = `${appState.stats.monthly?.rate ?? 0}%`;
  if (statCurrentStreak) statCurrentStreak.textContent = appState.stats.overview?.currentStreak ?? 0;
  if (statLongestStreak) statLongestStreak.textContent = appState.stats.overview?.longestStreak ?? 0;
  if (statTotalCompleted) statTotalCompleted.textContent = appState.stats.overview?.totalCompleted ?? 0;
  if (statTotalMissed) statTotalMissed.textContent = appState.stats.overview?.totalMissed ?? 0;

  const periodProgressList = document.getElementById('periodProgressList');
  if (periodProgressList) {
    const periods = [
      ['Daily', appState.stats.daily],
      ['Weekly', appState.stats.weekly],
      ['Monthly', appState.stats.monthly],
    ];
    periodProgressList.innerHTML = periods.map(([label, period]) => `
      <div class="period-progress-row">
        <div><strong>${label}</strong><span>${period?.completed ?? 0} complete · ${period?.missed ?? 0} missed</span></div>
        <b>${period?.rate ?? 0}%</b>
      </div>
      <div class="period-progress-track"><span style="width:${period?.rate ?? 0}%"></span></div>
    `).join('');
  }

  const missedHistoryList = document.getElementById('missedHistoryList');
  if (missedHistoryList) {
    const missedDetails = appState.stats.missedDetails || [];
    missedHistoryList.innerHTML = missedDetails.length ? missedDetails.map((item) => `
      <div class="missed-history-item"><span class="missed-mark">❌</span><div><strong>${item.habitName}</strong><small>${formatDate(item.date)} · ${item.category}</small></div></div>
    `).join('') : '<div class="empty-state">No missed habits recorded.</div>';
  }

  if (chartBox) {
    const chartDates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    const completionMap = getHabitCompletionMap();
    const dataPoints = chartDates.map((date) => {
      const dateKey = getDateKey(date);
      const completed = appState.habits.filter((habit) => isCompletedStatus(completionMap, `${habit._id}:${dateKey}`)).length;
      return appState.habits.length ? Math.round((completed / appState.habits.length) * 100) : 0;
    });
    const columnWidth = 100 / dataPoints.length;
    chartBox.innerHTML = dataPoints.map((value, index) => `
      <div class="chart-bar" title="${value}% complete" style="left:${index * columnWidth + 1}%; height:${Math.max(value, 3)}%"></div>
    `).join('');
    const chartLabels = document.querySelector('.chart-lines');
    if (chartLabels) chartLabels.innerHTML = chartDates.map((date) => `<span>${new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)}</span>`).join('');
  }

  if (recentHistoryList) {
    if (!appState.stats.history || !appState.stats.history.length) {
      recentHistoryList.innerHTML = '<div class="habit-item"><div class="habit-main"><div class="habit-meta"><div class="habit-name">No recent completion history</div><div class="habit-sub">Complete a habit to see it here.</div></div></div></div>';
      return;
    }

    recentHistoryList.innerHTML = appState.stats.history.slice(0, 6).map((entry) => `
      <div class="habit-item">
        <div class="habit-main">
          <div class="habit-badge" style="background:${getCategoryColor(entry.habit?.category || 'Other')}">${(entry.habit?.name || 'H').charAt(0).toUpperCase()}</div>
          <div class="habit-meta">
            <div class="habit-name">${entry.habit?.name || 'Habit'}</div>
            <div class="habit-sub">${formatDate(entry.date)}</div>
          </div>
        </div>
        <span class="chip success">Done</span>
      </div>
    `).join('');
  }
}

async function initializeAuthPage() {
  const theme = localStorage.getItem(APP_THEME_KEY) || 'light';
  setTheme(theme);

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value,
      };

      try {
        const data = await apiRequest('/auth/login', 'POST', payload, false);
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        window.location.href = 'dashboard.html';
      } catch (error) {
        showMessage('loginMessage', error.message, true);
      }
    });
  }

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        name: document.getElementById('registerName').value,
        email: document.getElementById('registerEmail').value,
        password: document.getElementById('registerPassword').value,
      };

      try {
        const data = await apiRequest('/auth/register', 'POST', payload, false);
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        window.location.href = 'dashboard.html';
      } catch (error) {
        showMessage('registerMessage', error.message, true);
      }
    });
  }
}

async function initializeDashboardPage() {
  const theme = localStorage.getItem(APP_THEME_KEY) || 'light';
  setTheme(theme);
  const token = getAuthToken();
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  setSidebarUser({ name: 'User', email: 'user@email.com' });
  await fetchCurrentUser();
  await fetchHabits();
  await fetchCompletions();
  await fetchStats();
  startDateRolloverWatcher();

  const addHabitBtn = document.getElementById('addHabitBtn');
  if (addHabitBtn) {
    addHabitBtn.addEventListener('click', () => openHabitModal());
  }

  const closeHabitModalBtn = document.getElementById('closeHabitModal');
  if (closeHabitModalBtn) {
    closeHabitModalBtn.addEventListener('click', closeHabitModal);
  }

  const habitForm = document.getElementById('habitForm');
  if (habitForm) {
    habitForm.addEventListener('submit', handleHabitSubmit);
  }

  document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
    appState.calendarMonth -= 1;
    if (appState.calendarMonth < 0) {
      appState.calendarMonth = 11;
      appState.calendarYear -= 1;
    }
    renderCalendar();
    renderDashboardInsights();
  });

  document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
    appState.calendarMonth += 1;
    if (appState.calendarMonth > 11) {
      appState.calendarMonth = 0;
      appState.calendarYear += 1;
    }
    renderCalendar();
    renderDashboardInsights();
  });

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
      setTheme(nextTheme);
    });
  }

  const logoutLink = Array.from(document.querySelectorAll('.nav-item')).find((item) => item.textContent.includes('Logout'));
  if (logoutLink) {
    logoutLink.addEventListener('click', (event) => {
      event.preventDefault();
      logout();
    });
  }
}

async function initializeCalendarPage() {
  const theme = localStorage.getItem(APP_THEME_KEY) || 'light';
  setTheme(theme);
  const query = new URLSearchParams(window.location.search);
  const requestedYear = Number(query.get('year'));
  const requestedMonth = Number(query.get('month'));
  if (Number.isInteger(requestedYear) && requestedYear >= 1970 && requestedYear <= 2100) appState.calendarYear = requestedYear;
  if (Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12) appState.calendarMonth = requestedMonth - 1;
  const token = getAuthToken();
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  setSidebarUser({ name: 'User', email: 'user@email.com' });
  await fetchCurrentUser();
  await fetchHabits();
  await fetchCompletions();
  startDateRolloverWatcher();

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
      setTheme(nextTheme);
    });
  }

  document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
    appState.calendarMonth -= 1;
    if (appState.calendarMonth < 0) {
      appState.calendarMonth = 11;
      appState.calendarYear -= 1;
    }
    renderCalendar();
  });

  document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
    appState.calendarMonth += 1;
    if (appState.calendarMonth > 11) {
      appState.calendarMonth = 0;
      appState.calendarYear += 1;
    }
    renderCalendar();
  });

  const logoutLink = Array.from(document.querySelectorAll('.nav-item')).find((item) => item.textContent.includes('Logout'));
  if (logoutLink) {
    logoutLink.addEventListener('click', (event) => {
      event.preventDefault();
      logout();
    });
  }
}

async function initializeStatisticsPage() {
  const theme = localStorage.getItem(APP_THEME_KEY) || 'light';
  setTheme(theme);
  const token = getAuthToken();
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  setSidebarUser({ name: 'User', email: 'user@email.com' });
  await fetchCurrentUser();
  await fetchHabits();
  await fetchCompletions();
  await fetchStats();

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
      setTheme(nextTheme);
    });
  }

  const logoutLink = Array.from(document.querySelectorAll('.nav-item')).find((item) => item.textContent.includes('Logout'));
  if (logoutLink) {
    logoutLink.addEventListener('click', (event) => {
      event.preventDefault();
      logout();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname.split('/').pop();

  if (path === 'login.html' || path === 'register.html' || path === 'index.html') {
    initializeAuthPage();
    return;
  }

  if (path === 'dashboard.html') {
    initializeDashboardPage();
  } else if (path === 'habits.html') {
    initializeHabitsPage();
  } else if (path === 'calendar.html') {
    initializeCalendarPage();
  } else if (path === 'statistics.html') {
    initializeStatisticsPage();
  } else if (path === 'settings.html') {
    initializeSettingsPage();
  }
});
