// backend/services/apacheService.js
const { exec } = require('child_process');
const fsp = require('fs').promises;
const fs = require('fs'); // <--- PENTING: Ditambahkan untuk cek keberadaan file
const path = require('path');
const portfinder = require('portfinder');

portfinder.basePort = 8000;
const APACHE_SITES_AVAILABLE = '/etc/apache2/sites-available';
const APACHE_PORTS_CONF = '/etc/apache2/ports.conf';

/**
 * Mencari port, membuat VHost, mengupdate ports.conf, dan me-reload Apache.
 * @param {string} subdomain - Nama subdomain proyek.
 * @returns {Promise<number>} - Port yang dialokasikan.
 */
async function deploy(subdomain) {
    const port = await portfinder.getPortPromise();
    const domain = `${subdomain}.${process.env.DOMAIN}`;
    const projectPath = `/var/www/projects/${subdomain}`;

    const projectVhostContent = `
<VirtualHost *:${port}>
    ServerName ${domain}
    DocumentRoot ${projectPath}
    <Directory ${projectPath}>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
    `;

    const confPath = path.join(APACHE_SITES_AVAILABLE, `${domain}.conf`);
    
    // Tulis file konfigurasi
    await fsp.writeFile(confPath, projectVhostContent);
    
    // Tambahkan port ke ports.conf
    await fsp.appendFile(APACHE_PORTS_CONF, `\nListen ${port}`);

    const command = `sudo a2ensite ${domain}.conf && sudo systemctl reload apache2`;

    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error saat deploy Apache: ${stderr}`);
                return reject(new Error(`Gagal mengaktifkan site untuk ${domain}.`));
            }
            console.log(`Site ${domain} di port ${port} berhasil diaktifkan.`);
            resolve(port);
        });
    });
}

/**
 * Menonaktifkan site, menghapus file .conf, dan menghapus port dari ports.conf.
 * Menggunakan logika "Anti-Panik" jika file tidak ditemukan.
 * @param {string} subdomain - Nama subdomain proyek.
 */
async function cleanup(subdomain) {
    const domain = `${subdomain}.${process.env.DOMAIN}`;
    const confPath = path.join(APACHE_SITES_AVAILABLE, `${domain}.conf`);
    let portToRemove = null;

    console.log(`[Apache] Memulai cleanup untuk: ${domain}`);

    // --- PERBAIKAN UTAMA DI SINI ---
    // Cek dulu apakah file .conf ada? Jika tidak ada, hentikan proses cleanup agar tidak error.
    if (!fs.existsSync(confPath)) {
        console.log(`[Apache] Info: File konfigurasi ${domain}.conf tidak ditemukan. Cleanup dilewati (Aman).`);
        return; // Keluar dari fungsi, jangan lanjut ke bawah
    }

    try {
        // Langkah 1: Baca file .conf untuk menemukan port yang digunakan
        const confContent = await fsp.readFile(confPath, 'utf-8');
        const match = confContent.match(/<VirtualHost \*:(\d+)>/);
        if (match && match[1]) {
            portToRemove = match[1];
            console.log(`[Apache] Port ${portToRemove} akan dihapus dari konfigurasi.`);
        }
    } catch (e) {
        console.warn(`[Apache] Warning: Gagal membaca file konfigurasi, lanjut ke penghapusan.`);
    }

    // Langkah 2: Nonaktifkan site dan reload Apache
    // Kita bungkus dalam promise agar urutannya rapi
    const command = `sudo a2dissite ${domain}.conf && sudo systemctl reload apache2`;
    
    try {
        await new Promise((resolve, reject) => {
            exec(command, (err, stdout, stderr) => {
                if (err) {
                    // Hanya warning, jangan throw error agar cleanup file tetap jalan
                    console.warn(`[Apache] Warning: Gagal menonaktifkan site (mungkin sudah mati): ${stderr}`);
                    resolve(); 
                } else {
                    console.log(`[Apache] Site ${domain} berhasil dinonaktifkan.`);
                    resolve();
                }
            });
        });
    } catch (e) {
        console.error(`[Apache] Error saat exec a2dissite: ${e.message}`);
    }

    // Langkah 3: Hapus file .conf
    try {
        await fsp.unlink(confPath);
        console.log(`[Apache] File ${confPath} berhasil dihapus.`);
    } catch (e) {
        console.warn(`[Apache] Gagal menghapus file (mungkin sudah hilang): ${e.message}`);
    }

    // Langkah 4: Jika port ditemukan, hapus dari ports.conf
    if (portToRemove) {
        try {
            const data = await fsp.readFile(APACHE_PORTS_CONF, 'utf-8');
            const lines = data.split('\n');
            
            // Filter semua baris, KECUALI baris "Listen" dengan port yang mau kita hapus
            const newLines = lines.filter(line => line.trim() !== `Listen ${portToRemove}`);
            
            if (lines.length !== newLines.length) {
                const newData = newLines.join('\n');
                await fsp.writeFile(APACHE_PORTS_CONF, newData, 'utf-8');
                console.log(`[Apache] Baris "Listen ${portToRemove}" dihapus dari ${APACHE_PORTS_CONF}`);
            }
        } catch (e) {
            console.error(`[Apache] Gagal membersihkan ports.conf: ${e.message}`);
        }
    }
}

module.exports = { deploy, cleanup };