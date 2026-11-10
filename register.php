<?php
/**
 * register.php - Halaman Pendaftaran Akun Pengguna Baru
 * Politeknik Citra Widya Edukasi (CWE) - Prodi TRPL
 */

require_once 'auth_check.php';
require_once 'koneksi.php';

// Jika pengguna sudah login, alihkan langsung ke halaman utama
if (isLoggedIn()) {
    header("Location: index.php");
    exit;
}

$errorMessage = "";
$successMessage = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nama        = trim($_POST['nama'] ?? '');
    $nomor_induk = trim($_POST['nomor_induk'] ?? '');
    $email       = trim(strtolower($_POST['email'] ?? ''));
    $role        = $_POST['role'] ?? 'mahasiswa';
    $password    = $_POST['password'] ?? '';
    $konfirmasi  = $_POST['konfirmasi_password'] ?? '';

    // Validasi Input Lengkap (Panjang Karakter & Format)
    if (empty($nama) || empty($nomor_induk) || empty($email) || empty($password)) {
        $errorMessage = "Semua kolom bertanda (*) wajib diisi lengkap.";
    } elseif (mb_strlen($nama, 'UTF-8') < 2 || mb_strlen($nama, 'UTF-8') > 100) {
        $errorMessage = "Nama lengkap harus antara 2 hingga 100 karakter.";
    } elseif (mb_strlen($nomor_induk, 'UTF-8') < 3 || mb_strlen($nomor_induk, 'UTF-8') > 30) {
        $errorMessage = "Nomor Induk (NIM / NIP) harus antara 3 hingga 30 karakter.";
    } elseif (mb_strlen($email, 'UTF-8') > 100 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errorMessage = "Format alamat email tidak valid atau melebihi 100 karakter.";
    } elseif (mb_strlen($password, 'UTF-8') < 6 || mb_strlen($password, 'UTF-8') > 72) {
        $errorMessage = "Kata sandi minimal 6 karakter dan maksimal 72 karakter.";
    } elseif ($password !== $konfirmasi) {
        $errorMessage = "Konfirmasi kata sandi tidak cocok dengan kata sandi.";
    } elseif (!in_array($role, ['mahasiswa', 'dosen'])) {
        $errorMessage = "Peran yang dipilih tidak valid.";
    } else {
        // ENKRIPSI PASSWORD DENGAN BCRYPT
        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

        if ($db_connected && $pdo) {
            try {
                // Cek apakah nomor_induk atau email sudah terdaftar
                $checkStmt = $pdo->prepare("SELECT id FROM users WHERE email = :email OR nomor_induk = :nomor_induk LIMIT 1");
                $checkStmt->execute(['email' => $email, 'nomor_induk' => $nomor_induk]);
                if ($checkStmt->fetch()) {
                    $errorMessage = "Nomor Induk ({$nomor_induk}) atau Email ({$email}) sudah terdaftar di sistem!";
                } else {
                    // Cek ketersediaan kolom 'prodi'
                    $hasProdi = false;
                    try {
                        $colCheck = $pdo->query("SHOW COLUMNS FROM `users` LIKE 'prodi'");
                        $hasProdi = (bool)$colCheck->fetch();
                        if (!$hasProdi) {
                            $pdo->exec("ALTER TABLE `users` ADD COLUMN `prodi` VARCHAR(100) DEFAULT 'Teknologi Rekayasa Perangkat Lunak' AFTER `role`");
                            $hasProdi = true;
                        }
                    } catch (Exception $e) {}

                    // Simpan data user baru dengan password terenkripsi
                    if ($hasProdi) {
                        $insertStmt = $pdo->prepare("
                            INSERT INTO users (nomor_induk, nama, email, password, role, prodi) 
                            VALUES (:nomor_induk, :nama, :email, :password, :role, 'Teknologi Rekayasa Perangkat Lunak')
                        ");
                    } else {
                        $insertStmt = $pdo->prepare("
                            INSERT INTO users (nomor_induk, nama, email, password, role) 
                            VALUES (:nomor_induk, :nama, :email, :password, :role)
                        ");
                    }

                    $insertStmt->execute([
                        'nomor_induk' => $nomor_induk,
                        'nama'        => $nama,
                        'email'       => $email,
                        'password'    => $hashedPassword,
                        'role'        => $role
                    ]);

                    header("Location: login.php?registered=1");
                    exit;
                }
            } catch (Exception $e) {
                $errorMessage = "Gagal mendaftar ke database: " . $e->getMessage();
            }
        } else {
            // Jika database di Laragon belum di-import, berikan petunjuk ramah
            $errorMessage = "Database MySQL di Laragon belum terhubung atau database 'lms_trpl' belum dibuat. Silakan buka Laragon, Start All, lalu import database.sql.";
        }
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pendaftaran Akun - LMS TRPL Politeknik Citra Widya Edukasi</title>
    
    <!-- Google Font: Plus Jakarta Sans -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
                    }
                }
            }
        }
    </script>
    
    <!-- Font Awesome Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
