# Design Spec: Profil Katekumen Name List Animation

## 1. Overview
Add a graceful staggered animation when loading the katekumen list on the profile page. Items will fade in from the right and load sequentially from top to bottom (staggered delay).

## 2. Goals & Constraints
* **Animation Feel:** Graceful slide-in from the right and fade-in, inspired by shadcn/Tailwind transitions.
* **Loading Direction:** Staggered sequence from top to bottom.
* **Compatibility:** Vanilla CSS and JS-driven delay mapping to ensure robustness. Ensure the hover effect (`translateY(-2px)`) remains fully functional after the load animation completes.

## 3. Detailed Design

### 3.1. CSS Keyframes & Animation
In `public/style.css`:
* Define `@keyframes slideInFromRight`:
  * `0%`: `opacity: 0`, `transform: translateX(30px)`
  * `100%`: `opacity: 1`, `transform: translateX(0)`
* Update `.student-accordion-item` with:
  * `opacity: 0` (initial state before animation starts)
  * `transform: translateX(30px)`
  * `animation: slideInFromRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards`
* Update `.student-accordion-item:hover` with `!important` on the transform to override the completed animation's keyframe transform value.

### 3.2. JavaScript Stagger Logic
In `public/profile.js`:
* In `renderStudents()`, loop over student elements and assign a dynamic `animationDelay` inline style:
  ```javascript
  const delay = Math.min(index * 0.04, 0.8);
  item.style.animationDelay = `${delay}s`;
  ```
  This caps the maximum delay at `0.8s` so that very long lists do not take too long to complete their entrance.

---

## 4. Proposed Changes

### 4.1. `public/style.css`
* Add slide-in animation rules and update hover rule.

### 4.2. `public/profile.js`
* Insert inline style animation delay inside `renderStudents()`.

---

## 5. Verification Plan
* **Manual Verification:**
  1. Open `/profile` page.
  2. Select a class from the dropdown list.
  3. Verify that the student list cards slide in gracefully from right to left, loading one-by-one from top to bottom.
  4. Hover over an item and verify the card lifts up (`translateY(-2px)`) and gains a shadow.
  5. Search for a name in the search bar and verify that the filtered list animates in gracefully.
