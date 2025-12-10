// backend/controllers/projectController.js
const db = require('../config/db');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const FormData = require('form-data');
const AdmZip = require('adm-zip');
const apacheService = require('../services/apacheService');
const cloudflareService = require('../services/cloudflareService');
const wafService = require('../services/wafService');
const { logActivity } = require('../services/logService');

// --- KONFIGURASI ---
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_EXTRACT_SIZE = 50 * 1024 * 1024; // 50 MB (Anti Zip Bomb)
const MAX_FILE_COUNT = 1000; 

// 1. BLACKLIST SUPER LENGKAP
const FORBIDDEN_SUBDOMAINS = [
    // Web & Network
    'web', 'www', 'admin', 'administrator', 'root', 'mail', 'email', 
    'ftp', 'cpanel', 'whm', 'autohost', 'api', 'dashboard', 'server', 
    'public', 'private', 'config', 'backend', 'database', 'mysql', 'status',
    
    // JS Internals (Anti-Crash)
    'constructor', 'prototype', '__proto__', 'undefined', 'null', 'false', 'true',
    
    // Linux System Dirs (Anti-Conflict)
    'bin', 'boot', 'dev', 'etc', 'home', 'lib', 'media', 'mnt', 'opt', 
    'proc', 'run', 'sbin', 'srv', 'sys', 'tmp', 'usr', 'var', 'cron'
];

// --- VALIDATOR 1: SUBDOMAIN (ZERO TOLERANCE) ---
const validateSubdomainInput = (subdomain) => {
    if (typeof subdomain !== 'string') {
        return "Subdomain wajib diisi.";
    }

    const sub = subdomain.trim().toLowerCase();

    if (sub.length === 0) {
        return "Subdomain wajib diisi.";
    }

    // 2. Strip di awal & akhir (WAJIB sebelum regex)
    if (sub.startsWith("-")) {
        return "Subdomain tidak boleh diawali strip (-).";
    }

    if (sub.endsWith("-")) {
        return "Subdomain tidak boleh diakhiri strip (-).";
    }

    // 3. Length Check
    if (sub.length < 3) return "Subdomain minimal 3 karakter.";
    if (sub.length > 63) return "Subdomain maksimal 63 karakter.";

    // 4. Spasi
    if (/\s/.test(sub)) return "Subdomain tidak boleh ada spasi.";

    // 5. Strip ganda
    if (/--+/.test(sub)) return "Tidak boleh strip ganda (--).";

    // 6. Blacklist
    if (FORBIDDEN_SUBDOMAINS.includes(sub)) {
        return `Subdomain "${sub}" tidak diizinkan (Reserved/System).`;
    }

    // 7. Tidak boleh angka semua
    if (/^[0-9]+$/.test(sub)) {
        return "Subdomain tidak boleh hanya angka.";
    }

    // 8. Regex final DNS-safe
    const dnsRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
    if (!dnsRegex.test(sub)) {
        return "Format subdomain salah (hanya huruf, angka, strip).";
    }

    return null; // ✅ Lolos
};


// --- VALIDATOR 2: PROJECT NAME (ANTI-XSS) ---
const validateProjectName = (name) => {
    if (!name || typeof name !== 'string') return "Nama proyek wajib diisi.";
    const cleanName = name.trim();

    if (cleanName.length < 3) return "Nama proyek minimal 3 karakter.";
    if (cleanName.length > 50) return "Nama proyek maksimal 50 karakter.";
    
    if (/\s/.test(cleanName)) return "Nama proyek tidak boleh ada spasi.";

    // Regex Safe Text: Hanya Alphanumeric, Spasi, Strip, Underscore, Titik.
    // DILARANG KERAS: < > / \ ' " ` (Simbol XSS/SQLi)
    const safeNameRegex = /^[a-zA-Z0-9\s\-_\.]+$/;
    
    if (!safeNameRegex.test(cleanName)) {
        return "Nama proyek mengandung karakter terlarang (hanya huruf, angka, spasi, - _ .).";
    }
    
    return null; // Lolos
};

// --- VALIDATOR 3: ZIP SIGNATURE ---
const validateZipSignature = async (filePath) => {
    const buffer = Buffer.alloc(4);
    const fileHandle = await fsp.open(filePath, 'r');
    await fileHandle.read(buffer, 0, 4, 0);
    await fileHandle.close();
    return buffer.toString('hex') === '504b0304';
};