</head>
<body class="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 min-h-screen flex items-center justify-center p-4 font-sans text-slate-800 selection:bg-indigo-500 selection:text-white">

    <div class="w-full max-w-lg my-8">
        <div class="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-8 space-y-6">
            
            <!-- Logo & Identitas Kampus -->
            <div class="text-center space-y-2">
                <div class="inline-block p-2 bg-white rounded-2xl shadow-md border border-slate-100">
                    <img src="assets/logo-cwe.png" alt="Logo Politeknik Citra Widya Edukasi" class="h-16 w-auto mx-auto object-contain">
                </div>
                <div>
                    <h1 class="text-xl font-extrabold text-slate-800 tracking-tight">Pendaftaran Pengguna Baru</h1>
                    <p class="text-xs font-semibold text-indigo-600">LMS TRPL Politeknik Citra Widya Edukasi</p>
                </div>
            </div>

            <!-- Banner Peringatan jika MySQL Belum Aktif di Laragon -->
            <?= renderDatabaseNotice(); ?>

            <!-- Pesan Notifikasi Error -->
            <?php if (!empty($errorMessage)): ?>
                <div class="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2.5 shadow-xs">
                    <i class="fa-solid fa-triangle-exclamation text-base shrink-0 mt-0.5"></i>
                    <div>
                        <strong class="block font-semibold">Perhatian</strong>
                        <span class="mt-0.5 block leading-relaxed"><?= htmlspecialchars($errorMessage); ?></span>
                    </div>
                </div>
            <?php endif; ?>

            <!-- Form Registrasi -->
            <form action="register.php" method="POST" class="space-y-3.5 text-xs">
                
                <!-- Peran Pengguna -->
                <div>
                    <label class="block font-bold text-slate-700 mb-1">Daftar Sebagai Peran <span class="text-rose-500">*</span></label>
                    <div class="grid grid-cols-2 gap-2">
                        <label class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 cursor-pointer bg-slate-50/50">
                            <input type="radio" name="role" value="mahasiswa" checked class="text-indigo-600 focus:ring-indigo-500">
                            <span class="font-semibold text-slate-800"><i class="fa-solid fa-user-graduate text-indigo-600 mr-1"></i> Mahasiswa</span>
                        </label>
                        <label class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 cursor-pointer bg-slate-50/50">
                            <input type="radio" name="role" value="dosen" <?= (($_POST['role'] ?? '') === 'dosen') ? 'checked' : ''; ?> class="text-indigo-600 focus:ring-indigo-500">
                            <span class="font-semibold text-slate-800"><i class="fa-solid fa-chalkboard-user text-blue-600 mr-1"></i> Dosen</span>
                        </label>
                    </div>
                </div>

                <!-- Nama Lengkap -->
                <div>
                    <label class="block font-bold text-slate-700 mb-1" for="nama">Nama Lengkap & Gelar <span class="text-rose-500">*</span></label>
                    <input type="text" id="nama" name="nama" required 
                        value="<?= htmlspecialchars($_POST['nama'] ?? ''); ?>"
                        placeholder="Contoh: Rian Pratama" 
                        class="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <!-- Nomor Induk -->
                    <div>
                        <label class="block font-bold text-slate-700 mb-1" for="nomor_induk">NIM / NIP <span class="text-rose-500">*</span></label>
                        <input type="text" id="nomor_induk" name="nomor_induk" required 
                            value="<?= htmlspecialchars($_POST['nomor_induk'] ?? ''); ?>"
                            placeholder="Contoh: 202401015" 
                            class="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                    </div>

                    <!-- Email Kampus -->
                    <div>
                        <label class="block font-bold text-slate-700 mb-1" for="email">Email Resmi <span class="text-rose-500">*</span></label>
                        <input type="email" id="email" name="email" required 
                            value="<?= htmlspecialchars($_POST['email'] ?? ''); ?>"
                            placeholder="nama@student.cwe.ac.id" 
                            class="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <!-- Kata Sandi -->
                    <div>
                        <label class="block font-bold text-slate-700 mb-1" for="password">Kata Sandi <span class="text-rose-500">*</span></label>
                        <input type="password" id="password" name="password" required minlength="6"
                            placeholder="Minimal 6 karakter" 
                            class="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                    </div>

                    <!-- Konfirmasi Kata Sandi -->
                    <div>
                        <label class="block font-bold text-slate-700 mb-1" for="konfirmasi_password">Ulangi Sandi <span class="text-rose-500">*</span></label>
                        <input type="password" id="konfirmasi_password" name="konfirmasi_password" required minlength="6"
                            placeholder="Ulangi kata sandi" 
                            class="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                    </div>
                </div>

                <div class="pt-2">
                    <button type="submit" class="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2">
                        <i class="fa-solid fa-user-check"></i>
                        <span>Daftarkan Akun Sekarang</span>
                    </button>
                </div>
            </form>

            <!-- Tautan Kembali ke Login -->
            <div class="pt-3 border-t border-slate-100 text-center">
                <p class="text-xs text-slate-500">
                    Sudah memiliki akun? 
                    <a href="login.php" class="font-bold text-indigo-600 hover:underline">Masuk di sini</a>
                </p>
            </div>
        </div>
    </div>
</body>
</html>

