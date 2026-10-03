// Bank controller — demo bank connections, OTP verification, sync, simulate,
// disconnect, and the realtime event stream.
//
// Security rules applied on every endpoint:
//   * the authenticated user is always derived from req.user (JWT) — never
//     trusted from the request body or URL;
//   * every connection/account id is checked for ownership before use;
//   * errors returned to the client are friendly and never leak internals.

const db = require("../config/db");
const { getProvider, listProviders } = require("../services/bank/bankProvider");
const otpStore = require("../services/bank/otpStore");
const bankConfig = require("../services/bank/bankConfig");
const realtime = require("../services/bank/realtimeBus");
const { invalidateInsights } = require("../services/insightsService");
const { syncConnection, simulateTransaction, runDemoSequence } = require("../services/bank/bankSyncService");

const ID_RE = /^\d+$/;
const OTP_RE = /^\d{6}$/;
const VALID_SIM_TYPES = new Set(["expense", "income"]);

function idParam(req, res) {
  if (!ID_RE.test(req.params.id)) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return Number(req.params.id);
}

async function loadOwnedConnection(userId, connectionId) {
  const result = await db.query(
    "SELECT * FROM bank_connections WHERE id = $1 AND user_id = $2",
    [connectionId, userId],
  );
  return result.rows[0] || null;
}

// ---------- discovery / config ----------

exports.getConfig = (req, res) => {
  res.json({
    enabled: bankConfig.enabled,
    simulationEnabled: bankConfig.simulationEnabled,
    devMode: bankConfig.devMode,
    transactionInterval: bankConfig.transactionInterval,
  });
};

exports.getProviders = (req, res) => {
  const providers = listProviders().map((p) => {
    const provider = getProvider(p.id);
    return { ...p, institutions: provider.listInstitutions() };
  });
  res.json({ providers });
};

exports.getDemoAccounts = (req, res) => {
  const provider = getProvider("demo");
  const { institutionId } = req.query;
  const accounts = provider.listAvailableAccounts(institutionId || undefined);
  res.json({ accounts });
};

// ---------- connect flow ----------

