<?php
session_start();
if (isset($_COOKIE['token'])) {
    header('Location: ../index.php'); 
    exit;
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password - AutoHost</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style> body { background-color: #f8f9fa; } </style>
</head>
<body class="bg-light">
    
    <div class="container">
        <div class="row justify-content-center" style="min-height: 100vh; align-items: center;">
            <div class="col-lg-4 col-md-6">
                <div class="card shadow-sm border-0">
                    <div class="card-body p-4">
                        
                        <h2 class="text-center mb-4 fw-bold">🔐 Reset Password</h2>
                        <p class="text-center text-muted mb-4">Masukkan email terdaftar & password baru</p>

                        <div id="alertMessage" class="alert d-none"></div>

                        <form id="resetForm">
                            <div class="mb-3">
                                <label for="email" class="form-label">Email Terdaftar</label>
                                <input type="email" class="form-control" id="email" required>
                            </div>
                            <div class="mb-3">
                                <label for="newPassword" class="form-label">Password Baru</label>
                                <input type="password" class="form-control" id="newPassword" required>
                            </div>
                            
                            <button type="submit" class="btn btn-primary w-100 mt-3">Update Password</button>
                        </form>

                        <div class="text-center mt-3">
                            <p class="mb-0" style="font-size: 0.9rem;"> 
                                Sudah ingat password? <a href="../login.php" class="text-decoration-none">Login di sini</a>
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        document.getElementById('resetForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Ambil value EMAIL
            const email = document.getElementById('email').value;
            const newPassword = document.getElementById('newPassword').value;
            const alertBox = document.getElementById('alertMessage');
            const submitBtn = this.querySelector('button');

            alertBox.className = 'alert d-none'; 
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Memproses...';

            try {
                const configResponse = await fetch('./api/get-config.php');
                if (!configResponse.ok) throw new Error('Gagal memuat konfigurasi.');
                const config = await configResponse.json();
                const API_URL = `${config.apiBaseUrl}/auth/forgot-password`;
                
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // Kirim 'email' di body JSON
                    body: JSON.stringify({ email, newPassword })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    // SUKSES
                    alertBox.className = 'alert alert-success mt-3';
                    alertBox.textContent = result.message;
                    alertBox.classList.remove('d-none');
                    this.reset();

                    setTimeout(() => {
                        window.location.href = '../login.php';
                    }, 2000);
                } else {
                    throw new Error(result.message || 'Gagal mereset password.');
                }

            } catch (error) {
                alertBox.className = 'alert alert-danger mt-3';
                alertBox.textContent = error.message;
                alertBox.classList.remove('d-none');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Update Password';
            }
        });
    </script>
</body>
</html>