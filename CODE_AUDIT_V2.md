# Code Audit v2 — Plan

Supersedes the first draft on `codex/auditv2` (`f7363ec`). Results live in
`CODE_AUDIT_V2_REPORT.md`.

## Goal

Find everything broken in the app, with special focus on its **implicit state
machines**, and fix what can be fixed safely. Every change must improve at
least one of these and regress none:

- **UX** — facilitators on a phone, on bad networks, mid-session.
- **DX** — a maintainer can read, test, and change the flow with confidence.
- **AX** — an agent can find the flow, its states, and its contract from the
  code and docs alone, without guessing.

## Baseline

1. Work from `dev` (`main` plus the dependency fixes in PR #36). Do not touch
   `supabase/` or the deleted `CLAUDE.md`.
2. Record commit, `package.json` version, Node version.
3. Baseline checks must be green before any change:
   `npm run build`, `npm run lint`, `npm test`, `npm audit`.
   There is no typecheck step (plain JavaScript); `npm run build` runs
   `node --check` on every source file instead.

## Method

### 1. Map the state machines

For each flow, write down states, where each state is encoded (variables,
DOM classes, `localStorage`, cookies, Sheet columns), and every transition with
`file:line`. Flows in scope:

| Area | Machines |
| --- | --- |
| Auth & routing | session (anon → login → authed → expired → logged out), route guard, onboarding, theme |
| Scanning | camera lifecycle, scan pipeline (detect → cooldown → submit → outcome → resume), scan history, class/topic selection |
| Apps Script | attendance rules, cache freshness, concurrent writes |
| Profiles | roster load/cache, selected student, combobox, photo, upload, WhatsApp handoff |

### 2. Attack each machine

For every machine, check:

- **Unreachable or unhandled states** (an outcome with no UI, a spinner that never stops).
- **Missing transitions** (no way back from error; no reset on logout).
- **Races**: double submit, stale response after the user moved on, token
  expiry mid-request, tab hidden mid-request, two tabs, bfcache restore.
- **Network**: offline, timeout, 4xx vs 5xx vs malformed body.
- **Contract drift** between frontend ⇄ `api/` ⇄ `apps-script/Code.js`
  (field names, status codes, error shapes, ID and date formats).
- **Security invariants** from `AGENTS.md` (JWT server-side, private bucket,
  no phone numbers in roster payloads, generic client errors).

### 3. Classify

Each finding gets: id, severity, confidence, `file:line`, reproduction or code
trace, impact, smallest safe fix.

| Severity | Meaning |
| --- | --- |
| P0 | Data loss, security hole, or outage |
| P1 | Wrong attendance data, or a facilitator gets stuck |
| P2 | Degraded UX/reliability with a workaround |
| P3 | Hygiene, DX, AX, docs |

Confidence is **confirmed** (traced or reproduced), **likely**, or
**speculative**. Only confirmed findings get fixed without asking.

Group results as: confirmed bugs · conditional risks · cleanup candidates.

## Fix rules

- Smallest change that closes the bug. No stack, schema, route, payload,
  storage-key, or Sheet changes.
- Each fix gets a regression test where the code is testable in Node.
- Make implicit states explicit only where it removes a bug, and name them so
  an agent can grep for them.
- Apps Script changes are written and unit-tested only; deployment
  (`clasp push`) is the owner's call.
- Never weaken auth, never write production data, never deploy.

## Definition of done

- Build, lint, tests, and audit green; new tests for each fixed bug.
- Report lists every finding with its status: fixed, deferred (with reason),
  or rejected (with evidence).
- Docs touched by a fix are updated in the same change.
