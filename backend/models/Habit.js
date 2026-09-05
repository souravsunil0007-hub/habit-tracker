const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Habit name is required'],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    category: {
      type: String,
      enum: ['Health', 'Study', 'Fitness', 'Personal', 'Other'],
      default: 'Other',
    },
    frequency: {
      type: String,
      enum: ['Daily', 'Weekly', 'Custom'],
      default: 'Daily',
    },
    startDate: {
      type: Date,
      required: true,
    },
    dailyGoal: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Habit', habitSchema);
