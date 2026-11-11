/**
 * js/schedule.js - Modul Penjadwalan Matakuliah Terintegrasi
 * Admin: mengatur jadwal (hari, jam mulai/selesai, ruangan) lewat grid mingguan.
 * Dosen & Mahasiswa: tampilan read-only sesuai scope masing-masing.
 *
 * Sumber data: appData.kelasList (satu-satunya sumber kebenaran jadwal).
 * Helper format & validasi bentrok berada di js/core.js agar seragam seluruh sistem.
 */

// Rentang slot waktu grid mingguan (07:00 - 18:00, slot 30 menit)
const SLOT_MULAI = 7 * 60;
const SLOT_SELESAI = 18 * 60;
const SLOT_MENIT = 30;
const JUMLAH_SLOT = Math.floor((SLOT_SELESAI - SLOT_MULAI) / SLOT_MENIT);

// Konversi jam kelas menjadi posisi baris grid (header menempati baris 1)
function gridRowFor(jam) {
    const start = Math.max(toMinutes(jam.mulai), SLOT_MULAI);
    const end = Math.min(Math.max(toMinutes(jam.selesai), start + SLOT_MENIT), SLOT_SELESAI);
    const rowStart = Math.floor((start - SLOT_MULAI) / SLOT_MENIT) + 2;
    const span = Math.max(1, Math.round((end - start) / SLOT_MENIT));
    return { rowStart, span };
}

function slotLabel(slotIndex) {
    const total = SLOT_MULAI + slotIndex * SLOT_MENIT;
    const h = String(Math.floor(total / 60)).padStart(2, '0');
    const m = String(total % 60).padStart(2, '0');
    return `${h}:${m}`;
}

// Kelas dalam scope role + filter aktif
function getScheduleFiltered() {
    const role = (appData.currentUser || {}).role;
    let data = getJadwalScopeKelas();

    if (scheduleFilter.semesterId !== 'all') {
        data = data.filter(k => String(k.semester_id || '') === String(scheduleFilter.semesterId));
    }
    if (role === 'admin') {
        if (scheduleFilter.angkatan !== 'all') {
            data = data.filter(k => String(k.angkatan_id || '') === String(scheduleFilter.angkatan));
        }
        if (scheduleFilter.dosen !== 'all') {
            data = data.filter(k => String(k.dosen_id || '') === String(scheduleFilter.dosen));
        }
        if (scheduleFilter.ruangan !== 'all') {
            data = data.filter(k => String(k.ruangan || '').trim().toLowerCase() === String(scheduleFilter.ruangan).toLowerCase());
        }
    }
    return data;
}

