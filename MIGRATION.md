# React Frontend Migration

## Decision

Port the frontend incrementally to React with Vite and TypeScript. Keep the
existing Vercel API routes, Google Apps Script integration, Google Sheets data,
Supabase photo storage, authentication contract, and deployment behavior.

The migration is justified by continued UI growth and the need to use
React-compatible component libraries. It is not a backend rewrite.

## Goals

- Use React components without maintaining disconnected UI systems long term.
- Replace manual DOM construction and `window.*` coordination with explicit
  component state and event handlers.
- Preserve the current mobile-first layout, light/dark themes, accessibility,
  API contracts, scan behavior, offline queue, and stored user selections.
- Enable TypeScript and component-level testing as each feature moves.
- Remove legacy frontend code only after its replacement reaches parity.

## Non-goals

- Replacing Google Sheets or Google Apps Script.
- Redesigning the interface during the framework migration.
- Changing authentication, API payloads, class configuration, or photo storage.
- Adding React Router, a global state library, or another abstraction before a
  concrete need appears.
- Porting every screen in one release.

## Current Frontend

The application is currently served from `public/index.html` and uses shared
styles from `public/style.css`. Behavior is distributed across classic scripts,
primarily:

- `public/script.js`: login, navigation, scanner, attendance queue, history,
  dialogs, and application startup.
- `public/profile.js`: class selection, profile loading, search, and roster UI.
- `public/onboarding.js`: onboarding flow.
- `public/session.js`: authentication session and inactivity behavior.
- `public/theme.js`, `public/toast.js`, `public/search-combobox.js`, and
  `public/profile-uploader.js`: shared UI behavior.

These files rely on DOM IDs, global `window.*` functions, `localStorage`,
`sessionStorage`, and browser events. Those contracts must remain stable while
React and legacy code coexist.

## Expected Upsides

- Access to shadcn/ui, Radix, Base UI, React Hook Form, TanStack, and similar
  React ecosystems.
- Reusable, accessible dialogs, drawers, comboboxes, forms, and controls.
- Declarative rendering for the scan queue, profile roster, loading states,
  toasts, and modal content.
- Clearer ownership of state shared between navigation and application views.
- Easier TypeScript adoption and component testing.
- A maintainable base for future staff workflows and additional screens.

## Expected Downsides

- React, Vite, and component tooling add dependencies and a frontend build step.
- React and legacy scripts must temporarily coexist.
- Global DOM contracts must be untangled carefully rather than mechanically
  translated.
- QR camera behavior, focus restoration, browser history, offline storage, and
  authentication can regress during migration.
- Tailwind or component-library styles can conflict with the existing global
  CSS unless resets are isolated during the transition.
- React does not solve backend configuration or Google Sheets limitations.

## Target Shape

```text
Browser
  React + Vite + TypeScript frontend
    existing semantic CSS tokens
    selected React components
    html5-qrcode adapter
    fetch calls to unchanged /api/* endpoints
  Vercel serverless API
  Google Apps Script + Google Sheets
  Supabase private photo storage
```

Use one React application as the eventual frontend owner. Temporary component
islands are acceptable only as migration boundaries; they should be absorbed
into the main React root rather than becoming permanent parallel applications.

Keep state local to the owning feature. Add shared context only for state that
is genuinely cross-cutting, such as the authenticated session or active class.
Do not add a global state library unless React state and context measurably stop
being sufficient.

## Migration Order

### Phase 1: React foundation

- Add Vite, React, React DOM, and TypeScript.
- Add one React entry point and production build output compatible with the
  current Express and Vercel routing.
- Import the existing theme tokens without changing the visual design.
- Establish one smoke test that proves the React root loads in production mode.

### Phase 2: Shared shell

- Port login, header, navigation, theme control, and authenticated app shell.
- Preserve the `auth_token` cookie, `sessionStorage` token, inactivity rules,
  `/` and `/profile` URLs, browser history, and focus behavior.
- Keep existing API handlers unchanged.

### Phase 3: Lower-risk views

- Port onboarding, topic selection, comboboxes, profile upload, profile search,
  roster rendering, dialogs, drawers, and toasts.
- Introduce React-compatible components only where they replace real existing
  UI; avoid speculative component wrappers.
- Preserve the semantic tokens and standards in `DESIGN.md`.

### Phase 4: Attendance state

- Port scan history, queue rendering, progress state, retry behavior, duplicate
  handling, student detail, and delete confirmation.
- Keep the existing storage keys and data shapes until the migration is done.
- Add one focused test for queue persistence and status transitions.

### Phase 5: QR scanner

- Wrap `html5-qrcode` in one React component with explicit start, stop, and
  cleanup behavior.
- Verify camera permission denial, repeated scans, view changes, unmounting,
  offline behavior, and mobile browser lifecycle events.
- Port this last because it has the highest browser-integration risk.

### Phase 6: Cleanup

- Remove replaced script tags, global functions, obsolete selectors, and dead
  legacy files.
- Remove compatibility bridges only after searches confirm no callers remain.
- Update `README.md` and `DESIGN.md` to describe React as the frontend source of
  truth.

## Component-Library Rules

- Prefer native HTML and existing CSS when they already solve the interaction.
- Use React components for behavior-heavy controls such as dialogs, drawers,
  comboboxes, menus, and form composition.
- Preserve visible labels, keyboard access, focus restoration, Escape handling,
  minimum touch targets, and reduced-motion behavior.
- If shadcn/ui is adopted, introduce Tailwind without a global reset while
  legacy pages still depend on the current stylesheet.
- Do not replace working controls solely to make the component count larger.

## Compatibility Contracts

The port must preserve:

- Existing `/api/*` paths, methods, authentication, and payload shapes.
- `auth_token`, `selectedWeek`, `selectedTopicName`, scan queue, and inactivity
  storage behavior.
- `/` and `/profile` navigation and refresh behavior.
- Private photos through the authenticated same-origin `/api/photo` proxy.
- QR duplicate prevention, offline queueing, retry, status, and haptic feedback.
- Light/dark mode, 320-430px mobile usability, keyboard access, and visible
  focus states.

## Verification Gate for Every Phase

Each phase is complete only when:

1. Existing unit and UI checks pass.
2. The production frontend build succeeds.
3. Login, refresh, logout, and `/profile` navigation still work.
4. The affected workflow passes at 320px, 390px, and desktop widths in both
   themes.
5. Keyboard navigation and focus behavior remain usable.
6. No replaced legacy code is removed until the React path passes parity.
7. `git diff --check` passes.

## Rollback Strategy

Keep each phase independently deployable. During coexistence, retain the legacy
implementation until the React replacement is verified, then remove it in the
same feature-sized change. A failed phase should be revertible without changing
the backend or stored data.

## Recommended Starting Slice

Start with the React foundation and topic selector or profile combobox. They
exercise component integration, theme tokens, keyboard behavior, storage, and
legacy bridging without putting camera scanning or attendance writes at risk.

Do not begin with the QR scanner and do not combine the migration with a visual
redesign.
