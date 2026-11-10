# Test Execution Summary

## Latest HTML report run

- Date: 2026-11-10
- Command: `npx playwright test --project=unit --project=reporter-ui --project=api`
- Reporter: project-configured custom reporter from `playwright.config.ts` (no CLI reporter override)
- Report: `reports/parabank-report.html`
- Duration recorded by report: 16.1 seconds
- Result recorded by report: **118 total; 118 passed; 0 failed; 0 skipped; 100% pass rate**

| Project | Tests | Result |
|---|---:|---|
| Unit | 103 | Passed |
| Reporter UI | 11 | Passed |
| API | 4 | Passed |
| **Total in HTML report** | **118** | **118 passed** |

The suite above excludes the `ui` project. Its test cases are not included in the 118-test total.

## Other verified checks

| Check | Evidence | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | Passed in prior final verification |
| ESLint | `npm run lint` | Passed in prior final verification |
| Phase 2B safety gate | Transfer UI project with transfer/reset authorization disabled | 2 skipped; no transfer executed |
| Phase 2A live registration | Public shared ParaBank registration attempts using distinct usernames | Blocked: server response reported `This username already exists.` |

The Phase 2A registration result is not a successful registration. Login, account creation, and loan workflow were not verified after that blocker. Phase 2B transfer behavior was not exercised because no authorized transfer credentials were available.

## Report provenance note

Passing `--reporter=line` on the Playwright CLI replaces the reporter configured in `playwright.config.ts`; it prevents the custom HTML reporter from refreshing the HTML artifact. The latest report above was produced without that override and contains actual test records rather than hardcoded totals.
