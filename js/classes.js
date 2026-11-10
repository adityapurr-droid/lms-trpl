/**
 * js/classes.js - Modul Manajemen Kelas & Angkatan Rombel
 * CRUD Kategori Angkatan, Pengelompokan Mahasiswa, dan Kelas Perkuliahan
 */
// =============================================================
// MODUL LENGKAP: MANAJEMEN KELAS & ROMBONGAN BELAJAR (ADMIN CRUD)
// =============================================================

function renderAdminClasses() {
    let angkatanData = appData.angkatanList || [];

    if (angkatanFilter.search) {
        const q = angkatanFilter.search.toLowerCase();
        angkatanData = angkatanData.filter(a => 
            (a.nama_angkatan || '').toLowerCase().includes(q) ||
            (a.tahun || '').toLowerCase().includes(q) ||
            (a.keterangan || '').toLowerCase().includes(q)
        );
    }

    const totalItems = angkatanData.length;
    const totalPages = Math.ceil(totalItems / angkatanFilter.perPage) || 1;
    if (angkatanFilter.page > totalPages) angkatanFilter.page = totalPages;
    const startIndex = (angkatanFilter.page - 1) * angkatanFilter.perPage;
    const paginatedAngkatan = angkatanData.slice(startIndex, startIndex + angkatanFilter.perPage);

    let kelasData = (appData.kelasList || []).filter(k => {
        if (classFilter.search) {
            const q = classFilter.search.toLowerCase();
            const match = [
                k.nama_kelas || '',
                k.kode_mk || '',
                k.nama_mk || '',
                k.dosen_nama || '',
                k.ruangan || ''
            ].some(v => String(v).toLowerCase().includes(q));
            if (!match) return false;
        }
        if (classFilter.angkatan !== 'all') {
            const angkatanKelas = k.angkatan_id || ((appData.angkatanList || []).find(a => a.nama_angkatan === getKelasAngkatanNama(k)) || {}).id;
            if (String(angkatanKelas || '') !== String(classFilter.angkatan)) return false;
        }
        if (classFilter.semesterId !== 'all' && String(k.semester_id || '') !== String(classFilter.semesterId)) return false;
        return true;
    });

    const totalKelas = kelasData.length;
    const totalKelasPages = Math.ceil(totalKelas / classFilter.perPage) || 1;
    if (classFilter.page > totalKelasPages) classFilter.page = totalKelasPages;
    const startKelas = (classFilter.page - 1) * classFilter.perPage;
    const paginatedKelas = kelasData.slice(startKelas, startKelas + classFilter.perPage);
    const hasClassFilter = !!(classFilter.search || classFilter.angkatan !== 'all' || classFilter.semesterId !== 'all');

    return `
    <div class="space-y-6">
        <!-- Header Halaman -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <i class="fa-solid fa-users-line text-maroon-600"></i>
                    Manajemen Kelas
                </h1>
                <p class="text-xs text-slate-500 mt-0.5">Kelola angkatan, rombongan belajar, dosen pengampu, dan jadwal kelas.</p>
            </div>
            <button onclick="openModalAddAngkatan()" class="px-4 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition shrink-0">
                <i class="fa-solid fa-plus"></i> Tambah Angkatan Baru
            </button>
        </div>

        <!-- Toolbar Pencarian -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div class="relative">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <i class="fa-solid fa-magnifying-glass text-xs"></i>
                </span>
                <input type="text" 
                    id="admin-angkatan-search"
                    placeholder="Cari nama angkatan atau keterangan..." 
                    value="${angkatanFilter.search}"
                    oninput="handleAngkatanSearch(this.value)"
                    class="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-maroon-500 focus:outline-none">
            </div>
        </div>

        <!-- Daftar Angkatan (Grid Cards) -->
        ${totalItems === 0 ? `
            <div class="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm">
                <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-2xl mb-3">
                    <i class="fa-solid fa-users-line"></i>
                </div>
                <h3 class="text-sm font-bold text-slate-700">Belum Ada Angkatan</h3>
                <p class="text-xs text-slate-500 mt-1">Klik tombol Tambah Angkatan Baru untuk memulai.</p>
                <button onclick="angkatanFilter.search=''; renderApp();" class="mt-4 px-4 py-2 bg-maroon-50 hover:bg-maroon-100 text-maroon-700 font-semibold rounded-xl text-xs transition">
                    Reset Pencarian
                </button>
            </div>
        ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                ${paginatedAngkatan.map(ang => {
                    const mahasiswaList = (appData.users || []).filter(u => u.role === 'mahasiswa' && u.angkatan_id === ang.id);
                    const jmlMhs = mahasiswaList.length;
                    const semesterMapping = getAngkatanSemesterMapping(ang.id);
                    const kelasAngkatan = (appData.kelasList || []).filter(k => {
                        const kAngId = k.angkatan_id || ((appData.angkatanList || []).find(a => a.nama_angkatan === getKelasAngkatanNama(k)) || {}).id;
                        if (kAngId === null || kAngId === undefined || kAngId === '') return false;
                        return Number(kAngId) === Number(ang.id);
                    });
                    const activeSemester = getActiveSemester();
                    const kelasSemesterIni = activeSemester
                        ? kelasAngkatan.filter(k => Number(k.semester_id) === Number(activeSemester.id))
                        : [];
                    const kelasScope = kelasSemesterIni.length ? kelasSemesterIni : kelasAngkatan;
                    const mkIds = new Set();
                    kelasScope.forEach(k => {
                        const mkId = k.mata_kuliah_id;
                        if (mkId === null || mkId === undefined) return;
                        mkIds.add(Number(mkId));
                    });
                    const jmlMatkul = mkIds.size;
                    const paketDerivasi = semesterMapping ? null : getAngkatanPaketFromKelas(ang.id);
                    const paketAktif = semesterMapping ? Number(semesterMapping.semester_paket) : paketDerivasi;

                    return `
                    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden">
                        <div class="p-5 space-y-4">
                            <!-- Header Angkatan -->
                            <div class="flex items-start justify-between gap-2">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 flex-wrap mb-2">
                                        <span class="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-maroon-600 text-white shadow-xs">
                                            ${ang.nama_angkatan}
                                        </span>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                            Tahun ${ang.tahun}
                                        </span>
                                        ${semesterMapping ? `
                                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                Semester ${semesterMapping.semester_paket} · ${semesterMapping.semester_nama}
                                            </span>
                                        ` : paketDerivasi !== null ? `
                                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                                                Semester ${paketDerivasi} · dari kelas
                                            </span>
                                        ` : `
                                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                                                Semester belum diatur
                                            </span>
                                        `}
                                    </div>
                                    <p class="text-xs text-slate-600 leading-relaxed">
                                        ${ang.keterangan || 'Rombongan Belajar Mahasiswa TRPL'}
                                    </p>
                                </div>
                            </div>

                            <!-- Info Mahasiswa -->
                            <div class="pt-3 border-t border-slate-100 space-y-3">
                                <div class="flex items-center justify-between text-xs">
                                    <div class="flex items-center gap-2">
                                        <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                                            <i class="fa-solid fa-users"></i>
                                        </div>
                                        <div>
                                            <p class="text-[10px] text-slate-400 font-semibold">Jumlah Mahasiswa:</p>
                                            <p class="font-bold text-slate-700">${jmlMhs} Mahasiswa</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                                    <div class="flex items-center gap-2">
                                        <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                            <i class="fa-solid fa-book-open"></i>
                                        </div>
                                        <div>
                                            <p class="text-[10px] text-slate-400 font-semibold">Mata Kuliah Semester Ini:</p>
                                            <p class="font-bold text-slate-700">${paketAktif ? `${jmlMatkul} Mata Kuliah` : 'Belum diatur'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                            <button onclick="openModalManageAngkatanStudents(${ang.id})" class="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-user-plus"></i> Kelola Mahasiswa
                            </button>
                            <button onclick="openModalEditAngkatan(${ang.id})" class="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="confirmDeleteAngkatan(${ang.id}, '${ang.nama_angkatan.replace(/'/g, "\\'")}')" class="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-semibold transition">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    `;
                }).join("")}
            </div>

            <!-- Paginasi -->
            ${totalPages > 1 ? `
                <div class="flex items-center justify-center gap-2">
                    <button onclick="angkatanFilter.page = Math.max(1, angkatanFilter.page - 1); renderApp();" 
                        class="px-3 py-1.5 rounded-lg text-xs font-semibold ${angkatanFilter.page === 1 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}" 
                        ${angkatanFilter.page === 1 ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <span class="text-xs text-slate-600 font-medium">Halaman ${angkatanFilter.page} dari ${totalPages}</span>
                    <button onclick="angkatanFilter.page = Math.min(${totalPages}, angkatanFilter.page + 1); renderApp();" 
                        class="px-3 py-1.5 rounded-lg text-xs font-semibold ${angkatanFilter.page === totalPages ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}" 
                        ${angkatanFilter.page === totalPages ? 'disabled' : ''}>
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
            ` : ''}
        `}
    </div>
    `;
}






