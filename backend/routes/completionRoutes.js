const express = require('express');
const {
  markHabitComplete,
  undoHabitCompletion,
  syncMissedCompletions,
  getCompletionHistory,
  getHabitCompletionForDate,
} = require('../controllers/completionController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/complete', protect, markHabitComplete);
router.post('/', protect, markHabitComplete);
router.post('/undo', protect, undoHabitCompletion);
router.post('/sync-missed', protect, syncMissedCompletions);
router.get('/history', protect, getCompletionHistory);
router.get('/date', protect, getHabitCompletionForDate);

module.exports = router;
