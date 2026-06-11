# Client-Side Image Caching & Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement client-side photo caching with localStorage, downscaling via Canvas, and a 10-minute eviction policy to save Supabase egress/DB costs.

**Architecture:** A new shared utility `image-cache.js` manages key operations (`get`, `set`, `compressAndCacheElement`). UI elements load photos, requesting cached images first. If not cached, the browser loads the network signed URL and compresses it dynamically using `<canvas>` inside an `onload` listener, saving it to `localStorage` as base64 data.

**Tech Stack:** Vanilla JavaScript (ES6+), Canvas API, HTML5 localstorage.

---

### Task 1: Create Image Cache Manager Utility

**Files:**
- Create: `public/image-cache.js`

- [ ] **Step 1: Write code for public/image-cache.js**
  Create a new file `public/image-cache.js` containing:
  ```javascript
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in ms

  window.ImageCache = {
    get: function(studentId) {
      if (!studentId) return null;
      const key = `img_cache_${studentId.toLowerCase()}`;
      try {
        const itemStr = localStorage.getItem(key);
        if (!itemStr) return null;
        
        const item = JSON.parse(itemStr);
        const now = Date.now();
        
        if (now - item.ts > CACHE_TTL) {
          localStorage.removeItem(key);
          return null;
        }
        
        return item.data;
      } catch (e) {
        console.error(`Error reading image cache for ${studentId}:`, e);
        return null;
      }
    },

    set: function(studentId, dataUrl) {
      if (!studentId || !dataUrl) return;
      const key = `img_cache_${studentId.toLowerCase()}`;
      try {
        const item = {
          data: dataUrl,
          ts: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(item));
      } catch (e) {
        console.warn(`Failed to write to localStorage for ${studentId}:`, e);
        if (e.name === 'QuotaExceededError' || e.code === 22) {
          this.clearAll();
          try {
            const item = { data: dataUrl, ts: Date.now() };
            localStorage.setItem(key, JSON.stringify(item));
          } catch (retryErr) {
            console.error('Failed to cache image even after clearing storage:', retryErr);
          }
        }
      }
    },

    clearAll: function() {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('img_cache_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        console.log('Cleared all image cache from localStorage');
      } catch (e) {
        console.error('Error clearing image cache:', e);
      }
    },

    compressAndCacheElement: function(studentId, imgEl) {
      if (!studentId || !imgEl || imgEl.src.startsWith('data:') || imgEl.src.includes('assets/favicon.png')) {
        return;
      }
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const maxDim = 150; 
        let width = imgEl.naturalWidth || imgEl.width;
        let height = imgEl.naturalHeight || imgEl.height;
        
        if (!width || !height) return;
        
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(imgEl, 0, 0, width, height);
        
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        this.set(studentId, compressedDataUrl);
      } catch (e) {
        console.warn(`Error compressing image element for ${studentId}:`, e);
      }
    }
  };
  ```

- [ ] **Step 2: Commit file**
  Run:
  ```bash
  git add public/image-cache.js
  git commit -m "feat: add client-side ImageCache utility"
  ```

---

### Task 2: Update HTML files to load Image Cache Manager

**Files:**
- Modify: `public/index.html`
- Modify: `public/profile.html`

- [ ] **Step 1: Load image-cache.js in index.html**
  Modify `public/index.html` by adding `<script src="image-cache.js"></script>` before the script inclusion tags.
  Target replacement at lines 183-184:
  ```html
      <script src="image-cache.js"></script>
      <script src="topics.js"></script>
      <script src="script.js"></script>
  ```

- [ ] **Step 2: Load image-cache.js in profile.html**
  Modify `public/profile.html` by adding `<script src="image-cache.js"></script>` before `profile.js`.
  Target replacement at lines 60-61:
  ```html
      <script src="image-cache.js"></script>
      <script src="profile.js"></script>
  ```

- [ ] **Step 3: Commit HTML changes**
  Run:
  ```bash
  git add public/index.html public/profile.html
  git commit -m "feat: load image-cache script in HTML files"
  ```

---

