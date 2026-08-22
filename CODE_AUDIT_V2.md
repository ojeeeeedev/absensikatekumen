# Audit Latest `main`

## Execution order

1. Verify the current branch, tracked changes, remote, and untracked `supabase/` metadata.
2. Switch to `main` if needed and run `git pull --ff-only origin main`.
3. Stop without changing files if the pull cannot fast-forward or conflicts with existing work.
4. Confirm the resulting commit and version.
5. Run the full repository audit against the updated `main`.

## Audit scope

- Authentication, session expiry, logout, scan queue, profile loading, uploads, photos, routing, and error handling.
- Vercel APIs, Apps Script contracts, Sheet row mapping, Supabase storage, caching, and local/Vercel differences.
- Bugs, inconsistencies, redundancies, dead code, unnecessary downloads, unbounded inputs, N+1 operations, dependency issues, and documentation drift.
- Findings ranked by security, data loss, data integrity, reliability, performance, and maintainability impact.

## Report and verification

Include exact file and line references, severity, confidence, reproduction evidence, impact, and the smallest safe fix direction.

Separate:

- Confirmed bugs
- Conditional risks
- Cleanup candidates

Run tests, lint, typecheck, build, dependency checks, and available browser checks.

Do not deploy, write production data, run `clasp push`, or modify `supabase/`.

## Branch rule

This audit is read-only, so no branch is needed. If implementation is requested after the audit, create `codex/optimize-run2` from the freshly pulled `main` before making code changes.

## Assumptions

- Preserve all existing tracked and untracked user work.
- Do not use reset, checkout-overwrite, stash, or deletion to force the pull.
- `origin/main` is the source of truth for this audit.
