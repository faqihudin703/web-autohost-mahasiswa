// backend/app.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
// Impor KEDUA file rute
const projectRoutes = require('./routes/projectRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

const corsOptions = {
    origin: 'URL-Front-end', // Sesuaikan dengan URL frontend Anda
    credentials: true
};
app.use(cors(corsOptions));
app.options('*', cors());
app.use(express.json());
app.use(cookieParser());

app.set('trust proxy', 1);

// Daftarkan rute-rute dalam urutan yang benar
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);      // Rute privat, 'protect' ada di dalam file-nya

module.exports = app;