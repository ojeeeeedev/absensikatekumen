###### 📘 \*\*Absensi Katekumen Dewasa – Gereja Katedral St. Petrus Bandung\*\*

###### 

###### Sistem absensi digital berbasis \*\*QR Code\*\* untuk kegiatan Katekumen Dewasa, mencatat kehadiran peserta langsung ke \*\*Google Spreadsheet\*\* melalui Google Apps Script.  

###### Antarmuka web sederhana dan dapat digunakan langsung di ponsel dengan kamera belakang.

###### 

###### ---

###### 

###### ✨ \*\*Fitur Utama\*\*

###### 

###### 📷 Pemindaian Kode QR Otomatis  

###### Peserta cukup memindai kode QR masing-masing untuk menandai kehadiran tanpa input manual.  

###### 

###### ☁️ Integrasi Langsung dengan Google Sheets  

###### Setiap hasil pemindaian otomatis tersimpan di sheet \*Absensi\* menggunakan Google Apps Script.  

###### 

###### 🗂️ Dropdown Topik Dinamis  

###### Daftar topik diambil langsung dari sheet \*Topik\*, sehingga tidak perlu mengubah kode saat jadwal berganti.  

###### 

###### ✅ Validasi Kehadiran Otomatis  

###### Jika peserta sudah hadir, sistem akan mencentang kolom topik yang sesuai.  

###### 

###### 🖥️ Tampilan Web Minimalis  

###### Desain bersih dan responsif, mudah digunakan oleh panitia dan peserta.  

###### 

###### ⏳ Waktu Tunggu 3 Detik  

###### Sistem menunggu 3 detik sebelum memindai kode berikutnya untuk menghindari duplikasi.

###### 

###### ---

###### 

###### 🧠 \*\*Teknologi yang Digunakan\*\*

###### 

###### • Frontend: HTML, CSS, JavaScript  

###### • Scanner: Html5-Qrcode  

###### • Backend: Google Apps Script  

###### • Database: Google Spreadsheet  

###### • Hosting: Vercel  

###### 

###### ---

###### 

###### 🧩 \*\*Struktur Spreadsheet\*\*

###### 

###### | Sheet | Fungsi | Kolom Penting |

###### |-------|---------|----------------|

###### | Absensi | Data kehadiran peserta | B: Nama, L: StudentID, O–R: Topik 1–4 |

###### | Data Siswa | Daftar peserta \& QR | B: Nama, L: StudentID |

###### | Topik | Nama topik katekumen | A: Nomor, B: Nama Topik |

###### 

###### ---

###### 

###### 🚧 \*\*Fitur Eksperimen (Branch `feature-duplicate-scan`)\*\*

###### 

###### 🔹 Deteksi otomatis jika QR sudah pernah dipindai sebelumnya.  

###### Pesan peringatan:  

###### > ⚠️ Kode peserta <STUDENTID> sudah dipindai.

###### 

###### ---

###### 

###### 👥 \*\*Tim Pengembang\*\*

###### 

###### Tim TI Katekumen Dewasa – Gereja Katedral St. Petrus Bandung  

###### Dikembangkan oleh \*\*Antonius Andar P.\*\*

###### 

###### ---

###### 

###### > “Bertolaklah ke tempat yang dalam.”  

###### > — Lukas 5:4

###### 

