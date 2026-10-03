const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateTransaction,
  isValidDate,
  isValidCategoryId,
} = require("../src/controllers/transactionController");

const validCreate = {
  type: "expense",
  amount: 10.5,
  transactionDate: "2026-08-06",
  description: "Lunch",
  categoryId: 3,
};

test("accepts a valid create payload", () => {
  const { error, data } = validateTransaction(validCreate);
  assert.equal(error, undefined);
  assert.equal(data.amount, 10.5);
  assert.equal(data.description, "Lunch");
  assert.equal(data.categoryId, 3);
});

test("rejects missing type", () => {
  const { type, ...rest } = validCreate;
  const { error } = validateTransaction(rest);
  assert.ok(error.includes("Type"));
});

test("rejects invalid type", () => {
  const { error } = validateTransaction({ ...validCreate, type: "transfer" });
  assert.ok(error.includes("'expense' or 'income'"));
});

test("rejects zero, negative, and non-numeric amounts", () => {
  for (const amount of [0, -5, "abc", NaN, null]) {
    const { error } = validateTransaction({ ...validCreate, amount });
    assert.ok(error && error.includes("Amount"), `expected amount error for ${amount}`);
  }
});

test("rejects missing or malformed dates", () => {
  for (const transactionDate of [null, "", "06/08/2026", "2026-13-40"]) {
    const { error } = validateTransaction({ ...validCreate, transactionDate });
    assert.ok(error && error.includes("Transaction date"), `expected date error for ${transactionDate}`);
  }
});

test("rejects impossible calendar dates like Feb 30", () => {
  assert.equal(isValidDate("2026-02-30"), false);
  assert.equal(isValidDate("2026-08-06"), true);
});

test("rejects non-numeric category ids", () => {
  assert.equal(isValidCategoryId("abc"), false);
  assert.equal(isValidCategoryId(0), false);
  assert.equal(isValidCategoryId("7"), true);
  assert.equal(isValidCategoryId(null), true);
});

test("normalizes empty description/category to null on create", () => {
  const { data } = validateTransaction({
    type: "income",
    amount: 100,
    transactionDate: "2026-08-06",
    description: "",
    categoryId: "",
  });
  assert.equal(data.description, null);
  assert.equal(data.categoryId, null);
});

test("create without a category is allowed (categoryId stays undefined -> null at insert)", () => {
  const { error, data } = validateTransaction({
    type: "income",
    amount: 2500,
    transactionDate: "2026-08-12",
    description: "Freelance payment",
  });
  assert.equal(error, undefined);
  assert.equal(data.categoryId, undefined);
  // Mirrors the controller normalization: omitted behaves like null.
  const normalized =
    data.categoryId === null || data.categoryId === undefined ? null : Number(data.categoryId);
  assert.equal(normalized, null);
  assert.equal(isValidCategoryId(normalized), true);
});

test("partial update: omitted description/category stay undefined (not null)", () => {
  const { data } = validateTransaction({ amount: 99 }, { partial: true });
  assert.equal(data.description, undefined);
  assert.equal(data.categoryId, undefined);
  assert.equal(data.amount, 99);
});

test("partial update: explicit null clears description, empty string clears category", () => {
  const cleared = validateTransaction({ description: null, categoryId: "" }, { partial: true });
  assert.equal(cleared.data.description, null);
  assert.equal(cleared.data.categoryId, null);
});

test("partial update: omitted required fields are not validated", () => {
  const { error, data } = validateTransaction({ description: "only this" }, { partial: true });
  assert.equal(error, undefined);
  assert.equal(data.description, "only this");
  assert.equal(data.type, undefined);
  assert.equal(data.amount, undefined);
});
