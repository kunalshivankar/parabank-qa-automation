# Test Execution Summary

## Latest HTML report run

- Date: 2026-11-10
- Command: `npx playwright test --project=unit --project=reporter-ui --project=api --project=ui --grep-invert "automatic registration, login, and checking account workflow|manual registration, login, and checking account workflow|loan workflow uses the existing authorized provider only"`
- Reporter: project-configured custom reporter from `playwright.config.ts` (no CLI reporter override)
- Report: `reports/parabank-report.html`
- Duration recorded by report: 20.1 seconds
- Result recorded by report: **128 total; 125 passed; 0 failed; 3 skipped; 100% pass rate among executed tests**

| Project | Tests | Result |
|---|---:|---|
| Unit | 107 | Passed |
| Reporter UI | 11 | Passed |
| API | 4 | Passed |
| Offline UI | 3 | Passed |
| Guarded reset/transfer UI | 3 | Skipped |
| **Total in HTML report** | **128** | **125 passed, 3 skipped** |

The final safe suite excludes only the three live Phase 2A registration/loan scenarios. Global reset and transfer flags were false; their guarded tests were selected and reported as skipped, not passed.

## Other verified checks

| Check | Evidence | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | Passed after final code changes |
| ESLint | `npm run lint` | Passed after final code changes |
| Offline UI coverage | `tests/ui/phase2b-offline.spec.ts` | 3 passed; no ParaBank requests were made |
| Deposit guard | `tests/unit/apiClient.spec.ts` | 3 passed with a stubbed request; no deposit was sent |
| Phase 2A live registration | `tests/ui/phase2a-registration-loan.spec.ts` | 1 failed, 2 skipped; the submitted registration response was HTTP 200 with `This username already exists.` |
| Live API parity | `api/openapi.yaml` and `tests/api/phase2c-api.spec.ts` | Not verified: no documented user-create endpoint; no authorized account for a deposit |

The Phase 2A registration result is not a successful registration. Login, account creation, and loan workflow were not verified after that blocker. Phase 2B live transfers were not executed because no authorized transfer account was available. The read-only API tests passed, but they do not satisfy the separate create-user/deposit/history workflow.

## Report provenance note

Passing `--reporter=line` on the Playwright CLI replaces the reporter configured in `playwright.config.ts`; it prevents the custom HTML reporter from refreshing the HTML artifact. The latest report above was produced without that override and contains actual test records rather than hardcoded totals.
