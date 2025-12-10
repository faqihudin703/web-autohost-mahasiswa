<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daftar Akun - AutoHost</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style> body { background-color: #f8f9fa; } </style>
</head>
<body>
<div class="container">
    <div class="row justify-content-center" style="min-height: 100vh; align-items: center;">
        <div class="col-lg-4 col-md-6">
            <div class="card shadow-sm border-0">
                <div class="card-body p-4">
                    <h2 class="text-center mb-4 fw-bold">🚀 Buat Akun</h2>
                    <p class="text-center text-muted mb-4">Daftarkan akun baru Anda</p>
                    
                    <form id="registerForm">
                        <div class="mb-3">
                            <label for="username" class="form-label">Username</label>
                            <input type="text" class="form-control" id="username" required>
                        </div>

                        <div class="mb-3">
                            <label for="email" class="form-label">Email</label>
                            <input type="email" class="form-control" id="email" required>
                        </div>

                        <div class="mb-3">
                            <label for="password" class="form-label">Password</label>
                            <input type="password" class="form-control" id="password" required>
                        </div>

                        <button type="submit" class="btn btn-primary w-100 mt-3">Daftar</button>
                    </form>

                    <div id="status" class="mt-3"></div>

                    <div class="text-center mt-3">
                        <p class="mb-0" style="font-size: 0.9rem;">
                            Sudah punya akun? <a href="login.php" class="text-decoration-none">Login di sini</a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value; // Ambil value email
        const password = document.getElementById('password').value;
        const statusDiv = document.getElementById('status');
        const btn = e.target.querySelector('button');
        
        // Reset status & Loading state
        statusDiv.innerHTML = '';
        btn.disabled = true;
        btn.innerHTML = 'Memproses...';

        try {
            const configResponse = await fetch('./api/get-config.php');
            if (!configResponse.ok) throw new Error('Gagal memuat konfigurasi.');
            const dapp_config = await configResponse.json();
            const API_URL = `${dapp_config.apiBaseUrl}/auth/register`;
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password }), // Kirim email
                credentials: 'include'
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Terjadi kesalahan.');
            }

            // Sukses
            statusDiv.innerHTML = `<div class="alert alert-success p-2">Registrasi berhasil! Mengalihkan...</div>`;
            
            setTimeout(() => {
                window.location.replace('login.php'); // Redirect ke login setelah daftar
            }, 1500);

        } catch (error) {
            statusDiv.innerHTML = `<div class="alert alert-danger p-2 text-center" style="font-size: 0.9rem;">${error.message}</div>`;
            btn.disabled = false;
            btn.innerHTML = 'Daftar';
        }
    });
</script>
</body>
</html>