function getUniqueRuanganFromKelas() {
    const set = new Set();
    (appData.kelasList || []).forEach(k => {
        const r = String(k.ruangan || '').trim();
        if (r) set.add(r);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
}

// =============================================================
// RENDER UTAMA MODUL JADWAL
// =============================================================
function renderScheduleModule() {
    const user = appData.currentUser || {};
    const role = user.role;
    const isAdmin = role === 'admin';
    const hariIni = getHariIni();

    const scoped = getJadwalScopeKelas();
    const filtered = getScheduleFiltered();

    const terjadwal = scoped.filter(k => k.hari && parseJamKelas(k));
    const belumTerjadwal = scoped.filter(k => !k.hari || !parseJamKelas(k));
    const konflik = detectScheduleConflicts(filtered);
    const konflikIds = new Set();
    konflik.forEach(c => { konflikIds.add(Number(c.a.id)); konflikIds.add(Number(c.b.id)); });

    const judul = isAdmin ? 'Jadwal Kuliah Terintegrasi'
        : role === 'dosen' ? 'Jadwal Mengajar Saya'
            : 'Jadwal Kuliah Saya';
    const subJudul = isAdmin
        ? 'Atur hari, jam, dan ruangan seluruh kelas perkuliahan. Perubahan langsung tampil untuk dosen dan mahasiswa.'
        : role === 'dosen'
            ? 'Jadwal mengajar Anda pada semester berjalan.'
            : 'Jadwal perkuliahan Anda pada semester berjalan.';

    return `
    <div class="space-y-6">
        <!-- Header Halaman -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <i class="fa-solid fa-table-cells text-maroon-600"></i> ${judul}
                </h1>
                <p class="text-xs text-slate-500 mt-0.5">${subJudul}</p>
            </div>
            ${isAdmin ? `
            <button onclick="openModalAturJadwal(null)" class="px-4 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition shrink-0">
                <i class="fa-solid fa-calendar-plus"></i> Atur Jadwal Kelas
            </button>` : ''}
        </div>

        ${!isAdmin ? `
        <!-- Banner Read-Only (Dosen & Mahasiswa) -->
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-maroon-100 text-maroon-700 flex items-center justify-center text-lg">
                    <i class="fa-solid fa-calendar-days"></i>
                </div>
                <div>
                    <h4 class="text-xs font-bold text-slate-800">Jadwal Perkuliahan</h4>
                    <p class="text-[11px] text-slate-500">Jadwal ditetapkan oleh Administrator. Perubahan jadwal oleh dosen atau mahasiswa tidak diperkenankan.</p>
                </div>
            </div>
            <span class="text-[11px] font-medium text-slate-400 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                <i class="fa-solid fa-lock text-[10px] mr-1 text-slate-400"></i> Dikelola oleh Administrator
            </span>
        </div>` : ''}

        ${isAdmin ? `
        <!-- Ringkasan Status Penjadwalan -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <i class="fa-solid fa-calendar-check"></i>
                </div>
                <div>
                    <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Terjadwal</span>
                    <span class="text-lg font-bold text-slate-800">${terjadwal.length} <span class="text-xs font-normal text-slate-400">dari ${scoped.length} kelas</span></span>
                </div>
            </div>
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <i class="fa-solid fa-calendar-exclamation"></i>
                </div>
                <div>
                    <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Belum Terjadwal</span>
                    <span class="text-lg font-bold text-slate-800">${belumTerjadwal.length} kelas</span>
                </div>
            </div>
            <div class="bg-white p-4 rounded-2xl border ${konflik.length ? 'border-rose-200' : 'border-slate-200'} shadow-sm flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl ${konflik.length ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'} flex items-center justify-center">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div>
                    <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block">Bentrok Terdeteksi</span>
                    <span class="text-lg font-bold ${konflik.length ? 'text-rose-700' : 'text-slate-800'}">${konflik.length}</span>
                </div>
            </div>
        </div>` : ''}

        <!-- Filter -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-end gap-3">
            <div class="flex-1 min-w-[160px]">
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Semester</label>
                <select onchange="scheduleFilter.semesterId = this.value; renderApp();"
                    class="w-full py-2 px-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-maroon-500 focus:outline-none bg-white">
                    <option value="all">Semua Semester</option>
                    ${(appData.semesters || []).map(s => `
                        <option value="${s.id}" ${String(s.id) === String(scheduleFilter.semesterId) ? 'selected' : ''}>${s.nama}${Number(s.is_aktif) === 1 ? ' (Aktif)' : ''}</option>
                    `).join("")}
                </select>
            </div>
            ${isAdmin ? `
            <div class="flex-1 min-w-[160px]">
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Angkatan</label>
                <select onchange="scheduleFilter.angkatan = this.value; renderApp();"
                    class="w-full py-2 px-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-maroon-500 focus:outline-none bg-white">
                    <option value="all">Semua Angkatan</option>
                    ${(appData.angkatanList || []).map(a => `
                        <option value="${a.id}" ${String(a.id) === String(scheduleFilter.angkatan) ? 'selected' : ''}>${a.nama_angkatan}</option>
                    `).join("")}
                </select>
            </div>
            <div class="flex-1 min-w-[160px]">
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Dosen</label>
                <select onchange="scheduleFilter.dosen = this.value; renderApp();"
                    class="w-full py-2 px-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-maroon-500 focus:outline-none bg-white">
                    <option value="all">Semua Dosen</option>
                    ${(appData.dosenList || []).map(d => `
                        <option value="${d.id}" ${String(d.id) === String(scheduleFilter.dosen) ? 'selected' : ''}>${d.nama}</option>
                    `).join("")}
                </select>
            </div>
            <div class="flex-1 min-w-[160px]">
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Ruangan</label>
                <select onchange="scheduleFilter.ruangan = this.value; renderApp();"
                    class="w-full py-2 px-3 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-maroon-500 focus:outline-none bg-white">
                    <option value="all">Semua Ruangan</option>
                    ${getUniqueRuanganFromKelas().map(r => `
                        <option value="${r}" ${r.toLowerCase() === String(scheduleFilter.ruangan).toLowerCase() ? 'selected' : ''}>${r}</option>
                    `).join("")}
                </select>
            </div>
            <button onclick="scheduleFilter.semesterId='all'; scheduleFilter.angkatan='all'; scheduleFilter.dosen='all'; scheduleFilter.ruangan='all'; renderApp();"
                class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs transition">
                <i class="fa-solid fa-rotate mr-1"></i> Reset
            </button>` : ''}
        </div>

        ${konflik.length ? `
        <!-- Peringatan Bentrok -->
        <div class="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
            <h4 class="text-xs font-bold text-rose-700 flex items-center gap-2">
                <i class="fa-solid fa-triangle-exclamation"></i> ${konflik.length} Bentrok Jadwal Terdeteksi
            </h4>
            <ul class="text-[11px] text-rose-600 space-y-1 list-disc list-inside">
                ${konflik.map(c => `
                    <li><strong>${c.tipe}</strong>: ${c.a.nama_mk} (${c.a.nama_kelas || '-'}, ${formatJadwal(c.a)}) &harr; ${c.b.nama_mk} (${c.b.nama_kelas || '-'}, ${formatJadwal(c.b)})</li>
                `).join("")}
            </ul>
        </div>` : ''}

        <!-- Grid Jadwal Mingguan (Desktop) -->
        <div class="hidden md:block">
            ${renderScheduleGridDesktop(filtered, konflikIds, isAdmin, hariIni)}
        </div>

        <!-- Daftar Jadwal Per Hari (Mobile) -->
        <div class="md:hidden space-y-4">
            ${renderScheduleListMobile(filtered, konflikIds, isAdmin, hariIni, role)}
        </div>

        ${isAdmin && belumTerjadwal.length ? `
        <!-- Panel Kelas Belum Terjadwal (Admin) -->
        <div class="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <div class="p-4 border-b border-amber-100 flex items-center gap-2.5 bg-amber-50/60">
                <div class="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <i class="fa-solid fa-calendar-exclamation"></i>
                </div>
                <div>
                    <h3 class="text-sm font-bold text-slate-800">Kelas Belum Terjadwal (${belumTerjadwal.length})</h3>
                    <p class="text-[11px] text-slate-400">Kelas berikut belum memiliki hari & jam perkuliahan. Atur agar tampil pada grid.</p>
                </div>
            </div>
            <div class="divide-y divide-slate-100">
                ${belumTerjadwal.map(k => `
                    <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="min-w-0">
                            <span class="text-xs font-bold text-slate-800 block">
                                ${k.nama_mk || 'Mata Kuliah'} <span class="font-mono text-slate-400 font-normal">(${k.kode_mk || '-'})</span>
                            </span>
                            <span class="text-[11px] text-slate-500 block mt-0.5">
                                ${k.nama_kelas || '-'} &bull; ${k.dosen_nama || 'Dosen belum ditentukan'} &bull; ${k.angkatan_nama || 'Tanpa angkatan'} &bull; ${k.semester_nama || 'Semester belum diatur'}
                            </span>
                        </div>
                        <button onclick="openModalAturJadwal(${k.id})"
                            class="px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition shrink-0">
                            <i class="fa-solid fa-calendar-plus"></i> Atur Jadwal
                        </button>
                    </div>
                `).join("")}
            </div>
        </div>` : ''}
    </div>
    `;
}

// =============================================================
// HELPER PENATAAN BATANG JADWAL PARALEL & FLOATING TOOLTIP
// =============================================================

// Menghitung layout sub-kolom horizontal berdampingan untuk jadwal yang tumpang tindih dalam 1 hari
function computeDayScheduleLayout(kelasHariList) {
    const items = kelasHariList.map(k => {
        const jam = parseJamKelas(k);
        const start = jam ? toMinutes(jam.mulai) : 0;
        const end = jam ? toMinutes(jam.selesai) : 0;
        return { kelas: k, start, end, jam };
    }).filter(it => it.jam && it.end > it.start);

    // Urutkan berdasarkan waktu mulai ASC, lalu durasi DESC
    items.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    // Kluster overlap
    const clusters = [];
    let currentCluster = [];
    let clusterEnd = -1;

    for (const item of items) {
        if (currentCluster.length === 0) {
            currentCluster.push(item);
            clusterEnd = item.end;
        } else if (item.start < clusterEnd) {
            currentCluster.push(item);
            clusterEnd = Math.max(clusterEnd, item.end);
        } else {
            clusters.push(currentCluster);
            currentCluster = [item];
            clusterEnd = item.end;
        }
    }
    if (currentCluster.length > 0) {
        clusters.push(currentCluster);
    }

    // Penugasan track horizontal di setiap kluster (Greedy Interval Coloring)
    const result = [];
    for (const cluster of clusters) {
        const trackEnds = [];
        const clusterItems = [];

        for (const item of cluster) {
            let assignedTrack = -1;
            for (let t = 0; t < trackEnds.length; t++) {
                if (item.start >= trackEnds[t]) {
                    assignedTrack = t;
                    trackEnds[t] = item.end;
                    break;
                }
            }
            if (assignedTrack === -1) {
                assignedTrack = trackEnds.length;
                trackEnds.push(item.end);
            }
            clusterItems.push({ item, track: assignedTrack });
        }

        const totalTracks = Math.max(1, trackEnds.length);
        for (const ci of clusterItems) {
            result.push({
                kelas: ci.item.kelas,
                jam: ci.item.jam,
                track: ci.track,
                totalTracks: totalTracks
            });
        }
    }

    return result;
}

// Palet warna batang jadwal (elegan, kontras per angkatan/rombel)
function getScheduleBarColor(k, bentrok) {
    if (bentrok) {
        return {
            bg: "bg-rose-500 border-rose-600 hover:bg-rose-600 shadow-rose-500/25",
            accent: "bg-rose-200"
        };
    }
    const palette = [
        { bg: "bg-maroon-600 border-maroon-700 hover:bg-maroon-700 shadow-maroon-600/25", accent: "bg-amber-300" },
        { bg: "bg-indigo-600 border-indigo-700 hover:bg-indigo-700 shadow-indigo-600/25", accent: "bg-indigo-200" },
        { bg: "bg-emerald-600 border-emerald-700 hover:bg-emerald-700 shadow-emerald-600/25", accent: "bg-emerald-200" },
        { bg: "bg-sky-600 border-sky-700 hover:bg-sky-700 shadow-sky-600/25", accent: "bg-sky-200" },
        { bg: "bg-amber-600 border-amber-700 hover:bg-amber-700 shadow-amber-600/25", accent: "bg-amber-200" },
        { bg: "bg-purple-600 border-purple-700 hover:bg-purple-700 shadow-purple-600/25", accent: "bg-purple-200" }
    ];
    const seed = Number(k.angkatan_id || k.id || 0);
    return palette[seed % palette.length];
}

// Inisialisasi container floating tooltip
function getOrCreateScheduleTooltipElement() {
    let el = document.getElementById("schedule-floating-tooltip");
    if (!el) {
        el = document.createElement("div");
        el.id = "schedule-floating-tooltip";
        el.className = "fixed z-[9999] pointer-events-none hidden transition-all duration-150 ease-out";
        document.body.appendChild(el);
    }
    return el;
}

// Menampilkan Rich Tooltip saat kursor mouse diarahkan ke batang jadwal
function showScheduleTooltip(evt, kelasId) {
    const k = (appData.kelasList || []).find(item => Number(item.id) === Number(kelasId));
    if (!k) return;

    const jam = parseJamKelas(k);
    if (!jam) return;

    const konflik = detectScheduleConflicts(appData.kelasList || []);
    const bentrok = konflik.some(c => Number(c.a.id) === Number(k.id) || Number(c.b.id) === Number(k.id));
    const dosenNama = k.dosen_nama || 'Belum Ditentukan';
    const role = (appData.currentUser || {}).role;
    const isAdmin = role === 'admin';

    const tooltip = getOrCreateScheduleTooltipElement();
    tooltip.innerHTML = `
        <div class="space-y-2 p-3 bg-slate-900/95 text-white rounded-2xl shadow-2xl backdrop-blur-md border border-slate-700/70 max-w-xs text-xs animate-fadeIn">
            <!-- Header Waktu & Status -->
            <div class="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <span class="font-mono font-bold text-amber-400 flex items-center gap-1.5">
                    <i class="fa-regular fa-clock"></i> ${jam.mulai} &ndash; ${jam.selesai} WIB
                </span>
                ${bentrok ? `
                    <span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1">
                        <i class="fa-solid fa-triangle-exclamation"></i> Bentrok
                    </span>
                ` : `
                    <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                        Terjadwal
                    </span>
                `}
            </div>

            <!-- Mata Kuliah -->
            <div>
                <h4 class="font-extrabold text-sm text-white leading-snug">${k.nama_mk || 'Mata Kuliah'}</h4>
                <div class="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-mono">
                    <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">${k.kode_mk || '-'}</span>
                    <span>${k.sks || 3} SKS</span>
                    <span>&bull; Semester ${k.semester_paket || 1}</span>
                </div>
            </div>

            <!-- Rombel Kelas & Angkatan -->
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                <div>
                    <span class="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Kelas / Rombel</span>
                    <span class="font-bold text-amber-200">${k.nama_kelas || '-'}</span>
                </div>
                <div>
                    <span class="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Angkatan</span>
                    <span class="font-medium text-slate-300">${k.angkatan_nama || k.angkatan_tahun || '-'}</span>
                </div>
            </div>

            <!-- Dosen & Ruangan -->
            <div class="space-y-1.5 pt-2 border-t border-slate-800 text-[11px]">
                <div class="flex items-center gap-2 text-slate-300">
                    <div class="w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] shrink-0 font-bold">
                        <i class="fa-solid fa-chalkboard-user"></i>
                    </div>
                    <span class="truncate font-medium">${dosenNama}</span>
                </div>
                <div class="flex items-center gap-2 text-slate-300">
                    <div class="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] shrink-0 font-bold">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>
                    <span class="font-mono text-slate-200">${k.ruangan || 'Ruangan belum diatur'}</span>
                </div>
            </div>

            ${isAdmin ? `
            <div class="pt-2 border-t border-slate-800 text-[10px] text-amber-300/90 italic flex items-center gap-1.5">
                <i class="fa-solid fa-hand-pointer text-amber-400"></i> Klik batang untuk mengatur / mengubah jadwal
            </div>` : ''}
        </div>
    `;

    tooltip.classList.remove("hidden");

    // Hitung posisi mengambang tooltip
    const target = evt.currentTarget;
    const rect = target.getBoundingClientRect();
    const tWidth = tooltip.offsetWidth || 280;
    const tHeight = tooltip.offsetHeight || 200;

    let top = rect.top - tHeight - 10;
    if (top < 10) {
        top = rect.bottom + 10;
    }

    let left = rect.left + (rect.width / 2) - (tWidth / 2);
    if (left < 10) left = 10;
    if (left + tWidth > window.innerWidth - 10) {
        left = window.innerWidth - tWidth - 10;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

// Menyembunyikan Rich Tooltip
function hideScheduleTooltip() {
    const tooltip = document.getElementById("schedule-floating-tooltip");
    if (tooltip) {
        tooltip.classList.add("hidden");
    }
}

// Sembunyikan tooltip otomatis saat window di-scroll
if (typeof window !== 'undefined') {
    window.addEventListener('scroll', hideScheduleTooltip, { passive: true });
}

// =============================================================
// GRID MINGGUAN (DESKTOP) - Kolom hari x baris slot waktu
// =============================================================
function renderScheduleGridDesktop(kelasData, konflikIds, isAdmin, hariIni) {
    const terjadwal = kelasData.filter(k => k.hari && parseJamKelas(k));

    // Header grid
    let cells = `
        <div class="bg-slate-50 border-b border-slate-200 flex items-center justify-center" style="grid-column: 1; grid-row: 1;">
            <span class="text-[10px] font-bold text-slate-400 uppercase">Jam</span>
        </div>
        ${HARI_LIST.map((h, i) => `
            <div class="bg-slate-50 border-b border-slate-200 ${h === hariIni ? 'bg-maroon-50 border-b-maroon-300' : ''} flex items-center justify-center px-2" style="grid-column: ${i + 2}; grid-row: 1;">
                <span class="text-[11px] font-bold ${h === hariIni ? 'text-maroon-700' : 'text-slate-600'} uppercase tracking-wide">
                    ${h}${h === hariIni ? ' &bull; Hari Ini' : ''}
                </span>
            </div>
        `).join("")}`;

    // Sel latar (label jam + area hari)
    for (let r = 0; r < JUMLAH_SLOT; r++) {
        const isJamPenuh = r % 2 === 0;
        cells += `
            <div class="border-b border-slate-100 flex items-start justify-end pr-1.5 ${isJamPenuh ? '' : 'text-transparent'}" style="grid-column: 1; grid-row: ${r + 2};">
                <span class="text-[9px] font-mono text-slate-400 leading-none pt-0.5">${isJamPenuh ? slotLabel(r) : '·'}</span>
            </div>`;
        for (let c = 0; c < HARI_LIST.length; c++) {
            const hariIniCol = HARI_LIST[c] === hariIni;
            cells += `
                <div class="border-b border-slate-100 ${hariIniCol ? 'bg-maroon-50/30' : 'bg-white'}" style="grid-column: ${c + 2}; grid-row: ${r + 2};"></div>`;
        }
    }

    // Render batang jadwal per hari (menggunakan pembagian sub-kolom paralel jika ada jam sama)
    let cards = '';
    for (let c = 0; c < HARI_LIST.length; c++) {
        const hariName = HARI_LIST[c];
        const kelasHariIni = terjadwal.filter(k => String(k.hari) === hariName);
        const dayLayout = computeDayScheduleLayout(kelasHariIni);

        for (const layout of dayLayout) {
            const k = layout.kelas;
            const jam = layout.jam;
            const { rowStart, span } = gridRowFor(jam);
            const bentrok = konflikIds.has(Number(k.id));
            const color = getScheduleBarColor(k, bentrok);

            // Hitung lebar dan posisi offset horizontal di dalam kolom hari
            const widthPercent = ((100 / layout.totalTracks) - 1.5).toFixed(1);
            const leftPercent = (layout.track * (100 / layout.totalTracks)).toFixed(1);

            cards += `
            <div ${isAdmin ? `onclick="openModalAturJadwal(${k.id})"` : ''}
                onmouseenter="showScheduleTooltip(event, ${k.id})"
                onmouseleave="hideScheduleTooltip()"
                class="z-10 m-0.5 rounded-lg border transition-all duration-150 cursor-pointer shadow-xs hover:shadow-md hover:scale-[1.03] hover:z-20 flex flex-col items-center justify-between py-1 px-0.5 ${color.bg}"
                style="grid-column: ${c + 2}; grid-row: ${rowStart} / span ${span}; width: ${widthPercent}%; margin-left: ${leftPercent}%;">
                <span class="w-1.5 h-1.5 rounded-full ${color.accent} shrink-0 opacity-80"></span>
                <span class="w-1 h-3 rounded-full bg-white/25 shrink-0"></span>
                <span class="text-[10px] font-medium text-white opacity-90 block">${k.nama_mk || k.nama_kelas || ''}</span>
            </div>`;
        }
    }

    return `
    <div class="overflow-x-auto pb-2">
        <div class="min-w-[900px] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div class="grid relative"
                style="grid-template-columns: 64px repeat(${HARI_LIST.length}, minmax(120px, 1fr)); grid-template-rows: 40px repeat(${JUMLAH_SLOT}, 34px);">
                ${cells}
                ${cards}
            </div>
        </div>
        <div class="mt-2.5 flex items-center justify-between flex-wrap gap-2 text-[10px] text-slate-400">
            <div class="flex items-center gap-3 flex-wrap">
                <span class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-sm bg-maroon-600 inline-block"></span> Batang Berwarna: Kelas Terjadwal
                </span>
                <span class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block"></span> Batang Merah: Terindikasi Bentrok
                </span>
                <span class="flex items-center gap-1.5">
                    <i class="fa-solid fa-arrows-left-right text-slate-400"></i> Batang Berdampingan: Jadwal Paralel / Jam Sama
                </span>
            </div>
            <span>
                <i class="fa-solid fa-circle-info mr-1"></i> Arahkan kursor ke batang untuk melihat detail perkuliahan.
            </span>
        </div>
    </div>`;
}

// =============================================================
// DAFTAR JADWAL PER HARI (MOBILE)
// =============================================================
function renderScheduleListMobile(kelasData, konflikIds, isAdmin, hariIni, role) {
    return HARI_LIST.map(h => {
        const sesi = kelasData
            .filter(k => String(k.hari) === h && parseJamKelas(k))
            .sort((a, b) => toMinutes(parseJamKelas(a).mulai) - toMinutes(parseJamKelas(b).mulai));

        const isHariIni = h === hariIni;
        return `
        <div class="bg-white rounded-2xl border ${isHariIni ? 'border-maroon-300' : 'border-slate-200'} shadow-sm overflow-hidden">
            <div class="p-3.5 flex items-center justify-between ${isHariIni ? 'bg-maroon-50' : 'bg-slate-50'}">
                <span class="text-xs font-bold ${isHariIni ? 'text-maroon-700' : 'text-slate-700'} uppercase tracking-wide">${h}</span>
                ${isHariIni ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-maroon-600 text-white">Hari Ini</span>' : `<span class="text-[10px] text-slate-400">${sesi.length} sesi</span>`}
            </div>
            ${sesi.length === 0 ? `
                <p class="text-[11px] text-slate-400 italic p-4 text-center">Tidak ada perkuliahan terjadwal.</p>
            ` : `
                <div class="divide-y divide-slate-100">
                    ${sesi.map(k => {
            const jam = parseJamKelas(k);
            const bentrok = konflikIds.has(Number(k.id));
            return `
                        <div class="p-3.5 flex items-center justify-between gap-3 ${bentrok ? 'bg-rose-50/60' : ''}">
                            <div class="min-w-0">
                                <span class="font-mono text-[11px] font-bold ${bentrok ? 'text-rose-700' : 'text-maroon-700'}">${jam.mulai}&ndash;${jam.selesai}</span>
                                <span class="block text-xs font-bold text-slate-800 truncate mt-0.5">
                                    ${k.nama_mk || 'Mata Kuliah'} <span class="font-mono font-normal text-slate-400">(${k.kode_mk || '-'})</span>
                                </span>
                                <span class="block text-[11px] text-slate-500 truncate">
                                    ${k.nama_kelas || '-'} &bull; ${k.ruangan || 'Ruangan belum diatur'}
                                    ${bentrok ? ' &bull; <span class="text-rose-600 font-bold">Bentrok!</span>' : ''}
                                </span>
                                <span class="block text-[11px] text-slate-500 truncate">
                                    <i class="fa-solid fa-user-tie text-[9px] mr-1 text-slate-400"></i>${k.dosen_nama || 'Dosen belum ditentukan'}
                                </span>
                            </div>
                            ${isAdmin ? `
                            <button onclick="openModalAturJadwal(${k.id})" class="px-3 py-1.5 bg-maroon-50 hover:bg-maroon-100 border border-maroon-200 text-maroon-700 rounded-lg font-semibold text-[11px] shrink-0 transition">
                                <i class="fa-solid fa-pen"></i>
                            </button>` : ''}
                        </div>`;
        }).join("")}
                </div>`}
        </div>`;
    }).join("");
}

// =============================================================
// MODAL ATUR JADWAN (ADMIN ONLY)
// openModalAturJadwal(null) = pilih kelas yang belum terjadwal
// =============================================================
function openModalAturJadwal(kelasId) {
    const role = (appData.currentUser || {}).role;
    if (role !== 'admin') {
        showToast("Akses Ditolak: Jadwal hanya dapat diatur oleh Administrator!", "error");
        return;
    }

    const all = appData.kelasList || [];
    const belumTerjadwal = all.filter(k => !k.hari || !parseJamKelas(k));
    const kelas = kelasId ? all.find(k => Number(k.id) === Number(kelasId)) : (belumTerjadwal[0] || null);

    // Tidak ada kelas sama sekali
    if (!kelas && all.length === 0) {
        showToast("Belum ada kelas perkuliahan. Buka kelas terlebih dahulu di Manajemen Kelas.", "info");
        return;
    }

    // Mode "pilih kelas" hanya untuk yang belum terjadwal
    if (!kelasId && belumTerjadwal.length === 0) {
        showToast("Semua kelas sudah terjadwal. Klik kartu kelas pada grid untuk mengubah jadwalnya.", "info");
        return;
    }

    const modal = document.getElementById("modal-container");
    const jam = kelas ? (parseJamKelas(kelas) || { mulai: '', selesai: '' }) : { mulai: '', selesai: '' };
    const pilihanKelas = kelasId ? (kelas ? [kelas] : []) : belumTerjadwal;

    modal.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
        <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100">
            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-maroon-50 text-maroon-600 flex items-center justify-center">
                        <i class="fa-solid fa-calendar-plus"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-slate-800 text-sm">Atur Jadwal Perkuliahan</h3>
                        <p class="text-[11px] text-slate-400">Hari, jam, dan ruangan akan tampil untuk dosen & mahasiswa</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form onsubmit="event.preventDefault(); handleSaveJadwal(${kelas ? kelas.id : 'null'});" class="space-y-3.5 text-xs">
                ${pilihanKelas.length > 0 ? `
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Kelas Perkuliahan <span class="text-rose-500">*</span></label>
                    ${kelasId ? `
                        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                            <span class="font-bold text-slate-800 block">
                                ${kelas.nama_mk || 'Mata Kuliah'} <span class="font-mono font-normal text-slate-400">(${kelas.kode_mk || '-'})</span>
                            </span>
                            <span class="text-[11px] text-slate-500 block">
                                ${kelas.nama_kelas || '-'} &bull; ${kelas.dosen_nama || 'Dosen belum ditentukan'} &bull; ${kelas.angkatan_nama || 'Tanpa angkatan'} &bull; ${kelas.semester_nama || 'Semester belum diatur'}
                            </span>
                        </div>
                    ` : `
                        <select id="jadwal-kelas-id" required class="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium focus:ring-2 focus:ring-maroon-500">
                            ${pilihanKelas.map(k => `
                                <option value="${k.id}">${k.nama_mk} (${k.kode_mk || '-'}) — ${k.nama_kelas || '-'} — ${k.angkatan_nama || 'tanpa angkatan'}</option>
                            `).join("")}
                        </select>
                        <p class="text-[10px] text-slate-400 mt-1">Hanya kelas yang belum terjadwal ditampilkan. Untuk mengubah jadwal kelas lain, klik kartunya di grid jadwal.</p>
                    `}
                </div>` : `
                <div class="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-700 font-medium">
                    <i class="fa-solid fa-circle-check mr-1"></i> Semua kelas sudah terjadwal. Pilih kelas pada grid untuk mengubah.
                </div>`}

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Hari Kuliah <span class="text-rose-500">*</span></label>
                        <select id="jadwal-hari" required class="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-maroon-500">
                            ${HARI_LIST.map(h => `<option value="${h}" ${kelas && kelas.hari === h ? 'selected' : ''}>${h}</option>`).join("")}
                        </select>
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Ruangan <span class="text-rose-500">*</span></label>
                        <input id="jadwal-ruangan" type="text" maxlength="50" required value="${kelas ? (kelas.ruangan || '') : ''}" placeholder="Contoh: Lab Komputer 1"
                            class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Jam Mulai <span class="text-rose-500">*</span></label>
                        <input id="jadwal-mulai" type="time" required value="${jam.mulai}"
                            class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                    </div>
                    <div>
                        <label class="block font-semibold text-slate-700 mb-1">Jam Selesai <span class="text-rose-500">*</span></label>
                        <input id="jadwal-selesai" type="time" required value="${jam.selesai}"
                            class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-maroon-500">
                    </div>
                </div>

                <p class="text-[10px] text-slate-400 leading-relaxed">
                    <i class="fa-solid fa-shield-halved text-maroon-500 mr-1"></i>
                    Sistem memvalidasi bentrok dosen, ruangan, dan angkatan pada hari & jam yang sama sebelum menyimpan.
                </p>

                <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600">Batal</button>
                    <button type="submit" class="px-5 py-2 bg-maroon-600 hover:bg-maroon-700 text-white rounded-xl font-semibold shadow-sm transition">
                        <i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Jadwal
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;
}

async function handleSaveJadwal(kelasId) {
    if ((appData.currentUser || {}).role !== 'admin') {
        showToast("Akses Ditolak: Jadwal hanya dapat diatur oleh Administrator!", "error");
        return;
    }

    // Jika dipanggil dari mode "pilih kelas belum terjadwal", ambil nilai select
    const selectedEl = document.getElementById("jadwal-kelas-id");
    const targetId = kelasId || (selectedEl ? Number(selectedEl.value) : null);
    const kelas = (appData.kelasList || []).find(k => Number(k.id) === Number(targetId));
    if (!kelas) {
        showToast("Kelas tidak ditemukan. Silakan pilih ulang kelas.", "error");
        return;
    }

    const hari = document.getElementById("jadwal-hari").value;
    const jamMulai = document.getElementById("jadwal-mulai").value;
    const jamSelesai = document.getElementById("jadwal-selesai").value;
    const ruangan = document.getElementById("jadwal-ruangan").value.trim();

    if (!hari || !jamMulai || !jamSelesai) {
        showToast("Hari dan jam perkuliahan wajib diisi!", "error");
        return;
    }
    if (toMinutes(jamSelesai) <= toMinutes(jamMulai)) {
        showToast("Jam selesai harus setelah jam mulai!", "error");
        return;
    }
    if (!ruangan) {
        showToast("Ruangan perkuliahan wajib diisi!", "error");
        return;
    }

    // Validasi bentrok sisi klien (dosen / ruangan / angkatan)
    const simulasi = (appData.kelasList || []).map(x =>
        Number(x.id) === Number(kelas.id)
            ? { ...x, hari, jam_mulai: jamMulai, jam_selesai: jamSelesai, ruangan }
            : x);
    const bentrok = detectScheduleConflicts(simulasi)
        .filter(c => Number(c.a.id) === Number(kelas.id) || Number(c.b.id) === Number(kelas.id));

    if (bentrok.length) {
        const detail = bentrok.map(c => {
            const lain = Number(c.a.id) === Number(kelas.id) ? c.b : c.a;
            return `${c.tipe}: ${lain.nama_mk} (${lain.nama_kelas || '-'}, ${formatJadwal(lain)})`;
        }).join('; ');
        showToast(`Jadwal bentrok — ${detail}`, "error");
        return;
    }

    const payload = {
        id: kelas.id,
        hari,
        jam_mulai: jamMulai,
        jam_selesai: jamSelesai,
        ruangan,
        jam: `${jamMulai} - ${jamSelesai}`
    };

    const applyLocal = (kelasUpdate, pesan, tipe) => {
        if (kelasUpdate) {
            if (kelasUpdate.hari !== undefined) kelas.hari = kelasUpdate.hari;
            if (kelasUpdate.jam !== undefined) kelas.jam = kelasUpdate.jam;
            if (kelasUpdate.jam_mulai !== undefined) kelas.jam_mulai = kelasUpdate.jam_mulai;
            if (kelasUpdate.jam_selesai !== undefined) kelas.jam_selesai = kelasUpdate.jam_selesai;
            if (kelasUpdate.ruangan !== undefined) kelas.ruangan = kelasUpdate.ruangan;
            if (kelasUpdate.jadwal !== undefined) kelas.jadwal = kelasUpdate.jadwal;
        }
        closeModal();
        renderApp();
        showToast(pesan, tipe || "success");
    };

    try {
        const res = await fetch("api.php?action=update_jadwal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            const kelasUpdate = data.kelas ? {
                hari: data.kelas.hari ?? null,
                jam: data.kelas.jam ?? null,
                jam_mulai: data.kelas.jam_mulai ?? null,
                jam_selesai: data.kelas.jam_selesai ?? null,
                ruangan: data.kelas.ruangan ?? null,
                jadwal: data.kelas.jadwal ?? formatJadwal(kelas)
            } : null;
            applyLocal(kelasUpdate, data.message || `Jadwal kelas "${kelas.nama_kelas}" berhasil disimpan!`);
            await loadAppData();
        } else if (res.status === 409) {
            showToast(data.message || "Jadwal bentrok. Periksa jadwal kelas lain yang ditetapkan.", "error");
        } else {
            showToast(data.message || "Gagal menyimpan jadwal ke server.", "error");
        }
    } catch (e) {
        showToast("Gagal terhubung ke server. Jadwal tidak disimpan ke database.", "error");
    }
}