// --- VALIDATOR 4: ZIP CONTENT (Anti-Bomb/Slip) ---
const scanZipContent = (zip) => {
    const zipEntries = zip.getEntries();
    let totalSize = 0;
    let fileCount = 0;

    for (const entry of zipEntries) {
        fileCount++;
        totalSize += entry.header.size;
        if (totalSize > MAX_EXTRACT_SIZE) return "Zip Bomb terdeteksi (Size).";
        if (fileCount > MAX_FILE_COUNT) return "Terlalu banyak file.";
        
        // Zip Slip & Hidden Files
        if (entry.entryName.includes('..') || entry.entryName.startsWith('/')) return "Zip Slip terdeteksi.";
        
        // Block Executables
        const dangerousExts = ['.exe', '.sh', '.bat', '.cmd', '.dll'];
        if (dangerousExts.some(ext => entry.entryName.toLowerCase().endsWith(ext))) {
            return `File berbahaya terdeteksi: ${entry.entryName}`;
        }
    }
    return null;
};

// --- CONTROLLER: CHECK SUBDOMAIN ---
const checkSubdomain = async (req, res) => {
    const { subdomain } = req.params;
    try {
        const error = validateSubdomainInput(subdomain);
        if (error) return res.status(400).json({ success: false, available: false, message: error });

        const [rows] = await db.execute('SELECT id FROM projects WHERE subdomain = ?', [subdomain]);
        if (rows.length > 0) return res.status(400).json({ success: false, available: false, message: "Subdomain sudah digunakan." });

        res.status(200).json({ success: true, available: true, message: "Subdomain tersedia." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server Error." });
    }
};

// --- CONTROLLER: DEPLOY PROJECT ---
const deployProject = async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'File proyek wajib ada.' });

    const { projectName, subdomain } = req.body;
    const tempFilePath = req.file.path;

    // Cleanup Helper
    const cleanup = async (msg) => {
        if (fs.existsSync(tempFilePath)) await fsp.unlink(tempFilePath).catch(()=>{});
        return res.status(400).json({ success: false, message: msg });
    };

    // 1. VALIDASI INPUT STRICT (Subdomain & Project Name)
    const subError = validateSubdomainInput(subdomain);
    if (subError) return cleanup(subError);

    const nameError = validateProjectName(projectName);
    if (nameError) return cleanup(nameError);

    // 2. Validasi File (Size, Magic, Content)
    const stats = await fsp.stat(tempFilePath);
    if (stats.size > MAX_UPLOAD_SIZE) return cleanup("File terlalu besar (>10MB).");

    const isZip = await validateZipSignature(tempFilePath);
    if (!isZip) return cleanup("File bukan ZIP valid.");

    const zip = new AdmZip(tempFilePath);
    const zipError = scanZipContent(zip);
    if (zipError) return cleanup(zipError);

    // 3. Cek Database
    try {
        const [[existing]] = await db.execute('SELECT id FROM projects WHERE subdomain = ?', [subdomain]);
        if (existing) return cleanup('Subdomain sudah digunakan.');

        // 4. Scan Python (Anti-Malware)
        const form = new FormData();
        form.append('projectFile', fs.createReadStream(tempFilePath), req.file.originalname);
        try {
            await axios.post(process.env.VALIDATOR_URL, form, { headers: form.getHeaders() });
        } catch (e) {
            return cleanup(e.response?.data?.message || 'File ditolak oleh Anti-Malware.');
        }

        // --- DEPLOY PROCESS (Aman) ---
        const projectPath = `/var/www/projects/${subdomain}`;
        await fsp.mkdir(projectPath, { recursive: true });
        zip.extractAllTo(projectPath, true);

        // Chown
        await new Promise((res, rej) => exec(`sudo chown -R www-data:www-data ${projectPath}`, e => e ? rej(e) : res()));

        // Services
        const port = await apacheService.deploy(subdomain);
        await cloudflareService.addHostnameToTunnel(subdomain, port);
        await cloudflareService.createDnsRecord(subdomain);
        await wafService.addHostToWaf(subdomain);

        // DB Insert (Pakai projectName yang sudah divalidasi)
        const publicUrl = `https://${subdomain}.${process.env.DOMAIN}`;
        await db.execute(
            'INSERT INTO projects (project_name, subdomain, public_url, user_id) VALUES (?, ?, ?, ?)',
            [projectName.trim(), subdomain.toLowerCase(), publicUrl, req.user.id]
        );

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await logActivity(req.user.id, 'UPLOAD_PROJECT', `Deploy ${subdomain} sukses.`, ip);

        if (fs.existsSync(tempFilePath)) await fsp.unlink(tempFilePath).catch(()=>{});
        res.status(201).json({ success: true, message: 'Deploy berhasil!', url: publicUrl });

    } catch (error) {
        // ... (Error handling cleanup sama seperti sebelumnya) ...
        console.error(error);
        if (fs.existsSync(tempFilePath)) await fsp.unlink(tempFilePath).catch(()=>{});
        res.status(500).json({ success: false, message: "Internal Server Error." });
    }
};

