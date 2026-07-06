import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

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

// Rate limiting middleware for sensitive routes
const bucketInitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    status: "error",
    message: "Too many requests, please try again later."
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

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

  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
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

// Route to handle dashboard data retrieval
app.get('/api/dashboard-data', async (req, res) => {
  try {
    const handler = (await import('./api/dashboard-data.js')).default;
    await handler(req, res);
  } catch (error) {
    console.error("Error running api/dashboard-data:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
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

// Route to proxy private Supabase photos through the app server
app.get('/api/photo', async (req, res) => {
  try {
    const handler = (await import('./api/photo.js')).default;
    await handler(req, res);
  } catch (error) {
    console.error("Error running api/photo:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
});

// Route to initialise (create) a Supabase storage bucket for a new class
app.post('/api/init-bucket', bucketInitLimiter, async (req, res) => {
  try {
    const handler = (await import('./api/init-bucket.js')).default;
    await handler(req, res);
  } catch (error) {
    console.error("Error running api/init-bucket:", error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
});


// Route to handle version retrieval
app.get('/api/version', async (req, res) => {
  try {
    const handler = (await import('./api/version.js')).default;
    await handler(req, res);
  } catch (error) {
    console.error("Error running api/version:", error);
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
