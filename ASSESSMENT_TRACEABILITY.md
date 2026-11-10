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
| Report totals must come from real Playwright execution and must not be hardcoded. | The configured reporter consumes the Playwright root suite. Latest `reports/parabank-report.html` records 128 tests: 125 passed, 0 failed, 3 skipped; run status Passed. | Complete and verified |
| Phase 2A registration, login, checking-account creation/details, and loan workflow. | `tests/ui/phase2a-registration-loan.spec.ts`, `tests/ui/phase2aWorkflow.ts`, `pages/registerPage.ts`, and `test-data/userFactory.ts`. Username generation has per-run/worker/sequence components plus 48 random bits, and unit tests cover uniqueness and length. Latest live run made 3 POST submissions; each returned HTTP 200 with `This username already exists.` | Registration implementation verified; live workflow blocked |
| Phase 2A loan behavior must respect the existing provider and not assume approval. | The test reads the provider without changing it, requires explicit loan authorization, and handles both Approved and Denied results. Registration failed and loan authorization is disabled, so the loan path was not reached. | Implemented, not verified; blocked |
| Phase 2B transfer `$150.00`, `$25.50`, and `$8.99`, validate balances, and reconcile transaction history. | `tests/ui/phase2b-funds-transfer.spec.ts`, page objects, and `utils/money.ts` use exact cents. Reconciliation now searches each individual amount and sums observed transaction rows; `tests/ui/phase2b-offline.spec.ts` verifies source/destination selection and all three exact amounts. Live transfers remain disabled. | Offline behavior verified; live flow blocked |
| Phase 2B Find Transactions and positive/negative validation. | `pages/findTransactionsPage.ts` supports transaction ID, date, and amount queries. Offline tests verify extraction of transaction IDs and amounts (-15000, -2550, -899 cents), and the sum of absolute values equals 18449 cents. | Offline behavior verified; live history not verified |
| Phase 2C: create a new user through documented REST API. | `api/openapi.yaml` contains no customer-create or register operation. `POST /customers/update/{customerId}` is update-only and cannot satisfy user creation. The existing four API tests use read-only operations and the public sample account. | Blocked: unsupported by documented API |
| Phase 2C: deposit funds, then verify the user's transactions. | The documented `POST /deposit` is implemented as an explicitly opt-in, exact-account-allowlisted method in `api/parabankApiClient.ts`; config defaults to disabled. Three stubbed tests validate denial by default, allowlist enforcement, and exact 184.49 amount serialization. No authorized account was supplied, so no live deposit or post-deposit transaction verification was performed. | Guarded client verified offline; live sequence not verified |
| Phase 3 documents engineering decisions, architecture trade-offs, safety, and evidence limitations. | `DECISIONS.md` records integer-cent arithmetic, shared state, read-only API scope, reporting, and security choices. This traceability matrix and the final/execution reports complete the submission documentation. | Complete and verified |
| Shared ParaBank safety: no `cleanDB`, `initializeDB`, global setting changes, or unauthorized transfers. | Reset and write paths remain guarded. No destructive operation or financial transfer was run during this audit. | Complete and verified |
| Security: no real credentials or raw sensitive artifacts in tracked files; `.env.example` is placeholder-only. | `.gitignore` excludes `.env` and artifacts; `git ls-files` reports no `.env` or `.env.*` file other than the allowed example. | Complete and verified |

## Remaining blockers

- Phase 2A registration is blocked by the shared public application rejecting the latest three generated usernames as duplicates. Login, checking-account creation, and loan execution therefore remain unverified.
- Phase 2B execution is blocked because no authorized transfer account credentials were supplied. The transfer business assertions are implemented, but actual balance changes and transaction records are unverified.
- Full Scenario C parity cannot be completed through documented REST: the contract has no user-creation endpoint. The deposit operation mutates an account and remains disabled without an explicitly authorized account ID; therefore there is no safe new-user/deposit/history workflow to execute.
- The assessment PDF was unavailable, so traceability is limited to the explicit assessment criteria preserved in the conversation record.
