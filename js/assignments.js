/**
 * js/assignments.js - Modul Tugas & Penilaian Mahasiswa
 * Dosen Mengelola Tugas & Memberikan Nilai, Mahasiswa Mengumpulkan Tugas
 */

// =============================================================
// LOGIKA MATERI KULIAH
// =============================================================
function openModalAddMateri() {
    if (appData.currentUser.role !== 'dosen') {
        showToast("Akses ditolak: Hanya Dosen yang dapat mengunggah materi.", "error");
        return;
    }

    const myClasses = (appData.kelasList || []).filter(k => Number(k.dosen_id) === Number(appData.currentUser.id));

    const modal = document.getElementById("modal-container");
    if (!modal) return;
    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100">
            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-maroon-50 text-maroon-600 flex items-center justify-center font-bold text-sm">
                        <i class="fa-solid fa-plus"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm">Unggah Materi Perkuliahan Baru</h3>
                        <p class="text-[11px] text-slate-400">Seluruh kolom bertanda (*) wajib diisi</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form onsubmit="event.preventDefault(); handleSaveAddMateri();" class="space-y-3.5 text-xs">
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Kelas Perkuliahan <span class="text-rose-500">*</span></label>
                    <select id="add-materi-kelas" required class="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-maroon-500">
                        <option value="">-- Pilih Kelas yang Diampu --</option>
                        ${myClasses.map(k => `
                            <option value="${k.id}" data-matkul-id="${k.mata_kuliah_id}">
                                ${k.nama_kelas} - ${k.kode_mk || ''} ${k.nama_mk || ''} (${typeof getKelasAngkatanNama === 'function' ? getKelasAngkatanNama(k) : ''})
                            </option>
                        `).join("")}
                    </select>
                    ${myClasses.length === 0 ? `
                        <p class="text-[10px] text-rose-600 mt-1">Belum ada kelas yang ditugaskan admin kepada Anda.</p>
                    ` : ''}
                </div>
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Judul Materi <span class="text-rose-500">*</span> (3 - 150 Karakter)</label>
                    <input id="add-materi-judul" type="text" maxlength="150" required placeholder="Contoh: Modul 1: Pengantar Arsitektur Perangkat Lunak" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                </div>
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Pertemuan Ke- <span class="text-rose-500">*</span></label>
                    <input id="add-materi-pertemuan" type="number" min="1" max="16" value="1" required 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                </div>
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Lampirkan Berkas Materi (Opsional)</label>
                    <div class="border-2 border-dashed border-slate-200 hover:border-maroon-400 rounded-xl p-3 text-center transition bg-slate-50/50">
                        <input id="add-materi-file" type="file" class="hidden" onchange="previewUploadFile(this, 'add-materi-file-label')">
                        <label for="add-materi-file" class="cursor-pointer flex flex-col items-center justify-center gap-1">
                            <i class="fa-solid fa-cloud-arrow-up text-maroon-500 text-lg"></i>
                            <span id="add-materi-file-label" class="text-[11px] text-slate-600 font-medium">Klik untuk memilih file materi (PDF, PPTX, DOCX)</span>
                        </label>
                    </div>
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600">Batal</button>
                    <button type="submit" class="px-5 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl font-semibold shadow-sm transition">
                        <i class="fa-solid fa-check mr-1"></i> Unggah Materi
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;
}

async function handleSaveAddMateri() {
    const kelasEl = document.getElementById("add-materi-kelas");
    const judulEl = document.getElementById("add-materi-judul");
    const pertemuanEl = document.getElementById("add-materi-pertemuan");
    const fileEl = document.getElementById("add-materi-file");

    if (!kelasEl || !kelasEl.value) {
        showToast("Pilih kelas perkuliahan terlebih dahulu.", "error");
        return;
    }

    const selectedOpt = kelasEl.options[kelasEl.selectedIndex];
    let fileData = null;

    if (fileEl && fileEl.files && fileEl.files[0]) {
        const file = fileEl.files[0];
        fileData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = e => resolve({
                nama: file.name,
                size: formatFileSize(file.size),
                dataUrl: e.target.result
            });
            reader.readAsDataURL(file);
        });
    }

    const payload = {
        kelasId: parseInt(kelasEl.value),
        judul: judulEl.value,
        pertemuan: parseInt(pertemuanEl.value),
        lampiranMateri: fileData
    };

    try {
        const response = await fetch("api.php?action=create_materi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const textRes = await response.text();
        let data;
        try {
            data = JSON.parse(textRes);
        } catch (err) {
            console.error("Non-JSON response:", textRes);
            showToast("Error server: Respons bukan format JSON yang valid.", "error");
            return;
        }

        if (data.success) {
            closeModal();
            showToast("Materi berhasil diunggah!", "success");
            await loadAppData();
        } else {
            showToast(data.message || "Gagal mengunggah materi.", "error");
        }
    } catch (e) {
        showToast("Error sistem: " + e.message, "error");
    }
}

