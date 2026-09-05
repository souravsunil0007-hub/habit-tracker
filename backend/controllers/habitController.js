const Habit = require('../models/Habit');
const Completion = require('../models/Completion');

const createHabit = async (req, res) => {
  try {
    const { name, description, category, frequency, startDate, dailyGoal } = req.body;

    if (!name || !startDate || !dailyGoal) {
      return res.status(400).json({ message: 'Name, start date and daily goal are required' });
    }

    const habit = await Habit.create({
      user: req.user._id,
      name,
      description: description || '',
      category: category || 'Other',
      frequency: frequency || 'Daily',
      startDate,
      dailyGoal,
    });

    res.status(201).json({ message: 'Habit created successfully', habit });
  } catch (error) {
    console.error('Create habit error:', error);
    res.status(500).json({ message: 'Server error while creating habit' });
  }
};

const getHabits = async (req, res) => {
  try {
    const habits = await Habit.find({ user: req.user._id, isActive: true }).sort({ createdAt: -1 });
    res.json({ habits });
  } catch (error) {
    console.error('Get habits error:', error);
    res.status(500).json({ message: 'Server error while fetching habits' });
  }
};

const updateHabit = async (req, res) => {
  try {
    const habit = await Habit.findOne({ _id: req.params.id, user: req.user._id });

    if (!habit) {
      return res.status(404).json({ message: 'Habit not found' });
    }

    const { name, description, category, frequency, startDate, dailyGoal, isActive } = req.body;

    const updatedHabit = await Habit.findByIdAndUpdate(
      req.params.id,
      {
        name: name || habit.name,
        description: description !== undefined ? description : habit.description,
        category: category || habit.category,
        frequency: frequency || habit.frequency,
        startDate: startDate || habit.startDate,
        dailyGoal: dailyGoal || habit.dailyGoal,
        isActive: isActive !== undefined ? isActive : habit.isActive,
      },
      { new: true }
    );

    res.json({ message: 'Habit updated successfully', habit: updatedHabit });
  } catch (error) {
    console.error('Update habit error:', error);
    res.status(500).json({ message: 'Server error while updating habit' });
  }
};

const deleteHabit = async (req, res) => {
  try {
    const habit = await Habit.findOne({ _id: req.params.id, user: req.user._id });

    if (!habit) {
      return res.status(404).json({ message: 'Habit not found' });
    }

    await Completion.deleteMany({ user: req.user._id, habit: req.params.id });
    await Habit.findByIdAndDelete(req.params.id);

    res.json({ message: 'Habit deleted successfully' });
  } catch (error) {
    console.error('Delete habit error:', error);
    res.status(500).json({ message: 'Server error while deleting habit' });
  }
};

module.exports = { createHabit, getHabits, updateHabit, deleteHabit };
