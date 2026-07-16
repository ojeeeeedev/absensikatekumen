# 001 — Add interruptible momentum to combobox scrolling

- **Status**: DONE
- **Commit**: `cf02637`
- **Severity**: MEDIUM
- **Category**: Interruptibility
- **Estimated scope**: 2 files, about 70 lines

## Problem

The shared topic/class combobox uses a manual one-finger scroll fallback so the
fixed dropdown remains usable on mobile. It tracks only the current finger
position, writes the exact delta to `scrollTop`, and clears the gesture on
release:

```js
// public/search-combobox.js:200-214 — current
list.addEventListener('touchstart', event => {
  if (event.touches.length === 1 && list.scrollHeight > list.clientHeight) {
    touchY = event.touches[0].clientY;
  }
}, { passive: true });
list.addEventListener('touchmove', event => {
  if (touchY === null || event.touches.length !== 1) return;
  const nextY = event.touches[0].clientY;
  const previousScrollTop = list.scrollTop;
  list.scrollTop += touchY - nextY;
  touchY = nextY;
  if (list.scrollTop !== previousScrollTop) event.preventDefault();
}, { passive: false });
list.addEventListener('touchend', () => { touchY = null; });
list.addEventListener('touchcancel', () => { touchY = null; });
```

This makes the list follow the finger correctly, but all velocity is discarded
at `touchend`, so a fast flick stops immediately. Topic selection is a frequent
mobile interaction and the hard stop makes the control feel broken even though
the list is now reachable.

The current regression helper proves only that repeated finger deltas reach the
end; it does not assert post-release movement or interruption:

```js
// scripts/check-profile-combobox.js:38-71 — current
async function swipeToListEnd(locator) {
  return locator.evaluate(list => {
    // dispatches touchstart/touchmove/touchend and checks final scrollTop
  });
}
```

## Target

Keep direct finger tracking during `touchmove`, then continue scrolling from
the measured release velocity. Use one `requestAnimationFrame` loop because
momentum is dynamic gesture motion; do not use CSS keyframes or smooth-scroll.

Use these exact constants inside `public/search-combobox.js`:

```js
const MOMENTUM_FRAME_MS = 1000 / 60;
const MOMENTUM_DECAY_PER_FRAME = 0.95;
const MOMENTUM_MIN_VELOCITY = 0.02; // px/ms
const MOMENTUM_MAX_VELOCITY = 2.5;  // px/ms
const MOMENTUM_MAX_DURATION_MS = 900;
const VELOCITY_SAMPLE_WEIGHT = 0.25;
```

During each one-finger `touchmove`, measure the instantaneous scroll velocity
as `(touchY - nextY) / max(event.timeStamp - touchTime, 1)`, then smooth it:

```js
touchVelocity = touchVelocity * (1 - VELOCITY_SAMPLE_WEIGHT)
  + instantaneousVelocity * VELOCITY_SAMPLE_WEIGHT;
```

At `touchend`, clamp velocity to `[-2.5, 2.5]` px/ms and start momentum only
when all conditions are true:

- `Math.abs(touchVelocity) >= 0.02` px/ms.
- The list still overflows.
- `matchMedia('(prefers-reduced-motion: reduce)').matches` is false.

For each animation frame:

1. Clamp frame time to at most `32ms`.
2. Add `velocity * elapsedMs` to `list.scrollTop`.
3. Apply frame-rate-independent decay:

   ```js
   velocity *= Math.pow(
     MOMENTUM_DECAY_PER_FRAME,
     elapsedMs / MOMENTUM_FRAME_MS
   );
   ```

4. Stop immediately when `scrollTop` no longer changes (top/bottom boundary),
   velocity falls below `0.02` px/ms, the popover closes, or elapsed momentum
   reaches `900ms`.

Momentum must be interruptible. Cancel the active frame on a new `touchstart`,
`touchcancel`, `close()`, `render()`, and the existing `clearMotionTimers()`
path. A new touch must take control from the current rendered position without
jumping.

Add this ceiling comment beside the constants:

```js
// ponytail: tuned for short dropdowns; return to native inertia when fixed-layer mobile scrolling is reliable.
```

## Repo conventions to follow

- The app uses plain JavaScript and CSS; there is no spring or motion library.
  Do not add one for one gesture.
- `public/script.js:1331-1363` already measures gesture time and velocity for
  the student drawer. Match its `performance.now()`/elapsed-time style and keep
  gesture state local to the component initializer.
- `public/style.css:26-30` defines crisp operational motion tokens
  (`120ms`, `180ms`, `280ms`, strong ease-out). Momentum is continuous physics,
  so it should use frame-rate-independent decay rather than a CSS easing token.
