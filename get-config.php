<?php
// 1. Impor file konfigurasi utama.
require_once './config.php';

// 2. Siapkan data yang akan dikirim ke frontend.
// Kita menamakannya 'dapp_config' sesuai permintaan Anda.
$dapp_config = [
    // Ambil nilai dari konstanta yang sudah kita definisikan.
    // 'apiBaseUrl' akan menjadi kunci objek di JavaScript.
    'apiBaseUrl' => API_BASE_URL
];

// 3. Atur header response sebagai JSON.
header('Content-Type: application/json');

// 4. Cetak data sebagai string JSON dan hentikan eksekusi.
echo json_encode($dapp_config);
exit();

?>