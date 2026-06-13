# Spesifikasi Desain: UI/UX Overhaul & Sistem Antrean Presensi

Dokumen ini mendefinisikan desain teknis dan visual untuk pembaruan UI/UX portal **Presensi Katekumen Digital**.

---

## 1. Ringkasan Proyek (Overview)
Pembaruan ini bertujuan untuk merancang ulang antarmuka aplikasi menjadi modern, mobile-first, dan satu-halaman (single-page) tanpa scrolling yang mengganggu pada sebagian besar ponsel. Desain visual menggunakan tema terang (Light Mode) sebagai default bertema krem/marmer dengan aksen warna **Marian Blue** (biru liturgis klasik), dilengkapi dengan toggle tema gelap (Dark Mode). Secara fungsional, alur pengguna dikendalikan oleh *State Machine* terpandu dan proses pemindaian dimaksimalkan dengan sistem antrean sinkronisasi latar belakang yang tidak memblokir kamera.

---

## 2. Sistem Visual & Tipografi

### A. Tipografi
- **Branding & Judul Utama:** `Cinzel` (serif, elegan, cathedral-style).
- **UI Kontrol & Konten:** `Inter` atau `Outfit` (sans-serif, clean, modern).

### B. Variabel CSS Tema (CSS Variables)

```css
:root {
  /* Light Theme (Default) - Elegant Cathedral Marble */
  --bg-body: #F4F3EF;
  --bg-glass: rgba(255, 255, 255, 0.75);
  --border-glass: rgba(0, 0, 0, 0.08);
  --text-primary: #2B2D2F;
  --text-secondary: #6E7175;
  --accent: #1E3A8A;           /* Marian Blue */
  --accent-hover: #152960;
  --accent-glow: rgba(30, 58, 138, 0.15);
  --shadow: 0 12px 40px rgba(0, 0, 0, 0.06);

  /* Status Semantik (Sama untuk kedua tema, disesuaikan kontrasnya) */
  --status-success-bg: #e8f5e9;
  --status-success-border: #a5d6a7;
  --status-success-text: #2e7d32;

  --status-duplicate-bg: #ffebee;
  --status-duplicate-border: #ef9a9a;
  --status-duplicate-text: #c62828;

  --status-pending-bg: #fff8e1;
  --status-pending-border: #ffe082;
  --status-pending-text: #b78103;

  --status-idle-bg: rgba(0, 0, 0, 0.03);
  --status-idle-border: rgba(0, 0, 0, 0.08);
  --status-idle-text: #6c757d;
}

[data-theme="dark"] {
  /* Dark Theme - Obsidian Night */
  --bg-body: #121212;
  --bg-glass: rgba(30, 30, 30, 0.65);
  --border-glass: rgba(255, 255, 255, 0.08);
  --text-primary: #E0E0E0;
  --text-secondary: #9A9DA2;
  --accent: #3B82F6;           /* Bright Blue for Dark Mode */
  --accent-hover: #2563EB;
  --accent-glow: rgba(59, 130, 246, 0.2);
  --shadow: 0 12px 40px rgba(0, 0, 0, 0.5);

  --status-success-bg: #1b3e24;
  --status-success-border: #2e7d32;
  --status-success-text: #81c784;

  --status-duplicate-bg: #3d1c1c;
  --status-duplicate-border: #c62828;
  --status-duplicate-text: #ef5350;

  --status-pending-bg: #2d2315;
  --status-pending-border: #5d4615;
  --status-pending-text: #ffe082;

  --status-idle-bg: rgba(255, 255, 255, 0.03);
  --status-idle-border: rgba(255, 255, 255, 0.08);
  --status-idle-text: #9a9da2;
}
```

---

## 3. Desain Alur Terpandu (State Machine)

Aplikasi memiliki tiga status (state) visual utama yang dikendalikan melalui kelas CSS pada container utama:

1. **State 0: Auth (`state-auth`)**
   - Menampilkan input password login.
   - Semua elemen pemindai, topik, dan riwayat disembunyikan.
2. **State 1: Selection (`state-selection`)**
   - Muncul setelah login sukses atau jika tombol "Ubah Topik" ditekan.
   - Menampilkan tombol pemilih topik yang disorot secara dominan.
   - Modal daftar topik otomatis muncul jika belum ada topik terpilih di session/local storage.
