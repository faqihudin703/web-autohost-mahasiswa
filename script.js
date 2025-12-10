document.addEventListener('DOMContentLoaded', () => {

    async function initializeApp() {
        try {
            // =========================================================
            // AMBIL KONFIGURASI
            // =========================================================
            const configResponse = await fetch('./api/get-config.php');
            if (!configResponse.ok) {
                throw new Error('Gagal mengambil file konfigurasi.');
            }

            const dapp_config = await configResponse.json();
            const API_BASE_URL = `${dapp_config.apiBaseUrl}/projects`;
            const AUTH_API_URL = `${dapp_config.apiBaseUrl}/auth`;

            // =========================================================
            // CEK SESI LOKAL
            // =========================================================
            const username = localStorage.getItem('autohost_user');
            if (!username) {
                window.location.replace('login.php');
                return;
            }

            document.body.style.visibility = 'visible';
            document.getElementById('usernameDisplay').textContent = username;

            // =========================================================
            // LOGOUT
            // =========================================================
            document.getElementById('logoutBtn').addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await fetch(`${AUTH_API_URL}/logout`, {
                        method: 'POST',
                        credentials: 'include'
                    });
                } catch (error) {
                    console.error("Logout error:", error);
                } finally {
                    localStorage.removeItem('autohost_user');
                    window.location.replace('login.php');
                }
            });

            // =========================================================
            // UI ELEMENT
            // =========================================================
            const projectListBody = document.getElementById('projectList');
            const uploadForm = document.getElementById('uploadForm');
            const statusDiv = document.getElementById('status');
            const submitBtn = document.getElementById('submitBtn');
            const btnText = document.getElementById('btn-text');
            const btnSpinner = document.getElementById('btn-spinner');
            const subdomainInput = document.getElementById('subdomain');
            const subdomainStatus = document.getElementById('subdomainStatus');
            const projectFileInput = document.getElementById('projectFile');

            // =========================================================
            // ✅ CEK SUBDOMAIN (PUBLIC)
            // =========================================================
            let checkTimeout;
            subdomainInput.addEventListener('keyup', () => {
                clearTimeout(checkTimeout);

                const subdomain = subdomainInput.value
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, '');

                subdomainInput.value = subdomain;

                if (subdomain.length < 3) {
                    subdomainStatus.textContent = '';
                    return;
                }

                subdomainStatus.textContent = 'Mengecek ketersediaan...';
                subdomainStatus.className = 'form-text text-muted';

                checkTimeout = setTimeout(async () => {
                    try {
                        const response = await fetch(
                            `${API_BASE_URL}/check/${subdomain}`
                        );

                        const result = await response.json();

                        subdomainStatus.textContent = result.available
                            ? `✅ ${result.message}`
                            : `❌ ${result.message}`;

                        subdomainStatus.className = result.available
                            ? 'form-text text-success'
                            : 'form-text text-danger';

                    } catch (error) {
                        subdomainStatus.textContent = 'Gagal mengecek ketersediaan.';
                        subdomainStatus.className = 'form-text text-warning';
                    }
                }, 500);
            });

            // =========================================================
            // VALIDASI FILE
            // =========================================================
            projectFileInput.addEventListener('change', () => {
                statusDiv.innerHTML = '';
                submitBtn.disabled = false;

                if (projectFileInput.files.length === 0) return;

                const file = projectFileInput.files[0];
                const MAX_SIZE = 10 * 1024 * 1024;

                if (!file.name.endsWith('.zip')) {
                    statusDiv.innerHTML = `<div class="alert alert-danger">File harus .zip</div>`;
                    projectFileInput.value = '';
                    submitBtn.disabled = true;
                    return;
                }

                if (file.size > MAX_SIZE) {
                    statusDiv.innerHTML = `<div class="alert alert-danger">
                        Max 10 MB. File Anda ${(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>`;
                    projectFileInput.value = '';
                    submitBtn.disabled = true;
                }
            });

            // =========================================================
            // FETCH PROJECT (PRIVATE)
            // =========================================================
            const fetchProjects = async () => {
                try {
                    const response = await fetch(API_BASE_URL, {
                        credentials: 'include'
                    });

                    if (response.status === 401) {
                        alert("Sesi login sudah habis, silakan login ulang.");
                        return;
                    }

                    const result = await response.json();
                    const projects = Array.isArray(result) ? result : result.projects || [];

                    projectListBody.innerHTML = '';
                    if (projects.length === 0) {
                        projectListBody.innerHTML = `<tr><td colspan="3" class="text-center">Belum ada proyek</td></tr>`;
                    } else {
                        projects.forEach(p => {
                            const row = `
                                <tr>
                                    <td>${sanitizeHTML(p.project_name)}</td>
                                    <td><a href="${p.public_url}" target="_blank">${p.public_url}</a></td>
                                    <td>
                                        <button class="btn btn-danger btn-sm"
                                            onclick="deleteProject(${p.id}, '${p.subdomain}')">
                                            Hapus
                                        </button>
                                    </td>
                                </tr>
                            `;
                            projectListBody.innerHTML += row;
                        });
                    }
                } catch (error) {
                    projectListBody.innerHTML = `<tr><td colspan="3">${error.message}</td></tr>`;
                }
            };

            // =========================================================
            // DELETE PROJECT (PRIVATE)
            // =========================================================
            window.deleteProject = async (id, subdomain) => {
                if (!confirm(`Hapus proyek "${subdomain}"?`)) return;

                try {
                    const response = await fetch(
                        `${API_BASE_URL}/${id}/${subdomain}`,
                        {
                            method: 'DELETE',
                            credentials: 'include'
                        }
                    );

                    const result = await response.json();
                    if (!result.success) throw new Error(result.message);

                    fetchProjects();
                } catch (error) {
                    alert(error.message);
                }
            };

            // =========================================================
            // XSS SANITIZER
            // =========================================================
            const sanitizeHTML = (str) => {
                const temp = document.createElement('div');
                temp.textContent = str;
                return temp.innerHTML;
            };

            // =========================================================
            // SUBMIT DEPLOY (PRIVATE)
            // =========================================================
            uploadForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const formData = new FormData(uploadForm);

                try {
                    submitBtn.disabled = true;
                    btnSpinner.classList.remove('d-none');
                    btnText.textContent = 'Memproses...';

                    const response = await fetch(
                        `${API_BASE_URL}/deploy`,
                        {
                            method: 'POST',
                            credentials: 'include',
                            body: formData
                        }
                    );

                    const result = await response.json();
                    if (!result.success) throw new Error(result.message);

                    alert(`Deploy sukses: ${result.url}`);
                    uploadForm.reset();
                    fetchProjects();

                } catch (error) {
                    alert(error.message);
                } finally {
                    submitBtn.disabled = false;
                    btnSpinner.classList.add('d-none');
                    btnText.textContent = 'Validasi & Deploy';
                }
            });

            // =========================================================
            // DELETE ACCOUNT (PRIVATE)
            // =========================================================
            const deleteAccountBtn = document.getElementById('deleteAccountBtn');
            deleteAccountBtn.addEventListener('click', async () => {
                // 1. Minta Password (Verifikasi Identitas)
                // Catatan: window.prompt menampilkan teks input (bukan bintang2). 
                // Untuk UX lebih aman, sebaiknya gunakan Modal Bootstrap dengan <input type="password">.
                // Tapi untuk logika dasar, ini cukup.
                const password = prompt("PERINGATAN: Tindakan ini akan MENGHAPUS SEMUA PROYEK & DATA ANDA.\n\nUntuk melanjutkan, silakan ketik PASSWORD Anda:");
                
                if (!password) {
                    return; // User membatalkan (Cancel)
                }

                try {
                    statusDiv.innerHTML = `<div class="alert alert-warning">Memverifikasi & Menghapus Akun...</div>`;
                    
                    // 2. Kirim Request dengan Body Password
                    const response = await fetch(`${AUTH_API_URL}/me`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json' // <--- WAJIB ADA agar backend bisa baca JSON
                        },
                        credentials: 'include', // Bawa cookie
                        body: JSON.stringify({ password: password }) // <--- INI KUNCINYA
                    });
                    
                    const result = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(result.message || "Gagal menghapus akun.");
                    }
                    
                    // 3. Sukses
                    alert("Akun berhasil dihapus. Selamat tinggal.");
                    localStorage.removeItem('autohost_user');
                    window.location.replace('login.php');
                    
                } catch (error) {
                    statusDiv.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
                }
            });

            fetchProjects();

        } catch (error) {
            console.error("Init Error:", error);
            document.body.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    }

    initializeApp();
});
