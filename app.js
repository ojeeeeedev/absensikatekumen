import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';

// Load .env.local first (takes precedence), then fall back to .env
dotenv.config({ path: '.env.local' });
dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware to parse JSON and cookies
app.use(express.json());
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[local-dev] ${req.method} ${req.url} - body:`, req.body);
  next();
});

// Accessing variables from environment
const PORT = process.env.PORT || 5500;

// ==========================================
// 1. REWRITES & MIDDLEWARE EMULATION
// ==========================================

// Route for register (daftar) rewrite matching vercel.json
app.get('/daftar', async (req, res) => {
  try {
    const handler = (await import('./api/register.js')).default;
    await handler(req, res);
  } catch (error) {
    console.error("Error running api/register:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Route for dashboard rewrite with cookie check matching middleware.js
app.get('/dashboard', async (req, res) => {
  const token = req.cookies.auth_token;
  if (!token) {
    // If token is missing, redirect to login page (index.html)
    return res.redirect('/');
  }
  
  try {
    // Run api/dashboard handler directly
    const handler = (await import('./api/dashboard.js')).default;
    await handler(req, res);
  } catch (error) {
    console.error("Error running api/dashboard:", error);
    res.status(500).send("Internal Server Error");
  }
});

// ==========================================
// 2. API ENDPOINTS
// ==========================================

// Route to handle the main absensi API (Login and Attendance)
app.post('/api/absensi', async (req, res) => {
  try {
    const handler = (await import('./api/absensi.js')).default;
    await handler(req, res);
  } catch (error) {
    console.error("Error running api/absensi:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
});

// Route to handle dashboard direct API call
app.get('/api/dashboard', async (req, res) => {
  try {
    const handler = (await import('./api/dashboard.js')).default;
    await handler(req, res);
  } catch (error) {
    console.error("Error running api/dashboard:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Route to handle retrieving students list
app.get('/api/students', async (req, res) => {
  try {
    const handler = (await import('./api/students.js')).default;
    await handler(req, res);
  } catch (error) {
    console.error("Error running api/students:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
});

// Route to handle retrieving class list
app.get('/api/classes', async (req, res) => {
  try {
    const handler = (await import('./api/classes.js')).default;
    await handler(req, res);
  } catch (error) {
    console.error("Error running api/classes:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
});

// ==========================================
// 3. STATIC FILES
// ==========================================
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Fallback for clean URLs - serve index.html for unknown HTML paths
app.get('*', (req, res, next) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`Server started locally on http://localhost:${PORT}`);
});