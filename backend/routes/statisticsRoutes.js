const express = require('express');
const { getStatistics } = require('../controllers/statisticsController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, getStatistics);

module.exports = router;