// =============================================================
// MODUL TUGAS (CRUD, SEARCH, FILTER, PAGINASI, UPLOAD, DOWNLOAD)
// =============================================================
function renderAssignmentsModule() {
    const role = appData.currentUser.role;
    // Hanya DOSEN yang bisa mengelola tugas (tambah/edit/hapus)
    const isDosen = role === "dosen";
    // Admin hanya bisa monitoring (lihat kiriman & nilai), TIDAK bisa buat/edit/hapus tugas
    const canManage = isDosen;
    const isDosenOrAdmin = role === "dosen" || role === "admin"; // untuk tombol lihat kiriman

    let filteredTugas = appData.tugas.filter(t => {
        if (assignmentFilter.search) {
            const q = assignmentFilter.search.toLowerCase();
            const mk = appData.mataKuliah.find(m => m.id === t.matkulId);
            const matchJudul = t.judul.toLowerCase().includes(q);
            const matchDesc = t.deskripsi.toLowerCase().includes(q);
            const matchMK = mk ? mk.nama.toLowerCase().includes(q) || mk.kode.toLowerCase().includes(q) : false;
            if (!matchJudul && !matchDesc && !matchMK) return false;
        }

        if (assignmentFilter.matkulId !== "all") {
            if (t.matkulId !== parseInt(assignmentFilter.matkulId)) return false;
        }

        if (assignmentFilter.status !== "all") {
            const status = checkDeadlineStatus(t.deadline);
            if (assignmentFilter.status !== status) return false;
        }

        return true;
    });

    const totalItems = filteredTugas.length;
    const totalPages = Math.ceil(totalItems / assignmentFilter.perPage) || 1;
    if (assignmentFilter.page > totalPages) assignmentFilter.page = totalPages;

    const startIndex = (assignmentFilter.page - 1) * assignmentFilter.perPage;
    const paginatedItems = filteredTugas.slice(startIndex, startIndex + assignmentFilter.perPage);

    return `
    <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <i class="fa-solid fa-list-check text-maroon-600"></i>
                    ${role === 'admin' ? 'Monitoring Tugas Perkuliahan TRPL' : 'Manajemen Tugas Perkuliahan TRPL'}
                </h1>
                <p class="text-xs text-slate-500 mt-0.5">
                    ${isDosenOrAdmin
            ? (canManage ? "Kelola instrumen tugas mahasiswa, periksa kiriman tugas, dan berikan evaluasi nilai." : "Pantau seluruh tugas dan kiriman mahasiswa di semua kelas TRPL.")
            : "Daftar penugasan prodi TRPL CWE yang perlu Anda kumpulkan sebelum tenggat waktu."}
                </p>
            </div>
            
            ${canManage ? `
                <button onclick="openModalAddTugas()" class="px-4 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition shrink-0">
                    <i class="fa-solid fa-circle-plus"></i> Buat Tugas Baru
                </button>
            ` : ''}
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div class="md:col-span-2 relative">
                    <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <i class="fa-solid fa-magnifying-glass text-xs"></i>
                    </span>
                    <input type="text" 
                        placeholder="Cari tugas, instruksi, atau mata kuliah..." 
                        value="${assignmentFilter.search}"
                        oninput="handleSearchAssignment(this.value)"
                        class="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-maroon-500 focus:outline-none">
                </div>

                <div>
                    <select onchange="handleFilterMatkul(this.value)" class="w-full py-2 px-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-maroon-500 focus:outline-none bg-white">
                        <option value="all">Semua Mata Kuliah (${getUniqueMataKuliah().length})</option>
                        ${getUniqueMataKuliah().map(m => `
                            <option value="${m.id}" ${assignmentFilter.matkulId == m.id ? 'selected' : ''}>
                                ${m.kode} - ${m.nama}
                            </option>
                        `).join("")}
                    </select>
                </div>

                <div>
                    <select onchange="handleFilterStatus(this.value)" class="w-full py-2 px-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-maroon-500 focus:outline-none bg-white">
                        <option value="all" ${assignmentFilter.status === 'all' ? 'selected' : ''}>Semua Status Deadline</option>
                        <option value="active" ${assignmentFilter.status === 'active' ? 'selected' : ''}>🟢 Sedang Berjalan (Aktif)</option>
                        <option value="expired" ${assignmentFilter.status === 'expired' ? 'selected' : ''}>🔴 Melewati Deadline</option>
                    </select>
                </div>
            </div>
        </div>

        ${totalItems === 0 ? `
            <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-2xl mb-3">
                    <i class="fa-regular fa-folder-open"></i>
                </div>
                <h3 class="text-sm font-bold text-slate-700">Tidak ada data tugas yang sesuai</h3>
                <p class="text-xs text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian atau ubah filter.</p>
            </div>
        ` : `
            <div class="space-y-4">
                ${paginatedItems.map(tugas => renderTugasCard(tugas, isDosenOrAdmin, canManage)).join("")}
            </div>

            <!-- Paginasi -->
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div class="text-slate-500 text-[11px]">
                    Menampilkan <span class="font-bold text-slate-700">${startIndex + 1}</span> - <span class="font-bold text-slate-700">${Math.min(startIndex + assignmentFilter.perPage, totalItems)}</span> dari <span class="font-bold text-slate-700">${totalItems}</span> tugas
                </div>

                <div class="flex items-center gap-1.5">
                    <button onclick="changeAssignmentPage(${assignmentFilter.page - 1})" 
                        ${assignmentFilter.page <= 1 ? 'disabled class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-300 cursor-not-allowed"' : 'class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 font-medium transition"'}>
                        <i class="fa-solid fa-chevron-left mr-1 text-[10px]"></i> Sebelumnya
                    </button>

                    <div class="flex items-center gap-1 px-1">
                        ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
                            <button onclick="changeAssignmentPage(${p})" 
                                class="w-8 h-8 rounded-lg font-bold text-xs transition ${assignmentFilter.page === p
                    ? 'bg-maroon-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }">
                                ${p}
                            </button>
                        `).join("")}
                    </div>

                    <button onclick="changeAssignmentPage(${assignmentFilter.page + 1})" 
                        ${assignmentFilter.page >= totalPages ? 'disabled class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-300 cursor-not-allowed"' : 'class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 font-medium transition"'}>
                        Selanjutnya <i class="fa-solid fa-chevron-right ml-1 text-[10px]"></i>
                    </button>
                </div>
            </div>
        `}
    </div>
    `;
}

function renderTugasCard(tugas, isDosenOrAdmin, canManage) {
    // canManage: hanya dosen yang boleh edit/hapus/buat tugas
    if (canManage === undefined) canManage = isDosenOrAdmin && appData.currentUser.role === 'dosen';
    const mk = appData.mataKuliah.find(m => m.id === tugas.matkulId) || { nama: "Mata Kuliah TRPL", kode: "TRPL", dosen: "Dosen TRPL" };
    const kelas = (appData.kelasList || []).find(k => Number(k.id) === Number(tugas.kelasId));
    const isMahasiswa = appData.currentUser && appData.currentUser.role === 'mahasiswa';
    const kelasLabel = getKelasDisplayName(kelas);
    const statusDeadline = checkDeadlineStatus(tugas.deadline);
    const isExpired = statusDeadline === "expired";
    const submissions = tugas.submissions || [];

    const mySub = !isDosenOrAdmin && appData.currentUser
        ? submissions.find(s => s.mhsId === appData.currentUser.id || s.mhsNim === appData.currentUser.nomor_induk)
        : null;

    const unreadCount = submissions.filter(s => s.nilai === null || s.nilai === undefined).length;

    return `
    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-4">
        <div class="flex flex-col md:flex-row md:items-start justify-between gap-3">
            <div class="space-y-1">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold font-mono bg-maroon-50 text-maroon-700 border border-maroon-100">
                        ${mk.kode}
                    </span>
                    <span class="text-xs font-semibold text-slate-600">${mk.nama}</span>
                    ${kelasLabel ? `
                        <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                            ${kelasLabel}
                        </span>
                    ` : ''}
                    <span class="text-slate-300">•</span>
                    <span class="text-[11px] text-slate-400"><i class="fa-solid fa-chalkboard-user mr-1"></i> ${mk.dosen}</span>
                </div>
                <h3 class="text-base font-bold text-slate-800 tracking-tight">${tugas.judul}</h3>
            </div>

            <div class="shrink-0 text-left md:text-right">
                <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${isExpired ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }">
                    <span class="w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}"></span>
                    ${isExpired ? 'Tenggat Terlewat' : 'Tenggat Aktif'}
                </div>
                <p class="text-[11px] text-slate-500 mt-1">
                    <i class="fa-regular fa-clock mr-1"></i> ${formatDeadlineDisplay(tugas.deadline)}
                </p>
            </div>
        </div>

        <p class="text-xs text-slate-600 leading-relaxed bg-slate-50/80 p-3 rounded-xl border border-slate-100">
            ${tugas.deskripsi}
        </p>

        ${tugas.lampiranSoal ? `
            <div class="flex items-center justify-between p-3 rounded-xl bg-maroon-50/40 border border-maroon-100/80 text-xs">
                <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-maroon-100 text-maroon-600 flex items-center justify-center text-sm font-bold shrink-0">
                        <i class="fa-regular fa-file-lines"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="font-bold text-slate-800 text-[11px] truncate">${tugas.lampiranSoal.nama}</p>
                        <p class="text-[10px] text-slate-400">${tugas.lampiranSoal.size || 'Lampiran Berkas Soal'}</p>
                    </div>
                </div>
                <button onclick="downloadFile('${tugas.lampiranSoal.nama}', '${tugas.lampiranSoal.dataUrl || ''}', 'Lampiran Soal: ${tugas.judul}')" 
                    class="px-3 py-1.5 bg-white hover:bg-maroon-50 border border-maroon-200 text-maroon-700 font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition">
                    <i class="fa-solid fa-download"></i> Unduh Soal
                </button>
            </div>
        ` : ''}

        <div class="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div>
                ${isDosenOrAdmin ? `
                    <div class="flex items-center gap-2">
                        <span class="text-slate-500">Pengumpulan Mahasiswa:</span>
                        <span class="px-2 py-0.5 rounded-full font-bold text-[11px] ${submissions.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}">
                            ${submissions.length} Orang
                        </span>
                        ${unreadCount > 0 ? `
                            <span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                                <i class="fa-solid fa-bell mr-1"></i> ${unreadCount} Belum Diperiksa
                            </span>
                        ` : ''}
                    </div>
                ` : `
                    <div class="flex items-center gap-2">
                        <span class="text-slate-500">Status Pengumpulan:</span>
                        ${mySub ? `
                            <span class="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-700">
                                ✓ Sudah Mengumpulkan
                            </span>
                            ${mySub.nilai !== null && mySub.nilai !== undefined ? `
                                <span class="font-bold text-maroon-600 ml-1">Nilai: ${mySub.nilai}/100</span>
                            ` : `
                                <span class="text-slate-400 italic text-[11px]">(Sedang dinilai)</span>
                            `}
                        ` : `
                            <span class="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-amber-100 text-amber-700">
                                ⏳ Belum Mengumpulkan
                            </span>
                        `}
                    </div>
                `}
            </div>

            <div class="flex items-center gap-2 flex-wrap">
                ${isDosenOrAdmin ? `
                    <button onclick="openModalViewSubmissions(${tugas.id})" 
                        class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold transition flex items-center gap-1.5">
                        <i class="fa-solid fa-users-viewfinder"></i> Kiriman (${submissions.length})
                    </button>
                    ${canManage ? `
                        <button onclick="openModalEditTugas(${tugas.id})" 
                            class="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-semibold transition flex items-center gap-1.5">
                            <i class="fa-regular fa-pen-to-square"></i> Edit
                        </button>
                        <button onclick="openModalDeleteTugas(${tugas.id})" 
                            class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-semibold transition flex items-center gap-1.5">
                            <i class="fa-regular fa-trash-can"></i> Hapus
                        </button>
                    ` : ''}
                ` : `
                    <button onclick="openModalSubmitTugas(${tugas.id})" 
                        class="px-4 py-1.5 ${mySub ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} rounded-lg font-semibold transition shadow-xs flex items-center gap-1.5">
                        <i class="fa-solid fa-cloud-arrow-up"></i> ${mySub ? 'Perbarui Berkas Jawaban' : 'Kumpulkan Tugas'}
                    </button>
                `}
            </div>
        </div>
    </div>
    `;
}

function handleSearchAssignment(q) {
    assignmentFilter.search = q.trim();
    assignmentFilter.page = 1;
    renderApp();
}

function handleFilterMatkul(val) {
    assignmentFilter.matkulId = val;
    assignmentFilter.page = 1;
    renderApp();
}

function handleFilterStatus(val) {
    assignmentFilter.status = val;
    assignmentFilter.page = 1;
    renderApp();
}

function changeAssignmentPage(p) {
    assignmentFilter.page = p;
    renderApp();
}

function openModalAddTugas() {
    if (appData.currentUser.role !== 'dosen') {
        showToast("Akses ditolak: Hanya Dosen yang dapat membuat tugas baru.", "error");
        return;
    }

    const myClasses = (appData.kelasList || []).filter(k => Number(k.dosen_id) === Number(appData.currentUser.id));

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100">
            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-maroon-50 text-maroon-600 flex items-center justify-center font-bold text-sm">
                        <i class="fa-solid fa-plus"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm">Buat Tugas Perkuliahan Baru</h3>
                        <p class="text-[11px] text-slate-400">Seluruh kolom bertanda (*) wajib diisi</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form onsubmit="event.preventDefault(); handleSaveAddTugas();" class="space-y-3.5 text-xs">
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Kelas Perkuliahan <span class="text-rose-500">*</span></label>
                    <select id="add-tugas-kelas" required class="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-maroon-500">
                        <option value="">-- Pilih Kelas yang Diampu --</option>
                        ${myClasses.map(k => `
                            <option value="${k.id}" data-matkul-id="${k.mata_kuliah_id}">
                                ${k.nama_kelas} - ${k.kode_mk} ${k.nama_mk} (${getKelasAngkatanNama(k)})
                            </option>
                        `).join("")}
                    </select>
                    ${myClasses.length === 0 ? `
                        <p class="text-[10px] text-rose-600 mt-1">Belum ada kelas yang ditugaskan admin kepada Anda.</p>
                    ` : ''}
                </div>
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Judul Tugas <span class="text-rose-500">*</span> (3 - 150 Karakter)</label>
                    <input id="add-tugas-judul" type="text" maxlength="150" required placeholder="Contoh: Tugas 4: Perancangan Arsitektur Microservices" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                </div>
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Tenggat Waktu (Deadline) <span class="text-rose-500">*</span></label>
                    <input id="add-tugas-deadline" type="datetime-local" required
                        class="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-maroon-500">
                </div>
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Instruksi Pengerjaan <span class="text-rose-500">*</span></label>
                    <textarea id="add-tugas-deskripsi" rows="3" maxlength="5000" required placeholder="Tuliskan petunjuk pengerjaan tugas, batasan, format jawaban..." 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500"></textarea>
                </div>
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Lampirkan Berkas Soal (Opsional)</label>
                    <div class="border-2 border-dashed border-slate-200 hover:border-maroon-400 rounded-xl p-3 text-center transition bg-slate-50/50">
                        <input id="add-tugas-file" type="file" class="hidden" onchange="previewUploadFile(this, 'add-file-label')">
                        <label for="add-tugas-file" class="cursor-pointer flex flex-col items-center justify-center gap-1">
                            <i class="fa-solid fa-cloud-arrow-up text-maroon-500 text-lg"></i>
                            <span id="add-file-label" class="text-[11px] text-slate-600 font-medium">Klik untuk memilih file soal (PDF, DOCX, ZIP)</span>
                        </label>
                    </div>
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600">Batal</button>
                    <button type="submit" class="px-5 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl font-semibold shadow-sm transition">
                        <i class="fa-solid fa-check mr-1"></i> Terbitkan Tugas
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;
}

function previewUploadFile(input, labelId) {
    const label = document.getElementById(labelId);
    if (input.files && input.files[0]) {
        const file = input.files[0];
        label.innerHTML = `<strong>${file.name}</strong> (${formatFileSize(file.size)})`;
        label.classList.add("text-maroon-600");
    }
}

async function handleSaveAddTugas() {
    const kelasEl = document.getElementById("add-tugas-kelas");
    const judulEl = document.getElementById("add-tugas-judul");
    const deadlineEl = document.getElementById("add-tugas-deadline");
    const deskripsiEl = document.getElementById("add-tugas-deskripsi");
    const fileEl = document.getElementById("add-tugas-file");

    if (!kelasEl.value || !judulEl.value.trim() || !deadlineEl.value || !deskripsiEl.value.trim()) {
        showToast("Gagal: Harap lengkapi semua kolom bertanda (*)", "error");
        return;
    }

    const kelasId = parseInt(kelasEl.value);
    const kelas = (appData.kelasList || []).find(k => Number(k.id) === kelasId);
    if (!kelas) {
        showToast("Kelas yang dipilih tidak valid.", "error");
        return;
    }

    const payload = {
        kelasId,
        matkulId: kelas.mata_kuliah_id,
        judul: judulEl.value.trim(),
        deadline: deadlineEl.value.replace("T", " "),
        deskripsi: deskripsiEl.value.trim(),
        lampiranSoal: null
    };

    const file = fileEl.files && fileEl.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async function (e) {
            payload.lampiranSoal = {
                nama: file.name,
                size: formatFileSize(file.size),
                dataUrl: e.target.result
            };
            await dispatchCreateTugas(payload);
        };
        reader.readAsDataURL(file);
    } else {
        await dispatchCreateTugas(payload);
    }
}

async function dispatchCreateTugas(payload) {
    try {
        const res = await fetch("api.php?action=create_tugas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            payload.id = data.id || Date.now();
            payload.submissions = [];
            appData.tugas.unshift(payload);
            closeModal();
            renderApp();
            showToast(`Tugas "${payload.judul}" berhasil disimpan!`, "success");
            return;
        } else {
            showToast(data.message || "Gagal menerbitkan tugas.", "error");
            return;
        }
    } catch (e) { }

    payload.id = Date.now();
    payload.submissions = [];
    appData.tugas.unshift(payload);
    closeModal();
    renderApp();
    showToast(`Tugas "${payload.judul}" berhasil disimpan!`, "success");
}

function openModalEditTugas(tugasId) {
    if (appData.currentUser.role !== 'dosen') {
        showToast("Akses ditolak: Hanya Dosen yang dapat mengubah tugas perkuliahan.", "error");
        return;
    }

    const tugas = appData.tugas.find(t => t.id === tugasId);
    if (!tugas) return;

    const myClasses = (appData.kelasList || []).filter(k => Number(k.dosen_id) === Number(appData.currentUser.id));
    const currentKelasId = tugas.kelasId || (myClasses.find(k => Number(k.mata_kuliah_id) === Number(tugas.matkulId)) || {}).id;

    let formattedDate = tugas.deadline;
    if (formattedDate.includes(" ")) {
        formattedDate = formattedDate.replace(" ", "T").substring(0, 16);
    }

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
                        <h3 class="font-bold text-slate-800 text-sm">Edit Data Tugas</h3>
                        <p class="text-[11px] text-slate-400">Perbarui rincian instruksi atau deadline tugas</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form onsubmit="event.preventDefault(); handleSaveEditTugas(${tugas.id});" class="space-y-3.5 text-xs">
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Kelas Perkuliahan</label>
                    <select id="edit-tugas-kelas" class="w-full p-2.5 border border-slate-300 rounded-xl bg-white">
                        ${myClasses.map(k => `
                            <option value="${k.id}" ${Number(k.id) === Number(currentKelasId) ? 'selected' : ''}>
                                ${k.nama_kelas} - ${k.kode_mk} ${k.nama_mk}
                            </option>
                        `).join("")}
                    </select>
                </div>
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Judul Tugas <span class="text-rose-500">*</span></label>
                    <input id="edit-tugas-judul" type="text" maxlength="150" required value="${tugas.judul}" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                </div>
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Tenggat Waktu <span class="text-rose-500">*</span></label>
                    <input id="edit-tugas-deadline" type="datetime-local" required value="${formattedDate}" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-maroon-500">
                </div>
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Instruksi <span class="text-rose-500">*</span></label>
                    <textarea id="edit-tugas-deskripsi" rows="3" maxlength="5000" required 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">${tugas.deskripsi}</textarea>
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600">Batal</button>
                    <button type="submit" class="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold shadow-sm transition">
                        Simpan Perubahan
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;
}

async function handleSaveEditTugas(tugasId) {
    const tugas = appData.tugas.find(t => t.id === tugasId);
    if (!tugas) return;

    const judul = document.getElementById("edit-tugas-judul").value.trim();
    const deadline = document.getElementById("edit-tugas-deadline").value;
    const deskripsi = document.getElementById("edit-tugas-deskripsi").value.trim();
    const kelasId = parseInt(document.getElementById("edit-tugas-kelas").value);
    const kelas = (appData.kelasList || []).find(k => Number(k.id) === kelasId);

    if (!judul || !deadline || !deskripsi || !kelas) {
        showToast("Kolom kelas, judul, deadline, dan instruksi tidak boleh kosong!", "error");
        return;
    }

    try {
        await fetch("api.php?action=update_tugas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: tugasId,
                kelasId,
                matkulId: kelas.mata_kuliah_id,
                judul,
                deadline: deadline.replace("T", " "),
                deskripsi
            })
        });
    } catch (e) { }

    tugas.judul = judul;
    tugas.deadline = deadline.replace("T", " ");
    tugas.deskripsi = deskripsi;
    tugas.kelasId = kelasId;
    tugas.matkulId = kelas.mata_kuliah_id;

    closeModal();
    renderApp();
    showToast(`Tugas "${judul}" berhasil diperbarui!`, "success");
}

function openModalDeleteTugas(tugasId) {
    if (appData.currentUser.role !== 'dosen') {
        showToast("Akses ditolak: Hanya Dosen yang dapat menghapus tugas perkuliahan.", "error");
        return;
    }

    const tugas = appData.tugas.find(t => t.id === tugasId);
    if (!tugas) return;

    openConfirmModal({
        title: "Konfirmasi Hapus Tugas",
        message: `Apakah Anda yakin ingin menghapus tugas <strong>"${tugas.judul}"</strong>?<br><br>Seluruh data berkas dan kiriman mahasiswa pada tugas ini akan ikut terhapus.`,
        confirmText: "Ya, Hapus Sekarang",
        confirmColor: "bg-rose-600 hover:bg-rose-700",
        onConfirm: async () => {
            try {
                await fetch("api.php?action=delete_tugas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: tugasId })
                });
            } catch (e) { }

            appData.tugas = appData.tugas.filter(t => t.id !== tugasId);
            renderApp();
            showToast(`Tugas "${tugas.judul}" berhasil dihapus.`, "success");
        }
    });
}

// MAHASISWA SUBMIT TUGAS
function openModalSubmitTugas(tugasId) {
    if (appData.currentUser.role !== 'mahasiswa') {
        showToast("Fitur pengumpulan tugas hanya dapat dilakukan oleh akun Mahasiswa.", "info");
        return;
    }

    const tugas = appData.tugas.find(t => t.id === tugasId);
    if (!tugas) return;

    const currentMhs = appData.currentUser;
    const existingSub = (tugas.submissions || []).find(s => s.mhsId === currentMhs.id || s.mhsNim === currentMhs.nomor_induk);

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100">
            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm">Pengumpulan Jawaban Tugas</h3>
                        <p class="text-[11px] text-slate-400">${tugas.judul}</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form onsubmit="event.preventDefault(); handleSaveSubmitTugas(${tugas.id});" class="space-y-3.5 text-xs">
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Pilih Berkas Jawaban (PDF / ZIP / Dokumen) <span class="text-rose-500">*</span></label>
                    <div class="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-xl p-4 text-center transition bg-slate-50/50">
                        <input id="sub-tugas-file" type="file" class="hidden" onchange="previewUploadFile(this, 'sub-file-label')">
                        <label for="sub-tugas-file" class="cursor-pointer flex flex-col items-center justify-center gap-1.5">
                            <i class="fa-solid fa-file-arrow-up text-emerald-600 text-2xl"></i>
                            <span id="sub-file-label" class="text-xs text-slate-700 font-semibold">
                                ${existingSub ? 'Klik untuk mengganti berkas jawaban Anda' : 'Klik untuk memilih berkas jawaban dari komputer'}
                            </span>
                            <span class="text-[10px] text-slate-400">Maksimum ukuran 25 MB</span>
                        </label>
                    </div>
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Catatan Tambahan untuk Dosen Pengampu</label>
                    <textarea id="sub-tugas-catatan" rows="3" placeholder="Tuliskan catatan pengerjaan atau tautan repositori GitHub bila ada..." 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500">${existingSub ? (existingSub.catatanMhs || '') : ''}</textarea>
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600">Batal</button>
                    <button id="btn-submit-tugas" type="submit" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm transition flex items-center gap-1.5">
                        <i class="fa-solid fa-paper-plane mr-1"></i> Kirim Jawaban Sekarang
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;
}

function handleSaveSubmitTugas(tugasId) {
    const tugas = appData.tugas.find(t => t.id === tugasId);
    if (!tugas) return;

    const fileEl = document.getElementById("sub-tugas-file");
    const catatanVal = document.getElementById("sub-tugas-catatan").value.trim();
    const currentMhs = appData.currentUser;
    const submitBtn = document.getElementById("btn-submit-tugas");

    if (!tugas.submissions) tugas.submissions = [];
    const existingIndex = tugas.submissions.findIndex(s => s.mhsId === currentMhs.id || s.mhsNim === currentMhs.nomor_induk);

    const file = fileEl.files && fileEl.files[0];
    if (existingIndex === -1 && !file) {
        showToast("Gagal: Anda wajib memilih berkas jawaban untuk dikirim!", "error");
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Mengirim...`;
    }

    if (file) {
        const reader = new FileReader();
        reader.onload = async function (e) {
            const subData = {
                mhsId: currentMhs.id,
                mhsNama: currentMhs.nama,
                mhsNim: currentMhs.nomor_induk,
                submittedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
                fileJawaban: {
                    nama: file.name,
                    size: formatFileSize(file.size),
                    dataUrl: e.target.result
                },
                catatanMhs: catatanVal,
                nilai: existingIndex >= 0 ? tugas.submissions[existingIndex].nilai : null,
                catatanDosen: existingIndex >= 0 ? tugas.submissions[existingIndex].catatanDosen : null
            };

            try {
                const res = await fetch("api.php?action=submit_tugas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tugasId, fileJawaban: subData.fileJawaban, catatanMhs: catatanVal })
                });
                const data = await res.json();
                if (data.success) {
                    showToast(data.message || "Jawaban tugas berhasil dikirim!", "success");
                    closeModal();
                    await loadAppData();
                    return;
                } else {
                    showToast(data.message || "Gagal mengirim tugas.", "error");
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane mr-1"></i> Kirim Jawaban Sekarang`;
                    }
                    return;
                }
            } catch (err) { 
                showToast("Terjadi kesalahan sistem.", "error");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane mr-1"></i> Kirim Jawaban Sekarang`;
                }
            }
        };
        reader.readAsDataURL(file);
    } else {
        (async () => {
            try {
                const res = await fetch("api.php?action=submit_tugas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tugasId, fileJawaban: null, catatanMhs: catatanVal })
                });
                const data = await res.json();
                if (data.success) {
                    showToast(data.message || "Catatan berhasil diperbarui!", "success");
                    closeModal();
                    await loadAppData();
                    return;
                } else {
                    showToast(data.message || "Gagal memperbarui catatan.", "error");
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane mr-1"></i> Kirim Jawaban Sekarang`;
                    }
                }
            } catch (e) {
                showToast("Terjadi kesalahan sistem.", "error");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane mr-1"></i> Kirim Jawaban Sekarang`;
                }
            }
        })();
    }
}

