// backend/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const apacheService = require('../services/apacheService');
const cloudflareService = require('../services/cloudflareService');
const wafService = require('../services/wafService');
const { logActivity } = require('../services/logService');

// Fungsi untuk membuat token JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '1d', // Token berlaku 1 hari
    });
};

const COOKIE_OPTIONS = require('../config/cookieOptions');

// --- HELPER VALIDASI KREDENSIAL (USER & EMAIL) ---
// Helper ini digunakan untuk Register, Login, dan Reset Password
const validateCredentials = (username, password, email = null) => {
    // 1. Validasi Username (Jika ada)
    if (username !== null) {
        if (typeof username !== 'string') return "Username harus berupa teks.";
        if (username.length < 5) return "Username minimal 5 karakter.";
        if (username.length > 25) return "Username terlalu panjang (maksimal 25 karakter).";
        if (/\s/.test(username)) return "Username tidak boleh mengandung spasi.";
        if (!/^[a-zA-Z0-9]+$/.test(username)) return "Username hanya boleh berisi huruf dan angka.";
    }

    // 2. Validasi Password (Jika ada)
    if (password !== null) {
        if (typeof password !== 'string') return "Password harus berupa teks.";
        if (password.length < 8) return "Password minimal 8 karakter.";
        // Mencegah DoS hashing password super panjang
        if (password.length > 72) return "Password terlalu panjang (maksimal 72 karakter)."; 
        if (/\s/.test(password)) return "Password tidak boleh mengandung spasi.";
    }

    // 3. Validasi Email (Jika ada - BARU)
    // 3. Validasi Email (SUPER STRICT)
    if (email !== null) {
        if (typeof email !== 'string') return "Email harus berupa teks.";
        if (!email) return "Email wajib diisi.";
        
        // Cek Panjang (RFC 5321 Standard: Max 254, tapi kita batasi 100 biar aman)
        if (email.length > 100) return "Email terlalu panjang (maksimal 100 karakter).";

        // Cek Spasi (Trimming issue)
        if (/\s/.test(email)) return "Format email salah (tidak boleh ada spasi).";

        // REGEX FINAL (Anti-Hacker & Anti-Typo):
        // 1. ^[a-zA-Z0-9._-]+ : Header hanya boleh huruf, angka, titik, underscore, dash.
        // 2. (?!.*[.]{2})    : Negative lookahead, mencegah dua titik berturut-turut (..)
        // 3. @               : Wajib ada @
        // 4. [a-zA-Z0-9.-]+  : Domain boleh huruf, angka, titik, dash.
        // 5. \.[a-zA-Z]{2,}$ : TLD Wajib Titik lalu Huruf minimal 2 digit (contoh: .id, .com). Gak boleh angka.
        const emailRegex = /^(?!.*[.]{2})[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        
        if (!emailRegex.test(email)) return "Format email tidak valid.";
    }
    return null; // Lolos Validasi
};

// --- REGISTER USER (WAJIB EMAIL) ---
const registerUser = async (req, res) => {
    const { username, password, email } = req.body;

    // 1. Validasi Input (Username, Password, DAN Email)
    const validationError = validateCredentials(username, password, email);
    if (validationError) {
        return res.status(400).json({ success: false, message: validationError });
    }

    try {
        // 2. Cek Duplikasi Username
        const [userCheck] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (userCheck.length > 0) {
            return res.status(400).json({ success: false, message: 'Username sudah terdaftar.' });
        }

        // 3. Cek Duplikasi Email (BARU)
        const [emailCheck] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (emailCheck.length > 0) {
            return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });
        }

        // 4. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 5. Simpan ke DB (Termasuk Email)
        const [result] = await db.execute(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );

        if (result.insertId) {
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            await logActivity(result.insertId, 'REGISTER', `User ${username} (${email}) mendaftar.`, ip);

            res.status(201).json({
                success: true,
                message: 'Registrasi berhasil.',
                userId: result.insertId
            });
        } else {
            res.status(400).json({ success: false, message: 'Data user tidak valid.' });
        }
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
    }
};

