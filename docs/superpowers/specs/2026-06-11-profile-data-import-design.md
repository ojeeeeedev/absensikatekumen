# Design Spec: Profile Data Import and Accordion UI

- **Date:** 2026-06-11
- **Status:** Approved
- **Author:** Antigravity

## 1. Objective
Import student details (Pasfoto from Supabase, Name and Date of Birth from Google Sheets) and render them in a responsive, search-filterable, and expandable accordion list on the `/profile` page.

## 2. Technical Design

### A. Google Apps Script (`apps-script/Code.js`)
- We will update the `doPost(e)` function in the Apps Script to handle a new request parameter: `{ action: "getStudentList" }`.
- Introduce a helper function `getStudentList_(ss)` which:
  1. Reads registered students from the `"Presensi"` sheet: ID (Column L) and Name (Column B).
  2. Reads additional details from the `"Data Siswa"` sheet: ID (Column L) and Date of Birth (Column F, named `TTL`).
  3. Returns a combined JSON list of students: `[{ studentId: string, name: string, dob: string }]`.

### B. Vercel Serverless API (`api/students.js`)
- Create a new serverless function `/api/students` protected by JWT verification.
- **Query Parameter:** `classCode` (e.g., `SAB`).
- **Logic:**
  1. Retrieve the corresponding Apps Script Web App URL from `VERCEL_SCRIPT_MAP_JSON`.
  2. Send a POST request to the Apps Script URL with `{ action: "getStudentList" }`.
  3. For the returned students, query the Supabase bucket `pasfoto-<classcode>` to get all filenames.
  4. Perform a single batch call to `supabase.storage.from(bucket).createSignedUrls(paths, 60)` to obtain signed URLs for the student photos.
  5. Map the signed URLs to each student based on normalized ID naming (e.g. `2025/SAB/015` maps to `2025-SAB-015.<ext>`).
  6. Return `[{ studentId, name, dob, image }]` to the client.

### C. Local Express Server (`app.js`)
- Expose the new endpoint `/api/students` locally:
  ```javascript
  app.get('/api/students', async (req, res) => {
    try {
      const handler = (await import('./api/students.js')).default;
      await handler(req, res);
    } catch (error) {
      console.error("Error running api/students:", error);
      res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
  });
  ```

### D. Frontend Interface (`public/profile.html` & `public/profile.js`)
- **Theme and Structure:** Use the same liquid glass theme container (`glass-container`, `liquid-background`).
- **UI Elements:**
  - Class Code Selector: Dropdown loaded dynamically from config, or hardcoded for the supported classes (e.g., SAB, etc.).
  - Search Input: Real-time clientside filtering.
  - List Container: Render rows dynamically.
  - Expandable Detail Card: Tapping a student row displays an expanded body with:
    - Pasfoto (centered, larger size).
    - Name.
    - ID.
    - DOB (TTL).
- **Client Scripts:** Put logic inside a new script `public/profile.js` to keep code clean and modular.

## 3. Verification Plan

### A. API Verification
- Query `/api/students?classCode=SAB` with a valid JWT token.
- Assert that it returns a JSON response containing `status: "ok"` and a list of students with `studentId`, `name`, `dob`, and `image` (valid signed URL).

### B. UI Verification
- Access `/profile`.
- Select a class, search for a student, and expand a row.
- Verify that the image loads and theme toggle works seamlessly.
