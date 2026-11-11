-- =========================================================================
-- DATABASE LMS PRODI TEKNOLOGI REKAYASA PERANGKAT LUNAK (TRPL)
-- POLITEKNIK CITRA WIDYA EDUKASI (CWE)
-- =========================================================================
-- Skrip ini menyiapkan basis data relasional lengkap dengan enkripsi Bcrypt.
-- Password awal untuk seluruh akun bawaan adalah: password123
-- =========================================================================

CREATE DATABASE IF NOT EXISTS `lms_trpl` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `lms_trpl`;

-- 1. Tabel Pengguna (Users)
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nomor_induk` VARCHAR(30) UNIQUE NOT NULL COMMENT 'NIP Dosen, NIM Mahasiswa, NIK Admin',
    `nama` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) UNIQUE NOT NULL,
    `password` VARCHAR(255) NOT NULL COMMENT 'Hash Bcrypt',
    `role` ENUM('admin', 'dosen', 'mahasiswa') NOT NULL DEFAULT 'mahasiswa',
    `prodi` VARCHAR(100) DEFAULT 'Teknologi Rekayasa Perangkat Lunak',
    `foto` VARCHAR(255) DEFAULT 'default.png',
    `angkatan` VARCHAR(50) NULL COMMENT 'Khusus Mahasiswa, misal: Angkatan 2025 A',
    `angkatan_id` INT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Tabel Master Angkatan / Rombel Belajar
CREATE TABLE IF NOT EXISTS `angkatan` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nama_angkatan` VARCHAR(50) UNIQUE NOT NULL COMMENT 'Misal: Angkatan 2025 A, Angkatan 2025 B',
    `tahun` VARCHAR(10) DEFAULT '2025',
    `keterangan` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Tabel Semester / Tahun Akademik
CREATE TABLE IF NOT EXISTS `semester` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nama` VARCHAR(50) NOT NULL,
    `is_aktif` TINYINT(1) DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3b. Tabel Relasi Angkatan dengan Semester Akademik
CREATE TABLE IF NOT EXISTS `angkatan_semester` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `angkatan_id` INT NOT NULL,
    `semester_id` INT NOT NULL,
    `semester_paket` TINYINT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_angkatan_periode` (`angkatan_id`, `semester_id`),
    KEY `idx_angkatan_semester_angkatan` (`angkatan_id`),
    KEY `idx_angkatan_semester_semester` (`semester_id`),
    CONSTRAINT `fk_angkatan_semester_angkatan` FOREIGN KEY (`angkatan_id`) REFERENCES `angkatan`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_angkatan_semester_semester` FOREIGN KEY (`semester_id`) REFERENCES `semester`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Tabel Mata Kuliah TRPL
CREATE TABLE IF NOT EXISTS `mata_kuliah` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `kode_mk` VARCHAR(20) UNIQUE NOT NULL,
    `nama_mk` VARCHAR(100) NOT NULL,
    `sks` INT NOT NULL DEFAULT 3,
    `semester_paket` INT NOT NULL,
    `deskripsi` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. Tabel Kelas Perkuliahan (Dosen Pengampu)
CREATE TABLE IF NOT EXISTS `kelas` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `mata_kuliah_id` INT NOT NULL,
    `dosen_id` INT NOT NULL,
    `semester_id` INT NOT NULL,
    `angkatan_id` INT NULL,
    `nama_kelas` VARCHAR(20) NOT NULL,
    `hari` VARCHAR(20),
    `jam` VARCHAR(30),
    `jam_mulai` TIME NULL,
    `jam_selesai` TIME NULL,
    `ruangan` VARCHAR(50),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_kelas_angkatan` (`angkatan_id`),
    KEY `idx_jadwal` (`semester_id`, `hari`, `jam_mulai`),
    FOREIGN KEY (`mata_kuliah_id`) REFERENCES `mata_kuliah`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`dosen_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`semester_id`) REFERENCES `semester`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`angkatan_id`) REFERENCES `angkatan`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 5. Tabel Mahasiswa yang Terdaftar di Kelas (Enrollments)
CREATE TABLE IF NOT EXISTS `enrollments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `kelas_id` INT NOT NULL,
    `mahasiswa_id` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_enrollment` (`kelas_id`, `mahasiswa_id`),
    FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`mahasiswa_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Tabel Modul & Materi Pembelajaran
