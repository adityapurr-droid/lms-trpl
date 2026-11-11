/**
 * app.js - Logika Interaktif LMS Prodi TRPL Politeknik Citra Widya Edukasi (CWE)
 * 
 * AUDIT KEAMANAN & FITUR LENGKAP:
 * 1. Manajemen Pengguna (CRUD Penuh Admin terintegrasi Database MySQL via Prepared Statements).
 * 2. Filter, Pencarian Real-Time, & Paginasi untuk Pengguna dan Tugas.
 * 3. Validasi Lengkap Frontend & Backend (Email regex, limit panjang karakter, angka positif).
 * 4. Penanganan Error (Error Handling) Ramah Pengguna tanpa blank page / crash.
 * 5. Proteksi Rute & Hak Akses Berbasis Peran (RBAC: Admin, Dosen, Mahasiswa).
 * 6. Identitas Resmi & Logo Kampus Politeknik Citra Widya Edukasi (CWE).
 */

// ==========================================
// STATE UTAMA APLIKASI
// ==========================================
let appData = {
    currentUser: window.AUTH_USER || null,
    semesterAktif: "",
    dbConnected: window.DB_STATUS ? window.DB_STATUS.connected : false,
    dbError: window.DB_STATUS ? window.DB_STATUS.error : null,
    users: [],
    dosenList: [],
    semesters: [],
    mataKuliah: [],
    kelasList: [],
    angkatanList: [],
    angkatanSemesterList: [],
    materi: [],
    tugas: []
};

// Filter & Paginasi Manajemen Kelas - Angkatan (Admin)
let angkatanFilter = {
    search: "",
    page: 1,
    perPage: 8
};

// Filter & Paginasi Manajemen Kelas (Admin & Dosen)
let classFilter = {
    search: "",
    angkatan: "all",
    semesterId: "all",
    page: 1,
    perPage: 6
};

// Filter & Paginasi Tugas
let assignmentFilter = {
    search: "",
    matkulId: "all",
    status: "all",
    page: 1,
    perPage: 3
};

// Filter & Paginasi Manajemen Pengguna (Admin)
let userFilter = {
    search: "",
    role: "all",
    angkatan: "all",
    page: 1,
    perPage: 5
};

// Filter Mata Kuliah
let courseFilter = {
    search: "",
    semester: "all",
    angkatan: "all",
    page: 1,
    perPage: 6
};

// Filter Manajemen Materi Kuliah (Dosen)
let materiFilter = {
    semester: "all"
};

// Filter Modul Jadwal Kuliah (Semua Role)
let scheduleFilter = {
    semesterId: "all",
    angkatan: "all",
    dosen: "all",
    ruangan: "all"
};

// ==========================================
// HELPERS PENJADWALAN KELAS TERINTEGRASI
// (Satu sumber kebenaran format jadwal di seluruh sistem)
// ==========================================
const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function getHariIni() {
    try {
        return new Date().toLocaleDateString('id-ID', { weekday: 'long' });
    } catch (e) {
        return '';
    }
}

// Dukung field terstruktur (jam_mulai/jam_selesai) maupun format lama "08:00 - 10:30"
function parseJamKelas(kelas) {
    if (!kelas) return null;
    if (kelas.jam_mulai && kelas.jam_selesai) {
        const mulai = String(kelas.jam_mulai).slice(0, 5);
        const selesai = String(kelas.jam_selesai).slice(0, 5);
        if (/^\d{2}:\d{2}$/.test(mulai) && /^\d{2}:\d{2}$/.test(selesai)) {
            return { mulai, selesai };
        }
    }
    const m = String(kelas.jam || '').match(/(\d{1,2}):(\d{2})\s*[-\u2013]\s*(\d{1,2}):(\d{2})/);
    if (m) {
        return {
            mulai: `${m[1].padStart(2, '0')}:${m[2]}`,
            selesai: `${m[3].padStart(2, '0')}:${m[4]}`
        };
    }
    return null;
}

function toMinutes(hhmm) {
    const parts = String(hhmm).split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function formatJamKelas(kelas) {
    const j = parseJamKelas(kelas);
    return j ? `${j.mulai}\u2013${j.selesai} WIB` : null;
}

function formatJadwal(kelas) {
    if (!kelas) return null;
    const jam = formatJamKelas(kelas);
    if (kelas.hari && jam) return `${kelas.hari}, ${jam}`;
    if (kelas.hari) return `${kelas.hari} (jam belum diatur)`;
    return null;
}

// Baris info jadwal & ruangan seragam untuk seluruh tampilan.
// opts: { variant: 'light' | 'dark', showRuangan: bool }
function renderJadwalInfoBar(kelas, opts = {}) {
    const variant = opts.variant || 'light';
    const iconCls = variant === 'dark' ? 'text-maroon-400' : 'text-slate-400';
    const txtCls = variant === 'dark' ? 'text-slate-300' : 'text-slate-600';
    const showRuangan = opts.showRuangan !== false;

    const jadwalTxt = formatJadwal(kelas);
    const ruangTxt = kelas && kelas.ruangan ? String(kelas.ruangan).trim() : '';

    const jadwalEl = jadwalTxt
        ? `<span class="${txtCls}"><i class="fa-regular fa-clock mr-1 ${iconCls}"></i> ${jadwalTxt}</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><i class="fa-solid fa-calendar-exclamation mr-1"></i> Belum Terjadwal</span>`;

    const ruangEl = showRuangan
        ? (ruangTxt
            ? `<span class="${txtCls}"><i class="fa-solid fa-location-dot mr-1 ${iconCls}"></i> ${ruangTxt}</span>`
            : `<span class="${txtCls} italic"><i class="fa-solid fa-location-dot mr-1 ${iconCls}"></i> Ruangan belum diatur</span>`)
        : '';

    return `${jadwalEl}${ruangEl ? ' ' + ruangEl : ''}`;
}

// Deteksi bentrok jadwal sisi klien (validasi final tetap di server).
// Bentrok = hari sama + jam overlap pada semester sama dengan dosen sama,
// ruangan sama, atau angkatan sama.
function detectScheduleConflicts(kelasList) {
    const list = (kelasList || []).filter(k => k && k.hari && parseJamKelas(k));
    const conflicts = [];
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
            const a = list[i], b = list[j];
            if (String(a.hari) !== String(b.hari)) continue;
            if (Number(a.semester_id || 0) !== Number(b.semester_id || 0)) continue;
            const ja = parseJamKelas(a), jb = parseJamKelas(b);
            if (!ja || !jb) continue;
            const overlap = toMinutes(ja.mulai) < toMinutes(jb.selesai) && toMinutes(jb.mulai) < toMinutes(ja.selesai);
            if (!overlap) continue;
            let tipe = null;
            if (Number(a.dosen_id) === Number(b.dosen_id)) {
                tipe = 'dosen sama';
            } else if (String(a.ruangan || '').trim().toLowerCase() && String(a.ruangan || '').trim().toLowerCase() === String(b.ruangan || '').trim().toLowerCase()) {
                tipe = 'ruangan sama';
            } else if (a.angkatan_id && Number(a.angkatan_id) === Number(b.angkatan_id)) {
                tipe = 'angkatan sama';
            }
            if (tipe) conflicts.push({ tipe, a, b });
        }
    }
    return conflicts;
}

