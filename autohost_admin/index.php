<!DOCTYPE html>
<html lang="id">
<head>
    <title>Admin Panel</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body { visibility: hidden; }
    </style>
</head>
<body class="container mt-4">

<div class="d-flex justify-content-between align-items-center mb-4">
    <h1>Admin Panel</h1>
    <button id="logoutBtn" class="btn btn-danger">Logout</button>
</div>

<!-- ================= USERS ================= -->
<h2 class="mt-5">Users Management</h2>
<table class="table table-bordered table-striped">
    <thead>
        <tr>
            <th>ID</th><th>Username</th><th>Email</th><th>Dibuat</th><th>Aksi</th>
        </tr>
    </thead>
    <tbody id="userList"></tbody>
</table>
<nav>
    <ul class="pagination pagination-sm" id="userPagination"></ul>
</nav>

<!-- ================= PROJECTS ================= -->
<h2 class="mt-5">Projects Management</h2>
<table class="table table-bordered table-striped">
    <thead>
        <tr>
            <th>ID</th><th>Subdomain</th><th>Nama Proyek</th><th>Pemilik</th><th>Dibuat</th><th>Aksi</th>
        </tr>
    </thead>
    <tbody id="projectList"></tbody>
</table>
<nav>
    <ul class="pagination pagination-sm" id="projectPagination"></ul>
</nav>

<!-- ================= LOGS ================= -->
<h2 class="mt-5">Activity Logs</h2>
<table class="table table-bordered table-striped">
    <thead>
        <tr>
            <th>ID</th><th>Aksi</th><th>Pesan</th><th>User</th><th>IP</th><th>Waktu</th>
        </tr>
    </thead>
    <tbody id="logList"></tbody>
</table>
<nav>
    <ul class="pagination pagination-sm" id="logPagination"></ul>
</nav>

<script>
const API_BASE_URL = "API-ADMIN";

/* ================= CEK AUTH ================= */
(async function checkAuthentication() {
    try {
        const res = await fetch(`${API_BASE_URL}/admin/check-auth`, { credentials: "include" });
        if (!res.ok) return window.location.replace("pages/login.php");
        document.body.style.visibility = "visible";
        initializeApp();
    } catch {
        window.location.replace("pages/login.php");
    }
})();

/* ================= APP ================= */
function initializeApp() {

    // LOGOUT
    document.getElementById("logoutBtn").addEventListener("click", async () => {
        await fetch(`${API_BASE_URL}/admin/logout`, { method: "POST", credentials: "include" });
        window.location.href = "pages/login.php";
    });

    const fetchData = async (url) => {
        const res = await fetch(url, { credentials: "include" });
        const json = await res.json();
        return json.data;
    };
}
</script>

</body>
</html>
