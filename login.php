<?php
/**
 * login.php - Halaman Autentikasi Pengguna
 * Politeknik Citra Widya Edukasi (CWE) - Prodi TRPL
 */

require_once 'auth_check.php';
require_once 'koneksi.php';

// Jika pengguna sudah dalam keadaan login, alihkan langsung ke halaman utama
if (isLoggedIn()) {
    header("Location: index.php");
    exit;
}

$errorMessage   = "";
$successMessage = "";

if (isset($_GET['logged_out'])) {
    $successMessage = "Anda telah berhasil keluar dari sistem.";
}

// Proses Form Login
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $identifier = trim($_POST['identifier'] ?? '');
    $password   = $_POST['password'] ?? '';

    if (empty($identifier) || empty($password)) {
        $errorMessage = "Harap masukkan email/NIM/NIP dan kata sandi Anda.";
    } else {
        $user = null;

        // 1. Coba Autentikasi melalui Database MySQL
        if ($db_connected && $pdo) {
            try {
                $stmt = $pdo->prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(:id1) OR nomor_induk = :id2 LIMIT 1");
                $stmt->execute(['id1' => $identifier, 'id2' => $identifier]);
                $user = $stmt->fetch();
            } catch (Exception $e) {
                $user = null;
            }
        }

        // 2. Fallback aman jika database MySQL di Laragon belum di-start (Hanya Akun Admin)
        if (!$user) {
            $defaultUsers = [
                [
                    'id' => 1,
                    'nomor_induk' => 'ADM001',
                    'nama' => 'Administrator TRPL CWE',
                    'email' => 'admin@trpl.ac.id',
                    'password' => password_hash('admin', PASSWORD_BCRYPT),
                    'plain' => 'admin',
                    'role' => 'admin',
                    'prodi' => 'Teknologi Rekayasa Perangkat Lunak'
                ],
                [
                    'id' => 1,
                    'nomor_induk' => 'ADM001',
                    'nama' => 'Administrator TRPL CWE',
                    'email' => 'admin@cwe.ac.id',
                    'password' => password_hash('admin', PASSWORD_BCRYPT),
                    'plain' => 'admin',
                    'role' => 'admin',
                    'prodi' => 'Teknologi Rekayasa Perangkat Lunak'
                ]
            ];

            foreach ($defaultUsers as $u) {
                if (strcasecmp($u['email'], $identifier) === 0 || strcasecmp($u['nomor_induk'], $identifier) === 0) {
                    $user = $u;
                    break;
                }
            }
        }

        // 3. Verifikasi Kata Sandi (Mendukung Hash Bcrypt, Auto-Upgrade Plain-Text, dan MD5)
        $passwordMatch = false;

        if ($user && !empty($user['password'])) {
            if (password_verify($password, $user['password'])) {
                $passwordMatch = true;
            } elseif (isset($user['plain']) && $password === $user['plain']) {
                $passwordMatch = true;
            } elseif ($user['password'] === $password) {
                // Password plain-text cocok: Otomatis tingkatkan ke Bcrypt di MySQL
                $passwordMatch = true;
                if ($db_connected && $pdo && !empty($user['id'])) {
                    try {
                        $upHash = password_hash($password, PASSWORD_BCRYPT);
                        $upStmt = $pdo->prepare("UPDATE users SET password = :p WHERE id = :id");
                        $upStmt->execute(['p' => $upHash, 'id' => $user['id']]);
                    } catch (Exception $e) {}
                }
            } elseif (md5($password) === $user['password']) {
                // Password MD5 legacy: Otomatis tingkatkan ke Bcrypt di MySQL
                $passwordMatch = true;
                if ($db_connected && $pdo && !empty($user['id'])) {
                    try {
                        $upHash = password_hash($password, PASSWORD_BCRYPT);
                        $upStmt = $pdo->prepare("UPDATE users SET password = :p WHERE id = :id");
                        $upStmt->execute(['p' => $upHash, 'id' => $user['id']]);
                    } catch (Exception $e) {}
                }
            }
        }

        if ($passwordMatch) {
            // Berhasil login: Inisialisasi Sesi Pengguna
            $_SESSION['user_id']          = $user['id'];
            $_SESSION['user_nomor_induk'] = $user['nomor_induk'];
            $_SESSION['user_nama']        = $user['nama'];
            $_SESSION['user_email']       = $user['email'];
            $_SESSION['user_role']        = $user['role'];
            $_SESSION['user_prodi']       = $user['prodi'] ?? 'Teknologi Rekayasa Perangkat Lunak';
            $_SESSION['user_foto']        = !empty($user['foto']) ? $user['foto'] : 'default.png';

            // Alihkan ke halaman tujuan atau dashboard utama
            $redirect = $_SESSION['redirect_url'] ?? 'index.php';
            unset($_SESSION['redirect_url']);
            header("Location: " . $redirect);
            exit;
        } else {
            $errorMessage = "Email / Nomor Induk atau kata sandi yang Anda masukkan salah.";
        }
    }
}