// Kelas yang relevan untuk penjadwalan sesuai role:
// admin = semua, dosen = kelas yang diampu, mahasiswa = enrolmen / angkatan.
function getJadwalScopeKelas() {
    const user = appData.currentUser || {};
    const all = appData.kelasList || [];
    if (user.role === 'dosen') {
        return all.filter(k => Number(k.dosen_id) === Number(user.id));
    }
    if (user.role === 'mahasiswa') {
        const fullUser = (appData.users || []).find(u => Number(u.id) === Number(user.id)) || user;
        const myAngkatanId = fullUser.angkatan_id || user.angkatan_id || null;
        return all.filter(k =>
            (k.mahasiswa || []).some(m => Number(m.id) === Number(user.id)) ||
            (myAngkatanId && k.angkatan_id && Number(k.angkatan_id) === Number(myAngkatanId))
        );
    }
    return all;
}

// Widget "Jadwal Hari Ini" — komponen & posisi seragam di dashboard semua role.
function renderJadwalHariIniWidget(role, opts = {}) {
    const compact = !!opts.compact;
    const batasSesi = compact ? 3 : 4;
    const hariIni = getHariIni();
    const scoped = getJadwalScopeKelas();
    const sesi = scoped
        .filter(k => String(k.hari || '') === String(hariIni) && parseJamKelas(k))
        .sort((a, b) => toMinutes(parseJamKelas(a).mulai) - toMinutes(parseJamKelas(b).mulai));

    const terjadwal = scoped.filter(k => k.hari && parseJamKelas(k)).length;
    const belum = scoped.length - terjadwal;
    const konflik = detectScheduleConflicts(scoped);
    const konflikIds = new Set();
    konflik.forEach(c => { konflikIds.add(Number(c.a.id)); konflikIds.add(Number(c.b.id)); });

    const judul = role === 'admin' ? 'Jadwal Perkuliahan Hari Ini'
        : role === 'dosen' ? 'Jadwal Mengajar Hari Ini'
            : 'Jadwal Kuliah Hari Ini';
    const tanggalIndo = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm ${compact ? 'p-4' : 'p-5'} space-y-4 h-full flex flex-col">
        <div class="flex items-start justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-9 h-9 rounded-xl bg-maroon-50 text-maroon-600 flex items-center justify-center shrink-0">
                    <i class="fa-solid fa-table-cells"></i>
                </div>
                <div class="min-w-0">
                    <h2 class="text-sm font-bold text-slate-800">${judul}</h2>
                    <p class="text-[11px] text-slate-400">${tanggalIndo}</p>
                </div>
            </div>
            <button onclick="setTab('schedule')" class="text-xs font-semibold text-maroon-600 hover:underline shrink-0">
                ${compact ? 'Jadwal Lengkap' : 'Buka Jadwal Lengkap'} &rarr;
            </button>
        </div>

        ${role === 'admin' ? `
        <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                ${terjadwal} kelas terjadwal
            </span>
            ${belum > 0 ? `
            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                ${belum} belum terjadwal
            </span>` : ''}
            ${konflik.length > 0 ? `
            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                <i class="fa-solid fa-triangle-exclamation mr-1"></i> ${konflik.length} bentrok terdeteksi
            </span>` : ''}
        </div>` : ''}

        ${sesi.length === 0 ? `
        <p class="text-xs text-slate-400 italic py-3 text-center flex-1 flex items-center justify-center">Tidak ada perkuliahan terjadwal untuk hari ini.</p>
        ` : `
        <div class="space-y-2 flex-1">
            ${sesi.slice(0, batasSesi).map(k => {
        const jam = parseJamKelas(k);
        const bentrok = konflikIds.has(Number(k.id));
        return `
            <div class="flex items-center justify-between gap-3 ${compact ? 'p-2.5' : 'p-3'} rounded-xl border ${bentrok ? 'border-rose-200 bg-rose-50/50' : 'border-slate-100 bg-slate-50'} text-xs">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="font-mono font-bold text-maroon-700 shrink-0">${jam.mulai}&ndash;${jam.selesai}</span>
                    <div class="min-w-0">
                        <span class="font-bold text-slate-800 block truncate">${k.nama_mk || 'Mata Kuliah'} ${k.kode_mk ? `<span class="font-mono font-normal text-slate-400">(${k.kode_mk})</span>` : ''}</span>
                        <span class="text-[11px] text-slate-500 block truncate">${role === 'dosen' ? (k.nama_kelas || '-') : (k.dosen_nama || '')} &bull; ${k.ruangan || 'Ruangan belum diatur'}</span>
                    </div>
                </div>
                ${bentrok ? '<i class="fa-solid fa-triangle-exclamation text-rose-500 shrink-0" title="Jadwal bentrok"></i>' : ''}
            </div>`;
    }).join("")}
            ${sesi.length > batasSesi ? `<p class="text-[11px] text-slate-400 text-center">+${sesi.length - batasSesi} sesi lainnya tersedia di jadwal lengkap</p>` : ''}
        </div>`}
    </div>
    `;
}

function getActiveSemester() {
    return (appData.semesters || []).find(s => Number(s.is_aktif) === 1) || null;
}

function getAngkatanSemesterMapping(angkatanId, semesterId) {
    const active = getActiveSemester();
    const sid = semesterId != null ? Number(semesterId) : (active ? Number(active.id) : 0);
    if (!sid) return null;
    return (appData.angkatanSemesterList || []).find(m =>
        Number(m.angkatan_id) === Number(angkatanId) &&
        Number(m.semester_id) === sid
    ) || null;
}


// Turunkan semester paket dari kelas yang sudah dibuka bila mapping belum tersedia.
// Dipakai agar informasi kelas tetap tampil meski relasi angkatan-semester belum dibuat.
function getAngkatanPaketFromKelas(angkatanId) {
    const active = getActiveSemester();
    const all = (appData.kelasList || []).filter(k => Number(k.angkatan_id) === Number(angkatanId));
    const scoped = active ? all.filter(k => Number(k.semester_id) === Number(active.id)) : all;
    const source = scoped.length ? scoped : all;
    const counts = new Map();
    source.forEach(k => {
        const paket = Number(k.semester_paket);
        if (paket >= 1 && paket <= 8) counts.set(paket, (counts.get(paket) || 0) + 1);
    });
    if (!counts.size) return null;
    return Number([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]);
}


function refreshAngkatanSemesterCache() {
    const active = getActiveSemester();
    (appData.angkatanList || []).forEach(ang => {
        const mapping = active ? getAngkatanSemesterMapping(ang.id, active.id) : null;
        ang.semester_id = mapping ? mapping.semester_id : null;
        ang.semester_nama = mapping ? mapping.semester_nama : null;
        ang.semester_paket = mapping ? mapping.semester_paket : null;
    });
}

// State Sidebar (collapse desktop / drawer mobile)
let sidebarState = {
    collapsed: false,
    mobileOpen: false
};
try {
    sidebarState.collapsed = localStorage.getItem("lmsSidebarCollapsed") === "1";
} catch (e) { }

function isMobileViewport() {
    return window.innerWidth < 768;
}

function toggleSidebar() {
    if (isMobileViewport()) {
        sidebarState.mobileOpen = !sidebarState.mobileOpen;
    } else {
        sidebarState.collapsed = !sidebarState.collapsed;
        try {
            localStorage.setItem("lmsSidebarCollapsed", sidebarState.collapsed ? "1" : "0");
        } catch (e) { }
    }
    applySidebarState();
}

function closeSidebar() {
    sidebarState.mobileOpen = false;
    applySidebarState();
}

function applySidebarState() {
    const aside = document.getElementById("app-sidebar");
    if (aside) {
        aside.classList.toggle("translate-x-0", sidebarState.mobileOpen);
        aside.classList.toggle("-translate-x-full", !sidebarState.mobileOpen);
        aside.classList.toggle("md:w-20", sidebarState.collapsed);
        aside.classList.toggle("md:w-64", !sidebarState.collapsed);
    }

    const overlay = document.getElementById("sidebar-overlay");
    if (overlay) overlay.classList.toggle("hidden", !sidebarState.mobileOpen);

    document.querySelectorAll("[data-sidebar-text]").forEach(el => {
        el.classList.toggle("md:hidden", sidebarState.collapsed);
    });

    document.querySelectorAll("[data-sidebar-center]").forEach(el => {
        el.classList.toggle("md:justify-center", sidebarState.collapsed);
    });

    const icon = document.getElementById("sidebar-toggle-icon");
    if (icon) {
        icon.className = sidebarState.collapsed
            ? "fa-solid fa-bars-staggered"
            : "fa-solid fa-bars";
    }
}

window.addEventListener("resize", function () {
    if (!isMobileViewport() && sidebarState.mobileOpen) {
        sidebarState.mobileOpen = false;
        applySidebarState();
    }
});

window.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        if (sidebarState.mobileOpen) closeSidebar();
        const modal = document.getElementById("modal-container");
        if (modal && modal.innerHTML.trim()) closeModal();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const searchInput = document.querySelector('input[type="text"], input[type="search"]');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }
});

// ==========================================
// UI UX HELPER (SKELETON & EMPTY STATE)
// ==========================================
function renderSkeletonLoader(rows = 3) {
    let html = '<div class="space-y-3 animate-pulse">';
    for (let i = 0; i < rows; i++) {
        html += `<div class="h-14 bg-slate-200/80 rounded-xl w-full"></div>`;
    }
    html += '</div>';
    return html;
}

function renderEmptyState(icon = "fa-folder-open", title = "Belum ada data", description = "Data akan muncul di sini setelah ditambahkan.") {
    return `
        <div class="text-center py-12 px-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div class="w-16 h-16 bg-maroon/5 text-maroon rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner">
                <i class="fa-solid ${icon}"></i>
            </div>
            <h3 class="text-base font-bold text-slate-800 mb-1">${title}</h3>
            <p class="text-xs text-slate-500 max-w-sm mx-auto">${description}</p>
        </div>
    `;
}

document.addEventListener("click", function (event) {
    const modal = document.getElementById("modal-container");
    if (modal && event.target === modal.firstElementChild) closeModal();
});

let currentTab = "dashboard";

// ==========================================
// VALIDATOR HELPER (FRONTEND AUDIT)
// ==========================================
const Validator = {
    isValidEmail: (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).trim().toLowerCase()) && email.length <= 100;
    },
    isPositiveNumber: (num) => {
        return !isNaN(num) && Number(num) > 0;
    },
    isValidScore: (score) => {
        return !isNaN(score) && Number(score) >= 0 && Number(score) <= 100;
    },
    isValidLength: (str, min, max) => {
        const len = (str || '').trim().length;
        return len >= min && len <= max;
    }
};

// ==========================================
// AVATAR & FOTO HELPER
// ==========================================
function getUserAvatar(user, sizeClass = "w-10 h-10 text-sm", roundedClass = "rounded-xl") {
    if (!user) return `<div class="${sizeClass} ${roundedClass} bg-slate-200 text-slate-500 font-bold flex items-center justify-center shrink-0"><i class="fa-solid fa-user"></i></div>`;
    const initial = (user.nama || 'U').charAt(0).toUpperCase();
    if (user.foto && user.foto !== 'default.png') {
        const v = user.foto_version || '';
        return `<img src="uploads/avatars/${user.foto}${v ? '?v=' + v : ''}" alt="${user.nama}" class="${sizeClass} ${roundedClass} object-cover border border-slate-200/80 shadow-xs shrink-0" onerror="this.onerror=null; this.outerHTML='<div class=&quot;${sizeClass} ${roundedClass} bg-maroon text-white font-bold flex items-center justify-center shrink-0 shadow-xs&quot;>${initial}</div>';">`;
    }
    return `<div class="${sizeClass} ${roundedClass} bg-maroon text-white font-bold flex items-center justify-center shrink-0 shadow-xs">${initial}</div>`;
}

// ==========================================
// KELAS & ANGKATAN HELPER
// ==========================================
function getAngkatanFromKelas(namaKelas) {
    if (!namaKelas) return "Lainnya";
    const match = namaKelas.match(/20(\d{2})|(\d{2})/);
    if (match) {
        const yr = match[1] || match[2];
        return "20" + yr;
    }
    return "Umum";
}

function getKelasAngkatanNama(kelas) {
    if (!kelas) return "Umum";
    if (kelas.angkatan_nama) return kelas.angkatan_nama;
    const angkatan = (appData.angkatanList || []).find(a => Number(a.id) === Number(kelas.angkatan_id));
    if (angkatan) return angkatan.nama_angkatan;
    return getAngkatanFromKelas(kelas.nama_kelas);
}

function getUniqueMataKuliah() {
    const unique = new Map();
    (appData.mataKuliah || []).forEach(mk => {
        const key = Number(mk.id);
        if (!unique.has(key)) unique.set(key, mk);
    });
    return Array.from(unique.values());
}

// Ambil seluruh kelas yang benar-benar dibuka untuk sebuah mata kuliah
function getKelasByMatkul(mkId) {
    return (appData.kelasList || []).filter(k => Number(k.mata_kuliah_id) === Number(mkId));
}

// Menormalkan nama angkatan menjadi label kelas, contoh: "Angkatan 2026 A" -> "2026 A"
function getAngkatanDisplayLabel(namaAngkatan, tahun) {
    const raw = String(namaAngkatan || '').trim();
    if (raw) {
        let match = raw.match(/((?:19|20)\d{2})\s*([A-Z])?(?![A-Za-z])/i);
        if (match) {
            return match[2] ? `${match[1]} ${match[2].toUpperCase()}` : match[1];
        }
        // Format lama seperti "TRPL 26 A" / "TRPL-26A" -> "2026 A"
        match = raw.match(/TRPL\s*[-]?\s*(\d{2})(?:\s*[-]?\s*([A-Z]))?/i);
        if (match) {
            return match[2] ? `20${match[1]} ${match[2].toUpperCase()}` : `20${match[1]}`;
        }
    }
    if (tahun) {
        const letter = raw.match(/([A-Z])$/i);
        return letter ? `${tahun} ${letter[1].toUpperCase()}` : String(tahun);
    }
    return '';
}

// Mengambil data angkatan milik mahasiswa yang sedang login
function getMahasiswaAngkatanRecord() {
    const user = appData.currentUser || {};
    const fullUser = (appData.users || []).find(u => Number(u.id) === Number(user.id)) || user;
    const angkatanId = fullUser.angkatan_id || user.angkatan_id || null;

    if (angkatanId) {
        const angkatan = (appData.angkatanList || []).find(a => Number(a.id) === Number(angkatanId));
        if (angkatan) return angkatan;
    }

    const angkatanNama = String(fullUser.angkatan || user.angkatan || '').trim().toLowerCase();
    if (angkatanNama) {
        const angkatan = (appData.angkatanList || []).find(a => String(a.nama_angkatan || '').trim().toLowerCase() === angkatanNama);
        if (angkatan) return angkatan;
    }

    return null;
}

// Label kelas mahasiswa yang login, contoh: "2026 A" / "2026 B"
function getMahasiswaKelasLabel() {
    const angkatan = getMahasiswaAngkatanRecord();
    if (angkatan) {
        const label = getAngkatanDisplayLabel(angkatan.nama_angkatan, angkatan.tahun);
        if (label) return label;
    }

    // Fallback: cari kelas yang terhubung ke angkatan mahasiswa
    const user = appData.currentUser || {};
    const fullUser = (appData.users || []).find(u => Number(u.id) === Number(user.id)) || user;
    const angkatanId = fullUser.angkatan_id || user.angkatan_id || null;
    if (angkatanId) {
        const kelas = (appData.kelasList || []).find(k => Number(k.angkatan_id) === Number(angkatanId));
        if (kelas) {
            const label = getAngkatanDisplayLabel(kelas.angkatan_nama, kelas.angkatan_tahun);
            if (label) return label;
        }
    }

    return '';
}

function getKelasDisplayName(kelas) {
    if (!kelas) {
        return (appData.currentUser && appData.currentUser.role === 'mahasiswa') ? getMahasiswaKelasLabel() : '';
    }

    const angkatan = (appData.angkatanList || []).find(a => Number(a.id) === Number(kelas.angkatan_id));
    const angkatanNama = kelas.angkatan_nama || (angkatan ? angkatan.nama_angkatan : '');
    const angkatanTahun = kelas.angkatan_tahun || (angkatan ? angkatan.tahun : '');

    let label = getAngkatanDisplayLabel(angkatanNama, angkatanTahun);
    if (label) return label;

    label = getAngkatanDisplayLabel(kelas.nama_kelas, '');
    if (label) return label;

    // Jangan pernah tampilkan nama kelas lama seperti "TRPL-1A" untuk mahasiswa.
    if (appData.currentUser && appData.currentUser.role === 'mahasiswa') {
        return getMahasiswaKelasLabel();
    }

    return String(kelas.nama_kelas || '').trim();
}

function getKelasAngkatanTahun(kelas) {
    if (!kelas) return "";
    if (kelas.angkatan_tahun) return String(kelas.angkatan_tahun);
    const angkatan = (appData.angkatanList || []).find(a => Number(a.id) === Number(kelas.angkatan_id));
    if (angkatan && angkatan.tahun) return String(angkatan.tahun);
    const fallback = getAngkatanFromKelas(kelas.nama_kelas);
    return /^\d{4}$/.test(fallback) ? fallback : "";
}

function formatKelasDisplay(kelas) {
    if (!kelas) return "Kelas Tidak Ditemukan";
    
    const angkatanNama = getKelasAngkatanNama(kelas);
    const angkatanTahun = getKelasAngkatanTahun(kelas);
    const semesterPaket = kelas.semester_paket || '-';
    const namaMk = kelas.nama_mk || kelas.nama || 'Mata Kuliah';
    
    let angkatanLabel = "";
    
    if (angkatanTahun) {
        angkatanLabel = angkatanTahun;
    }
    
    if (angkatanNama && angkatanNama !== 'Umum' && angkatanNama !== 'Lainnya') {
        const match = angkatanNama.match(/(\d{4})\s*([A-Z])?/i);
        if (match) {
            angkatanLabel = match[1];
            if (match[2]) {
                angkatanLabel += ' ' + match[2].toUpperCase();
            }
        }
    }
    
    const prefix = angkatanLabel ? `${angkatanLabel} ` : "";
    return `${prefix}Semester ${semesterPaket} - ${namaMk}`;
}

function getAngkatanFromNIM(nim) {
    if (!nim) return "Lainnya";
    const s = String(nim).trim();
    if (s.startsWith("2024") || s.startsWith("24")) return "2024";
    if (s.startsWith("2025") || s.startsWith("25")) return "2025";
    if (s.startsWith("2023") || s.startsWith("23")) return "2023";
    return "Lainnya";
}

// ==========================================
// INISIALISASI & FETCH BACKEND
// ==========================================
function applyBootstrapData(result) {
    if (!result || !result.success) return;

    if (result.currentUser) appData.currentUser = result.currentUser;
    appData.dbConnected = !!result.db_connected;
    appData.dosenList = (result.dosenList && result.dosenList.length) ? result.dosenList : [];
    if (result.activeSemester) {
        appData.semesterAktif = result.activeSemester;
    } else {
        // Tidak ada semester aktif di DB: tampilkan status jujur, bukan nama semester karangan.
        const activeSem = (result.semesters || []).find(s => Number(s.is_aktif) === 1);
        appData.semesterAktif = activeSem ? activeSem.nama : 'Belum ada semester aktif';
    }
    if (result.semesters) appData.semesters = result.semesters;

    appData.users = result.users || [];
    appData.mataKuliah = result.mataKuliah || [];
    appData.kelasList = result.kelasList || [];
    appData.angkatanList = result.angkatanList || [];
    appData.angkatanSemesterList = result.angkatanSemesterList || [];
    appData.materi = result.materi || [];
    appData.tugas = result.tugas || [];

    if (!appData.dosenList.length && appData.users.length) {
        appData.dosenList = appData.users.filter(u => u.role === 'dosen');
    }
}

/**
 * Menyegarkan seluruh data dari server tanpa reload halaman.
 * Tab/menu yang sedang aktif tetap dipertahankan agar update terasa realtime.
 */
async function loadAppData(options = {}) {
    try {
        const response = await fetch("api.php?action=get_bootstrap_data", { cache: "no-store" });
        if (response.status === 401) {
            window.location.href = "login.php";
            return false;
        }
        if (!response.ok) return false;

        const result = await response.json();
        if (!result.success) return false;

        applyBootstrapData(result);
        if (options.render !== false) renderApp();
        return true;
    } catch (e) {
        console.warn("Gagal menyegarkan data dari API:", e);
        return false;
    }
}

async function initAppData() {
    if (!appData.currentUser) {
        window.location.href = "login.php";
        return;
    }

    // Render tampilan awal secara instan (mencegah blank screen saat fetch)
    renderApp();

    await loadAppData({ render: false });

    renderApp();
}

function setTab(tabName) {
    const role = appData.currentUser ? appData.currentUser.role : '';
    if ((tabName === 'users' || tabName === 'courses' || tabName === 'semesters' || tabName === 'settings') && role !== 'admin') {
        showToast("Akses Ditolak: Menu ini hanya dapat diakses oleh Administrator!", "error");
        return;
    }
    if (tabName === 'classes' && role !== 'admin' && role !== 'dosen') {
        showToast("Akses Ditolak: Menu ini hanya dapat diakses oleh Administrator dan Dosen!", "error");
        return;
    }

    currentTab = tabName;
    if (isMobileViewport()) {
        sidebarState.mobileOpen = false;
    }
    renderApp();
}

function logout() {
    window.location.href = "logout.php";
}

// ==========================================
// TOAST NOTIFIKASI
// ==========================================
function showToast(message, type = "success") {
    const toastContainer = document.getElementById("toast-container");
    if (!toastContainer) return;

    const config = {
        success: { bg: "bg-emerald-600 text-white shadow-emerald-500/20", icon: "fa-circle-check", title: "Berhasil" },
        error: { bg: "bg-rose-600 text-white shadow-rose-500/20", icon: "fa-circle-exclamation", title: "Terjadi Kesalahan" },
        info: { bg: "bg-maroon-600 text-white shadow-maroon-500/20", icon: "fa-circle-info", title: "Informasi" }
    }[type] || { bg: "bg-slate-800 text-white", icon: "fa-bell", title: "Pemberitahuan" };

    const toast = document.createElement("div");
    toast.className = `pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-xl text-xs font-medium transition-all transform duration-300 translate-y-3 opacity-0 ${config.bg} max-w-sm border border-white/10`;
    toast.innerHTML = `
        <i class="fa-solid ${config.icon} text-base shrink-0 mt-0.5"></i>
        <div class="flex-1">
            <span class="font-bold block uppercase tracking-wider text-[10px] opacity-80">${config.title}</span>
            <span class="leading-relaxed mt-0.5 block">${message}</span>
        </div>
        <button onclick="this.parentElement.remove()" class="text-white/70 hover:text-white shrink-0 p-1">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.remove("translate-y-3", "opacity-0"), 15);
    setTimeout(() => {
        toast.classList.add("opacity-0", "translate-y-3");
        setTimeout(() => toast.remove(), 350);
    }, 4000);
}

