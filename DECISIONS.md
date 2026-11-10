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

The workspace was validation-tested with the project’s safe defaults and the current repository state:

- `npm run typecheck` → success
- `npm run lint` → success
- `npx playwright test --project=unit --reporter=line` → `103 passed (2.6s)`
- `npx playwright test --project=reporter-ui --reporter=line` → browser reporter checks completed without failures
- `npx playwright test --project=api --reporter=line` → `4 passed (4.4s)`
- `npx playwright test --project=ui tests/ui/phase2b-funds-transfer.spec.ts --reporter=line` with
  `PARABANK_ALLOW_TRANSFER_WORKFLOW=false` and `PARABANK_ALLOW_GLOBAL_RESET=false` → `2 skipped`

This records the correct assessment status: the public API and the guarded UI paths are verified, and the live write path
remains blocked until an explicitly authorized account and credentials are supplied.
