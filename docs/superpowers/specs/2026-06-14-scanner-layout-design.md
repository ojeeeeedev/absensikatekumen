# Design Spec: Scanner Layout and Scroll History Fix

- **Date:** 2026-06-14
- **Topic:** Scanner Layout and Scroll History Container Fix
- **Status:** Proposed

## 1. Problem Statement
When students are scanned, new cards are added to the scan history list. Because the container has a flex layout and elements lack constraints against shrinking, the growing history list pushes and shrinks the camera scanner (`#reader-container`) viewport. This distorts the layout and camera display on mobile screens.

## 2. Goals
- Ensure the camera scanner height/width does not shrink when new items are added to the scan history.
- Preserve the `aspect-ratio: 1 / 1` responsive scaling on mobile widths (never squishing vertically).
- Allow the scan history container (`#queue-history-panel`) to consume the remaining vertical space.
- Enable vertical scrolling inside the scan history list (`.queue-list-container`) when items exceed the available viewport.
- Set a minimum height of `115px` for the history container to ensure a visual cue is always shown (displaying at least 1 full card and a fraction of the next).

## 3. Proposed Changes

### 3.1 CSS Updates in `public/style.css`

#### Prevent Shrinking on Static Layout Elements
We will add `flex-shrink: 0` to elements that should never compress vertically:
1. **Scanner Container (`#reader-container`)**:
   ```css
   #reader-container {
     width: 300px;
     max-width: 100%;
     aspect-ratio: 1 / 1;
     height: auto;
     border-radius: 20px;
     overflow: hidden;
     position: relative;
     border: 1px solid var(--border-glass);
     background: #000;
     box-shadow: inset 0 4px 12px rgba(0,0,0,0.2);
     margin: 0 auto 0.75rem auto;
     pointer-events: none;
     flex-shrink: 0; /* Prevents camera scanner container from shrinking vertically */
   }
   ```

2. **Active Topic Bar (`.active-topic-bar`)**:
   Add `flex-shrink: 0;` to ensure it maintains its shape.

3. **Status Indicator (`#status`)**:
   Add `flex-shrink: 0;` to prevent vertical compression.

4. **Sync Queue Warning Bar (`.queue-warning-banner`)**:
   Add `flex-shrink: 0;` to prevent vertical compression.

#### Flex and Scroll Configuration for History
We will modify the history containers to flex dynamically, scroll internally, and maintain a minimum height:
1. **History Panel (`#queue-history-panel`)**:
   ```css
   #queue-history-panel {
     flex: 1 1 auto;
     display: flex;
     flex-direction: column;
     min-height: 0;
     overflow: hidden;
     margin-bottom: 0.5rem;
   }
   ```

2. **Queue List Container (`.queue-list-container`)**:
   ```css
   .queue-list-container {
     overflow-y: auto;
     display: flex;
     flex-direction: column;
     gap: 8px;
     flex: 1 1 auto;
     min-height: 115px; /* Ensures visual cue showing 1 + 0.2 card height */
     max-height: none; /* Remove hardcoded 380px limit to let it flex naturally */
     padding-right: 2px;
   }
   ```

## 4. Verification and Testing
1. **Desktop/Mobile Rendering**:
   Verify that on initial load (empty state), the scanner is a perfect square.
2. **Scan Addition Behavior**:
   Scan several mock student IDs to populate the list. Ensure that as items are added, the scanner height remains unchanged, and a scrollbar appears on the history container when items exceed the remaining vertical height.
3. **Responsive Verification**:
   Inspect layout on simulated narrow mobile screens (e.g. iPhone SE/12 Pro) to verify the history container is constrained, scrolls, and maintains a minimum height of `115px`.