// ==========================================
// DOWNLOAD BERKAS NYATA
// ==========================================
function downloadFile(filename, dataUrl, defaultDescription = "") {
    showToast(`Memulai proses pengunduhan: "${filename}"...`, "info");

    let downloadUrl = dataUrl;
    let isCreatedBlob = false;

    // Jika dataUrl adalah relative path (misal uploads/submissions/xxx.pdf), gunakan langsung
    if (!downloadUrl || (!downloadUrl.startsWith("data:") && !downloadUrl.startsWith("uploads/"))) {
        const dummyText = `========================================================\n` +
            `POLITEKNIK CITRA WIDYA EDUKASI (CWE)\n` +
            `PROGRAM STUDI TEKNOLOGI REKAYASA PERANGKAT LUNAK (TRPL)\n` +
            `========================================================\n\n` +
            `Nama Berkas : ${filename}\n` +
            `Waktu Unduh : ${new Date().toLocaleString('id-ID')}\n` +
            `Keterangan  : ${defaultDescription || 'Dokumen resmi LMS TRPL Politeknik CWE'}\n\n` +
            `--------------------------------------------------------\n` +
            `Tanggap, Tanggon, Trengginas\n`;

        const blob = new Blob([dummyText], { type: "text/plain;charset=utf-8" });
        downloadUrl = URL.createObjectURL(blob);
        isCreatedBlob = true;
    }

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (isCreatedBlob) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }

    setTimeout(() => {
        showToast(`Berkas "${filename}" berhasil diunduh ke komputer Anda!`, "success");
    }, 500);
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return "0 KB";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function checkDeadlineStatus(deadlineStr) {
    const deadlineTime = new Date(deadlineStr).getTime();
    return deadlineTime < new Date().getTime() ? "expired" : "active";
}

