# Navigation Vertical Stacking Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify the body display layout so that the navigation bar and main container card stack vertically.

**Architecture:** Add `flex-direction: column` to the body element styling in `style.css`.

**Tech Stack:** CSS3.

---

### Task 1: CSS Body Layout Correction

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Set flex-direction to column on body**
  Modify lines 88-95 in `public/style.css` to add `flex-direction: column;`:
  ```css
  body {
    width: 100%;
    height: 100vh;
    height: calc(var(--vh, 1vh) * 100);
    background-color: var(--bg-body);
    color: var(--text-primary);
    font-family: "Inter", sans-serif;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  ```

- [ ] **Step 2: Git stage CSS changes**
  Run:
  ```bash
  git add public/style.css
  ```

---

### Task 2: Build Verification

- [ ] **Step 1: Run build verification**
  Run: `npm run build`
  Expected: Command succeeds with no errors.
