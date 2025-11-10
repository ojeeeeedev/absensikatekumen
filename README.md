# \# Absensi Katekumen Dewasa – Gereja Katedral St. Petrus Bandung



Sistem absensi digital berbasis QR Code untuk kegiatan Katekumen Dewasa di Gereja Katedral St. Petrus Bandung. Peserta cukup memindai kode QR mereka untuk menandai kehadiran pada tiap sesi atau topik, dan data akan langsung tercatat di Google Spreadsheet secara otomatis.



Proyek ini menghubungkan antarmuka web (frontend) dengan Google Apps Script sebagai backend untuk memproses data kehadiran dan menyimpannya ke sheet Absensi. Sistem dirancang agar sederhana, cepat, dan mudah digunakan oleh tim dokumentasi maupun peserta katekumen.



\## Fitur Utama



\- Presensi otomatis via QR Code  

&nbsp; Peserta memindai QR untuk mencatat kehadiran tanpa input manual.  

\- Integrasi dengan Google Sheets (Apps Script)  

&nbsp; Semua data tersimpan langsung di sheet Absensi dalam format tabel yang mudah dilihat.  

\- Dropdown Topik Dinamis  

&nbsp; Daftar topik diambil langsung dari sheet Topik, sehingga tidak perlu mengubah kode saat jadwal berganti.  

\- Validasi Kehadiran Otomatis  

&nbsp; Jika peserta sudah terdaftar dan topik valid, sistem akan mencentang otomatis pada kolom topik yang sesuai.  

\- Tampilan Web Responsif dan Minimalis  

&nbsp; Dapat diakses lewat ponsel atau komputer, menggunakan kamera belakang untuk scan QR.



\## Arsitektur Sistem



Frontend (index.html) menyediakan tampilan web untuk pemindaian QR menggunakan library Html5-Qrcode. Pengguna memilih topik dari dropdown (data diambil langsung dari Google Sheet “Topik”), lalu memindai QR peserta. Data hasil pemindaian dikirim melalui permintaan POST ke endpoint `/api/absensi`.



Backend (Google Apps Script) menangani permintaan POST dari frontend, mencocokkan StudentID di kolom L sheet Absensi, dan menandai TRUE pada kolom topik (O–R) sesuai sesi yang dipilih. Nama peserta diambil dari kolom B.



\## Alur Kerja Sistem



1\. Peserta datang dan memindai QR masing-masing di web absensi.  

2\. Web mengirim data studentId dan week (nomor topik) ke Google Apps Script.  

3\. Apps Script mencari StudentID pada kolom L di sheet Absensi.  

4\. Jika ditemukan, sistem menandai kolom topik terkait dengan nilai TRUE dan menampilkan pesan:  

&nbsp;  “<Nama Peserta> hadir Topik <n> <STUDENTID>”  

5\. Jika tidak ditemukan, pesan error akan muncul:  

&nbsp;  “StudentID tidak ditemukan.”



\## Struktur Spreadsheet



\- \*\*Sheet “Absensi”\*\* — Data kehadiran utama. Kolom penting: B (Nama), L (StudentID), O–R (Topik 1–4).  

\- \*\*Sheet “Data Siswa”\*\* — Daftar peserta dan QR code. Kolom penting: B (Nama), L (StudentID).  

\- \*\*Sheet “Topik”\*\* — Daftar topik katekumen untuk dropdown. Kolom penting: A (Nomor topik), B (Nama topik).



\## Komponen Teknologi



\- Frontend: HTML, CSS, JavaScript  

\- Scanner: Html5-Qrcode  

\- Backend: Google Apps Script  

\- Database: Google Spreadsheet  

\- Hosting: Vercel



\## Langkah Implementasi



1\. Buat Google Spreadsheet baru dan tambahkan tiga sheet: Absensi, Data Siswa, dan Topik.  

2\. Isi kolom sesuai struktur di atas.  

3\. Deploy Apps Script melalui menu “Extensions → Apps Script”. Salin isi file Code.gs, lalu deploy sebagai Web App dengan pengaturan:  

&nbsp;  - Execute as: Me  

&nbsp;  - Access: Anyone  

4\. Salin URL hasil deployment (format `https://script.google.com/macros/s/.../exec`).  

5\. Buka file index.html dan ubah nilai variabel `SCRIPT\_URL` menjadi URL tersebut.  

6\. Deploy ke Vercel atau jalankan lokal di browser.



Setelah deployment berhasil, web dapat langsung digunakan untuk presensi QR Code. Saat peserta memindai, halaman akan menampilkan pesan sukses atau error dan menunggu tiga detik sebelum dapat memindai berikutnya.



\## Fitur Tambahan (Branch Development)



Cabang `feature-duplicate-scan` dikembangkan untuk menambahkan deteksi otomatis jika peserta sudah dipindai sebelumnya (kolom absensi sudah TRUE). Jika peserta sudah hadir, sistem akan menampilkan peringatan:  

“Kode peserta <STUDENTID> sudah dipindai.”



\## Pengembang



Proyek ini dikelola oleh Tim TI Katekumen Dewasa – Gereja Katedral St. Petrus Bandung  

Dikembangkan oleh ojeeeeedev



\## Lisensi



Proyek ini bersifat non-komersial dan hanya digunakan untuk kepentingan internal kegiatan Katekumen Dewasa Gereja Katedral Bandung. Distribusi atau penggunaan ulang di luar konteks paroki memerlukan izin tertulis.



“Bertolaklah ke tempat yang dalam.”  

— Lukas 5:4



