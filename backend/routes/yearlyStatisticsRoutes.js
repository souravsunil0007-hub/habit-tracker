const express = require('express');
const { getYearlyStatistics, getMonthlyStatistics } = require('../controllers/yearlyStatisticsController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, getYearlyStatistics);
router.get('/:year/:month', protect, getMonthlyStatistics);

module.exports = router;