// Inisialisasi data modal notifikasi interaktif
$modalNotification = null;
if (!empty($errorMessage)) {
    $modalNotification = [
        'type'    => 'error',
        'title'   => 'Gagal Masuk',
        'message' => $errorMessage
    ];
} elseif (!empty($successMessage)) {
    $modalNotification = [
        'type'    => 'success',
        'title'   => 'Berhasil',
        'message' => $successMessage
    ];
}

?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Masuk - LMS TRPL Politeknik Citra Widya Edukasi</title>
    
    <!-- Favicon Icon Kampus CWE -->
    <link rel="icon" type="image/png" href="assets/logo-cwe.png">
    
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
                    },
                    colors: {
                        maroon: {
                            50: '#fdf2f2',
                            100: '#fce4e4',
                            200: '#f9cccc',
                            300: '#f3a3a3',
                            400: '#eb7373',
                            500: '#d93d3d',
                            600: '#b82020',
                            700: '#8b0000',
                            800: '#6d0000',
                            900: '#4a0000',
                            950: '#2d0000',
                            DEFAULT: '#800000',
                        }
                    }
                }
            }
        }
    </script>
    
    <!-- Font Awesome Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />

    <style>
        @keyframes slideDownFade {
            from { opacity: 0; transform: translate(-50%, -12px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-slideDown {
            animation: slideDownFade 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
    </style>
</head>
<body class="bg-white min-h-screen flex items-center justify-center p-4 font-sans text-maroon selection:bg-maroon selection:text-white">

    <div class="w-full max-w-md">
        <!-- Kartu Login -->
        <div class="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border-2 border-slate-300 p-8 space-y-6">
            
            <!-- Logo & Identitas Kampus -->
            <div class="text-center space-y-3">
                <div class="inline-block p-2 bg-white rounded-2xl shadow-md border border-slate-100">
                    <img src="assets/logo-cwe.png" alt="Logo Politeknik Citra Widya Edukasi" class="h-20 w-auto mx-auto object-contain">
                </div>
                <div>
                    <h1 class="text-xl font-extrabold text-slate-800 tracking-tight">LMS TRPL CWE</h1>
                    <p class="text-xs font-semibold text-maroon-600 mt-0.5">Politeknik Citra Widya Edukasi</p>
                    <p class="text-[11px] text-slate-500">Program Studi Teknologi Rekayasa Perangkat Lunak</p>
                </div>
            </div>

            <!-- Banner Peringatan jika MySQL Belum Aktif di Laragon -->
            <?= renderDatabaseNotice(); ?>

            <!-- Form Autentikasi Nyata (Tanpa Mode Cepat Uji Coba) -->
            <form action="login.php" method="POST" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5" for="identifier">
                        Email Kampus atau Nomor Induk (NIM / NIP)
                    </label>
                    <div class="relative">
                        <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                            <i class="fa-regular fa-id-card text-xs"></i>
                        </span>
                        <input type="text" id="identifier" name="identifier" required 
                            value="<?= htmlspecialchars($_POST['identifier'] ?? ''); ?>"
                            placeholder="Masukkan email atau Nomor Induk Anda" 
                            class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent transition">
                    </div>
                </div>

                <div>
                    <div class="flex justify-between items-center mb-1.5">
                        <label class="block text-xs font-bold text-slate-700" for="password">
                            Kata Sandi
                        </label>
                        <!-- <a href="javascript:void(0)" onclick="alert('Silakan hubungi Unit Administrator Sistem Informasi TRPL CWE di Ruang Lab Komputer untuk reset kata sandi.')" class="text-[11px] text-maroon-600 hover:underline">
                            Lupa sandi?
                        </a> -->
                    </div>
                    <div class="relative">
                        <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                            <i class="fa-solid fa-lock text-xs"></i>
                        </span>
                        <input type="password" id="password" name="password" required 
                            placeholder="Masukkan kata sandi Anda" 
                            class="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent transition">
                        <button type="button" onclick="togglePasswordVisibility()" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600">
                            <i id="eye-icon" class="fa-regular fa-eye text-xs"></i>
                        </button>
                    </div>
                </div>

                <div class="pt-1">
                    <button type="submit" class="w-full py-2.5 px-4 bg-maroon-600 hover:bg-maroon-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-maroon-600/20 transition flex items-center justify-center gap-2">
                        <i class="fa-solid fa-arrow-right-to-bracket"></i>
                        <span>Masuk ke Akun Anda</span>
                    </button>
                </div>
            </form>

            <!-- Footer Institusi -->
            <div class="border-t border-slate-100 text-center text-[12px] text-slate-400 leading-relaxed">
                Politeknik Citra Widya Edukasi &bull; Tanggap, Tanggon, Trengginas<br>
            </div>
        </div>
    </div>

    <?php if ($modalNotification): ?>
    <!-- Alert Notifikasi Mengambang Sederhana (Auto-Dismiss, Tanpa Modals) -->
    <div id="login-alert" class="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border bg-white/95 backdrop-blur-md max-w-sm w-[90%] sm:w-auto transition-all duration-300 animate-slideDown <?= $modalNotification['type'] === 'success' ? 'border-emerald-200 text-emerald-900 shadow-emerald-900/10' : 'border-rose-200 text-rose-900 shadow-rose-900/10'; ?>">
        <div class="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 <?= $modalNotification['type'] === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'; ?>">
            <i class="fa-solid <?= $modalNotification['type'] === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'; ?>"></i>
        </div>
        <div class="flex-1 pr-1">
            <h4 class="text-xs font-bold text-slate-800 leading-tight"><?= htmlspecialchars($modalNotification['title']); ?></h4>
            <p class="text-[11px] text-slate-500 mt-0.5 leading-snug"><?= htmlspecialchars($modalNotification['message']); ?></p>
        </div>
        <button type="button" onclick="closeLoginAlert()" class="text-slate-400 hover:text-slate-600 p-1 shrink-0 transition" title="Tutup">
            <i class="fa-solid fa-xmark text-xs"></i>
        </button>
    </div>
    <?php endif; ?>

    <script>
        function togglePasswordVisibility() {
            const passInput = document.getElementById("password");
            const eyeIcon = document.getElementById("eye-icon");
            if (passInput.type === "password") {
                passInput.type = "text";
                eyeIcon.classList.remove("fa-eye");
                eyeIcon.classList.add("fa-eye-slash");
            } else {
                passInput.type = "password";
                eyeIcon.classList.remove("fa-eye-slash");
                eyeIcon.classList.add("fa-eye");
            }
        }

        let autoDismissTimer = null;

        function closeLoginAlert() {
            if (autoDismissTimer) clearTimeout(autoDismissTimer);
            const alertEl = document.getElementById("login-alert");
            if (alertEl) {
                alertEl.style.transition = "all 0.25s ease-out";
                alertEl.style.opacity = "0";
                alertEl.style.transform = "translate(-50%, -12px)";
                setTimeout(() => alertEl.remove(), 260);
            }
            // Bersihkan query string (?logged_out) dari URL agar tidak muncul lagi saat di-refresh
            if (window.location.search.includes('logged_out')) {
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }
        }

        <?php if ($modalNotification): ?>
        // Jalankan timer auto-dismiss alert (3.5 detik)
        window.addEventListener("DOMContentLoaded", () => {
            autoDismissTimer = setTimeout(() => {
                closeLoginAlert();
            }, 3500);

            // Tutup jika tombol Escape ditekan
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") closeLoginAlert();
            });
        });
        <?php endif; ?>
    </script>
</body>
</html>

