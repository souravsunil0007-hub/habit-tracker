const express = require('express');
const { registerUser, loginUser, getMe, updateTheme, logoutUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);
router.get('/me', protect, getMe);
router.put('/theme', protect, updateTheme);

module.exports = router;
