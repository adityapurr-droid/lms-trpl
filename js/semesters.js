/**
 * js/semesters.js - Modul Semester & Tahun Akademik
 * Pengaturan Periode Aktif dan Riwayat Semester
 */
// ==================== MANAJEMEN SEMESTER (ADMIN) ====================

function renderAdminSemesters() {
    const semesters = appData.semesters || [];
    const aktif = semesters.find(s => s.is_aktif == 1);

    return `
    <div class="space-y-6">
        <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
                <h1 class="text-xl font-bold text-slate-800">Manajemen Semester & Tahun Akademik</h1>
                <p class="text-xs text-slate-500 mt-0.5">Kelola semester aktif dan tahun akademik program studi</p>
            </div>
            <button onclick="openModalAddSemester()"
                class="flex items-center gap-2 px-4 py-2 bg-maroon-600 text-white text-xs font-bold rounded-xl hover:bg-maroon-700 transition shadow">
                <i class="fa-solid fa-plus"></i> Tambah Semester Baru
            </button>
        </div>

        ${aktif ? `
        <div class="bg-maroon-800 rounded-2xl p-5 text-white shadow flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0">
                <i class="fa-solid fa-calendar-check"></i>
            </div>
            <div>
                <p class="text-xs font-semibold text-maroon-200 uppercase tracking-wider">Semester Aktif Saat Ini</p>
                <h2 class="text-lg font-bold mt-0.5">${aktif.nama}</h2>
                <p class="text-xs text-maroon-200 mt-0.5">Dibuat: ${new Date(aktif.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
        </div>
        ` : `
        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-3 text-amber-700">
            <i class="fa-solid fa-triangle-exclamation text-xl"></i>
            <p class="text-sm font-semibold">Belum ada semester aktif. Silakan tambah dan aktifkan semester.</p>
        </div>
        `}

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 class="text-sm font-bold text-slate-700">Daftar Semua Semester</h3>
                <span class="text-xs text-slate-400">${semesters.length} semester terdaftar</span>
            </div>
            ${semesters.length === 0 ? `
                <div class="p-12 text-center">
                    <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-2xl mb-3">
                        <i class="fa-solid fa-calendar-days"></i>
                    </div>
                    <h3 class="text-sm font-bold text-slate-700">Belum Ada Semester</h3>
                    <p class="text-xs text-slate-500 mt-1">Tambahkan semester pertama untuk memulai tahun akademik.</p>
                    <button onclick="openModalAddSemester()" class="mt-4 px-4 py-2 bg-maroon-600 text-white text-xs font-bold rounded-xl hover:bg-maroon-700 transition">
                        <i class="fa-solid fa-plus mr-1"></i> Tambah Semester
                    </button>
                </div>
            ` : `
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead class="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200">
                        <tr>
                            <th class="p-4 w-10">#</th>
                            <th class="p-4">Nama Semester</th>
                            <th class="p-4">Status</th>
                            <th class="p-4">Tanggal Dibuat</th>
                            <th class="p-4 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${semesters.map((s, i) => {
        const isAktif = s.is_aktif == 1;
        const createdDate = new Date(s.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        return `
                            <tr class="hover:bg-slate-50 transition ${isAktif ? 'bg-maroon-50/40' : ''}">
                                <td class="p-4 text-slate-400 font-mono">${i + 1}</td>
                                <td class="p-4">
                                    <div class="flex items-center gap-2">
                                        ${isAktif ? '<i class="fa-solid fa-circle text-maroon-500 text-[8px]"></i>' : '<i class="fa-regular fa-circle text-slate-300 text-[8px]"></i>'}
                                        <span class="font-semibold text-slate-800">${s.nama}</span>
                                    </div>
                                </td>
                                <td class="p-4">
                                    ${isAktif
                ? '<span class="px-2.5 py-1 bg-maroon-100 text-maroon-700 font-bold rounded-full text-[10px]"><i class="fa-solid fa-check mr-1"></i>Aktif</span>'
                : '<span class="px-2.5 py-1 bg-slate-100 text-slate-500 font-semibold rounded-full text-[10px]">Non-Aktif</span>'
            }
                                </td>
                                <td class="p-4 text-slate-500">${createdDate}</td>
                                <td class="p-4">
                                    <div class="flex items-center justify-end gap-2">
                                        ${!isAktif ? `
                                        <button onclick="handleSetActiveSemester(${s.id})"
                                            class="px-3 py-1.5 bg-maroon-50 text-maroon-700 hover:bg-maroon-100 rounded-lg text-[11px] font-semibold transition flex items-center gap-1">
                                            <i class="fa-solid fa-toggle-on"></i> Aktifkan
                                        </button>
                                        ` : `
                                        <span class="px-3 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[11px] font-semibold cursor-not-allowed">
                                            <i class="fa-solid fa-lock mr-1"></i>Aktif
                                        </span>
                                        `}
                                        <button onclick="openModalEditSemester(${s.id})"
                                            class="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-[11px] font-semibold transition flex items-center gap-1">
                                            <i class="fa-solid fa-pen"></i> Edit
                                        </button>
                                        ${!isAktif ? `
                                        <button onclick="openModalDeleteSemester(${s.id}, '${s.nama.replace(/'/g, "\\'")}')"
                                            class="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-[11px] font-semibold transition flex items-center gap-1">
                                            <i class="fa-solid fa-trash"></i> Hapus
                                        </button>
                                        ` : `
                                        <span class="px-3 py-1.5 bg-slate-50 text-slate-300 rounded-lg text-[11px] font-semibold cursor-not-allowed">
                                            <i class="fa-solid fa-trash mr-1"></i>Hapus
                                        </span>
                                        `}
                                    </div>
                                </td>
                            </tr>
                            `;
    }).join('')}
                    </tbody>
                </table>
            </div>
            `}
        </div>
    </div>
    `;
}

