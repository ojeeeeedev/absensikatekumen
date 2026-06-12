# Profile List Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a staggered fade-in/slide-in-from-right animation for the student list on the profile page.

**Architecture:** Define keyframe animation and styles in CSS. Add inline style animation-delay parameters dynamically in JS based on item index.

**Tech Stack:** HTML5, CSS3, Vanilla JS

---

### Task 1: Update CSS Styles and Keyframes

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Modify `.student-accordion-item` rules in `public/style.css`**
Update the CSS to define initial animation values, the slide-in animation, and the hover override.

Find the block:
```css
.student-accordion-item {
  background: var(--bg-card);
  border: 1px solid var(--border-glass);
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.student-accordion-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.15);
}
```

And update it to:
```css
.student-accordion-item {
  background: var(--bg-card);
  border: 1px solid var(--border-glass);
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
  opacity: 0;
  transform: translateX(30px);
  animation: slideInFromRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.student-accordion-item:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 16px rgba(0,0,0,0.15);
}

@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add public/style.css
git commit -m "style: add slide-in animation for student accordion items"
```

---

### Task 2: Implement Inline Stagger Delays in JS

**Files:**
- Modify: `public/profile.js`

- [ ] **Step 1: Modify `renderStudents` in `public/profile.js`**
Assign staggered delays to list items dynamically in the rendering loop.

Find the block:
```javascript
  students.forEach(student => {
    const item = document.createElement('div');
    item.className = 'student-accordion-item';
    
    const header = document.createElement('div');
```

And update it to:
```javascript
  students.forEach((student, index) => {
    const item = document.createElement('div');
    item.className = 'student-accordion-item';
    
    // Stagger animation delays top-to-bottom
    const delay = Math.min(index * 0.04, 0.8);
    item.style.animationDelay = `${delay}s`;
    
    const header = document.createElement('div');
```

- [ ] **Step 2: Run build verification**
Run: `npm run build`

- [ ] **Step 3: Commit**
```bash
git add public/profile.js
git commit -m "feat: add staggered animation delay to profile list items"
```

---

### Task 3: Verify and Bump Version

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Verify animation visually**
Confirm the profile page list loads smoothly with staggering animation from top-to-bottom and slides in from right. Confirm hover effects function correctly.

- [ ] **Step 2: Bump version**
Bump version to `2.2.2` in `package.json`.

- [ ] **Step 3: Commit version bump**
```bash
git add package.json
git commit -m "chore: bump version to 2.2.2 for student list animation"
```
