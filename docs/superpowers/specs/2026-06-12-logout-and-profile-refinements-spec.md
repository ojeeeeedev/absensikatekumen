# Spec: Logout and Profile Refinements

This specification outlines the updates for adding logout functionality, topic selection expiry logic, scrolling behavior fixes, constant search stats, and layout loading states.

## 1. Requirements

1. **Topic Memory Expiry Logic:**
   - If the user is logged out (either explicitly by clicking "Logout" or implicitly when their session expires or tab closes) for more than 10 minutes, the memory of the last selected topic (`selectedWeek`) must be cleared from `localStorage`.
2. **Scrolling Behavior Fix (Natural Scrolling):**
   - The programmatic height collapse of `.header-container` is removed to avoid layout jumps. The header scrolls naturally out of the viewport.
   - The sticky class selector minimizes on scroll threshold > `50px`.
3. **Logout Button:**
   - A small, icon-only logout button is added to the rightmost side of the navigation bar (`#app-nav`) on both the scanner page (`index.html`) and the profile page (`profile.html`).
   - Logging out clears the authentication cookie and `sessionStorage` token, records a logout timestamp in `localStorage`, and redirects to the login page.
4. **Constant Stats Counters on Search:**
   - The count summary badges on the profile page (Total, Aktif, Nonaktif) must always show the overall class statistics (`allStudents`) even when the list is filtered during a search query.
5. **Hide Badges During Load:**
   - When loading a new class, the counts summary box (`#students-summary`) is hidden immediately until the new data has fully loaded and is ready to be rendered.

## 2. Technical Design

### A. HTML Updates (`public/index.html` & `public/profile.html`)
Add the logout button to `#app-nav`:
```html
<nav class="app-nav" id="app-nav" ...>
  ...
  <a href="#" class="nav-item logout-btn" onclick="handleLogout(event)" aria-label="Keluar">
    <span class="material-icons-outlined">logout</span>
  </a>
</nav>
```

### B. CSS Updates (`public/style.css`)
1. Style `.nav-item.logout-btn`:
   ```css
   .nav-item.logout-btn {
     flex: 0 0 auto;
     width: 45px;
     padding: 0.55rem;
     justify-content: center;
   }
   ```
2. Remove collapsing behavior on header scroll:
   - Remove `.app-section.scrolled .header-container` rules.
   - Remove `.app-section.scrolled .header-logo` rules.
   - Restore `.header-container` transitions to default.

### C. JS Updates (`public/script.js` & `public/profile.js`)
1. **Logout Handling:**
   Expose `window.handleLogout` globally:
   ```javascript
   window.handleLogout = function(e) {
     if (e) e.preventDefault();
     document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
     sessionStorage.removeItem('authToken');
     localStorage.setItem('logoutTimestamp', Date.now().toString());
     window.location.href = '/';
   };
   ```

2. **Topic Expiry Checks (`public/script.js`):**
   Implement the checks on initialization:
   ```javascript
   function checkTopicExpiry() {
     const loggedIn = !!sessionStorage.getItem('authToken');
     const now = Date.now();
     const tenMinutes = 10 * 60 * 1000;

     if (loggedIn) {
       const logoutTime = localStorage.getItem('logoutTimestamp');
       if (logoutTime) {
         if (now - parseInt(logoutTime) > tenMinutes) {
           localStorage.removeItem('selectedWeek');
         }
         localStorage.removeItem('logoutTimestamp');
       }
       localStorage.setItem('lastActiveTimestamp', now.toString());
     } else {
       const lastActive = localStorage.getItem('lastActiveTimestamp');
       if (lastActive) {
         if (now - parseInt(lastActive) > tenMinutes) {
           localStorage.removeItem('selectedWeek');
         }
         localStorage.removeItem('lastActiveTimestamp');
       }
     }
   }
   ```

3. **Stats Calculations (`public/profile.js`):**
   In `renderStudents(students)`:
   ```javascript
   const activeAll = allStudents.filter(s => !isInactive(s));
   const inactiveAll = allStudents.filter(s => isInactive(s));

   summaryTotalText.textContent = `Total: ${allStudents.length}`;
   summaryActiveText.textContent = `Aktif: ${activeAll.length}`;
   summaryInactiveText.textContent = `Nonaktif: ${inactiveAll.length}`;
   ```

4. **Loading States (`public/profile.js`):**
   In `loadStudents(classCode)`:
   - Hide the `#students-summary` container.
