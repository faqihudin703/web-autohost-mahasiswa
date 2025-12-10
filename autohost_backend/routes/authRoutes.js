// backend/routes/authRoutes.js
const express = require('express');
const { registerUser, loginUser, logoutUser, deleteAccount, resetPassword } = require('../controllers/authController');
const router = express.Router();
const { protect, guestOnly } = require('../middleware/authMiddleware'); // Import guestOnly

// --- PASANG GUEST ONLY DI SINI ---
// User yang sudah login TIDAK BOLEH akses ini lagi
router.post('/register', guestOnly, registerUser);
router.post('/login', guestOnly, loginUser);
router.post('/forgot-password', guestOnly, resetPassword);

router.delete('/me', protect, deleteAccount); // <-- Tambahkan rute ini
router.post('/logout', protect, logoutUser);

module.exports = router;