function openModalAddSemester() {
    if (appData.currentUser.role !== 'admin') {
        showToast("Akses ditolak: Hanya Administrator yang dapat menambah semester.", "error");
        return;
    }

    const modal = document.getElementById("modal-container");
    if (!modal) return;

    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100">
            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-maroon-50 text-maroon-600 flex items-center justify-center font-bold text-sm">
                        <i class="fa-solid fa-calendar-plus"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm">Tambah Semester Baru</h3>
                        <p class="text-[11px] text-slate-400">Atur periode semester & tahun akademik program studi TRPL</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form onsubmit="event.preventDefault(); handleSaveAddSemester();" class="space-y-4 text-xs">
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Nama Semester & Tahun Akademik <span class="text-rose-500">*</span></label>
                    <input id="add-sem-nama" type="text" maxlength="50" required placeholder="Contoh: Ganjil 2024/2025 atau Genap 2024/2025" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500 outline-none">
                    <p class="text-[11px] text-slate-400 mt-1">Format disarankan: [Ganjil/Genap] [Tahun Akademik], maks. 50 karakter.</p>
                </div>

                <div class="flex items-start gap-3 p-3.5 bg-maroon-50/70 rounded-xl border border-maroon-100">
                    <input id="add-sem-aktif" type="checkbox" class="w-4 h-4 mt-0.5 accent-maroon-600 rounded cursor-pointer">
                    <div>
                        <label for="add-sem-aktif" class="text-xs font-bold text-maroon-900 cursor-pointer">Jadikan Sebagai Semester Aktif</label>
                        <p class="text-[11px] text-maroon-700/80 mt-0.5">Jika dicentang, semester yang sedang aktif saat ini akan otomatis dinonaktifkan.</p>
                    </div>
                </div>

                <div class="pt-2 flex justify-end gap-2 border-t border-slate-100">
                    <button type="button" onclick="closeModal()" class="px-4 py-2.5 border border-slate-300 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition">
                        Batal
                    </button>
                    <button type="submit" id="btn-save-semester" class="px-4 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl font-bold transition shadow-sm flex items-center gap-2">
                        <i class="fa-solid fa-check"></i> Simpan Semester
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;

    setTimeout(() => {
        const input = document.getElementById("add-sem-nama");
        if (input) input.focus();
    }, 100);
}

