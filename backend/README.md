# Expense Tracker Backend

A production-style REST API for the Expense Tracker app — **Node.js + Express + PostgreSQL** with JWT authentication, AI-powered daily insights, and a simulated demo-bank integration. Every route is ready to test with **Postman** (a ready-made collection is included, and every example below is a valid `curl` command Postman can import).

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Getting started](#getting-started)
5. [API reference](#api-reference)
6. [Testing with Postman](#testing-with-postman)
7. [AI Insights](#ai-insights)
8. [Demo Bank connections](#demo-bank-connections)
9. [Rate limits & security](#rate-limits--security)
10. [Tests](#tests)
11. [Database migrations](#database-migrations)
12. [Troubleshooting](#troubleshooting)

---

## Features

- **Authentication** — register and sign in with a username + password, JWT tokens, session revocation, and account deletion
- **Categories** — CRUD with icons and colors
- **Transactions** — CRUD with type, category, and date-range filters
- **Budgets** — per-category spending limits with live progress (daily / weekly / monthly / yearly)
- **Dashboard** — balance summary, monthly income-vs-expense trend, spending-by-category breakdown
- **AI Insights** — personalized daily summaries and a conversational Q&A over the user's data (Google Gemini, with a deterministic rule-based fallback)
- **Demo Bank Connections** — a production-style *simulated* bank integration with 13-digit accounts, OTP verification, realtime sync, and a background simulator

## Tech stack

| Layer     | Technology |
| --------- | ---------- |
| Runtime   | Node.js, Express |
| Database  | PostgreSQL (`pg`) |
| Auth      | JWT (`jsonwebtoken`), bcrypt (`bcryptjs`), `express-rate-limit` |
| AI        | Google Gemini (plain `fetch`, optional — rule-based fallback built in) |
| Realtime  | Server-Sent Events (no WebSocket dependency) |

## Project structure

```
expense-tracker/
├── backend/                    ← you are here
│   ├── server.js               → entry point (starts the HTTP server)
│   ├── setup.js                → creates the database schema (tables)
│   ├── migrate.js              → applies a single migration file
│   ├── .env.example            → template for your local configuration
│   ├── .env                    → your local configuration (never commit this)
│   ├── expense-tracker.postman_collection.json → ready-made Postman tests
│   └── src/
│       ├── app.js              → Express app + route mounting + rate limits
│       ├── config/db.js        → single PostgreSQL connection pool
│       ├── controllers/        → business logic per resource
│       ├── middleware/auth.js  → JWT authentication middleware
│       ├── migrations/         → SQL schema + incremental migrations
│       ├── routes/             → API route definitions
│       └── services/
│           ├── insightsService.js → AI Insights (retrieve → generate → cache)
│           └── bank/             → Demo Bank simulation (provider, ledger, sync, simulator)
└── frontend/                   → React + Vite app (see frontend/README.md)
```

All backend commands below are run **from inside the `backend/` folder**:

```bash
cd backend
```

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Your `.env` file inside `backend/` is the single source of configuration — `src/config/db.js` reads `DATABASE_URL` from it, and `.env` values always take precedence over any environment variables. If you need to recreate it, copy the template and fill in your values:

```bash
cp .env.example .env
```

```env
PORT=3000
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/expense_tracker
JWT_SECRET=change_this_to_a_strong_secret
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

> **Important:** replace `YOUR_POSTGRES_PASSWORD` with the actual password of your PostgreSQL user. If you get `password authentication failed for user "postgres"`, the password in `DATABASE_URL` does not match your local PostgreSQL password.

### 3. Create the database (once)

Make sure the database exists and its name matches the one in `DATABASE_URL`:

```bash
psql -U postgres
CREATE DATABASE expense_tracker;
\q
```

### 4. Create the schema

Fresh database:

```bash
npm run db:setup
```

This runs `src/migrations/initial_schema.sql` and creates all tables.

> **Warning:** the schema starts with `DROP TABLE IF EXISTS` for every table — re-running `npm run db:setup` wipes **all** data. It is meant for first-time setup only.

**Already have an existing database?** Apply the incremental migrations instead (non-destructive, your data is kept). See [Database migrations](#database-migrations) for the full list:

```bash
npm run db:migrate user_settings.sql
npm run db:migrate currency_etb.sql
npm run db:migrate budget_period_daily.sql
npm run db:migrate daily_insights.sql
npm run db:migrate budget_alert_threshold.sql
npm run db:migrate bank_schema.sql
npm run db:migrate username.sql
```

(`npm run db:migrate` with no filename defaults to `daily_insights.sql`.)

### 5. Start the server

```bash
npm run dev          # development (auto-reload)
# or
npm start            # production
```

The API runs at **http://localhost:3000** (or whatever `PORT` is set to in `.env`).

### 6. Run the frontend (optional)

In a second terminal:

```bash
cd frontend
npm install
npm run dev          # opens the app on http://localhost:5173
```

Vite proxies `/api` requests to the backend at `http://localhost:3000`, so both servers must be running.

---

## API reference

### Base URL

```text
http://localhost:3000/api
```

### Authentication

Most endpoints require a JWT bearer token. Sign in (or register) to get one, then send it on every request:

```text
Authorization: Bearer <token>
```

Requests without a valid token return `401 Unauthorized`.

- Tokens expire after **7 days**.
- Changing your password or revoking sessions issues a **new token** and invalidates all previously issued ones.

### Conventions

- Request and response bodies are **JSON** (`Content-Type: application/json`).
- Dates use the format **`YYYY-MM-DD`**.
- Monetary values are returned as **strings** (PostgreSQL `NUMERIC`), e.g. `"45.50"`.
- Errors are returned with a non-2xx status and a JSON body: `{ "error": "message" }`.
- All IDs in URLs are the authenticated user's own resources — a user can never read or modify another user's data.

### Endpoint summary

#### Auth (rate-limited: 20 req / 15 min)

| Method | Route | Description |
| ------ | ----- | ----------- |
| POST | `/api/auth/register` | Create an account (public) |
| POST | `/api/auth/login` | Sign in with username + password (public) |
| GET | `/api/auth/profile` | Get the current user |
| PUT | `/api/auth/profile` | Update profile fields (name, username, email, avatar, currency) |
| PUT | `/api/auth/password` | Change password |
| POST | `/api/auth/revoke-sessions` | Invalidate all other sessions |
| DELETE | `/api/auth/account` | Permanently delete the account |

#### Categories

| Method | Route | Description |
| ------ | ----- | ----------- |
| POST | `/api/categories` | Create a category |
| GET | `/api/categories` | List categories |
| PUT | `/api/categories/:id` | Update a category |
| DELETE | `/api/categories/:id` | Delete a category |

#### Transactions

| Method | Route | Description |
| ------ | ----- | ----------- |
| POST | `/api/transactions` | Create a transaction |
| GET | `/api/transactions` | List transactions (with filters) |
| PUT | `/api/transactions/:id` | Update a transaction |
| DELETE | `/api/transactions/:id` | Delete a transaction |

#### Budgets

| Method | Route | Description |
| ------ | ----- | ----------- |
| POST | `/api/budgets` | Create a budget |
| GET | `/api/budgets` | List budgets (with spent totals) |
| PUT | `/api/budgets/:id` | Update a budget |
| DELETE | `/api/budgets/:id` | Delete a budget |

#### Dashboard

| Method | Route | Description |
| ------ | ----- | ----------- |
| GET | `/api/dashboard/summary` | Total income, expenses, net balance |
| GET | `/api/dashboard/monthly-trend` | Income vs expense per month |
| GET | `/api/dashboard/category-breakdown` | Expenses grouped by category |

#### AI Insights (rate-limited: 40 req / hour)

| Method | Route | Description |
| ------ | ----- | ----------- |
| GET | `/api/insights` | Daily personalized insights |
| POST | `/api/insights/ask` | Ask a question about your data |

#### Demo Bank (only when `DEMO_BANK_ENABLED=true`)

| Method | Route | Description |
| ------ | ----- | ----------- |
| GET | `/api/bank/config` | Feature flags |
| GET | `/api/bank/providers` | Providers and their institutions |
| GET | `/api/bank/demo/accounts` | Seeded demo accounts (discovery) |
| POST | `/api/bank/connections` | Start connecting an account (sends OTP) |
| POST | `/api/bank/connections/:id/verify` | Verify OTP → link account → initial sync |
| GET | `/api/bank/connections` | List connections with their accounts |
| DELETE | `/api/bank/connections/:id` | Disconnect (removes the connection and all its imported transactions) |
| GET | `/api/bank/accounts` | List bank accounts |
| POST | `/api/bank/accounts/:id/sync` | Manually sync an account |
| POST | `/api/bank/accounts/:id/simulate` | Simulate a transaction (`type: expense \| income`) |
| POST | `/api/bank/accounts/:id/demo` | Run the scripted presenter demo sequence |
| GET | `/api/bank/events` | Realtime stream (Server-Sent Events) |

---

### Authentication endpoints

#### Register user

`POST /api/auth/register` — *public*

Creates an account and returns a JWT token.

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `username` | string | ✅ | 3–20 characters: letters, numbers, `_ . -` (stored lowercase, case-insensitive) |
| `email` | string | ✅ | Must be unique |
| `password` | string | ✅ | At least 6 characters |
| `fullName` | string | ✅ | Display name |

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "user@example.com",
    "password": "123456",
    "fullName": "Test User"
  }'
```

**Response — `201 Created`**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "user@example.com",
    "full_name": "Test User",
    "created_at": "2026-08-17T09:30:00.000Z",
    "currency": "ETB",
    "avatar_color": null,
    "avatar_image": null
  }
}
```

#### Login

`POST /api/auth/login` — *public*

| Field | Type | Required |
| ----- | ---- | -------- |
| `username` | string | ✅ (case-insensitive) |
| `password` | string | ✅ |

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "username": "testuser", "password": "123456" }'
```

**Response — `200 OK`** — same shape as register (`token` + `user`). Wrong credentials return `401 Invalid credentials` (the API does not reveal whether the username or the password was wrong).

#### Get profile

`GET /api/auth/profile` — *authenticated*

```bash
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer <token>"
```

**Response — `200 OK`** — the `user` object (same shape as above).

#### Update profile

`PUT /api/auth/profile` — *authenticated*

Send only the fields you want to change. All fields are optional.

| Field | Type | Notes |
| ----- | ---- | ----- |
| `fullName` | string | Display name |
| `username` | string | Must be unique; requires `currentPassword` |
| `email` | string | Must be unique and valid; requires `currentPassword` |
| `currentPassword` | string | **Required** when changing `username` or `email` |
| `avatarColor` | string | Hex color, e.g. `"#10b981"` |
| `avatarImage` | string | Base64 data URL — `data:image/(jpeg\|png\|webp);base64,...`, max 5 MB |
| `currency` | string | One of: `USD, EUR, GBP, ETB, KES, NGN, ZAR, INR, JPY, CAD, AUD` |

```bash
curl -X PUT http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "fullName": "Test User Jr.", "currency": "USD" }'
```

**Response — `200 OK`** — `{ "user": { ... } }` with the updated values.

#### Change password

`PUT /api/auth/password` — *authenticated*

| Field | Type | Required |
| ----- | ---- | -------- |
| `currentPassword` | string | ✅ |
| `newPassword` | string | ✅ (at least 6 characters) |

```bash
curl -X PUT http://localhost:3000/api/auth/password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "currentPassword": "123456", "newPassword": "newpass123" }'
```

**Response — `200 OK`** — `{ "success": true, "token": "<new token>" }`. Use the new token from now on; all other sessions are invalidated.

#### Revoke sessions

`POST /api/auth/revoke-sessions` — *authenticated*

Invalidates every token issued before this call (all devices must sign in again). The current request receives a fresh token.

```bash
curl -X POST http://localhost:3000/api/auth/revoke-sessions \
  -H "Authorization: Bearer <token>"
```

**Response — `200 OK`** — `{ "token": "<new token>" }`

#### Delete account

`DELETE /api/auth/account` — *authenticated*

Permanently deletes the account and **all** related data (transactions, categories, budgets, bank connections — cascade).

| Field | Type | Required |
| ----- | ---- | -------- |
| `currentPassword` | string | ✅ |

```bash
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "currentPassword": "123456" }'
```

**Response — `200 OK`** — `{ "success": true }`

---

### Categories

#### Create category

`POST /api/categories` — *authenticated*

| Field | Type | Required |
| ----- | ---- | -------- |
| `name` | string | ✅ |
| `icon` | string | ❌ (lucide icon name) |
| `color` | string | ❌ (hex, e.g. `"#ff5733"`) |

```bash
curl -X POST http://localhost:3000/api/categories \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Food", "icon": "utensils", "color": "#ff5733" }'
```

**Response — `201 Created`**

```json
{
  "id": 1,
  "user_id": 1,
  "name": "Food",
  "icon": "utensils",
  "color": "#ff5733",
  "created_at": "2026-08-17T09:30:00.000Z"
}
```

#### List categories

`GET /api/categories` — *authenticated*

```bash
curl http://localhost:3000/api/categories -H "Authorization: Bearer <token>"
```

**Response — `200 OK`** — an array of category objects (newest first).

#### Update category

`PUT /api/categories/:id` — *authenticated*

Partial update — send only the fields to change (`name`, `icon`, `color`).

```bash
curl -X PUT http://localhost:3000/api/categories/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Groceries" }'
```

**Response — `200 OK`** — the updated category object. Unknown or foreign ids return `404 Category not found`.

#### Delete category

`DELETE /api/categories/:id` — *authenticated*

```bash
curl -X DELETE http://localhost:3000/api/categories/1 \
  -H "Authorization: Bearer <token>"
```

**Response — `200 OK`** — `{ "success": true }`. Existing transactions in this category keep their history but lose the category label.

---

### Transactions

#### Create transaction

`POST /api/transactions` — *authenticated*

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `type` | string | ✅ | `expense` or `income` |
| `amount` | number | ✅ | Must be greater than zero |
| `transactionDate` | string | ✅ | `YYYY-MM-DD` |
| `categoryId` | number | ❌ | Must belong to the authenticated user |
| `description` | string | ❌ | Free text |

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "expense",
    "amount": 45.5,
    "description": "Lunch",
    "categoryId": 1,
    "transactionDate": "2026-08-03"
  }'
```

**Response — `201 Created`**

```json
{
  "id": 12,
  "user_id": 1,
  "category_id": 1,
  "type": "expense",
  "amount": "45.50",
  "description": "Lunch",
  "transaction_date": "2026-08-03",
  "source": "manual",
  "external_transaction_id": null,
  "bank_account_id": null,
  "created_at": "2026-08-17T09:30:00.000Z"
}
```

> Creating, editing, or deleting a transaction automatically clears the cached insights, so the next dashboard load reflects your latest data.

#### List transactions

`GET /api/transactions` — *authenticated*

Optional query parameters:

| Param | Type | Description |
| ----- | ---- | ----------- |
| `type` | string | `expense` or `income` |
| `categoryId` | number | Filter by category |
| `startDate` | string | `YYYY-MM-DD` (inclusive) |
| `endDate` | string | `YYYY-MM-DD` (inclusive) |

```bash
curl "http://localhost:3000/api/transactions?type=expense&startDate=2026-08-01&endDate=2026-08-31" \
  -H "Authorization: Bearer <token>"
```

**Response — `200 OK`** — an array of transaction objects, each including `category_name` (from a `LEFT JOIN` with categories; `null` when uncategorized), newest first.

#### Update transaction

`PUT /api/transactions/:id` — *authenticated*

Partial update — send only the fields to change. To **clear** an optional field, send it as `null` (e.g. `"categoryId": null` or `"description": null`).

```bash
curl -X PUT http://localhost:3000/api/transactions/12 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "description": "Team lunch", "amount": 52.0 }'
```

**Response — `200 OK`** — the updated transaction object.

#### Delete transaction

`DELETE /api/transactions/:id` — *authenticated*

```bash
curl -X DELETE http://localhost:3000/api/transactions/12 \
  -H "Authorization: Bearer <token>"
```

**Response — `200 OK`** — `{ "success": true }`

---

### Budgets

#### Create budget

`POST /api/budgets` — *authenticated*

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `categoryId` | number | ✅ | Must belong to the authenticated user |
| `amount` | number | ✅ | Must be greater than zero |
| `startDate` | string | ✅ | `YYYY-MM-DD` |
| `period` | string | ❌ | `daily`, `weekly`, `monthly` (default), or `yearly` |
| `endDate` | string | ❌ | `YYYY-MM-DD` (optional limit) |

```bash
curl -X POST http://localhost:3000/api/budgets \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryId": 1,
    "amount": 500,
    "period": "monthly",
    "startDate": "2026-08-01",
    "endDate": "2026-08-31"
  }'
```

**Response — `201 Created`**

```json
{
  "id": 3,
  "user_id": 1,
  "category_id": 1,
  "amount": "500.00",
  "period": "monthly",
  "start_date": "2026-08-01",
  "end_date": "2026-08-31",
  "last_alert_at_pct": null,
  "created_at": "2026-08-17T09:30:00.000Z"
}
```

#### List budgets

`GET /api/budgets` — *authenticated*

```bash
curl http://localhost:3000/api/budgets -H "Authorization: Bearer <token>"
```

**Response — `200 OK`** — an array of budget objects, each with `category_name` and `spent` (total expenses in that category, so you can compute progress).

#### Update budget

`PUT /api/budgets/:id` — *authenticated*

Partial update — any of `categoryId`, `amount`, `period`, `startDate`, `endDate`.

```bash
curl -X PUT http://localhost:3000/api/budgets/3 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "amount": 650 }'
```

**Response — `200 OK`** — the updated budget object.

#### Delete budget

`DELETE /api/budgets/:id` — *authenticated*

```bash
curl -X DELETE http://localhost:3000/api/budgets/3 \
  -H "Authorization: Bearer <token>"
```

**Response — `200 OK`** — `{ "success": true }`

---

### Dashboard

All dashboard endpoints are *authenticated* and need no body.

#### Summary

`GET /api/dashboard/summary`

```bash
curl http://localhost:3000/api/dashboard/summary -H "Authorization: Bearer <token>"
```

**Response — `200 OK`**

```json
{
  "total_income": "1250.00",
  "total_expense": "830.50",
  "net_balance": "419.50"
}
```

#### Monthly trend

`GET /api/dashboard/monthly-trend`

**Response — `200 OK`**

```json
[
  { "month": "2026-06", "income": "900.00", "expense": "700.00" },
  { "month": "2026-07", "income": "1100.00", "expense": "950.00" }
]
```

#### Category breakdown

`GET /api/dashboard/category-breakdown`

**Response — `200 OK`** — expenses only, largest first:

```json
[
  { "category_name": "Food", "total_spent": "320.00" },
  { "category_name": "Transport", "total_spent": "140.00" }
]
```

---

### AI Insights

#### Get daily insights

`GET /api/insights` — *authenticated* (rate-limited: 40 req / hour)

Optional query parameters:

| Param | Type | Description |
| ----- | ---- | ----------- |
| `date` | string | `YYYY-MM-DD` — view a specific day (defaults to today) |
| `refresh` | string | `1` or `true` — force regeneration, ignoring the cache |

```bash
curl "http://localhost:3000/api/insights?refresh=1" \
  -H "Authorization: Bearer <token>"
```

**Response — `200 OK`**

```json
{
  "insights": [
    {
      "title": "Spending up 12% vs yesterday",
      "summary": "Today you earned 100.00 and spent 85.00 — a net of 15.00 kept.",
      "type": "summary"
    }
  ],
  "source": "ai",
  "date": "2026-08-17",
  "cached": false,
  "aiEnabled": true,
  "geminiError": null
}
```

- `source` is `"ai"` (Gemini), `"rules"` (deterministic fallback), or `"none"` (no data).
- Each insight has one of four types:

| Type      | Meaning                                        |
| --------- | ---------------------------------------------- |
| `summary` | The day at a glance (income, spending vs yesterday) |
| `anomaly` | An unusually large expense or category spike    |
| `budget`  | A budget over or close to its limit             |
| `tip`     | Actionable saving suggestions (week/month pacing) |

#### Ask a question

`POST /api/insights/ask` — *authenticated*

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `question` | string | ✅ | Max 500 characters |

```bash
curl -X POST http://localhost:3000/api/insights/ask \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "question": "How much did I spend on food this month?" }'
```

**Response — `200 OK`**

```json
{
  "question": "How much did I spend on food this month?",
  "answer": "You've spent 320.00 on Food this month...",
  "source": "ai",
  "aiEnabled": true,
  "geminiError": null
}
```

See [AI Insights](#ai-insights) below for how the pipeline works and how to configure Gemini.

---

### Demo Bank endpoints

All routes require `Authorization: Bearer <token>` and only exist when `DEMO_BANK_ENABLED=true` (otherwise they return `404`). The connect flow is additionally rate-limited (20 req / 15 min).

#### Get config

`GET /api/bank/config`

```bash
curl http://localhost:3000/api/bank/config -H "Authorization: Bearer <token>"
```

**Response — `200 OK`**

```json
{
  "enabled": true,
  "simulationEnabled": true,
  "devMode": true,
  "transactionInterval": 180
}
```

#### List providers

`GET /api/bank/providers`

**Response — `200 OK`** — `{ "providers": [{ "id": "demo", "name": "...", "institutions": [{ "id": "...", "name": "Anbessa Bank" }] }] }`

#### List demo accounts

`GET /api/bank/demo/accounts?institutionId=<id>` — the `institutionId` query parameter is optional.

**Response — `200 OK`** — `{ "accounts": [{ "accountNumber": "1234567890128", ... }] }`

#### Start a connection

`POST /api/bank/connections`

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `provider` | string | ✅ | e.g. `demo` |
| `accountNumber` | string | ✅ | A valid 13-digit demo account |

```bash
curl -X POST http://localhost:3000/api/bank/connections \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "provider": "demo", "accountNumber": "1234567890128" }'
```

**Response — `201 Created`**

```json
{
  "connection": {
    "id": 4,
    "user_id": 1,
    "provider": "demo",
    "institution_name": "Anbessa Bank",
    "status": "pending_otp",
    "external_connection_id": "demo-abc123",
    "external_account_id": "demo:1234567890128",
    "created_at": "2026-08-17T09:30:00.000Z",
    "updated_at": "2026-08-17T09:30:00.000Z",
    "last_synced_at": null,
    "disconnected_at": null
  },
  "otp": "482913"
}
```

> `otp` is only returned in dev mode (`DEMO_BANK_DEV_MODE=true`) so a presenter can complete the flow without reading logs. It expires after 5 minutes and allows 5 attempts.

#### Verify a connection

`POST /api/bank/connections/:id/verify`

| Field | Type | Required |
| ----- | ---- | -------- |
| `otp` | string | ✅ (6 digits) |

```bash
curl -X POST http://localhost:3000/api/bank/connections/4/verify \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "otp": "482913" }'
```

**Response — `201 Created`** — `{ "connection": { ... status: "connected" }, "account": { ... }, "synced": { "imported": 4 } }`. The initial history import runs as part of verification.

#### List connections

`GET /api/bank/connections`

**Response — `200 OK`** — an array of connections, each with an `accounts` array.

#### Disconnect

`DELETE /api/bank/connections/:id`

**Response — `200 OK`** — `{ "success": true, "transactionsRemoved": true }`. Disconnecting removes the connection **and all** imported transactions for that bank.

#### List bank accounts

`GET /api/bank/accounts`

**Response — `200 OK`** — an array of bank accounts with `institution_name`, `provider`, `connection_status`, and `last_synced_at`.

#### Sync an account

`POST /api/bank/accounts/:id/sync`

```bash
curl -X POST http://localhost:3000/api/bank/accounts/7/sync \
  -H "Authorization: Bearer <token>"
```

**Response — `200 OK`** — `{ "imported": 2, "syncedAt": "2026-08-17T09:35:00.000Z" }` (plus sync details). Sync is idempotent — running it repeatedly imports each bank transaction exactly once.

#### Simulate a transaction

`POST /api/bank/accounts/:id/simulate`

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `type` | string | ❌ | `expense` (default) or `income` |

```bash
curl -X POST http://localhost:3000/api/bank/accounts/7/simulate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "type": "expense" }'
```

**Response — `200 OK`** — the sync result (the simulated transaction is imported and a realtime event is published).

#### Run the demo sequence

`POST /api/bank/accounts/:id/demo`

Kicks off a scripted sequence (3 expenses + 1 income, ~2.5s apart), each firing the full realtime flow. The response returns immediately.

**Response — `200 OK`** — `{ "started": true, "steps": 4 }`

#### Realtime events

`GET /api/bank/events` — a **Server-Sent Events** stream. Keep the request open to receive events (`transaction.created`, `budget.alert`, `connection.synced`) as they happen:

```bash
curl -N http://localhost:3000/api/bank/events -H "Authorization: Bearer <token>"
```

---

## Testing with Postman

### Option A — import the ready-made collection

A complete collection ships at **`expense-tracker.postman_collection.json`** (same folder as this README). In Postman: **Import → drag the file in → run the requests in order**. The JWT token and created ids are saved automatically by the collection's test scripts, so protected routes work out of the box.

### Option B — import the curl examples

Every example in this README is a valid `curl` command. In Postman: **Import → Raw text → paste the command → Continue**. Replace `<token>` with a real token from login/register.

### Suggested flow

1. **Register** (`POST /api/auth/register`) — save the returned `token`.
2. **Login** (`POST /api/auth/login`) — confirm you can sign in with the username.
3. **Get profile** (`GET /api/auth/profile`) — verify the token works.
4. **Create categories** — a few categories to attach transactions to.
5. **Create transactions** — income and expenses referencing those categories.
6. **List/filter transactions** — try `?type=expense&startDate=...&endDate=...`.
7. **Create budgets** — per-category limits.
8. **Dashboard** — summary, monthly trend, category breakdown.
9. **Insights** — `GET /api/insights` and `POST /api/insights/ask`.
10. **Update / delete** — exercise the `PUT` and `DELETE` routes.
11. **Bank** (optional) — connect a demo account, verify the OTP, sync, simulate.

### Postman environment variables (recommended)

| Variable | Value | Used for |
| -------- | ----- | -------- |
| `baseUrl` | `http://localhost:3000/api` | URL prefix on every request |
| `token` | *(from login/register)* | `Authorization: Bearer {{token}}` header |

---

## AI Insights

A RAG-style pipeline over the user's structured financial data, producing a **daily** summary:

1. **Retrieve** — real transactions, categories, budgets, and week/month-to-date totals are pulled from PostgreSQL.
2. **Augment** — the data is formatted into a compact context document.
3. **Generate** — Google Gemini (default `gemini-3.5-flash`, configurable via `AI_MODEL`) writes a concise summary grounded only in that data.
4. **Fallback** — without a `GEMINI_API_KEY`, or if Gemini is unreachable, deterministic rule-based insights are generated from the same data.
5. **Cache** — one row per user per day in the `ai_insights` table; results are cached until regenerated.

**Auto-refresh:** creating, editing, or deleting a transaction or budget automatically clears the cached insights, so the next dashboard load always reflects your latest data.

### Configure Gemini (optional)

Get a free API key at <https://aistudio.google.com/apikey> and add it to `backend/.env`:

```env
GEMINI_API_KEY=your_key_here
AI_MODEL=gemini-3.5-flash
```

> No key? The feature still works — it automatically falls back to rule-based insights.

---

## Demo Bank connections

Connect a fictional bank account (13-digit number + simulated OTP) and watch transactions, balances, budgets, and insights update in real time — powered by a simulated in-memory bank, never a real one.

---

## Rate limits & security

| Scope | Limit | Purpose |
| ----- | ----- | ------- |
| `/api/auth/*` | 20 requests / 15 min per IP | Brute-force protection |
| `/api/insights` | 40 requests / hour per IP | Protects the AI budget |
| `/api/bank` connect flow | 20 requests / 15 min per IP | Brute-force protection for OTP steps |

- Passwords are hashed with **bcrypt** (10 rounds).
- Tokens are signed with `JWT_SECRET` and expire after 7 days; changing your password or revoking sessions bumps a `token_version` that invalidates older tokens.
- CORS is restricted to `FRONTEND_URL` (default `http://localhost:5173`).
- Every protected route scopes queries to `req.user.id` — a user can never read or modify another user's data.

---

## Tests

```bash
npm test
```

Runs the test suite with Node's built-in test runner (no database needed): auth rate limiting, transaction validation, budget alert logic, insights generation, demo-bank account/OTP/sync logic, and route auth gating.

---

## Database migrations

`src/migrations/` holds the schema plus incremental migrations. Fresh installs get everything from `initial_schema.sql` via `npm run db:setup`. **Existing databases** apply the incremental files in order — each is non-destructive:

| File | Purpose |
| ---- | ------- |
| `initial_schema.sql` | Full schema — used by `npm run db:setup` (fresh installs only; wipes data) |
| `user_settings.sql` | Adds `currency`, `avatar_color`, `token_version`, `avatar_image` |
| `currency_etb.sql` | Defaults new users to the ETB currency |
| `budget_period_daily.sql` | Adds the `daily` budget period |
| `daily_insights.sql` | Creates the `ai_insights` daily cache table |
| `budget_alert_threshold.sql` | Adds the budget spend-alert threshold column |
| `bank_schema.sql` | Creates `bank_connections` / `bank_accounts` + transaction source columns |
| `username.sql` | Adds the unique `username` column and backfills existing users |

Apply one with:

```bash
npm run db:migrate <filename>
```

(`npm run db:migrate` with no filename defaults to `daily_insights.sql`.)

---

## Troubleshooting

### Port 3000 already in use (EADDRINUSE)

A previous server instance is still running. Find and kill it, then start again:

```bash
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

Or run on a different port:

```bash
PORT=5001 node server.js
```

### password authentication failed for user "postgres"

The password in `DATABASE_URL` is wrong. Check the password you set when installing PostgreSQL and update `.env`.

### database "expense_tracker" does not exist

Create it with `CREATE DATABASE expense_tracker;` (see step 3), or point `DATABASE_URL` at a database that already exists.

### column "..." does not exist

Your database predates a migration. Apply the relevant file from the [Database migrations](#database-migrations) table — e.g. `npm run db:migrate username.sql` for the `username` column.

### 401 Unauthorized on every request

The token is missing, expired, or was invalidated (password change / session revocation). Sign in again and use the fresh token.