3. **State 2: Scanning (`state-scanning`)**
   - Kamera pemindai diaktifkan.
   - Tombol pemilih topik menciut menjadi bar header kecil dengan informasi topik aktif dan tombol "Ubah".
   - Riwayat pindaian dan antrean sinkronisasi ditampilkan langsung di bawah pemindai.

---

## 4. Arsitektur Antrean (Queuing System)

### A. Alur Kerja
1. **Pindai & Simpan:** Ketika kamera membaca kode QR, id katekumen diparse. Item langsung dimasukkan ke array antrean di memori dan disimpan ke `localStorage`.
2. **Umpan Balik Instan:** Ponsel fasilitator bergetar singkat (100ms) untuk konfirmasi pembacaan QR. Kamera langsung siap melakukan pemindaian berikutnya.
3. **Pemrosesan Latar Belakang:** Fungsi sinkronisasi berjalan secara berurutan (sequential FIFO):
   - Ambil item pertama dengan status `pending`.
   - Ubah status menjadi `processing` (tampilkan roda putar/spinner di baris tersebut).
   - Kirim POST request ke `/api/absensi`.
   - Jika sukses (`status: 'ok'`), ubah status antrean menjadi `success` dan ambil info nama serta pasfoto katekumen untuk diupdate ke kartu riwayat. Play getaran sukses (200ms).
   - Jika sudah hadir (`status: 'duplicate'`), ubah status menjadi `duplicate`, dan tampilkan nama. Play getaran peringatan.
   - Jika koneksi terputus / offline, ubah status kembali ke `pending` dan hentikan pemrosesan antrean sementara (coba lagi dalam 5 detik).
4. **Pencegahan Double-Scan:** Menerapkan pembatasan (cooldown) selama 3 detik khusus untuk ID siswa yang sama agar tidak terkirim dua kali akibat pembacaan kamera yang terlalu cepat.

### B. Antarmuka Antrean di Layar (Compact History List)
- **Banner Peringatan:** Muncul ketika antrean tidak kosong: `"Sinkronisasi sedang berjalan... Mohon jangan tutup halaman ini (X item tersisa)"` dengan warna kuning-amber yang berdenyut (pulsing).
- **Daftar Riwayat:** Menampilkan maksimal 3-4 hasil pemindaian terbaru. Setiap baris berisi:
  - Lingkaran pasfoto siswa (menggunakan Supabase signed URL jika sukses, atau avatar placeholder jika sedang diproses/gagal).
  - Nama siswa / ID siswa.
  - Badge status semantik (Proses, Hadir, Duplikat, Gagal).

---

## 5. Rencana Perubahan Kode File

### `public/index.html`
- Tambahkan tombol toggle tema (matahari/bulan) di pojok kanan atas.
- Struktur ulang `#app-container` agar mendukung kelas status: `state-auth`, `state-selection`, dan `state-scanning`.
- Modifikasi footer dan branding bawah agar lebih harmonis dan rapi dalam satu layar.
- Perbarui markup kontainer riwayat pemindaian agar terintegrasi dengan daftar antrean dinamis.

### `public/style.css`
- Terapkan reset global dan variabel tema di `:root` dan `[data-theme="dark"]`.
- Buat gaya tombol toggle tema melayang (floating).
- Rancang kartu "glassmorphism" modern bertema cream (light) dan obsidian (dark).
- Terapkan styling untuk status antrean (daftar riwayat, spinner proses, badge sukses/duplikat, animasi getar jika error).
- Optimalkan media queries agar layout pas dengan tinggi viewport ponsel umum tanpa memunculkan scroll body.

### `public/script.js`
- Implementasikan logic toggle tema (menyimpan preferensi ke `localStorage`).
- Tambahkan manajemen status aplikasi (State Machine helper `setAppState(state)`).
- Implementasikan kelas `ScanQueue` yang mengelola penyimpanan di `localStorage`, sequentially processing, penanganan koneksi offline (menggunakan event `window.addEventListener('online')`), dan pencegahan double-scan.
- Integrasikan hasil sinkronisasi dengan tampilan pasfoto siswa yang diambil dari Supabase.
