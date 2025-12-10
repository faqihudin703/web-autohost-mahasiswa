const db = require('../config/db');

const logActivity = async (userId, action, message, ipAddress) => {
    try {
        // Bersihkan format IP jika ::ffff: (format ipv6 di nodejs)
        const cleanIp = ipAddress ? ipAddress.replace('::ffff:', '') : '0.0.0.0';

        const query = `
            INSERT INTO activity_logs (user_id, action, message, ip_address)
            VALUES (?, ?, ?, ?)
        `;
        await db.execute(query, [userId, action, message, cleanIp]);
        console.log(`[LOG] ${action}: ${message}`);
    } catch (error) {
        console.error('[LOG ERROR] Gagal menyimpan log aktivitas:', error.message);
        // Kita tidak throw error agar error logging tidak menghentikan fungsi utama aplikasi
    }
};

module.exports = { logActivity };