- `public/search-combobox.js:39-42` already branches on
  `prefers-reduced-motion`; reuse the same media query string.
- `scripts/check-profile-combobox.js:38-71` is the existing touch regression
  seam. Extend it instead of creating a second browser test runner.

## Steps

1. In `public/search-combobox.js`, add the six constants and the `ponytail:`
   ceiling comment at the top of the IIFE, beside the existing combobox motion
   constants.
2. Extend the per-combobox gesture state with `touchTime`, `touchVelocity`, and
   `momentumFrame`. Keep all state inside `createSearchCombobox`; do not add a
   shared class or utility module.
3. Add `cancelMomentum()` that calls `cancelAnimationFrame(momentumFrame)` when
   needed and resets the frame handle. Call it from `clearMotionTimers()`,
   `touchstart`, `touchcancel`, `close()`, and before `render()` replaces option
   nodes.
4. Update `touchstart` to cancel active momentum, set `touchY`, set
   `touchTime = event.timeStamp`, and reset `touchVelocity = 0` only for a
   single-finger gesture on an overflowing list.
5. Update `touchmove` to calculate the smoothed px/ms velocity before applying
   the existing `scrollTop` delta. Preserve `{ passive: false }` and call
   `preventDefault()` only when `scrollTop` actually changes.
6. Replace the current `touchend` reset with a `startMomentum()` call followed
   by clearing the touch tracking fields. Keep `touchcancel` as cancellation
   without momentum.
7. Implement `startMomentum()` with the exact target algorithm and stop
   conditions above. Write `scrollTop` once per frame; do not animate option
   transforms or introduce overscroll bounce.
8. In `scripts/check-profile-combobox.js`, retain `swipeToListEnd()` and add an
   async `flickList(locator)` helper. Dispatch touch moves about `16ms` apart,
   record `scrollTop` immediately before `touchend`, wait `120ms`, and return
   the post-release position.
9. Assert for both class and topic lists that a mid-list flick continues at
   least `24px` after release, never exceeds `scrollHeight - clientHeight`, and
   stops changing after a new `touchstart`. Keep the existing end-reachability
   assertions.

## Boundaries

- Do NOT remove the manual touch fallback; it fixes the deployed mobile scroll
  regression.
- Do NOT change dropdown markup, positioning, sizes, colors, entry/exit motion,
  filtering, option selection, keyboard navigation, or focus behavior.
- Do NOT add a dependency, generic physics helper, spring abstraction, bounce,
  or scroll-snap behavior.
- Do NOT animate under `prefers-reduced-motion: reduce`; direct finger tracking
  remains, but post-release momentum must be skipped.
- Do NOT modify `DESIGN.md`; its current uncommitted change is outside this
  plan.
- If `public/search-combobox.js:200-214` no longer contains the manual touch
  fallback stamped at `dbd7165`, STOP and report drift instead of improvising.

## Verification

- **Mechanical**:
  - `npm run build` exits 0.
  - `npm run test:profile-combobox` reaches and passes the class/topic touch
    momentum assertions. If an unrelated existing animation timing assertion
    flakes later in the shared script, rerun once and report the exact unrelated
    assertion separately.
  - `npm test` exits 0. The known rate-limit assertion may occasionally observe
    `Retry-After: 59` instead of exact `60`; do not change security code as part
    of this plan.
  - `git diff --check` exits 0.
- **Feel check**:
  - On real iOS Safari and Android Chrome at `320×568` and `390×844`, open the
    topic dropdown and make a short, slow drag: the list follows the finger and
    settles quickly without a visible jump.
  - Make a fast flick: the list continues in the release direction, decelerates
    smoothly, and stops within `900ms`.
  - Flick, then touch the list again before it settles: momentum stops on contact
    and the list follows the new finger position immediately.
  - Flick into the first or last option: scrolling stops at the boundary with no
    bounce, blank gap, or accidental option selection.
  - Repeat with the class dropdown using enough mocked/deployed classes to
    overflow; three visible classes alone correctly produce no momentum because
    there is no scroll range.
  - Enable reduced motion: the list follows the finger but stops exactly on
    release.
  - In Chrome DevTools Performance, record a flick and confirm at most one
    `scrollTop` write per animation frame and no layout or paint work caused by
    option transforms.
- **Done when**: both dropdowns retain reliable finger scrolling, fast flicks
  carry release velocity with bounded deceleration, new touches interrupt
  momentum without jumping, reduced motion stops on release, and all existing
  selection/filter/keyboard behavior remains unchanged.
