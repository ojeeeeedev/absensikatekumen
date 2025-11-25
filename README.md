# Absensi Katekumen Digital

A modern, QR code-based digital attendance system for the Catechumenate program at St. Peter's Cathedral, Bandung.

---

## 🌟 Key Features

- **Modern Mobile-First UI**: Responsive "liquid glass" interface that works on any device.
- **Fast QR Code Scanning**: Uses the device's camera for quick and efficient attendance taking.
- **Instant Feedback**: Provides immediate visual confirmation for successful or failed scans.
- **Real-time Data Sync**: Attendance is recorded directly to a Google Spreadsheet in real-time.
- **Dynamic Topic Selection**: Facilitators can easily select the weekly topic for accurate attendance records.

## 🛠️ Tech Stack & Architecture

This project uses a simple and robust serverless architecture to connect a pure HTML/JS frontend to a Google Sheet backend.

- **Frontend**:

  - **HTML5, CSS3, JavaScript (ES6+)**: No frameworks for a lightweight and fast experience.
  - **html5-qrcode**: For QR code scanning functionality.
  - **Google Fonts & Material Icons**: For typography and iconography.

- **Backend (Proxy API)**:

  - **Vercel Serverless Functions**: A Node.js proxy API to securely communicate with the Google Apps Script backend.

- **Data Layer**:
  - **Google Apps Script**: Deployed as a Web App to handle incoming data and write to the spreadsheet.
  - **Google Sheets**: Acts as the database for storing attendance records.

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
