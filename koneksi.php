<?php
/**
 * koneksi.php - Pengaturan Koneksi Database MySQL Laragon
 * Prodi TRPL - Politeknik Citra Widya Edukasi (CWE)
 * 
 * Dilengkapi Auto-Migration Kolom, Error Handling, & Proteksi PDO
 */

$host     = 'localhost';
$username = 'root';
$password = ''; // Default password MySQL bawaan Laragon adalah kosong
$database = 'lms_trpl';
$port     = 3306;

$db_connected = false;
$db_error     = null;
$pdo          = null;

try {
    // 1. Koneksi menggunakan PDO (Prepared Statements & SQL Injection Prevention)
    $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => true,
    ];
    $pdo = new PDO($dsn, $username, $password, $options);

    $db_connected = true;

    // 3. AUTO-SYNC / AUTO-MIGRATION STRUKTUR KOLOM
    // Otomatis menambahkan kolom 'prodi' dan penyesuaian tabel jika database dibuat dari versi awal
    autoSyncDatabaseSchema($pdo);

} catch (PDOException $e) {
    $db_connected = false;
    $db_error = $e->getMessage();
} catch (Exception $e) {
    $db_connected = false;
    $db_error = $e->getMessage();
}

/**
 * Otomatis mengecek dan menambahkan kolom yang belum ada di database lama
 */
