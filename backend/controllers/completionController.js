const Habit = require('../models/Habit');
const Completion = require('../models/Completion');

const normalizeDate = (dateInput) => {
  const date = typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
    ? new Date(`${dateInput}T00:00:00.000Z`)
    : new Date(dateInput);
  return date;
};

const dateKey = (date) => {
  const value = new Date(date);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
};

const getYesterdayKey = (todayInput) => {
  const yesterday = todayInput ? new Date(`${todayInput}T00:00:00.000Z`) : new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return dateKey(yesterday);
};

const isToday = (dateInput, todayInput) => /^\d{4}-\d{2}-\d{2}$/.test(todayInput || '') && dateInput === todayInput;

const syncMissedCompletions = async (req, res) => {
  try {
    const habits = await Habit.find({ user: req.user._id, isActive: true });
    const yesterday = getYesterdayKey(req.body.today);
    const operations = [];

    habits.forEach((habit) => {
      const start = new Date(habit.startDate);
      const habitStartKey = dateKey(start);
      if (habitStartKey > yesterday) return;
      const startKey = habitStartKey;
      const current = new Date(`${startKey}T00:00:00.000Z`);
      const end = new Date(`${yesterday}T00:00:00.000Z`);

      while (current <= end) {
        const date = new Date(current);
        operations.push({
          updateOne: {
            filter: { user: req.user._id, habit: habit._id, date },
            update: { $setOnInsert: { user: req.user._id, habit: habit._id, date, completed: false } },
            upsert: true,
          },
        });
        current.setUTCDate(current.getUTCDate() + 1);
      }
    });

    if (operations.length) await Completion.bulkWrite(operations, { ordered: false });
    res.json({ message: 'Missed dates synchronized' });
  } catch (error) {
    console.error('Sync missed completions error:', error);
    res.status(500).json({ message: 'Server error while synchronizing missed dates' });
  }
};

const markHabitComplete = async (req, res) => {
  try {
    const { habitId, date, today } = req.body;

    if (!habitId || !date) {
      return res.status(400).json({ message: 'Habit ID and date are required' });
    }

    if (!isToday(date, today)) {
      return res.status(400).json({ message: 'Only today can be marked complete' });
    }

    const habit = await Habit.findOne({ _id: habitId, user: req.user._id });
    if (!habit) {
      return res.status(404).json({ message: 'Habit not found' });
    }

    const normalizedDate = normalizeDate(date);

    const existing = await Completion.findOne({
      user: req.user._id,
      habit: habitId,
      date: normalizedDate,
    });

    if (existing) {
      if (existing.completed === false) {
        existing.completed = true;
        await existing.save();
        return res.status(200).json({ message: 'Habit marked complete', completion: existing });
      }
      return res.status(400).json({ message: 'Habit already marked complete for this date' });
    }

    const completion = await Completion.create({
      user: req.user._id,
      habit: habitId,
      date: normalizedDate,
      completed: true,
    });

    res.status(201).json({ message: 'Habit marked complete', completion });
  } catch (error) {
    console.error('Mark complete error:', error);
    res.status(500).json({ message: 'Server error while marking habit complete' });
  }
};

const undoHabitCompletion = async (req, res) => {
  try {
    const { habitId, date, today } = req.body;

    if (!habitId || !date) {
      return res.status(400).json({ message: 'Habit ID and date are required' });
    }

    if (!isToday(date, today)) {
      return res.status(400).json({ message: 'Only today can be changed' });
    }

    const normalizedDate = normalizeDate(date);
    const existing = await Completion.findOne({
      user: req.user._id,
      habit: habitId,
      date: normalizedDate,
    });

    if (!existing) {
      return res.status(404).json({ message: 'Completion record not found' });
    }

    await existing.deleteOne();

    res.json({ message: 'Habit completion undone' });
  } catch (error) {
    console.error('Undo completion error:', error);
    res.status(500).json({ message: 'Server error while undoing completion' });
  }
};

const getCompletionHistory = async (req, res) => {
  try {
    const completions = await Completion.find({ user: req.user._id }).sort({ date: -1 }).populate('habit');
    res.json({ completions });
  } catch (error) {
    console.error('Get completion history error:', error);
    res.status(500).json({ message: 'Server error while fetching completion history' });
  }
};

const getHabitCompletionForDate = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    const completions = await Completion.find({
      user: req.user._id,
      date: normalizeDate(date),
    }).populate('habit');

    res.json({ completions });
  } catch (error) {
    console.error('Get completion date error:', error);
    res.status(500).json({ message: 'Server error while fetching habit completion for date' });
  }
};

module.exports = {
  syncMissedCompletions,
  markHabitComplete,
  undoHabitCompletion,
  getCompletionHistory,
  getHabitCompletionForDate,
};
