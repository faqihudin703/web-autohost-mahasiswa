// backend/middleware/adminAuthMiddleware.js
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const adminProtect = async (req, res, next) => {
    const token = req.cookies.admin_token;

    if (!token) {
        return res.status(401).json({ success: false, message: 'Tidak terotentikasi, token tidak ada.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Ambil admin berdasarkan ID
        const [admins] = await db.execute(
            'SELECT * FROM admins WHERE id = ? LIMIT 1',
            [decoded.id]
        );

        if (admins.length === 0) {
            return res.status(401).json({ success: false, message: 'Admin tidak ditemukan.' });
        }

        req.admin = admins[0]; // simpan data admin
        next();

    } catch (error) {
        return res.status(401).json({ success: false, message: 'Token admin tidak valid.' });
    }
};

module.exports = { adminProtect };