CREATE TABLE IF NOT EXISTS `materi` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `kelas_id` INT NOT NULL,
    `pertemuan_ke` INT NOT NULL,
    `judul` VARCHAR(150) NOT NULL,
    `deskripsi` TEXT,
    `tipe` VARCHAR(20) NOT NULL DEFAULT 'PDF',
    `file_or_url` VARCHAR(255) NOT NULL,
    `file_size` VARCHAR(50) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Tabel Tugas Perkuliahan
CREATE TABLE IF NOT EXISTS `tugas` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `kelas_id` INT NOT NULL,
    `judul` VARCHAR(150) NOT NULL,
    `deskripsi` TEXT NOT NULL,
    `deadline` DATETIME NOT NULL,
    `lampiran_nama` VARCHAR(255) NULL,
    `lampiran_size` VARCHAR(50) NULL,
    `lampiran_path` LONGTEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 8. Tabel Pengumpulan Tugas & Penilaian (Submissions)
CREATE TABLE IF NOT EXISTS `submissions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `tugas_id` INT NOT NULL,
    `mahasiswa_id` INT NOT NULL,
    `file_nama` VARCHAR(255) NOT NULL,
    `file_size` VARCHAR(50) DEFAULT NULL,
    `file_path` LONGTEXT NULL,
    `catatan_mhs` TEXT,
    `submitted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `nilai` DECIMAL(5,2) DEFAULT NULL,
    `catatan_dosen` TEXT DEFAULT NULL,
    UNIQUE KEY `unique_submission` (`tugas_id`, `mahasiswa_id`),
    FOREIGN KEY (`tugas_id`) REFERENCES `tugas`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`mahasiswa_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================================================
-- DATA AWAL (SEEDER) - POLITEKNIK CITRA WIDYA EDUKASI (CWE)
-- =========================================================================
-- Akun Administrator Utama:
-- Email   : admin@cwe.ac.id / admin@trpl.ac.id
-- Password: admin
-- Hash Bcrypt: $2y$10$wS6Q314E2JslG15pI7Hw2u1Wlh9tLgY1gRz480/vI0FpCsz90EtiW

-- Master Kategori Angkatan
INSERT INTO `angkatan` (`id`, `nama_angkatan`, `tahun`, `keterangan`) VALUES
(1, 'Angkatan 2024 A', '2024', 'Rombel Mahasiswa TRPL Angkatan 2024 Kelas A'),
(2, 'Angkatan 2024 B', '2024', 'Rombel Mahasiswa TRPL Angkatan 2024 Kelas B'),
(3, 'Angkatan 2025 A', '2025', 'Rombel Mahasiswa TRPL Angkatan 2025 Kelas A'),
(4, 'Angkatan 2025 B', '2025', 'Rombel Mahasiswa TRPL Angkatan 2025 Kelas B');

INSERT INTO `users` (`nomor_induk`, `nama`, `email`, `password`, `role`, `angkatan`, `angkatan_id`) VALUES
('ADM001', 'Administrator TRPL CWE', 'admin@cwe.ac.id', '$2y$10$wS6Q314E2JslG15pI7Hw2u1Wlh9tLgY1gRz480/vI0FpCsz90EtiW', 'admin', NULL, NULL),
('ADM002', 'Administrator TRPL CWE', 'admin@trpl.ac.id', '$2y$10$wS6Q314E2JslG15pI7Hw2u1Wlh9tLgY1gRz480/vI0FpCsz90EtiW', 'admin', NULL, NULL),
('19850101001', 'M A Purnama, S.Kom., M.Kom.', 'purnama@cwe.ac.id', '$2y$10$wS6Q314E2JslG15pI7Hw2u1Wlh9tLgY1gRz480/vI0FpCsz90EtiW', 'dosen', NULL, NULL),
('19870502002', 'Budi Santoso, M.T.', 'budi@cwe.ac.id', '$2y$10$wS6Q314E2JslG15pI7Hw2u1Wlh9tLgY1gRz480/vI0FpCsz90EtiW', 'dosen', NULL, NULL),
('202401001', 'Rian Pratama', 'rian@student.cwe.ac.id', '$2y$10$wS6Q314E2JslG15pI7Hw2u1Wlh9tLgY1gRz480/vI0FpCsz90EtiW', 'mahasiswa', 'Angkatan 2024 A', 1),
('202401002', 'Siti Aisyah', 'siti@student.cwe.ac.id', '$2y$10$wS6Q314E2JslG15pI7Hw2u1Wlh9tLgY1gRz480/vI0FpCsz90EtiW', 'mahasiswa', 'Angkatan 2024 A', 1),
('202401003', 'Fajar Nugraha', 'fajar@student.cwe.ac.id', '$2y$10$wS6Q314E2JslG15pI7Hw2u1Wlh9tLgY1gRz480/vI0FpCsz90EtiW', 'mahasiswa', 'Angkatan 2024 B', 2),
('202501001', 'Dimas Anggara', 'dimas@student.cwe.ac.id', '$2y$10$wS6Q314E2JslG15pI7Hw2u1Wlh9tLgY1gRz480/vI0FpCsz90EtiW', 'mahasiswa', 'Angkatan 2025 A', 3),
('202501002', 'Nabila Putri', 'nabila@student.cwe.ac.id', '$2y$10$wS6Q314E2JslG15pI7Hw2u1Wlh9tLgY1gRz480/vI0FpCsz90EtiW', 'mahasiswa', 'Angkatan 2025 B', 4);

INSERT INTO `semester` (`nama`, `is_aktif`) VALUES
('Ganjil 2024/2025', 1),
('Genap 2024/2025', 0);

-- Mata Kuliah Awal
INSERT INTO `mata_kuliah` (`id`, `kode_mk`, `nama_mk`, `sks`, `semester_paket`, `deskripsi`) VALUES
(1, 'TRPL101', 'Pemrograman Web Lanjut', 3, 3, 'Pengembangan aplikasi web berbasis arsitektur client-server dan framework.'),
(2, 'TRPL102', 'Struktur Data & Algoritma', 3, 3, 'Analisis kompleksitas algoritma, struktur data linear dan non-linear.');

-- Rombel Kelas Perkuliahan (Pengelompokan Berdasarkan Angkatan)
INSERT INTO `kelas` (`id`, `mata_kuliah_id`, `dosen_id`, `semester_id`, `nama_kelas`, `hari`, `jam`, `jam_mulai`, `jam_selesai`, `ruangan`) VALUES
(1, 1, 3, 1, 'TRPL 24 A', 'Senin', '08:00 - 10:30', '08:00', '10:30', 'Lab Komputer 1'),
(2, 2, 4, 1, 'TRPL 24 B', 'Selasa', '10:30 - 13:00', '10:30', '13:00', 'Lab Komputer 2'),
(3, 1, 3, 1, 'TRPL 25 A', 'Rabu', '08:00 - 10:30', '08:00', '10:30', 'Lab RPL CWE'),
(4, 2, 4, 1, 'TRPL 25 B', 'Kamis', '13:00 - 15:30', '13:00', '15:30', 'Ruang Teori 3');

-- Data Enrolmen Mahasiswa ke Kelas Angkatan
INSERT INTO `enrollments` (`kelas_id`, `mahasiswa_id`) VALUES
(1, 5), (1, 6), (1, 7),
(2, 5), (2, 6),
(3, 8), (3, 9),
(4, 8);
