<?php
/**
 * auth_check.php - Middleware Keamanan, Sesi, dan Proteksi Rute (Route Protection)
 * Politeknik Citra Widya Edukasi - Prodi TRPL
 */

if (session_status() === PHP_SESSION_NONE) {
    // Pengaturan cookie sesi yang aman
    session_set_cookie_params([
        'lifetime' => 86400 * 7, // 7 hari
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}

/**
 * Mengecek apakah pengguna saat ini sudah login
 */
function isLoggedIn() {
    return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
}

/**
 * Mengambil data pengguna yang sedang login dari session
 */
function getCurrentUser() {
    if (!isLoggedIn()) {
        return null;
    }
    return [
        'id'          => $_SESSION['user_id'],
        'nomor_induk' => $_SESSION['user_nomor_induk'] ?? '',
        'nama'        => $_SESSION['user_nama'] ?? '',
        'email'       => $_SESSION['user_email'] ?? '',
        'role'        => $_SESSION['user_role'] ?? 'mahasiswa',
        'prodi'       => $_SESSION['user_prodi'] ?? 'Teknologi Rekayasa Perangkat Lunak',
        'foto'        => $_SESSION['user_foto'] ?? 'default.png'
    ];
}

/**
 * ROUTE PROTECTION: Memastikan pengguna sudah login.
 * Jika belum login, redirect paksa ke halaman login.php.
 */
function requireLogin() {
    if (!isLoggedIn()) {
        // Simpan intended URL bila diperlukan
        $_SESSION['redirect_url'] = $_SERVER['REQUEST_URI'] ?? 'index.php';
        header("Location: login.php");
        exit;
    }
}

/**
 * AUTHORIZATION CHECK: Memastikan pengguna memiliki salah satu role yang diizinkan.
 * Contoh: requireRole(['admin', 'dosen']);
 */
function requireRole($allowedRoles = []) {
    requireLogin();
    
    $currentRole = $_SESSION['user_role'] ?? '';
    if (!in_array($currentRole, (array)$allowedRoles)) {
        // User tidak memiliki hak akses (Forbidden 403)
        http_response_code(403);
        echo '
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <title>403 - Akses Ditolak | LMS TRPL CWE</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-100 min-h-screen flex items-center justify-center p-4 font-sans">
            <div class="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center border border-slate-200">
                <div class="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl mx-auto flex items-center justify-center text-2xl font-bold mb-4">
                    ⚠️
                </div>
                <h1 class="text-xl font-bold text-slate-800">Akses Ditolak (403 Forbidden)</h1>
                <p class="text-xs text-slate-500 mt-2 leading-relaxed">
                    Akun Anda dengan peran <span class="font-bold uppercase text-slate-700">[' . htmlspecialchars($currentRole) . ']</span> tidak diizinkan mengakses halaman ini. Halaman ini hanya khusus untuk: <span class="font-semibold">' . implode(', ', (array)$allowedRoles) . '</span>.
                </p>
                <div class="mt-6">
                    <a href="index.php" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm inline-block">
                        Kembali ke Halaman Utama
                    </a>
                </div>
            </div>
        </body>
        </html>';
        exit;
    }
}
?>