// --- LOGIN USER (HYBRID: USERNAME / EMAIL) ---
const loginUser = async (req, res) => {
    // Frontend mengirim 'identifier' yang bisa berisi username ATAU email
    const { identifier, password } = req.body;

    // 1. Validasi Input Dasar
    if (!identifier || !password) {
        return res.status(400).json({ success: false, message: "Username/Email dan Password wajib diisi." });
    }
    
    if (typeof identifier !== 'string') {
        return res.status(400).json({ 
            success: false, 
            message: "Format identifier tidak valid." 
        });
    }

    // 2. Tentukan apakah ini Email atau Username
    // Deteksi sederhana: Kalau ada '@', kita anggap email
    const isEmail = identifier.includes('@');

    // Lakukan validasi format sesuai tipe (untuk efisiensi sebelum ke DB)
    let validationError = null;
    if (isEmail) {
        validationError = validateCredentials(null, password, identifier); // Cek format email & pass
    } else {
        validationError = validateCredentials(identifier, password, null); // Cek format username & pass
    }

    if (validationError) {
         return res.status(400).json({ success: false, message: `Format login salah: ${validationError}` });
    }

    try {
        // 3. Cari User di Database (Query Dinamis)
        const query = isEmail ? 'SELECT * FROM users WHERE email = ?' : 'SELECT * FROM users WHERE username = ?';
        const [users] = await db.execute(query, [identifier]);
        const user = users[0];

        // 4. Verifikasi Password
        if (user && (await bcrypt.compare(password, user.password))) {
            const token = generateToken(user.id);

            res.cookie('token', token, {
                ...COOKIE_OPTIONS,
                maxAge: 24 * 60 * 60 * 1000
            });

            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            await logActivity(user.id, 'LOGIN', `User ${user.username} login via ${isEmail ? 'Email' : 'Username'}.`, ip);

            res.status(200).json({
                success: true,
                message: 'Login berhasil.',
                user: { id: user.id, username: user.username, email: user.email }
            });
        } else {
            // Pesan error generik untuk keamanan
            res.status(401).json({ success: false, message: 'Akun tidak ditemukan atau password salah.' });
        }
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: "Terjadi kesalahan server saat login." });
    }
};

// --- LOGOUT USER ---
const logoutUser = async (req, res) => {
    try {
        // 1. Audit Log
        if (req.user) {
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            // Gunakan try-catch internal agar jika log gagal, logout TETAP JALAN
            try {
                await logActivity(req.user.id, 'LOGOUT', `User ${req.user.username} logout.`, ip);
            } catch (logError) {
                console.error("Gagal mencatat log logout (Non-Fatal):", logError.message);
            }
        }
        
        // 2. Clear Cookie (Standard Procedure)
        // Kita tidak butuh maxAge saat clear, tapi parameter lain WAJIB SAMA.
        // Trik: Spread operator (...) akan menyalin path, httpOnly, dll.
        res.clearCookie('token', COOKIE_OPTIONS);

        res.status(200).json({ success: true, message: "Logout berhasil." });

    } catch (error) {
        console.error("Logout error (Critical):", error);
        
        // 3. FAIL-SAFE (Jalan Darurat)
        // Jika terjadi error parah di blok try, KITA TETAP PAKSA HAPUS COOKIE.
        // Jangan biarkan user terjebak dalam sesi karena server error.
        res.clearCookie('token', COOKIE_OPTIONS);
        
        // Tetap return 200 agar Frontend me-redirect user ke login page
        res.status(200).json({ success: true, message: "Logout dipaksa (Server Error)." });
    }
};

