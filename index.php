<?php
/**
 * index.php - Halaman Utama LMS TRPL Politeknik Citra Widya Edukasi (CWE)
 * Dilindungi Route Protection: Hanya pengguna terotentikasi yang dapat mengakses.
 */

require_once 'auth_check.php';
require_once 'koneksi.php';

// ROUTE PROTECTION: Jika belum login, redirect paksa ke login.php
requireLogin();

$user = getCurrentUser();
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LMS TRPL - Politeknik Citra Widya Edukasi</title>
    
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
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        ::-webkit-scrollbar-track {
            background: #f1f5f9;
        }
        ::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 9999px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.97); }
            to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
            animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
    </style>
</head>
<body class="bg-white text-maroon antialiased font-sans selection:bg-maroon selection:text-white">

    <!-- Injeksi Data Autentikasi Sesi ke JavaScript -->
    <script>
        window.AUTH_USER = <?= json_encode($user, JSON_UNESCAPED_UNICODE); ?>;
        window.DB_STATUS = <?= json_encode([
            'connected' => $db_connected,
            'error'     => $db_error
        ], JSON_UNESCAPED_UNICODE); ?>;
    </script>

    <!-- Container Utama Aplikasi -->
    <div id="app-root"></div>

    <!-- Container Toast Notifikasi -->
    <div id="toast-container" class="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"></div>

    <!-- Modul Logika LMS TRPL CWE (Modular Architecture) -->
    <script src="js/core.js?v=<?= filemtime('js/core.js') ?>"></script>
    <script src="js/roles.js?v=<?= filemtime('js/roles.js') ?>"></script>
    <script src="js/users.js?v=<?= filemtime('js/users.js') ?>"></script>
    <script src="js/courses.js?v=<?= filemtime('js/courses.js') ?>"></script>
    <script src="js/semesters.js?v=<?= filemtime('js/semesters.js') ?>"></script>
    <script src="js/classes.js?v=<?= filemtime('js/classes.js') ?>"></script>
    <script src="js/schedule.js?v=<?= filemtime('js/schedule.js') ?>"></script>
    <script src="js/assignments.js?v=<?= filemtime('js/assignments.js') ?>"></script>
    <script src="app.js?v=<?= filemtime('app.js') ?>"></script>
</body>
</html>

