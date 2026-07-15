# DESIGN.md

## 1. Design Identity

Presensi Katekumen Digital is an operational attendance tool for facilitators using phones in real rooms. It should feel calm, clear, fast, trustworthy, and deliberate.

Should feel:
- Minimal but not empty.
- Professional but not cold.
- Dense enough for repeated work, with enough spacing to avoid mistakes.
- Modern through typography, alignment, contrast, and interaction polish.
- Consistent between scanner, profile, onboarding, modal, toast, and upload flows.

Should not feel:
- Like a marketing landing page.
- Decorative, flashy, gradient-heavy, or random.
- Cramped, low contrast, or dependent on color alone.
- Like each screen was styled independently.

## 2. Global Design Rules

- Use one spacing system: 4, 8, 12, 16, 24, 32, 48, and 64px.
- Use semantic color tokens in UI code. Do not add random hex values in components.
- Keep existing workflow, API contracts, auth logic, scan queue behavior, and data shape unchanged during UI work.
- Never create a new button style unless it becomes part of the shared system.
- Every interactive element needs default, hover, active, disabled, loading where relevant, and focus-visible states.
- Every page needs a clear primary action: login, choose topic/scan, choose class/search, upload photo.
- Loading states must preserve layout and avoid large shifts.
- Empty states must explain what is missing and provide the next useful step.
- Error states must say what happened and how to recover.
- Forms must support paste, password managers, browser validation, and normal typing.
- Use visible controls for common actions. Do not hide primary actions in menus.
- Light and dark modes must both be intentional.
- Responsive behavior is part of the design, not cleanup.

## 3. Design Tokens

Stack: plain HTML, CSS, and vanilla JavaScript. Tokens live in `public/style.css` under `:root` and `[data-theme="dark"]`.

Required semantic color tokens:
- `background`, `foreground`
- `card`, `card-foreground`
- `popover`, `popover-foreground`
- `primary`, `primary-foreground`
- `secondary`, `secondary-foreground`
- `muted`, `muted-foreground`
- `accent`, `accent-foreground`
- `destructive`, `destructive-foreground`
- `success`, `success-foreground`
- `warning`, `warning-foreground`
- `border`, `input`, `ring`
- `chart-1` through `chart-5`

Compatibility aliases may remain for existing code, but they must map to semantic tokens: `--bg-body`, `--bg-glass`, `--bg-card`, `--border-glass`, `--text-primary`, `--text-secondary`, `--accent`, `--accent-hover`, `--accent-glow`, and status tokens.

Radius:
- `--radius-sm`: 8px.
- `--radius-md`: 12px.
- `--radius-lg`: 16px.
- `--radius-xl`: 20px.
- `--radius-2xl`: 24px.
- `--radius-full`: 999px.

Shadows:
- `--shadow-sm` for small lift.
- `--shadow-md` for cards and nav.
- `--shadow-lg` for sheets and overlays.
- Dark mode should rely more on borders and surface contrast than heavy shadows.

Z-index:
- Base: 1.
- Sticky/nav: 10.
- Dropdown/sheet: 200.
- Modal: 300.
- Toast/loader: 1000.

## 4. Typography System

- Primary font: Inter.
- Brand/display text may use DM Serif Display Regular Italic only in compact headers and identity moments.
- Numeric/data text uses Google Sans Code or monospace with `font-variant-numeric: tabular-nums`.
- Page titles: 18-20px, 600.
- Section/card titles: 14-16px, 600.
- Body text: 14-16px, 400-500.
- Labels/captions: 12-13px, 500-600 with adequate contrast.
- Table/list metadata: 12-13px, tabular where comparable.
- Avoid text below 12px except dense metadata with strong contrast.
- Use weight and spacing before increasing size.

## 5. Layout System

- Body uses a centered mobile-first app shell with safe-area padding.
- Main shell max width is 420px for scanner/profile phone workflows.
- Sheets and upload dialogs can use 480px max width.
- Use one card/panel rhythm: 12-16px internal spacing, 12px gaps, 16-24px section spacing.
- Do not put cards inside cards unless the inner card is a repeated item or modal section.
- Scanner layout prioritizes topic, camera, sync history, and footer in that order.
- Profile layout prioritizes class selector, summary, search, then scannable student list.
- Use scroll containers intentionally; avoid accidental body/page horizontal overflow.

## 6. Component Standards

Buttons:
- Primary: filled `primary`; one main action per region.
- Secondary: bordered or muted background.
- Ghost: low-emphasis icon/action.
- Destructive: destructive token pair.
- Link: actual `a` for navigation.
- States: default, hover, active, disabled, loading, focus-visible.

Inputs, selects, textareas, search, file inputs:
- Minimum 44px touch height.
- 16px font size on mobile.
- Use `input` border and `ring` focus.
- Keep labels visible or use `sr-only` when the visual context is unambiguous.

Cards/stat cards/chart cards:
- Use `card` surface, `border`, `radius-lg`, and subtle shadow.
- Use status badges for status, not color alone.

Navigation:
- Active item uses primary token and clear text/icon.
- Icon-only logout must have an accessible label.
- Links are real anchors.

Dialogs/drawers/dropdowns/popovers/tooltips:
- Use native buttons for close actions.
- Modal surfaces use `popover` tokens and visible focus.
- Dialogs should close with Escape where JS supports it and return focus where feasible.

