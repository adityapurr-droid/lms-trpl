/**
 * js/users.js - Modul Manajemen Pengguna (Admin CRUD)
 * Terintegrasi Database MySQL, Upload Foto, dan Bcrypt Hashing
 */
// =============================================================
// MODUL LENGKAP: MANAJEMEN PENGGUNA (ADMIN CRUD TERINTEGRASI)
// =============================================================

function renderAdminUsers() {
    // 1. Filtering & Searching Pengguna
    let filteredUsers = appData.users.filter(u => {
        if (userFilter.search) {
            const q = userFilter.search.toLowerCase();
            const matchName = (u.nama || '').toLowerCase().includes(q);
            const matchId = (u.nomor_induk || '').toLowerCase().includes(q);
            const matchMail = (u.email || '').toLowerCase().includes(q);
            if (!matchName && !matchId && !matchMail) return false;
        }

        if (userFilter.role !== "all") {
            if (u.role !== userFilter.role) return false;
        }

        if (userFilter.angkatan !== "all") {
            if (u.role !== "mahasiswa" || String(u.angkatan_id) !== String(userFilter.angkatan)) return false;
        }

        return true;
    });

    // 2. Paginasi Pengguna
    const totalItems = filteredUsers.length;
    const totalPages = Math.ceil(totalItems / userFilter.perPage) || 1;
    if (userFilter.page > totalPages) userFilter.page = totalPages;

    const startIndex = (userFilter.page - 1) * userFilter.perPage;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + userFilter.perPage);

    return `
    <div class="space-y-6">
        <!-- Header & Tombol Tambah User -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <i class="fa-solid fa-users-gear text-maroon-600"></i>
                    Manajemen Pengguna Sistem
                </h1>
                <p class="text-xs text-slate-500 mt-0.5">Kelola akun Admin, Dosen, dan Mahasiswa Politeknik CWE dengan validasi & enkripsi Bcrypt.</p>
            </div>
            <button onclick="openModalAddUser()" class="px-4 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition shrink-0">
                <i class="fa-solid fa-user-plus"></i> Tambah Pengguna Baru
            </button>
        </div>

        <!-- Toolbar Pencarian & Filter Peran -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div class="md:col-span-2 relative">
                    <span class="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <i class="fa-solid fa-magnifying-glass text-xs"></i>
                    </span>
                    <input type="text" 
                        id="admin-user-search"
                        placeholder="Cari berdasarkan nama, NIM, NIP, atau email..." 
                        value="${userFilter.search}"
                        oninput="handleUserSearch(this.value)"
                        class="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-maroon-500 focus:outline-none">
                </div>

                <div>
                    <select onchange="handleUserRoleFilter(this.value)" class="w-full py-2 px-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-maroon-500 focus:outline-none bg-white font-medium">
                        <option value="all" ${userFilter.role === 'all' ? 'selected' : ''}>Semua Peran (${appData.users.length})</option>
                        <option value="admin" ${userFilter.role === 'admin' ? 'selected' : ''}>👑 Administrator</option>
                        <option value="dosen" ${userFilter.role === 'dosen' ? 'selected' : ''}>👨‍🏫 Dosen Pengampu</option>
                        <option value="mahasiswa" ${userFilter.role === 'mahasiswa' ? 'selected' : ''}>👨‍🎓 Mahasiswa</option>
                    </select>
                </div>

                <div>
                    <select onchange="handleUserAngkatanFilter(this.value)" class="w-full py-2 px-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-maroon-500 focus:outline-none bg-white font-medium">
                        <option value="all" ${userFilter.angkatan === 'all' ? 'selected' : ''}>Semua Angkatan</option>
                        ${(appData.angkatanList || []).map(a => `
                            <option value="${a.id}" ${String(userFilter.angkatan) === String(a.id) ? 'selected' : ''}>${a.nama_angkatan}</option>
                        `).join("")}
                    </select>
                </div>
            </div>
        </div>

        <!-- Tabel Pengguna (READ) -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            ${totalItems === 0 ? `
                <div class="p-12 text-center">
                    <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-xl mb-2">
                        <i class="fa-solid fa-user-slash"></i>
                    </div>
                    <p class="text-xs text-slate-500 font-semibold">Tidak ada pengguna yang sesuai dengan filter.</p>
                </div>
            ` : `
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs">
                        <thead class="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] tracking-wider font-semibold">
                            <tr>
                                <th class="p-4">Pengguna</th>
                                <th class="p-4">Identitas (NIM/NIP)</th>
                                <th class="p-4">Email Kampus</th>
                                <th class="p-4">Peran (Role)</th>
                                <th class="p-4">Angkatan</th>
                                <th class="p-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${paginatedUsers.map(u => `
                                <tr class="hover:bg-slate-50/80 transition">
                                    <td class="p-4">
                                        <div class="flex items-center gap-3">
                                            <div class="shrink-0">
                                                ${getUserAvatar(u, "w-9 h-9 text-xs", "rounded-xl")}
                                            </div>
                                            <div>
                                                <p class="font-bold text-slate-800 text-xs">${u.nama}</p>
                                                ${u.id === appData.currentUser.id ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-maroon-100 text-maroon-700 font-bold">Akun Anda</span>' : ''}
                                            </div>
                                        </div>
                                    </td>
                                    <td class="p-4 font-mono font-bold text-slate-700">${u.nomor_induk}</td>
                                    <td class="p-4 text-slate-500">${u.email}</td>
                                    <td class="p-4">
                                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${u.role === 'admin' ? 'bg-rose-100 text-rose-700' :
            u.role === 'dosen' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
        }">${u.role}</span>
                                    </td>
                                    <td class="p-4 text-slate-600 text-[11px]">
                                        ${u.role === 'mahasiswa'
            ? (u.angkatan || ((appData.angkatanList || []).find(a => a.id === u.angkatan_id) || {}).nama_angkatan || '-')
            : '<span class="text-slate-300">-</span>'}
                                    </td>
                                    <td class="p-4 text-right">
                                        <div class="inline-flex items-center gap-1.5">
                                            <button onclick="openModalEditUser(${u.id})" class="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-[11px] transition">
                                                <i class="fa-regular fa-pen-to-square mr-1"></i> Edit
                                            </button>
                                            <button onclick="openModalDeleteUser(${u.id})" class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition">
                                                <i class="fa-regular fa-trash-can mr-1"></i> Hapus
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>

                <!-- Kontrol Paginasi Pengguna -->
                <div class="p-4 bg-slate-50/50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <span class="text-slate-500 text-[11px]">
                        Menampilkan <span class="font-bold text-slate-700">${startIndex + 1}</span> - <span class="font-bold text-slate-700">${Math.min(startIndex + userFilter.perPage, totalItems)}</span> dari <span class="font-bold text-slate-700">${totalItems}</span> pengguna
                    </span>

                    <div class="flex items-center gap-1">
                        <button onclick="changeUserPage(${userFilter.page - 1})" 
                            ${userFilter.page <= 1 ? 'disabled class="px-3 py-1 rounded border border-slate-200 text-slate-300 cursor-not-allowed"' : 'class="px-3 py-1 rounded border border-slate-300 text-slate-600 hover:bg-white font-medium transition"'}>
                            Sebelumnya
                        </button>
                        ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
                            <button onclick="changeUserPage(${p})" class="w-7 h-7 rounded font-bold text-xs ${userFilter.page === p ? 'bg-maroon-600 text-white' : 'text-slate-600 hover:bg-white'}">
                                ${p}
                            </button>
                        `).join("")}
                        <button onclick="changeUserPage(${userFilter.page + 1})" 
                            ${userFilter.page >= totalPages ? 'disabled class="px-3 py-1 rounded border border-slate-200 text-slate-300 cursor-not-allowed"' : 'class="px-3 py-1 rounded border border-slate-300 text-slate-600 hover:bg-white font-medium transition"'}>
                            Selanjutnya
                        </button>
                    </div>
                </div>
            `}
        </div>
    </div>
    `;
}

function handleUserSearch(val) {
    userFilter.search = val;
    userFilter.page = 1;
    renderApp();
}

function handleUserRoleFilter(val) {
    userFilter.role = val;
    userFilter.page = 1;
    renderApp();
}

function handleUserAngkatanFilter(val) {
    userFilter.angkatan = val;
    userFilter.page = 1;
    renderApp();
}

function toggleAngkatanField(mode, role) {
    const wrapper = document.getElementById(`user-${mode}-angkatan-wrapper`);
    const select = document.getElementById(`user-${mode}-angkatan`);
    const isMahasiswa = role === "mahasiswa";
    if (wrapper) wrapper.classList.toggle("hidden", !isMahasiswa);
    if (select) select.required = isMahasiswa;
}

function changeUserPage(p) {
    userFilter.page = p;
    renderApp();
}

// -------------------------------------------------------------
// MODAL KELOLA FOTO PROFIL (UPLOAD / HAPUS AVATAR - MAKS 5 MB)
// -------------------------------------------------------------
function openModalManagePhoto(userId) {
    const targetUser = appData.users.find(u => u.id === userId || u.id === String(userId));
    if (!targetUser) {
        showToast('Pengguna tidak ditemukan.', 'error');
        return;
    }

    // Foto profil hanya dapat dikelola oleh pemilik akun
    if (Number(targetUser.id) !== Number(appData.currentUser.id)) {
        showToast('Akses ditolak: Anda hanya dapat mengelola foto profil Anda sendiri.', 'error');
        return;
    }

    const hasCustomFoto = targetUser.foto && targetUser.foto !== 'default.png';

    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-5 border border-slate-100">
            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-maroon-50 text-maroon-600 flex items-center justify-center font-bold text-sm">
                        <i class="fa-solid fa-camera"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm">Kelola Foto Profil</h3>
                        <p class="text-[11px] text-slate-400">Unggah atau hapus foto pengguna</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <!-- Preview Avatar -->
            <div class="flex flex-col items-center gap-3">
                <div id="manage-photo-preview">
                    ${getUserAvatar(targetUser, 'w-24 h-24 text-3xl', 'rounded-full')}
                </div>
                <p class="text-sm font-semibold text-slate-700">${targetUser.nama}</p>
                <p class="text-[11px] text-slate-400 font-mono">${targetUser.nomor_induk || targetUser.email}</p>
                ${hasCustomFoto ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">Foto Aktif</span>' : '<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">Avatar Default</span>'}
            </div>

            <!-- Upload Form -->
            <div class="space-y-3">
                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <label class="block font-semibold text-slate-700 text-xs mb-1.5">Pilih Foto Baru (Maks. 5 MB)</label>
                    <input type="file" id="manage-foto-file" accept=".jpg,.jpeg,.png,.webp,.gif"
                        class="w-full text-slate-600 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-maroon-50 file:text-maroon-700 hover:file:bg-maroon-100 cursor-pointer"
                        onchange="handleManagePhotoPreview(this)">
                    <p class="text-[10px] text-slate-400 mt-1">Format: JPG, JPEG, PNG, WEBP, GIF.</p>
                    <div id="manage-foto-error" class="hidden mt-1.5 text-[11px] text-rose-600 font-semibold"></div>
                </div>

                <div class="flex gap-2">
                    ${hasCustomFoto ? `
                    <button type="button" id="btn-delete-avatar" onclick="handleDeleteAvatar(${targetUser.id})"
                        class="flex-1 px-3 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center justify-center gap-1.5">
                        <i class="fa-regular fa-trash-can"></i> Hapus Foto
                    </button>
                    ` : ''}
                    <button type="button" id="btn-upload-avatar" onclick="handleUploadAvatar(${targetUser.id})"
                        class="flex-1 px-3 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-cloud-arrow-up"></i> Unggah Foto
                    </button>
                </div>

                <button type="button" onclick="closeModal()"
                    class="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                    Tutup
                </button>
            </div>
        </div>
    </div>`;
}

