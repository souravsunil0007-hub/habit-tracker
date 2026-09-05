const Habit = require('../models/Habit');
const Completion = require('../models/Completion');

const getDaysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

const getTrackedDays = (year, monthIndex) => {
  const today = new Date();
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth();
  if (year > currentYear || (year === currentYear && monthIndex > currentMonth)) return 0;
  if (year < currentYear || monthIndex < currentMonth) return getDaysInMonth(year, monthIndex);
  return today.getUTCDate();
};

const buildMonthlyStats = (year, habits, completions) => Array.from({ length: 12 }, (_, month) => {
    const monthCompletions = completions.filter((completion) => {
    const date = new Date(completion.date);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month && completion.completed !== false;
  });
  const monthMissed = completions.filter((completion) => {
    const date = new Date(completion.date);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month && completion.completed === false;
  });
  const possible = habits.length * getTrackedDays(year, month);
  const completed = monthCompletions.length;

  return {
    month,
    name: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(year, month, 1)),
    days: getTrackedDays(year, month),
    habits: habits.length,
    completed,
    missed: monthMissed.length,
    pending: Math.max(possible - completed, 0),
    possible,
    progress: possible ? Number(((completed / possible) * 100).toFixed(2)) : 0,
  };
});

const getYearlyStatistics = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    if (!Number.isInteger(year) || year < 1970 || year > 2100) {
      return res.status(400).json({ message: 'A valid year is required' });
    }

    const habits = await Habit.find({ user: req.user._id, isActive: true });
    const completions = await Completion.find({ user: req.user._id }).populate('habit');
    const months = buildMonthlyStats(year, habits, completions);
    const completed = months.reduce((sum, month) => sum + month.completed, 0);
    const possible = months.reduce((sum, month) => sum + month.possible, 0);
    const bestMonth = months.reduce((best, month) => month.progress > best.progress ? month : best, months[0]);
    const lowestMonth = months.reduce((lowest, month) => month.progress < lowest.progress ? month : lowest, months[0]);
    const missedDetails = completions
      .filter((completion) => completion.completed === false && completion.habit)
      .map((completion) => ({
        habitId: completion.habit._id,
        habitName: completion.habit.name,
        category: completion.habit.category,
        date: new Date(completion.date).toISOString().slice(0, 10),
      }))
      .filter((completion) => completion.date.startsWith(String(year)));
    const categoryProgress = habits.reduce((categories, habit) => {
      const category = habit.category || 'Other';
      if (!categories[category]) categories[category] = { category, habits: 0, completed: 0, missed: 0, possible: 0 };
      categories[category].habits += 1;
      categories[category].possible += months.reduce((total, month) => total + month.days, 0);
      return categories;
    }, {});

    completions.forEach((completion) => {
      const date = new Date(completion.date);
      if (date.getUTCFullYear() !== year || !completion.habit) return;
      const category = completion.habit.category || 'Other';
      if (!categoryProgress[category]) return;
      if (completion.completed === false) categoryProgress[category].missed += 1;
      else categoryProgress[category].completed += 1;
    });
    Object.values(categoryProgress).forEach((item) => {
      item.progress = item.possible ? Number(((item.completed / item.possible) * 100).toFixed(2)) : 0;
    });

    return res.json({
      year,
      months,
      overview: {
        habits: habits.length,
        completed,
        missed: missedDetails.length,
        pending: Math.max(possible - completed, 0),
        possible,
        averageProgress: Number((months.reduce((sum, month) => sum + month.progress, 0) / 12).toFixed(2)),
        overallProgress: possible ? Number(((completed / possible) * 100).toFixed(2)) : 0,
        bestMonth: bestMonth.progress ? bestMonth.name : '-',
        lowestMonth: lowestMonth.name,
        totalCompleted: completed,
        totalMissed: missedDetails.length,
      },
      missedDetails,
      categoryProgress: Object.values(categoryProgress),
    });
  } catch (error) {
    console.error('Yearly statistics error:', error);
    return res.status(500).json({ message: 'Server error while fetching yearly statistics' });
  }
};

const getMonthlyStatistics = async (req, res) => {
  try {
    const year = Number(req.params.year);
    const month = Number(req.params.month);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Valid year and month are required' });
    }

    const habits = await Habit.find({ user: req.user._id, isActive: true });
    const completions = await Completion.find({ user: req.user._id });
    const monthStats = buildMonthlyStats(year, habits, completions)[month - 1];
    return res.json(monthStats);
  } catch (error) {
    console.error('Monthly statistics error:', error);
    return res.status(500).json({ message: 'Server error while fetching monthly statistics' });
  }
};

module.exports = { getYearlyStatistics, getMonthlyStatistics };
