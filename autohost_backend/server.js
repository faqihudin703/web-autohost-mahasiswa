// backend/server.js
// Langkah 1: Muat semua variabel dari .env SEBELUM kode lain dijalankan
require('dotenv').config();

// Langkah 2: Impor aplikasi Express dari app.js
const app = require('./app');

// Langkah 3: Tentukan port dan jalankan server
const PORT = process.env.API_PORT || 3070;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server API AutoHost berjalan dan listen di semua interface pada port ${PORT}`);
});