exports.createConnection = async (req, res, next) => {
  try {
    const { provider: providerId, accountNumber } = req.body || {};
    if (!providerId || !accountNumber) {
      return res.status(400).json({ error: "Provider and account number are required" });
    }

    let provider;
    try {
      provider = getProvider(providerId);
    } catch {
      return res.status(400).json({ error: "Unknown bank provider" });
    }

    const { valid, error } = provider.validateAccount(accountNumber);
    if (!valid) return res.status(400).json({ error });

    const externalAccountId = accountNumber.startsWith("demo:")
      ? accountNumber
      : `demo:${accountNumber}`;

    // Already connected (active connection with this account)?
    const active = await db.query(
      `SELECT bc.id FROM bank_connections bc
       JOIN bank_accounts ba ON ba.bank_connection_id = bc.id
       WHERE bc.user_id = $1 AND ba.external_account_id = $2 AND bc.status = 'connected'`,
      [req.user.id, externalAccountId],
    );
    if (active.rows[0]) {
      return res.status(409).json({ error: "This demo account is already connected." });
    }

    // Reuse an abandoned pending flow for the same account (fresh OTP).
    const pending = await db.query(
      `SELECT * FROM bank_connections
       WHERE user_id = $1 AND provider = $2 AND external_account_id = $3
         AND status = 'pending_otp'
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id, providerId, externalAccountId],
    );

    let connection;
    if (pending.rows[0]) {
      connection = pending.rows[0];
    } else {
      const linked = provider.linkAccount(accountNumber);
      const result = await db.query(
        `INSERT INTO bank_connections
           (user_id, provider, institution_name, status,
            external_connection_id, external_account_id)
         VALUES ($1, $2, $3, 'pending_otp', $4, $5)
         RETURNING *`,
        [
          req.user.id,
          providerId,
          linked.account.institutionName || "Simulated Bank",
          linked.externalConnectionId,
          linked.account.externalAccountId,
        ],
      );
      connection = result.rows[0];
    }

    const otp = otpStore.create(connection.id, req.user.id);

    console.log(
      `[bank] connection requested — user ${req.user.id}, provider ${providerId}, account ${linkedAccountMask(accountNumber)}`,
    );

    res.status(201).json({ connection, otp });
  } catch (error) {
    next(error);
  }
};

function linkedAccountMask(accountNumber) {
  const digits = String(accountNumber).replace(/\D/g, "");
  return `••••••••••${digits.slice(-4)}`;
}

exports.verifyConnection = async (req, res, next) => {
  try {
    const connectionId = idParam(req, res);
    if (connectionId === null) return;

    const connection = await loadOwnedConnection(req.user.id, connectionId);
    if (!connection) return res.status(404).json({ error: "Bank connection not found" });
    if (connection.status !== "pending_otp") {
      return res.status(409).json({ error: "This connection has already been verified" });
    }

    const otp = String((req.body || {}).otp ?? "").trim();
    if (!OTP_RE.test(otp)) {
      return res.status(400).json({ error: "Enter the 6-digit verification code." });
    }

    const verdict = otpStore.verify(connection.id, req.user.id, otp);
    if (!verdict.ok) return res.status(400).json({ error: verdict.error });

    const provider = getProvider(connection.provider);
    const accountView = provider.getAccounts({ externalAccountId: connection.external_account_id })[0];
    if (!accountView) return res.status(404).json({ error: "Linked demo account not found" });

    const accountResult = await db.query(
      `INSERT INTO bank_accounts
         (bank_connection_id, external_account_id, account_number_masked,
          account_type, account_name, currency, current_balance, available_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING *`,
      [
        connection.id,
        accountView.externalAccountId,
        accountView.accountNumberMasked,
        accountView.accountType,
        accountView.accountName,
        accountView.currency,
        accountView.currentBalance,
      ],
    );

    await db.query(
      "UPDATE bank_connections SET status = 'connected', updated_at = NOW() WHERE id = $1",
      [connection.id],
    );
    connection.status = "connected";

    // Initial import — silently (no per-transaction toasts for history).
    const synced = await syncConnection(req.user.id, connection.id, { announce: false });

    console.log(
      `[bank] account connected — user ${req.user.id}, ${accountView.accountName} (${accountView.accountNumberMasked}), ${synced.imported} history transactions imported`,
    );

    res.status(201).json({
      connection,
      account: accountResult.rows[0],
      synced,
    });
  } catch (error) {
    next(error);
  }
};

// ---------- listing ----------

exports.listConnections = async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT * FROM bank_connections WHERE user_id = $1 ORDER BY created_at DESC",
      [req.user.id],
    );
    const connections = await Promise.all(
      result.rows.map(async (connection) => {
        const accounts = await db.query(
          "SELECT * FROM bank_accounts WHERE bank_connection_id = $1 ORDER BY created_at",
          [connection.id],
        );
        return { ...connection, accounts: accounts.rows };
      }),
    );
    res.json(connections);
  } catch (error) {
    next(error);
  }
};

exports.listAccounts = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT ba.*, bc.institution_name, bc.provider, bc.status AS connection_status,
              bc.last_synced_at
       FROM bank_accounts ba
       JOIN bank_connections bc ON bc.id = ba.bank_connection_id
       WHERE bc.user_id = $1
       ORDER BY bc.created_at DESC, ba.created_at`,
      [req.user.id],
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

// ---------- sync / simulate ----------

exports.syncAccount = async (req, res, next) => {
  try {
    const accountId = idParam(req, res);
    if (accountId === null) return;

    const account = await db.query(
      `SELECT ba.id, bc.id AS bank_connection_id, bc.status
       FROM bank_accounts ba
       JOIN bank_connections bc ON bc.id = ba.bank_connection_id
       WHERE ba.id = $1 AND bc.user_id = $2`,
      [accountId, req.user.id],
    );
    if (!account.rows[0]) return res.status(404).json({ error: "Bank account not found" });

    const result = await syncConnection(req.user.id, account.rows[0].bank_connection_id, {
      announce: true,
    });
    res.json({ ...result, syncedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
};

exports.simulateAccount = async (req, res, next) => {
  try {
    const accountId = idParam(req, res);
    if (accountId === null) return;

    const type = (req.body || {}).type || "expense";
    if (!VALID_SIM_TYPES.has(type)) {
      return res.status(400).json({ error: "Type must be 'expense' or 'income'" });
    }

    const result = await simulateTransaction(req.user.id, accountId, type);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// ---------- presenter demo sequence ----------

exports.demoSequence = async (req, res, next) => {
  try {
    const accountId = idParam(req, res);
    if (accountId === null) return;

    // Validate ownership + active status up front so a bad request fails
    // fast instead of erroring inside the background sequence.
    const account = await db.query(
      `SELECT ba.id, bc.id AS bank_connection_id, bc.status
       FROM bank_accounts ba
       JOIN bank_connections bc ON bc.id = ba.bank_connection_id
       WHERE ba.id = $1 AND bc.user_id = $2`,
      [accountId, req.user.id],
    );
    if (!account.rows[0]) {
      return res.status(404).json({ error: "Bank account not found" });
    }
    if (account.rows[0].status !== "connected") {
      return res.status(409).json({
        error: "This bank connection is not active. Reconnect to continue syncing.",
      });
    }

    // Fire-and-forget: the HTTP response returns immediately and each step
    // publishes its own realtime events as it lands (~2.5s apart).
    runDemoSequence(req.user.id, accountId)
      .then((steps) =>
        console.log(
          `[bank] demo sequence finished — user ${req.user.id}, account ${accountId}, ${steps.length} steps`,
        ),
      )
      .catch((err) =>
        console.error(
          `[bank] demo sequence failed — user ${req.user.id}, account ${accountId}: ${err.message}`,
        ),
      );

    res.json({ started: true, steps: 4 });
  } catch (error) {
    next(error);
  }
};

// ---------- disconnect ----------

exports.disconnectConnection = async (req, res, next) => {
  try {
    const connectionId = idParam(req, res);
    if (connectionId === null) return;

    const connection = await loadOwnedConnection(req.user.id, connectionId);
    if (!connection) return res.status(404).json({ error: "Bank connection not found" });

    if (connection.status === "pending_otp") {
      // Abandoned connect flow — clean it up entirely.
      otpStore.clear(connection.id);
      await db.query("DELETE FROM bank_connections WHERE id = $1", [connection.id]);
      return res.json({ success: true, transactionsRemoved: false });
    }

    if (connection.status === "connected") {
      const provider = getProvider(connection.provider);
      try {
        provider.disconnectAccount(connection.external_connection_id);
      } catch {
        /* provider teardown is best-effort */
      }
      // Disconnect removes EVERYTHING tied to this bank: the imported
      // transactions first (while their bank_account_id link still exists),
      // then the connection — bank_accounts cascade with it. Nothing related
      // to this bank is left behind.
      await db.query(
        `DELETE FROM transactions
         WHERE bank_account_id IN (
           SELECT id FROM bank_accounts WHERE bank_connection_id = $1
         )`,
        [connection.id],
      );
      await db.query("DELETE FROM bank_connections WHERE id = $1", [connection.id]);
      // Summaries (budgets, insights) are cached — refresh them after removal.
      invalidateInsights(req.user.id).catch(() => {});
      console.log(
        `[bank] connection removed with its transactions — user ${req.user.id}, connection ${connection.id}`,
      );
    }

    res.json({ success: true, transactionsRemoved: true });
  } catch (error) {
    next(error);
  }
};

// ---------- realtime stream (SSE) ----------

exports.streamEvents = (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 5000\n\n");
  res.write(`event: ready\ndata: {}\n\n`);

  const unsubscribe = realtime.subscribe(req.user.id, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  // Keep proxies from closing idle connections.
  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
};
