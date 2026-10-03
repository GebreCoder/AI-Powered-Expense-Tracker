const { test, mock } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../src/config/db");
const realtime = require("../src/services/bank/realtimeBus");
const config = require("../src/services/bank/bankConfig");
const {
  nextAlertLevel,
  evaluateBudgetAlerts,
  OVER_PCT,
} = require("../src/services/bank/budgetAlerts");

// ---------- nextAlertLevel (pure) ----------

test("nextAlertLevel: below the threshold → no alert", () => {
  assert.equal(nextAlertLevel(70, 100, null), null);
  assert.equal(nextAlertLevel(79.9, 100, null), null);
});

test("nextAlertLevel: reaching the threshold fires a warn once", () => {
  assert.equal(nextAlertLevel(80, 100, null), "warn");
  assert.equal(nextAlertLevel(95, 100, null), "warn");
});

test("nextAlertLevel: warn is not repeated once alerted", () => {
  assert.equal(nextAlertLevel(95, 100, 80), null);
});

test("nextAlertLevel: crossing 100% fires 'over' even after a warn", () => {
  assert.equal(nextAlertLevel(100, 100, 80), "over");
  assert.equal(nextAlertLevel(150, 100, 80), "over");
});

test("nextAlertLevel: over is not repeated once alerted", () => {
  assert.equal(nextAlertLevel(150, 100, 100), null);
  assert.equal(nextAlertLevel(150, 100, OVER_PCT), null);
});

test("nextAlertLevel: jumping straight past 100% fires 'over' (not warn)", () => {
  assert.equal(nextAlertLevel(140, 100, null), "over");
});

test("nextAlertLevel: a custom threshold is respected", () => {
  assert.equal(nextAlertLevel(60, 100, null, 50), "warn");
  assert.equal(nextAlertLevel(55, 100, null, 60), null);
  assert.equal(nextAlertLevel(60, 100, 50, 50), null);
  assert.equal(nextAlertLevel(120, 100, 50, 50), "over");
});

test("nextAlertLevel: zero or negative budget amount → no alert", () => {
  assert.equal(nextAlertLevel(10, 0, null), null);
  assert.equal(nextAlertLevel(10, -5, null), null);
});

// ---------- evaluateBudgetAlerts (db + realtime) ----------

const budgetRow = (overrides = {}) => ({
  id: 7,
  category_name: "Food & Dining",
  amount: 100,
  spent: 85,
  last_alert_at_pct: null,
  ...overrides,
});

async function withMocks(handlers) {
  const calls = [];
  const queryMock = mock.method(db, "query", async (sql, params) => {
    calls.push({ sql, params });
    return handlers(sql, params) || { rows: [] };
  });
  const publishMock = mock.method(realtime, "publish", () => {});
  return { calls, queryMock, publishMock };
}

test("evaluateBudgetAlerts: no category → no queries, no alerts", async () => {
  const { calls, queryMock, publishMock } = await withMocks(() => {});
  try {
    const alerts = await evaluateBudgetAlerts(1, { categoryId: null, transaction: {} });
    assert.deepEqual(alerts, []);
    assert.equal(queryMock.mock.calls.length, 0);
    assert.equal(publishMock.mock.calls.length, 0);
  } finally {
    queryMock.mock.restore();
    publishMock.mock.restore();
  }
});

test("evaluateBudgetAlerts: crossing the warn threshold publishes once and persists", async () => {
  const { calls, queryMock, publishMock } = await withMocks((sql) => {
    if (sql.startsWith("SELECT b.*")) return { rows: [budgetRow()] };
    return null;
  });
  try {
    const alerts = await evaluateBudgetAlerts(1, {
      categoryId: 3,
      transaction: { id: 9, description: "Blue Owl Café", amount: 6 },
    });

    assert.deepEqual(alerts, [{ budgetId: 7, level: "warn", pct: 85 }]);

    const update = calls.find((c) => c.sql.startsWith("UPDATE budgets"));
    assert.ok(update, "expected a last_alert_at_pct update");
    assert.deepEqual(update.params, [80, 7, 1]);

    assert.equal(publishMock.mock.calls.length, 1);
    const event = publishMock.mock.calls[0].arguments[1];
    assert.equal(event.type, "budget.alert");
    assert.equal(event.payload.level, "warn");
    assert.equal(event.payload.pct, 85);
    assert.equal(event.payload.budgetId, 7);
    assert.equal(event.payload.categoryName, "Food & Dining");
    assert.deepEqual(event.payload.transaction, {
      id: 9,
      description: "Blue Owl Café",
      amount: 6,
    });
  } finally {
    queryMock.mock.restore();
    publishMock.mock.restore();
  }
});