### Task 3: Integrate Caching into Profile List

**Files:**
- Modify: `public/profile.js`

- [ ] **Step 1: Check cache and optimize image elements in renderStudents**
  Modify `public/profile.js:154-180` to read cached image if available, set `crossorigin="anonymous"`, and trigger compression `onload`:
  ```javascript
      const cachedPhoto = window.ImageCache ? window.ImageCache.get(student.studentId) : null;
      const displayImgUrl = cachedPhoto || imgUrl;
      const hasPhoto = !!displayImgUrl;
      
      const photoHtml = hasPhoto 
        ? `<img class="student-thumb" src="${escapeHTML(displayImgUrl)}" crossorigin="anonymous" alt="${escapeHTML(student.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" onload="if(!this.src.startsWith('data:') && window.ImageCache) window.ImageCache.compressAndCacheElement('${student.studentId}', this);">
           <div class="student-thumb-placeholder" style="display: none;"><span class="material-icons-outlined">person</span></div>`
        : `<div class="student-thumb-placeholder"><span class="material-icons-outlined">person</span></div>`;
  ```
  And:
  ```javascript
      const largePhotoHtml = hasPhoto
        ? `<img class="student-photo-large" src="${escapeHTML(displayImgUrl)}" crossorigin="anonymous" alt="Foto ${escapeHTML(student.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
           <div class="student-photo-placeholder" style="display: none;"><span class="material-icons-outlined">person</span></div>`
        : `<div class="student-photo-placeholder"><span class="material-icons-outlined">person</span></div>`;
  ```

- [ ] **Step 2: Commit profile JS changes**
  Run:
  ```bash
  git add public/profile.js
  git commit -m "feat: integrate ImageCache into profile list view"
  ```

---

### Task 4: Integrate Caching into Scan View & Modal

**Files:**
- Modify: `public/script.js`

- [ ] **Step 1: Integrate ImageCache in Scan History Card rendering**
  Modify `public/script.js:464-477` to check cache, set `crossorigin`, and compress `onload`:
  ```javascript
        const cachedPhoto = window.ImageCache ? window.ImageCache.get(item.studentId) : null;
        const avatarSrc = cachedPhoto || item.image || '/assets/favicon.png';
        
        const studentInfo = document.createElement('div');
        studentInfo.className = 'student-info';

        const studentPhoto = document.createElement('img');
        studentPhoto.className = 'student-photo';
        studentPhoto.setAttribute('crossorigin', 'anonymous');
        studentPhoto.src = avatarSrc;
        studentPhoto.alt = 'Foto';
        studentPhoto.onload = function() {
          if (!this.src.startsWith('data:') && window.ImageCache) {
            window.ImageCache.compressAndCacheElement(item.studentId, this);
          }
        };
        studentPhoto.onerror = function() {
          this.onerror = null;
          this.src = '/assets/favicon.png';
        };
        studentInfo.appendChild(studentPhoto);
  ```

- [ ] **Step 2: Integrate ImageCache in showStudentModal**
  Modify `public/script.js:898-902` in `window.showStudentModal` to load from cache, set `crossorigin`, and cache `onload`:
  ```javascript
    const cachedPhoto = window.ImageCache ? window.ImageCache.get(item.studentId) : null;
    const modalImgSrc = cachedPhoto || item.image || '/assets/favicon.png';

    photoEl.setAttribute('crossorigin', 'anonymous');
    photoEl.src = modalImgSrc;
    photoEl.onload = function() {
      if (!this.src.startsWith('data:') && window.ImageCache) {
        window.ImageCache.compressAndCacheElement(item.studentId, this);
      }
    };
    photoEl.onerror = function() {
      this.onerror = null;
      this.src = '/assets/favicon.png';
    };
  ```

- [ ] **Step 3: Commit script JS changes**
  Run:
  ```bash
  git add public/script.js
  git commit -m "feat: integrate ImageCache into main scan view and modal"
  ```

---

### Task 5: Build Verification

- [ ] **Step 1: Run build script**
  Run: `npm run build`
  Expected: Command finishes successfully with "No build step needed".
