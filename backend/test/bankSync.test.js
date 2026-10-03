const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeProviderTransaction } = require("../src/services/bank/bankSyncService");
const { generateExpense, generateIncome } = require("../src/services/bank/simulatedTransactions");
const { resolveCategoryId, DEFAULT_CATEGORY_BY_PROVIDER } = require("../src/services/bank/categorizer");

test("normalizeProviderTransaction maps a valid provider entry", () => {
  const normalized = normalizeProviderTransaction({
    externalId: "seed-1234567890128-0",
    merchantName: "Blue Owl Café",
    description: "Blue Owl Café",
    amount: 12.5,
    type: "expense",
    category: "Food & Dining",
    transactionDate: "2026-07-14",
    status: "posted",
  });
  assert.deepEqual(normalized, {
    externalId: "seed-1234567890128-0",
    description: "Blue Owl Café",
    category: "Food & Dining",
    type: "expense",
    amount: 12.5,
    transactionDate: "2026-07-14",
  });
});

test("normalizeProviderTransaction drops entries that cannot be deduplicated", () => {
  assert.equal(normalizeProviderTransaction({ ...base(), externalId: "" }), null);
  assert.equal(normalizeProviderTransaction({ ...base(), externalId: "   " }), null);
});

test("normalizeProviderTransaction drops invalid amounts", () => {
  for (const amount of [0, -5, "abc", NaN]) {
    assert.equal(normalizeProviderTransaction({ ...base(), amount }), null, String(amount));
  }
});

test("normalizeProviderTransaction drops invalid dates", () => {
  for (const transactionDate of ["", "14-07-2026", "2026/07/14"]) {
    assert.equal(
      normalizeProviderTransaction({ ...base(), transactionDate }),
      null,
      transactionDate,
    );
  }
});

test("normalizeProviderTransaction maps income and truncates long ids", () => {
  const normalized = normalizeProviderTransaction({
    ...base(),
    type: "income",
    externalId: "x".repeat(200),
  });
  assert.equal(normalized.type, "income");
  assert.equal(normalized.externalId.length, 120);
});

function base() {
  return {
    externalId: "sim-1234567890128-1-2",
    merchantName: "Test Merchant",
    description: "Test Merchant",
    amount: 20,
    type: "expense",
    category: "Shopping",
    transactionDate: "2026-08-10",
    status: "posted",
  };
}

test("simulated transaction generators produce realistic entries", () => {
  for (let i = 0; i < 50; i += 1) {
    const expense = generateExpense();
    assert.equal(expense.type, "expense");
    assert.ok(expense.amount > 0);
    assert.ok(expense.merchantName);
    assert.ok(expense.category);
    assert.equal(expense.description, expense.merchantName);

    const income = generateIncome();
    assert.equal(income.type, "income");
    assert.ok(income.amount > 0);
    assert.ok(income.merchantName);
    assert.equal(income.category, "Income");
  }
});

test("every provider category has a default user-category mapping", () => {
  // All categories used by the seed history and simulator must have defaults
  // so imported transactions always resolve to a user category.
  const seedCategories = new Set();
  const { DemoBankLedger } = require("../src/services/bank/demoBankLedger");
  const ledger = new DemoBankLedger();
  for (const account of ledger.listSeedAccounts()) {
    for (const txn of ledger.getTransactions(account.accountNumber)) {
      seedCategories.add(txn.category);
    }
  }
  for (let i = 0; i < 50; i += 1) {
    seedCategories.add(generateExpense().category);
    seedCategories.add(generateIncome().category);
  }
  for (const category of seedCategories) {
    assert.ok(
      DEFAULT_CATEGORY_BY_PROVIDER[category] ||
        Object.values(DEFAULT_CATEGORY_BY_PROVIDER).some((d) => d.name === category),
      `no default category mapping for "${category}"`,
    );
  }
});

test("resolveCategoryId is exported and wired to the categorizer defaults", () => {
  assert.equal(typeof resolveCategoryId, "function");
  assert.ok(DEFAULT_CATEGORY_BY_PROVIDER["Food & Dining"].icon, "utensils");
  assert.ok(DEFAULT_CATEGORY_BY_PROVIDER.Income.color, "#1e9e50");
});