function handleManagePhotoPreview(input) {
    const errorEl = document.getElementById('manage-foto-error');
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const maxSize = 5 * 1024 * 1024; // 5 MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    if (file.size > maxSize) {
        errorEl.textContent = `Gagal: Ukuran file (${formatFileSize(file.size)}) melebihi batas 5 MB!`;
        errorEl.classList.remove('hidden');
        input.value = '';
        return;
    }

    if (!allowedTypes.includes(file.type)) {
        errorEl.textContent = 'Gagal: Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF.';
        errorEl.classList.remove('hidden');
        input.value = '';
        return;
    }

    errorEl.classList.add('hidden');

    // Preview gambar baru di modal
    const reader = new FileReader();
    reader.onload = function (e) {
        const previewEl = document.getElementById('manage-photo-preview');
        if (previewEl) {
            previewEl.innerHTML = `<img src="${e.target.result}" alt="Preview" class="w-24 h-24 rounded-full object-cover border-2 border-maroon-300 shadow">`;
        }
    };
    reader.readAsDataURL(file);
}

async function handleUploadAvatar(userId) {
    const fileEl = document.getElementById('manage-foto-file');
    if (!fileEl || !fileEl.files || !fileEl.files[0]) {
        showToast('Pilih file foto terlebih dahulu!', 'error');
        return;
    }

    const file = fileEl.files[0];
    if (file.size > 5 * 1024 * 1024) {
        showToast('Ukuran file melebihi batas maksimal 5 MB!', 'error');
        return;
    }

    // Disable tombol upload selama proses
    const btnUpload = document.getElementById('btn-upload-avatar');
    if (btnUpload) {
        btnUpload.disabled = true;
        btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengunggah...';
    }

    const formData = new FormData();
    formData.append('foto', file);
    formData.append('user_id', userId);

    try {
        const res = await fetch('api.php?action=upload_avatar', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            // Perbarui data lokal
            const targetUser = appData.users.find(u => Number(u.id) === Number(userId));
            if (targetUser) {
                targetUser.foto = data.foto;
            }
            // Jika foto milik pengguna saat ini, perbarui currentUser juga
            if (Number(userId) === Number(appData.currentUser.id)) {
                appData.currentUser.foto = data.foto;
            }
            closeModal();
            renderApp();
            showToast('Foto profil berhasil diunggah dan diperbarui!', 'success');
        } else {
            showToast(data.message || 'Gagal mengunggah foto.', 'error');
            if (btnUpload) {
                btnUpload.disabled = false;
                btnUpload.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Unggah Foto';
            }
        }
    } catch (err) {
        showToast('Kesalahan jaringan saat mengunggah foto. Pastikan server aktif.', 'error');
        if (btnUpload) {
            btnUpload.disabled = false;
            btnUpload.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Unggah Foto';
        }
    }
}

