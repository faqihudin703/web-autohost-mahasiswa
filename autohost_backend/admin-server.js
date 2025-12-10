// backend/admin-server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const db = require('./config/db');
const { adminProtect } = require('./middleware/adminAuthMiddleware');
const { protect } = require('./middleware/authMiddleware');
const { loginAdmin, forceDeleteProject, banUser } = require('./controllers/adminAuthController');

const app = express();
const ADMIN_PORT = process.env.ADMIN_PORT || 3060;
const HOST_IP = process.env.HOST_IP || '127.0.0.1';
const ADMIN_FRONTEND_PORT = 6050; // Port frontend admin Anda

// Konfigurasi CORS
app.use(cors({ 
    origin: [`http://${HOST_IP}:${ADMIN_FRONTEND_PORT}`], 
    credentials: true 
}));

// Middleware lain
app.use(cookieParser());
app.use(express.json());


// --- RUTE-RUTE ADMIN ---

// Rute Publik
app.post('/admin/login', loginAdmin);

// Rute Terproteksi
// CHECK LOGIN
app.get('/admin/check-auth', adminProtect, (req, res) => {
    res.status(200).json({ 
        success: true, 
        admin: { 
            id: req.admin.id,
            username: req.admin.username,
            email: req.admin.email,
            role: req.admin.role
        } 
    });
});

// LOGOUT
app.post('/admin/logout', (req, res) => {
    res.clearCookie('admin_token', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/'
    });

    res.status(200).json({ success: true, message: 'Logout berhasil' });
});

// GET USERS
app.get('/admin/users', adminProtect, async (req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT id, username, email, created_at FROM users ORDER BY created_at DESC'
        );

        res.status(200).json({
            success: true,
            message: "Data pengguna berhasil diambil.",
            data: users
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error." });
    }
});

// GET PROJECTS
app.get('/admin/projects', adminProtect, async (req, res) => {
    try {
        const query = `
            SELECT p.id, p.subdomain, p.project_name, p.status, p.public_url, p.created_at, u.username 
            FROM projects p
            LEFT JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
        `;
        const [projects] = await db.execute(query);

        res.status(200).json({
            success: true,
            message: "Data proyek berhasil diambil.",
            data: projects
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error." });
    }
});

// GET LOGS
app.get('/admin/logs', adminProtect, async (req, res) => {
    try {
        const query = `
            SELECT l.id, l.action, l.message, l.ip_address, l.created_at, u.username 
            FROM activity_logs l 
            LEFT JOIN users u ON l.user_id = u.id 
            ORDER BY l.created_at DESC 
            LIMIT 100
        `;
        const [logs] = await db.execute(query);

        res.status(200).json({
            success: true,
            message: "Log aktivitas berhasil diambil.",
            data: logs
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error." });
    }
});

// FORCE DELETE PROJECT
app.delete('/admin/projects/:id', adminProtect, forceDeleteProject);

// BAN USER
app.delete('/admin/users/:id', adminProtect, banUser);

// Sajikan file statis HANYA setelah semua rute API didefinisikan
app.use(express.static('public_admin'));


app.listen(ADMIN_PORT, HOST_IP, () => {
    console.log(`🚀 Server Admin berjalan di http://${HOST_IP}:${ADMIN_PORT}`);
});