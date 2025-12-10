<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - AutoHost</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style> body { background-color: #f8f9fa; } </style>
</head>
<body>
<div class="container">
    <div class="row justify-content-center" style="min-height: 100vh; align-items: center;">
        <div class="col-lg-4 col-md-6">
            <div class="card shadow-sm border-0">
                <div class="card-body p-4">
                    <h2 class="text-center mb-4 fw-bold">🚀 AutoHost</h2>
                    <p class="text-center text-muted mb-4">Silakan login untuk melanjutkan</p>
                    
                    <form id="loginForm">
                        <div class="mb-3">
                            <label for="identifier" class="form-label">Email atau Username</label>
                            <input type="text" class="form-control" id="identifier" required>
                        </div>
                        <div class="mb-3">
                            <label for="password" class="form-label">Password</label>
                            <input type="password" class="form-control" id="password" required>
                        </div>
                        <button type="submit" class="btn btn-primary w-100 mt-3">Login</button>
                    </form>
                    
                    <div id="status" class="mt-3"></div>
                    
                    <div class="text-center mt-3">
                        <p class="mb-1" style="font-size: 0.9rem;"> 
                            Lupa password? <a href="forgot-password.php" class="text-decoration-none">Reset di sini</a>
                        </p>
                        <p class="mb-0" style="font-size: 0.9rem;"> 
                            Belum punya akun? <a href="register.php" class="text-decoration-none">Daftar sekarang</a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    if (localStorage.getItem('autohost_user')) {
        window.location.replace('index.php');
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Ambil value identifier (bisa email atau username)
        const identifier = document.getElementById('identifier').value;
        const password = document.getElementById('password').value;
        const statusDiv = document.getElementById('status');
        
        // Reset status
        statusDiv.innerHTML = '';
        
        try {
            const configResponse = await fetch('api/get-config.php');
            if (!configResponse.ok) throw new Error('Gagal konfigurasi.');
            const config = await configResponse.json();
            const API_URL = `${config.apiBaseUrl}/auth/login`;
            // ---------------------------------------------------------------------

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // PENTING: Kirim key 'identifier' sesuai backend baru
                body: JSON.stringify({ identifier, password }), 
                credentials: 'include'
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message);
            }
            
            // Login Sukses
            localStorage.setItem('autohost_user', result.user.username);
            window.location.replace('index.php');

        } catch (error) {
            statusDiv.innerHTML = `<div class="alert alert-danger p-2 text-center" style="font-size: 0.9rem;">${error.message}</div>`;
        }
    });
</script>
</body>
</html>