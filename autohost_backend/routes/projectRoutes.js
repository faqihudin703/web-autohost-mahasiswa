// backend/routes/projectRoutes.js
const express = require('express');
const multer = require('multer');
// Hapus 'checkSubdomain' dari sini
const { deployProject, getMyProjects, deleteProject, checkSubdomain } = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer({ dest: '/tmp/autohost-uploads' });

router.get('/check/:subdomain', checkSubdomain);

// Terapkan middleware 'protect' pada semua rute di bawah ini
router.use(protect);

router.post('/deploy', upload.single('projectFile'), deployProject);
router.get('/', getMyProjects);
router.delete('/:id/:subdomain', deleteProject);

module.exports = router;