function formatDeadlineDisplay(deadlineStr) {
    try {
        const d = new Date(deadlineStr);
        return d.toLocaleDateString("id-ID", {
            weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
        });
    } catch (e) {
        return deadlineStr;
    }
}

// ==========================================
// RENDER UTAMA
// ==========================================
function renderApp() {
    const root = document.getElementById("app-root");
    if (!root) return;

    if (!appData.currentUser) {
        window.location.href = "login.php";
        return;
    }

    const activeEl = document.activeElement;
    const focusId = activeEl && activeEl.id ? activeEl.id : null;
    const selStart = activeEl && typeof activeEl.selectionStart === "number" ? activeEl.selectionStart : null;
    const selEnd = activeEl && typeof activeEl.selectionEnd === "number" ? activeEl.selectionEnd : null;

    root.innerHTML = `
        <div class="flex h-screen bg-slate-50 overflow-hidden font-sans">
            <!-- Sidebar dengan Logo Kampus CWE -->
            ${renderSidebar()}
            
            <!-- Main Content Area -->
            <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
                <!-- Top Navbar -->
                ${renderTopNavbar()}
                
                <!-- Main Body -->
                <main class="flex-1 overflow-y-auto p-4 md:p-8">
                    <div class="max-w-7xl mx-auto space-y-6">
                        <!-- Banner Peringatan jika Database Belum Aktif -->
                        ${!appData.dbConnected ? renderDbAlertBanner() : ''}
                        
                        ${renderMainContent()}
                    </div>
                </main>
            </div>
        </div>

        <div id="modal-container"></div>
    `;

    if (focusId) {
        const focusEl = document.getElementById(focusId);
        if (focusEl) {
            focusEl.focus();
            if (selStart !== null && typeof focusEl.setSelectionRange === "function") {
                try {
                    focusEl.setSelectionRange(selStart, selEnd);
                } catch (e) { }
            }
        }
    }

    applySidebarState();
}

