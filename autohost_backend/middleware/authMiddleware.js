// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const COOKIE_OPTIONS = require('../config/cookieOptions');

const protect = async (req, res, next) => {
    // 1. Ambil token dari cookie
    // Pastikan cookie-parser sudah dipasang di index.js/server.js
    const token = req.cookies.token;

    if (token) {
        try {
            // 2. Verifikasi Signature Token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // 3. Cek User di Database (PENTING!)
            // Kita harus pastikan user PEMILIK token ini masih ada di DB.
            const [rows] = await db.execute('SELECT id, username, email FROM users WHERE id = ?', [decoded.id]);
            const user = rows[0];

            // --- PERBAIKAN FATAL: ZOMBIE USER CHECK ---
            if (!user) {
                // Token valid secara kriptografi, tapi user sudah dihapus dari DB
                // Hapus cookie 'bangkai' ini agar klien tidak mengirimnya lagi
                res.clearCookie('token', {
                    ...COOKIE_OPTIONS
                });
                
                return res.status(401).json({ success: false, message: 'Token tidak valid (User tidak ditemukan).' });
            }
            // ------------------------------------------

            // Attach user ke request object agar bisa dipakai di controller
            req.user = user;
            next();

        } catch (error) {
            // Token kadaluarsa atau dimanipulasi
            // Hapus cookie rusak
            res.clearCookie('token', {
                ...COOKIE_OPTIONS
            });
            
            res.status(401).json({ success: false, message: 'Tidak terotentikasi, token gagal.' });
        }
    } else {
        res.status(401).json({ success: false, message: 'Tidak terotentikasi, tidak ada token.' });
    }
};

const guestOnly = (req, res, next) => {
    const token = req.cookies.token;

    // ✅ Jika TIDAK ada token → tamu murni → boleh lanjut
    if (!token) {
        return next();
    }

    try {
        // ✅ Coba verifikasi token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // ✅ Cek user di database (sinkron dengan protect)
        db.execute(
            'SELECT id FROM users WHERE id = ?', 
            [decoded.id]
        ).then(([rows]) => {
            const user = rows[0];

            if (!user) {
                // ✅ Token zombie → hapus → anggap tamu
                res.clearCookie('token', { ...COOKIE_OPTIONS });
                return next();
            }

            // ✅ USER MASIH VALID → BENAR-BENAR SUDAH LOGIN
            // ⛔ Maka TOLAK akses ke halaman guest (login/register)
            return res.status(403).json({
                success: false,
                message: "Anda sudah login."
            });
        }).catch(() => {
            // Jika query DB error → anggap tamu demi UX
            return next();
        });

    } catch (error) {
        // ✅ Token kadaluarsa / rusak → hapus → jadi tamu
        res.clearCookie('token', { ...COOKIE_OPTIONS });
        return next();
    }
};



module.exports = { protect, guestOnly };