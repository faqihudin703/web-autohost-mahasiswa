<?php
session_start();
// Jika admin sudah login → lempar ke dashboard
if (isset($_SESSION['admin_id'])) {
    header('Location: ../index.php'); 
    exit;
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Admin - AutoHost</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">

    <div class="container">
        <div class="row justify-content-center" style="min-height: 100vh; align-items: center;">
            <div class="col-lg-4 col-md-6">

                <div class="card shadow-sm">
                    <div class="card-body p-4">
                        <h2 class="text-center mb-4 fw-bold">🚀 AutoHost</h2>
                        <p class="text-center text-muted mb-4">Silakan login untuk melanjutkan</p>

                        <!-- STATUS -->
                        <div id="status" class="alert d-none"></div>

                        <form id="loginForm" autocomplete="off">
                            <div class="mb-3">
                                <label for="username" class="form-label">Email atau Username</label>
                                <input type="text" class="form-control" id="identifier" required>
                            </div>

                            <div class="mb-3">
                                <label for="password" class="form-label">Password</label>
                                <input type="password" class="form-control" id="password" required>
                            </div>

                            <button type="submit" class="btn btn-primary w-100 mt-3">Login</button>
                        </form>
                    </div>
                </div>

            </div>
        </div>
    </div>
    
    <script>
        // SESUAIKAN base URL API kamu
        const API_BASE_URL = `API-ADMIN`; //

        document.addEventListener('DOMContentLoaded', () => {
            const loginForm = document.getElementById('loginForm');
            const statusDiv = document.getElementById('status');

            if (!API_BASE_URL) {
                statusDiv.textContent = "API_BASE_URL belum dikonfigurasi.";
                statusDiv.className = "alert alert-warning";
                statusDiv.classList.remove("d-none");
                return;
            }

            const API_URL = `${API_BASE_URL}/admin/login`;

            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // Reset status
                statusDiv.className = "alert d-none";
                statusDiv.textContent = "";

                const identifier = document.getElementById('identifier').value.trim();
                const password = document.getElementById('password').value.trim();

                try {
                    const response = await fetch(API_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ identifier, password }),
                        credentials: "include" // penting untuk cookie admin
                    });

                    const data = await response.json();

                    if (response.ok) {
                        statusDiv.textContent = "Login berhasil! Mengarahkan ke dashboard...";
                        statusDiv.className = "alert alert-success";
                        statusDiv.classList.remove("d-none");

                        setTimeout(() => {
                            window.location.href = "../index.php";
                        }, 1000);

                    } else {
                        throw new Error(data.message || "Login gagal.");
                    }

                } catch (error) {
                    statusDiv.textContent = error.message;
                    statusDiv.className = "alert alert-danger";
                    statusDiv.classList.remove("d-none");
                }
            });
        });
    </script>

</body>
</html>