require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

// Middleware to parse JSON bodies (required for login/attendance POST)
app.use(express.json());

// Serve static files (index.html, style.css, script.js) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Accessing variables from .env
const PORT = process.env.PORT || 5500;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Route to handle the absensi API (Login and Attendance)
app.post('/api/absensi', async (req, res) => {
  // Dynamically import the ESM handler from the api folder
  const handler = (await import('./api/absensi.js')).default;
  await handler(req, res);
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});