test("evaluateBudgetAlerts: below the threshold → no update, no event", async () => {
  const { calls, queryMock, publishMock } = await withMocks((sql) => {
    if (sql.startsWith("SELECT b.*"))
      return { rows: [budgetRow({ spent: 40 })] };
    return null;
  });
  try {
    const alerts = await evaluateBudgetAlerts(1, { categoryId: 3, transaction: {} });
    assert.deepEqual(alerts, []);
    assert.equal(publishMock.mock.calls.length, 0);
    assert.ok(!calls.some((c) => c.sql.startsWith("UPDATE budgets")));
  } finally {
    queryMock.mock.restore();
    publishMock.mock.restore();
  }
});

test("evaluateBudgetAlerts: already warned → silent until 100%", async () => {
  const { queryMock, publishMock } = await withMocks((sql) => {
    if (sql.startsWith("SELECT b.*"))
      return { rows: [budgetRow({ spent: 90, last_alert_at_pct: 80 })] };
    return null;
  });
  try {
    const alerts = await evaluateBudgetAlerts(1, { categoryId: 3, transaction: {} });
    assert.deepEqual(alerts, []);
    assert.equal(publishMock.mock.calls.length, 0);
  } finally {
    queryMock.mock.restore();
    publishMock.mock.restore();
  }
});

test("evaluateBudgetAlerts: crossing 100% publishes 'over' and persists 100", async () => {
  const { calls, queryMock, publishMock } = await withMocks((sql) => {
    if (sql.startsWith("SELECT b.*"))
      return { rows: [budgetRow({ spent: 105, last_alert_at_pct: 80 })] };
    return null;
  });
  try {
    const alerts = await evaluateBudgetAlerts(1, { categoryId: 3, transaction: {} });
    assert.deepEqual(alerts, [{ budgetId: 7, level: "over", pct: 105 }]);

    const update = calls.find((c) => c.sql.startsWith("UPDATE budgets"));
    assert.ok(update);
    assert.deepEqual(update.params, [100, 7, 1]);

    const event = publishMock.mock.calls[0].arguments[1];
    assert.equal(event.payload.level, "over");
    assert.equal(event.payload.pct, 105);
  } finally {
    queryMock.mock.restore();
    publishMock.mock.restore();
  }
});

test("evaluateBudgetAlerts: raised budget resets the alert state", async () => {
  const { calls, queryMock, publishMock } = await withMocks((sql) => {
    if (sql.startsWith("SELECT b.*"))
      return { rows: [budgetRow({ spent: 60, last_alert_at_pct: 100 })] };
    return null;
  });
  try {
    const alerts = await evaluateBudgetAlerts(1, { categoryId: 3, transaction: {} });
    assert.deepEqual(alerts, []);

    // Reset update fired (last_alert_at_pct set back to NULL), no alert event.
    const update = calls.find((c) => c.sql.startsWith("UPDATE budgets"));
    assert.ok(update);
    assert.match(update.sql, /SET last_alert_at_pct = NULL/);
    assert.deepEqual(update.params, [7, 1]);
    assert.equal(publishMock.mock.calls.length, 0);
  } finally {
    queryMock.mock.restore();
    publishMock.mock.restore();
  }
});

test("evaluateBudgetAlerts: honors the configured threshold", async () => {
  const original = config.budgetAlertThreshold;
  config.budgetAlertThreshold = 50;
  try {
    const { calls, queryMock, publishMock } = await withMocks((sql) => {
      if (sql.startsWith("SELECT b.*"))
        return { rows: [budgetRow({ spent: 55, last_alert_at_pct: null })] };
      return null;
    });
    try {
      const alerts = await evaluateBudgetAlerts(1, { categoryId: 3, transaction: {} });
      assert.deepEqual(alerts, [{ budgetId: 7, level: "warn", pct: 55 }]);
      const update = calls.find((c) => c.sql.startsWith("UPDATE budgets"));
      assert.deepEqual(update.params, [50, 7, 1]);
    } finally {
      queryMock.mock.restore();
      publishMock.mock.restore();
    }
  } finally {
    config.budgetAlertThreshold = original;
  }
});