function handleAngkatanSearch(val) {
    angkatanFilter.search = val;
    angkatanFilter.page = 1;
    renderApp();
}

// -------------------------------------------------------------
// MODAL TAMBAH ANGKATAN (CREATE ANGKATAN - ADMIN)
// -------------------------------------------------------------
function openModalAddAngkatan() {
    const modal = document.getElementById("modal-container");

    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100">
            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-maroon-50 text-maroon-600 flex items-center justify-center font-bold text-sm">
                        <i class="fa-solid fa-plus"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm">Tambah Angkatan Baru</h3>
                        <p class="text-[11px] text-slate-400">Buat rombongan belajar baru</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form onsubmit="event.preventDefault(); handleSaveAddAngkatan();" class="space-y-3.5 text-xs">
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">
                        Nama Angkatan <span class="text-rose-500">*</span>
                    </label>
                    <input id="angkatan-add-nama" type="text" maxlength="50" required placeholder="Contoh: Angkatan 2026 A" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-maroon-500">
                    <p class="text-[10px] text-slate-400 mt-1">Format: Angkatan [TAHUN] [KODE KELAS], misal: Angkatan 2026 A</p>
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Tahun Angkatan <span class="text-rose-500">*</span></label>
                    <input id="angkatan-add-tahun" type="text" maxlength="10" required placeholder="2026" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Keterangan</label>
                    <textarea id="angkatan-add-keterangan" maxlength="255" rows="2" placeholder="Keterangan tambahan (opsional)" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500 resize-none"></textarea>
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600">Batal</button>
                    <button type="submit" class="px-5 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl font-semibold shadow-sm transition">
                        <i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Angkatan
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;
}