function autoSyncDatabaseSchema($pdo) {
    if (!$pdo) return;
    try {
        // Cek apakah tabel 'users' sudah ada
        $tableCheck = $pdo->query("SHOW TABLES LIKE 'users'");
        if (!$tableCheck->fetch()) {
            return; // Database belum di-import
        }

        // 1. Cek & Tambah kolom 'prodi' dan 'foto' di tabel users
        $colUsers = $pdo->query("SHOW COLUMNS FROM `users` LIKE 'prodi'");
        if (!$colUsers->fetch()) {
            $pdo->exec("ALTER TABLE `users` ADD COLUMN `prodi` VARCHAR(100) DEFAULT 'Teknologi Rekayasa Perangkat Lunak' AFTER `role`");
        }
        $colFoto = $pdo->query("SHOW COLUMNS FROM `users` LIKE 'foto'");
        if (!$colFoto->fetch()) {
            $pdo->exec("ALTER TABLE `users` ADD COLUMN `foto` VARCHAR(255) DEFAULT 'default.png' AFTER `prodi`");
        }

        // Cek & Tambah tabel dan kolom Angkatan
        $tableAngkatan = $pdo->query("SHOW TABLES LIKE 'angkatan'");
        if (!$tableAngkatan->fetch()) {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `angkatan` (
                    `id` INT AUTO_INCREMENT PRIMARY KEY,
                    `nama_angkatan` VARCHAR(50) UNIQUE NOT NULL,
                    `tahun` VARCHAR(10) DEFAULT '2025',
                    `keterangan` TEXT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB;
            ");
            // Seeder awal kategori angkatan
            $pdo->exec("
                INSERT IGNORE INTO `angkatan` (`nama_angkatan`, `tahun`, `keterangan`) VALUES
                ('Angkatan 2024 A', '2024', 'Rombel Mahasiswa TRPL Angkatan 2024 Kelas A'),
                ('Angkatan 2024 B', '2024', 'Rombel Mahasiswa TRPL Angkatan 2024 Kelas B'),
                ('Angkatan 2025 A', '2025', 'Rombel Mahasiswa TRPL Angkatan 2025 Kelas A'),
                ('Angkatan 2025 B', '2025', 'Rombel Mahasiswa TRPL Angkatan 2025 Kelas B');
            ");
        }

        // Tabel relasi angkatan dengan semester akademik
        $tableAngkatanSemester = $pdo->query("SHOW TABLES LIKE 'angkatan_semester'");
        if (!$tableAngkatanSemester->fetch()) {
            $pdo->exec("
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
            ");

            $activeSemesterRow = $pdo->query("SELECT id, nama FROM semester WHERE is_aktif = 1 ORDER BY id DESC LIMIT 1")->fetch();
            if ($activeSemesterRow && preg_match('/(\d{4})/', $activeSemesterRow['nama'], $yearMatch)) {
                $periodeTahun = (int) $yearMatch[1];
                $isGanjil = stripos($activeSemesterRow['nama'], 'ganjil') !== false;
                $angkatanRows = $pdo->query("SELECT id, tahun FROM angkatan")->fetchAll();
                $insertMapping = $pdo->prepare("
                    INSERT IGNORE INTO `angkatan_semester` (`angkatan_id`, `semester_id`, `semester_paket`)
                    VALUES (:angkatan_id, :semester_id, :semester_paket)
                ");
                foreach ($angkatanRows as $angkatanRow) {
                    $angkatanTahun = (int) $angkatanRow['tahun'];
                    $semesterPaket = (($periodeTahun - $angkatanTahun) * 2) + ($isGanjil ? 1 : 2);
                    if ($semesterPaket >= 1 && $semesterPaket <= 8) {
                        $insertMapping->execute([
                            'angkatan_id' => $angkatanRow['id'],
                            'semester_id' => $activeSemesterRow['id'],
                            'semester_paket' => $semesterPaket
                        ]);
                    }
                }
            }
        }

        // Kolom angkatan di tabel users
        $colAngkatan = $pdo->query("SHOW COLUMNS FROM `users` LIKE 'angkatan'");
        if (!$colAngkatan->fetch()) {
            $pdo->exec("ALTER TABLE `users` ADD COLUMN `angkatan` VARCHAR(50) NULL AFTER `foto`, ADD COLUMN `angkatan_id` INT NULL AFTER `angkatan`");
            // Migrasi otomatis mahasiswa berdasarkan NIM
            $pdo->exec("UPDATE `users` SET `angkatan` = 'Angkatan 2024 A' WHERE `role` = 'mahasiswa' AND (`nomor_induk` LIKE '2024%' OR `nomor_induk` LIKE '24%') AND (`angkatan` IS NULL OR `angkatan` = '')");
            $pdo->exec("UPDATE `users` SET `angkatan` = 'Angkatan 2025 A' WHERE `role` = 'mahasiswa' AND (`nomor_induk` LIKE '2025%' OR `nomor_induk` LIKE '25%') AND (`angkatan` IS NULL OR `angkatan` = '')");
        }


        // Kolom angkatan_id di tabel kelas + backfill data lama
        $colKelasAngkatan = $pdo->query("SHOW COLUMNS FROM `kelas` LIKE 'angkatan_id'");
        if (!$colKelasAngkatan->fetch()) {
            $pdo->exec("ALTER TABLE `kelas` ADD COLUMN `angkatan_id` INT NULL AFTER `semester_id`, ADD KEY `idx_kelas_angkatan` (`angkatan_id`)");

            $angkatanRows = $pdo->query("SELECT id, nama_angkatan, tahun FROM angkatan ORDER BY tahun ASC")->fetchAll();
            $kelasRows = $pdo->query("
                SELECT k.id, k.nama_kelas, mk.angkatan_id AS mk_angkatan_id
                FROM kelas k
                LEFT JOIN mata_kuliah mk ON mk.id = k.mata_kuliah_id
            ")->fetchAll();
            $findAngkatan = function ($year, $namaKelas) use ($angkatanRows) {
                $sameYear = array_values(array_filter($angkatanRows, function ($a) use ($year) {
                    return (string)$a['tahun'] === (string)$year;
                }));
                if (!$sameYear) return null;
                if (preg_match('/\b([AB])\b/i', $namaKelas, $letterMatch)) {
                    foreach ($sameYear as $a) {
                        if (preg_match('/\b' . strtoupper($letterMatch[1]) . '\b/i', $a['nama_angkatan'])) {
                            return (int)$a['id'];
                        }
                    }
                }
                return (int)$sameYear[0]['id'];
            };
            $upKelasAng = $pdo->prepare("UPDATE kelas SET angkatan_id = :angkatan_id WHERE id = :id");
            foreach ($kelasRows as $kelasRow) {
                $angkatanId = !empty($kelasRow['mk_angkatan_id']) ? (int)$kelasRow['mk_angkatan_id'] : null;
                $namaKelas = (string)$kelasRow['nama_kelas'];
                if (!$angkatanId) {
                    if (preg_match('/20(\d{2})|(?<!\d)(\d{2})(?!\d)/', $namaKelas, $yearMatch)) {
                        $year = '20' . ($yearMatch[1] ?: $yearMatch[2]);
                        $angkatanId = $findAngkatan($year, $namaKelas);
                    }
                }
                if (!$angkatanId) {
                    $stmtEnroll = $pdo->prepare("
                        SELECT u.angkatan_id
                        FROM enrollments e
                        JOIN users u ON u.id = e.mahasiswa_id
                        WHERE e.kelas_id = :kelas_id AND u.angkatan_id IS NOT NULL
                        GROUP BY u.angkatan_id
                        ORDER BY COUNT(*) DESC
                        LIMIT 1
                    ");
                    $stmtEnroll->execute(['kelas_id' => $kelasRow['id']]);
                    $enrollAngkatan = $stmtEnroll->fetchColumn();
                    if ($enrollAngkatan) $angkatanId = (int)$enrollAngkatan;
                }
                if ($angkatanId) {
                    $upKelasAng->execute(['angkatan_id' => $angkatanId, 'id' => $kelasRow['id']]);
                }
            }
        }

        // Pastikan folder uploads/avatars tersedia
        if (!is_dir(__DIR__ . '/uploads/avatars')) {
            @mkdir(__DIR__ . '/uploads/avatars', 0777, true);
        }

        // 2. Cek & Tambah kolom lampiran di tabel tugas
        $colTugas = $pdo->query("SHOW COLUMNS FROM `tugas` LIKE 'lampiran_nama'");
        if (!$colTugas->fetch()) {
            $pdo->exec("ALTER TABLE `tugas` 
                ADD COLUMN `lampiran_nama` VARCHAR(255) NULL,
                ADD COLUMN `lampiran_size` VARCHAR(50) NULL,
                ADD COLUMN `lampiran_path` LONGTEXT NULL
            ");
        }

        // 3. Cek & Tambah kolom file di tabel submissions
        $colSub = $pdo->query("SHOW COLUMNS FROM `submissions` LIKE 'file_nama'");
        if (!$colSub->fetch()) {
            $pdo->exec("ALTER TABLE `submissions` 
                ADD COLUMN `file_nama` VARCHAR(255) NOT NULL DEFAULT '',
                ADD COLUMN `file_size` VARCHAR(50) NULL,
                ADD COLUMN `file_path` LONGTEXT NULL
            ");
        }

        // 4. Cek & Tambah kolom file_size di tabel materi
        $colMat = $pdo->query("SHOW COLUMNS FROM `materi` LIKE 'file_size'");
        if (!$colMat->fetch()) {
            $pdo->exec("ALTER TABLE `materi` ADD COLUMN `file_size` VARCHAR(50) NULL");
        }

        // 5. Pastikan tipe materi mendukung semua format file (PDF, DOCX, PPTX, ZIP, dll.)
        $tableMateriTipe = $pdo->query("SHOW TABLES LIKE 'materi'");
        if ($tableMateriTipe && $tableMateriTipe->fetch()) {
            $colMateriTipe = $pdo->query("SHOW COLUMNS FROM `materi` LIKE 'tipe'")->fetch();
            if ($colMateriTipe && stripos((string)$colMateriTipe['Type'], 'varchar') === false) {
                $pdo->exec("ALTER TABLE `materi` MODIFY COLUMN `tipe` VARCHAR(20) NOT NULL DEFAULT 'PDF'");
            }
            // Normalisasi nilai lama ENUM ('file','video','link') ke label yang dipakai aplikasi
            $pdo->exec("UPDATE `materi` SET `tipe` = CASE LOWER(`tipe`)
                WHEN 'file' THEN 'PDF'
                WHEN 'video' THEN 'VIDEO'
                WHEN 'link' THEN 'LINK'
                ELSE `tipe` END
                WHERE LOWER(`tipe`) IN ('file', 'video', 'link')");
        }

        // 6. Auto-Hash kata sandi lama/plain-text jika di-input manual di database
        $unhashedStmt = $pdo->query("SELECT id, password FROM users");
        if ($unhashedStmt) {
            $uRows = $unhashedStmt->fetchAll();
            foreach ($uRows as $ur) {
                $p = $ur['password'] ?? '';
                if (!empty($p) && substr($p, 0, 4) !== '$2y$' && substr($p, 0, 4) !== '$2a$') {
                    $upHash = password_hash($p, PASSWORD_BCRYPT);
                    $upSt = $pdo->prepare("UPDATE users SET password = :p WHERE id = :id");
                    $upSt->execute(['p' => $upHash, 'id' => $ur['id']]);
                }
            }
        }
        // 7. Kolom jadwal terstruktur di tabel kelas (jam_mulai/jam_selesai)
        //    + backfill dari format lama "HH:MM - HH:MM" + index pemeriksaan bentrok.
        $tableKelas = $pdo->query("SHOW TABLES LIKE 'kelas'");
        if ($tableKelas && $tableKelas->fetch()) {
            $colJamMulai   = $pdo->query("SHOW COLUMNS FROM `kelas` LIKE 'jam_mulai'")->fetch();
            $colJamSelesai = $pdo->query("SHOW COLUMNS FROM `kelas` LIKE 'jam_selesai'")->fetch();
            if (!$colJamMulai) {
                $pdo->exec("ALTER TABLE `kelas` ADD COLUMN `jam_mulai` TIME NULL AFTER `jam`");
            }
            if (!$colJamSelesai) {
                $pdo->exec("ALTER TABLE `kelas` ADD COLUMN `jam_selesai` TIME NULL AFTER `jam_mulai`");
            }

            // Backfill idempoten: hanya baris lama yang belum punya jam terstruktur.
            $legacyJamRows = $pdo->query("
                SELECT id, jam FROM `kelas`
                WHERE (`jam_mulai` IS NULL OR `jam_selesai` IS NULL)
                  AND `jam` IS NOT NULL AND `jam` <> ''
            ")->fetchAll();
            if ($legacyJamRows) {
                $updJam = $pdo->prepare("UPDATE `kelas` SET `jam_mulai` = :mulai, `jam_selesai` = :selesai WHERE `id` = :id");
                foreach ($legacyJamRows as $lr) {
                    if (preg_match('/([01]?\d|2[0-3]):([0-5]\d)\s*[-\x{2013}\x{2014}]\s*([01]?\d|2[0-3]):([0-5]\d)/u', (string)$lr['jam'], $m)) {
                        $updJam->execute([
                            'mulai'   => sprintf('%02d:%02d', (int)$m[1], (int)$m[2]),
                            'selesai' => sprintf('%02d:%02d', (int)$m[3], (int)$m[4]),
                            'id'      => (int)$lr['id'],
                        ]);
                    }
                }
            }

            $idxJadwal = $pdo->query("SHOW INDEX FROM `kelas` WHERE Key_name = 'idx_jadwal'");
            if (!$idxJadwal || !$idxJadwal->fetch()) {
                $pdo->exec("ALTER TABLE `kelas` ADD INDEX `idx_jadwal` (`semester_id`, `hari`, `jam_mulai`)");
            }
        }
    } catch (Exception $e) {
        // Diamkan bila terjadi kendala izin ALTER agar aplikasi tetap berjalan
    }
}

/**
 * Helper: Menampilkan banner error koneksi yang ramah pengguna jika database belum aktif
 */
function renderDatabaseNotice() {
    global $db_connected, $db_error;
    if ($db_connected) {
        return '';
    }

    $errorInfo = htmlspecialchars($db_error ?? 'Tidak dapat terhubung ke MySQL port 3306');
    return '
    <div class="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 shadow-xs flex items-start gap-3.5">
        <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 text-lg">
            <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div class="flex-1 text-xs">
            <div class="flex items-center justify-between">
                <h4 class="font-bold text-amber-900 text-sm">Pemberitahuan Basis Data MySQL</h4>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-800">Mode Mandiri Aktif</span>
            </div>
            <p class="mt-1 text-amber-800 leading-relaxed">
                Koneksi ke MySQL database <code class="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold">lms_trpl</code> belum tersambung.
            </p>
            <div class="mt-2.5 pt-2.5 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span class="text-[11px] text-amber-700">
                    <strong>Solusi:</strong> Buka aplikasi <strong>Laragon</strong> lalu klik tombol <strong>Start All</strong>.
                </span>
                <a href="cek_koneksi.php" class="px-3 py-1 bg-amber-200 hover:bg-amber-300 rounded-lg font-semibold text-[11px] text-amber-900 transition inline-flex items-center gap-1.5 shrink-0">
                    <i class="fa-solid fa-rotate"></i> Cek Status Ulang
                </a>
            </div>
        </div>
    </div>';
}
?>
