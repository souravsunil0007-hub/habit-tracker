const Habit = require('../models/Habit');
const Completion = require('../models/Completion');

const getDateKey = (date) => {
  const value = new Date(date);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
};

const getStartOfDay = (date) => {
  const [year, month, day] = getDateKey(date).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const getEndOfDay = (date) => {
  return new Date(getStartOfDay(date).getTime() + 24 * 60 * 60 * 1000 - 1);
};

const getDateRange = (period) => {
  const today = new Date();
  const todayStart = getStartOfDay(today);
  const start = new Date(todayStart);

  if (period === 'daily') {
    return { start, end: getEndOfDay(today) };
  }

  if (period === 'weekly') {
    const day = today.getUTCDay();
    const diff = (day === 0 ? -6 : 1 - day);
    start.setUTCDate(start.getUTCDate() + diff);
    return { start, end: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1) };
  }

  if (period === 'monthly') {
    start.setUTCDate(1);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1) - 1);
    return { start, end };
  }

  return { start, end: new Date() };
};

const calculateStreaks = async (userId) => {
  const habits = await Habit.find({ user: userId, isActive: true });

  let currentStreak = 0;
  let longestStreak = 0;

  const allDates = new Set();

  for (const habit of habits) {
    const completions = await Completion.find({ user: userId, habit: habit._id, completed: true }).sort({ date: 1 });
    const uniqueDates = completions.map((item) => getDateKey(item.date));

    if (uniqueDates.length === 0) continue;

    let streak = 1;
    let lastDate = new Date(uniqueDates[0]);

    for (let i = 1; i < uniqueDates.length; i++) {
      const currentDate = new Date(uniqueDates[i]);
      const diff = (currentDate - lastDate) / (1000 * 60 * 60 * 24);

      if (diff === 1) {
        streak += 1;
      } else if (diff > 1) {
        streak = 1;
      }

      if (streak > longestStreak) longestStreak = streak;
      lastDate = currentDate;
    }

    if (streak > longestStreak) longestStreak = streak;

    const today = new Date();
    const todayKey = getDateKey(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayKey = getDateKey(yesterday);

    if (uniqueDates.includes(todayKey) || uniqueDates.includes(yesterdayKey)) {
      currentStreak += 1;
    }

    uniqueDates.forEach((date) => allDates.add(date));
  }

  return {
    currentStreak,
    longestStreak,
    totalCompletedHabits: allDates.size,
  };
};

const getStatistics = async (req, res) => {
  try {
    const userId = req.user._id;
    const habits = await Habit.find({ user: userId, isActive: true });

    if (!habits.length) {
      return res.json({
        overview: {
          totalHabits: 0,
          completedHabits: 0,
          pendingHabits: 0,
          completionRate: 0,
          currentStreak: 0,
          longestStreak: 0,
          totalCompleted: 0,
          totalMissed: 0,
        },
        daily: { rate: 0, completed: 0, total: 0 },
        weekly: { rate: 0, completed: 0, total: 0 },
        monthly: { rate: 0, completed: 0, total: 0 },
        history: [],
        missedDetails: [],
      });
    }

    const overview = {
      totalHabits: habits.length,
      completedHabits: 0,
      pendingHabits: habits.length,
      completionRate: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalCompleted: 0,
      totalMissed: 0,
    };

    const today = new Date();
    const todayStart = getStartOfDay(today);
    const todayEnd = getEndOfDay(today);

    const dailyCompletions = await Completion.find({
      user: userId,
      date: { $gte: todayStart, $lte: todayEnd },
      completed: true,
    });

    overview.completedHabits = dailyCompletions.length;
    overview.pendingHabits = Math.max(habits.length - dailyCompletions.length, 0);
    overview.completionRate = habits.length ? Number(((dailyCompletions.length / habits.length) * 100).toFixed(1)) : 0;

    const streakData = await calculateStreaks(userId);
    overview.currentStreak = streakData.currentStreak;
    overview.longestStreak = streakData.longestStreak;
    overview.totalCompleted = streakData.totalCompletedHabits;

    const allCompletions = await Completion.find({ user: userId }).populate('habit').sort({ date: -1 });
    const missedDetails = allCompletions
      .filter((completion) => completion.completed === false && completion.habit)
      .map((completion) => ({
        habitId: completion.habit._id,
        habitName: completion.habit.name,
        category: completion.habit.category,
        date: getDateKey(completion.date),
      }));
    overview.totalMissed = missedDetails.length;

    const periods = ['daily', 'weekly', 'monthly'];
    const statsPayload = {};

    for (const period of periods) {
      const { start, end } = getDateRange(period);
      const completions = await Completion.find({
        user: userId,
        date: { $gte: start, $lte: end },
        completed: true,
      });

      const expected = habits.length;
      const completed = completions.length;
      const rate = expected ? Number(((completed / expected) * 100).toFixed(1)) : 0;

      statsPayload[period] = {
        rate,
        completed,
        missed: allCompletions.filter((completion) => {
          if (completion.completed !== false) return false;
          const value = new Date(completion.date);
          return value >= start && value <= end;
        }).length,
        total: expected,
      };
    }

    const history = await Completion.find({ user: userId, completed: true }).sort({ date: -1 }).limit(30);

    res.json({
      overview,
      daily: statsPayload.daily,
      weekly: statsPayload.weekly,
      monthly: statsPayload.monthly,
      history,
      missedDetails,
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ message: 'Server error while fetching statistics' });
  }
};

module.exports = { getStatistics };