async function handleDeleteAvatar(userId) {
    // Disable tombol hapus
    const btnDelete = document.getElementById('btn-delete-avatar');
    if (btnDelete) {
        btnDelete.disabled = true;
        btnDelete.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menghapus...';
    }

    try {
        const res = await fetch('api.php?action=delete_avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        const data = await res.json();

        if (data.success) {
            const targetUser = appData.users.find(u => Number(u.id) === Number(userId));
            if (targetUser) {
                targetUser.foto = 'default.png';
            }
            if (Number(userId) === Number(appData.currentUser.id)) {
                appData.currentUser.foto = 'default.png';
            }
            closeModal();
            renderApp();
            showToast('Foto profil berhasil dihapus dan dikembalikan ke avatar default.', 'success');
        } else {
            showToast(data.message || 'Gagal menghapus foto.', 'error');
            if (btnDelete) {
                btnDelete.disabled = false;
                btnDelete.innerHTML = '<i class="fa-regular fa-trash-can"></i> Hapus Foto';
            }
        }
    } catch (err) {
        showToast('Kesalahan jaringan saat menghapus foto.', 'error');
        if (btnDelete) {
            btnDelete.disabled = false;
            btnDelete.innerHTML = '<i class="fa-regular fa-trash-can"></i> Hapus Foto';
        }
    }
}

// -------------------------------------------------------------
// MODAL TAMBAH PENGGUNA (CREATE USER - DENGAN VALIDASI LENGKAP)
// -------------------------------------------------------------
function openModalAddUser() {
    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100">
            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-maroon-50 text-maroon-600 flex items-center justify-center font-bold text-sm">
                        <i class="fa-solid fa-user-plus"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm">Tambah Pengguna Baru</h3>
                        <p class="text-[11px] text-slate-400">Akun akan disimpan ke database dengan enkripsi Bcrypt</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form onsubmit="event.preventDefault(); handleSaveAddUser();" class="space-y-3.5 text-xs">
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Peran Akun (Role) <span class="text-rose-500">*</span></label>
                    <select id="user-add-role" onchange="toggleAngkatanField('add', this.value)" class="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium focus:ring-2 focus:ring-maroon-500">
                        <option value="mahasiswa">Mahasiswa</option>
                        <option value="dosen">Dosen Pengampu</option>
                        <option value="admin">Administrator</option>
                    </select>
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar <span class="text-rose-500">*</span> (Maks. 100 Karakter)</label>
                    <input id="user-add-nama" type="text" maxlength="100" required placeholder="Contoh: Rian Pratama, S.Tr.Kom" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Nomor Induk (NIM / NIP) <span class="text-rose-500">*</span> (Maks. 30 Karakter)</label>
                        <input id="user-add-id" type="text" maxlength="30" required placeholder="Contoh: 202401015" 
                            class="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-maroon-500">
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Email Resmi Kampus <span class="text-rose-500">*</span></label>
                        <input id="user-add-email" type="email" maxlength="100" required placeholder="rian@student.cwe.ac.id" 
                            class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                    </div>
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Program Studi</label>
                    <input id="user-add-prodi" type="text" maxlength="100" value="Teknologi Rekayasa Perangkat Lunak" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-700">
                </div>

                <div id="user-add-angkatan-wrapper">
                    <label class="block font-semibold text-slate-700 mb-1">Angkatan <span class="text-rose-500">*</span></label>
                    <select id="user-add-angkatan" required class="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium focus:ring-2 focus:ring-maroon-500">
                        <option value="">-- Pilih Angkatan --</option>
                        ${(appData.angkatanList || []).map(a => `<option value="${a.id}">${a.nama_angkatan}</option>`).join("")}
                    </select>
                    <p class="text-[10px] text-slate-400 mt-1">Wajib untuk mahasiswa. Kelola daftar angkatan di menu Manajemen Kelas.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Kata Sandi Awal <span class="text-rose-500">*</span> (Min. 6 Karakter)</label>
                        <input id="user-add-pass" type="password" minlength="6" maxlength="72" required placeholder="••••••••" 
                            class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Konfirmasi Sandi <span class="text-rose-500">*</span></label>
                        <input id="user-add-pass-confirm" type="password" minlength="6" maxlength="72" required placeholder="••••••••" 
                            class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                    </div>
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600">Batal</button>
                    <button type="submit" class="px-5 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl font-semibold shadow-sm transition">
                        <i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Pengguna
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;
}

async function handleSaveAddUser() {
    const nama = document.getElementById("user-add-nama").value.trim();
    const idNum = document.getElementById("user-add-id").value.trim();
    const email = document.getElementById("user-add-email").value.trim().toLowerCase();
    const role = document.getElementById("user-add-role").value;
    const prodi = document.getElementById("user-add-prodi").value.trim();
    const pass = document.getElementById("user-add-pass").value;
    const confirm = document.getElementById("user-add-pass-confirm").value;
    const angkatanEl = document.getElementById("user-add-angkatan");
    const angkatan_id = role === 'mahasiswa' && angkatanEl && angkatanEl.value ? parseInt(angkatanEl.value) : null;
    const angkatanObj = (appData.angkatanList || []).find(a => String(a.id) === String(angkatan_id));
    const angkatan = angkatanObj ? angkatanObj.nama_angkatan : null;

    // Validasi Frontend
    if (!Validator.isValidLength(nama, 2, 100)) {
        showToast("Nama lengkap harus antara 2 hingga 100 karakter!", "error");
        return;
    }
    if (!Validator.isValidLength(idNum, 3, 30)) {
        showToast("Nomor Induk (NIM/NIP) harus antara 3 hingga 30 karakter!", "error");
        return;
    }
    if (!Validator.isValidEmail(email)) {
        showToast("Format alamat email tidak valid (contoh: user@cwe.ac.id)!", "error");
        return;
    }
    if (role === 'mahasiswa' && !angkatan_id) {
        showToast("Angkatan wajib dipilih untuk mahasiswa!", "error");
        return;
    }
    if (pass.length < 6 || pass.length > 72) {
        showToast("Kata sandi minimal 6 karakter dan maksimal 72 karakter!", "error");
        return;
    }
    if (pass !== confirm) {
        showToast("Konfirmasi kata sandi tidak cocok dengan kata sandi awal!", "error");
        return;
    }

    const payload = { nama, nomor_induk: idNum, email, role, prodi, password: pass, angkatan, angkatan_id };

    // Request ke API MySQL Backend
    try {
        const res = await fetch("api.php?action=create_user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.success) {
            showToast(data.message || "Gagal menambahkan pengguna.", "error");
            return;
        }

        const newUser = data.user || { id: Date.now(), ...payload, status: "Aktif", foto: "default.png" };

        appData.users.unshift(newUser);
        closeModal();
        renderApp();
        showToast(`Pengguna "${nama}" berhasil didaftarkan ke sistem!`, "success");
    } catch (err) {
        // Fallback offline
        const newUser = { id: Date.now(), ...payload, status: "Aktif", foto: "default.png" };
        appData.users.unshift(newUser);
        closeModal();
        renderApp();
        showToast(`Pengguna "${nama}" berhasil disimpan ke state.`, "success");
    }
}

// -------------------------------------------------------------
// MODAL EDIT PENGGUNA (UPDATE USER - PRE-FILLED)
// -------------------------------------------------------------
function openModalEditUser(userId) {
    const user = appData.users.find(u => u.id === userId);
    if (!user) {
        showToast("Data pengguna tidak ditemukan!", "error");
        return;
    }

    const currentAngkatanId = user.angkatan_id || ((appData.angkatanList || []).find(a => a.nama_angkatan === user.angkatan) || {}).id || "";

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
                        <h3 class="font-bold text-slate-800 text-sm">Perbarui Data Pengguna</h3>
                        <p class="text-[11px] text-slate-400">Edit identitas, peran, atau reset kata sandi</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form onsubmit="event.preventDefault(); handleSaveEditUser(${user.id});" class="space-y-3.5 text-xs">
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Peran Akun (Role) <span class="text-rose-500">*</span></label>
                    <select id="user-edit-role" onchange="toggleAngkatanField('edit', this.value)" class="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium focus:ring-2 focus:ring-maroon-500">
                        <option value="mahasiswa" ${user.role === 'mahasiswa' ? 'selected' : ''}>Mahasiswa</option>
                        <option value="dosen" ${user.role === 'dosen' ? 'selected' : ''}>Dosen Pengampu</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrator</option>
                    </select>
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar <span class="text-rose-500">*</span></label>
                    <input id="user-edit-nama" type="text" maxlength="100" required value="${user.nama}" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">NIM / NIP <span class="text-rose-500">*</span></label>
                        <input id="user-edit-id" type="text" maxlength="30" required value="${user.nomor_induk}" 
                            class="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-maroon-500">
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Email Resmi <span class="text-rose-500">*</span></label>
                        <input id="user-edit-email" type="email" maxlength="100" required value="${user.email}" 
                            class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                    </div>
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Program Studi</label>
                    <input id="user-edit-prodi" type="text" maxlength="100" value="${user.prodi || ''}" placeholder="Belum diatur" 
                        class="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-700">
                </div>

                <div id="user-edit-angkatan-wrapper" class="${user.role === 'mahasiswa' ? '' : 'hidden'}">
                    <label class="block font-semibold text-slate-700 mb-1">Angkatan <span class="text-rose-500">*</span></label>
                    <select id="user-edit-angkatan" ${user.role === 'mahasiswa' ? 'required' : ''} class="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium focus:ring-2 focus:ring-maroon-500">
                        <option value="">-- Pilih Angkatan --</option>
                        ${(appData.angkatanList || []).map(a => `
                            <option value="${a.id}" ${String(currentAngkatanId) === String(a.id) ? 'selected' : ''}>${a.nama_angkatan}</option>
                        `).join("")}
                    </select>
                    <p class="text-[10px] text-slate-400 mt-1">Wajib untuk mahasiswa. Kelola daftar angkatan di menu Manajemen Kelas.</p>
                </div>

                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <label class="block font-semibold text-slate-700">Ganti Kata Sandi (Opsional)</label>
                    <input id="user-edit-pass" type="password" minlength="6" maxlength="72" placeholder="Kosongkan jika tidak ingin mengubah sandi..." 
                        class="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-maroon-500">
                    <p class="text-[10px] text-slate-400">Minimal 6 karakter jika ingin mereset kata sandi akun ini.</p>
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600">Batal</button>
                    <button type="submit" class="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold shadow-sm transition">
                        <i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Pembaruan
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;
}

async function handleSaveEditUser(userId) {
    const user = appData.users.find(u => u.id === userId);
    if (!user) return;

    const nama = document.getElementById("user-edit-nama").value.trim();
    const idNum = document.getElementById("user-edit-id").value.trim();
    const email = document.getElementById("user-edit-email").value.trim().toLowerCase();
    const role = document.getElementById("user-edit-role").value;
    const prodi = document.getElementById("user-edit-prodi").value.trim();
    const pass = document.getElementById("user-edit-pass").value;
    const angkatanEl = document.getElementById("user-edit-angkatan");
    const angkatan_id = role === 'mahasiswa' && angkatanEl && angkatanEl.value ? parseInt(angkatanEl.value) : null;
    const angkatanObj = (appData.angkatanList || []).find(a => String(a.id) === String(angkatan_id));
    const angkatan = angkatanObj ? angkatanObj.nama_angkatan : null;

    if (!Validator.isValidLength(nama, 2, 100)) {
        showToast("Nama lengkap harus antara 2 hingga 100 karakter!", "error");
        return;
    }
    if (!Validator.isValidLength(idNum, 3, 30)) {
        showToast("Nomor Induk (NIM/NIP) harus antara 3 hingga 30 karakter!", "error");
        return;
    }
    if (!Validator.isValidEmail(email)) {
        showToast("Format alamat email tidak valid!", "error");
        return;
    }
    if (role === 'mahasiswa' && !angkatan_id) {
        showToast("Angkatan wajib dipilih untuk mahasiswa!", "error");
        return;
    }
    if (pass && (pass.length < 6 || pass.length > 72)) {
        showToast("Kata sandi baru minimal 6 karakter dan maksimal 72 karakter!", "error");
        return;
    }

    const payload = { id: userId, nama, nomor_induk: idNum, email, role, prodi, password: pass, angkatan, angkatan_id };

    try {
        const res = await fetch("api.php?action=update_user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!data.success) {
            showToast(data.message || "Gagal memperbarui data pengguna.", "error");
            return;
        }

        user.nama = nama;
        user.nomor_induk = idNum;
        user.email = email;
        user.role = role;
        user.prodi = prodi;
        user.angkatan = angkatan;
        user.angkatan_id = angkatan_id;

        closeModal();
        renderApp();
        showToast(`Data pengguna "${nama}" berhasil diperbarui!`, "success");
    } catch (err) {
        user.nama = nama;
        user.nomor_induk = idNum;
        user.email = email;
        user.role = role;
        user.prodi = prodi;
        user.angkatan = angkatan;
        user.angkatan_id = angkatan_id;
        closeModal();
        renderApp();
        showToast(`Data pengguna "${nama}" berhasil diperbarui di memori.`, "success");
    }
}

// -------------------------------------------------------------
// MODAL HAPUS PENGGUNA (DELETE USER - DENGAN KONFIRMASI)
// -------------------------------------------------------------
function openModalDeleteUser(userId) {
    const user = appData.users.find(u => u.id === userId);
    if (!user) return;

    // CEGAH ADMIN MENGHAPUS AKUN DIRINYA SENDIRI
    if (userId === appData.currentUser.id) {
        showToast("Keamanan: Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan!", "error");
        return;
    }

    openConfirmModal({
        title: "Konfirmasi Hapus Pengguna",
        message: `Apakah Anda yakin ingin menghapus akun <strong>"${user.nama}"</strong> (${user.nomor_induk})?<br><br>Seluruh data riwayat akademik pengguna ini akan dihapus dari sistem secara permanen.`,
        confirmText: "Ya, Hapus Pengguna",
        confirmColor: "bg-rose-600 hover:bg-rose-700",
        onConfirm: async () => {
            try {
                const res = await fetch("api.php?action=delete_user", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: userId })
                });
                const data = await res.json();
                if (!data.success) {
                    showToast(data.message || "Gagal menghapus pengguna.", "error");
                    return;
                }
            } catch (err) { }

            appData.users = appData.users.filter(u => u.id !== userId);
            renderApp();
            showToast(`Pengguna "${user.nama}" telah berhasil dihapus.`, "success");
        }
    });
}