function renderDbAlertBanner() {
    return `
    <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 shadow-xs flex items-start gap-3.5">
        <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 text-lg">
            <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div class="flex-1 text-xs">
            <div class="flex items-center justify-between">
                <h4 class="font-bold text-amber-900 text-sm">Pemberitahuan Basis Data MySQL</h4>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-800">Mode Mandiri</span>
            </div>
            <p class="mt-1 text-amber-800 leading-relaxed">
                Basis data MySQL di Laragon belum terhubung (port 3306). Operasi CRUD saat ini disinkronkan secara aman di memori lokal.
            </p>
            <div class="mt-2.5 pt-2 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span class="text-[11px] text-amber-700">
                    Buka <strong>Laragon</strong> lalu klik <strong>Start All</strong> dan import <code>database.sql</code>.
                </span>
                <a href="cek_koneksi.php" class="px-3 py-1 bg-amber-200 hover:bg-amber-300 rounded-lg font-semibold text-[11px] text-amber-900 transition inline-flex items-center gap-1.5 shrink-0">
                    <i class="fa-solid fa-rotate"></i> Cek Koneksi Ulang
                </a>
            </div>
        </div>
    </div>
    `;
}

// Sidebar dengan Logo Kampus CWE
function renderSidebar() {
    const user = appData.currentUser;
    const role = user.role;

    const roleColor = {
        admin: "bg-rose-500 text-white",
        dosen: "bg-blue-600 text-white",
        mahasiswa: "bg-emerald-600 text-white"
    }[role] || "bg-slate-600 text-white";

    const menuItems = {
        admin: [
            { id: "dashboard", label: "Dashboard", icon: "fa-chart-pie" },
            { id: "users", label: "Manajemen Pengguna", icon: "fa-users-gear", badge: appData.users.length || 0 },
            { id: "classes", label: "Manajemen Kelas", icon: "fa-users-line", badge: (appData.angkatanList || []).length || 0 },
            { id: "schedule", label: "Jadwal Kuliah", icon: "fa-table-cells", badge: getJadwalScopeKelas().filter(k => k.hari && parseJamKelas(k)).length },
            { id: "courses", label: "Manajemen Matakuliah", icon: "fa-book-bookmark", badge: getUniqueMataKuliah().length || 0 },
            { id: "semesters", label: "Manajemen Semester", icon: "fa-calendar-days", badge: (appData.semesters || []).length || 0 },
            { id: "settings", label: "Pengaturan Sistem", icon: "fa-sliders" }
        ],
        dosen: [
            { id: "dashboard", label: "Dashboard Dosen", icon: "fa-chart-pie" },
            { id: "schedule", label: "Jadwal Mengajar", icon: "fa-table-cells", badge: getJadwalScopeKelas().filter(k => k.hari && parseJamKelas(k)).length },
            { id: "classes", label: "Jadwal & Kelas Saya", icon: "fa-chalkboard-user", badge: (appData.kelasList || []).filter(k => Number(k.dosen_id) === Number(user.id)).length },
            { id: "assignments", label: "Manajemen Tugas", icon: "fa-clipboard-check", badge: (appData.tugas || []).length },
            { id: "materials", label: "Manajemen Materi Kuliah", icon: "fa-file-arrow-up", badge: (appData.materi || []).length }
        ],
        mahasiswa: [
            { id: "dashboard", label: "Dashboard Mahasiswa", icon: "fa-chart-pie" },
            { id: "schedule", label: "Jadwal Kuliah Saya", icon: "fa-table-cells", badge: getJadwalScopeKelas().filter(k => k.hari && parseJamKelas(k)).length },
            { id: "assignments", label: "Tugas Kuliah", icon: "fa-list-check", badge: (appData.tugas || []).length },
            { id: "my-courses", label: "Mata Kuliah Saya", icon: "fa-graduation-cap", badge: (appData.mataKuliah || []).length },
            { id: "my-grades", label: "Transkrip Nilai Saya", icon: "fa-award" }
        ]
    }[role] || [];

    return `
    <div id="sidebar-overlay" onclick="closeSidebar()" class="${sidebarState.mobileOpen ? '' : 'hidden'} fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden"></div>

    <aside id="app-sidebar"
        class="bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 z-50
               fixed md:static inset-y-0 left-0
               w-64 ${sidebarState.collapsed ? 'md:w-20' : 'md:w-64'}
               transition-all duration-300 ease-in-out
               ${sidebarState.mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0">
        <div class="h-20 flex items-center px-5 border-b border-slate-800 gap-3 bg-slate-950/40 ${sidebarState.collapsed ? 'md:justify-center md:px-2' : ''}">
            <img src="assets/logo-cwe.png" alt="Logo Politeknik Citra Widya Edukasi" class="h-11 w-auto object-contain bg-white rounded-lg p-1 shadow-sm shrink-0">
            <div class="min-w-0" data-sidebar-text>
                <h2 class="text-xs font-bold text-white tracking-tight leading-tight truncate">POLITEKNIK CWE</h2>
                <p class="text-[10px] text-maroon-400 font-semibold truncate">Prodi D4 TRPL</p>
                <p class="text-[9px] text-slate-400 truncate">Tanggap, Tanggon, Trengginas</p>
            </div>
        </div>

        <div class="p-3.5 mx-3 my-3 bg-slate-800/60 rounded-2xl border border-slate-700/60 flex items-center ${sidebarState.collapsed ? 'md:justify-center md:p-2' : 'gap-3'}">
            <div class="relative cursor-pointer group shrink-0" onclick="openModalManagePhoto(${user.id})" title="Klik untuk mengelola foto profil">
                ${getUserAvatar(user, "w-11 h-11 text-base", "rounded-2xl")}
                <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-maroon-600 hover:bg-maroon-500 text-white flex items-center justify-center text-[10px] shadow transition border border-slate-900">
                    <i class="fa-solid fa-camera"></i>
                </div>
            </div>
            <div class="min-w-0 flex-1" data-sidebar-text>
                <p class="text-xs font-bold text-white truncate cursor-pointer hover:underline" onclick="openModalManagePhoto(${user.id})">${user.nama}</p>
                <p class="text-[10px] font-mono text-slate-400 truncate">${user.nomor_induk || user.email}</p>
                <div class="mt-1 flex items-center gap-1.5">
                    <span class="px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${roleColor}">
                        ${role}
                    </span>
                    <button onclick="openModalManagePhoto(${user.id})" class="text-[10px] text-maroon-400 hover:text-maroon-300 font-semibold transition">
                        Ubah Foto
                    </button>
                </div>
            </div>
        </div>

        <nav class="flex-1 px-3 space-y-1 overflow-y-auto">
            <div class="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider" data-sidebar-text>
                Menu ${role.toUpperCase()}
            </div>
            ${menuItems.map(item => `
                <button onclick="setTab('${item.id}')" title="${item.label}"
                    data-sidebar-center
                    class="w-full flex items-center ${sidebarState.collapsed ? 'md:justify-center' : 'justify-between'} px-3 py-2.5 rounded-xl text-xs font-medium transition ${currentTab === item.id
            ? "bg-maroon-600 text-white shadow-md shadow-maroon-600/30"
            : "text-slate-400 hover:text-white hover:bg-slate-800"
        }">
                    <div class="flex items-center gap-3">
                        <i class="fa-solid ${item.icon} w-4 text-center"></i>
                        <span data-sidebar-text>${item.label}</span>
                    </div>
                    ${item.badge ? `<span class="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300" data-sidebar-text>${item.badge}</span>` : ''}
                </button>
            `).join("")}
        </nav>

        <div class="p-3 border-t border-slate-800">
            <button onclick="logout()" title="Keluar dari Sistem" class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-600 transition border border-rose-900/40 shadow-xs">
                <i class="fa-solid fa-arrow-right-from-bracket"></i>
                <span data-sidebar-text>Keluar dari Sistem</span>
            </button>
        </div>
    </aside>
    `;
}