async function handleSaveAddAngkatan() {
    const nama = document.getElementById("angkatan-add-nama").value.trim();
    const tahun = document.getElementById("angkatan-add-tahun").value.trim();
    const keterangan = document.getElementById("angkatan-add-keterangan").value.trim();

    if (!nama || !tahun) {
        showToast("Nama angkatan dan tahun wajib diisi!", "error");
        return;
    }

    const payload = { nama_angkatan: nama, tahun, keterangan };

    try {
        const res = await fetch("api.php?action=create_angkatan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.angkatan) {
            appData.angkatanList.push(data.angkatan);
            closeModal();
            renderApp();
            showToast(`Angkatan "${nama}" berhasil dibuat!`, "success");
            return;
        } else if (!data.success) {
            showToast(data.message || "Gagal membuat angkatan.", "error");
            return;
        }
    } catch (e) {
        showToast("Gagal terhubung ke server. Pastikan koneksi database aktif.", "error");
    }
}

// -------------------------------------------------------------
// MODAL EDIT ANGKATAN (UPDATE ANGKATAN - ADMIN)
// -------------------------------------------------------------
function openModalEditAngkatan(angkatanId) {
    const ang = (appData.angkatanList || []).find(a => a.id === angkatanId);
    if (!ang) return;

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100">
            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                        <i class="fa-solid fa-pen"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm">Edit Angkatan</h3>
                        <p class="text-[11px] text-slate-400">${ang.nama_angkatan}</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form onsubmit="event.preventDefault(); handleSaveEditAngkatan(${ang.id});" class="space-y-3.5 text-xs">
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Nama Angkatan <span class="text-rose-500">*</span></label>
                    <input id="angkatan-edit-nama" type="text" maxlength="50" required value="${ang.nama_angkatan}" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-maroon-500">
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Tahun Angkatan <span class="text-rose-500">*</span></label>
                    <input id="angkatan-edit-tahun" type="text" maxlength="10" required value="${ang.tahun}" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Keterangan</label>
                    <textarea id="angkatan-edit-keterangan" maxlength="255" rows="2" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500 resize-none">${ang.keterangan || ''}</textarea>
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600">Batal</button>
                    <button type="submit" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition">
                        <i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Perubahan
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;
}

async function handleSaveEditAngkatan(angkatanId) {
    const nama = document.getElementById("angkatan-edit-nama").value.trim();
    const tahun = document.getElementById("angkatan-edit-tahun").value.trim();
    const keterangan = document.getElementById("angkatan-edit-keterangan").value.trim();

    if (!nama || !tahun) {
        showToast("Nama angkatan dan tahun wajib diisi!", "error");
        return;
    }

    const payload = { id: angkatanId, nama_angkatan: nama, tahun, keterangan };

    try {
        const res = await fetch("api.php?action=update_angkatan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.angkatan) {
            const idx = appData.angkatanList.findIndex(a => a.id === angkatanId);
            if (idx !== -1) appData.angkatanList[idx] = data.angkatan;
            closeModal();
            renderApp();
            showToast(`Angkatan "${nama}" berhasil diperbarui!`, "success");
            return;
        } else if (!data.success) {
            showToast(data.message || "Gagal memperbarui angkatan.", "error");
            return;
        }
    } catch (e) {
        showToast("Gagal terhubung ke server.", "error");
    }
}

