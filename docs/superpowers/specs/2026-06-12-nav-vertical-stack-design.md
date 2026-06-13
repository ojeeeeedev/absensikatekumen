# Spec: Vertical Stacking of Navigation Bar and Main Card

## Status
Approved

## Date
2026-06-12

## Author
Antigravity Coding Assistant

---

## 1. Objective
Correct the layout alignment so that the separated top navigation bar (`#app-nav`) stacks vertically directly above the main app container (`#app-container`) instead of laying out horizontally beside it.

## 2. Requirements & Constraints
* **Vertical Layout**: Direct children of the page `<body>` must align in a column flex flow.
* **Centered Alignment**: Stacking must keep both the navigation bar and main container centered horizontally.

## 3. Detailed Technical Design

### 3.1 CSS Changes (`public/style.css`)
* Modify the `body` selector to add `flex-direction: column;`:
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