async function handleSaveAddSemester() {
    const namaEl = document.getElementById('add-sem-nama');
    const aktifEl = document.getElementById('add-sem-aktif');
    if (!namaEl) return;

    const nama = namaEl.value.trim();
    if (nama.length < 3) {
        showToast('Nama semester minimal 3 karakter.', 'error');
        namaEl.focus();
        return;
    }
    if (nama.length > 50) {
        showToast('Nama semester maksimal 50 karakter.', 'error');
        namaEl.focus();
        return;
    }
    const is_aktif = (aktifEl && aktifEl.checked) ? 1 : 0;

    const btn = document.getElementById('btn-save-semester');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...';
    }

    try {
        const res = await fetch('api.php?action=create_semester', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nama, is_aktif })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Gagal menyimpan semester.');
        }

        const newId = (data.semester && data.semester.id) ? data.semester.id : (data.id || Date.now());
        const newSem = {
            id: newId,
            nama: nama,
            is_aktif: is_aktif,
            created_at: new Date().toISOString()
        };

        if (is_aktif) {
            appData.semesters.forEach(s => s.is_aktif = 0);
            appData.semesterAktif = nama;
        }
        appData.semesters.unshift(newSem);

        closeModal();
        renderApp();
        showToast(data.message || `Semester "${nama}" berhasil ditambahkan!`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan Semester';
        }
    }
}

function openModalEditSemester(semId) {
    if (appData.currentUser.role !== 'admin') {
        showToast("Akses ditolak: Hanya Administrator yang dapat mengedit semester.", "error");
        return;
    }

    const sem = (appData.semesters || []).find(s => s.id == semId);
    if (!sem) {
        showToast("Data semester tidak ditemukan.", "error");
        return;
    }

    const isAktif = (sem.is_aktif == 1);
    const modal = document.getElementById("modal-container");
    if (!modal) return;

    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100">
            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm">Edit Semester & Tahun Akademik</h3>
                        <p class="text-[11px] text-slate-400">Perbarui nama atau status keaktifan semester</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form onsubmit="event.preventDefault(); handleSaveEditSemester(${semId});" class="space-y-4 text-xs">
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Nama Semester & Tahun Akademik <span class="text-rose-500">*</span></label>
                    <input id="edit-sem-nama" type="text" maxlength="50" required value="${sem.nama}"
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500 outline-none">
                </div>

                <div class="flex items-start gap-3 p-3.5 bg-amber-50/70 rounded-xl border border-amber-200">
                    <input id="edit-sem-aktif" type="checkbox" ${isAktif ? 'checked disabled' : ''} class="w-4 h-4 mt-0.5 accent-maroon-600 rounded cursor-pointer">
                    <div>
                        <label for="edit-sem-aktif" class="text-xs font-bold text-amber-900 cursor-pointer">
                            ${isAktif ? 'Semester Ini Sudah Berstatus Aktif' : 'Jadikan Sebagai Semester Aktif'}
                        </label>
                        <p class="text-[11px] text-amber-700 mt-0.5">
                            ${isAktif ? 'Semester aktif tidak dapat dinonaktifkan secara langsung tanpa mengaktifkan semester lain.' : 'Mengaktifkan semester ini akan otomatis menonaktifkan semester lain.'}
                        </p>
                    </div>
                </div>

                <div class="pt-2 flex justify-end gap-2 border-t border-slate-100">
                    <button type="button" onclick="closeModal()" class="px-4 py-2.5 border border-slate-300 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition">
                        Batal
                    </button>
                    <button type="submit" id="btn-edit-semester" class="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition shadow-sm flex items-center gap-2">
                        <i class="fa-solid fa-check"></i> Simpan Perubahan
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;

    setTimeout(() => {
        const input = document.getElementById("edit-sem-nama");
        if (input) input.focus();
    }, 100);
}

