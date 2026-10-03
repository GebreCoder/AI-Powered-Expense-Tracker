const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateRuleBased } = require("../src/services/insightsService");

const baseContext = {
  date: "2026-08-12",
  day: {
    income: 500,
    expense: 400,
    net: 100,
    prev_income: 480,
    prev_expense: 300,
    transaction_count: 4,
    expense_count: 3,
    avg_expense: 60,
    top_categories: [
      { category: "Groceries", spent: 200 },
      { category: "Transport", spent: 100 },
    ],
    biggest_transactions: [
      { amount: 250, type: "expense", description: "Groceries", date: "2026-08-12", category: "Groceries" },
    ],
  },
  week: {
    income: 2500,
    expense: 1200,
    transaction_count: 14,
    avg_expense: 60,
    top_categories: [
      { category: "Groceries", spent: 600 },
      { category: "Rent", spent: 500 },
    ],
  },
  month_to_date: {
    income: 5000,
    expense: 4000,
    net: 1000,
    transaction_count: 30,
    days_elapsed: 12,
  },
  budgets: [
    { category: "Rent", period: "monthly", limit: 2000, spent: 2500 },
  ],
  all_time: {
    total_income: 50000,
    total_expense: 42000,
    transaction_count: 120,
    expense_count: 100,
    avg_expense: 60,
  },
};

test("returns no insights when there are no transactions", () => {
  const ctx = structuredClone(baseContext);
  ctx.all_time.transaction_count = 0;
  ctx.day.income = 0;
  ctx.day.expense = 0;
  ctx.week.transaction_count = 0;
  assert.deepEqual(generateRuleBased(ctx), []);
});

test("returns no insights when the day and week have no activity", () => {
  const ctx = structuredClone(baseContext);
  ctx.day.income = 0;
  ctx.day.expense = 0;
  ctx.week.transaction_count = 0;
  ctx.day.top_categories = [];
  ctx.day.biggest_transactions = [];
  ctx.week.top_categories = [];
  assert.deepEqual(generateRuleBased(ctx), []);
});

test("generates a daily summary insight with real numbers", () => {
  const insights = generateRuleBased(structuredClone(baseContext));
  assert.ok(insights.length >= 1);
  const first = insights[0];
  assert.equal(first.type, "summary");
  assert.ok(first.title.length > 0);
  assert.ok(first.summary.includes("$500"));
  assert.ok(first.summary.includes("$400"));
});

test("flags spending increase vs yesterday", () => {
  const insights = generateRuleBased(structuredClone(baseContext));
  // expense 400 vs prev 300 -> up 33%
  assert.ok(insights.some((i) => i.title.includes("up 33%")));
});

test("flags over-budget categories with type 'budget'", () => {
  const insights = generateRuleBased(structuredClone(baseContext));
  const over = insights.find((i) => i.title.includes("over budget"));
  assert.ok(over, "expected an over-budget insight");
  assert.equal(over.type, "budget");
  assert.ok(over.summary.includes("Rent"));
});

test("flags an unusually large expense with type 'anomaly'", () => {
  const insights = generateRuleBased(structuredClone(baseContext));
  // Groceries $250 vs $60 average -> anomaly (>= 2.5x)
  const anomaly = insights.find((i) => i.title.includes("Unusually large expense"));
  assert.ok(anomaly, "expected an anomaly insight");
  assert.equal(anomaly.type, "anomaly");
  assert.ok(anomaly.summary.includes("$250"));
});

test("does not flag an anomaly when expenses are typical", () => {
  const ctx = structuredClone(baseContext);
  ctx.day.biggest_transactions = [
    { amount: 90, type: "expense", description: "Dinner", date: "2026-08-12", category: null },
  ];
  const insights = generateRuleBased(ctx);
  assert.ok(!insights.some((i) => i.title.includes("Unusually large expense")));
});

test("does not flag an anomaly when the day has only one expense", () => {
  const ctx = structuredClone(baseContext);
  ctx.day.avg_expense = 250;
  ctx.day.expense_count = 1;
  const insights = generateRuleBased(ctx);
  assert.ok(!insights.some((i) => i.title.includes("Unusually large expense")));
});

test("warns when week savings rate is below 10% with type 'tip'", () => {
  const ctx = structuredClone(baseContext);
  ctx.week.income = 5000;
  ctx.week.expense = 4950;
  const insights = generateRuleBased(ctx);
  const tip = insights.find((i) => i.title.includes("Saving less than 10%"));
  assert.ok(tip, "expected a savings tip");
  assert.equal(tip.type, "tip");
});

test("flags month-to-date overspend pacing with type 'tip'", () => {
  const ctx = structuredClone(baseContext);
  ctx.week.income = 5000;
  ctx.week.expense = 1000; // savings fine -> falls through to month pacing
  const insights = generateRuleBased(ctx);
  assert.ok(insights.some((i) => i.title.includes("overspend this month")));
});

test("shows a month-to-date check-in when pacing is fine", () => {
  const ctx = structuredClone(baseContext);
  ctx.week.income = 5000;
  ctx.week.expense = 1000;
  ctx.month_to_date.income = 5000;
  ctx.month_to_date.expense = 1000; // well under income
  const insights = generateRuleBased(ctx);
  assert.ok(insights.some((i) => i.title.includes("Month-to-date check-in")));
});

test("does not warn about savings when there is no income", () => {
  const ctx = structuredClone(baseContext);
  ctx.week.income = 0;
  ctx.week.expense = 100;
  const insights = generateRuleBased(ctx);
  assert.ok(!insights.some((i) => i.title.includes("Saving less than 10%")));
});

test("suggests trimming the top category when there is no month activity", () => {
  const ctx = structuredClone(baseContext);
  ctx.month_to_date.income = 0;
  ctx.month_to_date.expense = 0;
  const insights = generateRuleBased(ctx);
  assert.ok(insights.some((i) => i.title.includes("Trim the biggest category first")));
});
