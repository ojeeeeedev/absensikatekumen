# Design Spec: /profile Route and Branch Setup

- **Date:** 2026-06-11
- **Status:** Approved
- **Author:** Antigravity

## 1. Objective
Establish the `profilecard` development branch and introduce a new `/profile` route serving a frontend profile page with local server parity and standard Vercel clean URL resolution.

## 2. Technical Design

### A. Git Branching
- A new branch `profilecard` will be created from the current HEAD.
- The branch will be pushed to `origin` to create the remote branch.

### B. Server Routing (`app.js`)
- Modify the `express.static` serving in [app.js](file:///Users/andarpartogi/repo/absensikatekumen/app.js) to resolve `.html` extensions. This matches Vercel's `"cleanUrls": true` behavior in local development.
- Target snippet:
  ```javascript
  app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
  ```

### C. Frontend Page (`public/profile.html`)
- Create a new file `public/profile.html` with a basic structure matching the project's design guidelines:
  - Import the same Google Fonts (`DM Serif Display Regular Italic`, `Inter`) and Material Icons.
  - Import the stylesheet `style.css`.
  - Include the standard `liquid-background` divs.
  - Render a container matching the glassmorphism card style (`glass-container`), with a header and a placeholder for the future Profile Card component.

## 3. Verification Plan

### A. Local Routing Verification
1. Run the local development server: `npm run dev` (starts on `http://localhost:5500`).
2. Navigate to `http://localhost:5500/profile`.
3. Assert that the server successfully renders the page contents of `public/profile.html` without showing any 404 error or fallback to `index.html`.
4. Navigate to `http://localhost:5500/profile.html`.
5. Assert that it serves the same page.

### B. Git Verification
1. Verify that the current branch is `profilecard`.
2. Verify that the branch has been pushed to the remote repository.
