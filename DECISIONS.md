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

Phase 2C uses the documented ParaBank OpenAPI public endpoints and a reusable API client that validates the XML responses
with Zod schemas. The API layer is intentionally read-only and uses the public `john/demo` credentials from the documented
examples. The tests verify customer lookup, customer-account retrieval, account metadata, transaction history, and amount-based
search consistency without calling any reset or write operation.

## Phase 3: safe reporting and security guardrails

The final assessment documentation and report delivery remain intentionally conservative. The repository keeps the public
sandbox safe by default:

- no `cleanDB` or `initializeDB` calls are made in the automated workflow
- no write operations are executed without an explicit, authorized environment and account
- raw traces and videos remain off unless `PARABANK_RETAIN_RAW_ARTIFACTS=true` is used in a private, approved context
- credentials are not committed; `.env` is ignored and `.env.example` is the template source
- the HTML report is generated from actual execution and remains the canonical evidence artifact for the run

## Evidence and credentials

The custom reporter and logger redact credentials and sensitive fields. Raw Playwright videos and traces are disabled
by default because they can contain request payloads. No live account credentials or raw artifacts are committed.

## Local execution results (2026-11-10)

The latest report-producing run selected only safe unit, reporter UI, and read-only API projects and retained the project-configured HTML reporter:

- `npx playwright test --project=unit --project=reporter-ui --project=api` → 118 total, 118 passed, 0 failed, 0 skipped (16.1 seconds in the HTML report)
- Breakdown: 103 unit, 11 reporter UI, and 4 API tests.
- `npm run typecheck` and `npm run lint` → success in prior final verification.
- The separate safe Phase 2B gate run with transfer and reset authorization disabled → 2 skipped.

The HTML report is ignored by Git because it is generated evidence and may contain runtime data. Its current local copy is the canonical result for the run above. The live Phase 2A registration path remains blocked by duplicate-username responses; the live Phase 2B write path remains blocked until an authorized account and credentials are supplied. No destructive reset or financial transaction was performed.
