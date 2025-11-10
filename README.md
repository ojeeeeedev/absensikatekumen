# \# 📖 Absensi Katekumen Dewasa – Gereja Katedral St. Petrus Bandung

# 

# Sistem absensi digital berbasis \*\*QR Code\*\* untuk kegiatan \*\*Katekumen Dewasa\*\* di Gereja Katedral St. Petrus Bandung. Peserta cukup memindai kode QR mereka untuk menandai kehadiran pada tiap sesi/topik, dan data akan langsung tercatat di \*\*Google Spreadsheet\*\* secara otomatis.

# 

# Proyek ini menghubungkan antarmuka web (frontend) dengan \*\*Google Apps Script\*\* sebagai backend untuk memproses data kehadiran dan menyimpannya ke sheet `Absensi`. Sistem dirancang agar sederhana, cepat, dan mudah digunakan oleh tim dokumentasi maupun peserta katekumen.

# 

# Sistem memiliki beberapa fitur utama, yaitu:  

# ✅ \*\*Presensi otomatis via QR Code\*\* — Peserta memindai QR untuk mencatat kehadiran tanpa input manual.  

# ✅ \*\*Integrasi dengan Google Sheets (Apps Script)\*\* — Semua data tersimpan langsung di sheet \*Absensi\* dalam format tabel yang mudah dilihat.  

# ✅ \*\*Dropdown Topik Dinamis\*\* — Daftar topik diambil langsung dari sheet \*Topik\*, sehingga tidak perlu mengubah kode saat jadwal berganti.  

# ✅ \*\*Validasi Kehadiran Otomatis\*\* — Jika peserta sudah terdaftar dan topik valid, sistem akan mencentang otomatis pada kolom topik yang sesuai.  

# ✅ \*\*Tampilan Web Responsif \& Minimalis\*\* — Dapat diakses lewat ponsel atau komputer, menggunakan kamera belakang untuk scan QR.

# 

# Arsitektur sistem terdiri dari dua komponen utama:  

# 📱 \*\*Frontend (index.html)\*\* — Menyediakan tampilan web untuk pemindaian QR menggunakan library \[Html5-Qrcode](https://github.com/mebjas/html5-qrcode). Pengguna memilih topik dari dropdown (data diambil langsung dari Google Sheet \*Topik\*), lalu memindai QR peserta. Data hasil pemindaian dikirim via `fetch()` ke endpoint `/api/absensi`.  

# ☁️ \*\*Backend (Google Apps Script)\*\* — Menangani permintaan POST dari frontend, mencocokkan `StudentID` di kolom \*\*L\*\* sheet \*Absensi\*, dan menandai TRUE pada kolom topik (O–R) sesuai sesi yang dipilih. Nama peserta diambil dari kolom \*\*B\*\*.

# 

# Alur kerja sistem adalah sebagai berikut:  

# 1️⃣ Peserta datang dan memindai QR masing-masing di web absensi.  

# 2️⃣ Web mengirim `studentId` dan `week` (nomor topik) ke Google Apps Script.  

# 3️⃣ Apps Script mencari StudentID pada kolom \*\*L\*\* di sheet \*Absensi\*.  

# 4️⃣ Jika ditemukan, sistem menandai kolom topik terkait dengan nilai TRUE dan menampilkan pesan:  

# &nbsp;  ✅ <Nama Peserta>  

# &nbsp;  hadir Topik <n>  

# &nbsp;  <STUDENTID>  

# 5️⃣ Jika tidak ditemukan, pesan error akan muncul:  

# &nbsp;  ❌ StudentID 2025/SAB/001 tidak ditemukan

# 

# Struktur Google Sheet yang digunakan:  

# \- \*\*Sheet “Absensi”\*\* — Data kehadiran utama. Kolom penting: \*\*B:\*\* Nama, \*\*L:\*\* StudentID, \*\*O–R:\*\* Topik 1–4.  

# \- \*\*Sheet “Data Siswa”\*\* — Daftar peserta dan QR code. Kolom penting: \*\*B:\*\* Nama, \*\*L:\*\* StudentID.  

# \- \*\*Sheet “Topik”\*\* — Daftar topik katekumen untuk dropdown. Kolom penting: \*\*A:\*\* Nomor topik, \*\*B:\*\* Nama topik.

# 

# Proyek ini dibangun menggunakan:  

# \- \*\*Frontend:\*\* HTML + CSS + JavaScript  

# \- \*\*Scanner:\*\* Html5-Qrcode  

# \- \*\*Backend:\*\* Google Apps Script  

# \- \*\*Database:\*\* Google Spreadsheet  

# \- \*\*Hosting:\*\* Vercel

# 

# Langkah implementasi proyek:  

# 1️⃣ \*\*Buat Google Spreadsheet baru\*\* dan tambahkan tiga sheet: `Absensi`, `Data Siswa`, dan `Topik`.  

# 2️⃣ \*\*Isi kolom\*\* sesuai struktur di atas.  

# 3️⃣ \*\*Deploy Apps Script:\*\* Buka menu “Extensions → Apps Script”, salin isi file `Code.gs`, lalu deploy sebagai \*Web App\* dengan pengaturan \*Execute as: Me\* dan \*Access: Anyone\*.  

# 4️⃣ Salin URL dari deployment (format `https://script.google.com/macros/s/.../exec`).  

# 5️⃣ \*\*Hubungkan frontend:\*\* buka file `index.html` dan ubah nilai variabel `SCRIPT\_URL` menjadi URL dari langkah sebelumnya.  

# 6️⃣ \*\*Deploy ke Vercel\*\* untuk hosting otomatis, atau jalankan lokal di browser.

# 

# Setelah deployment berhasil, web dapat langsung digunakan untuk presensi QR Code. Saat peserta memindai, halaman akan menampilkan pesan sukses atau error dan menunggu 3 detik sebelum dapat memindai berikutnya.

# 

# Fitur tambahan sedang dikembangkan di branch `feature-duplicate-scan`, yaitu:  

# \- Deteksi otomatis jika peserta sudah dipindai sebelumnya (kolom absensi sudah TRUE).  

# \- Menampilkan peringatan: ⚠️ Kode peserta <STUDENTID> sudah dipindai.

# 

# Proyek ini dikelola oleh \*\*Tim TI Katekumen Dewasa – Gereja Katedral St. Petrus Bandung\*\*, dikembangkan oleh \*\*ojeeeeedev\*\*.

# 

# Lisensi: Proyek ini bersifat \*\*non-komersial\*\* dan hanya digunakan untuk kepentingan internal kegiatan \*\*Katekumen Dewasa Gereja Katedral Bandung\*\*. Distribusi atau penggunaan ulang di luar konteks paroki memerlukan izin tertulis.

# 

# 🕊️ “Bertolaklah ke tempat yang dalam.” — Lukas 5:4



