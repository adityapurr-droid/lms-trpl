/**
 * js/courses.js - Modul Manajemen Matakuliah & Kurikulum TRPL
 * Pengaturan Matakuliah, Bobot SKS, Pembukaan Kelas, dan Penetapan Dosen Pengampu
 */
// =============================================================
// MODUL MATA KULIAH & KELAS (CRUD ADMIN & ATUR DOSEN PENGAMPU)
// =============================================================

function handleSearchCourse(keyword) {
    courseFilter.search = keyword;
    courseFilter.page = 1;
    renderApp();
}

function handleCourseSemesterFilter(value) {
    courseFilter.semester = value;
    courseFilter.page = 1;
    renderApp();
}

function handleCourseAngkatanFilter(value) {
    courseFilter.angkatan = value;
    courseFilter.page = 1;
    renderApp();
}

function resetCourseFilters() {
    courseFilter.search = "";
    courseFilter.semester = "all";
    courseFilter.angkatan = "all";
    courseFilter.page = 1;
    renderApp();
}

function getDosenOptions() {
    if (appData.dosenList && appData.dosenList.length) {
        return appData.dosenList;
    }
    if (appData.users && appData.users.length) {
        const fromUsers = appData.users.filter(u => u.role === 'dosen');
        if (fromUsers.length) return fromUsers;
    }
    return [];
}