// Top Navbar
function renderTopNavbar() {
    const user = appData.currentUser;
    return `
    <header class="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0 shadow-xs">
        <div class="flex items-center gap-3 min-w-0">
            <button onclick="toggleSidebar()" title="Buka / tutup menu navigasi" aria-label="Toggle sidebar"
                class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-maroon-50 hover:text-maroon-600 text-slate-600 flex items-center justify-center transition shrink-0">
                <i id="sidebar-toggle-icon" class="fa-solid ${sidebarState.collapsed ? 'fa-bars-staggered' : 'fa-bars'}"></i>
            </button>
            <span class="hidden md:inline text-xs font-medium text-slate-500">Tahun Akademik:</span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                ${appData.semesterAktif}
            </span>
            <span class="hidden lg:inline text-xs text-slate-400">•</span>
            <span class="hidden lg:inline text-xs font-semibold text-slate-600 truncate">Politeknik Citra Widya Edukasi</span>
        </div>

        <div class="flex items-center gap-3 shrink-0">
            <button onclick="openModalManagePhoto(${user.id})" title="Ubah Foto Profil & Akun" class="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-50 transition text-left group">
                <div class="relative">
                    ${getUserAvatar(user, "w-9 h-9 text-xs", "rounded-xl")}
                    <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                </div>
                <div class="text-right hidden sm:block">
                    <p class="text-xs font-bold text-slate-800 leading-tight group-hover:text-maroon-600 transition">${user.nama}</p>
                    <p class="text-[10px] text-slate-400 capitalize">${user.role} &bull; ${user.prodi || 'TRPL'}</p>
                </div>
            </button>
            <a href="logout.php" title="Keluar dari Sistem" class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center text-slate-600 transition text-xs font-bold">
                <i class="fa-solid fa-power-off"></i>
            </a>
        </div>
    </header>
    `;
}

