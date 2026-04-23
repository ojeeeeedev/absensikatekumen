# DESIGN.md - Industrial Monochrome

## Brand & Style
- **Aesthetic:** Industrial Minimalism / Refined Brutalism.
- **Personality:** Precision, reliability, technical authority.
- **Visual Logic:** Structural clarity, sharp corners, functional focus.

## Colors
- **Background:** `#131313` (Main), `#000000` (Canvas)
- **Surfaces:**
  - Surface-dim: `#131313`
  - Surface-bright: `#393939`
  - Surface-container: `#1f1f1f`
  - Surface-variant: `#353535`
- **Typography/Foregound:**
  - On-surface: `#e2e2e2`
  - Primary: `#ffffff`
  - Secondary: `#c7c6c6`
- **Borders/Lines:**
  - Outline: `#8e9192`
  - Outline-variant: `#444748`
  - Structural: `#2D2D2D`
- **Accents:** Inverted logic (Black on White) for active states.

## Typography
- **Primary Font:** Space Grotesk
- **Data Font:** Monospace (standard terminal aesthetic)
- **Hierarchy:**
  - `h1`: 48px, 700, 1.1 LH, -0.02em LS
  - `h2`: 32px, 600, 1.2 LH, -0.01em LS
  - `h3`: 24px, 600, 1.2 LH
  - `body-lg`: 18px, 400, 1.5 LH
  - `body-md`: 16px, 400, 1.5 LH
  - `data-mono`: 14px, 400, 1.4 LH, 0.05em LS
  - `label-caps`: 12px, 700, 1 LH, 0.1em LS

## Layout & Spacing
- **Grid:** Rigid 4px baseline grid.
- **Module Design:** Content organized into "modules" with 1px or 2px solid borders.
- **Density:** High-density display, tight spacing (8px to 16px).

## Elevation & Depth
- **Tonal Layering:** No shadows. Hierarchy defined by border-weight and background-tone.
- **Borders:** 1px for standard, 2px for active/focus.

## Shapes
- **Radius:** Strictly 0px (Sharp corners).
- **Dividers:** 1px horizontal/vertical lines.

## Components
- **Buttons:**
  - Primary: White background, Black text, 0px radius.
  - Secondary: Transparent, 1px White border.
- **Inputs:** 1px full border or bottom-border only. Labels above.
- **Status:** Visual patterns/symbols instead of color where possible.