async function handleSaveEditSemester(semId) {
    const namaEl = document.getElementById('edit-sem-nama');
    const aktifEl = document.getElementById('edit-sem-aktif');
    if (!namaEl) return;

    const nama = namaEl.value.trim();
    if (nama.length < 3) {
        showToast('Nama semester minimal 3 karakter.', 'error');
        namaEl.focus();
        return;
    }
    if (nama.length > 50) {
        showToast('Nama semester maksimal 50 karakter.', 'error');
        namaEl.focus();
        return;
    }
    const is_aktif = aktifEl && !aktifEl.disabled && aktifEl.checked ? 1 : (aktifEl && aktifEl.disabled ? 1 : 0);

    const btn = document.getElementById('btn-edit-semester');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Menyimpan...';
    }

    try {
        const res = await fetch('api.php?action=update_semester', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: semId, nama, is_aktif })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Gagal memperbarui semester.');
        }

        const idx = appData.semesters.findIndex(s => s.id == semId);
        if (idx !== -1) {
            if (is_aktif) {
                appData.semesters.forEach(s => s.is_aktif = 0);
                appData.semesterAktif = nama;
            }
            appData.semesters[idx].nama = nama;
            appData.semesters[idx].is_aktif = is_aktif;
        }

        closeModal();
        renderApp();
        showToast(data.message || `Semester "${nama}" berhasil diperbarui.`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan Perubahan';
        }
    }
}

async function handleSetActiveSemester(semId) {
    const sem = (appData.semesters || []).find(s => s.id == semId);
    if (!sem) return;

    openConfirmModal({
        title: 'Aktifkan Semester',
        message: `Yakin ingin mengaktifkan semester <strong>"${sem.nama}"</strong>?<br><span class="text-slate-500">Semester lain yang saat ini aktif akan otomatis dinonaktifkan.</span>`,
        confirmText: 'Ya, Aktifkan',
        confirmColor: 'bg-maroon-600 hover:bg-maroon-700',
        onConfirm: async () => {
            try {
                const res = await fetch('api.php?action=set_active_semester', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: semId })
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || 'Gagal mengaktifkan semester.');
                }

                appData.semesters.forEach(s => s.is_aktif = (s.id == semId ? 1 : 0));
                appData.semesterAktif = sem.nama;
                renderApp();
                showToast(data.message || `Semester "${sem.nama}" kini menjadi semester aktif.`, 'success');
            } catch (err) {
                showToast(err.message, 'error');
            }
        }
    });
}

function openModalDeleteSemester(semId, semNama) {
    const sem = (appData.semesters || []).find(s => s.id == semId);
    if (sem && sem.is_aktif == 1) {
        showToast('Semester aktif tidak dapat dihapus. Aktifkan semester lain terlebih dahulu.', 'error');
        return;
    }

    openConfirmModal({
        title: 'Hapus Semester',
        message: `Yakin ingin menghapus semester <strong>"${semNama}"</strong>?<br><span class="text-rose-500 font-semibold">Tindakan ini tidak dapat dibatalkan.</span>`,
        confirmText: 'Ya, Hapus',
        confirmColor: 'bg-rose-600 hover:bg-rose-700',
        onConfirm: async () => {
            try {
                const res = await fetch('api.php?action=delete_semester', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: semId })
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || 'Gagal menghapus semester.');
                }

                appData.semesters = appData.semesters.filter(s => s.id != semId);
                renderApp();
                showToast(data.message || `Semester "${semNama}" berhasil dihapus.`, 'success');
            } catch (err) {
                showToast(err.message, 'error');
            }
        }
    });
}

// ==================== END MANAJEMEN SEMESTER ====================