// PENILAIAN DOSEN
function openModalViewSubmissions(tugasId) {
    const tugas = appData.tugas.find(t => t.id === tugasId);
    if (!tugas) return;

    const submissions = tugas.submissions || [];
    const modal = document.getElementById("modal-container");

    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100">
            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                    <h3 class="font-bold text-slate-800 text-sm">Lembar Kiriman Mahasiswa</h3>
                    <p class="text-[11px] text-slate-400">${tugas.judul} (${submissions.length} Mahasiswa)</p>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            ${submissions.length === 0 ? `
                <div class="p-8 text-center bg-slate-50 rounded-xl border border-slate-100">
                    <p class="text-xs text-slate-500 font-medium">Belum ada mahasiswa yang mengumpulkan tugas ini.</p>
                </div>
            ` : `
                <div class="space-y-3">
                    ${submissions.map(sub => `
                        <div class="p-4 rounded-xl border border-slate-200 bg-white hover:border-maroon-200 transition space-y-3">
                            <div class="flex justify-between items-start">
                                <div>
                                    <h4 class="font-bold text-slate-800 text-xs">${sub.mhsNama}</h4>
                                    <p class="text-[10px] text-slate-400">NIM: ${sub.mhsNim} &bull; ${sub.submittedAt}</p>
                                </div>
                                <div>
                                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${sub.nilai !== null ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                                        ${sub.nilai !== null ? `Nilai: ${sub.nilai}/100` : 'Belum Dinilai'}
                                    </span>
                                </div>
                            </div>

                            ${sub.catatanMhs ? `<p class="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg italic">"${sub.catatanMhs}"</p>` : ''}

                            <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                                <div>
                                    ${sub.fileJawaban ? `
                                        <button onclick="downloadFile('${sub.fileJawaban.nama}', '${sub.fileJawaban.dataUrl || ''}', 'Jawaban Mahasiswa: ${sub.mhsNama}')" 
                                            class="text-maroon-600 hover:text-maroon-800 font-semibold text-[11px] flex items-center gap-1.5">
                                            <i class="fa-solid fa-download"></i> Unduh ${sub.fileJawaban.nama}
                                        </button>
                                    ` : '<span class="text-slate-400 text-[11px]">Tidak ada berkas</span>'}
                                </div>

                                <button onclick="openModalGradeSubmission(${tugas.id}, ${sub.mhsId})" 
                                    class="px-3 py-1 bg-maroon-50 hover:bg-maroon-100 text-maroon-700 rounded-lg font-semibold text-xs transition">
                                    <i class="fa-regular fa-star mr-1"></i> ${sub.nilai !== null ? 'Ubah Nilai' : 'Beri Nilai'}
                                </button>
                            </div>
                        </div>
                    `).join("")}
                </div>
            `}

            <div class="pt-3 border-t border-slate-100 flex justify-end">
                <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold">Tutup</button>
            </div>
        </div>
    </div>
    `;
}

function openModalGradeSubmission(tugasId, mhsId) {
    const tugas = appData.tugas.find(t => t.id === tugasId);
    if (!tugas) return;
    const sub = (tugas.submissions || []).find(s => s.mhsId === mhsId);
    if (!sub) return;

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 border border-slate-100">
            <div class="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 class="font-bold text-slate-800 text-sm">Penilaian Tugas Mahasiswa</h3>
                <button onclick="openModalViewSubmissions(${tugasId})" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                <p class="font-bold text-slate-800">${sub.mhsNama} (${sub.mhsNim})</p>
                <p class="text-slate-500 text-[11px]">${tugas.judul}</p>
            </div>
            <form onsubmit="event.preventDefault(); handleSaveGradeSubmission(${tugasId}, ${mhsId});" class="space-y-3 text-xs">
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Skor Nilai (0 - 100) <span class="text-rose-500">*</span></label>
                    <input id="grade-score" type="number" min="0" max="100" step="0.5" required value="${sub.nilai !== null ? sub.nilai : 85}" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-base text-slate-800 focus:ring-2 focus:ring-maroon-500">
                </div>
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Catatan Evaluasi / Masukan Dosen</label>
                    <textarea id="grade-note" rows="3" placeholder="Tuliskan masukan perbaikan..." 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">${sub.catatanDosen || ''}</textarea>
                </div>
                <div class="pt-2 flex justify-end gap-2">
                    <button type="button" onclick="openModalViewSubmissions(${tugasId})" class="px-4 py-2 border rounded-xl font-semibold text-slate-600">Kembali</button>
                    <button type="submit" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold">Simpan Nilai</button>
                </div>
            </form>
        </div>
    </div>
    `;
}

async function handleSaveGradeSubmission(tugasId, mhsId) {
    const scoreVal = parseFloat(document.getElementById("grade-score").value);
    const noteVal = document.getElementById("grade-note").value.trim();

    if (!Validator.isValidScore(scoreVal)) {
        showToast("Nilai skor harus berupa angka antara 0 hingga 100!", "error");
        return;
    }

    try {
        await fetch("api.php?action=grade_submission", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tugasId, mhsId, nilai: scoreVal, catatanDosen: noteVal })
        });
    } catch (err) { }

    const tugas = appData.tugas.find(t => t.id === tugasId);
    if (tugas) {
        const sub = (tugas.submissions || []).find(s => s.mhsId === mhsId);
        if (sub) {
            sub.nilai = scoreVal;
            sub.catatanDosen = noteVal;
            if (currentTab === 'classes') {
                closeModal();
                renderApp();
            } else {
                openModalViewSubmissions(tugasId);
            }
            showToast(`Nilai untuk ${sub.mhsNama} berhasil disimpan!`, "success");
        }
    }
}
