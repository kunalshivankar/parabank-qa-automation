# Architecture decisions

## Phase 2B: currency precision

All displayed currency values are converted to integer cents by `utils/money.ts`. The transfer amounts are therefore
`15000`, `2550`, and `899` cents, and totals are calculated with safe-integer addition rather than JavaScript
floating-point arithmetic.

## Phase 2B: shared account state

Funds-transfer tests mutate balances and require an explicitly authorized account. They are gated by
`PARABANK_ALLOW_TRANSFER_WORKFLOW=true` plus `PARABANK_TRANSFER_USERNAME` and `PARABANK_TRANSFER_PASSWORD`.
The default is disabled. The tests never call `cleanDB` or `initializeDB`, never change global settings, and never
invent account IDs or transaction records.

## Phase 2B: transaction validation

The workflow reads the source and destination balances before and after transfers, parses transaction-history table
amounts into cents, and reconciles the expected total. Search methods are kept in the Find Transactions page object
for the application-supported transaction ID, date, and amount paths; live verification remains blocked until an
authorized account is provided.

## Phase 2C: API contract validation

The API test project uses documented ParaBank OpenAPI reads and a reusable client that validates customer, account, and
transaction XML with Zod schemas. The assessment also requires deposits, so the client exposes the documented `POST /deposit`
behind `PARABANK_ALLOW_API_DEPOSIT=true` and an exact `PARABANK_API_DEPOSIT_ACCOUNT_ID` allowlist. The flag defaults to false;
tests use a stub and no real deposit has been made. The OpenAPI defines no customer-create/register operation, so the required
create-user/deposit/history sequence cannot be fulfilled using documented REST endpoints alone.

## Phase 3: safe reporting and security guardrails

The final assessment documentation and report delivery remain intentionally conservative. The repository keeps the public
sandbox safe by default:

- no `cleanDB` or `initializeDB` calls are made in the automated workflow
- no write operations are executed without an explicit, authorized environment and exact account allowlist
- raw traces and videos remain off unless `PARABANK_RETAIN_RAW_ARTIFACTS=true` is used in a private, approved context
- credentials are not committed; `.env` is ignored and `.env.example` is the template source
- the HTML report is generated from actual execution and remains the canonical evidence artifact for the run

## Evidence and credentials

The custom reporter and logger redact credentials and sensitive fields. Raw Playwright videos and traces are disabled
by default because they can contain request payloads. No live account credentials or raw artifacts are committed.

## Local execution results (2026-11-10)

The latest report-producing run retained the project-configured HTML reporter, selected all safe unit/reporter/API and UI tests, and explicitly excluded only the live Phase 2A registration/loan cases:

- Latest report: 128 test records, 125 passed, 0 failed, 3 skipped (20.1 seconds); skip count is reported separately from passes.
- Breakdown: 107 unit, 11 reporter UI, 4 read-only API, and 3 offline UI passed; reset and 2 live transfer cases skipped with authorization disabled.
- `npm run typecheck` and `npm run lint` → success after the final code changes.
- Offline API deposit guard: 3 unit tests passed; the API request was stubbed and no deposit was sent.
- Latest live Phase 2A attempt: 3 distinct registration submissions, each HTTP 200 with the duplicate-username message; login/account/loan were not reached.

The HTML report is ignored by Git because it is generated evidence and may contain runtime data. Its current local copy is the canonical result for the run above. Scenario B live execution remains blocked until an authorized account is supplied. Scenario C remains incomplete because no documented API user-creation operation exists and no account is authorized for a live deposit. No destructive reset or financial transaction was performed.
