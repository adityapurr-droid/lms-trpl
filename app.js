/**
 * app.js - LMS TRPL Politeknik Citra Widya Edukasi (CWE)
 * Main Application Orchestrator & Entry Point
 * 
 * Arsitektur Modular:
 * - js/core.js        : State manajemen (appData), routing, notifikasi toast, helper avatar & shell layout
 * - js/roles.js       : Dashboard Admin, Dosen, Mahasiswa & pengaturan institusi
 * - js/users.js       : Manajemen Pengguna & CRUD akun sistem
 * - js/courses.js     : Manajemen Matakuliah & penetapan Dosen Pengampu
 * - js/semesters.js   : Manajemen Semester & periode akademik
 * - js/classes.js     : Manajemen Kelas & Angkatan Rombongan Belajar
 * - js/assignments.js : Manajemen Tugas, pengumpulan mahasiswa, dan penilaian dosen
 */

// Inisialisasi Aplikasi saat DOM siap dan semua modul telah dimuat
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        initAppData();
    });
} else {
    initAppData();
}