// -------------------------------------------------------------
// MODAL KELOLA MAHASISWA ANGKATAN (MANAGE STUDENTS - ADMIN)
// -------------------------------------------------------------
function openModalManageAngkatanStudents(angkatanId) {
    const ang = (appData.angkatanList || []).find(a => a.id === angkatanId);
    if (!ang) return;

    const allMahasiswa = (appData.users || []).filter(u => u.role === 'mahasiswa');
    const angkatanMhs = allMahasiswa.filter(u => u.angkatan_id === angkatanId);
    const availableMhs = allMahasiswa.filter(u => !u.angkatan_id || u.angkatan_id === angkatanId);

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-3xl rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
            <div class="p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                        <i class="fa-solid fa-users"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm">Kelola Mahasiswa ${ang.nama_angkatan}</h3>
                        <p class="text-[11px] text-slate-400">${angkatanMhs.length} mahasiswa terdaftar</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <div class="flex-1 overflow-y-auto p-5 space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Daftar Mahasiswa di Angkatan Ini -->
                    <div>
                        <h4 class="text-xs font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <i class="fa-solid fa-user-check text-emerald-600"></i> Mahasiswa Terdaftar (${angkatanMhs.length})
                        </h4>
                        <div class="bg-slate-50 rounded-xl p-3 space-y-2 max-h-64 overflow-y-auto">
                            ${angkatanMhs.length === 0 ? `
                                <p class="text-xs text-slate-500 text-center py-4">Belum ada mahasiswa terdaftar di angkatan ini.</p>
                            ` : angkatanMhs.map(mhs => `
                                <div class="bg-white rounded-lg p-2.5 flex items-center justify-between border border-slate-200">
                                    <div class="flex items-center gap-2 min-w-0">
                                        ${getUserAvatar(mhs, "w-8 h-8 text-xs", "rounded-lg")}
                                        <div class="min-w-0">
                                            <p class="text-xs font-semibold text-slate-800 truncate">${mhs.nama}</p>
                                            <p class="text-[10px] text-slate-500">${mhs.nomor_induk}</p>
                                        </div>
                                    </div>
                                    <button onclick="removeMahasiswaFromAngkatan(${mhs.id}, ${angkatanId})" class="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition shrink-0" title="Keluarkan dari angkatan">
                                        <i class="fa-solid fa-user-minus text-xs"></i>
                                    </button>
                                </div>
                            `).join("")}
                        </div>
                    </div>

                    <!-- Tambah Mahasiswa ke Angkatan -->
                    <div>
                        <h4 class="text-xs font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <i class="fa-solid fa-user-plus text-blue-600"></i> Tambah Mahasiswa
                        </h4>
                        <div class="bg-blue-50 rounded-xl p-3 space-y-2 max-h-64 overflow-y-auto">
                            ${availableMhs.filter(m => !m.angkatan_id || m.angkatan_id !== angkatanId).length === 0 ? `
                                <p class="text-xs text-slate-500 text-center py-4">Semua mahasiswa sudah terdaftar di angkatan.</p>
                            ` : availableMhs.filter(m => !m.angkatan_id || m.angkatan_id !== angkatanId).map(mhs => `
                                <div class="bg-white rounded-lg p-2.5 flex items-center justify-between border border-blue-100">
                                    <div class="flex items-center gap-2 min-w-0">
                                        ${getUserAvatar(mhs, "w-8 h-8 text-xs", "rounded-lg")}
                                        <div class="min-w-0">
                                            <p class="text-xs font-semibold text-slate-800 truncate">${mhs.nama}</p>
                                            <p class="text-[10px] text-slate-500">${mhs.nomor_induk}</p>
                                        </div>
                                    </div>
                                    <button onclick="addMahasiswaToAngkatan(${mhs.id}, ${angkatanId})" class="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-100 transition shrink-0" title="Tambahkan ke angkatan ini">
                                        <i class="fa-solid fa-plus text-xs"></i>
                                    </button>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
                <button onclick="closeModal()" class="px-4 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-600 text-xs hover:bg-slate-50 transition">Tutup</button>
            </div>
        </div>
    </div>
    `;
}

async function addMahasiswaToAngkatan(mahasiswaId, angkatanId) {
    const ang = appData.angkatanList.find(a => a.id === angkatanId);
    const mhs = appData.users.find(u => u.id === mahasiswaId);
    if (!ang || !mhs) return;

    try {
        const res = await fetch("api.php?action=assign_mahasiswa_to_angkatan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mahasiswa_id: mahasiswaId, angkatan_id: angkatanId })
        });
        const data = await res.json();
        if (data.success) {
            const idx = appData.users.findIndex(u => u.id === mahasiswaId);
            if (idx !== -1) {
                appData.users[idx].angkatan_id = angkatanId;
                appData.users[idx].angkatan = ang.nama_angkatan;
            }
            openModalManageAngkatanStudents(angkatanId);
            showToast(`${mhs.nama} berhasil ditambahkan ke ${ang.nama_angkatan}!`, "success");
        } else {
            showToast(data.message || "Gagal menambahkan mahasiswa.", "error");
        }
    } catch (e) {
        showToast("Gagal terhubung ke server.", "error");
    }
}

async function removeMahasiswaFromAngkatan(mahasiswaId, angkatanId) {
    const mhs = appData.users.find(u => u.id === mahasiswaId);
    if (!mhs) return;

    try {
        const res = await fetch("api.php?action=remove_mahasiswa_from_angkatan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mahasiswa_id: mahasiswaId })
        });
        const data = await res.json();
        if (data.success) {
            const idx = appData.users.findIndex(u => u.id === mahasiswaId);
            if (idx !== -1) {
                appData.users[idx].angkatan_id = null;
                appData.users[idx].angkatan = null;
            }
            openModalManageAngkatanStudents(angkatanId);
            showToast(`${mhs.nama} dikeluarkan dari angkatan.`, "success");
        } else {
            showToast(data.message || "Gagal mengeluarkan mahasiswa.", "error");
        }
    } catch (e) {
        showToast("Gagal terhubung ke server.", "error");
    }
}

async function confirmDeleteAngkatan(angkatanId, namaAngkatan) {
    const ang = appData.angkatanList.find(a => a.id === angkatanId);
    const jmlMhs = (appData.users || []).filter(u => u.role === 'mahasiswa' && u.angkatan_id === angkatanId).length;

    if (jmlMhs > 0) {
        showToast(`Tidak dapat menghapus angkatan yang masih memiliki ${jmlMhs} mahasiswa. Keluarkan mahasiswa terlebih dahulu.`, "error");
        return;
    }

    openConfirmModal({
        title: "Konfirmasi Hapus Angkatan",
        message: `Yakin ingin menghapus angkatan <strong>"${namaAngkatan}"</strong>?<br><br><span class="text-rose-500 font-semibold">Tindakan ini tidak dapat dibatalkan.</span>`,
        confirmText: "Ya, Hapus Angkatan",
        confirmColor: "bg-rose-600 hover:bg-rose-700",
        onConfirm: async () => {
            try {
                const res = await fetch("api.php?action=delete_angkatan", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: angkatanId })
                });
                const data = await res.json();
                if (data.success) {
                    appData.angkatanList = appData.angkatanList.filter(a => a.id !== angkatanId);
                    renderApp();
                    showToast(`Angkatan "${namaAngkatan}" berhasil dihapus.`, "success");
                } else {
                    showToast(data.message || "Gagal menghapus angkatan.", "error");
                }
            } catch (e) {
                showToast("Gagal terhubung ke server.", "error");
            }
        }
    });
}