function renderAdminCourses() {
    const role = appData.currentUser ? appData.currentUser.role : '';
    const isAdmin = role === 'admin';

    const filterSemester = courseFilter.semester !== "all" ? Number(courseFilter.semester) : null;
    const angkatanFilterValue = courseFilter.angkatan !== "all" ? courseFilter.angkatan : null;
    const hasActiveFilter = !!(courseFilter.search || filterSemester !== null || angkatanFilterValue !== null);

    let filteredMK = getUniqueMataKuliah().filter(mk => {
        const kelasMK = getKelasByMatkul(mk.id);
        if (courseFilter.search) {
            const q = courseFilter.search.toLowerCase();
            const matchKode = (mk.kode || '').toLowerCase().includes(q);
            const matchNama = (mk.nama || '').toLowerCase().includes(q);
            const matchDosen = (mk.dosen || '').toLowerCase().includes(q)
                || kelasMK.some(k => (k.dosen_nama || '').toLowerCase().includes(q));
            const matchRuang = (mk.ruang || mk.ruangan || '').toLowerCase().includes(q)
                || kelasMK.some(k => (k.ruangan || '').toLowerCase().includes(q));
            if (!matchKode && !matchNama && !matchDosen && !matchRuang) return false;
        }
        if (filterSemester !== null && Number(mk.semester_paket) !== filterSemester) return false;
        if (angkatanFilterValue !== null) {
            const punyaKelas = kelasMK.some(k => Number(k.angkatan_id) === Number(angkatanFilterValue));
            if (!punyaKelas) return false;
        }
        return true;
    });

    return `
    <div class="space-y-6">
        <!-- Header Halaman Mata Kuliah -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <i class="fa-solid fa-book-bookmark text-maroon-600"></i>
                    Manajemen Matakuliah
                </h1>
                <p class="text-xs text-slate-500 mt-0.5">
                    Kurikulum aktif, pengaturan Dosen Pengampu, dan pembukaan kelas per angkatan Program Studi TRPL Politeknik Citra Widya Edukasi
                </p>
            </div>

            ${isAdmin ? `
                <button onclick="openModalAddMatkul()" class="px-4 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition shrink-0">
                    <i class="fa-solid fa-circle-plus"></i> Tambah Mata Kuliah
                </button>
            ` : ''}
        </div>

        <!-- Toolbar Pencarian -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div class="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <div class="relative w-full sm:w-72">
                    <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <i class="fa-solid fa-magnifying-glass text-xs"></i>
                    </span>
                    <input type="text" 
                        id="admin-course-search"
                        placeholder="Cari kode MK, nama mata kuliah, dosen..." 
                        value="${courseFilter.search}"
                        oninput="handleSearchCourse(this.value)"
                        class="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-maroon-500 focus:outline-none">
                    ${courseFilter.search ? `
                        <button onclick="handleSearchCourse('')" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600">
                            <i class="fa-solid fa-xmark text-xs"></i>
                        </button>
                    ` : ''}
                </div>

                <select onchange="handleCourseSemesterFilter(this.value)" class="w-full sm:w-36 px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-maroon-500 focus:outline-none">
                    <option value="all" ${courseFilter.semester === "all" ? 'selected' : ''}>Semua Semester</option>
                    ${[1, 2, 3, 4, 5, 6, 7, 8].map(s => `
                        <option value="${s}" ${String(courseFilter.semester) === String(s) ? 'selected' : ''}>Semester ${s}</option>
                    `).join("")}
                </select>

                <select onchange="handleCourseAngkatanFilter(this.value)" class="w-full sm:w-48 px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-maroon-500 focus:outline-none">
                    <option value="all" ${courseFilter.angkatan === "all" ? 'selected' : ''}>Semua Angkatan</option>
                    ${(appData.angkatanList || []).map(a => `
                        <option value="${a.id}" ${String(courseFilter.angkatan) === String(a.id) ? 'selected' : ''}>
                            ${a.nama_angkatan}${a.semester_paket ? ` (Sem ${a.semester_paket})` : ''}
                        </option>
                    `).join("")}
                </select>
            </div>

            <div class="flex items-center gap-3 self-end lg:self-center">
                ${hasActiveFilter ? `
                    <button onclick="resetCourseFilters()" class="text-[11px] font-semibold text-maroon-600 hover:text-maroon-700">
                        <i class="fa-solid fa-rotate-left mr-1"></i> Reset
                    </button>
                ` : ''}
                <div class="text-xs text-slate-500 font-medium">
                    Total: <span class="font-bold text-slate-800">${filteredMK.length}</span> Mata Kuliah
                </div>
            </div>
        </div>

        <!-- Grid Daftar Mata Kuliah -->
        ${filteredMK.length === 0 ? `
            <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-2xl mb-3">
                    <i class="fa-regular fa-folder-open"></i>
                </div>
                <h3 class="text-sm font-bold text-slate-700">Tidak ada mata kuliah yang sesuai</h3>
                <p class="text-xs text-slate-500 mt-1">
                    ${angkatanFilterValue !== null
                        ? 'Belum ada mata kuliah yang dibuka untuk angkatan ini. Gunakan tombol Buka Kelas pada mata kuliah.'
                        : 'Coba sesuaikan kata kunci pencarian atau filter semester/angkatan Anda.'}
                </p>
                ${isAdmin ? `
                    <button onclick="openModalAddMatkul()" class="mt-4 px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition">
                        <i class="fa-solid fa-plus"></i> Tambah Mata Kuliah Sekarang
                    </button>
                ` : ''}
            </div>
        ` : `
            ${(() => {
                const groups = {};
                filteredMK.forEach(mk => {
                    const sem = Number(mk.semester_paket) || 1;
                    if (!groups[sem]) groups[sem] = [];
                    groups[sem].push(mk);
                });
                const semesterList = Object.keys(groups).map(Number).sort((a, b) => a - b);
                return semesterList.map(sem => {
                    const angkatanSem = [...new Set(
                        groups[sem].flatMap(mk => getKelasByMatkul(mk.id).map(k => k.angkatan_nama || k.nama_kelas))
                            .filter(Boolean)
                    )];
                    return `
                    <div class="space-y-3">
                        <div class="flex flex-wrap items-center gap-2.5">
                            <span class="w-8 h-8 rounded-lg bg-maroon-600 text-white flex items-center justify-center text-xs font-bold">${sem}</span>
                            <h2 class="text-sm font-bold text-slate-800">Semester ${sem}</h2>
                            <span class="text-[11px] text-slate-400 font-medium">${groups[sem].length} Mata Kuliah</span>
                            ${angkatanSem.length > 0 ? `
                                <span class="text-[11px] text-slate-400">•</span>
                                <div class="flex flex-wrap items-center gap-1.5">
                                    ${angkatanSem.map(a => `<span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold">${a}</span>`).join("")}
                                </div>
                            ` : ''}
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${groups[sem].map(mk => {
                            const kelasMK = getKelasByMatkul(mk.id);
                            const angkatanLabels = [...new Set(kelasMK.map(k => k.angkatan_nama || k.nama_kelas).filter(Boolean))];
                            const primaryKelas = kelasMK[0] || null;
                            const dosenNama = primaryKelas ? (primaryKelas.dosen_nama || 'Belum Ditentukan') : 'Belum ada kelas';
                            const jadwalTxt = formatJadwal(primaryKelas);
                            const ruangTxt = primaryKelas && primaryKelas.ruangan ? String(primaryKelas.ruangan).trim() : '';
                            return `
                            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between">
                                <div class="space-y-3">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <span class="text-xs font-bold font-mono px-2.5 py-1 bg-maroon-50 text-maroon-700 rounded-lg border border-maroon-100">${mk.kode}</span>
                                        </div>
                                        <span class="text-xs font-bold text-maroon-600 bg-maroon-50/50 px-2 py-0.5 rounded-full border border-maroon-100">${mk.sks} SKS</span>
                                    </div>

                                    <div>
                                        <h3 class="text-base font-bold text-slate-800 leading-snug">${mk.nama}</h3>
                                        ${mk.deskripsi ? `<p class="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">${mk.deskripsi}</p>` : ''}
                                        <div class="flex flex-wrap items-center gap-1.5 mt-2">
                                            <span class="text-[10px] font-semibold text-slate-400">Kelas dibuka:</span>
                                            ${angkatanLabels.length > 0 ? angkatanLabels.map(a => `
                                                <span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-semibold">${a}</span>
                                            `).join("") : `
                                                <span class="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-semibold">Belum dibuka</span>
                                            `}
                                        </div>
                                    </div>

                                    <!-- Daftar Kelas / Rombel yang Dibuka -->
                                    <div class="space-y-2 pt-1">
                                        <div class="flex items-center justify-between text-[11px] font-bold text-slate-700">
                                            <span><i class="fa-solid fa-door-open text-maroon-600 mr-1"></i> Kelas & Jadwal Perkuliahan (${kelasMK.length})</span>
                                        </div>
                                        ${kelasMK.length === 0 ? `
                                            <div class="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                                                <i class="fa-solid fa-circle-info mr-1"></i> Belum ada kelas yang dibuka untuk mata kuliah ini.
                                            </div>
                                        ` : `
                                            <div class="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                                                ${kelasMK.map(k => {
                                                    const kDosen = k.dosen_nama || 'Belum Ditentukan';
                                                    const kJadwal = formatJadwal(k);
                                                    const kRuang = k.ruangan ? String(k.ruangan).trim() : '';
                                                    const kLabel = k.angkatan_nama || k.nama_kelas;
                                                    return `
                                                    <div class="p-3 rounded-xl bg-slate-50/90 border border-slate-200 hover:border-maroon-200 transition space-y-2 text-xs">
                                                        <div class="flex items-center justify-between gap-2">
                                                            <div class="flex items-center gap-1.5 min-w-0">
                                                                <span class="px-2 py-0.5 rounded-md bg-maroon-600 text-white font-extrabold text-[10px] tracking-wide shrink-0">
                                                                    ${k.nama_kelas}
                                                                </span>
                                                                ${kLabel && kLabel !== k.nama_kelas ? `
                                                                    <span class="text-slate-500 font-semibold text-[10px] truncate">
                                                                        (${kLabel})
                                                                    </span>
                                                                ` : ''}
                                                            </div>
                                                            ${isAdmin ? `
                                                            <div class="flex items-center gap-1 shrink-0">
                                                                <button onclick="openModalEditMatkul(${mk.id}, ${k.id})" 
                                                                    title="Edit Dosen & Jadwal Kelas ${k.nama_kelas}"
                                                                    class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition shadow-2xs">
                                                                    <i class="fa-regular fa-pen-to-square"></i> Edit Kelas
                                                                </button>
                                                                <button onclick="confirmDeleteClass(${k.id}, '${(k.nama_kelas || '').replace(/'/g, "\\'")}')" 
                                                                    title="Hapus Kelas ${k.nama_kelas}"
                                                                    class="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition text-[11px]">
                                                                    <i class="fa-regular fa-trash-can"></i>
                                                                </button>
                                                            </div>
                                                            ` : ''}
                                                        </div>

                                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] pt-1.5 border-t border-slate-200/60">
                                                            <div class="flex items-center gap-1.5 text-slate-700 truncate" title="Dosen: ${kDosen}">
                                                                <i class="fa-solid fa-chalkboard-user text-blue-600 text-[10px] shrink-0"></i>
                                                                <span class="truncate font-medium">${kDosen}</span>
                                                            </div>
                                                            <div class="flex items-center justify-start sm:justify-end gap-1.5 text-slate-600 flex-wrap">
                                                                ${kJadwal 
                                                                    ? `<span class="font-medium text-slate-700"><i class="fa-regular fa-clock text-slate-400 mr-1"></i>${kJadwal}</span>`
                                                                    : `<span class="text-amber-600 italic font-medium"><i class="fa-solid fa-calendar-exclamation mr-1"></i>Belum Terjadwal</span>`}
                                                                ${kRuang 
                                                                    ? `<span class="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[10px] text-slate-600"><i class="fa-solid fa-location-dot text-slate-400 mr-1"></i>${kRuang}</span>` 
                                                                    : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    `;
                                                }).join("")}
                                            </div>
                                        `}
                                    </div>
                                </div>

                                ${isAdmin ? `
                                    <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2 text-xs">
                                        <button onclick="openModalAddClass(${mk.id})" 
                                            class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition">
                                            <i class="fa-solid fa-plus"></i> Buka Kelas
                                        </button>
                                        <button onclick="openModalEditMatkul(${mk.id})" 
                                            class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition">
                                            <i class="fa-regular fa-pen-to-square"></i> Edit Mata Kuliah
                                        </button>
                                        <button onclick="openModalDeleteMatkul(${mk.id})" 
                                            class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition">
                                            <i class="fa-regular fa-trash-can"></i> Hapus
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                            `;
                        }).join("")}
                        </div>
                    </div>
                `;
                }).join("");
            })()}
        `}
    </div>
    `;
}

// -------------------------------------------------------------
// MODAL TAMBAH MATA KULIAH (CREATE MATA KULIAH)
// -------------------------------------------------------------
function openModalAddMatkul() {
    if (appData.currentUser.role !== 'admin') {
        showToast("Akses ditolak: Hanya Administrator yang dapat menambahkan mata kuliah.", "error");
        return;
    }

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100">
            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-maroon-50 text-maroon-600 flex items-center justify-center font-bold text-sm">
                        <i class="fa-solid fa-book-bookmark"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm">Tambah Mata Kuliah Baru</h3>
                        <p class="text-[11px] text-slate-400">Tambahkan mata kuliah ke kurikulum semester</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form onsubmit="event.preventDefault(); handleSaveAddMatkul();" class="space-y-3.5 text-xs">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Kode MK <span class="text-rose-500">*</span></label>
                        <input id="mk-add-kode" type="text" maxlength="20" required placeholder="Contoh: RPL105" 
                            class="w-full p-2.5 border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-maroon-500">
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Bobot SKS <span class="text-rose-500">*</span></label>
                        <input id="mk-add-sks" type="number" min="1" max="8" value="3" required 
                            class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Semester <span class="text-rose-500">*</span></label>
                        <select id="mk-add-semester" required class="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-maroon-500">
                            <option value="">-- Pilih Semester --</option>
                            ${[1, 2, 3, 4, 5, 6, 7, 8].map(s => `<option value="${s}">Semester ${s}</option>`).join("")}
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Nama Mata Kuliah <span class="text-rose-500">*</span></label>
                    <input id="mk-add-nama" type="text" maxlength="100" required placeholder="Contoh: Keamanan Jaringan & Data" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Deskripsi / Silabus Singkat</label>
                    <textarea id="mk-add-deskripsi" rows="2" maxlength="1000" placeholder="Ringkasan pokok bahasan mata kuliah..." 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500"></textarea>
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600">Batal</button>
                    <button type="submit" class="px-5 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl font-semibold shadow-sm transition">
                        <i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Mata Kuliah
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;
}

async function handleSaveAddMatkul() {
    const kodeEl = document.getElementById("mk-add-kode");
    const namaEl = document.getElementById("mk-add-nama");
    const sksEl = document.getElementById("mk-add-sks");
    const semEl = document.getElementById("mk-add-semester");
    const deskEl = document.getElementById("mk-add-deskripsi");

    const kode = kodeEl.value.trim().toUpperCase();
    const nama = namaEl.value.trim();
    const sks = parseInt(sksEl.value);
    const semester_paket = parseInt(semEl.value);
    const deskripsi = deskEl.value.trim();

    if (!Validator.isValidLength(kode, 2, 20)) {
        showToast("Kode mata kuliah harus antara 2 hingga 20 karakter!", "error");
        return;
    }
    if (!Validator.isValidLength(nama, 3, 100)) {
        showToast("Nama mata kuliah harus antara 3 hingga 100 karakter!", "error");
        return;
    }
    if (isNaN(sks) || sks < 1 || sks > 8) {
        showToast("SKS harus berupa angka antara 1 sampai 8!", "error");
        return;
    }
    if (!semester_paket) {
        showToast("Semester harus dipilih!", "error");
        return;
    }

    const payload = {
        kode,
        nama,
        sks,
        semester_paket,
        deskripsi
    };

    try {
        const res = await fetch("api.php?action=create_mata_kuliah", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.success) {
            showToast(data.message || "Gagal menambahkan mata kuliah.", "error");
            return;
        }

        const newMatkul = data.matkul || {
            id: Date.now(),
            kode,
            nama,
            sks,
            semester_paket,
            deskripsi
        };

        appData.mataKuliah.push(newMatkul);

        closeModal();
        renderApp();
        showToast(`Mata kuliah "${nama}" (${kode}) berhasil ditambahkan!`, "success");
    } catch (err) {
        const newMatkul = {
            id: Date.now(),
            kode,
            nama,
            sks,
            semester_paket,
            deskripsi
        };
        appData.mataKuliah.push(newMatkul);
        closeModal();
        renderApp();
        showToast(`Mata kuliah "${nama}" (${kode}) berhasil disimpan di memori.`, "success");
    }
}

// -------------------------------------------------------------
// MODAL EDIT MATA KULIAH & ATUR DOSEN PENGAMPU
// -------------------------------------------------------------
function openModalEditMatkul(mkId, targetKelasId = null) {
    if (appData.currentUser.role !== 'admin') {
        showToast("Akses ditolak: Hanya Administrator yang dapat mengubah data mata kuliah.", "error");
        return;
    }

    const mk = appData.mataKuliah.find(m => Number(m.id) === Number(mkId));
    if (!mk) {
        showToast("Mata kuliah tidak ditemukan!", "error");
        return;
    }

    const dosenList = getDosenOptions();
    const kelasMK = getKelasByMatkul(mk.id);
    const selectedKelas = targetKelasId !== null
        ? (kelasMK.find(k => Number(k.id) === Number(targetKelasId)) || kelasMK[0] || null)
        : (kelasMK[0] || null);

    const initialDosenId = selectedKelas ? selectedKelas.dosen_id : mk.dosen_id;
    const initialHari = selectedKelas ? selectedKelas.hari : mk.hari;
    // Jangan mengarang jam: bila kelas belum terjadwal, biarkan kosong (honest empty state).
    const initialJamPair = parseJamKelas(selectedKelas) || { mulai: '', selesai: '' };
    const initialRuang = selectedKelas ? selectedKelas.ruangan : (mk.ruang || mk.ruangan);
    const initialNamaKelas = selectedKelas ? selectedKelas.nama_kelas : '';
    const noKelas = kelasMK.length === 0;
    const kelasFieldsDisabled = noKelas ? 'disabled' : '';

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100">
            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
                        <i class="fa-regular fa-pen-to-square"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm">Edit Mata Kuliah & Atur Dosen Pengampu</h3>
                        <p class="text-[11px] text-slate-400">Perbarui kurikulum mata kuliah dan atur dosen/jadwal tiap kelas</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form onsubmit="event.preventDefault(); handleSaveEditMatkul(${mk.id}); return false;" class="space-y-3.5 text-xs">
                ${kelasMK.length > 0 ? `
                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div>
                        <label class="block font-bold text-slate-700 mb-1">
                            <i class="fa-solid fa-door-open text-maroon-600 mr-1"></i> Pilih Kelas / Rombel yang Diatur
                        </label>
                        <select id="mk-edit-kelas" onchange="handleEditMatkulKelasChange(${mk.id})" class="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-800 focus:ring-2 focus:ring-maroon-500">
                            ${kelasMK.map(k => `
                                <option value="${k.id}" ${selectedKelas && Number(selectedKelas.id) === Number(k.id) ? 'selected' : ''}>
                                    ${k.nama_kelas} (${k.angkatan_nama || 'Angkatan belum diatur'} - ${k.semester_nama || 'Semester belum diatur'})
                                </option>
                            `).join("")}
                        </select>
                        <p class="text-[10px] text-slate-500 mt-1">Nama kelas, dosen pengampu, dan jadwal di bawah berlaku untuk kelas yang dipilih di atas.</p>
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Nama Kelas / Rombel</label>
                        <input id="mk-edit-nama-kelas" type="text" maxlength="30" value="${initialNamaKelas || ''}" required placeholder="Contoh: TRPL 2026 B" 
                            class="w-full p-2.5 border border-slate-300 rounded-xl font-bold uppercase focus:ring-2 focus:ring-maroon-500">
                    </div>
                </div>
                ` : `
                <div class="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[11px] text-amber-700 font-medium">
                    <i class="fa-solid fa-circle-info mr-1"></i> Mata kuliah ini belum memiliki kelas. Gunakan tombol "Buka Kelas" untuk menambahkannya.
                </div>
                `}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Kode MK <span class="text-rose-500">*</span></label>
                        <input id="mk-edit-kode" type="text" maxlength="20" required value="${mk.kode || ''}" 
                            class="w-full p-2.5 border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-maroon-500">
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Bobot SKS <span class="text-rose-500">*</span></label>
                        <input id="mk-edit-sks" type="number" min="1" max="8" value="${mk.sks || 3}" required 
                            class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Semester <span class="text-rose-500">*</span></label>
                        <select id="mk-edit-semester" required class="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-maroon-500">
                            ${[1, 2, 3, 4, 5, 6, 7, 8].map(s => `<option value="${s}" ${(mk.semester_paket == s) ? 'selected' : ''}>Semester ${s}</option>`).join("")}
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Nama Mata Kuliah <span class="text-rose-500">*</span></label>
                    <input id="mk-edit-nama" type="text" maxlength="100" required value="${mk.nama || ''}" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                </div>

                <div class="p-3 bg-maroon-50/60 rounded-xl border border-maroon-100 space-y-1.5">
                    <label class="block font-bold text-maroon-900">
                        <i class="fa-solid fa-user-check text-maroon-600 mr-1"></i> Atur Dosen Pengampu <span class="text-rose-500">*</span>
                    </label>
                    <select id="mk-edit-dosen" ${noKelas ? 'disabled' : (dosenList.length ? 'required' : '')} class="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium focus:ring-2 focus:ring-maroon-500 disabled:bg-slate-100 disabled:text-slate-400">
                        <option value="">-- Pilih Dosen Pengampu --</option>
                        ${dosenList.length === 0 ? `
                            <option value="" disabled>Belum ada akun Dosen lain terdaftar</option>
                        ` : dosenList.map(d => {
        const isSelected = initialDosenId && Number(initialDosenId) === Number(d.id);
        return `<option value="${d.id}" ${isSelected ? 'selected' : ''}>${d.nama} (${d.nomor_induk || d.email})</option>`;
    }).join("")}
                    </select>
                    <p class="text-[10px] text-slate-500">Hanya dosen yang dipilih di sini yang dapat membuat & mengelola tugas untuk kelas ini.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Hari Perkuliahan</label>
                        <select id="mk-edit-hari" ${kelasFieldsDisabled} class="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-maroon-500 disabled:bg-slate-100 disabled:text-slate-400">
                            ${['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map(h => `
                                <option value="${h}" ${initialHari === h ? 'selected' : ''}>${h}</option>
                            `).join("")}
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block font-semibold text-slate-700 mb-1">Jam Mulai</label>
                            <input id="mk-edit-jam-mulai" type="time" value="${initialJamPair.mulai}" ${kelasFieldsDisabled}
                                class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500 disabled:bg-slate-100 disabled:text-slate-400">
                        </div>
                        <div>
                            <label class="block font-semibold text-slate-700 mb-1">Jam Selesai</label>
                            <input id="mk-edit-jam-selesai" type="time" value="${initialJamPair.selesai}" ${kelasFieldsDisabled}
                                class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500 disabled:bg-slate-100 disabled:text-slate-400">
                        </div>
                    </div>
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Ruangan / Laboratorium</label>
                    <input id="mk-edit-ruangan" type="text" maxlength="50" value="${initialRuang || ''}" placeholder="Contoh: Lab Komputer 1" ${kelasFieldsDisabled}
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500 disabled:bg-slate-100 disabled:text-slate-400">
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Deskripsi / Silabus Singkat</label>
                    <textarea id="mk-edit-deskripsi" rows="2" maxlength="1000" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">${mk.deskripsi || ''}</textarea>
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600">Batal</button>
                    <button type="submit" class="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold shadow-sm transition">
                        <i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Perubahan
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;
}

function handleEditMatkulKelasChange(mkId) {
    const kelasEl = document.getElementById("mk-edit-kelas");
    if (!kelasEl) return;
    const kelas = getKelasByMatkul(mkId).find(k => Number(k.id) === Number(kelasEl.value));
    if (!kelas) return;

    const namaKelasEl = document.getElementById("mk-edit-nama-kelas");
    const dosenEl = document.getElementById("mk-edit-dosen");
    const hariEl = document.getElementById("mk-edit-hari");
    const mulaiEl = document.getElementById("mk-edit-jam-mulai");
    const selesaiEl = document.getElementById("mk-edit-jam-selesai");
    const ruangEl = document.getElementById("mk-edit-ruangan");

    if (namaKelasEl) namaKelasEl.value = kelas.nama_kelas || '';
    if (dosenEl) dosenEl.value = kelas.dosen_id ? String(kelas.dosen_id) : '';
    const jamPair = parseJamKelas(kelas);
    if (mulaiEl) mulaiEl.value = jamPair ? jamPair.mulai : '';
    if (selesaiEl) selesaiEl.value = jamPair ? jamPair.selesai : '';
    if (hariEl) hariEl.value = kelas.hari || 'Senin';
    if (ruangEl) ruangEl.value = kelas.ruangan || '';
}

async function handleSaveEditMatkul(mkId) {
    const mk = appData.mataKuliah.find(m => Number(m.id) === Number(mkId));
    if (!mk) return;

    const kode = document.getElementById("mk-edit-kode").value.trim().toUpperCase();
    const nama = document.getElementById("mk-edit-nama").value.trim();
    const sks = parseInt(document.getElementById("mk-edit-sks").value);
    const semester_paket = parseInt(document.getElementById("mk-edit-semester").value);
    const dosenEl = document.getElementById("mk-edit-dosen");
    const dosen_id = dosenEl && dosenEl.value ? parseInt(dosenEl.value) : null;
    const hari = document.getElementById("mk-edit-hari").value.trim();
    const jamMulai = document.getElementById("mk-edit-jam-mulai").value;
    const jamSelesai = document.getElementById("mk-edit-jam-selesai").value;
    const ruangan = document.getElementById("mk-edit-ruangan").value.trim();
    const deskripsi = document.getElementById("mk-edit-deskripsi").value.trim();
    const kelasEl = document.getElementById("mk-edit-kelas");
    const kelas_id = kelasEl && kelasEl.value ? parseInt(kelasEl.value) : null;
    const namaKelasEl = document.getElementById("mk-edit-nama-kelas");
    const nama_kelas = namaKelasEl ? namaKelasEl.value.trim() : '';

    // Jadwal opsional: boleh kosong (belum terjadwal), tapi bila diisi harus lengkap & valid.
    const adaJam = !!jamMulai || !!jamSelesai;
    if (kelas_id && adaJam && (!jamMulai || !jamSelesai || toMinutes(jamSelesai) <= toMinutes(jamMulai))) {
        showToast("Lengkapi jam mulai dan jam selesai (jam selesai harus setelah jam mulai)!", "error");
        return;
    }
    const jam = jamMulai && jamSelesai ? `${jamMulai} - ${jamSelesai}` : '';
    // Hari hanya dikirim bila jam benar-benar diisi; kelas tanpa jam = belum terjadwal.
    const hariFinal = jam ? hari : '';

    if (!Validator.isValidLength(kode, 2, 20)) {
        showToast("Kode mata kuliah harus antara 2 hingga 20 karakter!", "error");
        return;
    }
    if (!Validator.isValidLength(nama, 3, 100)) {
        showToast("Nama mata kuliah harus antara 3 hingga 100 karakter!", "error");
        return;
    }
    if (isNaN(sks) || sks < 1 || sks > 8) {
        showToast("SKS harus berupa angka antara 1 sampai 8!", "error");
        return;
    }

    const payload = {
        id: mkId,
        kode,
        nama,
        sks,
        semester_paket,
        dosen_id,
        nama_kelas,
        hari: hariFinal,
        jam,
        jam_mulai: jamMulai || null,
        jam_selesai: jamSelesai || null,
        ruangan,
        deskripsi,
        kelas_id
    };

    const selectedDosen = getDosenOptions().find(d => Number(d.id) === Number(dosen_id));
    const applyLocal = () => {
        mk.kode = kode;
        mk.nama = nama;
        mk.sks = sks;
        mk.semester_paket = semester_paket;
        mk.deskripsi = deskripsi;

        if (!kelas_id) return;
        const kelas = getKelasByMatkul(mkId).find(k => Number(k.id) === Number(kelas_id));
        if (!kelas) return;
        if (nama_kelas) kelas.nama_kelas = nama_kelas;
        kelas.dosen_id = dosen_id;
        kelas.dosen_nama = selectedDosen ? selectedDosen.nama : 'Belum Ditentukan';
        kelas.nama_mk = nama;
        kelas.kode_mk = kode;
        kelas.sks = sks;
        kelas.semester_paket = semester_paket;
        kelas.hari = hariFinal || null;
        kelas.jam = jam || null;
        kelas.jam_mulai = jamMulai || null;
        kelas.jam_selesai = jamSelesai || null;
        kelas.ruangan = ruangan || null;
        kelas.jadwal = formatJadwal(kelas);
    };

    try {
        const res = await fetch("api.php?action=update_mata_kuliah", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.success) {
            showToast(data.message || "Gagal memperbarui mata kuliah.", "error");
            return;
        }

        applyLocal();
        closeModal();
        await loadAppData();
        showToast(`Mata kuliah "${nama}" berhasil diperbarui!`, "success");
    } catch (err) {
        showToast("Gagal menyimpan perubahan ke server. Perubahan tidak dikirim.", "error");
    }
}

// -------------------------------------------------------------
// KONFIRMASI HAPUS KELAS / ROMBEL PERKULIAHAN
// -------------------------------------------------------------
function confirmDeleteClass(classId, className) {
    if (appData.currentUser.role !== 'admin') {
        showToast("Akses ditolak: Hanya Administrator yang dapat menghapus kelas.", "error");
        return;
    }
    openConfirmModal({
        title: "Konfirmasi Hapus Kelas",
        message: `Apakah Anda yakin ingin menghapus kelas <strong>"${className}"</strong>?<br><br>Seluruh jadwal dan enrolmen mahasiswa pada kelas ini akan ikut terhapus secara permanen.`,
        confirmText: "Ya, Hapus Kelas",
        confirmColor: "bg-rose-600 hover:bg-rose-700",
        onConfirm: async () => {
            try {
                const res = await fetch("api.php?action=delete_class", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: classId })
                });
                const data = await res.json();
                if (data.success) {
                    showToast(data.message || "Kelas berhasil dihapus!", "success");
                    await loadAppData();
                    renderApp();
                } else {
                    showToast(data.message || "Gagal menghapus kelas.", "error");
                }
            } catch (e) {
                showToast("Terjadi kesalahan saat menghubungi server.", "error");
            }
        }
    });
}

// -------------------------------------------------------------
// MODAL HAPUS MATA KULIAH (DELETE MATA KULIAH - DENGAN KONFIRMASI)
// -------------------------------------------------------------
function openModalDeleteMatkul(mkId) {
    if (appData.currentUser.role !== 'admin') {
        showToast("Akses ditolak: Hanya Administrator yang dapat menghapus mata kuliah.", "error");
        return;
    }

    const mk = appData.mataKuliah.find(m => Number(m.id) === Number(mkId));
    if (!mk) return;

    openConfirmModal({
        title: "Konfirmasi Hapus Mata Kuliah",
        message: `Apakah Anda yakin ingin menghapus mata kuliah <strong>"${mk.nama}"</strong> (${mk.kode})?<br><br>Seluruh kelas, penugasan, dan materi terkait mata kuliah ini akan ikut terhapus secara permanen.`,
        confirmText: "Ya, Hapus Mata Kuliah",
        confirmColor: "bg-rose-600 hover:bg-rose-700",
        onConfirm: async () => {
            try {
                const res = await fetch("api.php?action=delete_mata_kuliah", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: mkId })
                });
                const data = await res.json();
                if (!data.success) {
                    showToast(data.message || "Gagal menghapus mata kuliah.", "error");
                    return;
                }
            } catch (err) { }

            appData.mataKuliah = appData.mataKuliah.filter(m => Number(m.id) !== Number(mkId));
            renderApp();
            showToast(`Mata kuliah "${mk.nama}" telah berhasil dihapus.`, "success");
        }
    });
}
