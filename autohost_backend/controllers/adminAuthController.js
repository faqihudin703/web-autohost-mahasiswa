// backend/controllers/adminAuthController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const fsp = require('fs').promises;
const { exec } = require('child_process');
const { logActivity } = require('../services/logService');
const apacheService = require('../services/apacheService');
const cloudflareService = require('../services/cloudflareService');
const wafService = require('../services/wafService');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '8h' });
};

const cleanupProjectResources = async (subdomain) => {
    try {
        console.log(`[Admin Cleanup] Membersihkan resource: ${subdomain}`);
        // Hapus Cloudflare, DNS, WAF, Apache (Parallel / Best Effort)
        await Promise.allSettled([
            cloudflareService.removeHostnameFromTunnel(subdomain),
            cloudflareService.deleteDnsRecord(subdomain),
            wafService.removeHostFromWaf(subdomain),
            apacheService.cleanup(subdomain)
        ]);

        // Hapus Folder Fisik
        const projectPath = `/var/www/projects/${subdomain}`;
        await new Promise(r => exec(`sudo rm -rf ${projectPath}`, r));
        return true;
    } catch (err) {
        console.error(`[Admin Cleanup Error] ${subdomain}:`, err.message);
        return false;
    }
};

const loginAdmin = async (req, res) => {
    const { identifier, password } = req.body;

    try {
        if (!identifier || !password) {
            return res.status(400).json({ success: false, message: "Username/Email dan Password wajib diisi." });
        }

        const [admins] = await db.execute(
            'SELECT * FROM admins WHERE email = ? OR username = ? LIMIT 1',
            [identifier, identifier]
        );

        if (admins.length === 0) {
            return res.status(401).json({ success: false, message: "Kredensial Admin tidak valid." });
        }

        const admin = admins[0];

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Kredensial Admin tidak valid." });
        }

        const token = generateToken(admin.id);

        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 8 * 60 * 60 * 1000
        });

        return res.json({ success: true, message: "Login admin berhasil" });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const forceDeleteProject = async (req, res) => {
    const { id } = req.params; // ID Project
    const adminId = req.admin.id;

    try {
        // 1. Cek Data Project (Tanpa Cek Owner)
        const [rows] = await db.execute('SELECT subdomain, project_name FROM projects WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Proyek tidak ditemukan." });
        
        const { subdomain, project_name } = rows[0];

        // 2. Lakukan Pembersihan Total
        await cleanupProjectResources(subdomain);

        // 3. Hapus dari Database
        await db.execute('DELETE FROM projects WHERE id = ?', [id]);

        res.status(200).json({ success: true, message: `Proyek ${subdomain} berhasil di-takedown permanen.` });

    } catch (error) {
        console.error("[Admin Delete Project Error]", error);
        res.status(500).json({ success: false, message: "Server Error saat takedown." });
    }
};

// --- FITUR 2: BAN USER (FORCE DELETE ACCOUNT) ---
const banUser = async (req, res) => {
    const { id } = req.params; // ID User Target
    const adminId = req.admin.id;

    try {
        // 1. Cek User Target
        const [users] = await db.execute('SELECT username, role FROM users WHERE id = ?', [id]);
        if (users.length === 0) return res.status(404).json({ success: false, message: "User tidak ditemukan." });
        
        const targetUser = users[0];

        // Proteksi: Admin tidak boleh nge-ban sesama Admin (Mencegah Kudeta)
        if (targetUser.role === 'admin') {
            return res.status(403).json({ success: false, message: "Sesama Admin dilarang saling hapus." });
        }

        // 2. Ambil Semua Proyek User Ini
        const [projects] = await db.execute('SELECT subdomain FROM projects WHERE user_id = ?', [id]);

        // 3. Loop Hapus Semua Proyeknya (Cascading Wipe)
        if (projects.length > 0) {
            for (const proj of projects) {
                await cleanupProjectResources(proj.subdomain);
            }
        }

        // 4. Hapus User dari DB (Cascade akan hapus record proyek di DB juga)
        // Tapi kita hapus manual biar yakin.
        await db.execute('DELETE FROM projects WHERE user_id = ?', [id]);
        await db.execute('DELETE FROM users WHERE id = ?', [id]);

        res.status(200).json({ success: true, message: `User ${targetUser.username} dan seluruh asetnya telah dimusnahkan.` });

    } catch (error) {
        console.error("[Admin Ban User Error]", error);
        res.status(500).json({ success: false, message: "Server Error saat ban user." });
    }
};

module.exports = { loginAdmin, forceDeleteProject, banUser };