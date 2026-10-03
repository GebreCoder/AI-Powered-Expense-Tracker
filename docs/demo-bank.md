# Demo Bank Connections (simulation only)

A production-style **simulated banking integration** for the Expense Tracker.
Users connect a fictional bank account with a 13-digit account number and a
simulated OTP, then watch real-time transaction history, balances, budgets,
and insights update automatically.

> ⚠️ **This is a simulation.** It never connects to a real bank, never asks for
> real credentials, and never moves real money. The whole feature is clearly
> labelled "Demo / Simulation" in the UI and is isolated behind a fictional
> provider so a real banking integration could be added later without
> rewriting the app's financial logic.

---

## 1. Architecture

```
Expense Tracker (React frontend)
        │  REST + SSE (Server-Sent Events)
        ▼
Express backend ── /api/bank/* ──► BankProvider  (interface / registry)
                                       │
                              ┌────────▼────────┐
                              │ DemoBankProvider │  ← first implementation
                              │   (simulator)    │
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │ Demo Bank Ledger │  ← in-memory "bank core"
                              │ (balance + posts)│     seeded from
                              └─────────────────┘     seed/demoBanks.js
```

The rest of the application (sync pipeline, categorization, budgets, insights,
realtime events, frontend) talks to `BankProvider` — never to the demo
provider directly.

```
backend/src/services/bank/
├── bankProvider.js              → interface docs + provider registry (getProvider)
├── demoBankProvider.js          → DemoBankProvider (simulated "bank API")
├── demoBankLedger.js            → in-memory ledger (opening balances + live posts)
├── bankConfig.js                → DEMO_BANK_* environment configuration
├── accountNumber.js             → 13-digit demo checksum validation
├── otpStore.js                  → hashed, expiring, attempt-limited OTPs
├── categorizer.js               → provider category → user category (auto-create)
├── bankSyncService.js           → the sync pipeline (dedup, normalize, insert)
├── simulatedTransactions.js     → controlled fictional transaction generator
├── realtimeBus.js               → per-user pub/sub (backs the SSE stream)
├── simulator.js                 → background generator (configurable interval)
└── seed/demoBanks.js            → fictional banks, accounts (clean, no history)
```

## 2. Database tables

New tables (migration: `backend/src/migrations/bank_schema.sql`,
also included in `initial_schema.sql` for fresh setups):

| Table             | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `bank_connections` | One linked bank per user (`provider`, `institution_name`, `status`: `pending_otp` → `connected`; disconnecting deletes the row), `external_connection_id`, `last_synced_at`) |
| `bank_accounts`   | Linked accounts (`external_account_id`, masked number, type, currency, balances) |

The existing `transactions` table is extended (no duplicate transaction
system):

| Column                    | Meaning                                              |
| ------------------------- | ---------------------------------------------------- |
| `source`                  | `'manual'` (user-typed) or `'bank'` (imported)       |
| `external_transaction_id` | provider's stable id — **the dedup key**             |
| `bank_account_id`         | FK → `bank_accounts` (NULL after account removal)    |

```sql
CONSTRAINT transactions_user_external_unique UNIQUE (user_id, external_transaction_id)
```

Disconnect removes **everything related to that bank**: the controller
deletes the imported transactions first (while their `bank_account_id` link
still exists), then deletes the connection — `bank_accounts` cascade with it.
Nothing related to that bank is left behind.

## 3. Provider interface

`backend/src/services/bank/bankProvider.js` documents the contract. Every
provider implements:

```text
listInstitutions()                              -> [{ id, name }]
listAvailableAccounts(institutionId?)           -> [{ accountNumber, ... }]
validateAccount(accountNumber)                  -> { valid, error?, account? }
linkAccount(accountNumber)                      -> { externalConnectionId, account }
getAccounts(connection)                         -> [{ externalAccountId, ... }]
getTransactions(externalAccountId)              -> [{ externalId, merchantName,
                                                      description, amount, type,
                                                      category, transactionDate,
                                                      status, currency }]
getBalance(externalAccountId)                   -> number
postTransaction(externalAccountId, input)       -> ledger entry
disconnectAccount(externalConnectionId)         -> void
```

