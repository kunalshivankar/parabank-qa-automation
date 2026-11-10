# Assessment Traceability

## Source and status key

This matrix is based on the original assessment requirements provided in the project conversation. No original assessment PDF was found in the workspace. Statuses distinguish implementation from live application verification.

- **Complete and verified**: the requirement has implementation and supporting execution evidence.
- **Implemented, not verified**: the implementation exists, but its live behavior was not verified.
- **Blocked**: safe verification depends on shared-environment behavior or explicit authorization that is unavailable.

## Requirements matrix

| Assessment requirement | Implementation and evidence | Status |
|---|---|---|
| Use the existing Playwright + TypeScript framework, fixtures, typed config, and Page Object Model. | Existing `playwright.config.ts`, `fixtures/`, `config/`, and `pages/` structure; typecheck passed. | Complete and verified |
| Phase 1 reporting: custom HTML report, run/test detail, status views, diagnostics, attachments, and reporter tests. | `reporters/glassReporter.ts`, `reporters/template.ts`, and `tests/reporter/glassReport.spec.ts`; 11 reporter UI tests passed. | Complete and verified |
| Report totals must come from real Playwright execution and must not be hardcoded. | The configured reporter consumes the Playwright root suite. Latest `reports/parabank-report.html` records 118 tests, 118 passed, 0 failed, 0 skipped, and a passed run. | Complete and verified |
| Phase 2A registration, login, checking-account creation/details, and loan workflow. | UI flows and safety gates exist in `tests/ui/phase2a-registration-loan.spec.ts` and `tests/ui/phase2aWorkflow.ts`. Four distinct registration usernames were previously rejected by the public application with `This username already exists.` | Implemented; live flow blocked |
| Phase 2A loan behavior must respect the existing provider and not assume approval. | The test reads the provider without changing it, requires explicit loan authorization, and handles both Approved and Denied results. Registration did not succeed, so the loan path was not reached. | Implemented, not verified; blocked by registration |
| Phase 2B transfer `$150.00`, `$25.50`, and `$8.99`, validate balances, and reconcile transaction history. | `tests/ui/phase2b-funds-transfer.spec.ts`, `pages/transferFundsPage.ts`, `pages/accountDetailsPage.ts`, and `utils/money.ts` implement these checks using integer cents. No authorized transfer account was supplied. | Implemented; live flow blocked |
| Phase 2B Find Transactions and positive/negative validation. | `pages/findTransactionsPage.ts` supports transaction ID, date, and amount queries; an empty-amount UI validation scenario is implemented. Live transaction behavior was not verified without authorized credentials. | Implemented, not verified |
| Phase 2C API automation uses documented ParaBank endpoints with response/XML/schema validation and safe consistency checks. | `api/parabankApiClient.ts`, `types/api.ts`, and `tests/api/phase2c-api.spec.ts` use documented read endpoints and Zod validation. The API project passed 4 tests against the public sample account. | Complete and verified |
| Phase 3 documents engineering decisions, architecture trade-offs, safety, and evidence limitations. | `DECISIONS.md` records integer-cent arithmetic, shared state, read-only API scope, reporting, and security choices. This traceability matrix and the final/execution reports complete the submission documentation. | Complete and verified |
| Shared ParaBank safety: no `cleanDB`, `initializeDB`, global setting changes, or unauthorized transfers. | Reset and write paths remain guarded. No destructive operation or financial transfer was run during this audit. | Complete and verified |
| Security: no real credentials or raw sensitive artifacts in tracked files; `.env.example` is placeholder-only. | `.gitignore` excludes `.env` and artifacts; `git ls-files` reports no `.env` or `.env.*` file other than the allowed example. | Complete and verified |

## Remaining blockers

- Phase 2A registration is blocked by the shared public application rejecting the attempted distinct usernames as duplicates. Login, checking-account creation, and loan execution therefore remain unverified.
- Phase 2B execution is blocked because no authorized transfer account credentials were supplied. The transfer business assertions are implemented, but actual balance changes and transaction records are unverified.
- The assessment PDF was unavailable, so traceability is limited to the explicit assessment criteria preserved in the conversation record.