// --- DELETE ACCOUNT ---
const deleteAccount = async (req, res) => {
    // Ambil ID dari Token
    const userId = req.user.id;
    // Ambil Password dari Body untuk verifikasi akhir
    const { password } = req.body;

    try {
        // 1. VALIDASI INPUT: Password Wajib Ada
        if (!password) {
            return res.status(400).json({ success: false, message: "Konfirmasi password diperlukan untuk menghapus akun." });
        }

        // 2. VERIFIKASI PASSWORD
        // Ambil hash password asli dari DB
        const [users] = await db.execute('SELECT password, username FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "User tidak ditemukan." });
        }
        
        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Password salah. Penghapusan dibatalkan." });
        }

        // 3. AMBIL SEMUA PROYEK USER (Untuk dibersihkan satu per satu)
        const [projects] = await db.execute('SELECT subdomain FROM projects WHERE user_id = ?', [userId]);

        // 4. CLEANUP RESOURCE PROYEK (Cascading)
        // Kita loop semua proyek user dan hapus config-nya
        if (projects.length > 0) {
            console.log(`[Delete Account] Membersihkan ${projects.length} proyek milik ${user.username}...`);
            
            for (const proj of projects) {
                const sub = proj.subdomain;
                try {
                    // Hapus Services (Cloudflare, Apache, WAF)
                    // Gunakan Promise.allSettled agar jika satu gagal, yg lain tetap jalan
                    await Promise.allSettled([
                        cloudflareService.removeHostnameFromTunnel(sub),
                        cloudflareService.deleteDnsRecord(sub),
                        wafService.removeHostFromWaf(sub),
                        apacheService.cleanup(sub)
                    ]);

                    // Hapus Folder Fisik
                    const projectPath = `/var/www/projects/${sub}`;
                    await new Promise(r => exec(`sudo rm -rf ${projectPath}`, r));
                    
                } catch (err) {
                    console.error(`[Cleanup Error] Gagal membersihkan ${sub}:`, err.message);
                    // Lanjut ke proyek berikutnya (Best Effort)
                }
            }
        }

        // 5. HAPUS DATABASE (User & Projects)
        // Karena ada Foreign Key ON DELETE CASCADE (biasanya), hapus user otomatis hapus proyek di DB.
        // Tapi untuk aman, kita hapus manual query-nya.
        await db.execute('DELETE FROM projects WHERE user_id = ?', [userId]);
        await db.execute('DELETE FROM users WHERE id = ?', [userId]);

        // 6. LOGGING
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        // Log activity mungkin gagal karena user sudah dihapus (tergantung FK log), 
        // jadi kita abaikan error log atau log sebagai 'SYSTEM'.
        
        // 7. HAPUS COOKIE & RETURN
        res.clearCookie('token', COOKIE_OPTIONS); // Pakai config pusat
        res.status(200).json({ success: true, message: "Akun dan semua data berhasil dihapus permanen." });

    } catch (error) {
        console.error("[Delete Account Error]", error);
        res.status(500).json({ success: false, message: "Gagal menghapus akun (Server Error)." });
    }
};

// --- RESET PASSWORD (VIA EMAIL) ---
const resetPassword = async (req, res) => {
    const { email, newPassword } = req.body; // Input sekarang EMAIL

    // 1. Validasi Input (Email & Password Baru)
    const validationError = validateCredentials(null, newPassword, email);
    if (validationError) {
        return res.status(400).json({ success: false, message: validationError });
    }

    try {
        // 2. Cari User by Email
        const [users] = await db.execute('SELECT id, password, username FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'Email tidak terdaftar.' });
        }
        const user = users[0];

        // 3. Cek Kesamaan Password
        const isSame = await bcrypt.compare(newPassword, user.password);
        if (isSame) {
            return res.status(400).json({ success: false, message: 'Password baru tidak boleh sama dengan password lama.' });
        }

        // 4. Update Password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hash, user.id]);

        // 5. Log
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await logActivity(user.id, 'RESET_PASSWORD', `User ${user.username} reset password via Email.`, ip);

        res.status(200).json({ success: true, message: 'Password berhasil diperbarui.' });

    } catch (error) {
        console.error("Reset pass error:", error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
    }
};

module.exports = { registerUser, loginUser, logoutUser, deleteAccount, resetPassword };