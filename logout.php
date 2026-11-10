<?php
/**
 * logout.php - Menghapus Sesi Pengguna & Redirect ke Login
 * Politeknik Citra Widya Edukasi (CWE) - Prodi TRPL
 */

require_once 'auth_check.php';

// Hapus seluruh variabel sesi
$_SESSION = [];

// Hapus cookie sesi dari browser bila ada
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params["path"],
        $params["domain"],
        $params["secure"],
        $params["httponly"]
    );
}

// Hancurkan sesi
session_destroy();

// Redirect ke halaman login dengan parameter notifikasi
header("Location: login.php?logged_out=1");
exit;
?>