Toasts:
- Use the shared bottom-center toast controller on scanner and profile surfaces; the newest notification sits in front, up to three older notifications stack behind it, and the stack expands on hover or keyboard focus.
- Every toast has a dismiss button, uses a frosted semantic border/fill, and dismisses after five seconds without extending on hover/focus; scan results place a semantic status/topic badge beside a bullet and one clipped name line, and no more than four remain visible.
- Destructive actions should be confirmed or reversible; use a toast action for lightweight Undo flows.

Tables/lists:
- Prefer native tables for true tabular data.
- Current profile accordion is a list; it must remain keyboard accessible and scannable.
- Metadata uses tabular numeric styling.
- Edge-swipe destructive actions need a visible text rail plus a keyboard-accessible equivalent.

Empty, loading, error states:
- Empty states include what is missing and next action.
- Loading states keep the destination layout stable.
- Errors use destructive tokens and recovery copy.

Pagination/search/filter UI:
- Search controls stay near the data they filter.
- Carousel dots and nav buttons need labels and focus states.

## 7. Data Visualization Standards

- Every visual metric must answer a real operational question.
- Scanner progress bars communicate sync composition: success, duplicate, error, pending.
- Use at most five chart/status colors.
- Prefer text counts plus color dots for accessibility.
- Keep gridlines and separators muted.
- Do not use 3D, decorative gauges, or excessive gradients.
- Loading/empty states are required for chart-like progress regions.

## 8. Light Mode and Dark Mode

- Theme is driven by `data-theme` on `<html>`.
- Both modes must define the full semantic token set.
- No component should hardcode mode-specific colors directly.
- Avoid pure black except camera preview surfaces.
- Native controls must use explicit background, text, border, and `color-scheme`.
- Logos may swap through `theme.js`; colors still come from tokens.

## 9. AI Skills for Design Engineers

For designers and engineers to help them build better user interfaces.
Use `$find-animation-opportunities` first for read-only discovery of motion that would genuinely help. Use `emil-design-eng` to build approved animations, `$review-animations` to review them, and `$improve-animations` to plan or implement fixes.

## 10. Accessibility Standards

- Every interactive element must be keyboard accessible.
- Every input must have a label or equivalent accessible name.
- Focus states must be visible and not removed.
- Touch targets should be at least 44x44px where practical and never below 24x24px.
- Color is not the only status cue; include text, icon, or shape.
- Icon-only buttons require `aria-label`.
- Toasts use polite live regions.
- Do not disable browser zoom.
- Mobile inputs use at least 16px.
- Dialogs and sheets need role, names, close controls, and Escape handling where practical.

## 11. Responsive Design Standards

- Mobile first: 320px through 430px must be usable.
- Tablet/desktop: keep the operational shell centered and calm; do not stretch scanner cards excessively.
- Nav should stay one line where possible and wrap gracefully on very narrow screens.
- Primary actions must remain reachable.
- Profile filters stay sticky only when it helps scanning and must not cover content.
- Horizontal scroll is acceptable only for the scanner carousel, with visible controls/dots.
- Verify mobile, tablet, desktop, and dark mode.

## 12. Implementation Guidelines

- Put tokens in `public/style.css`; do not add a UI library.
- Prefer shared selectors for controls: `button`, `.nav-item`, input/select, `.status-badge`, `.toast`, `.modal-content`, `.student-accordion-item`.
- Preserve business logic in `public/script.js`, `public/profile.js`, API files, session logic, and Apps Script.
- Remove inline style only when it is visual and safe; do not move behavior-driving styles unless tested.
- Update this file when adding a reusable UI pattern.
- Use CSS variables for new colors, shadows, radii, and spacing.
- Keep onboarding styling aligned with the same tokens.

## 13. AI Agent Instructions

- Always read `DESIGN.md` before changing UI.
- Follow existing tokens and component patterns.
- Do not invent new styles without updating the guideline.
- Do not create one-off UI unless absolutely necessary.
- Preserve functional behavior.
- Improve consistency when touching related components.
- Use accessible defaults.
- Keep light and dark mode working.
- Prefer small systematic refactors over chaotic redesigns.
- For animation work, follow Section 9 only; do not use `ultimate-design-guideline` as an animation authority.
- When unsure, choose clarity, consistency, and maintainability.
- If a requested UI change conflicts with `DESIGN.md`, explain the conflict and either follow `DESIGN.md` or update `DESIGN.md` intentionally with a clear reason.

## 14. Design Review Checklist

- Does this use semantic tokens?
- Does this work in light and dark mode?
- Is spacing consistent?
- Is typography consistent?
- Are interactive states complete?
- Is keyboard navigation working?
- Are focus states visible?
- Is the mobile layout usable?
- Are loading, empty, and error states handled?
- Are charts/readouts readable?
- Are lists and tables scannable?
- Are buttons visually prioritized correctly?
- Is there any one-off styling that should become reusable?
- Does this preserve existing functionality?
- Are forms labeled, validated, and compatible with paste/password managers?
- Are destructive actions confirmed or reversible?
- Are data freshness and units visible where needed?
- Are chart/status colors limited and accessible?
- Are page actions and navigation obvious?
