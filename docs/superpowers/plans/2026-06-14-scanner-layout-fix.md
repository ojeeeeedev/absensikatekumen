# Scanner Layout and Scroll History Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the camera scanner viewport from shrinking when scans are added to the list, and make the history container scrollable with a minimum height of 115px.

**Architecture:** Apply `flex-shrink: 0` to layout components that must remain static (scanner viewport, topic bar, status header, sync bar) inside the flexbox layout, and configure the history container to use `flex-shrink: 1`, `flex-grow: 1` and `overflow-y: auto`.

**Tech Stack:** Pure CSS3 (Vanilla CSS).

---

### Task 1: Prevent Shrinking of Scanner Viewport and Static Headers

**Files:**
- Modify: `public/style.css:330-410`

- [ ] **Step 1: Update `#reader-container` to prevent shrinking**
  Modify `#reader-container` in `public/style.css` to add `flex-shrink: 0;`.
  ```css
  #reader-container {
    width: 300px;
    max-width: 100%;
    aspect-ratio: 1 / 1;
    height: auto;
    border-radius: 20px;
    overflow: hidden; position: relative; border: 1px solid var(--border-glass);
    background: #000; box-shadow: inset 0 4px 12px rgba(0,0,0,0.2);
    margin: 0 auto 0.75rem auto;
    pointer-events: none;
    flex-shrink: 0; /* Prevents vertical shrinking */
  }
  ```

- [ ] **Step 2: Update `.active-topic-bar` to prevent shrinking**
  Modify `.active-topic-bar` in `public/style.css` to add `flex-shrink: 0;`.
  Wait, let's view its exact definition in `public/style.css` first. It's around line 320.
  We will add `flex-shrink: 0;` to `.active-topic-bar`:
  ```css
  .active-topic-bar {
    display: flex; align-items: center; gap: 12px;
    padding: 0.65rem 0.85rem; border-radius: 12px;
    background: var(--bg-glass); border: 1px solid var(--border-glass);
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.1s ease;
    flex-shrink: 0;
  }
  ```

- [ ] **Step 3: Update `#status` and `.queue-warning-banner` to prevent shrinking**
  Modify `#status` and `.queue-warning-banner` in `public/style.css` to add `flex-shrink: 0;`.
  ```css
  #status {
    width: 100%; padding: 0.65rem; border-radius: 10px; min-height: 42px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    font-size: 0.8rem; font-weight: 500; text-align: center;
    margin-bottom: 0.75rem;
    flex-shrink: 0;
  }
  .queue-warning-banner {
    background: var(--status-pending-bg);
    border: 1px solid var(--status-pending-border);
    color: var(--status-pending-text);
    padding: 0.6rem 0.8rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 0.7rem;
    margin-bottom: 0.75rem;
    flex-shrink: 0;
  }
  ```

- [ ] **Step 4: Commit Task 1 changes**
  ```bash
  git add public/style.css
  git commit -m "style: prevent vertical shrinking of scanner container and static headers"
  ```

---

### Task 2: Configure History Container Flexing, Scrollability, and Min-Height

**Files:**
- Modify: `public/style.css:430-490`

- [ ] **Step 1: Modify `#queue-history-panel` in `public/style.css`**
  Ensure it has `flex-shrink: 1;` so it shrinks instead of the scanner:
  ```css
  #queue-history-panel {
    flex: 1 1 auto; display: flex; flex-direction: column;
    min-height: 0;
    overflow: hidden; margin-bottom: 0.5rem;
  }
  ```

- [ ] **Step 2: Modify `.queue-list-container` in `public/style.css`**
  Remove the `max-height: 380px;` constraint and add a `min-height: 115px;` constraint. Ensure it has `overflow-y: auto;` and `flex: 1 1 auto;`:
  ```css
  .queue-list-container {
    overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
    min-height: 115px; /* Visual cue to show at least 1 + 0.2 card height */
    padding-right: 2px;
    flex: 1 1 auto;
    min-height: 0; /* Wait: min-height can be overridden, so we define min-height: 115px here! */
  }
  ```
  Let's refine it:
  ```css
  .queue-list-container {
    overflow-y: auto; display: flex; flex-direction: column; gap: 8px;
    padding-right: 2px;
    flex: 1 1 auto;
    min-height: 115px; /* Ensures visual cue showing 1 + 0.2 card height */
  }
  ```

- [ ] **Step 3: Commit Task 2 changes**
  ```bash
  git add public/style.css
  git commit -m "style: enable history list auto scrolling, dynamic flex, and minimum height of 115px"
  ```

---

### Task 3: Build Verification

- [ ] **Step 1: Run production build verification**
  Run: `npm run build`
  Expected: Successful compilation without errors.
