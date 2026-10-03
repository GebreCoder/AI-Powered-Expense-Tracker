const { test } = require("node:test");
const assert = require("node:assert/strict");
const { answerQuestionWithRules } = require("../src/services/insightsService");

const baseContext = {
  today: { income: 500, expense: 400, net: 100, expense_count: 3, avg_expense: 60 },
  week: { income: 2500, expense: 1200 },
  month: {
    income: 5000,
    expense: 4000,
    net: 1000,
    top_categories: [{ category: "Groceries", spent: 800 }],
  },
  all_time: {
    total_income: 50000,
    total_expense: 42000,
    transaction_count: 120,
    expense_count: 100,
    avg_expense: 60,
  },
  categories_all_time: [
    { category: "Groceries", spent: 6000 },
    { category: "Rent", spent: 5000 },
  ],
  budgets: [{ category: "Rent", period: "monthly", limit: 2000, spent: 2500 }],
  recent_transactions: [
    { amount: 2500, type: "income", description: "Salary", date: "2026-08-10", category: null },
  ],
  monthly_trend: [],
};

test("answers income questions with real numbers", () => {
  const a = answerQuestionWithRules(structuredClone(baseContext), "How much did I earn?");
  assert.ok(a.includes("$50,000"), a);
  assert.ok(a.includes("$5,000"), a);
});

test("answers spending questions with totals and top category", () => {
  const a = answerQuestionWithRules(structuredClone(baseContext), "How much have I spent this month?");
  assert.ok(a.includes("$4,000"), a);
  assert.ok(a.includes("Groceries"), a);
});

test("answers budget questions and flags over-budget categories", () => {
  const a = answerQuestionWithRules(structuredClone(baseContext), "Am I over budget?");
  assert.ok(a.includes("Rent"), a);
  assert.ok(a.includes("over budget"), a);
});

test("budget question without budgets points the user to create one", () => {
  const ctx = structuredClone(baseContext);
  ctx.budgets = [];
  const a = answerQuestionWithRules(ctx, "What's my budget?");
  assert.ok(a.toLowerCase().includes("haven't set any budgets"), a);
});

test("answers category questions", () => {
  const a = answerQuestionWithRules(structuredClone(baseContext), "What are my top categories?");
  assert.ok(a.includes("Groceries"), a);
  assert.ok(a.includes("Rent"), a);
});

test("answers savings questions with the savings rate", () => {
  const a = answerQuestionWithRules(structuredClone(baseContext), "Am I saving enough?");
  // savings rate = (5000-4000)/5000 = 20%
  assert.ok(a.includes("20%"), a);
});

test("answers questions about today", () => {
  const a = answerQuestionWithRules(structuredClone(baseContext), "What happened today?");
  assert.ok(a.includes("$500"), a);
  assert.ok(a.includes("$400"), a);
});

test("answers questions about recent transactions", () => {
  const a = answerQuestionWithRules(structuredClone(baseContext), "Any unusual transactions?");
  assert.ok(a.includes("Salary"), a);
  assert.ok(a.includes("$2,500"), a);
});

test("answers questions about transaction counts", () => {
  const a = answerQuestionWithRules(structuredClone(baseContext), "How many transactions do I have?");
  assert.ok(a.includes("120"), a);
  assert.ok(a.includes("100 expense"), a);
});

test("falls back to a general summary for unknown questions", () => {
  const a = answerQuestionWithRules(structuredClone(baseContext), "Tell me something motivating");
  assert.ok(a.toLowerCase().includes("summary"), a);
});

test("never crashes on an empty question", () => {
  const a = answerQuestionWithRules(structuredClone(baseContext), "");
  assert.ok(typeof a === "string" && a.length > 0);
});
