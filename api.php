<?php
/**
 * api.php - Backend REST API Terintegrasi Database MySQL
 * Dilengkapi Validasi Menyeluruh, Keamanan Prepared Statements (SQL Injection Prevention),
 * Otorisasi Hak Akses (RBAC), dan Penanganan Error Ramah Pengguna.
 * 
 * Politeknik Citra Widya Edukasi (CWE) - Prodi TRPL
 */

header('Content-Type: application/json; charset=utf-8');

require_once 'auth_check.php';
require_once 'koneksi.php';

// Route Protection: Wajib Login
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Sesi Anda telah berakhir atau belum masuk. Silakan login kembali.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$currentUser = getCurrentUser();
$action      = $_GET['action'] ?? '';
$method      = $_SERVER['REQUEST_METHOD'];
$userId      = (int)($currentUser['id'] ?? 0);

// Helper Respon JSON Terstruktur
function jsonRes($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// =============================================================
// HELPER VALIDASI DATA BACKEND (AUDIT KEAMANAN & INTEGRITAS DATA)
// =============================================================

function validateEmail($email) {
    if (empty($email) || strlen($email) > 100) return false;
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function validateLength($val, $min, $max, $field) {
    $len = mb_strlen(trim($val), 'UTF-8');
    if ($len < $min) {
        jsonRes(['success' => false, 'message' => "Kolom {$field} minimal harus berisi {$min} karakter."], 400);
    }
    if ($len > $max) {
        jsonRes(['success' => false, 'message' => "Kolom {$field} tidak boleh melebihi batas {$max} karakter."], 400);
    }
    return trim($val);
}

function validatePositiveNumber($num, $field) {
    if (!is_numeric($num) || $num <= 0) {
        jsonRes(['success' => false, 'message' => "Nilai pada {$field} harus berupa angka positif lebih dari 0."], 400);
    }
    return (int)$num;
}

function validateScore($score) {
    if (!is_numeric($score) || $score < 0 || $score > 100) {
        jsonRes(['success' => false, 'message' => 'Nilai skor harus berupa angka antara rentang 0 hingga 100.'], 400);
    }
    return (float)$score;
}

// Angkatan wajib untuk mahasiswa; dosen & admin tidak memiliki angkatan
function resolveAngkatan($role, $angkatanId, $angkatanName, $dbConnected, $pdo) {
    if ($role !== 'mahasiswa') {
        return ['angkatan' => null, 'angkatan_id' => null];
    }

    $angkatanId = !empty($angkatanId) ? (int)$angkatanId : 0;
    if ($angkatanId <= 0) {
        jsonRes(['success' => false, 'message' => 'Angkatan wajib dipilih untuk pengguna dengan peran mahasiswa.'], 400);
    }

    if ($dbConnected && $pdo) {
        $stmt = $pdo->prepare("SELECT nama_angkatan FROM angkatan WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $angkatanId]);
        $nama = $stmt->fetchColumn();
        if (!$nama) {
            jsonRes(['success' => false, 'message' => 'Angkatan yang dipilih tidak ditemukan di sistem.'], 400);
        }
        return ['angkatan' => $nama, 'angkatan_id' => $angkatanId];
    }

    return ['angkatan' => trim((string)$angkatanName), 'angkatan_id' => $angkatanId];
}

// Membangun nama kelas default berbasis data angkatan (misal: "Angkatan 2026 A" -> "TRPL 26 A")
function generateDefaultKelasName($pdo, $angkatanId, $semesterPaket) {
    if ($angkatanId) {
        try {
            $stmtAng = $pdo->prepare("SELECT nama_angkatan, tahun FROM angkatan WHERE id = :id LIMIT 1");
            $stmtAng->execute(['id' => $angkatanId]);
            $ang = $stmtAng->fetch();
            if ($ang) {
                $letter = 'A';
                if (preg_match('/([A-Za-z])$/', trim((string)$ang['nama_angkatan']), $m)) {
                    $letter = strtoupper($m[1]);
                }
                $namaKelasDefault = 'TRPL ' . substr((string)(int)$ang['tahun'], -2) . ' ' . $letter;
                if (trim($namaKelasDefault) !== '') {
                    return $namaKelasDefault;
                }
            }
        } catch (Exception $e) {
            // Fallback ke format lama jika koneksi database bermasalah
        }
    }
    return 'TRPL-' . $semesterPaket . 'A';
}

function hasColumn($pdo, $table, $column) {
    if (!$pdo) return false;
    try {
        $stmt = $pdo->prepare("
            SELECT 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tbl AND COLUMN_NAME = :col
            LIMIT 1
        ");
        $stmt->execute(['tbl' => $table, 'col' => $column]);
        return (bool)$stmt->fetchColumn();
    } catch (Exception $e) {
        return false;
    }
}

// Helper Simpan Base64 ke File Fisik
function saveBase64File($base64Data, $folder, $prefix = 'file') {
    if (empty($base64Data) || strpos($base64Data, ';base64,') === false) return null;
    
    $parts = explode(';base64,', $base64Data);
    $typeInfo = explode(':', $parts[0]);
    $mimeType = $typeInfo[1] ?? '';
    
    $extension = 'bin';
    $mimeMap = [
        'application/pdf' => 'pdf',
        'application/zip' => 'zip',
        'application/x-zip-compressed' => 'zip',
        'application/msword' => 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        'application/vnd.ms-powerpoint' => 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' => 'pptx',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp'
    ];
    
    $extension = $mimeMap[$mimeType] ?? 'bin';
    $filename = $prefix . '_' . uniqid() . '_' . time() . '.' . $extension;
    $targetPath = __DIR__ . '/' . trim($folder, '/') . '/' . $filename;
    
    $data = base64_decode($parts[1]);
    if (file_put_contents($targetPath, $data)) {
        return $folder . '/' . $filename;
    }
    return null;
}

// -------------------------------------------------------------
// 1. GET BOOTSTRAP DATA (Sesuai Hak Akses & Database MySQL)
// -------------------------------------------------------------
if ($action === 'get_bootstrap_data') {
    $role   = $currentUser['role'];
    $userId = (int)$currentUser['id'];

    $users      = [];
    $mataKuliah = [];
    $materi     = [];
    $tugas      = [];

    if ($db_connected && $pdo) {
        try {
            // A. DATA USERS:
            // Admin bisa melihat seluruh pengguna; Dosen & Mhs hanya melihat info sendiri
            $hasProdi    = hasColumn($pdo, 'users', 'prodi');
            $prodiCol    = $hasProdi ? "prodi" : "'Teknologi Rekayasa Perangkat Lunak' as prodi";
            $hasFoto     = hasColumn($pdo, 'users', 'foto');
            $fotoCol     = $hasFoto ? "COALESCE(NULLIF(foto, ''), 'default.png') as foto" : "'default.png' as foto";
            $hasAngkatan = hasColumn($pdo, 'users', 'angkatan');
            $angkatanCol = $hasAngkatan ? "COALESCE(angkatan, '') as angkatan, angkatan_id" : "'' as angkatan, NULL as angkatan_id";

            if ($role === 'admin') {
                $stmt = $pdo->prepare("
                    SELECT id, nomor_induk, nama, email, role, {$prodiCol}, {$fotoCol}, {$angkatanCol}, 'Aktif' as status, created_at 
                    FROM users 
                    ORDER BY FIELD(role, 'admin', 'dosen', 'mahasiswa'), nama ASC
                ");
                $stmt->execute();
                $users = $stmt->fetchAll();
            } else {
                $stmt = $pdo->prepare("
                    SELECT id, nomor_induk, nama, email, role, {$prodiCol}, {$fotoCol}, {$angkatanCol}, 'Aktif' as status, created_at 
                    FROM users 
                    WHERE id = :id LIMIT 1
                ");
                $stmt->execute(['id' => $userId]);
                $myUser = $stmt->fetch();
                $users = $myUser ? [$myUser] : [$currentUser];
            }

            // Sinkronkan data foto pengguna saat ini
            if ($hasFoto) {
                $stmtMe = $pdo->prepare("SELECT COALESCE(NULLIF(foto, ''), 'default.png') FROM users WHERE id = :id LIMIT 1");
                $stmtMe->execute(['id' => $userId]);
                $myFoto = $stmtMe->fetchColumn();
                if ($myFoto) {
                    $currentUser['foto'] = $myFoto;
                    $_SESSION['user_foto'] = $myFoto;
                }
            }

            // Data Semester Perkuliahan (Terintegrasi ke seluruh pengguna)
            $semesters = [];
            $activeSemester = 'Ganjil 2024/2025';
            $activeSemesterId = 0;
            $stmtSem = $pdo->query("SELECT id, nama, is_aktif, created_at FROM semester ORDER BY is_aktif DESC, id DESC");
            if ($stmtSem) {
                $semesters = $stmtSem->fetchAll();
                foreach ($semesters as $s) {
                    if ((int)$s['is_aktif'] === 1) {
                        $activeSemester = $s['nama'];
                        $activeSemesterId = (int)$s['id'];
                        break;
                    }
                }
            }

            // Ambil data angkatan & semester paket mahasiswa jika role mahasiswa
            $mhsAngkatanId = 0;
            $mhsPaket      = 1;
            if ($role === 'mahasiswa') {
                $stmtStudent = $pdo->prepare("
                    SELECT u.angkatan_id, asg.semester_paket
                    FROM users u
                    LEFT JOIN angkatan_semester asg ON asg.angkatan_id = u.angkatan_id
                    LEFT JOIN semester s ON s.id = asg.semester_id AND s.is_aktif = 1
                    WHERE u.id = :id
                    LIMIT 1
                ");
                $stmtStudent->execute(['id' => $userId]);
                $mhsInfo = $stmtStudent->fetch() ?: [];
                $mhsAngkatanId = !empty($mhsInfo['angkatan_id']) ? (int)$mhsInfo['angkatan_id'] : 0;
                $mhsPaket      = !empty($mhsInfo['semester_paket']) ? (int)$mhsInfo['semester_paket'] : 1;
            }

            // B. DATA MATA KULIAH:
            $hasTargetAngkatan = hasColumn($pdo, 'mata_kuliah', 'target_angkatan');
            $targetAngkatanCol = $hasTargetAngkatan ? "COALESCE(mk.target_angkatan, 'Angkatan 2024 A') as target_angkatan, mk.angkatan_id" : "'Angkatan 2024 A' as target_angkatan, NULL as angkatan_id";

            if ($role === 'admin') {
                $stmt = $pdo->prepare("
                    SELECT mk.id, mk.kode_mk as kode, mk.nama_mk as nama, mk.sks, 
                           COALESCE(mk.semester_paket, 1) as semester_paket,
                           {$targetAngkatanCol},
                           COALESCE(mk.deskripsi, '') as deskripsi,
                           COALESCE(u.nama, 'Belum Ditentukan') as dosen,
                           k.dosen_id,
                           k.id as kelas_id,
                           k.nama_kelas,
                           k.angkatan_id,
                           ang.nama_angkatan as angkatan_nama,
                           CONCAT(COALESCE(k.hari, ''), ', ', COALESCE(k.jam, ''), ' WIB') as jadwal,
                           COALESCE(k.ruangan, 'Lab Komputer CWE') as ruang,
                           k.hari, k.jam, k.ruangan
                    FROM mata_kuliah mk
                    LEFT JOIN kelas k ON k.mata_kuliah_id = mk.id
                    LEFT JOIN users u ON k.dosen_id = u.id
                    LEFT JOIN angkatan ang ON ang.id = k.angkatan_id
                    ORDER BY mk.kode_mk ASC
                ");
                $stmt->execute();
                $mataKuliah = $stmt->fetchAll();
            } elseif ($role === 'dosen') {
                $stmt = $pdo->prepare("
                    SELECT mk.id, mk.kode_mk as kode, mk.nama_mk as nama, mk.sks, 
                           COALESCE(mk.semester_paket, 1) as semester_paket,
                           {$targetAngkatanCol},
                           COALESCE(mk.deskripsi, '') as deskripsi,
                           u.nama as dosen,
                           k.dosen_id,
                           k.id as kelas_id,
                           k.nama_kelas,
                           k.angkatan_id,
                           ang.nama_angkatan as angkatan_nama,
                           CONCAT(COALESCE(k.hari, ''), ', ', COALESCE(k.jam, ''), ' WIB') as jadwal,
                           COALESCE(k.ruangan, 'Lab Komputer CWE') as ruang,
                           k.hari, k.jam, k.ruangan
                    FROM kelas k
                    JOIN mata_kuliah mk ON k.mata_kuliah_id = mk.id
                    JOIN users u ON k.dosen_id = u.id
                    LEFT JOIN angkatan ang ON ang.id = k.angkatan_id
                    WHERE k.dosen_id = :dosen_id
                    ORDER BY mk.kode_mk ASC
                ");
                $stmt->execute(['dosen_id' => $userId]);
                $mataKuliah = $stmt->fetchAll();
            } else {
                $stmt = $pdo->prepare("
                    SELECT DISTINCT mk.id, mk.kode_mk as kode, mk.nama_mk as nama, mk.sks, 
                           COALESCE(mk.semester_paket, 1) as semester_paket,
                           {$targetAngkatanCol},
                           COALESCE(mk.deskripsi, '') as deskripsi,
                           COALESCE(u.nama, 'Belum Ditentukan') as dosen,
                           k.dosen_id,
                           COALESCE(k.id, 0) as kelas_id,
                           COALESCE(k.nama_kelas, CONCAT('TRPL-', mk.semester_paket)) as nama_kelas,
                           k.angkatan_id as kelas_angkatan_id,
                           ang.nama_angkatan as angkatan_nama,
                           CONCAT(COALESCE(k.hari, 'Senin'), ', ', COALESCE(k.jam, '08:00 - 10:30'), ' WIB') as jadwal,
                           COALESCE(k.ruangan, 'Lab Komputer CWE') as ruang,
                           COALESCE(k.hari, 'Senin') as hari,
                           COALESCE(k.jam, '08:00 - 10:30') as jam,
                           COALESCE(k.ruangan, 'Lab Komputer CWE') as ruangan
                    FROM mata_kuliah mk
                    LEFT JOIN kelas k ON k.mata_kuliah_id = mk.id 
                         AND (k.semester_id = :active_sem1 OR k.semester_id IS NULL)
                         AND (
                             k.angkatan_id = :ang_id1 
                             OR NOT EXISTS (
                                 SELECT 1 FROM kelas k_spec 
                                 WHERE k_spec.mata_kuliah_id = mk.id 
                                   AND k_spec.angkatan_id = :ang_id2 
                                   AND k_spec.semester_id = :active_sem2
                             )
                         )
                    LEFT JOIN users u ON k.dosen_id = u.id
                    LEFT JOIN angkatan ang ON ang.id = k.angkatan_id
                    LEFT JOIN enrollments e ON e.kelas_id = k.id AND e.mahasiswa_id = :mhs_id1
                    WHERE (e.mahasiswa_id IS NOT NULL)
                       OR (k.angkatan_id = :ang_id3)
                       OR (mk.semester_paket = :paket)
                    ORDER BY mk.kode_mk ASC
                ");
                $stmt->execute([
                    'active_sem1' => $activeSemesterId,
                    'ang_id1'     => $mhsAngkatanId,
                    'ang_id2'     => $mhsAngkatanId,
                    'active_sem2' => $activeSemesterId,
                    'mhs_id1'     => $userId,
                    'ang_id3'     => $mhsAngkatanId,
                    'paket'       => $mhsPaket
                ]);
                $mataKuliah = $stmt->fetchAll();
            }

            // C. DATA TUGAS & SUBMISSION (PREPARED STATEMENTS SESUAI ROLE)
            if ($role === 'dosen') {
                $stmtTugas = $pdo->prepare("
                    SELECT t.id, k.id as kelasId, k.mata_kuliah_id as matkulId, t.judul, t.deskripsi, t.deadline,
                           t.lampiran_nama, t.lampiran_size, t.lampiran_path
                    FROM tugas t
                    JOIN kelas k ON t.kelas_id = k.id
                    WHERE k.dosen_id = :dosen_id
                    ORDER BY t.deadline ASC
                ");
                $stmtTugas->execute(['dosen_id' => $userId]);
            } elseif ($role === 'mahasiswa') {
                $stmtTugas = $pdo->prepare("
                    SELECT DISTINCT t.id, k.id as kelasId, k.mata_kuliah_id as matkulId, t.judul, t.deskripsi, t.deadline,
                           t.lampiran_nama, t.lampiran_size, t.lampiran_path
                    FROM tugas t
                    JOIN kelas k ON t.kelas_id = k.id
                    LEFT JOIN enrollments e ON e.kelas_id = k.id AND e.mahasiswa_id = :mhs_id1
                    WHERE (e.mahasiswa_id IS NOT NULL)
                       OR (k.angkatan_id = :ang_id)
                       OR (k.angkatan_id IS NULL AND k.mata_kuliah_id IN (
                           SELECT mk2.id FROM mata_kuliah mk2 WHERE mk2.semester_paket = :paket
                       ) AND (k.semester_id = :active_sem OR k.semester_id IS NULL))
                    ORDER BY t.deadline ASC
                ");
                $stmtTugas->execute([
                    'mhs_id1'    => $userId,
                    'ang_id'     => $mhsAngkatanId,
                    'paket'      => $mhsPaket,
                    'active_sem' => $activeSemesterId
                ]);
            } else {
                $stmtTugas = $pdo->prepare("
                    SELECT t.id, k.id as kelasId, k.mata_kuliah_id as matkulId, t.judul, t.deskripsi, t.deadline,
                           t.lampiran_nama, t.lampiran_size, t.lampiran_path
                    FROM tugas t
                    JOIN kelas k ON t.kelas_id = k.id
                    ORDER BY t.deadline ASC
                ");
                $stmtTugas->execute();
            }
            $rawTugas = $stmtTugas->fetchAll();

            foreach ($rawTugas as $rt) {
                $tugasItem = [
                    'id'           => (int)$rt['id'],
                    'kelasId'      => (int)$rt['kelasId'],
                    'matkulId'     => (int)$rt['matkulId'],
                    'judul'        => $rt['judul'],
                    'deskripsi'    => $rt['deskripsi'],
                    'deadline'     => $rt['deadline'],
                    'lampiranSoal' => !empty($rt['lampiran_nama']) ? [
                        'nama'    => $rt['lampiran_nama'],
                        'size'    => $rt['lampiran_size'] ?? '500 KB',
                        'dataUrl' => $rt['lampiran_path']
                    ] : null,
                    'submissions'  => []
                ];

                if ($role === 'mahasiswa') {
                    // Mahasiswa HANYA BISA MELIHAT SUBMISSION MILIK SENDIRI
                    $subStmt = $pdo->prepare("
                        SELECT s.id, s.mahasiswa_id as mhsId, u.nama as mhsNama, u.nomor_induk as mhsNim,
                               s.submitted_at as submittedAt, s.file_nama, s.file_size, s.file_path,
                               s.catatan_mhs as catatanMhs, s.nilai, s.catatan_dosen as catatanDosen
                        FROM submissions s
                        JOIN users u ON s.mahasiswa_id = u.id
                        WHERE s.tugas_id = :tugas_id AND s.mahasiswa_id = :mhs_id
                    ");
                    $subStmt->execute(['tugas_id' => $rt['id'], 'mhs_id' => $userId]);
                } else {
                    // Dosen dan Admin melihat seluruh kiriman mahasiswa
                    $subStmt = $pdo->prepare("
                        SELECT s.id, s.mahasiswa_id as mhsId, u.nama as mhsNama, u.nomor_induk as mhsNim,
                               s.submitted_at as submittedAt, s.file_nama, s.file_size, s.file_path,
                               s.catatan_mhs as catatanMhs, s.nilai, s.catatan_dosen as catatanDosen
                        FROM submissions s
                        JOIN users u ON s.mahasiswa_id = u.id
                        WHERE s.tugas_id = :tugas_id
                    ");
                    $subStmt->execute(['tugas_id' => $rt['id']]);
                }

                $subs = $subStmt->fetchAll();
                foreach ($subs as $s) {
                    $tugasItem['submissions'][] = [
                        'mhsId'        => (int)$s['mhsId'],
                        'mhsNama'      => $s['mhsNama'],
                        'mhsNim'       => $s['mhsNim'],
                        'submittedAt'  => $s['submittedAt'],
                        'fileJawaban'  => [
                            'nama'    => $s['file_nama'],
                            'size'    => $s['file_size'],
                            'dataUrl' => $s['file_path']
                        ],
                        'catatanMhs'   => $s['catatanMhs'],
                        'nilai'        => $s['nilai'] !== null ? (float)$s['nilai'] : null,
                        'catatanDosen' => $s['catatanDosen']
                    ];
                }

                $tugas[] = $tugasItem;
            }

            // D. DATA MATERI (SESUAI ROLE):
            if ($role === 'dosen') {
                $stmtMateri = $pdo->prepare("
                    SELECT m.id, k.id as kelasId, k.mata_kuliah_id as matkulId, m.pertemuan_ke as pertemuan,
                           m.judul, m.tipe, m.file_or_url as link, DATE(m.created_at) as tanggal
                    FROM materi m
                    JOIN kelas k ON m.kelas_id = k.id
                    WHERE k.dosen_id = :dosen_id
                    ORDER BY m.pertemuan_ke ASC
                ");
                $stmtMateri->execute(['dosen_id' => $userId]);
            } elseif ($role === 'mahasiswa') {
                $stmtMateri = $pdo->prepare("
                    SELECT DISTINCT m.id, k.mata_kuliah_id as matkulId, m.pertemuan_ke as pertemuan,
                           m.judul, m.tipe, m.file_or_url as link, DATE(m.created_at) as tanggal
                    FROM materi m
                    JOIN kelas k ON m.kelas_id = k.id
                    LEFT JOIN enrollments e ON e.kelas_id = k.id AND e.mahasiswa_id = :mhs_id1
                    WHERE (e.mahasiswa_id IS NOT NULL)
                       OR (k.angkatan_id = :ang_id)
                       OR (k.angkatan_id IS NULL AND k.mata_kuliah_id IN (
                           SELECT mk2.id FROM mata_kuliah mk2 WHERE mk2.semester_paket = :paket
                       ) AND (k.semester_id = :active_sem OR k.semester_id IS NULL))
                    ORDER BY m.pertemuan_ke ASC
                ");
                $stmtMateri->execute([
                    'mhs_id1'    => $userId,
                    'ang_id'     => $mhsAngkatanId,
                    'paket'      => $mhsPaket,
                    'active_sem' => $activeSemesterId
                ]);
            } else {
                $stmtMateri = $pdo->prepare("
                    SELECT m.id, k.id as kelasId, k.mata_kuliah_id as matkulId, m.pertemuan_ke as pertemuan,
                           m.judul, m.tipe, m.file_or_url as link, DATE(m.created_at) as tanggal
                    FROM materi m
                    JOIN kelas k ON m.kelas_id = k.id
                    ORDER BY m.pertemuan_ke ASC
                ");
                $stmtMateri->execute();
            }
            $materi = $stmtMateri->fetchAll();

            // Dosen list untuk kebutuhan dropdown pengampu mata kuliah
            $dosenList = [];
            $hasFotoDosen = hasColumn($pdo, 'users', 'foto');
            $fotoDosenCol = $hasFotoDosen ? "COALESCE(NULLIF(foto, ''), 'default.png') as foto" : "'default.png' as foto";
            $stmtDosen = $pdo->prepare("SELECT id, nama, nomor_induk, email, {$fotoDosenCol} FROM users WHERE role = 'dosen' ORDER BY nama ASC");
            $stmtDosen->execute();
            $dosenList = $stmtDosen->fetchAll();

            // E. DATA KELAS PERKULIAHAN & ENROLLMENTS MAHASISWA (Admin & Dosen)
            $kelasList = [];
            $hasFoto = hasColumn($pdo, 'users', 'foto');
            $fotoUserCol = $hasFoto ? "COALESCE(NULLIF(u.foto, ''), 'default.png') as foto" : "'default.png' as foto";
            $fotoDosenKCol = $hasFoto ? "COALESCE(NULLIF(ud.foto, ''), 'default.png') as dosen_foto" : "'default.png' as dosen_foto";

            if ($role === 'dosen') {
                $stmtKelas = $pdo->prepare("
                    SELECT k.id, k.nama_kelas, k.mata_kuliah_id, k.dosen_id, k.semester_id,
                           k.angkatan_id, k.hari, k.jam, k.ruangan,
                           mk.kode_mk, mk.nama_mk, mk.sks, mk.semester_paket,
                           ud.nama as dosen_nama, {$fotoDosenKCol},
                           s.nama as semester_nama,
                           ang.nama_angkatan as angkatan_nama, ang.tahun as angkatan_tahun
                    FROM kelas k
                    JOIN mata_kuliah mk ON k.mata_kuliah_id = mk.id
                    JOIN users ud ON k.dosen_id = ud.id
                    LEFT JOIN semester s ON k.semester_id = s.id
                    LEFT JOIN angkatan ang ON ang.id = k.angkatan_id
                    WHERE k.dosen_id = :dosen_id
                    ORDER BY k.nama_kelas ASC, mk.kode_mk ASC
                ");
                $stmtKelas->execute(['dosen_id' => $userId]);
            } else {
                $stmtKelas = $pdo->prepare("
                    SELECT k.id, k.nama_kelas, k.mata_kuliah_id, k.dosen_id, k.semester_id,
                           k.angkatan_id, k.hari, k.jam, k.ruangan,
                           mk.kode_mk, mk.nama_mk, mk.sks, mk.semester_paket,
                           ud.nama as dosen_nama, {$fotoDosenKCol},
                           s.nama as semester_nama,
                           ang.nama_angkatan as angkatan_nama, ang.tahun as angkatan_tahun
                    FROM kelas k
                    JOIN mata_kuliah mk ON k.mata_kuliah_id = mk.id
                    JOIN users ud ON k.dosen_id = ud.id
                    LEFT JOIN semester s ON k.semester_id = s.id
                    LEFT JOIN angkatan ang ON ang.id = k.angkatan_id
                    ORDER BY k.nama_kelas ASC, mk.kode_mk ASC
                ");
                $stmtKelas->execute();
            }
            $rawKelas = $stmtKelas->fetchAll();

            foreach ($rawKelas as $rk) {
                // Ambil daftar mahasiswa (berdasarkan enrolmen manual ATAU angkatan yang sama)
                if (!empty($rk['angkatan_id'])) {
                    $stmtMhs = $pdo->prepare("
                        SELECT DISTINCT u.id, u.nomor_induk, u.nama, u.email, {$fotoUserCol}, COALESCE(e.created_at, NOW()) as enrolled_at
                        FROM users u
                        LEFT JOIN enrollments e ON e.mahasiswa_id = u.id AND e.kelas_id = :kelas_id
                        WHERE u.role = 'mahasiswa' AND (
                            e.id IS NOT NULL 
                            OR u.angkatan_id = :angkatan_id
                        )
                        ORDER BY u.nomor_induk ASC, u.nama ASC
                    ");
                    $stmtMhs->execute([
                        'kelas_id'    => $rk['id'],
                        'angkatan_id' => (int)$rk['angkatan_id']
                    ]);
                } else {
                    $stmtMhs = $pdo->prepare("
                        SELECT DISTINCT u.id, u.nomor_induk, u.nama, u.email, {$fotoUserCol}, COALESCE(e.created_at, NOW()) as enrolled_at
                        FROM users u
                        JOIN enrollments e ON e.mahasiswa_id = u.id AND e.kelas_id = :kelas_id
                        WHERE u.role = 'mahasiswa'
                        ORDER BY u.nomor_induk ASC, u.nama ASC
                    ");
                    $stmtMhs->execute([
                        'kelas_id' => $rk['id']
                    ]);
                }
                $enrolledStudents = $stmtMhs->fetchAll();

                // Hitung tugas pada kelas ini
                $stmtJmlTugas = $pdo->prepare("SELECT COUNT(*) FROM tugas WHERE kelas_id = :kelas_id");
                $stmtJmlTugas->execute(['kelas_id' => $rk['id']]);
                $jmlTugas = (int)$stmtJmlTugas->fetchColumn();

                $kelasList[] = [
                    'id'               => (int)$rk['id'],
                    'nama_kelas'       => $rk['nama_kelas'],
                    'mata_kuliah_id'   => (int)$rk['mata_kuliah_id'],
                    'kode_mk'          => $rk['kode_mk'],
                    'nama_mk'          => $rk['nama_mk'],
                    'sks'              => (int)$rk['sks'],
                    'semester_paket'   => (int)$rk['semester_paket'],
                    'dosen_id'         => (int)$rk['dosen_id'],
                    'dosen_nama'       => $rk['dosen_nama'],
                    'dosen_foto'       => $rk['dosen_foto'],
                    'semester_id'      => (int)$rk['semester_id'],
                    'semester_nama'    => $rk['semester_nama'],
                    'angkatan_id'      => !empty($rk['angkatan_id']) ? (int)$rk['angkatan_id'] : null,
                    'angkatan_nama'    => $rk['angkatan_nama'] ?? null,
                    'angkatan_tahun'   => $rk['angkatan_tahun'] ?? null,
                    'hari'             => $rk['hari'] ?? 'Senin',
                    'jam'              => $rk['jam'] ?? '08:00 - 10:30',
                    'ruangan'          => $rk['ruangan'] ?? 'Lab Komputer CWE',
                    'jadwal'           => (!empty($rk['hari']) && !empty($rk['jam'])) ? "{$rk['hari']}, {$rk['jam']} WIB" : 'Sesuai Jadwal',
                    'jumlah_mahasiswa' => count($enrolledStudents),
                    'jumlah_tugas'     => $jmlTugas,
                    'mahasiswa'        => $enrolledStudents
                ];
            }

            // F. MASTER KATEGORI ANGKATAN & RELASI SEMESTER
            $angkatanList = [];
            $chkAngkatan = $pdo->query("SHOW TABLES LIKE 'angkatan'");
            if ($chkAngkatan && $chkAngkatan->fetch()) {
                $stmtAng = $pdo->query("SELECT id, nama_angkatan, tahun, COALESCE(keterangan, '') as keterangan, created_at FROM angkatan ORDER BY nama_angkatan ASC");
                if ($stmtAng) {
                    $angkatanList = $stmtAng->fetchAll();
                }
            }

            $angkatanSemesterList = [];
            $chkAngkatanSemester = $pdo->query("SHOW TABLES LIKE 'angkatan_semester'");
            if ($chkAngkatanSemester && $chkAngkatanSemester->fetch()) {
                $stmtAS = $pdo->query("
                    SELECT asg.id, asg.angkatan_id, asg.semester_id, asg.semester_paket,
                           asg.created_at, asg.updated_at,
                           s.nama as semester_nama, s.is_aktif as semester_is_aktif
                    FROM angkatan_semester asg
                    JOIN semester s ON s.id = asg.semester_id
                    ORDER BY s.is_aktif DESC, s.id DESC, asg.angkatan_id ASC
                ");
                if ($stmtAS) {
                    $angkatanSemesterList = $stmtAS->fetchAll();
                }

                $currentMappings = [];
                foreach ($angkatanSemesterList as &$asRow) {
                    $asRow['id'] = (int)$asRow['id'];
                    $asRow['angkatan_id'] = (int)$asRow['angkatan_id'];
                    $asRow['semester_id'] = (int)$asRow['semester_id'];
                    $asRow['semester_paket'] = (int)$asRow['semester_paket'];
                    $asRow['semester_is_aktif'] = (int)$asRow['semester_is_aktif'];
                    if ($activeSemesterId > 0 && $asRow['semester_id'] === $activeSemesterId) {
                        $currentMappings[$asRow['angkatan_id']] = $asRow;
                    }
                }
                unset($asRow);

                foreach ($angkatanList as &$angRow) {
                    $angRow['id'] = (int)$angRow['id'];
                    $mapping = $currentMappings[$angRow['id']] ?? null;
                    $angRow['semester_id'] = $mapping ? $mapping['semester_id'] : null;
                    $angRow['semester_nama'] = $mapping ? $mapping['semester_nama'] : null;
                    $angRow['semester_paket'] = $mapping ? $mapping['semester_paket'] : null;
                }
                unset($angRow);
            }

        } catch (PDOException $e) {
            // Error handling PDO ramah pengguna
            jsonRes([
                'success'      => false,
                'db_connected' => false,
                'message'      => 'Terjadi kesalahan saat membaca data dari basis data MySQL: ' . $e->getMessage()
            ], 500);
        }
    }

    jsonRes([
        'success'        => true,
        'db_connected'   => $db_connected,
        'currentUser'    => $currentUser,
        'activeSemester' => $activeSemester ?? 'Ganjil 2024/2025',
        'semesters'      => $semesters ?? [],
        'users'          => $users,
        'dosenList'      => $dosenList ?? [],
        'mataKuliah'     => $mataKuliah,
        'kelasList'      => $kelasList ?? [],
        'angkatanList'   => $angkatanList ?? [],
        'angkatanSemesterList' => $angkatanSemesterList ?? [],
        'materi'         => $materi,
        'tugas'          => $tugas
    ]);
}

// CREATE MATERI (HANYA DOSEN)
if ($action === 'create_materi' && $method === 'POST') {
    if ($currentUser['role'] !== 'dosen') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Dosen yang dapat mengunggah materi.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $kelasId   = isset($input['kelasId']) ? (int)$input['kelasId'] : 0;
    $judul     = trim($input['judul'] ?? '');
    $pertemuan = isset($input['pertemuan']) ? (int)$input['pertemuan'] : 1;
    $lampiran  = $input['lampiranMateri'] ?? null;

    if ($kelasId <= 0) {
        jsonRes(['success' => false, 'message' => 'Kelas perkuliahan wajib dipilih.'], 400);
    }
    if (mb_strlen($judul) < 3 || mb_strlen($judul) > 150) {
        jsonRes(['success' => false, 'message' => 'Judul materi harus antara 3 hingga 150 karakter.'], 400);
    }
    
    // Tipe otomatis dari ekstensi
    $tipe = 'PDF';
    if ($lampiran && !empty($lampiran['nama'])) {
        $ext = pathinfo($lampiran['nama'], PATHINFO_EXTENSION);
        $tipe = strtoupper($ext);
    }
    $allowedTip = ['PDF', 'VIDEO', 'SLIDES', 'LINK', 'DOC', 'DOCX', 'PPT', 'PPTX', 'ZIP'];
    $finalTipe = in_array($tipe, $allowedTip) ? $tipe : 'PDF';

    if ($db_connected && $pdo) {
        try {
            $stmtK = $pdo->prepare("SELECT id FROM kelas WHERE id = :kelas_id AND dosen_id = :dosen_id LIMIT 1");
            $stmtK->execute(['kelas_id' => $kelasId, 'dosen_id' => $userId]);
            if (!$stmtK->fetch()) {
                jsonRes(['success' => false, 'message' => 'Anda tidak memiliki akses ke kelas ini.'], 403);
            }

            $materiPath = 'none';
            if ($lampiran && !empty($lampiran['dataUrl'])) {
                $materiPath = saveBase64File($lampiran['dataUrl'], 'uploads/materi', 'mat_' . $userId);
                if (!$materiPath) $materiPath = 'none';
            }

            $insert = $pdo->prepare("
                INSERT INTO materi (kelas_id, pertemuan_ke, judul, tipe, file_or_url, file_size)
                VALUES (:kelas_id, :pertemuan, :judul, :tipe, :file, :size)
            ");
            $insert->execute([
                'kelas_id'  => $kelasId,
                'pertemuan' => $pertemuan,
                'judul'     => $judul,
                'tipe'      => $finalTipe,
                'file'      => $materiPath,
                'size'      => $lampiran['size'] ?? '1.2 MB'
            ]);

            jsonRes(['success' => true, 'message' => 'Materi berhasil diunggah!']);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal menyimpan materi: ' . $e->getMessage()], 500);
        }
    } else {
        jsonRes(['success' => false, 'message' => 'Koneksi database tidak tersedia.'], 500);
    }
}


// A. TAMBAH PENGGUNA (CREATE USER)
if ($action === 'create_user' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat menambah pengguna.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    
    // Validasi Kolom
    $nama        = validateLength($input['nama'] ?? '', 2, 100, 'Nama Lengkap');
    $nomor_induk = validateLength($input['nomor_induk'] ?? '', 3, 30, 'NIM / NIP');
    $email       = trim(strtolower($input['email'] ?? ''));
    $role        = $input['role'] ?? 'mahasiswa';
    $password    = $input['password'] ?? '';
    $prodi       = trim($input['prodi'] ?? 'Teknologi Rekayasa Perangkat Lunak');
    $angkatanData = resolveAngkatan($role, $input['angkatan_id'] ?? null, $input['angkatan'] ?? '', $db_connected, $pdo);
    $angkatan    = $angkatanData['angkatan'];
    $angkatan_id = $angkatanData['angkatan_id'];

    if (!validateEmail($email)) {
        jsonRes(['success' => false, 'message' => 'Format alamat email tidak valid atau melebihi 100 karakter.'], 400);
    }

    if (!in_array($role, ['admin', 'dosen', 'mahasiswa'])) {
        jsonRes(['success' => false, 'message' => 'Pilihan peran tidak valid.'], 400);
    }

    if (mb_strlen($password, 'UTF-8') < 6 || mb_strlen($password, 'UTF-8') > 72) {
        jsonRes(['success' => false, 'message' => 'Kata sandi minimal harus 6 karakter dan maksimal 72 karakter.'], 400);
    }

    // Hash Kata Sandi dengan Bcrypt
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

    if ($db_connected && $pdo) {
        try {
            // Cek duplikasi email atau nomor_induk menggunakan Prepared Statement
            $checkStmt = $pdo->prepare("SELECT id FROM users WHERE email = :email OR nomor_induk = :nomor_induk LIMIT 1");
            $checkStmt->execute(['email' => $email, 'nomor_induk' => $nomor_induk]);
            if ($checkStmt->fetch()) {
                jsonRes(['success' => false, 'message' => "Nomor Induk ({$nomor_induk}) atau Email ({$email}) sudah terdaftar di sistem!"], 409);
            }

            // Insert User Baru
            $insertStmt = $pdo->prepare("
                INSERT INTO users (nomor_induk, nama, email, password, role, prodi, angkatan, angkatan_id)
                VALUES (:nomor_induk, :nama, :email, :password, :role, :prodi, :angkatan, :angkatan_id)
            ");
            $insertStmt->execute([
                'nomor_induk' => $nomor_induk,
                'nama'        => $nama,
                'email'       => $email,
                'password'    => $hashedPassword,
                'role'        => $role,
                'prodi'       => $prodi,
                'angkatan'    => $angkatan,
                'angkatan_id' => $angkatan_id
            ]);

            $newId = (int)$pdo->lastInsertId();

            jsonRes([
                'success' => true,
                'message' => "Pengguna {$nama} berhasil ditambahkan ke database MySQL!",
                'user'    => [
                    'id'          => $newId,
                    'nomor_induk' => $nomor_induk,
                    'nama'        => $nama,
                    'email'       => $email,
                    'role'        => $role,
                    'prodi'       => $prodi,
                    'angkatan'    => $angkatan,
                    'angkatan_id' => $angkatan_id,
                    'foto'        => 'default.png',
                    'status'      => 'Aktif'
                ]
            ]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Kesalahan basis data: ' . $e->getMessage()], 500);
        }
    } else {
        jsonRes(['success' => false, 'message' => 'Database tidak terhubung. Gagal menambahkan pengguna.'], 503);
    }
}

// B. PERBARUI PENGGUNA (UPDATE USER)
if ($action === 'update_user' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat memperbarui data pengguna.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    
    $id          = validatePositiveNumber($input['id'] ?? 0, 'ID Pengguna');
    $nama        = validateLength($input['nama'] ?? '', 2, 100, 'Nama Lengkap');
    $nomor_induk = validateLength($input['nomor_induk'] ?? '', 3, 30, 'NIM / NIP');
    $email       = trim(strtolower($input['email'] ?? ''));
    $role        = $input['role'] ?? 'mahasiswa';
    $password    = $input['password'] ?? '';
    $prodi       = trim($input['prodi'] ?? 'Teknologi Rekayasa Perangkat Lunak');
    $angkatanData = resolveAngkatan($role, $input['angkatan_id'] ?? null, $input['angkatan'] ?? '', $db_connected, $pdo);
    $angkatan    = $angkatanData['angkatan'];
    $angkatan_id = $angkatanData['angkatan_id'];

    if (!validateEmail($email)) {
        jsonRes(['success' => false, 'message' => 'Format email tidak valid.'], 400);
    }

    if (!in_array($role, ['admin', 'dosen', 'mahasiswa'])) {
        jsonRes(['success' => false, 'message' => 'Pilihan peran tidak valid.'], 400);
    }

    if ($db_connected && $pdo) {
        try {
            // Cek apakah email atau nomor induk bertabrakan dengan user LAIN
            $dupStmt = $pdo->prepare("SELECT id FROM users WHERE (email = :email OR nomor_induk = :nomor_induk) AND id != :id LIMIT 1");
            $dupStmt->execute(['email' => $email, 'nomor_induk' => $nomor_induk, 'id' => $id]);
            if ($dupStmt->fetch()) {
                jsonRes(['success' => false, 'message' => "Email ({$email}) atau Nomor Induk ({$nomor_induk}) sudah digunakan oleh pengguna lain."], 409);
            }

            // Jika kata sandi diisi, perbarui password; jika kosong, biarkan password lama
            if (!empty($password)) {
                if (mb_strlen($password, 'UTF-8') < 6 || mb_strlen($password, 'UTF-8') > 72) {
                    jsonRes(['success' => false, 'message' => 'Kata sandi baru minimal harus 6 karakter.'], 400);
                }
                $updateStmt = $pdo->prepare("
                    UPDATE users 
                    SET nomor_induk = :nomor_induk, nama = :nama, email = :email, role = :role, prodi = :prodi, angkatan = :angkatan, angkatan_id = :angkatan_id, password = :password
                    WHERE id = :id
                ");
                $updateStmt->execute([
                    'nomor_induk' => $nomor_induk,
                    'nama'        => $nama,
                    'email'       => $email,
                    'role'        => $role,
                    'prodi'       => $prodi,
                    'angkatan'    => $angkatan,
                    'angkatan_id' => $angkatan_id,
                    'password'    => password_hash($password, PASSWORD_BCRYPT),
                    'id'          => $id
                ]);
            } else {
                $updateStmt = $pdo->prepare("
                    UPDATE users 
                    SET nomor_induk = :nomor_induk, nama = :nama, email = :email, role = :role, prodi = :prodi, angkatan = :angkatan, angkatan_id = :angkatan_id
                    WHERE id = :id
                ");
                $updateStmt->execute([
                    'nomor_induk' => $nomor_induk,
                    'nama'        => $nama,
                    'email'       => $email,
                    'role'        => $role,
                    'prodi'       => $prodi,
                    'angkatan'    => $angkatan,
                    'angkatan_id' => $angkatan_id,
                    'id'          => $id
                ]);
            }

            jsonRes([
                'success' => true,
                'message' => "Data pengguna {$nama} berhasil diperbarui di database!",
                'user'    => [
                    'id'          => $id,
                    'nomor_induk' => $nomor_induk,
                    'nama'        => $nama,
                    'email'       => $email,
                    'role'        => $role,
                    'prodi'       => $prodi,
                    'angkatan'    => $angkatan,
                    'angkatan_id' => $angkatan_id,
                    'status'      => 'Aktif'
                ]
            ]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Kesalahan pembaruan database: ' . $e->getMessage()], 500);
        }
    } else {
        jsonRes(['success' => false, 'message' => 'Database tidak terhubung. Gagal memperbarui pengguna.'], 503);
    }
}

// C. HAPUS PENGGUNA (DELETE USER)
if ($action === 'delete_user' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat menghapus pengguna.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $id = validatePositiveNumber($input['id'] ?? 0, 'ID Pengguna');

    // CEGAH ADMIN MENGHAPUS AKUN DIRINYA SENDIRI
    if ($id === (int)$currentUser['id']) {
        jsonRes(['success' => false, 'message' => 'Keamanan: Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.'], 400);
    }

    if ($db_connected && $pdo) {
        try {
            // Hapus berkas foto fisik jika ada
            $oldStmt = $pdo->prepare("SELECT foto FROM users WHERE id = :id LIMIT 1");
            $oldStmt->execute(['id' => $id]);
            $oldFoto = $oldStmt->fetchColumn();
            if ($oldFoto && $oldFoto !== 'default.png') {
                @unlink(__DIR__ . '/uploads/avatars/' . $oldFoto);
            }

            $delStmt = $pdo->prepare("DELETE FROM users WHERE id = :id");
            $delStmt->execute(['id' => $id]);

            if ($delStmt->rowCount() > 0) {
                jsonRes(['success' => true, 'message' => 'Pengguna berhasil dihapus dari database MySQL.']);
            } else {
                jsonRes(['success' => false, 'message' => 'Pengguna tidak ditemukan di database.'], 404);
            }
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal menghapus pengguna: ' . $e->getMessage()], 500);
        }
    } else {
        jsonRes(['success' => false, 'message' => 'Database tidak terhubung. Gagal menghapus pengguna.'], 503);
    }
}

// D. UNGGAH FOTO PROFIL USER (UPLOAD AVATAR - BATAS MAKSIMAL 5 MB)
if ($action === 'upload_avatar' && $method === 'POST') {
    $targetUserId = (int)$currentUser['id'];

    // Foto profil hanya dapat diubah oleh pemilik akun
    if (!empty($_POST['user_id']) && (int)$_POST['user_id'] !== $targetUserId) {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Anda hanya dapat mengubah foto profil Anda sendiri.'], 403);
    }

    if (!isset($_FILES['foto']) || $_FILES['foto']['error'] !== UPLOAD_ERR_OK) {
        $errCode = $_FILES['foto']['error'] ?? -1;
        $msg = 'Gagal mengunggah file foto.';
        if ($errCode === UPLOAD_ERR_INI_SIZE || $errCode === UPLOAD_ERR_FORM_SIZE) {
            $msg = 'Ukuran file foto melebihi batas maksimal server (5 MB).';
        }
        jsonRes(['success' => false, 'message' => $msg], 400);
    }

    $file = $_FILES['foto'];
    $maxSize = 5 * 1024 * 1024; // Batas 5 MB

    if ($file['size'] > $maxSize) {
        jsonRes(['success' => false, 'message' => 'Ukuran file foto melebihi batas maksimal 5 MB.'], 400);
    }

    if ($file['size'] <= 0) {
        jsonRes(['success' => false, 'message' => 'Berkas foto tidak valid atau kosong.'], 400);
    }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!in_array($ext, $allowedExts)) {
        jsonRes(['success' => false, 'message' => 'Format file tidak didukung. Harap gunakan format JPG, JPEG, PNG, WEBP, atau GIF.'], 400);
    }

    // Validasi integritas gambar nyata
    $imgInfo = @getimagesize($file['tmp_name']);
    if (!$imgInfo) {
        jsonRes(['success' => false, 'message' => 'File yang diunggah bukan gambar yang valid.'], 400);
    }

    $uploadDir = __DIR__ . '/uploads/avatars/';
    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0777, true);
    }

    $newFileName = 'avatar_' . $targetUserId . '_' . time() . '.' . $ext;
    $destination = $uploadDir . $newFileName;

    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        jsonRes(['success' => false, 'message' => 'Gagal memindahkan file foto ke direktori server.'], 500);
    }

    if ($db_connected && $pdo) {
        try {
            // Hapus file lama jika ada dan bukan default.png
            $oldStmt = $pdo->prepare("SELECT foto FROM users WHERE id = :id LIMIT 1");
            $oldStmt->execute(['id' => $targetUserId]);
            $oldFoto = $oldStmt->fetchColumn();
            if ($oldFoto && $oldFoto !== 'default.png' && file_exists($uploadDir . $oldFoto)) {
                @unlink($uploadDir . $oldFoto);
            }

            // Simpan nama file baru ke database
            $upStmt = $pdo->prepare("UPDATE users SET foto = :foto WHERE id = :id");
            $upStmt->execute(['foto' => $newFileName, 'id' => $targetUserId]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal memperbarui foto di database: ' . $e->getMessage()], 500);
        }
    }

    // Jika user mengunggah untuk dirinya sendiri, perbarui session
    if ($targetUserId === (int)$currentUser['id']) {
        $_SESSION['user_foto'] = $newFileName;
    }

    jsonRes([
        'success' => true,
        'message' => 'Foto profil berhasil diperbarui!',
        'foto'    => $newFileName,
        'userId'  => $targetUserId,
        'url'     => 'uploads/avatars/' . $newFileName
    ]);
}

// E. HAPUS FOTO PROFIL USER (DELETE AVATAR - KEMBALI KE DEFAULT)
if ($action === 'delete_avatar' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $targetUserId = (int)$currentUser['id'];

    // Foto profil hanya dapat dihapus oleh pemilik akun
    if (!empty($input['user_id']) && (int)$input['user_id'] !== $targetUserId) {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Anda hanya dapat menghapus foto profil Anda sendiri.'], 403);
    }

    $uploadDir = __DIR__ . '/uploads/avatars/';

    if ($db_connected && $pdo) {
        try {
            $oldStmt = $pdo->prepare("SELECT foto FROM users WHERE id = :id LIMIT 1");
            $oldStmt->execute(['id' => $targetUserId]);
            $oldFoto = $oldStmt->fetchColumn();

            if ($oldFoto && $oldFoto !== 'default.png' && file_exists($uploadDir . $oldFoto)) {
                @unlink($uploadDir . $oldFoto);
            }

            $upStmt = $pdo->prepare("UPDATE users SET foto = 'default.png' WHERE id = :id");
            $upStmt->execute(['id' => $targetUserId]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal menghapus foto dari database: ' . $e->getMessage()], 500);
        }
    }

    if ($targetUserId === (int)$currentUser['id']) {
        $_SESSION['user_foto'] = 'default.png';
    }

    jsonRes([
        'success' => true,
        'message' => 'Foto profil berhasil dihapus dan dikembalikan ke avatar default.',
        'foto'    => 'default.png',
        'userId'  => $targetUserId
    ]);
}

// =============================================================
// 3. MANAJEMEN MATA KULIAH & KELAS (KHUSUS ADMIN)
// =============================================================

// A. TAMBAH MATA KULIAH (CREATE MATA KULIAH)
if ($action === 'create_mata_kuliah' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat menambahkan mata kuliah.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $kode            = strtoupper(validateLength($input['kode'] ?? '', 2, 20, 'Kode Mata Kuliah'));
    $nama            = validateLength($input['nama'] ?? '', 3, 100, 'Nama Mata Kuliah');
    $sks             = validatePositiveNumber($input['sks'] ?? 3, 'SKS');
    $semester_paket  = !empty($input['semester_paket']) ? (int)$input['semester_paket'] : 1;
    $deskripsi       = trim($input['deskripsi'] ?? '');

    if ($sks < 1 || $sks > 8) {
        jsonRes(['success' => false, 'message' => 'Bobot SKS harus berada dalam rentang 1 hingga 8 SKS.'], 400);
    }

    if ($db_connected && $pdo) {
        try {
            // Cek apakah kode_mk sudah ada
            $chk = $pdo->prepare("SELECT id FROM mata_kuliah WHERE kode_mk = :kode LIMIT 1");
            $chk->execute(['kode' => $kode]);
            if ($chk->fetch()) {
                jsonRes(['success' => false, 'message' => "Kode mata kuliah '{$kode}' sudah digunakan. Silakan gunakan kode lain."], 409);
            }

            $insMk = $pdo->prepare("
                INSERT INTO mata_kuliah (kode_mk, nama_mk, sks, semester_paket, deskripsi)
                VALUES (:kode, :nama, :sks, :sem, :desk)
            ");
            $insMk->execute([
                'kode' => $kode,
                'nama' => $nama,
                'sks'  => $sks,
                'sem'  => $semester_paket,
                'desk' => $deskripsi
            ]);
            $newMkId = (int)$pdo->lastInsertId();

            jsonRes([
                'success' => true,
                'message' => "Mata kuliah '{$nama}' ({$kode}) berhasil ditambahkan ke kurikulum!",
                'matkul'  => [
                    'id'              => $newMkId,
                    'kode'            => $kode,
                    'nama'            => $nama,
                    'sks'             => $sks,
                    'semester_paket'  => $semester_paket,
                    'deskripsi'       => $deskripsi
                ]
            ]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Kesalahan saat menyimpan mata kuliah: ' . $e->getMessage()], 500);
        }
    } else {
        jsonRes(['success' => false, 'message' => 'Database tidak terhubung. Gagal menambahkan mata kuliah.'], 503);
    }
}

// B. PERBARUI MATA KULIAH & ATUR DOSEN PENGAMPU (UPDATE MATA KULIAH)
if ($action === 'update_mata_kuliah' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat mengubah data mata kuliah.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $id              = validatePositiveNumber($input['id'] ?? 0, 'ID Mata Kuliah');
    $kode            = strtoupper(validateLength($input['kode'] ?? '', 2, 20, 'Kode Mata Kuliah'));
    $nama            = validateLength($input['nama'] ?? '', 3, 100, 'Nama Mata Kuliah');
    $sks             = validatePositiveNumber($input['sks'] ?? 3, 'SKS');
    $semester_paket  = !empty($input['semester_paket']) ? (int)$input['semester_paket'] : 1;
    $deskripsi       = trim($input['deskripsi'] ?? '');
    $kelas_id        = !empty($input['kelas_id']) ? (int)$input['kelas_id'] : null;
    $dosen_id        = !empty($input['dosen_id']) ? (int)$input['dosen_id'] : null;
    $hari            = trim($input['hari'] ?? 'Senin');
    $jam             = trim($input['jam'] ?? '08:00 - 10:30');
    $ruangan         = trim($input['ruangan'] ?? 'Lab Komputer CWE');

    if ($sks < 1 || $sks > 8) {
        jsonRes(['success' => false, 'message' => 'Bobot SKS harus berada dalam rentang 1 hingga 8 SKS.'], 400);
    }

    if ($db_connected && $pdo) {
        try {
            // Cek tabrakan kode dengan MK lain
            $chk = $pdo->prepare("SELECT id FROM mata_kuliah WHERE kode_mk = :kode AND id != :id LIMIT 1");
            $chk->execute(['kode' => $kode, 'id' => $id]);
            if ($chk->fetch()) {
                jsonRes(['success' => false, 'message' => "Kode mata kuliah '{$kode}' sudah digunakan oleh mata kuliah lain."], 409);
            }

            $upMk = $pdo->prepare("
                UPDATE mata_kuliah 
                SET kode_mk = :kode, nama_mk = :nama, sks = :sks, semester_paket = :sem, deskripsi = :desk
                WHERE id = :id
            ");
            $upMk->execute([
                'kode' => $kode,
                'nama' => $nama,
                'sks'  => $sks,
                'sem'  => $semester_paket,
                'desk' => $deskripsi,
                'id'   => $id
            ]);

            $dosenNama = 'Belum Ditentukan';
            if ($dosen_id) {
                $chkDosen = $pdo->prepare("SELECT nama FROM users WHERE id = :id AND role = 'dosen' LIMIT 1");
                $chkDosen->execute(['id' => $dosen_id]);
                $dRow = $chkDosen->fetch();
                if ($dRow) $dosenNama = $dRow['nama'];
            }

            // Perbarui kelas yang dipilih saja (jika ada)
            $existingKelas = null;
            if ($kelas_id) {
                $chkKelas = $pdo->prepare("SELECT id, nama_kelas, dosen_id FROM kelas WHERE id = :k_id AND mata_kuliah_id = :mk_id LIMIT 1");
                $chkKelas->execute(['k_id' => $kelas_id, 'mk_id' => $id]);
                $existingKelas = $chkKelas->fetch() ?: null;
            }

            if ($existingKelas) {
                $newDosenId = $dosen_id ?: (int)($existingKelas['dosen_id'] ?? 0);
                $upKelas = $pdo->prepare("
                    UPDATE kelas 
                    SET dosen_id = :dosen_id, hari = :hari, jam = :jam, ruangan = :ruang
                    WHERE id = :k_id
                ");
                $upKelas->execute([
                    'dosen_id' => $newDosenId,
                    'hari'     => $hari,
                    'jam'      => $jam,
                    'ruang'    => $ruangan,
                    'k_id'     => $existingKelas['id']
                ]);
            }

            jsonRes([
                'success' => true,
                'message' => "Mata kuliah '{$nama}' berhasil diperbarui!",
                'matkul'  => [
                    'id'              => $id,
                    'kode'            => $kode,
                    'nama'            => $nama,
                    'sks'             => $sks,
                    'semester_paket'  => $semester_paket,
                    'deskripsi'       => $deskripsi,
                    'dosen'           => $dosenNama,
                    'dosen_id'        => $dosen_id,
                    'kelas_id'        => $existingKelas['id'] ?? null,
                    'nama_kelas'      => $existingKelas['nama_kelas'] ?? null,
                    'hari'            => $hari,
                    'jam'             => $jam,
                    'ruang'           => $ruangan,
                    'ruangan'         => $ruangan,
                    'jadwal'          => !empty($hari) && !empty($jam) ? "{$hari}, {$jam} WIB" : "Sesuai Jadwal"
                ]
            ]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal memperbarui mata kuliah: ' . $e->getMessage()], 500);
        }
    } else {
        jsonRes(['success' => false, 'message' => 'Database tidak terhubung. Gagal memperbarui mata kuliah.'], 503);
    }
}

// C. HAPUS MATA KULIAH (DELETE MATA KULIAH)
if ($action === 'delete_mata_kuliah' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat menghapus mata kuliah.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $id = validatePositiveNumber($input['id'] ?? 0, 'ID Mata Kuliah');

    if ($db_connected && $pdo) {
        try {
            $del = $pdo->prepare("DELETE FROM mata_kuliah WHERE id = :id");
            $del->execute(['id' => $id]);
            if ($del->rowCount() > 0) {
                jsonRes(['success' => true, 'message' => 'Mata kuliah beserta kelas dan data terkait berhasil dihapus dari database MySQL!']);
            } else {
                jsonRes(['success' => false, 'message' => 'Mata kuliah tidak ditemukan di database.'], 404);
            }
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal menghapus mata kuliah: ' . $e->getMessage()], 500);
        }
    } else {
        jsonRes(['success' => false, 'message' => 'Database tidak terhubung. Gagal menghapus mata kuliah.'], 503);
    }
}

// =============================================================
// 3. MANAJEMEN ANGKATAN (ADMIN CRUD)
// =============================================================

// A. TAMBAH ANGKATAN (CREATE ANGKATAN)
if ($action === 'create_angkatan' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat menambah kategori angkatan.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $nama_angkatan = validateLength($input['nama_angkatan'] ?? '', 3, 50, 'Nama Angkatan');
    $tahun         = trim($input['tahun'] ?? date('Y'));
    $keterangan    = trim($input['keterangan'] ?? '');

    if ($db_connected && $pdo) {
        try {
            $chk = $pdo->prepare("SELECT id FROM angkatan WHERE nama_angkatan = :nama LIMIT 1");
            $chk->execute(['nama' => $nama_angkatan]);
            if ($chk->fetch()) {
                jsonRes(['success' => false, 'message' => "Kategori '{$nama_angkatan}' sudah ada di sistem."], 409);
            }

            $stmt = $pdo->prepare("INSERT INTO angkatan (nama_angkatan, tahun, keterangan) VALUES (:nama, :tahun, :ket)");
            $stmt->execute([
                'nama'  => $nama_angkatan,
                'tahun' => $tahun,
                'ket'   => $keterangan
            ]);
            $newId = (int)$pdo->lastInsertId();

            jsonRes([
                'success'  => true,
                'message'  => "Kategori angkatan '{$nama_angkatan}' berhasil ditambahkan ke database!",
                'angkatan' => [
                    'id'            => $newId,
                    'nama_angkatan' => $nama_angkatan,
                    'tahun'         => $tahun,
                    'keterangan'    => $keterangan,
                    'created_at'    => date('Y-m-d H:i:s')
                ]
            ]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal menyimpan kategori angkatan: ' . $e->getMessage()], 500);
        }
    } else {
        jsonRes(['success' => false, 'message' => 'Database tidak terhubung. Gagal menambahkan angkatan.'], 503);
    }
}

// B. PERBARUI ANGKATAN (UPDATE ANGKATAN)
if ($action === 'update_angkatan' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat mengubah kategori angkatan.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $id            = validatePositiveNumber($input['id'] ?? 0, 'ID Angkatan');
    $nama_angkatan = validateLength($input['nama_angkatan'] ?? '', 3, 50, 'Nama Angkatan');
    $tahun         = trim($input['tahun'] ?? date('Y'));
    $keterangan    = trim($input['keterangan'] ?? '');

    if ($db_connected && $pdo) {
        try {
            // Cek tabrakan nama dengan angkatan lain
            $chk = $pdo->prepare("SELECT id, nama_angkatan FROM angkatan WHERE nama_angkatan = :nama AND id != :id LIMIT 1");
            $chk->execute(['nama' => $nama_angkatan, 'id' => $id]);
            if ($chk->fetch()) {
                jsonRes(['success' => false, 'message' => "Kategori '{$nama_angkatan}' sudah digunakan oleh data lain."], 409);
            }

            // Ambil nama lama untuk sinkronisasi cascade teks
            $stmtOld = $pdo->prepare("SELECT nama_angkatan FROM angkatan WHERE id = :id LIMIT 1");
            $stmtOld->execute(['id' => $id]);
            $oldRow = $stmtOld->fetch();
            $oldNama = $oldRow ? $oldRow['nama_angkatan'] : null;

            $stmt = $pdo->prepare("UPDATE angkatan SET nama_angkatan = :nama, tahun = :tahun, keterangan = :ket WHERE id = :id");
            $stmt->execute([
                'nama'  => $nama_angkatan,
                'tahun' => $tahun,
                'ket'   => $keterangan,
                'id'    => $id
            ]);

            // Sinkronisasi teks nama angkatan pada mahasiswa dan matkul jika berubah
            if ($oldNama && $oldNama !== $nama_angkatan) {
                try {
                    $pdo->prepare("UPDATE users SET angkatan = :new_nama WHERE angkatan_id = :id OR angkatan = :old_nama")
                        ->execute(['new_nama' => $nama_angkatan, 'id' => $id, 'old_nama' => $oldNama]);
                    $pdo->prepare("UPDATE mata_kuliah SET target_angkatan = :new_nama WHERE angkatan_id = :id OR target_angkatan = :old_nama")
                        ->execute(['new_nama' => $nama_angkatan, 'id' => $id, 'old_nama' => $oldNama]);
                } catch (Exception $e) {}
            }

            jsonRes([
                'success'  => true,
                'message'  => "Kategori angkatan '{$nama_angkatan}' berhasil diperbarui!",
                'angkatan' => [
                    'id'            => $id,
                    'nama_angkatan' => $nama_angkatan,
                    'tahun'         => $tahun,
                    'keterangan'    => $keterangan
                ]
            ]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal memperbarui kategori angkatan: ' . $e->getMessage()], 500);
        }
    } else {
        jsonRes(['success' => false, 'message' => 'Database tidak terhubung. Gagal memperbarui angkatan.'], 503);
    }
}

// C. HAPUS ANGKATAN (DELETE ANGKATAN)
if ($action === 'delete_angkatan' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat menghapus kategori angkatan.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $id = validatePositiveNumber($input['id'] ?? 0, 'ID Angkatan');

    if ($db_connected && $pdo) {
        try {
            // Nullify relasi di users & mata_kuliah sebelum delete
            try {
                $pdo->prepare("UPDATE users SET angkatan_id = NULL WHERE angkatan_id = :id")->execute(['id' => $id]);
                $pdo->prepare("UPDATE mata_kuliah SET angkatan_id = NULL WHERE angkatan_id = :id")->execute(['id' => $id]);
            } catch (Exception $e) {}

            $del = $pdo->prepare("DELETE FROM angkatan WHERE id = :id");
            $del->execute(['id' => $id]);
            if ($del->rowCount() > 0) {
                jsonRes(['success' => true, 'message' => 'Kategori angkatan berhasil dihapus dari sistem!']);
            } else {
                jsonRes(['success' => false, 'message' => 'Kategori angkatan tidak ditemukan.'], 404);
            }
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal menghapus kategori angkatan: ' . $e->getMessage()], 500);
        }
    } else {
        jsonRes(['success' => false, 'message' => 'Database tidak terhubung. Gagal menghapus angkatan.'], 503);
    }
}

// =============================================================
// 4. MANAJEMEN SEMESTER & TAHUN AKADEMIK (KHUSUS ADMIN)
// =============================================================

// A. TAMBAH SEMESTER (CREATE SEMESTER)
if ($action === 'create_semester' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat menambah semester.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $nama     = validateLength($input['nama'] ?? '', 3, 50, 'Nama Semester');
    $is_aktif = !empty($input['is_aktif']) ? 1 : 0;

    if ($db_connected && $pdo) {
        try {
            $chk = $pdo->prepare("SELECT id FROM semester WHERE nama = :nama LIMIT 1");
            $chk->execute(['nama' => $nama]);
            if ($chk->fetch()) {
                jsonRes(['success' => false, 'message' => "Nama semester '{$nama}' sudah terdaftar."], 409);
            }

            if ($is_aktif === 1) {
                $pdo->exec("UPDATE semester SET is_aktif = 0");
            }

            $stmtIns = $pdo->prepare("INSERT INTO semester (nama, is_aktif) VALUES (:nama, :is_aktif)");
            $stmtIns->execute(['nama' => $nama, 'is_aktif' => $is_aktif]);
            $newId = (int)$pdo->lastInsertId();

            jsonRes([
                'success'  => true,
                'message'  => "Semester '{$nama}' berhasil ditambahkan ke database!",
                'semester' => [
                    'id'         => $newId,
                    'nama'       => $nama,
                    'is_aktif'   => $is_aktif,
                    'created_at' => date('Y-m-d H:i:s')
                ]
            ]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal menyimpan semester: ' . $e->getMessage()], 500);
        }
    } else {
        jsonRes(['success' => false, 'message' => 'Database tidak terhubung. Gagal menambahkan semester.'], 503);
    }
}

// B. PERBARUI SEMESTER (UPDATE SEMESTER)
if ($action === 'update_semester' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat mengubah semester.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $id       = validatePositiveNumber($input['id'] ?? 0, 'ID Semester');
    $nama     = validateLength($input['nama'] ?? '', 3, 50, 'Nama Semester');
    $is_aktif = !empty($input['is_aktif']) ? 1 : 0;

    if ($db_connected && $pdo) {
        try {
            $chk = $pdo->prepare("SELECT id FROM semester WHERE nama = :nama AND id != :id LIMIT 1");
            $chk->execute(['nama' => $nama, 'id' => $id]);
            if ($chk->fetch()) {
                jsonRes(['success' => false, 'message' => "Nama semester '{$nama}' sudah digunakan oleh semester lain."], 409);
            }

            if ($is_aktif === 1) {
                $pdo->exec("UPDATE semester SET is_aktif = 0");
            }

            $stmtUp = $pdo->prepare("UPDATE semester SET nama = :nama, is_aktif = :is_aktif WHERE id = :id");
            $stmtUp->execute(['nama' => $nama, 'is_aktif' => $is_aktif, 'id' => $id]);

            jsonRes([
                'success'  => true,
                'message'  => "Semester '{$nama}' berhasil diperbarui!",
                'semester' => [
                    'id'       => $id,
                    'nama'     => $nama,
                    'is_aktif' => $is_aktif
                ]
            ]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal memperbarui semester: ' . $e->getMessage()], 500);
        }
    }

    jsonRes([
        'success'  => true,
        'message'  => "Semester '{$nama}' berhasil diperbarui.",
        'semester' => [
            'id'       => $id,
            'nama'     => $nama,
            'is_aktif' => $is_aktif
        ]
    ]);
}

// C. JADIKAN SEMESTER AKTIF (SET ACTIVE SEMESTER - 1 KLIK)
if ($action === 'set_active_semester' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat mengaktifkan semester.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $id = validatePositiveNumber($input['id'] ?? 0, 'ID Semester');

    if ($db_connected && $pdo) {
        try {
            $chk = $pdo->prepare("SELECT nama FROM semester WHERE id = :id LIMIT 1");
            $chk->execute(['id' => $id]);
            $sem = $chk->fetch();
            if (!$sem) {
                jsonRes(['success' => false, 'message' => 'Data semester tidak ditemukan.'], 404);
            }

            $pdo->exec("UPDATE semester SET is_aktif = 0");
            $up = $pdo->prepare("UPDATE semester SET is_aktif = 1 WHERE id = :id");
            $up->execute(['id' => $id]);

            jsonRes([
                'success'        => true,
                'message'        => "Semester '{$sem['nama']}' kini resmi ditetapkan sebagai Semester Aktif!",
                'activeSemester' => $sem['nama'],
                'activeId'       => $id
            ]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal mengaktifkan semester: ' . $e->getMessage()], 500);
        }
    }

    jsonRes(['success' => true, 'message' => 'Semester aktif berhasil diubah.']);
}

// D. HAPUS SEMESTER (DELETE SEMESTER)
if ($action === 'delete_semester' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat menghapus semester.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $id = validatePositiveNumber($input['id'] ?? 0, 'ID Semester');

    if ($db_connected && $pdo) {
        try {
            $chk = $pdo->prepare("SELECT nama, is_aktif FROM semester WHERE id = :id LIMIT 1");
            $chk->execute(['id' => $id]);
            $sem = $chk->fetch();
            if (!$sem) {
                jsonRes(['success' => false, 'message' => 'Data semester tidak ditemukan.'], 404);
            }

            if ((int)$sem['is_aktif'] === 1) {
                jsonRes(['success' => false, 'message' => "Semester '{$sem['nama']}' sedang berstatus AKTIF. Silakan aktifkan semester lain terlebih dahulu sebelum menghapus semester ini."], 400);
            }

            $del = $pdo->prepare("DELETE FROM semester WHERE id = :id");
            $del->execute(['id' => $id]);

            jsonRes(['success' => true, 'message' => "Semester '{$sem['nama']}' berhasil dihapus dari database MySQL!"]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal menghapus semester: ' . $e->getMessage()], 500);
        }
    }

    jsonRes(['success' => true, 'message' => 'Semester berhasil dihapus.']);
}

// =============================================================
// 5. MANAJEMEN TUGAS (CRUD & VALIDASI TUGAS - KHUSUS DOSEN)
// =============================================================

// CREATE TUGAS (HANYA DOSEN)
if ($action === 'create_tugas' && $method === 'POST') {
    if ($currentUser['role'] !== 'dosen') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Manajemen tugas hanya dapat dilakukan oleh Dosen Pengampu.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $matkulId  = isset($input['matkulId']) ? (int)$input['matkulId'] : 0;
    $requestedKelasId = !empty($input['kelasId']) ? (int)$input['kelasId'] : 0;
    $judul     = trim($input['judul'] ?? '');
    $deadline  = trim($input['deadline'] ?? '');
    $deskripsi = trim($input['deskripsi'] ?? '');
    $lampiran  = $input['lampiranSoal'] ?? null;

    if ($matkulId <= 0 || empty($judul) || empty($deadline) || empty($deskripsi)) {
        jsonRes(['success' => false, 'message' => 'Data tugas tidak lengkap.'], 400);
    }

    if ($db_connected && $pdo) {
        try {
            if ($requestedKelasId > 0) {
                $stmtK = $pdo->prepare("SELECT id FROM kelas WHERE id = :kelas_id AND mata_kuliah_id = :mk_id AND dosen_id = :dosen_id LIMIT 1");
                $stmtK->execute(['kelas_id' => $requestedKelasId, 'mk_id' => $matkulId, 'dosen_id' => $userId]);
            } else {
                $stmtK = $pdo->prepare("SELECT id FROM kelas WHERE mata_kuliah_id = :mk_id AND dosen_id = :dosen_id ORDER BY id ASC LIMIT 1");
                $stmtK->execute(['mk_id' => $matkulId, 'dosen_id' => $userId]);
            }
            $kelas = $stmtK->fetch();
            if (!$kelas) {
                jsonRes(['success' => false, 'message' => 'Anda tidak memiliki akses ke kelas untuk mata kuliah tersebut.'], 403);
            }
            $kelasId = (int)$kelas['id'];

            $lampiranPath = null;
            if ($lampiran && !empty($lampiran['dataUrl'])) {
                $lampiranPath = saveBase64File($lampiran['dataUrl'], 'uploads/assignments', 'task_' . $userId);
            }

            $insert = $pdo->prepare("
                INSERT INTO tugas (kelas_id, judul, deskripsi, deadline, lampiran_nama, lampiran_size, lampiran_path)
                VALUES (:kelas_id, :judul, :deskripsi, :deadline, :nama, :size, :path)
            ");
            $insert->execute([
                'kelas_id'  => $kelasId,
                'judul'     => $judul,
                'deskripsi' => $deskripsi,
                'deadline'  => $deadline,
                'nama'      => $lampiran['nama'] ?? null,
                'size'      => $lampiran['size'] ?? null,
                'path'      => $lampiranPath
            ]);

            $newTugasId = (int)$pdo->lastInsertId();
            jsonRes([
                'success' => true,
                'id' => $newTugasId,
                'kelasId' => $kelasId,
                'matkulId' => $matkulId,
                'message' => 'Tugas baru berhasil disimpan!'
            ]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal menyimpan tugas ke database: ' . $e->getMessage()], 500);
        }
    }
}

// UPDATE TUGAS (HANYA DOSEN)
if ($action === 'update_tugas' && $method === 'POST') {
    if ($currentUser['role'] !== 'dosen') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Dosen Pengampu yang dapat mengubah tugas.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $id        = validatePositiveNumber($input['id'] ?? 0, 'ID Tugas');
    $matkulId  = validatePositiveNumber($input['matkulId'] ?? 0, 'Mata Kuliah');
    $requestedKelasId = !empty($input['kelasId']) ? (int)$input['kelasId'] : 0;
    $judul     = validateLength($input['judul'] ?? '', 3, 150, 'Judul Tugas');
    $deadline  = validateLength($input['deadline'] ?? '', 10, 30, 'Deadline');
    $deskripsi = validateLength($input['deskripsi'] ?? '', 5, 5000, 'Instruksi Pengerjaan');

    if ($db_connected && $pdo) {
        try {
            $chkOwnership = $pdo->prepare("
                SELECT t.id
                FROM tugas t
                JOIN kelas k ON k.id = t.kelas_id
                WHERE t.id = :id AND k.dosen_id = :dosen_id
                LIMIT 1
            ");
            $chkOwnership->execute(['id' => $id, 'dosen_id' => $userId]);
            if (!$chkOwnership->fetch()) {
                jsonRes(['success' => false, 'message' => 'Anda tidak memiliki akses untuk mengubah tugas ini.'], 403);
            }

            if ($requestedKelasId > 0) {
                $stmtK = $pdo->prepare("
                    SELECT id FROM kelas
                    WHERE id = :kelas_id AND mata_kuliah_id = :mk_id AND dosen_id = :dosen_id
                    LIMIT 1
                ");
                $stmtK->execute([
                    'kelas_id' => $requestedKelasId,
                    'mk_id' => $matkulId,
                    'dosen_id' => $userId
                ]);
            } else {
                $stmtK = $pdo->prepare("
                    SELECT id FROM kelas
                    WHERE mata_kuliah_id = :mk_id AND dosen_id = :dosen_id
                    ORDER BY id ASC LIMIT 1
                ");
                $stmtK->execute(['mk_id' => $matkulId, 'dosen_id' => $userId]);
            }
            $kelas = $stmtK->fetch();
            if (!$kelas) {
                jsonRes(['success' => false, 'message' => 'Anda tidak memiliki akses ke kelas untuk mata kuliah tersebut.'], 403);
            }
            $kelasId = (int)$kelas['id'];

            $update = $pdo->prepare("
                UPDATE tugas 
                SET kelas_id = :kelas_id, judul = :judul, deskripsi = :deskripsi, deadline = :deadline
                WHERE id = :id
            ");
            $update->execute([
                'kelas_id'  => $kelasId,
                'judul'     => $judul,
                'deskripsi' => $deskripsi,
                'deadline'  => $deadline,
                'id'        => $id
            ]);

            jsonRes(['success' => true, 'kelasId' => $kelasId, 'matkulId' => $matkulId, 'message' => 'Data tugas berhasil diperbarui di database!']);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal memperbarui tugas: ' . $e->getMessage()], 500);
        }
    }

    jsonRes(['success' => true, 'message' => 'Tugas berhasil diperbarui.']);
}

// DELETE TUGAS (HANYA DOSEN)
if ($action === 'delete_tugas' && $method === 'POST') {
    if ($currentUser['role'] !== 'dosen') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Dosen Pengampu yang dapat menghapus tugas.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $id = validatePositiveNumber($input['id'] ?? 0, 'ID Tugas');

    if ($db_connected && $pdo) {
        try {
            $chkOwnership = $pdo->prepare("
                SELECT t.id
                FROM tugas t
                JOIN kelas k ON k.id = t.kelas_id
                WHERE t.id = :id AND k.dosen_id = :dosen_id
                LIMIT 1
            ");
            $chkOwnership->execute(['id' => $id, 'dosen_id' => $userId]);
            if (!$chkOwnership->fetch()) {
                jsonRes(['success' => false, 'message' => 'Anda tidak memiliki akses untuk menghapus tugas ini.'], 403);
            }

            $del = $pdo->prepare("DELETE FROM tugas WHERE id = :id");
            $del->execute(['id' => $id]);
            jsonRes(['success' => true, 'message' => 'Tugas berhasil dihapus dari database MySQL!']);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal menghapus tugas: ' . $e->getMessage()], 500);
        }
    }

    jsonRes(['success' => true, 'message' => 'Tugas berhasil dihapus.']);
}

// SUBMIT TUGAS (MAHASISWA)
if ($action === 'submit_tugas' && $method === 'POST') {
    if ($currentUser['role'] !== 'mahasiswa') {
        jsonRes(['success' => false, 'message' => 'Hanya mahasiswa yang dapat mengumpulkan tugas.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $tugasId = validatePositiveNumber($input['tugasId'] ?? 0, 'ID Tugas');
    $file    = $input['fileJawaban'] ?? null;
    $catatan = trim($input['catatanMhs'] ?? '');

    if ($db_connected && $pdo) {
        try {
            // 1. Cek Deadline & Enrollment
            $stmtCek = $pdo->prepare("
                SELECT t.deadline, k.id as kelas_id, t.judul
                FROM tugas t
                JOIN kelas k ON t.kelas_id = k.id
                LEFT JOIN enrollments e ON e.kelas_id = k.id AND e.mahasiswa_id = :mhs_id
                WHERE t.id = :tugas_id
                LIMIT 1
            ");
            $stmtCek->execute(['mhs_id' => $userId, 'tugas_id' => $tugasId]);
            $tugasInfo = $stmtCek->fetch();

            if (!$tugasInfo) {
                jsonRes(['success' => false, 'message' => 'Tugas tidak ditemukan atau Anda tidak terdaftar di kelas ini.'], 404);
            }

            // Validasi Deadline
            if (strtotime($tugasInfo['deadline']) < time()) {
                jsonRes(['success' => false, 'message' => 'Gagal: Batas waktu pengumpulan tugas "' . $tugasInfo['judul'] . '" telah berakhir.'], 400);
            }

            // 2. Proses File
            $filePath = null;
            if ($file && !empty($file['dataUrl'])) {
                // Jika update, hapus file lama? (Opsional, untuk hemat storage)
                $stmtOld = $pdo->prepare("SELECT file_path FROM submissions WHERE tugas_id = :tugas_id AND mahasiswa_id = :mhs_id");
                $stmtOld->execute(['tugas_id' => $tugasId, 'mhs_id' => $userId]);
                $oldPath = $stmtOld->fetchColumn();
                if ($oldPath && file_exists(__DIR__ . '/' . $oldPath)) {
                    @unlink(__DIR__ . '/' . $oldPath);
                }

                $filePath = saveBase64File($file['dataUrl'], 'uploads/submissions', 'sub_' . $userId);
                if (!$filePath) {
                    jsonRes(['success' => false, 'message' => 'Gagal menyimpan berkas ke server.'], 500);
                }
            } else {
                // Jika tidak ada file baru tapi sudah ada submission, biarkan yang lama (atau error jika baru)
                $stmtCheckExist = $pdo->prepare("SELECT id FROM submissions WHERE tugas_id = :tugas_id AND mahasiswa_id = :mhs_id");
                $stmtCheckExist->execute(['tugas_id' => $tugasId, 'mhs_id' => $userId]);
                if (!$stmtCheckExist->fetch()) {
                    jsonRes(['success' => false, 'message' => 'Berkas jawaban wajib diunggah.'], 400);
                }
            }

            // 3. Simpan ke Database (Handling skema tabel yang memiliki kolom file_jawaban)
            $hasFileJawaban = hasColumn($pdo, 'submissions', 'file_jawaban');
            
            if ($filePath) {
                if ($hasFileJawaban) {
                    $stmt = $pdo->prepare("
                        INSERT INTO submissions (tugas_id, mahasiswa_id, file_nama, file_size, file_path, file_jawaban, catatan_mhs)
                        VALUES (:tugas_id, :mhs_id, :fn, :fs, :fp, :fj, :catatan)
                        ON DUPLICATE KEY UPDATE 
                            file_nama = VALUES(file_nama),
                            file_size = VALUES(file_size),
                            file_path = VALUES(file_path),
                            file_jawaban = VALUES(file_jawaban),
                            catatan_mhs = VALUES(catatan_mhs),
                            submitted_at = CURRENT_TIMESTAMP
                    ");
                    $stmt->execute([
                        'tugas_id' => $tugasId,
                        'mhs_id'   => $userId,
                        'fn'       => validateLength($file['nama'], 1, 255, 'Nama Berkas'),
                        'fs'       => $file['size'] ?? '500 KB',
                        'fp'       => $filePath,
                        'fj'       => $filePath,
                        'catatan'  => $catatan
                    ]);
                } else {
                    $stmt = $pdo->prepare("
                        INSERT INTO submissions (tugas_id, mahasiswa_id, file_nama, file_size, file_path, catatan_mhs)
                        VALUES (:tugas_id, :mhs_id, :fn, :fs, :fp, :catatan)
                        ON DUPLICATE KEY UPDATE 
                            file_nama = VALUES(file_nama),
                            file_size = VALUES(file_size),
                            file_path = VALUES(file_path),
                            catatan_mhs = VALUES(catatan_mhs),
                            submitted_at = CURRENT_TIMESTAMP
                    ");
                    $stmt->execute([
                        'tugas_id' => $tugasId,
                        'mhs_id'   => $userId,
                        'fn'       => validateLength($file['nama'], 1, 255, 'Nama Berkas'),
                        'fs'       => $file['size'] ?? '500 KB',
                        'fp'       => $filePath,
                        'catatan'  => $catatan
                    ]);
                }
            } else {
                // Update catatan saja jika file tidak dikirim ulang
                $stmt = $pdo->prepare("
                    UPDATE submissions 
                    SET catatan_mhs = :catatan, submitted_at = CURRENT_TIMESTAMP
                    WHERE tugas_id = :tugas_id AND mahasiswa_id = :mhs_id
                ");
                $stmt->execute([
                    'catatan'  => $catatan,
                    'tugas_id' => $tugasId,
                    'mhs_id'   => $userId
                ]);
            }

            jsonRes(['success' => true, 'message' => 'Tugas berhasil dikirim dan tersimpan fisik di server!']);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal menyimpan kiriman: ' . $e->getMessage()], 500);
        }
    }

    jsonRes(['success' => false, 'message' => 'Koneksi database terputus.'], 500);
}

// PENILAIAN TUGAS (KHUSUS DOSEN PENGAMPU - ADMIN TIDAK BOLEH MENILAI)
if ($action === 'grade_submission' && $method === 'POST') {
    if ($currentUser['role'] !== 'dosen') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Dosen pengampu yang berwenang memberikan nilai pada tugas mahasiswa. Administrator tidak memiliki izin memberikan nilai.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $tugasId = validatePositiveNumber($input['tugasId'] ?? 0, 'ID Tugas');
    $mhsId   = validatePositiveNumber($input['mhsId'] ?? 0, 'ID Mahasiswa');
    $nilai   = validateScore($input['nilai'] ?? 0);
    $catatan = trim($input['catatanDosen'] ?? '');

    if ($db_connected && $pdo) {
        try {
            $stmt = $pdo->prepare("
                UPDATE submissions 
                SET nilai = :nilai, catatan_dosen = :catatan
                WHERE tugas_id = :tugas_id AND mahasiswa_id = :mhs_id
            ");
            $stmt->execute([
                'nilai'    => $nilai,
                'catatan'  => $catatan,
                'tugas_id' => $tugasId,
                'mhs_id'   => $mhsId
            ]);

            jsonRes(['success' => true, 'message' => 'Nilai berhasil disimpan ke database MySQL!']);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal menyimpan nilai: ' . $e->getMessage()], 500);
        }
    }

    jsonRes(['success' => true, 'message' => 'Nilai berhasil disimpan.']);
}

// =============================================================
// 6. MANAJEMEN KELAS & ENROLLMENT MAHASISWA (KHUSUS ADMIN)
// =============================================================

// A. TAMBAH KELAS BARU (CREATE CLASS)
if ($action === 'create_class' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat membuka kelas baru.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $nama_kelas     = validateLength($input['nama_kelas'] ?? '', 2, 30, 'Nama Kelas');
    $mata_kuliah_id = validatePositiveNumber($input['mata_kuliah_id'] ?? 0, 'Mata Kuliah');
    $dosen_id       = validatePositiveNumber($input['dosen_id'] ?? 0, 'Dosen Pengampu');
    $semester_id    = validatePositiveNumber($input['semester_id'] ?? 1, 'Semester');
    $angkatan_id    = !empty($input['angkatan_id']) ? (int)$input['angkatan_id'] : null;
    $hari           = trim($input['hari'] ?? 'Senin');
    $jam            = trim($input['jam'] ?? '08:00 - 10:30');
    $ruangan        = trim($input['ruangan'] ?? 'Lab Komputer CWE');

    if ($db_connected && $pdo) {
        try {
            if ($angkatan_id) {
                $chkAngkatan = $pdo->prepare("SELECT id FROM angkatan WHERE id = :id LIMIT 1");
                $chkAngkatan->execute(['id' => $angkatan_id]);
                if (!$chkAngkatan->fetch()) {
                    jsonRes(['success' => false, 'message' => 'Angkatan yang dipilih tidak ditemukan.'], 404);
                }

                $chkDup = $pdo->prepare("
                    SELECT id FROM kelas
                    WHERE mata_kuliah_id = :mk_id AND angkatan_id = :angkatan_id AND semester_id = :sem_id
                    LIMIT 1
                ");
                $chkDup->execute([
                    'mk_id'       => $mata_kuliah_id,
                    'angkatan_id' => $angkatan_id,
                    'sem_id'      => $semester_id
                ]);
                if ($chkDup->fetch()) {
                    jsonRes(['success' => false, 'message' => 'Kelas untuk mata kuliah dan angkatan ini sudah dibuka pada semester tersebut.'], 409);
                }
            }

            $ins = $pdo->prepare("
                INSERT INTO kelas (mata_kuliah_id, dosen_id, semester_id, angkatan_id, nama_kelas, hari, jam, ruangan)
                VALUES (:mk_id, :dosen_id, :sem_id, :angkatan_id, :nama_kelas, :hari, :jam, :ruang)
            ");
            $ins->execute([
                'mk_id'      => $mata_kuliah_id,
                'dosen_id'   => $dosen_id,
                'sem_id'     => $semester_id,
                'angkatan_id' => $angkatan_id,
                'nama_kelas' => $nama_kelas,
                'hari'       => $hari,
                'jam'        => $jam,
                'ruang'      => $ruangan
            ]);
            $newClassId = (int)$pdo->lastInsertId();

            // Ambil info lengkap kelas yang baru dibuat
            $stmtK = $pdo->prepare("
                SELECT k.id, k.nama_kelas, k.mata_kuliah_id, k.dosen_id, k.semester_id,
                       k.angkatan_id, k.hari, k.jam, k.ruangan,
                       mk.kode_mk, mk.nama_mk, mk.sks, mk.semester_paket,
                       ud.nama as dosen_nama,
                       s.nama as semester_nama,
                       ang.nama_angkatan as angkatan_nama, ang.tahun as angkatan_tahun
                FROM kelas k
                JOIN mata_kuliah mk ON k.mata_kuliah_id = mk.id
                JOIN users ud ON k.dosen_id = ud.id
                LEFT JOIN semester s ON k.semester_id = s.id
                LEFT JOIN angkatan ang ON ang.id = k.angkatan_id
                WHERE k.id = :id
            ");
            $stmtK->execute(['id' => $newClassId]);
            $rowK = $stmtK->fetch();

            // Pastikan relasi angkatan-semester tersedia sebagai cache internal
            // (INSERT IGNORE: mapping yang sudah ada tidak akan ditimpa).
            $angkatanSemester = null;
            if ($angkatan_id) {
                $paketKelas = (int)($rowK['semester_paket'] ?? 0);
                if ($paketKelas >= 1 && $paketKelas <= 8) {
                    $insMapping = $pdo->prepare("
                        INSERT IGNORE INTO angkatan_semester (angkatan_id, semester_id, semester_paket)
                        VALUES (:angkatan_id, :semester_id, :semester_paket)
                    ");
                    $insMapping->execute([
                        'angkatan_id'   => $angkatan_id,
                        'semester_id'   => $semester_id,
                        'semester_paket' => $paketKelas
                    ]);

                    $stmtMapping = $pdo->prepare("
                        SELECT asg.id, asg.angkatan_id, asg.semester_id, asg.semester_paket,
                               asg.created_at, asg.updated_at,
                               s.nama as semester_nama, s.is_aktif as semester_is_aktif
                        FROM angkatan_semester asg
                        JOIN semester s ON s.id = asg.semester_id
                        WHERE asg.angkatan_id = :angkatan_id AND asg.semester_id = :semester_id
                        LIMIT 1
                    ");
                    $stmtMapping->execute([
                        'angkatan_id' => $angkatan_id,
                        'semester_id' => $semester_id
                    ]);
                    $rowMapping = $stmtMapping->fetch();
                    if ($rowMapping) {
                        $angkatanSemester = [
                            'id'               => (int)$rowMapping['id'],
                            'angkatan_id'      => (int)$rowMapping['angkatan_id'],
                            'semester_id'      => (int)$rowMapping['semester_id'],
                            'semester_paket'   => (int)$rowMapping['semester_paket'],
                            'semester_nama'    => $rowMapping['semester_nama'],
                            'semester_is_aktif' => (int)$rowMapping['semester_is_aktif'],
                            'created_at'       => $rowMapping['created_at'],
                            'updated_at'       => $rowMapping['updated_at']
                        ];
                    }
                }
            }

            jsonRes([
                'success' => true,
                'message' => "Kelas '{$nama_kelas}' berhasil dibuka di database MySQL!",
                'kelas'   => [
                    'id'               => $newClassId,
                    'nama_kelas'       => $nama_kelas,
                    'mata_kuliah_id'   => $mata_kuliah_id,
                    'kode_mk'          => $rowK['kode_mk'] ?? '',
                    'nama_mk'          => $rowK['nama_mk'] ?? '',
                    'sks'              => (int)($rowK['sks'] ?? 3),
                    'semester_paket'   => (int)($rowK['semester_paket'] ?? 1),
                    'dosen_id'         => $dosen_id,
                    'dosen_nama'       => $rowK['dosen_nama'] ?? '',
                    'semester_id'      => $semester_id,
                    'semester_nama'    => $rowK['semester_nama'] ?? '',
                    'angkatan_id'      => $angkatan_id,
                    'angkatan_nama'    => $rowK['angkatan_nama'] ?? null,
                    'angkatan_tahun'   => $rowK['angkatan_tahun'] ?? null,
                    'hari'             => $hari,
                    'jam'              => $jam,
                    'ruangan'          => $ruangan,
                    'jadwal'           => "{$hari}, {$jam} WIB",
                    'jumlah_mahasiswa' => 0,
                    'jumlah_tugas'     => 0,
                    'mahasiswa'        => []
                ],
                'angkatan_semester' => $angkatanSemester
            ]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal membuat kelas: ' . $e->getMessage()], 500);
        }
    }

    $mockId = time();
    jsonRes([
        'success' => true,
        'message' => "Kelas '{$nama_kelas}' berhasil diproses.",
        'kelas'   => [
            'id'               => $mockId,
            'nama_kelas'       => $nama_kelas,
            'mata_kuliah_id'   => $mata_kuliah_id,
            'dosen_id'         => $dosen_id,
            'semester_id'      => $semester_id,
            'angkatan_id'      => $angkatan_id,
            'angkatan_nama'    => null,
            'angkatan_tahun'   => null,
            'hari'             => $hari,
            'jam'              => $jam,
            'ruangan'          => $ruangan,
            'jadwal'           => "{$hari}, {$jam} WIB",
            'jumlah_mahasiswa' => 0,
            'jumlah_tugas'     => 0,
            'mahasiswa'        => []
        ]
    ]);
}

// B. PERBARUI DATA KELAS (UPDATE CLASS)
if ($action === 'update_class' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat mengubah data kelas.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $id             = validatePositiveNumber($input['id'] ?? 0, 'ID Kelas');
    $nama_kelas     = validateLength($input['nama_kelas'] ?? '', 2, 30, 'Nama Kelas');
    $mata_kuliah_id = validatePositiveNumber($input['mata_kuliah_id'] ?? 0, 'Mata Kuliah');
    $dosen_id       = validatePositiveNumber($input['dosen_id'] ?? 0, 'Dosen Pengampu');
    $semester_id    = validatePositiveNumber($input['semester_id'] ?? 1, 'Semester');
    $angkatan_id    = !empty($input['angkatan_id']) ? (int)$input['angkatan_id'] : null;
    $hari           = trim($input['hari'] ?? 'Senin');
    $jam            = trim($input['jam'] ?? '08:00 - 10:30');
    $ruangan        = trim($input['ruangan'] ?? 'Lab Komputer CWE');

    if ($db_connected && $pdo) {
        try {
            if ($angkatan_id) {
                $chkAngkatan = $pdo->prepare("SELECT id FROM angkatan WHERE id = :id LIMIT 1");
                $chkAngkatan->execute(['id' => $angkatan_id]);
                if (!$chkAngkatan->fetch()) {
                    jsonRes(['success' => false, 'message' => 'Angkatan yang dipilih tidak ditemukan.'], 404);
                }
            }

            $up = $pdo->prepare("
                UPDATE kelas 
                SET nama_kelas = :nama_kelas, mata_kuliah_id = :mk_id, dosen_id = :dosen_id,
                    semester_id = :sem_id, angkatan_id = :angkatan_id, hari = :hari, jam = :jam, ruangan = :ruang
                WHERE id = :id
            ");
            $up->execute([
                'nama_kelas' => $nama_kelas,
                'mk_id'      => $mata_kuliah_id,
                'dosen_id'   => $dosen_id,
                'sem_id'     => $semester_id,
                'angkatan_id' => $angkatan_id,
                'hari'       => $hari,
                'jam'        => $jam,
                'ruang'      => $ruangan,
                'id'         => $id
            ]);

            $stmtK = $pdo->prepare("
                SELECT mk.kode_mk, mk.nama_mk, mk.sks, mk.semester_paket,
                       ud.nama as dosen_nama, s.nama as semester_nama,
                       ang.nama_angkatan as angkatan_nama, ang.tahun as angkatan_tahun
                FROM kelas k
                JOIN mata_kuliah mk ON k.mata_kuliah_id = mk.id
                JOIN users ud ON k.dosen_id = ud.id
                LEFT JOIN semester s ON k.semester_id = s.id
                LEFT JOIN angkatan ang ON ang.id = k.angkatan_id
                WHERE k.id = :id
            ");
            $stmtK->execute(['id' => $id]);
            $rowK = $stmtK->fetch();

            jsonRes([
                'success' => true,
                'message' => "Kelas '{$nama_kelas}' berhasil diperbarui di database!",
                'kelas'   => [
                    'id'             => $id,
                    'nama_kelas'     => $nama_kelas,
                    'mata_kuliah_id' => $mata_kuliah_id,
                    'kode_mk'        => $rowK['kode_mk'] ?? '',
                    'nama_mk'        => $rowK['nama_mk'] ?? '',
                    'sks'            => (int)($rowK['sks'] ?? 3),
                    'semester_paket' => (int)($rowK['semester_paket'] ?? 1),
                    'dosen_id'       => $dosen_id,
                    'dosen_nama'     => $rowK['dosen_nama'] ?? '',
                    'semester_id'    => $semester_id,
                    'semester_nama'  => $rowK['semester_nama'] ?? '',
                    'angkatan_id'    => $angkatan_id,
                    'angkatan_nama'  => $rowK['angkatan_nama'] ?? null,
                    'angkatan_tahun' => $rowK['angkatan_tahun'] ?? null,
                    'hari'           => $hari,
                    'jam'            => $jam,
                    'ruangan'        => $ruangan,
                    'jadwal'         => "{$hari}, {$jam} WIB"
                ]
            ]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal memperbarui kelas: ' . $e->getMessage()], 500);
        }
    }

    jsonRes([
        'success' => true,
        'message' => "Kelas '{$nama_kelas}' berhasil diperbarui.",
        'kelas'   => [
            'id'             => $id,
            'nama_kelas'     => $nama_kelas,
            'mata_kuliah_id' => $mata_kuliah_id,
            'dosen_id'       => $dosen_id,
            'semester_id'    => $semester_id,
            'angkatan_id'    => $angkatan_id,
            'angkatan_nama'  => null,
            'angkatan_tahun' => null,
            'hari'           => $hari,
            'jam'            => $jam,
            'ruangan'        => $ruangan,
            'jadwal'         => "{$hari}, {$jam} WIB"
        ]
    ]);
}

// C. HAPUS KELAS (DELETE CLASS)
if ($action === 'delete_class' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat menghapus kelas.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $id = validatePositiveNumber($input['id'] ?? 0, 'ID Kelas');

    if ($db_connected && $pdo) {
        try {
            $del = $pdo->prepare("DELETE FROM kelas WHERE id = :id");
            $del->execute(['id' => $id]);
            if ($del->rowCount() > 0) {
                jsonRes(['success' => true, 'message' => 'Kelas beserta data enrolmen mahasiswa berhasil dihapus dari database MySQL!']);
            } else {
                jsonRes(['success' => false, 'message' => 'Kelas tidak ditemukan di database.'], 404);
            }
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal menghapus kelas: ' . $e->getMessage()], 500);
        }
    }

    jsonRes(['success' => true, 'message' => 'Kelas berhasil dihapus.']);
}

// D. DAFTARKAN MAHASISWA KE KELAS (ENROLL STUDENTS - BATCH SUPPORT)
if ($action === 'enroll_students' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat mendaftarkan mahasiswa ke kelas.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $kelasId = validatePositiveNumber($input['kelas_id'] ?? 0, 'ID Kelas');
    $mhsIds  = $input['mahasiswa_ids'] ?? [];

    if (!is_array($mhsIds) || empty($mhsIds)) {
        jsonRes(['success' => false, 'message' => 'Pilih minimal satu mahasiswa untuk didaftarkan ke kelas.'], 400);
    }

    $enrolledCount = 0;
    if ($db_connected && $pdo) {
        try {
            // Remove existing enrollments for these mahasiswa in this kelas first (clean slate)
            $delStmt = $pdo->prepare("DELETE FROM enrollments WHERE kelas_id = :kelas_id AND mahasiswa_id IN (" . implode(',', array_map('intval', $mhsIds)) . ")");
            $delStmt->execute(['kelas_id' => $kelasId]);

            // Insert new enrollments
            $insStmt = $pdo->prepare("
                INSERT INTO enrollments (kelas_id, mahasiswa_id)
                VALUES (:kelas_id, :mhs_id)
            ");
            foreach ($mhsIds as $mid) {
                $mIdInt = (int)$mid;
                if ($mIdInt > 0) {
                    $insStmt->execute(['kelas_id' => $kelasId, 'mhs_id' => $mIdInt]);
                    $enrolledCount++;
                }
            }

            // Ambil daftar mahasiswa terdaftar terbaru
            $hasFoto = hasColumn($pdo, 'users', 'foto');
            $fotoCol = $hasFoto ? "COALESCE(NULLIF(u.foto, ''), 'default.png') as foto" : "'default.png' as foto";
            $stmtMhs = $pdo->prepare("
                SELECT u.id, u.nomor_induk, u.nama, u.email, {$fotoCol}, e.created_at as enrolled_at
                FROM enrollments e
                JOIN users u ON e.mahasiswa_id = u.id
                WHERE e.kelas_id = :kelas_id
                ORDER BY u.nomor_induk ASC, u.nama ASC
            ");
            $stmtMhs->execute(['kelas_id' => $kelasId]);
            $updatedList = $stmtMhs->fetchAll();
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal mendaftarkan mahasiswa: ' . $e->getMessage()], 500);
            return;
        }
    }

    jsonRes([
        'success'       => true,
        'message'       => "Sebanyak {$enrolledCount} mahasiswa berhasil didaftarkan ke dalam kelas!",
        'enrolledCount' => $enrolledCount,
        'mahasiswa'     => $updatedList ?? []
    ]);
}

// E. KELUARKAN MAHASISWA DARI KELAS (UNENROLL STUDENT)
if ($action === 'unenroll_student' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat mengeluarkan mahasiswa dari kelas.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $kelasId = validatePositiveNumber($input['kelas_id'] ?? 0, 'ID Kelas');
    $mhsId   = validatePositiveNumber($input['mahasiswa_id'] ?? 0, 'ID Mahasiswa');

    if ($db_connected && $pdo) {
        try {
            $del = $pdo->prepare("DELETE FROM enrollments WHERE kelas_id = :kelas_id AND mahasiswa_id = :mhs_id");
            $del->execute(['kelas_id' => $kelasId, 'mhs_id' => $mhsId]);

            jsonRes(['success' => true, 'message' => 'Mahasiswa berhasil dikeluarkan dari kelas.']);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal mengeluarkan mahasiswa: ' . $e->getMessage()], 500);
        }
    }

    jsonRes(['success' => true, 'message' => 'Mahasiswa berhasil dikeluarkan dari kelas.']);
}

// F.Assign MAHASISWA KE ANGKATAN
if ($action === 'assign_mahasiswa_to_angkatan' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat mengatur angkatan mahasiswa.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $mahasiswa_id = validatePositiveNumber($input['mahasiswa_id'] ?? 0, 'ID Mahasiswa');
    $angkatan_id = validatePositiveNumber($input['angkatan_id'] ?? 0, 'ID Angkatan');

    if ($db_connected && $pdo) {
        try {
            $stmtMhs = $pdo->prepare("SELECT id, nama, nomor_induk FROM users WHERE id = :id AND role = 'mahasiswa' LIMIT 1");
            $stmtMhs->execute(['id' => $mahasiswa_id]);
            $mhs = $stmtMhs->fetch();
            if (!$mhs) {
                jsonRes(['success' => false, 'message' => 'Mahasiswa tidak ditemukan.'], 404);
            }

            $stmtAng = $pdo->prepare("SELECT id, nama_angkatan FROM angkatan WHERE id = :id LIMIT 1");
            $stmtAng->execute(['id' => $angkatan_id]);
            $ang = $stmtAng->fetch();
            if (!$ang) {
                jsonRes(['success' => false, 'message' => 'Angkatan tidak ditemukan.'], 404);
            }

            $stmtUpdate = $pdo->prepare("UPDATE users SET angkatan_id = :ang_id, angkatan = :ang_nama WHERE id = :mhs_id");
            $stmtUpdate->execute([
                'ang_id' => $angkatan_id,
                'ang_nama' => $ang['nama_angkatan'],
                'mhs_id' => $mahasiswa_id
            ]);

            jsonRes([
                'success' => true,
                'message' => "Mahasiswa {$mhs['nama']} berhasil ditambahkan ke {$ang['nama_angkatan']}."
            ]);
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal menambahkan mahasiswa ke angkatan: ' . $e->getMessage()], 500);
        }
    }

    jsonRes(['success' => false, 'message' => 'Koneksi database tidak aktif.'], 500);
}

// G. KELUARKAN MAHASISWA DARI ANGKATAN
if ($action === 'remove_mahasiswa_from_angkatan' && $method === 'POST') {
    if ($currentUser['role'] !== 'admin') {
        jsonRes(['success' => false, 'message' => 'Akses ditolak: Hanya Administrator yang dapat menghapus mahasiswa dari angkatan.'], 403);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $mahasiswa_id = validatePositiveNumber($input['mahasiswa_id'] ?? 0, 'ID Mahasiswa');

    if ($db_connected && $pdo) {
        try {
            $stmt = $pdo->prepare("UPDATE users SET angkatan_id = NULL, angkatan = NULL WHERE id = :id AND role = 'mahasiswa'");
            $stmt->execute(['id' => $mahasiswa_id]);

            if ($stmt->rowCount() > 0) {
                jsonRes(['success' => true, 'message' => 'Mahasiswa berhasil dikeluarkan dari angkatan.']);
            } else {
                jsonRes(['success' => false, 'message' => 'Mahasiswa tidak ditemukan atau bukan mahasiswa.'], 404);
            }
        } catch (PDOException $e) {
            jsonRes(['success' => false, 'message' => 'Gagal mengeluarkan mahasiswa: ' . $e->getMessage()], 500);
        }
    }

    jsonRes(['success' => false, 'message' => 'Koneksi database tidak aktif.'], 500);
}

jsonRes(['success' => false, 'message' => 'Aksi API tidak valid atau metode tidak didukung.'], 404);
?>
