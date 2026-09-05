const API_HOST = window.location.hostname || 'localhost';
const API_BASE = window.HABIT_API_URL || `${window.location.protocol}//${API_HOST}:5000/api`;
const TOKEN_KEY = 'habitTrackerToken';
const THEME_KEY = 'habitTrackerThemeV2';
let selectedYear = new Date().getFullYear();

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const shortMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function setTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(THEME_KEY, theme);
  const toggle = document.getElementById('yearlyThemeToggle');
  if (toggle) toggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

async function apiRequest(path) {
  const response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Could not load yearly statistics');
  return data;
}

function renderChart(months) {
  const chart = document.getElementById('yearChart');
  const axis = document.getElementById('chartAxis');
  const width = 1200;
  const height = 330;
  const points = months.map((month, index) => ({ x: 48 + index * ((width - 96) / 11), y: height - 24 - ((height - 48) * month.progress / 100) }));
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `48,${height - 24} ${line} ${width - 48},${height - 24}`;
  chart.innerHTML = `<polyline class="chart-area" points="${area}" /><polyline class="chart-line" points="${line}" />${points.map((point, index) => `<circle class="chart-point" cx="${point.x}" cy="${point.y}" r="6"><title>${months[index].name}: ${months[index].progress}%</title></circle>`).join('')}`;
  axis.innerHTML = shortMonths.map((month) => `<span>${month}</span>`).join('');
}

function renderMonths(months) {
  document.getElementById('monthlyGrid').innerHTML = months.map((month) => `
    <a class="month-card" href="calendar.html?year=${selectedYear}&month=${month.month}">
      <h3>${month.name.toUpperCase()}</h3>
      <div class="month-card-body">
        <div class="metric"><span>Number of Habits</span><strong>${month.habits}</strong></div>
        <div class="metric"><span>Completed</span><strong>${month.completed}</strong></div>
        <div class="metric missed"><span>Missed</span><strong>${month.missed}</strong></div>
        <div class="metric progress"><span>Progress</span><strong>${month.progress.toFixed(2)}%</strong></div>
      </div>
    </a>
  `).join('');
}

function renderGoalProgress(categories) {
  const list = document.getElementById('goalProgressList');
  const ring = document.getElementById('goalCategoryRing');
  const averageLabel = document.getElementById('goalCategoryAverage');
  const legend = document.getElementById('goalCategoryLegend');
  const items = categories || [];
  if (!list) return;
  list.innerHTML = items.length ? items.map((item) => `
    <div class="goal-progress-row"><div class="goal-progress-label"><strong>${item.category}</strong><span>${item.completed} complete · ${item.missed} missed</span></div><b>${item.progress}%</b></div>
    <div class="goal-progress-track"><span style="width:${Math.min(item.progress, 100)}%"></span></div>
  `).join('') : '<p class="year-empty">Create a habit to see goal progress.</p>';
  const average = items.length ? items.reduce((sum, item) => sum + item.progress, 0) / items.length : 0;
  if (averageLabel) averageLabel.textContent = `${average.toFixed(0)}%`;
  if (ring) ring.style.setProperty('--goal-progress', `${average}%`);
  if (legend) legend.innerHTML = items.map((item) => `<span><i></i>${item.category}</span>`).join('');
}

function renderOverview(overview, stats) {
  const values = [
    ['Total Habits', overview.habits],
    ['Completed Tasks', overview.completed],
    ['Pending Tasks', overview.pending],
    ['Average Monthly Progress', `${overview.averageProgress.toFixed(2)}%`],
    ['Best Month', overview.bestMonth],
    ['Lowest Month', overview.lowestMonth],
    ['Current Streak', stats.currentStreak ?? 0],
    ['Longest Streak', stats.longestStreak ?? 0],
    ['Overall Yearly Progress', `${overview.overallProgress.toFixed(2)}%`],
    ['Total Completed', overview.totalCompleted ?? overview.completed],
    ['Total Missed', overview.totalMissed ?? overview.missed ?? 0],
    ['Daily Progress', `${stats.daily?.rate ?? 0}%`],
    ['Weekly Progress', `${stats.weekly?.rate ?? 0}%`],
    ['Monthly Progress', `${stats.monthly?.rate ?? 0}%`],
  ];
  document.getElementById('overviewGrid').innerHTML = values.map(([label, value]) => `<div class="overview-item"><span>${label}</span><strong>${value}</strong></div>`).join('');
  document.getElementById('overallProgress').textContent = `${overview.overallProgress.toFixed(2)}%`;
}

function renderMissedDetails(details) {
  const list = document.getElementById('yearMissedList');
  const count = document.getElementById('missedYearCount');
  const yearDetails = (details || []).filter((item) => item.date.startsWith(String(selectedYear)));
  if (count) count.textContent = `${yearDetails.length} records`;
  if (!list) return;
  list.innerHTML = yearDetails.length ? yearDetails.map((item) => `
    <div class="year-missed-item"><span>❌</span><div><strong>${item.habitName}</strong><small>${item.date} · ${item.category}</small></div></div>
  `).join('') : '<p class="year-empty">No missed habits recorded for this year.</p>';
}

function renderMonthLinks() {
  document.getElementById('monthLinks').innerHTML = monthNames.map((month, index) => `<a href="calendar.html?year=${selectedYear}&month=${index + 1}">${month.slice(0, 3)}</a>`).join('');
}

async function loadYear() {
  document.getElementById('yearLabel').textContent = selectedYear;
  document.getElementById('chartTitle').textContent = `${selectedYear} completion trend`;
  renderMonthLinks();
  try {
    const data = await apiRequest(`/yearly-stats?year=${selectedYear}`);
    renderChart(data.months);
    renderMonths(data.months);
    renderGoalProgress(data.categoryProgress);
    const stats = await apiRequest('/statistics');
    renderOverview(data.overview, stats);
    renderMissedDetails(data.missedDetails);
  } catch (error) {
    if (error.message.toLowerCase().includes('authentication')) localStorage.removeItem(TOKEN_KEY);
    document.getElementById('monthlyGrid').innerHTML = `<p>${error.message}. Please log in again.</p>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!localStorage.getItem(TOKEN_KEY)) { window.location.href = 'login.html'; return; }
  setTheme(localStorage.getItem(THEME_KEY) || 'light');
  document.getElementById('prevYear').addEventListener('click', () => { selectedYear -= 1; loadYear(); });
  document.getElementById('nextYear').addEventListener('click', () => { selectedYear += 1; loadYear(); });
  document.getElementById('yearlyThemeToggle').addEventListener('click', () => setTheme(document.body.classList.contains('dark') ? 'light' : 'dark'));
  document.getElementById('logoutButton').addEventListener('click', () => { localStorage.removeItem(TOKEN_KEY); window.location.href = 'login.html'; });
  loadYear();
});