// Router Konten
function renderMainContent() {
    const role = appData.currentUser.role;

    if (currentTab === "assignments") {
        return renderAssignmentsModule();
    }

    if (currentTab === "schedule") {
        return renderScheduleModule();
    }

    if (role === "admin") {
        if (currentTab === "users") return renderAdminUsers();
        if (currentTab === "classes") return renderAdminClasses();
        if (currentTab === "courses") return renderAdminCourses();
        if (currentTab === "semesters") return renderAdminSemesters();
        if (currentTab === "settings") return renderAdminSettings();
        return renderAdminDashboard();
    } else if (role === "dosen") {
        if (currentTab === "materials") return renderDosenMaterials();
        if (currentTab === "classes") return renderDosenClasses();
        return renderDosenDashboard();
    } else if (role === "mahasiswa") {
        if (currentTab === "my-courses") return renderMahasiswaCourses();
        if (currentTab === "my-grades") return renderMahasiswaGrades();
        return renderMahasiswaDashboard();
    }
}

function closeModal() {
    const m = document.getElementById("modal-container");
    if (m) m.innerHTML = "";
}

function openConfirmModal({ title, message, confirmText, confirmColor, onConfirm }) {
    const modal = document.getElementById("modal-container");
    if (!modal) return;
    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 border border-slate-100">
            <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl mx-auto shadow-sm">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div class="text-center space-y-2">
                <h3 class="font-bold text-slate-800 text-sm">${title}</h3>
                <p class="text-xs text-slate-500 leading-relaxed">${message}</p>
            </div>
            <div class="pt-2 flex justify-center gap-2">
                <button type="button" onclick="closeModal()" class="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600 text-xs">
                    Batal
                </button>
                <button type="button" id="btn-confirm-action" class="px-4 py-2 ${confirmColor || 'bg-rose-600 hover:bg-rose-700'} text-white rounded-xl font-semibold text-xs shadow-sm transition">
                    ${confirmText || 'Konfirmasi'}
                </button>
            </div>
        </div>
    </div>
    `;

    document.getElementById("btn-confirm-action").onclick = function () {
        closeModal();
        if (typeof onConfirm === "function") onConfirm();
    };
}
