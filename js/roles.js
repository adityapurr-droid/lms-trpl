/**
 * js/roles.js - Tampilan Khusus Peran (Dashboard Admin, Dosen, Mahasiswa)
 * Mengatur Beranda, Pengaturan Sistem, Jadwal Mengajar, dan Transkrip Nilai
 */
// ==========================================
// TAMPILAN LAINNYA (ADMIN, DOSEN, MHS)
// ==========================================

function renderAdminDashboard() {
    return `
    <div class="space-y-6">
        <div>
            <h1 class="text-xl font-bold text-slate-800">Dashboard Administrator</h1>
            <p class="text-xs text-slate-500">Operasional Akademik Prodi TRPL Politeknik Citra Widya Edukasi</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                    <span class="text-xs font-semibold text-slate-400">Angkatan</span>
                    <h3 class="text-2xl font-bold text-slate-800 mt-1">${(appData.angkatanList || []).length} Angkatan</h3>
                    <button onclick="setTab('classes')" class="text-[11px] text-emerald-600 font-semibold hover:underline">Kelola &rarr;</button>
                </div>
                <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
                    <i class="fa-solid fa-users-line"></i>
                </div>
            </div>

            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                    <span class="text-xs font-semibold text-slate-400">Mata Kuliah</span>
                    <h3 class="text-2xl font-bold text-slate-800 mt-1">${appData.mataKuliah.length} Matkul</h3>
                    <button onclick="setTab('courses')" class="text-[11px] text-maroon-600 font-semibold hover:underline">Kelola &rarr;</button>
                </div>
                <div class="w-12 h-12 rounded-xl bg-maroon-50 text-maroon-600 flex items-center justify-center text-xl">
                    <i class="fa-solid fa-book-bookmark"></i>
                </div>
            </div>

            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                    <span class="text-xs font-semibold text-slate-400">Dosen Pengampu</span>
                    <h3 class="text-2xl font-bold text-slate-800 mt-1">${(appData.dosenList && appData.dosenList.length) ? appData.dosenList.length : appData.users.filter(u => u.role === 'dosen').length} Dosen</h3>
                    <button onclick="setTab('users')" class="text-[11px] text-blue-600 font-semibold hover:underline">Kelola Pengguna &rarr;</button>
                </div>
                <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                    <i class="fa-solid fa-chalkboard-user"></i>
                </div>
            </div>

            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                    <span class="text-xs font-semibold text-slate-400">Mahasiswa</span>
                    <h3 class="text-2xl font-bold text-slate-800 mt-1">${appData.users.filter(u => u.role === 'mahasiswa').length} Mahasiswa</h3>
                    <button onclick="setTab('users')" class="text-[11px] text-indigo-600 font-semibold hover:underline">Kelola Pengguna &rarr;</button>
                </div>
                <div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                    <i class="fa-solid fa-user-graduate"></i>
                </div>
            </div>
        </div>

        ${renderJadwalHariIniWidget('admin')}

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-sm font-bold text-slate-800">Daftar Pengguna Terbaru</h2>
                    <button onclick="setTab('users')" class="text-xs font-semibold text-maroon-600 hover:underline">Kelola Semua &rarr;</button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs">
                        <thead class="bg-slate-50 text-slate-600 border-b border-slate-200">
                            <tr>
                                <th class="p-3">Nama Lengkap</th>
                                <th class="p-3">NIM / NIP</th>
                                <th class="p-3">Peran</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${(appData.users.length ? appData.users : [appData.currentUser]).slice(0, 4).map(u => `
                                <tr>
                                    <td class="p-3 font-semibold text-slate-800">${u.nama}</td>
                                    <td class="p-3 text-slate-500 font-mono">${u.nomor_induk}</td>
                                    <td class="p-3">
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${u.role === 'admin' ? 'bg-rose-100 text-rose-700' :
            u.role === 'dosen' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
        }">${u.role}</span>
                                    </td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
                <h2 class="text-sm font-bold text-slate-800">Aksi Administratif Cepat</h2>
                <button onclick="setTab('users'); openModalAddUser();" class="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition">
                    <i class="fa-solid fa-user-plus text-maroon-600"></i> Tambah Pengguna Baru
                </button>
                <button onclick="openModalAddMatkul();" class="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition">
                    <i class="fa-solid fa-circle-plus text-maroon-600"></i> Tambah Mata Kuliah
                </button>
                <button onclick="setTab('courses');" class="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition">
                    <i class="fa-solid fa-book-bookmark text-slate-600"></i> Kelola Mata Kuliah & Dosen
                </button>
                <button onclick="setTab('semesters'); openModalAddSemester();" class="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition">
                    <i class="fa-solid fa-calendar-plus text-maroon-600"></i> Kelola & Tambah Semester
                </button>
            </div>
        </div>
    </div>
    `;
}

function renderAdminSettings() {
    return `
    <div class="max-w-2xl bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 class="text-base font-bold text-slate-800">Pengaturan Institusi & Akademik</h2>
        <div class="space-y-3 text-xs">
            <div>
                <label class="block font-semibold text-slate-700 mb-1">Perguruan Tinggi</label>
                <input type="text" readonly value="Politeknik Citra Widya Edukasi (CWE)" class="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-700 font-semibold">
            </div>
            <div>
                <label class="block font-semibold text-slate-700 mb-1">Program Studi</label>
                <input type="text" readonly value="D4 Teknologi Rekayasa Perangkat Lunak" class="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-700">
            </div>
            <div>
                <label class="block font-semibold text-slate-700 mb-1">Semester Aktif</label>
                <input id="setting-semester" type="text" value="${appData.semesterAktif}" class="w-full p-2.5 border border-slate-300 rounded-xl text-slate-700 focus:ring-2 focus:ring-maroon-500">
            </div>
            <button onclick="appData.semesterAktif = document.getElementById('setting-semester').value; renderApp(); showToast('Pengaturan semester disimpan.', 'success');" 
                class="px-4 py-2 bg-maroon-600 text-white rounded-xl font-semibold hover:bg-maroon-700 transition">
                Simpan Pengaturan
            </button>
        </div>
    </div>
    `;
}

// DASHBOARD DOSEN
function renderDosenDashboard() {
    return `
    <div class="space-y-6">
        <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
                <h1 class="text-xl font-bold text-slate-800">Selamat Datang, ${appData.currentUser.nama}</h1>
                <p class="text-xs text-slate-500">Dosen Pengampu &bull; NIP: ${appData.currentUser.nomor_induk || '-'} &bull; Politeknik Citra Widya Edukasi</p>
            </div>
            <div class="bg-maroon-50 border border-maroon-200 rounded-xl px-4 py-2 flex items-center gap-2">
                <i class="fa-solid fa-calendar-check text-maroon-600 text-sm"></i>
                <div class="text-left">
                    <span class="text-[10px] uppercase font-bold text-slate-400 block tracking-wider leading-none">Semester Berjalan</span>
                    <span class="text-xs font-bold text-maroon-900">${appData.semesterAktif}</span>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span class="text-xs font-semibold text-slate-400">Kelas yang Diampu</span>
                <h3 class="text-2xl font-bold text-slate-800 mt-1">${(appData.kelasList || []).length} Kelas</h3>
                <p class="text-[11px] text-blue-600 mt-1 font-medium">Semester ${appData.semesterAktif}</p>
            </div>
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span class="text-xs font-semibold text-slate-400">Tugas Dikelola</span>
                <h3 class="text-2xl font-bold text-slate-800 mt-1">${appData.tugas.length} Tugas</h3>
                <button onclick="setTab('assignments')" class="text-[11px] text-emerald-600 mt-1 font-medium hover:underline block">Buka Penugasan &rarr;</button>
            </div>
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span class="text-xs font-semibold text-slate-400">Modul Perkuliahan</span>
                <h3 class="text-2xl font-bold text-slate-800 mt-1">${appData.materi.length} Materi</h3>
                <button onclick="setTab('materials')" class="text-[11px] text-maroon-600 mt-1 font-medium hover:underline block">Lihat Materi &rarr;</button>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            ${renderJadwalHariIniWidget('dosen', { compact: true })}

            <div class="bg-gradient-to-br from-maroon-800 to-maroon-900 rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between gap-4 h-full">
                <div>
                    <div class="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center mb-3">
                        <i class="fa-solid fa-clipboard-check text-sm"></i>
                    </div>
                    <h2 class="text-sm font-bold leading-snug">Kelola Penugasan &amp; Penilaian Mahasiswa</h2>
                    <p class="text-[11px] text-maroon-100 mt-1.5 leading-relaxed">Buat tugas baru dengan berkas soal, atur deadline, atau nilai hasil kiriman mahasiswa.</p>
                </div>
                <button onclick="setTab('assignments'); openModalAddTugas();" class="w-full px-4 py-2.5 rounded-xl bg-white text-maroon-800 font-bold text-xs hover:bg-maroon-50 transition shadow-sm">
                    <i class="fa-solid fa-plus mr-1"></i> Buat Tugas Baru
                </button>
            </div>
        </div>

        <!-- Info Akademik & Semester (Read-Only untuk Dosen) -->
        <div class="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-maroon-100 text-maroon-700 flex items-center justify-center text-lg shrink-0">
                    <i class="fa-solid fa-circle-info"></i>
                </div>
                <div>
                    <h4 class="text-xs font-bold text-slate-800">Status Tahun Akademik</h4>
                    <p class="text-[11px] text-slate-500">Semester aktif: <strong class="text-maroon-700">${appData.semesterAktif}</strong> &bull; Total ${appData.semesters.length} semester terdata</p>
                </div>
            </div>
            <span class="text-[11px] font-medium text-slate-400 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <i class="fa-solid fa-lock text-[10px] mr-1 text-slate-400"></i> Dikelola oleh Administrator
            </span>
        </div>
    </div>
    `;
}

// =============================================================
// MODUL DOSEN: JADWAL & KELAS SAYA (READ-ONLY & PENILAIAN TUGAS)
// =============================================================
let dosenClassState = {
    selectedClassId: null,
    selectedMatkulId: null,
    activeSubTab: "submissions", // "students" atau "submissions"
};

function handleDosenMatkulSelect(mkId) {
    const idNum = (mkId === null || mkId === undefined || mkId === "") ? null : Number(mkId);
    dosenClassState.selectedMatkulId = idNum;
    const currentDosenId = appData.currentUser ? appData.currentUser.id : null;
    const myClasses = (appData.kelasList || []).filter(k => Number(k.dosen_id) === Number(currentDosenId));
    const groups = new Map();
    myClasses.forEach(c => {
        const mkKey = (c.mata_kuliah_id !== undefined && c.mata_kuliah_id !== null) ? Number(c.mata_kuliah_id) : 0;
        if (!groups.has(mkKey)) {
            groups.set(mkKey, { mkId: mkKey, nama_mk: c.nama_mk || 'Mata Kuliah', kode_mk: c.kode_mk || '', semester_paket: c.semester_paket || 'Lainnya', classes: [] });
        }
        groups.get(mkKey).classes.push(c);
    });
    const glist = Array.from(groups.values());
    const group = idNum ? (glist.find(g => Number(g.mkId) === idNum) || null) : null;
    const target = group || glist[0] || null;
    dosenClassState.selectedMatkulId = target ? Number(target.mkId) : null;
    if (target) {
        const current = dosenClassState.selectedClassId ? (target.classes.find(c => Number(c.id) === Number(dosenClassState.selectedClassId)) || null) : null;
        dosenClassState.selectedClassId = current ? Number(current.id) : (target.classes.length > 0 ? Number(target.classes[0].id) : null);
    } else {
        dosenClassState.selectedClassId = null;
    }
    dosenClassState.activeSubTab = "submissions";
    renderApp();
}

function renderDosenClasses() {
    const currentDosenId = appData.currentUser ? appData.currentUser.id : null;
    const myClasses = (appData.kelasList || []).filter(k => Number(k.dosen_id) === Number(currentDosenId));

    // Kelompokkan kelas per mata kuliah (untuk navigasi MK di kolom kiri)
    const matkulGroups = new Map();
    myClasses.forEach(c => {
        const mkId = (c.mata_kuliah_id !== undefined && c.mata_kuliah_id !== null) ? Number(c.mata_kuliah_id) : 0;
        if (!matkulGroups.has(mkId)) {
            matkulGroups.set(mkId, {
                mkId: mkId,
                nama_mk: c.nama_mk || 'Mata Kuliah',
                kode_mk: c.kode_mk || '',
                semester_paket: c.semester_paket || 'Lainnya',
                classes: []
            });
        }
        matkulGroups.get(mkId).classes.push(c);
    });
    const matkulList = Array.from(matkulGroups.values()).sort((a, b) => {
        const pa = Number(a.semester_paket) || 0;
        const pb = Number(b.semester_paket) || 0;
        if (pa !== pb) return pa - pb;
        return String(a.nama_mk).localeCompare(String(b.nama_mk), 'id');
    });

    const selectedMatkulIdNum = (dosenClassState.selectedMatkulId !== null && dosenClassState.selectedMatkulId !== undefined && dosenClassState.selectedMatkulId !== "") ? Number(dosenClassState.selectedMatkulId) : null;
    const selectedGroup = selectedMatkulIdNum ? (matkulGroups.get(selectedMatkulIdNum) || matkulList[0] || null) : (matkulList[0] || null);
    const classesToShow = selectedGroup ? selectedGroup.classes : [];

    if (!classesToShow.some(c => Number(c.id) === Number(dosenClassState.selectedClassId))) {
        dosenClassState.selectedClassId = classesToShow.length > 0 ? classesToShow[0].id : null;
    }

    const selectedClass = classesToShow.find(c => Number(c.id) === Number(dosenClassState.selectedClassId)) || null;
    const angkatan = selectedClass ? getKelasAngkatanNama(selectedClass) : '';
    const classTasks = selectedClass ? (appData.tugas || []).filter(t => {
        if (t.kelasId !== undefined && t.kelasId !== null) {
            return Number(t.kelasId) === Number(selectedClass.id);
        }
        return Number(t.matkulId) === Number(selectedClass.mata_kuliah_id);
    }) : [];

    // Total kiriman tugas yang perlu dinilai di kelas ini
    let totalSubmissions = 0;
    let pendingGrading = 0;
    classTasks.forEach(t => {
        (t.submissions || []).forEach(s => {
            totalSubmissions++;
            if (s.nilai === null || s.nilai === undefined) {
                pendingGrading++;
            }
        });
    });

    return `
    <div class="space-y-6">
        <!-- Header Dosen -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <i class="fa-solid fa-chalkboard-user text-blue-600"></i>
                    Jadwal & Kelas Perkuliahan Saya
                </h1>
                <p class="text-xs text-slate-500 mt-0.5">Pantau mahasiswa per rombel angkatan dan berikan penilaian evaluatif pada pengumpulan tugas mahasiswa.</p>
            </div>
            <div class="flex items-center gap-2">
                <span class="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs flex items-center gap-1.5">
                    <i class="fa-solid fa-user-tie"></i> Dosen: ${appData.currentUser.nama}
                </span>
            </div>
        </div>

        ${classesToShow.length === 0 ? `
            <div class="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm">
                <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-2xl mb-3">
                    <i class="fa-solid fa-chalkboard"></i>
                </div>
                <h3 class="text-sm font-bold text-slate-700">Belum Ada Kelas yang Diampu</h3>
                <p class="text-xs text-slate-500 mt-1">Administrator belum menugaskan Anda ke kelas perkuliahan aktif.</p>
            </div>
        ` : `
            <div class="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
                <!-- NAV MATA KULIAH (KIRI) -->
                <aside class="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 lg:sticky lg:top-4">
                    <p class="px-2 pt-1 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Mata Kuliah Saya</p>
                    <div class="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
                        ${matkulList.map(g => {
                            const isSelected = selectedGroup && Number(selectedGroup.mkId) === Number(g.mkId);
                            return `
                            <button type="button" onclick="handleDosenMatkulSelect(${g.mkId})"
                                title="${String(g.nama_mk).replace(/"/g, '&quot;')}"
                                class="w-full h-14 flex items-center text-left px-3 rounded-xl border transition ${isSelected ? 'bg-maroon-50 border-maroon-300' : 'bg-white border-slate-200 hover:border-maroon-300 hover:bg-slate-50'}">
                                <span class="block w-full text-xs font-bold leading-snug line-clamp-2 ${isSelected ? 'text-maroon-700' : 'text-slate-800'}">
                                    ${g.nama_mk}
                                </span>
                            </button>
                            `;
                        }).join("")}
                    </div>
                </aside>

                <!-- KANAN: INFO MK + GRID KELAS + DETAIL -->
                <div class="space-y-4 min-w-0">
                    <!-- Pemilih Kelas (Grid Kartu) -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                        ${classesToShow.map(c => {
                    const isSelected = selectedClass && Number(c.id) === Number(selectedClass.id);
                    const displayLabel = formatKelasDisplay(c);
                    return `
                    <button onclick="dosenClassState.selectedClassId = ${c.id}; renderApp();"
                        class="px-4 py-3 rounded-2xl border transition text-left ${isSelected 
                            ? 'bg-maroon-600 text-white border-maroon-600 shadow-md shadow-maroon-600/20' 
                            : 'bg-white text-slate-700 border-slate-200 hover:border-maroon-300 hover:bg-slate-50'
                        }">
                        <span class="block font-extrabold text-[11px] ${isSelected ? 'text-white' : 'text-slate-800'}">
                            ${c.nama_mk || 'Mata Kuliah'}${c.kode_mk ? ' (' + c.kode_mk + ')' : ''}
                        </span>
                        <span class="block text-[10px] mt-0.5 ${isSelected ? 'text-maroon-100' : 'text-slate-500'}">
                            ${displayLabel}
                        </span>
                    </button>
                    `;
                }).join("")}
            </div>

            <!-- Detail Kelas Terpilih -->
            ${selectedClass ? `
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-5">
                    <!-- Banner Info Kelas -->
                    <div class="p-6 bg-gradient-to-r from-slate-900 to-maroon-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div class="space-y-1">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="px-3 py-1 rounded-xl text-xs font-black bg-maroon-500 text-white">
                                    ${formatKelasDisplay(selectedClass)}
                                </span>
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-300">
                                    ${selectedClass.semester_nama || appData.semesterAktif}
                                </span>
                            </div>
                            <h2 class="text-lg font-bold text-white pt-1">
                                ${selectedClass.nama_mk} <span class="text-xs font-mono font-normal text-maroon-300">(${selectedClass.kode_mk})</span>
                            </h2>
                            <p class="text-xs text-slate-300 flex items-center gap-3 flex-wrap pt-1">
                                ${renderJadwalInfoBar(selectedClass, { variant: 'dark' })}
                                <span class="text-slate-300"><i class="fa-solid fa-award text-maroon-400 mr-1"></i> ${selectedClass.sks || 3} SKS</span>
                            </p>
                        </div>

                        <!-- Ringkasan Statistik -->
                        <div class="flex items-center gap-3">
                            <div class="px-4 py-2.5 bg-white/10 rounded-xl text-center backdrop-blur-xs border border-white/10">
                                <span class="block text-lg font-black text-white">${(selectedClass.mahasiswa || []).length}</span>
                                <span class="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">Mahasiswa</span>
                            </div>
                            <div class="px-4 py-2.5 bg-white/10 rounded-xl text-center backdrop-blur-xs border border-white/10">
                                <span class="block text-lg font-black text-white">${classTasks.length}</span>
                                <span class="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">Tugas Kuliah</span>
                            </div>
                            <div class="px-4 py-2.5 ${pendingGrading > 0 ? 'bg-amber-500/20 border-amber-400/30 text-amber-200' : 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200'} rounded-xl text-center backdrop-blur-xs border">
                                <span class="block text-lg font-black">${pendingGrading}</span>
                                <span class="text-[10px] uppercase tracking-wider font-semibold">Perlu Dinilai</span>
                            </div>
                        </div>
                    </div>

                    <!-- Tab Antarmuka: Mahasiswa vs Penilaian Tugas -->
                    <div class="px-6 border-b border-slate-200 flex items-center justify-between gap-4">
                        <div class="flex items-center gap-3 text-xs font-bold">
                            <button onclick="dosenClassState.activeSubTab='submissions'; renderApp();"
                                class="py-3 px-1 border-b-2 transition flex items-center gap-2 ${
                                    dosenClassState.activeSubTab === 'submissions' 
                                        ? 'border-maroon-600 text-maroon-600 font-extrabold' 
                                        : 'border-transparent text-slate-400 hover:text-slate-600'
                                }">
                                <i class="fa-solid fa-list-check"></i>
                                <span>Pengumpulan & Penilaian Tugas (${totalSubmissions})</span>
                                ${pendingGrading > 0 ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-100 text-amber-800 font-bold">${pendingGrading} Belum Dinilai</span>` : ''}
                            </button>
                            <button onclick="dosenClassState.activeSubTab='students'; renderApp();"
                                class="py-3 px-1 border-b-2 transition flex items-center gap-2 ${
                                    dosenClassState.activeSubTab === 'students' 
                                        ? 'border-maroon-600 text-maroon-600 font-extrabold' 
                                        : 'border-transparent text-slate-400 hover:text-slate-600'
                                }">
                                <i class="fa-solid fa-user-group"></i>
                                <span>Daftar Mahasiswa Terdaftar (${(selectedClass.mahasiswa || []).length})</span>
                                <span class="text-[10px] text-slate-400 font-normal">(Read-Only)</span>
                            </button>
                        </div>
                    </div>

                    <!-- Isi Tab -->
                    <div class="p-6 pt-0">
                        ${dosenClassState.activeSubTab === 'submissions' ? `
                            <!-- SUBTAB PENILAIAN TUGAS -->
                            <div class="space-y-5">
                                ${classTasks.length === 0 ? `
                                    <div class="p-8 text-center text-slate-400 border border-slate-100 rounded-2xl bg-slate-50/50">
                                        <i class="fa-solid fa-folder-open text-3xl text-slate-300 mb-2"></i>
                                        <p class="font-bold text-slate-700">Belum ada tugas perkuliahan untuk kelas ini.</p>
                                        <p class="text-xs text-slate-400 mt-1">Buka menu <strong>"Manajemen Tugas"</strong> di sidebar untuk membuat instrumen tugas baru.</p>
                                        <button onclick="setTab('assignments'); openModalAddTugas();" class="mt-3 px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl text-xs font-semibold transition">
                                            + Buat Tugas Sekarang
                                        </button>
                                    </div>
                                ` : classTasks.map(tugas => {
                                    const submissions = tugas.submissions || [];
                                    return `
                                    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                                        <!-- Header Tugas -->
                                        <div class="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div>
                                                <h3 class="font-bold text-slate-800 text-xs">${tugas.judul}</h3>
                                                <p class="text-[11px] text-slate-400 mt-0.5">Deadline: ${formatDeadlineDisplay(tugas.deadline)}</p>
                                            </div>
                                            <div class="flex items-center gap-2">
                                                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${submissions.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}">
                                                    ${submissions.length} Pengumpulan Mahasiswa
                                                </span>
                                            </div>
                                        </div>

                                        <!-- Tabel Kiriman Mahasiswa & Form Penilaian -->
                                        ${submissions.length === 0 ? `
                                            <div class="p-6 text-center text-slate-400 text-xs italic">
                                                Belum ada mahasiswa yang mengumpulkan tugas ini.
                                            </div>
                                        ` : `
                                            <div class="overflow-x-auto">
                                                <table class="w-full text-left text-xs">
                                                    <thead class="bg-slate-50/50 text-slate-600 border-b border-slate-200 text-[10px] uppercase font-bold">
                                                        <tr>
                                                            <th class="p-3">Mahasiswa</th>
                                                            <th class="p-3">Waktu Kumpul</th>
                                                            <th class="p-3">Berkas Jawaban</th>
                                                            <th class="p-3">Catatan Mahasiswa</th>
                                                            <th class="p-3">Status & Nilai</th>
                                                            <th class="p-3 text-right">Aksi Penilaian</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody class="divide-y divide-slate-100">
                                                        ${submissions.map(sub => `
                                                            <tr class="hover:bg-slate-50/80 transition">
                                                                <td class="p-3">
                                                                    <p class="font-bold text-slate-800 text-xs">${sub.mhsNama}</p>
                                                                    <p class="text-[10px] font-mono text-slate-400">${sub.mhsNim}</p>
                                                                </td>
                                                                <td class="p-3 text-slate-500 text-[11px]">
                                                                    ${sub.submittedAt || 'Waktu pengumpulan tidak tercatat'}
                                                                </td>
                                                                <td class="p-3">
                                                                    ${sub.fileJawaban && sub.fileJawaban.nama ? `
                                                                        <button onclick="downloadFile('${sub.fileJawaban.nama}', '${sub.fileJawaban.dataUrl || ''}', 'Jawaban Tugas: ${sub.mhsNama}')" 
                                                                            class="px-2.5 py-1 bg-white hover:bg-maroon-50 border border-maroon-200 text-maroon-700 font-semibold rounded-lg text-[10px] transition inline-flex items-center gap-1 shadow-xs">
                                                                            <i class="fa-solid fa-download"></i> ${sub.fileJawaban.nama}
                                                                        </button>
                                                                    ` : '<span class="text-slate-400 italic text-[11px]">Teks Langsung</span>'}
                                                                </td>
                                                                <td class="p-3 text-slate-600 text-[11px] max-w-xs truncate" title="${sub.catatanMhs || '-'}">
                                                                    ${sub.catatanMhs ? `"${sub.catatanMhs}"` : '-'}
                                                                </td>
                                                                <td class="p-3">
                                                                    ${sub.nilai !== null && sub.nilai !== undefined ? `
                                                                        <div class="space-y-0.5">
                                                                            <span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                                                                                ${sub.nilai} / 100
                                                                            </span>
                                                                            ${sub.catatanDosen ? `<p class="text-[10px] text-slate-500 italic truncate max-w-xs">"${sub.catatanDosen}"</p>` : ''}
                                                                        </div>
                                                                    ` : `
                                                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                                                            Belum Dinilai
                                                                        </span>
                                                                    `}
                                                                </td>
                                                                <td class="p-3 text-right">
                                                                    <button onclick="openModalGradeSubmission(${tugas.id}, ${sub.mhsId})"
                                                                        class="px-3 py-1.5 ${sub.nilai !== null && sub.nilai !== undefined ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} rounded-lg text-xs font-semibold shadow-xs transition inline-flex items-center gap-1.5">
                                                                        <i class="fa-solid fa-marker"></i> ${sub.nilai !== null && sub.nilai !== undefined ? 'Ubah Nilai' : 'Beri Nilai'}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        `).join("")}
                                                    </tbody>
                                                </table>
                                            </div>
                                        `}
                                    </div>
                                    `;
                                }).join("")}
                            </div>
                        ` : `
                            <!-- SUBTAB DAFTAR MAHASISWA (READ-ONLY) -->
                            <div class="space-y-3">
                                <div class="flex items-center justify-between pb-2">
                                    <div>
                                         <h3 class="font-bold text-slate-800 text-xs">Mahasiswa Kelas ${formatKelasDisplay(selectedClass)}</h3>
                                        <p class="text-[11px] text-slate-400">Dikelola langsung oleh Administrator program studi.</p>
                                    </div>
                                    <span class="text-[11px] text-slate-500 font-semibold bg-slate-100 px-3 py-1 rounded-lg">
                                        <i class="fa-solid fa-lock text-[10px] text-slate-400 mr-1"></i> Mode Read-Only
                                    </span>
                                </div>

                                ${(selectedClass.mahasiswa || []).length === 0 ? `
                                    <div class="p-8 text-center text-slate-400 border border-slate-100 rounded-2xl bg-slate-50/50">
                                        <i class="fa-solid fa-user-slash text-2xl text-slate-300 mb-1"></i>
                                        <p class="font-bold text-slate-700">Belum ada mahasiswa yang didaftarkan ke kelas ini.</p>
                                        <p class="text-[11px]">Hubungi Administrator program studi untuk penambahan rombel mahasiswa.</p>
                                    </div>
                                ` : `
                                    <div class="overflow-x-auto border border-slate-200 rounded-xl">
                                        <table class="w-full text-left text-xs">
                                            <thead class="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10px] uppercase font-bold">
                                                <tr>
                                                    <th class="p-3 w-12 text-center">No</th>
                                                    <th class="p-3">Mahasiswa</th>
                                                    <th class="p-3">NIM / Angkatan</th>
                                                    <th class="p-3">Email Resmi</th>
                                                    <th class="p-3">Program Studi</th>
                                                    <th class="p-3 text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody class="divide-y divide-slate-100">
                                                ${(selectedClass.mahasiswa || []).map((m, idx) => {
                                                    const ang = getAngkatanFromNIM(m.nomor_induk);
                                                    return `
                                                    <tr class="hover:bg-slate-50/80 transition">
                                                        <td class="p-3 text-center text-slate-400 font-bold">${idx + 1}</td>
                                                        <td class="p-3">
                                                            <div class="flex items-center gap-2.5">
                                                                ${getUserAvatar(m, "w-8 h-8 text-[11px]", "rounded-xl")}
                                                                <span class="font-bold text-slate-800 text-xs">${m.nama}</span>
                                                            </div>
                                                        </td>
                                                        <td class="p-3">
                                                            <span class="font-mono font-bold text-slate-700">${m.nomor_induk}</span>
                                                            <span class="ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold ${ang === '2024' ? 'bg-maroon-100 text-maroon-700' : 'bg-emerald-100 text-emerald-700'}">
                                                                Angkatan ${ang}
                                                            </span>
                                                        </td>
                                                        <td class="p-3 text-slate-500">${m.email}</td>
                                                        <td class="p-3 text-slate-600 text-[11px]">D4 TRPL</td>
                                                        <td class="p-3 text-right">
                                                            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                                                Terdaftar Aktif
                                                            </span>
                                                        </td>
                                                    </tr>
                                                    `;
                                                }).join("")}
                                            </tbody>
                                        </table>
                                    </div>
                                `}
                            </div>
                        `}
                    </div>
                </div>
            ` : ''}
                </div>
            </div>

        `}
    </div>
    `;
}

function getMateriSemesterPaket(materi) {
    if (!materi) return 0;
    const mk = (appData.mataKuliah || []).find(k => Number(k.id) === Number(materi.matkulId));
    if (mk && Number(mk.semester_paket)) return Number(mk.semester_paket);
    const kelas = (appData.kelasList || []).find(k => Number(k.id) === Number(materi.kelasId));
    if (kelas && Number(kelas.semester_paket)) return Number(kelas.semester_paket);
    return 0;
}

function handleMateriSemesterFilter(value) {
    materiFilter.semester = value;
    renderApp();
}

function renderDosenMaterials() {
    const allMateri = appData.materi || [];
    const selectedSemester = String(materiFilter.semester || "all");
    const filteredMateri = selectedSemester === "all"
        ? allMateri
        : allMateri.filter(m => String(getMateriSemesterPaket(m)) === selectedSemester);
    const isFilterActive = selectedSemester !== "all";

    return `
    <div class="space-y-6">
        <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
                <h1 class="text-xl font-bold text-slate-800">Materi Perkuliahan</h1>
                <p class="text-xs text-slate-500">Bahan ajar dan modul perkuliahan TRPL CWE</p>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
                <select onchange="handleMateriSemesterFilter(this.value)" class="px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-maroon-500 focus:outline-none">
                    <option value="all" ${selectedSemester === "all" ? 'selected' : ''}>Semua Semester</option>
                    ${[1, 2, 3, 4, 5, 6, 7, 8].map(s => `
                        <option value="${s}" ${selectedSemester === String(s) ? 'selected' : ''}>Semester ${s}</option>
                    `).join("")}
                </select>
                <button onclick="openModalAddMateri()" class="px-4 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition shrink-0">
                    <i class="fa-solid fa-circle-plus"></i> Buat Materi Baru
                </button>
            </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            ${filteredMateri.length === 0 ? `
                <div class="p-12 text-center">
                    <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-2xl mb-3">
                        <i class="fa-solid fa-file-arrow-up"></i>
                    </div>
                    <h3 class="text-sm font-bold text-slate-700">${isFilterActive ? `Tidak Ada Materi Semester ${selectedSemester}` : 'Belum Ada Materi Terunggah'}</h3>
                    <p class="text-xs text-slate-500 mt-1">${isFilterActive
            ? 'Tidak ada materi pada semester yang dipilih. Pilih semester lain atau tampilkan semua materi.'
            : 'Belum ada modul atau bahan ajar yang diunggah untuk kelas perkuliahan Anda.'}</p>
                    ${isFilterActive ? `
                        <button onclick="handleMateriSemesterFilter('all')" class="mt-4 px-4 py-2 bg-maroon-50 hover:bg-maroon-100 text-maroon-700 font-semibold rounded-xl text-xs transition">
                            <i class="fa-solid fa-list mr-1"></i> Tampilkan Semua Semester
                        </button>
                    ` : ''}
                </div>
            ` : `
            <div class="divide-y divide-slate-100">
                ${filteredMateri.map(m => {
        const mk = appData.mataKuliah.find(k => k.id === m.matkulId) || { nama: "Mata Kuliah TRPL" };
        const kelas = (appData.kelasList || []).find(k => Number(k.id) === Number(m.kelasId));
        const semesterPaket = getMateriSemesterPaket(m);
        return `
                    <div class="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                                P${m.pertemuan}
                            </div>
                            <div>
                                <h3 class="text-xs font-bold text-slate-800">${m.judul}</h3>
                                <p class="text-[11px] text-slate-500 mt-0.5">
                                    ${mk.nama}
                                    ${kelas ? `<span class="mx-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">${getKelasDisplayName(kelas)}</span>` : ''}
                                    ${semesterPaket ? `<span class="mx-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">Semester ${semesterPaket}</span>` : ''}
                                    &bull; <span class="font-semibold text-blue-600">${m.tipe}</span>
                                </p>
                            </div>
                        </div>
                        <button onclick="downloadFile('${m.judul}.pdf', null, 'Materi Perkuliahan ${m.judul}')" 
                            class="px-3 py-1.5 bg-slate-100 hover:bg-maroon-50 text-slate-700 hover:text-maroon-600 rounded-lg text-xs font-semibold transition flex items-center gap-1.5">
                            <i class="fa-solid fa-download"></i> Unduh
                        </button>
                    </div>
                    `;
    }).join("")}
            </div>
            `}
        </div>
    </div>
    `;
}

// DASHBOARD MAHASISWA
function renderMahasiswaDashboard() {
    const user = appData.currentUser;
    const kelasLabel = typeof getMahasiswaKelasLabel === 'function' ? getMahasiswaKelasLabel() : '';
    return `
    <div class="space-y-6">
        <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
                <h1 class="text-xl font-bold text-slate-800">Halo, ${user.nama}!</h1>
                <p class="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                    <span>NIM: <span class="font-mono font-bold">${user.nomor_induk}</span></span>
                    ${kelasLabel ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">Kelas ${kelasLabel}</span>` : ''}
                    <span>&bull; Politeknik Citra Widya Edukasi</span>
                </p>
            </div>
            <div class="bg-maroon-50 border border-maroon-200 rounded-xl px-4 py-2 flex items-center gap-2">
                <i class="fa-solid fa-calendar-check text-maroon-600 text-sm"></i>
                <div class="text-left">
                    <span class="text-[10px] uppercase font-bold text-slate-400 block tracking-wider leading-none">Semester Berjalan</span>
                    <span class="text-xs font-bold text-maroon-900">${appData.semesterAktif}</span>
                </div>
            </div>
        </div>

        <!-- Info Akademik & Semester (Read-Only untuk Mahasiswa) -->
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center text-lg">
                    <i class="fa-solid fa-calendar-days"></i>
                </div>
                <div>
                    <h4 class="text-xs font-bold text-slate-800">Informasi Semester Perkuliahan</h4>
                    <p class="text-[11px] text-slate-500">Saat ini Anda menempuh perkuliahan pada semester aktif: <strong class="text-maroon-700">${appData.semesterAktif}</strong></p>
                </div>
            </div>
            <span class="text-[11px] font-medium text-slate-400 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <i class="fa-solid fa-shield-halved text-[10px] mr-1 text-slate-400"></i> Mode Tinjauan (Read-Only)
            </span>
        </div>

        <div class="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
                <span class="text-xs font-semibold uppercase tracking-wider text-emerald-200">E-Learning TRPL CWE</span>
                <h2 class="text-lg font-bold mt-1">Cek Tugas Kuliah & Kumpulkan Lembar Jawaban</h2>
                <p class="text-xs text-emerald-100 mt-1">Pastikan Anda mengumpulkan tugas sebelum batas waktu deadline.</p>
            </div>
            <button onclick="setTab('assignments')" class="px-4 py-2.5 rounded-xl bg-white text-emerald-800 font-bold text-xs hover:bg-emerald-50 transition shadow shrink-0">
                Buka Halaman Tugas
            </button>
        </div>

        ${renderJadwalHariIniWidget('mahasiswa')}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div class="flex items-center justify-between">
                    <h2 class="text-sm font-bold text-slate-800">Mata Kuliah Semester Ini</h2>
                    <button onclick="setTab('my-courses')" class="text-xs text-maroon-600 font-semibold hover:underline">Lihat Semua</button>
                </div>
                <div class="space-y-2">
                    ${appData.mataKuliah.length === 0 ? `
                        <p class="text-xs text-slate-400 py-4 text-center italic">Belum ada mata kuliah aktif</p>
                    ` : appData.mataKuliah.slice(0, 3).map(mk => `
                        <div class="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                            <div>
                                <span class="font-bold text-slate-800 block">${mk.nama}</span>
                                <span class="text-slate-500 text-[11px]">${mk.dosen}</span>
                            </div>
                            <span class="font-semibold text-maroon-600">${mk.sks} SKS</span>
                        </div>
                    `).join("")}
                </div>
            </div>

            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div class="flex items-center justify-between">
                    <h2 class="text-sm font-bold text-slate-800">Materi Terkini Dosen</h2>
                    <span class="text-xs text-slate-400">Minggu Ini</span>
                </div>
                <div class="space-y-2">
                    ${appData.materi.length === 0 ? `
                        <p class="text-xs text-slate-400 py-4 text-center italic">Belum ada materi perkuliahan</p>
                    ` : appData.materi.slice(0, 3).map(m => `
                        <div class="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                            <div class="flex items-center gap-2.5">
                                <i class="fa-solid fa-file-pdf text-rose-500 text-base"></i>
                                <div>
                                    <span class="font-bold text-slate-800 block truncate max-w-[200px]">${m.judul}</span>
                                    <span class="text-[11px] text-slate-400">Pertemuan ${m.pertemuan}</span>
                                </div>
                            </div>
                            <button onclick="downloadFile('${m.judul}.pdf', null, 'Modul Materi ${m.judul}')" class="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-600 hover:text-maroon-600 font-semibold text-[11px]">
                                <i class="fa-solid fa-download mr-1"></i> Unduh
                            </button>
                        </div>
                    `).join("")}
                </div>
            </div>
        </div>
    </div>
    `;
}

function renderMahasiswaCourses() {
    return `
    <div class="space-y-6">
        <div>
            <h1 class="text-xl font-bold text-slate-800">Mata Kuliah & Modul Saya</h1>
            <p class="text-xs text-slate-500">Mata kuliah yang Anda ikuti pada semester ini</p>
        </div>

        ${appData.mataKuliah.length === 0 ? `
            <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-2xl mb-3">
                    <i class="fa-solid fa-graduation-cap"></i>
                </div>
                <h3 class="text-sm font-bold text-slate-700">Belum Ada Mata Kuliah</h3>
                <p class="text-xs text-slate-500 mt-1">Anda belum terdaftar dalam kelas mata kuliah apapun untuk semester ini.</p>
            </div>
        ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${appData.mataKuliah.map(mk => {
        const materials = appData.materi.filter(m => m.matkulId === mk.id);
        // Tampilkan jadwal kelas yang benar-benar diikuti mahasiswa (enrolmen/angkatan), bukan kelas angkatan lain
        const primaryKelas = getJadwalScopeKelas().find(k => Number(k.mata_kuliah_id) === Number(mk.id)) || null;
        return `
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div class="flex justify-between items-start">
                            <div>
                                <span class="text-xs font-mono font-bold text-maroon-600 bg-maroon-50 px-2 py-0.5 rounded">${mk.kode}</span>
                                <h2 class="text-sm font-bold text-slate-800 mt-1">${mk.nama}</h2>
                                <p class="text-xs text-slate-500 mt-0.5"><i class="fa-solid fa-chalkboard-user mr-1 text-slate-400"></i> ${mk.dosen}</p>
                                <p class="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">${renderJadwalInfoBar(primaryKelas)}</p>
                            </div>
                            <span class="text-xs font-bold text-slate-600">${mk.sks} SKS</span>
                        </div>

                        <div class="pt-3 border-t border-slate-100">
                            <span class="text-xs font-bold text-slate-700 block mb-2">Bahan Kuliah:</span>
                            ${materials.length === 0 ? `
                                <p class="text-xs text-slate-400 italic">Belum ada materi terunggah.</p>
                            ` : `
                                <div class="space-y-1.5">
                                    ${materials.map(m => `
                                        <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs">
                                            <span class="text-slate-700 font-medium">P${m.pertemuan}: ${m.judul}</span>
                                            <button onclick="downloadFile('${m.judul}.pdf', null, 'Materi ${m.judul}')" class="text-maroon-600 hover:underline font-semibold">
                                                Unduh
                                            </button>
                                        </div>
                                    `).join("")}
                                </div>
                            `}
                        </div>
                    </div>
                    `;
    }).join("")}
            </div>
        `}
    </div>
    `;
}

function renderMahasiswaGrades() {
    const user = appData.currentUser;

    return `
    <div class="space-y-6">
        <div>
            <h1 class="text-xl font-bold text-slate-800">Transkrip Nilai Tugas Saya</h1>
            <p class="text-xs text-slate-500">Nilai resmi dan catatan umpan balik dari Dosen pengampu</p>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                        <th class="p-4">Mata Kuliah</th>
                        <th class="p-4">Komponen Tugas</th>
                        <th class="p-4">Skor Nilai</th>
                        <th class="p-4">Evaluasi / Masukan Dosen</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    ${appData.tugas.length === 0 ? `
                        <tr>
                            <td colspan="4" class="p-8 text-center text-slate-400 text-xs italic">
                                Belum ada komponen penugasan yang tersedia untuk dinilai.
                            </td>
                        </tr>
                    ` : appData.tugas.map(t => {
        const mk = appData.mataKuliah.find(k => k.id === t.matkulId) || { nama: "Mata Kuliah" };
        const sub = (t.submissions || []).find(s => s.mhsId === user.id || s.mhsNim === user.nomor_induk);
        return `
                        <tr>
                            <td class="p-4 font-semibold text-slate-800">${mk.nama}</td>
                            <td class="p-4 text-slate-600">${t.judul}</td>
                            <td class="p-4 font-bold ${sub && sub.nilai !== null ? 'text-emerald-600' : 'text-slate-400'}">
                                ${sub ? (sub.nilai !== null ? `${sub.nilai} / 100` : 'Sedang Diperiksa') : 'Belum Kumpul'}
                            </td>
                            <td class="p-4 text-slate-500 italic">${sub && sub.catatanDosen ? sub.catatanDosen : '-'}</td>
                        </tr>
                        `;
    }).join("")}
                </tbody>
            </table>
        </div>
    </div>
    `;
}
