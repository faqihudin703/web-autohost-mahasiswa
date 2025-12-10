<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - AutoHost</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        /* Sembunyikan halaman secara default untuk mencegah "flash" konten sebelum redirect */
        body { visibility: hidden; }
    </style>
</head>
<body>
<nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container">
        <a class="navbar-brand" href="#">🚀 AutoHost Dashboard</a>
        <div class="d-flex">
            <span class="navbar-text me-3">
                Halo, <strong id="usernameDisplay">User</strong>!
            </span>
            <button class="btn btn-outline-light" id="logoutBtn">Logout</button>
        </div>
    </div>
</nav>

<div class="container mt-4">
    <div class="row g-4">
        <div class="col-lg-5">
            <div class="card h-100">
                <div class="card-header">Deploy Proyek Baru</div>
                <div class="card-body">
                    <form id="uploadForm">
                        <div class="mb-3">
                            <label for="projectName" class="form-label">Nama Proyek</label>
                            <input type="text" class="form-control" id="projectName" name="projectName" required>
                        </div>
                        <div class="mb-3">
                            <label for="subdomain" class="form-label">Subdomain</label>
                            <div class="input-group">
                                <input type="text" class="form-control" id="subdomain" name="subdomain" required pattern="[a-z0-9]+(-[a-z0-9]+)*">
                                <span class="input-group-text">.autohost.my.id</span>
                            </div>
                            <div id="subdomainStatus" class="form-text"></div>
                        </div>
                        <div class="mb-3">
                            <label for="projectFile" class="form-label">File Proyek (.zip, maks 10 MB)</label>
                            <input class="form-control" type="file" id="projectFile" name="projectFile" required>
                        </div>
                        <button type="submit" class="btn btn-primary w-100" id="submitBtn">
                            <span id="btn-text">Validasi & Deploy</span>
                            <span id="btn-spinner" class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
                        </button>
                    </form>
                    <div id="status" class="mt-3"></div>
                </div>
            </div>
        </div>

        <div class="col-lg-7">
            <div class="card h-100">
                <div class="card-header">Daftar Proyek Anda</div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Nama Proyek</th>
                                    <th>URL Publik</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="projectList">
                                </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        
        <hr class="mt-5">
        <div class="d-grid mt-3 mb-5">
            <button class="btn btn-outline-danger btn-lg" id="deleteAccountBtn">
                Hapus Akun Saya
            </button>
        </div>
    </div>
</div>

<script src="./js/script.js"></script>
</body>
</html>