// --- ENDPOINT 3: GET MY PROJECTS (GET) ---
const getMyProjects = async (req, res) => {
    try {
        // 1. Safety Check: Pastikan sesi valid
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: "Sesi tidak valid." });
        }

        // 2. Query Spesifik (ANTI-LEAK)
        // JANGAN PERNAH PAKAI 'SELECT *'. Hanya ambil yang perlu ditampilkan.
        // Kita tambah LIMIT 100 untuk mencegah DoS jika user punya ribuan proyek.
        const query = `
            SELECT id, project_name, subdomain, public_url, created_at 
            FROM projects 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 5
        `;

        const [rows] = await db.execute(query, [req.user.id]);
        
        // 3. Response Sanitization (Opsional, tapi Good Practice)
        // Pastikan tidak ada data null yang merusak frontend
        const sanitizedProjects = rows.map(p => ({
            id: p.id,
            project_name: p.project_name || "Untitled", // Default value
            subdomain: p.subdomain,
            public_url: p.public_url,
            created_at: p.created_at
        }));

        res.status(200).json({ 
            success: true, 
            count: sanitizedProjects.length, 
            projects: sanitizedProjects 
        });

    } catch (error) {
        console.error("[GetProjects] Database Error:", error);
        // Jangan kirim error raw database ke user
        res.status(500).json({ success: false, message: "Gagal mengambil data proyek." });
    }
};

const deleteProject = async (req, res) => {
    // 1. Ambil Parameter
    const { id, subdomain } = req.params;
    const userId = req.user.id;

    try {
        // --- STEP 1: VALIDASI INPUT (SAMAKAN DENGAN CHECK SUBDOMAIN) ---
        
        // A. Validasi ID (Harus Angka)
        if (!id || isNaN(id)) {
            return res.status(400).json({ success: false, message: "ID Proyek tidak valid." });
        }

        // B. Validasi Subdomain (Reuse Helper yang Super Ketat)
        // Ini akan otomatis memblokir: admin, web, spasi, simbol, terlalu pendek, sql injection, dll.
        const subError = validateSubdomainInput(subdomain);
        if (subError) {
            // Return 400 Bad Request karena format input salah/dilarang
            return res.status(400).json({ success: false, message: subError });
        }

        // --- STEP 2: LOGIC CHECK (IDOR) ---

        // Cek apakah proyek ada dan milik user ini
        const query = 'SELECT * FROM projects WHERE id = ? AND subdomain = ? AND user_id = ?';
        const [rows] = await db.execute(query, [id, subdomain.toLowerCase(), userId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Proyek tidak ditemukan atau akses ditolak." });
        }

        // --- STEP 3: EXECUTE DELETE (Aman karena input sudah divalidasi) ---
        
        // Hapus Cloudflare & WAF
        try {
            await cloudflareService.removeHostnameFromTunnel(subdomain);
            await cloudflareService.deleteDnsRecord(subdomain);
            await wafService.removeHostFromWaf(subdomain);
            await apacheService.cleanup(subdomain);
        } catch (svcError) {
            console.error(`[Delete Service Error] ${subdomain}:`, svcError.message);
        }

        // Hapus Folder Fisik
        const projectPath = `/var/www/projects/${subdomain}`;
        await new Promise((resolve) => {
            exec(`sudo rm -rf ${projectPath}`, (error) => resolve());
        });

        // Hapus Database
        await db.execute('DELETE FROM projects WHERE id = ?', [id]);

        // Log
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await logActivity(userId, 'DELETE_PROJECT', `Menghapus proyek ${subdomain} (ID: ${id})`, ip);

        res.status(200).json({ success: true, message: "Proyek berhasil dihapus." });

    } catch (error) {
        console.error("[Delete Error]", error);
        res.status(500).json({ success: false, message: "Server Error." });
    }
};

module.exports = { deployProject, getMyProjects, deleteProject, checkSubdomain };