# Absensi Katekumen - Katedral St. Petrus Bandung (Alpha)

Absensi Katekumen Dewasa – Gereja Katedral St. Petrus Bandung. Sistem absensi digital berbasis QR Code untuk kegiatan Katekumen Dewasa, mencatat kehadiran peserta langsung ke Google Spreadsheet melalui Google Apps Script. Antarmuka web sederhana dan dapat digunakan langsung di ponsel dengan kamera belakang.

## ✨ Fitur Utama

*   📷 **Pemindaian Kode QR Otomatis:** Peserta cukup memindai QR Code dengan kamera ponsel.
*   📊 **Pencatatan Kehadiran Real-time:** Data kehadiran langsung tercatat di Google Spreadsheet.
*   📱 **Responsif dan Mudah Digunakan:** Antarmuka web yang dirancang untuk penggunaan di perangkat seluler.
*   🌐 **CORS Enabled API:** API dirancang untuk dapat diakses dari berbagai sumber.

## ⚙️ Technologies

### Languages

*   JavaScript

## 📂 Project Structure

```
├── README.md
└── api/
    ├── absensi.js
└── index.html
```

## 🛠️ Prerequisites & Dependencies

*   **Web Browser:** Modern web browser (Chrome, Firefox, Safari, etc.)
*   **Google Apps Script:** A Google account and familiarity with Google Apps Script for configuring the backend.
*   **HTML5 QR Code Library:** Used for QR code scanning functionality, included via CDN: `https://unpkg.com/html5-qrcode`
*   **Google Spreadsheet:** A Google Spreadsheet to record attendance data.

## 🚀 Installation & Setup Instructions

1.  **Clone the Repository:**

    ```bash
    git clone https://github.com/ojeeeeedev/absensikatekumen.git
    cd absensikatekumen
    ```

2.  **Set up Google Apps Script:**

    *   Create a new Google Spreadsheet.
    *   Open the Script editor in your Google Sheet (Tools > Script editor).
    *   Create a function that handles incoming POST requests and appends data to the sheet.  You will need to deploy this as a Web App.
    *   Copy the `scriptURL` from `api/absensi.js` and replace the placeholder with your deployed Web App URL from Google Apps Script.

3.  **Configure CORS (if necessary):**

    The provided `api/absensi.js` already includes CORS headers allowing requests from all origins.  Review the `api/absensi.js` file and adjust as needed.

4.  **Deploy `index.html`:**

    *   You can directly open `index.html` in your browser from your local file system.
    *   Alternatively, you can host the `index.html` file on a web server (e.g., Netlify, Vercel, GitHub Pages).

## 📝 Usage Examples

1.  **Open `index.html` in your browser on a mobile device.**

2.  **Grant camera permissions when prompted.**

3.  **Point the camera at the QR code. The data will be automatically sent to your Google Spreadsheet.**

## ⚙️ Configuration Options

*   **`scriptURL` in `api/absensi.js`:**  This is the most important configuration.  Update this with the URL of your deployed Google Apps Script Web App.

## 🤝 Contributing Guidelines

Contributions are welcome! To contribute:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and commit them with descriptive messages.
4.  Submit a pull request.

## ⚖️ License Information

No license is currently specified for this project. All rights are reserved by the owner.

## 🙏 Acknowledgments

*   Uses the `html5-qrcode` library for QR code scanning.