// -------------------------------------------------------------
// MODAL TAMBAH KELAS (CREATE CLASS - ADMIN)
// -------------------------------------------------------------
function openModalAddClass(matkulId = null) {
    const modal = document.getElementById("modal-container");
    const dosenList = (appData.dosenList && appData.dosenList.length) ? appData.dosenList : (appData.users || []).filter(u => u.role === 'dosen');
    const preselectMatkul = matkulId !== null ? Number(matkulId) : null;
    const mkTerpilih = preselectMatkul !== null
        ? getUniqueMataKuliah().find(m => Number(m.id) === preselectMatkul)
        : null;

    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100">
            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-maroon-50 text-maroon-600 flex items-center justify-center font-bold text-sm">
                        <i class="fa-solid fa-plus"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm">Buka Kelas Baru</h3>
                        <p class="text-[11px] text-slate-400">Atur rombel angkatan, mata kuliah, dosen pengampu, dan jadwal</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form onsubmit="event.preventDefault(); handleSaveAddClass();" class="space-y-3.5 text-xs">
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">
                        Nama Kelas / Rombel Angkatan <span class="text-rose-500">*</span>
                    </label>
                    <input id="class-add-name" type="text" maxlength="30" required placeholder="Contoh: TRPL 24 A, TRPL 24 B, TRPL 25 A" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl font-bold uppercase focus:ring-2 focus:ring-maroon-500">
                    <p class="text-[10px] text-slate-400 mt-1">Gunakan kode angkatan, contoh: TRPL 24 A untuk mahasiswa angkatan 2024 kelas A.</p>
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Angkatan Mahasiswa <span class="text-rose-500">*</span></label>
                    <select id="class-add-angkatan" required onchange="autoFillClassName()" class="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-maroon-500">
                        <option value="">-- Pilih Angkatan --</option>
                        ${(appData.angkatanList || []).map(a => `
                            <option value="${a.id}">${a.nama_angkatan} (${a.tahun})</option>
                        `).join("")}
                    </select>
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Mata Kuliah <span class="text-rose-500">*</span></label>
                    <select id="class-add-matkul" required class="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-maroon-500">
                        <option value="">-- Pilih Mata Kuliah --</option>
                        ${getUniqueMataKuliah().map(m => `
                            <option value="${m.id}" ${preselectMatkul !== null && Number(m.id) === preselectMatkul ? 'selected' : ''}>Semester ${m.semester_paket || 1} - ${m.kode || m.kode_mk} - ${m.nama || m.nama_mk} (${m.sks} SKS)</option>
                        `).join("")}
                    </select>
                    ${mkTerpilih ? `<p class="text-[10px] text-slate-400 mt-1">Mata kuliah dipilih otomatis dari kurikulum Semester ${mkTerpilih.semester_paket || 1}.</p>` : ''}
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Dosen Pengampu <span class="text-rose-500">*</span></label>
                    <select id="class-add-dosen" required class="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-maroon-500">
                        <option value="">-- Pilih Dosen Pengampu --</option>
                        ${dosenList.map(d => `
                            <option value="${d.id}">${d.nama} (${d.nomor_induk || d.email})</option>
                        `).join("")}
                    </select>
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Semester Perkuliahan <span class="text-rose-500">*</span></label>
                    <select id="class-add-semester" required class="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-maroon-500">
                        ${(appData.semesters || []).map(s => `
                            <option value="${s.id}" ${s.is_aktif == 1 ? 'selected' : ''}>${s.nama} ${s.is_aktif == 1 ? '(Aktif)' : ''}</option>
                        `).join("")}
                    </select>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Hari Kuliah</label>
                        <select id="class-add-hari" class="w-full p-2.5 border border-slate-300 rounded-xl bg-white">
                            ${['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map(h => `<option value="${h}">${h}</option>`).join("")}
                        </select>
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Jam Perkuliahan</label>
                        <input id="class-add-jam" type="text" value="08:00 - 10:30" placeholder="08:00 - 10:30" 
                            class="w-full p-2.5 border border-slate-300 rounded-xl">
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Ruangan</label>
                        <input id="class-add-ruangan" type="text" value="Lab Komputer CWE" placeholder="Lab Komputer 1" 
                            class="w-full p-2.5 border border-slate-300 rounded-xl">
                    </div>
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600">Batal</button>
                    <button type="submit" class="px-5 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl font-semibold shadow-sm transition">
                        <i class="fa-solid fa-floppy-disk mr-1"></i> Buka Kelas
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;
}

function autoFillClassName() {
    const angkatanEl = document.getElementById("class-add-angkatan");
    const nameEl = document.getElementById("class-add-name");
    if (!angkatanEl || !nameEl) return;
    const ang = (appData.angkatanList || []).find(a => Number(a.id) === Number(angkatanEl.value));
    if (!ang) return;
    const label = getAngkatanDisplayLabel(ang.nama_angkatan, ang.tahun);
    if (label) nameEl.value = `TRPL ${label}`.toUpperCase();
}

async function handleSaveAddClass() {
    const namaKelas = document.getElementById("class-add-name").value.trim().toUpperCase();
    const angkatanId = parseInt(document.getElementById("class-add-angkatan").value);
    const matkulId  = parseInt(document.getElementById("class-add-matkul").value);
    const dosenId   = parseInt(document.getElementById("class-add-dosen").value);
    const semId     = parseInt(document.getElementById("class-add-semester").value);
    const hari      = document.getElementById("class-add-hari").value;
    const jam       = document.getElementById("class-add-jam").value.trim();
    const ruangan   = document.getElementById("class-add-ruangan").value.trim();

    if (!namaKelas || !angkatanId || !matkulId || !dosenId || !semId) {
        showToast("Semua kolom bertanda (*) wajib diisi!", "error");
        return;
    }

    const duplikat = (appData.kelasList || []).some(k =>
        Number(k.mata_kuliah_id) === matkulId &&
        Number(k.angkatan_id) === angkatanId &&
        Number(k.semester_id) === semId
    );
    if (duplikat) {
        showToast("Kelas untuk mata kuliah dan angkatan ini sudah dibuka.", "error");
        return;
    }

    const payload = {
        nama_kelas: namaKelas,
        angkatan_id: angkatanId,
        mata_kuliah_id: matkulId,
        dosen_id: dosenId,
        semester_id: semId,
        hari,
        jam,
        ruangan
    };

    try {
        const res = await fetch("api.php?action=create_class", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.kelas) {
            appData.kelasList.unshift(data.kelas);
            if (data.angkatan_semester) {
                const mapping = data.angkatan_semester;
                const idx = (appData.angkatanSemesterList || []).findIndex(m => Number(m.id) === Number(mapping.id));
                if (idx !== -1) {
                    appData.angkatanSemesterList[idx] = mapping;
                } else {
                    appData.angkatanSemesterList.push(mapping);
                }
            }
            refreshAngkatanSemesterCache();
            closeModal();
            renderApp();
            showToast(`Kelas "${namaKelas}" berhasil dibuat!`, "success");
            return;
        } else if (!data.success) {
            showToast(data.message || "Gagal membuat kelas.", "error");
            return;
        }
    } catch (e) {
        showToast("Gagal terhubung ke server. Pastikan koneksi database aktif.", "error");
    }
}

// -------------------------------------------------------------
// MODAL EDIT KELAS (UPDATE CLASS - ADMIN)
// -------------------------------------------------------------


// -------------------------------------------------------------
// MODAL HAPUS KELAS (DELETE CLASS - ADMIN)
// -------------------------------------------------------------

// -------------------------------------------------------------
// MODAL KELOLA MAHASISWA KELAS (ENROLL / UNENROLL - ADMIN)
// -------------------------------------------------------------
let manageClassStudentState = {
    classId: null,
    tab: "enrolled", // "enrolled" atau "add"
    search: "",
    filterAngkatan: "all"
};


function renderModalManageClassStudentsContent() {
    const classId = manageClassStudentState.classId;
    const k = (appData.kelasList || []).find(c => c.id === classId);
    if (!k) return;

    const angkatanKelas = getKelasAngkatanNama(k);
    const enrolledStudents = k.mahasiswa || [];
    const enrolledIds = new Set(enrolledStudents.map(m => m.id));

    // Mahasiswa sistem yang belum terdaftar di kelas ini
    const allMhs = (appData.users || []).filter(u => u.role === 'mahasiswa');
    let availableStudents = allMhs.filter(u => !enrolledIds.has(u.id));

    // Filter pada tab tambah
    if (manageClassStudentState.filterAngkatan !== "all") {
        availableStudents = availableStudents.filter(u => getAngkatanFromNIM(u.nomor_induk) === manageClassStudentState.filterAngkatan);
    }
    if (manageClassStudentState.search) {
        const q = manageClassStudentState.search.toLowerCase();
        availableStudents = availableStudents.filter(u => 
            (u.nama || '').toLowerCase().includes(q) ||
            (u.nomor_induk || '').toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        );
    }

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-4 max-h-[92vh] flex flex-col border border-slate-100">
            <!-- Header Modal -->
            <div class="flex justify-between items-start pb-3 border-b border-slate-100 shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-maroon-50 text-maroon-600 flex items-center justify-center font-extrabold text-base">
                        <i class="fa-solid fa-users-gear"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="font-bold text-slate-800 text-sm">Kelola Mahasiswa: ${k.nama_kelas}</h3>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-maroon-100 text-maroon-700">Angkatan ${angkatanKelas}</span>
                        </div>
                        <p class="text-[11px] text-slate-400 mt-0.5">${k.nama_mk} (${k.kode_mk}) &bull; Dosen: ${k.dosen_nama}</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <!-- Tab Navigasi -->
            <div class="flex items-center gap-2 border-b border-slate-200 shrink-0 text-xs font-semibold">
                <button onclick="manageClassStudentState.tab='enrolled'; renderModalManageClassStudentsContent();" 
                    class="py-2.5 px-3 border-b-2 transition flex items-center gap-2 ${manageClassStudentState.tab === 'enrolled' ? 'border-maroon-600 text-maroon-600 font-bold' : 'border-transparent text-slate-400 hover:text-slate-600'}">
                    <i class="fa-solid fa-user-check"></i>
                    <span>Mahasiswa Terdaftar (${enrolledStudents.length})</span>
                </button>
                <button onclick="manageClassStudentState.tab='add'; renderModalManageClassStudentsContent();" 
                    class="py-2.5 px-3 border-b-2 transition flex items-center gap-2 ${manageClassStudentState.tab === 'add' ? 'border-maroon-600 text-maroon-600 font-bold' : 'border-transparent text-slate-400 hover:text-slate-600'}">
                    <i class="fa-solid fa-user-plus"></i>
                    <span>Tambah Mahasiswa ke Kelas</span>
                </button>
            </div>

            <!-- Body Modal -->
            <div class="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                ${manageClassStudentState.tab === 'enrolled' ? `
                    <!-- TAB 1: DAFTAR MAHASISWA TERDAFTAR -->
                    ${enrolledStudents.length === 0 ? `
                        <div class="p-8 text-center text-slate-400 space-y-2">
                            <i class="fa-solid fa-user-slash text-3xl text-slate-300"></i>
                            <p class="font-semibold text-slate-600">Belum ada mahasiswa yang terdaftar di kelas ini.</p>
                            <p class="text-[11px]">Buka tab <strong>"Tambah Mahasiswa ke Kelas"</strong> untuk mendaftarkan mahasiswa.</p>
                        </div>
                    ` : `
                        <div class="overflow-x-auto border border-slate-200 rounded-xl">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10px] uppercase font-bold">
                                    <tr>
                                        <th class="p-3">No</th>
                                        <th class="p-3">Mahasiswa</th>
                                        <th class="p-3">NIM / Angkatan</th>
                                        <th class="p-3">Email Kampus</th>
                                        <th class="p-3 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${enrolledStudents.map((m, idx) => {
                                        const ang = getAngkatanFromNIM(m.nomor_induk);
                                        return `
                                        <tr class="hover:bg-slate-50/80 transition">
                                            <td class="p-3 text-slate-400 font-bold">${idx + 1}</td>
                                            <td class="p-3">
                                                <div class="flex items-center gap-2.5">
                                                    ${getUserAvatar(m, "w-7 h-7 text-[10px]", "rounded-lg")}
                                                    <span class="font-bold text-slate-800">${m.nama}</span>
                                                </div>
                                            </td>
                                            <td class="p-3">
                                                <span class="font-mono font-bold text-slate-700">${m.nomor_induk}</span>
                                                <span class="ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold ${ang === '2024' ? 'bg-maroon-100 text-maroon-700' : 'bg-emerald-100 text-emerald-700'}">
                                                    '${ang.slice(-2)}
                                                </span>
                                            </td>
                                            <td class="p-3 text-slate-500 text-[11px]">${m.email}</td>
                                            <td class="p-3 text-right">
                                                <button onclick="handleUnenrollStudent(${k.id}, ${m.id})" 
                                                    title="Keluarkan dari kelas ini"
                                                    class="px-2.5 py-1 text-rose-700 hover:bg-rose-100 bg-rose-50 rounded-lg text-[11px] font-semibold transition inline-flex items-center gap-1">
                                                    <i class="fa-solid fa-user-minus"></i> Keluarkan
                                                </button>
                                            </td>
                                        </tr>
                                        `;
                                    }).join("")}
                                </tbody>
                            </table>
                        </div>
                    `}
                ` : `
                    <!-- TAB 2: TAMBAH MAHASISWA BARU KE KELAS -->
                    <div class="space-y-3">
                        <!-- Toolbar Filter Mahasiswa yang Belum Terdaftar -->
                        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            <div>
                                <input type="text" 
                                    placeholder="Cari nama, NIM, atau email..." 
                                    value="${manageClassStudentState.search}"
                                    oninput="manageClassStudentState.search=this.value.trim(); renderModalManageClassStudentsContent();"
                                    class="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white">
                            </div>
                            <div>
                                <select onchange="manageClassStudentState.filterAngkatan=this.value; renderModalManageClassStudentsContent();"
                                    class="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold">
                                    <option value="all" ${manageClassStudentState.filterAngkatan === 'all' ? 'selected' : ''}>Tampilkan Semua Angkatan</option>
                                    <option value="2024" ${manageClassStudentState.filterAngkatan === '2024' ? 'selected' : ''}>🎓 Khusus Angkatan 2024 (TRPL 24)</option>
                                    <option value="2025" ${manageClassStudentState.filterAngkatan === '2025' ? 'selected' : ''}>🎓 Khusus Angkatan 2025 (TRPL 25)</option>
                                    <option value="2023" ${manageClassStudentState.filterAngkatan === '2023' ? 'selected' : ''}>🎓 Khusus Angkatan 2023 (TRPL 23)</option>
                                </select>
                            </div>
                        </div>

                        ${availableStudents.length === 0 ? `
                            <div class="p-8 text-center text-slate-400">
                                <i class="fa-solid fa-circle-check text-2xl text-emerald-500 mb-1"></i>
                                <p class="font-bold text-slate-700">Semua mahasiswa yang sesuai kriteria sudah terdaftar di kelas ini.</p>
                            </div>
                        ` : `
                            <div class="flex items-center justify-between pb-1">
                                <label class="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-700 text-xs">
                                    <input type="checkbox" id="check-all-students" onchange="toggleSelectAllStudents(this.checked)" class="rounded text-maroon-600 w-4 h-4">
                                    <span>Pilih Semua Mahasiswa (${availableStudents.length} Mahasiswa Tersedia)</span>
                                </label>
                                <button onclick="handleEnrollStudents(${k.id})" 
                                    class="px-4 py-1.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5">
                                    <i class="fa-solid fa-user-plus"></i> Daftarkan Terpilih
                                </button>
                            </div>

                            <div class="overflow-x-auto border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                                <table class="w-full text-left text-xs">
                                    <thead class="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10px] uppercase font-bold sticky top-0">
                                        <tr>
                                            <th class="p-2.5 w-10 text-center">Pilih</th>
                                            <th class="p-2.5">Mahasiswa</th>
                                            <th class="p-2.5">NIM</th>
                                            <th class="p-2.5">Angkatan</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-slate-100">
                                        ${availableStudents.map(m => {
                                            const ang = getAngkatanFromNIM(m.nomor_induk);
                                            return `
                                            <tr class="hover:bg-slate-50 transition cursor-pointer" onclick="const cb=document.getElementById('cb-mhs-${m.id}'); if(event.target.tagName !== 'INPUT') { cb.checked = !cb.checked; }">
                                                <td class="p-2.5 text-center">
                                                    <input type="checkbox" value="${m.id}" id="cb-mhs-${m.id}" class="cb-mhs-item rounded text-maroon-600 w-4 h-4">
                                                </td>
                                                <td class="p-2.5 font-bold text-slate-800">
                                                    <div class="flex items-center gap-2">
                                                        ${getUserAvatar(m, "w-6 h-6 text-[9px]", "rounded-md")}
                                                        <span>${m.nama}</span>
                                                    </div>
                                                </td>
                                                <td class="p-2.5 font-mono text-slate-600 font-bold">${m.nomor_induk}</td>
                                                <td class="p-2.5">
                                                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${ang === '2024' ? 'bg-maroon-100 text-maroon-700' : 'bg-emerald-100 text-emerald-700'}">
                                                        Angkatan ${ang}
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

            <!-- Footer Modal -->
            <div class="pt-3 border-t border-slate-100 flex justify-between items-center shrink-0">
                <span class="text-[11px] text-slate-400 font-medium">
                    Total Mahasiswa Terdaftar: <strong>${enrolledStudents.length} Orang</strong>
                </span>
                <button type="button" onclick="closeModal()" class="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600 text-xs">
                    Selesai & Tutup
                </button>
            </div>
        </div>
    </div>
    `;
}

function toggleSelectAllStudents(checked) {
    document.querySelectorAll(".cb-mhs-item").forEach(cb => {
        cb.checked = checked;
    });
}

async function handleEnrollStudents(classId) {
    const k = (appData.kelasList || []).find(c => c.id === classId);
    if (!k) return;

    const checkedBoxes = Array.from(document.querySelectorAll(".cb-mhs-item:checked"));
    const selectedIds = checkedBoxes.map(cb => parseInt(cb.value)).filter(Boolean);

    if (selectedIds.length === 0) {
        showToast("Pilih minimal satu mahasiswa untuk didaftarkan!", "error");
        return;
    }

    try {
        const res = await fetch("api.php?action=enroll_students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kelas_id: classId, mahasiswa_ids: selectedIds })
        });
        const data = await res.json();
        if (data.success && data.mahasiswa) {
            k.mahasiswa = data.mahasiswa;
            k.jumlah_mahasiswa = data.mahasiswa.length;
            renderApp();
            renderModalManageClassStudentsContent();
            showToast(`${selectedIds.length} mahasiswa berhasil didaftarkan ke kelas!`, "success");
            return;
        }
    } catch (e) {}

    // Fallback offline
    if (!k.mahasiswa) k.mahasiswa = [];
    const newStudents = (appData.users || []).filter(u => selectedIds.includes(u.id));
    newStudents.forEach(m => {
        if (!k.mahasiswa.some(item => item.id === m.id)) {
            k.mahasiswa.push(m);
        }
    });
    k.jumlah_mahasiswa = k.mahasiswa.length;
    renderApp();
    renderModalManageClassStudentsContent();
    showToast(`${selectedIds.length} mahasiswa berhasil didaftarkan ke kelas!`, "success");
}

async function handleUnenrollStudent(classId, mhsId) {
    const k = (appData.kelasList || []).find(c => c.id === classId);
    if (!k) return;

    openConfirmModal({
        title: "Keluarkan Mahasiswa dari Kelas",
        message: "Apakah Anda yakin ingin mengeluarkan mahasiswa ini dari kelas perkuliahan?",
        confirmText: "Ya, Keluarkan",
        confirmColor: "bg-rose-600 hover:bg-rose-700",
        onConfirm: async () => {
            try {
                await fetch("api.php?action=unenroll_student", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ kelas_id: classId, mahasiswa_id: mhsId })
                });
            } catch (e) {}

            k.mahasiswa = (k.mahasiswa || []).filter(m => m.id !== mhsId);
            k.jumlah_mahasiswa = k.mahasiswa.length;
            renderApp();
            renderModalManageClassStudentsContent();
            showToast("Mahasiswa telah dikeluarkan dari kelas.", "success");
        }
    });
}

// -------------------------------------------------------------
// MODAL PANTAU PENGUMPULAN TUGAS KELAS (ADMIN VIEW - READ-ONLY NILAI)
// -------------------------------------------------------------
