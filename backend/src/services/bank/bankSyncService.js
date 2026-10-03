// Bank sync pipeline — imports transactions from a connected (simulated) bank
// into the application's existing transaction system.
//
//   Demo Bank → fetch → validate → deduplicate → normalize → categorize →
//   create Expense Tracker transaction → update balance → invalidate insights
//   → publish realtime event
//
// The pipeline is provider-agnostic: it talks to BankProvider, never to the
// demo simulator directly. A future real provider plugs in here without
// changes.
//
// Idempotency: the provider's external_transaction_id is enforced unique per
// (user, provider id) at the database level, and inserts use
// ON CONFLICT DO NOTHING — running sync any number of times never duplicates
// a transaction.

const db = require("../../config/db");
const { getProvider } = require("./bankProvider");
const { resolveCategoryId } = require("./categorizer");
const { invalidateInsights } = require("../insightsService");
const realtime = require("./realtimeBus");
const { evaluateBudgetAlerts } = require("./budgetAlerts");
const { generateExpense, generateIncome } = require("./simulatedTransactions");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------- normalize: provider entry -> app transaction shape ----------

function normalizeProviderTransaction(raw) {
  const externalId = String(raw.externalId || "").trim();
  if (!externalId) return null; // can't dedup without a stable id

  const type = raw.type === "income" ? "income" : "expense";
  const amount = Math.round(Number(raw.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const transactionDate = String(raw.transactionDate || "");
  if (!DATE_RE.test(transactionDate)) return null;

  return {
    externalId: externalId.slice(0, 120),
    description: String(raw.merchantName || raw.description || "")
      .trim()
      .slice(0, 255),
    category: String(raw.category || "").trim(),
    type,
    amount,
    transactionDate,
  };
}

// ---------- DB helpers ----------

function loadConnectionForUser(userId, connectionId) {
  return db.query(
    "SELECT * FROM bank_connections WHERE id = $1 AND user_id = $2",
    [connectionId, userId],
  );
}

async function getAccountWithConnection(userId, accountId) {
  const result = await db.query(
    `SELECT ba.*, bc.user_id, bc.provider, bc.status, bc.id AS bank_connection_id
     FROM bank_accounts ba
     JOIN bank_connections bc ON bc.id = ba.bank_connection_id
     WHERE ba.id = $1 AND bc.user_id = $2`,
    [accountId, userId],
  );
  return result.rows[0] || null;
}

// ---------- core sync ----------

/**
 * Synchronize every account under a connection.
 *
 * @param {number} userId
 * @param {number} connectionId
 * @param {{ announce?: boolean }} options - announce=false suppresses
 *        per-transaction realtime toasts (used during the initial import).
 * @returns {Promise<{ connectionId: number, imported: number }>}
 */
async function syncConnection(userId, connectionId, { announce = true } = {}) {
  const connResult = await loadConnectionForUser(userId, connectionId);
  const connection = connResult.rows[0];
  if (!connection) {
    const err = new Error("Bank connection not found");
    err.status = 404;
    throw err;
  }
  if (connection.status !== "connected") {
    const err = new Error("This bank connection is not active. Reconnect to continue syncing.");
    err.status = 409;
    throw err;
  }

  const provider = getProvider(connection.provider);

  const accountsResult = await db.query(
    "SELECT * FROM bank_accounts WHERE bank_connection_id = $1",
    [connection.id],
  );

  let imported = 0;
  const insertedIds = [];

  for (const account of accountsResult.rows) {
    const transactions = provider.getTransactions(account.external_account_id) || [];

    for (const raw of transactions) {
      const normalized = normalizeProviderTransaction(raw);
      if (!normalized) continue;

      const categoryId = await resolveCategoryId(userId, normalized.category);

      const insertResult = await db.query(
        `INSERT INTO transactions
           (user_id, category_id, type, amount, description, transaction_date,
            source, external_transaction_id, bank_account_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'bank', $7, $8)
         ON CONFLICT (user_id, external_transaction_id) DO NOTHING
         RETURNING id`,
        [
          userId,
          categoryId,
          normalized.type,
          normalized.amount,
          normalized.description || null,
          normalized.transactionDate,
          normalized.externalId,
          account.id,
        ],
      );

      if (insertResult.rows[0]) {
        imported += 1;
        insertedIds.push(insertResult.rows[0].id);
      }
    }

    // Reflect the simulated bank's current balance on the linked account.
    const balance = provider.getBalance(account.external_account_id);
    await db.query(
      `UPDATE bank_accounts
       SET current_balance = $1, available_balance = $1, updated_at = NOW()
       WHERE id = $2`,
      [balance, account.id],
    );
  }

  await db.query(
    "UPDATE bank_connections SET last_synced_at = NOW(), updated_at = NOW() WHERE id = $1",
    [connection.id],
  );

  // Batch-fetch category names so realtime events carry a display label.
  if (insertedIds.length > 0) {
    const rowsResult = await db.query(
      `SELECT t.id, t.description, t.amount, t.type,
              TO_CHAR(t.transaction_date, 'YYYY-MM-DD') AS transaction_date,
              t.category_id, c.name AS category_name
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.id = ANY($1::int[])`,
      [insertedIds],
    );
    if (announce) {
      for (const row of rowsResult.rows) {
        realtime.publish(userId, {
          type: "transaction.created",
          payload: {
            id: row.id,
            description: row.description,
            amount: Number(row.amount),
            type: row.type,
            category: row.category_name || null,
            transactionDate: row.transaction_date,
            source: "bank",
          },
        });
        // Expenses can push a budget past a threshold — alert once per
        // crossing. Failure here never breaks the sync: the transaction is
        // already committed, and alerts are a non-critical enhancement.
        if (row.type === "expense" && row.category_id) {
          evaluateBudgetAlerts(userId, {
            categoryId: row.category_id,
            transaction: {
              id: row.id,
              description: row.description,
              amount: row.amount,
            },
          }).catch(() => {});
        }
      }
    }
    // Insights summarize the data — drop the cache so the next load regenerates.
    invalidateInsights(userId).catch(() => {});
  }

  realtime.publish(userId, {
    type: "connection.synced",
    payload: { connectionId: connection.id, imported },
  });

  return { connectionId: connection.id, imported };
}

// ---------- manual / live simulation ----------

/**
 * Post a transaction at the (simulated) bank and sync it into the app.
 * @param {number} userId
 * @param {number} accountId
 * @param {'expense'|'income'} type
 */
async function simulateTransaction(userId, accountId, type = "expense") {
  const account = await getAccountWithConnection(userId, accountId);
  if (!account) {
    const err = new Error("Bank account not found");
    err.status = 404;
    throw err;
  }
  if (account.status !== "connected") {
    const err = new Error("This bank connection is not active. Reconnect to continue syncing.");
    err.status = 409;
    throw err;
  }

  const provider = getProvider(account.provider);
  const template =
    type === "income" ? generateIncome() : generateExpense();
  const posted = provider.postTransaction(account.external_account_id, template);

  const result = await syncConnection(userId, account.bank_connection_id, {
    announce: true,
  });

  return {
    ...result,
    posted: {
      merchantName: posted.merchantName,
      amount: posted.amount,
      type: posted.type,
      category: posted.category,
    },
    balance: provider.getBalance(account.external_account_id),
  };
}

// ---------- presenter demo sequence ----------

// Scripted steps for the "Run demo sequence" control: a few varied expenses
// (the random pools cover different categories) followed by one income, each
// landing ~2.5s apart so a presenter can narrate the live flow (toast →
// balance → budget → charts).
const DEMO_SEQUENCE = ["expense", "expense", "expense", "income"];
const DEMO_STEP_DELAY_MS = 2500;

/**
 * Run the scripted demo sequence against one linked account. Fire-and-forget
 * from the controller: each step goes through the full sync pipeline, so
 * realtime events (toast, refresh) fire exactly as during live usage.
 *
 * @param {number} userId
 * @param {number} accountId
 * @returns {Promise<Array<{ type: string, merchantName: string }>>}
 */
async function runDemoSequence(userId, accountId) {
  const steps = [];
  for (const type of DEMO_SEQUENCE) {
    const result = await simulateTransaction(userId, accountId, type);
    steps.push({ type, merchantName: result.posted.merchantName });
    await new Promise((resolve) => setTimeout(resolve, DEMO_STEP_DELAY_MS));
  }
  return steps;
}

module.exports = {
  syncConnection,
  simulateTransaction,
  runDemoSequence,
  normalizeProviderTransaction,
};