Two rules make sync safe:

1. `externalId` must be **stable forever** for the same bank transaction
   (dedup depends on it).
2. `type` is `'expense' | 'income'` and `amount` is always positive.

## 4. Demo provider

`demoBankProvider.js` fronts the **Demo Bank Ledger** — an in-memory bank
core seeded from `seed/demoBanks.js`. Accounts start **clean** (an opening
balance, no transaction history) and every transaction is created live:

```text
opening balance + live posts = current balance
```

* Live posts (Simulate buttons, demo sequence, background simulator) carry
timestamped ids → the app-side dedup stays idempotent across syncs.
* A server restart resets the *live* part of the ledger (balances return to
the seeded opening values). Documented demo tradeoff — no real data is
affected.

### Account numbers

Exactly 13 digits: 12-digit identifier + 1 **check digit** using the repeating
weights `[7, 3, 1]` (`check = (10 − Σ digit·weight mod 10) mod 10`). This is a
**fictional "Demo Account Validation"** — never presented as a real banking
scheme. Seeded accounts (e.g. `1234567890128`, `9876543210982`,
`4567890123456`) all pass.

### Simulated OTP

`otpStore.js`: random 6-digit code, stored **hashed** (sha256 + per-session
salt), expires after 5 minutes, max 5 attempts, deleted on success — never
persisted or logged. In dev mode (`DEMO_BANK_DEV_MODE=true`) the code is
returned in the API response so a presenter can complete the flow without
reading logs.

## 5. Synchronization flow

`bankSyncService.js` — provider-agnostic:

```text
Demo Bank → fetch transactions → validate → deduplicate → normalize →
categorize (auto-create user category) → insert into transactions
(source='bank') → update account balance → budget spend alerts →
invalidate insights → publish realtime event
```

Triggered by: account verification (initial import), the **Sync Now** button,
the manual **Simulate expense/income** buttons, and the background simulator.

### Budget spend alerts

Every imported expense checks its category's budgets (`budgetAlerts.js`). If
the spend crosses the warn threshold (default 80%) — or hits 100% — a
`budget.alert` SSE event is published once and the crossed level is persisted
on the budget (`last_alert_at_pct`), so later transactions in an already-
crossed budget stay silent. If the budget is raised again (spend falls below
the warn line), the alert state resets and the cycle can fire again.

## 6. Deduplication

Enforced twice:

1. `ON CONFLICT (user_id, external_transaction_id) DO NOTHING` on insert.
2. The `UNIQUE` constraint at the database level.

Running sync 1, 2, or 20 times imports each bank transaction exactly once.
Only genuinely new transactions are inserted.

## 7. Realtime events

No WebSocket library is needed — the Express server streams **Server-Sent
Events** at `GET /api/bank/events` (auth via Bearer header, per-user pub/sub
in `realtimeBus.js`).

```text
POST /api/bank/accounts/:id/simulate      → simulator posts → sync →
SSE event → toast "New transaction received" → pages refresh instantly
```

Events: `transaction.created` (toast + refresh), `budget.alert` (warning
toast + badge on the Budgets nav item), and `connection.synced` (refresh).
Open pages listen for `spendwise:data-changed` on `window` and silently
re-fetch. The existing 30s polling remains as a fallback.

## 8. Environment variables (`backend/.env`)

| Variable                          | Default             | Meaning                                       |
| --------------------------------- | ------------------- | --------------------------------------------- |
| `DEMO_BANK_ENABLED`               | dev: `true`, prod: `false` | Master switch for the whole feature (backend-enforced) |
| `DEMO_BANK_SIMULATION_ENABLED`    | dev: `true`, prod: `false` | Background transaction generator |
| `DEMO_BANK_TRANSACTION_INTERVAL`  | `180`               | Seconds between simulated transactions (min 30) |
| `DEMO_BANK_DEV_MODE`              | dev: `true`         | Reveals the simulated OTP in the API response |
| `DEMO_BANK_BUDGET_ALERT_THRESHOLD` | `80`              | % of a category budget that triggers a spend-alert toast (50–99) |

When `DEMO_BANK_ENABLED=false` the `/api/bank/*` routes are not mounted (404)
and the UI shows a "disabled" state. The frontend never controls simulation —
the backend enforces it.

