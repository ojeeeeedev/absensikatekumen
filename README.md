<div align="center">
  <h1>Absensi Katekumen Digital</h1>
  <p>
    Sistem absensi digital berbasis QR code untuk program Katekumenat di Katedral Santo Petrus, Bandung.
  </p>
  <br />
  <a href="#english-version">Read in English</a>
</div>

<br />

## 🌟 Fitur Utama

- 📱 **UI Modern & Mobile-First**: Antarmuka responsif dengan desain "liquid glass" yang berfungsi di semua perangkat.
- 📷 **Pemindaian Kode QR Cepat**: Menggunakan kamera perangkat untuk absensi yang cepat dan efisien.
- 🔊 **Umpan Balik Instan**: Memberikan konfirmasi visual dan audio untuk pemindaian yang berhasil atau gagal.
- 📊 **Sinkronisasi Data Real-time**: Kehadiran dicatat langsung ke Google Spreadsheet secara real-time.
- ⚙️ **Pemilihan Topik Dinamis**: Memilih topik mingguan dengan mudah untuk pencatatan kehadiran yang akurat.
- 🔍 **Daftar Topik dengan Pencarian**: Menemukan topik dengan cepat menggunakan bilah pencarian yang tetap di atas.

## 🛠️ Tumpukan Teknologi & Arsitektur

Proyek ini menggunakan arsitektur sederhana namun kuat untuk menghubungkan frontend web ke backend Google Sheet.

- **Frontend**: Satu file `index.html` yang dibuat dengan **HTML, CSS, dan JavaScript** murni. Tanpa framework.
  - **UI/UX**: "Liquid Glass" design with custom fonts (Playfair Display, Cinzel, Inter) and Material Icons.
  - **Pemindaian QR**: Pustaka `html5-qrcode`.
- **Backend API**: Fungsi serverless (misalnya, di-deploy di Vercel) yang bertindak sebagai proxy. File `index.html` berkomunikasi dengan ini.
- **Lapisan Data**: **Google Apps Script** yang di-deploy sebagai Web App. Skrip ini menerima data dari API dan menuliskannya ke **Google Spreadsheet**.

```
├── README.md
└── api/
    ├── absensi.js
└── index.html
┌────────────────┐   HTTP POST   ┌──────────────────┐   HTTP POST   ┌───────────────────┐   Writes to   ┌──────────────────┐
│                │──────────────>│                  │──────────────>│                   │──────────────>│                  │
│   Frontend     │               │  Serverless API  │               │ Google Apps Script│               │ Google Sheet     │
│ (index.html)   │<──────────────│   (e.g., Vercel) │<──────────────│    (Web App)      │<──────────────│                  │
│                │   JSON Status │                  │   JSON Status │                   │   (Database)  │                  │
└────────────────┘               └──────────────────┘               └───────────────────┘               └──────────────────┘
```

## 🛠️ Prerequisites & Dependencies

## 🚀 Getting Started

- **Web Browser:** Modern web browser (Chrome, Firefox, Safari, etc.)
- **Google Apps Script:** A Google account and familiarity with Google Apps Script for configuring the backend.
- **HTML5 QR Code Library:** Used for QR code scanning functionality, included via CDN: `https://unpkg.com/html5-qrcode`
- **Google Spreadsheet:** A Google Spreadsheet to record attendance data.
  Follow these steps to set up and deploy your own instance of the attendance system.

## 🚀 Installation & Setup Instructions

### Step 1: Set up Google Sheets & Apps Script

1.  **Clone the Repository:**
1.  **Create a Google Sheet**: This will be your database. Create columns like `Timestamp`, `StudentID`, `Name`, `Week`, `ClassCode`, etc.
1.  **Open Apps Script**: In your sheet, go to `Extensions` > `Apps Script`.
1.  **Add the Script**: Paste the code from `api/absensi.js` (or your own version) into the script editor. This script should contain a `doPost(e)` function to handle incoming data.
1.  **Deploy as a Web App**:
    - Click `Deploy` > `New deployment`.
    - Select `Web app` as the type.
    - In the configuration:
      - **Execute as**: `Me`
      - **Who has access**: `Anyone` (This is crucial for the API to be able to call it).
    - Click `Deploy`.
1.  **Copy the Web App URL**: After deploying, you will get a unique URL. **Save this URL.** This is your Google Apps Script endpoint.

    ```bash
    git clone https://github.com/ojeeeeedev/absensikatekumen.git
    cd absensikatekumen
    ```

### Step 2: Set up the Serverless API (Proxy)

2.  **Set up Google Apps Script:**
    The frontend cannot directly call the Google Apps Script due to CORS redirect issues. A serverless proxy is needed.

        *   Create a new Google Spreadsheet.
        *   Open the Script editor in your Google Sheet (Tools > Script editor).
        *   Create a function that handles incoming POST requests and appends data to the sheet.  You will need to deploy this as a Web App.
        *   Copy the `scriptURL` from `api/absensi.js` and replace the placeholder with your deployed Web App URL from Google Apps Script.

1.  **Create a Serverless Function**: In your project (e.g., in an `/api` directory if using Vercel), create a file like `absensi.js`.
1.  **Configure the Proxy**: This function will receive the request from the frontend, forward it to your Google Apps Script URL from Step 1, and then return the response from Google back to the frontend.
1.  **Deploy**: Deploy your project to a hosting provider with serverless function support, like Vercel or Netlify.

1.  **Configure CORS (if necessary):**

### Step 3: Configure the Frontend

    The provided `api/absensi.js` already includes CORS headers allowing requests from all origins.  Review the `api/absensi.js` file and adjust as needed.

1.  **Update API Endpoint**: In `index.html`, find the `fetch` calls within the JavaScript. Ensure they point to your deployed serverless function endpoint (e.g., `/api/absensi`).

2.  **Deploy `index.html`:**

    ```javascript
    // Example:
    const response = await fetch("/api/absensi", {
      // ...
    });
    ```

    - You can directly open `index.html` in your browser from your local file system.
    - Alternatively, you can host the `index.html` file on a web server (e.g., Netlify, Vercel, GitHub Pages).

3.  **Ready to Go!**: Access the deployed URL of your frontend. The app should now be fully functional.

## 📝 Usage Examples

## 🤝 Contributing

1.  **Open `index.html` in your browser on a mobile device.**
    Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

2.  **Grant camera permissions when prompted.**

3.  **Point the camera at the QR code. The data will be automatically sent to your Google Spreadsheet.**

## ⚙️ Configuration Options

- **`scriptURL` in `api/absensi.js`:** This is the most important configuration. Update this with the URL of your deployed Google Apps Script Web App.

## 🤝 Contributing Guidelines

Contributions are welcome! To contribute:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and commit them with descriptive messages.
4.  Submit a pull request.
5.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
6.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
7.  Push to the Branch (`git push origin feature/AmazingFeature`).
8.  Open a Pull Request.

## ⚖️ License Information

## ⚖️ License

No license is currently specified for this project. All rights are reserved by the owner.
This project is unlicensed and all rights are reserved. If you wish to adapt it, please consider forking the project and applying your own license.

## 🙏 Acknowledgments

- Uses the `html5-qrcode` library for QR code scanning.
- **html5-qrcode**: For the excellent and easy-to-use QR code scanning library.
- **Google Fonts**: For providing the beautiful typefaces and icons used in the design.
- **Tim TI Katekumen Dewasa**: For the opportunity and collaboration on this project.
