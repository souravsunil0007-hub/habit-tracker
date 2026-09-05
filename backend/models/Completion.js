const mongoose = require('mongoose');

const completionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    habit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Habit',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    completed: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
  },
  {
    timestamps: true,
  }
);

completionSchema.index({ user: 1, habit: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Completion', completionSchema);