## 9. Seed data

`seed/demoBanks.js` — three institutions styled after Ethiopian banks
(**Anbessa Bank**, **Commercial Bank of Ethiopia** (CBE), **Dashen Bank**)
with six accounts (currency **ETB**) that start **clean**: an opening balance
and **no pre-seeded transactions**. The user controls everything from there
(manual entries, **Simulate expense/income**, the **Run demo sequence**
button, or the background simulator, whose Ethiopian-flavored merchants are
in `simulatedTransactions.js`). Institution names are for demonstration only
— all account numbers and balances are fictional, and the feature never
connects to a real bank. Edit this one file to change the demo universe. New
users default to ETB (Settings → Preferences can change it);
`currency_etb.sql` sets that default on an existing database.

## 10. Running the demo

```bash
# 1) One-time database setup (fresh DB) — or for an existing DB:
cd backend
npm run db:setup          # fresh install (wipes & recreates all tables)
#   existing DB instead:  node migrate.js bank_schema.sql

# 2) Start backend + frontend
cd backend  && npm run dev      # :3000
cd frontend && npm run dev      # :5173

# 3) In the app: sign in → "Bank accounts" → Connect bank →
#    pick Anbessa Bank → use account 1234567890128 (or any seeded account)
#    → enter the dev-mode OTP shown in the dialog → Done.
```

Then watch the dashboard: the simulator posts a fictional transaction every
`DEMO_BANK_TRANSACTION_INTERVAL` seconds (or click **Simulate expense /
income / Sync now** on the Bank accounts page) and the UI updates live.

For a presentation, click **Run demo sequence** on the Bank accounts page: a
scripted set of expenses followed by an income lands one at a time (~2.5s
apart), each firing the full realtime flow (toast → balance → budget alerts
→ charts) so you can narrate while it happens.

To see a budget alert, create a small budget for a category the simulator
uses (e.g. **Food & Dining**) — the next simulated expense that pushes it past
80% shows a warning toast and a badge on the **Budgets** nav item.

## 11. Adding a real provider later

1. Create `backend/src/services/bank/plaidBankProvider.js` implementing the
   same interface (section 3).
2. Register it in `bankProvider.js` (`PROVIDERS.set("plaid", plaidProvider)`).
3. Point the connect flow at it — the sync pipeline, categorization, budgets,
   insights, realtime events, and frontend views are unchanged.

## 12. API reference

All routes require `Authorization: Bearer <token>`.

| Method | Route                          | Purpose                                   |
| ------ | ------------------------------ | ----------------------------------------- |
| GET    | `/api/bank/config`             | Feature flags for the UI                  |
| GET    | `/api/bank/providers`          | Providers + their institutions            |
| GET    | `/api/bank/demo/accounts`      | Seeded demo accounts (discovery)          |
| POST   | `/api/bank/connections`        | Start connect (validates account, sends OTP) |
| POST   | `/api/bank/connections/:id/verify` | Verify OTP → link account → initial sync |
| GET    | `/api/bank/connections`        | User's connections + accounts             |
| DELETE | `/api/bank/connections/:id`    | Disconnect — removes the connection and ALL its imported transactions |
| GET    | `/api/bank/accounts`           | User's bank accounts                      |
| POST   | `/api/bank/accounts/:id/sync`  | Manual sync                               |
| POST   | `/api/bank/accounts/:id/simulate` | Simulate a transaction (`type: expense|income`) |
| POST   | `/api/bank/accounts/:id/demo`  | Scripted presenter sequence (3 expenses + 1 income, ~2.5s apart, each firing realtime events) |
| GET    | `/api/bank/events`             | SSE stream (realtime)                     |

Every endpoint authenticates, authorizes ownership, validates input, and
returns safe errors — a user can never read or modify another user's bank
data by changing an id in the URL.

## 13. Tests

`backend/test/bank*.test.js` — runs with `npm test` (no database needed):
account-number validation & checksum, seeded-account validity, clean-start
ledger + live posts, OTP lifecycle (correct / wrong /
expired / attempt-limited / cross-user), sync normalization, simulated
generators, and route auth gating.
