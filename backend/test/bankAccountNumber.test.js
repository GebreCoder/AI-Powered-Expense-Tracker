const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateAccountNumber,
  buildAccountNumber,
  maskAccountNumber,
} = require("../src/services/bank/accountNumber");
const seedData = require("../src/services/bank/seed/demoBanks");

test("valid 13-digit demo account numbers pass validation", () => {
  for (const valid of ["1234567890128", "9876543210982", "4567890123456"]) {
    assert.deepEqual(validateAccountNumber(valid), { valid: true, error: undefined }, valid);
  }
});

test("every seeded account number passes validation", () => {
  for (const account of seedData.getAccounts()) {
    assert.equal(
      validateAccountNumber(account.accountNumber).valid,
      true,
      `seeded account ${account.accountNumber} must be valid`,
    );
    assert.equal(account.accountNumber.length, 13);
    assert.match(account.accountNumber, /^\d{13}$/);
  }
});

test("wrong lengths are rejected", () => {
  for (const value of ["123456789012", "12345678901234"]) {
    const { valid, error } = validateAccountNumber(value);
    assert.equal(valid, false);
    assert.match(error, /exactly 13 digits/);
  }
});

test("non-digit input is rejected", () => {
  for (const value of ["12345678901ab", "1234 5678 9012", "1234567890a23", "abc"]) {
    const { valid, error } = validateAccountNumber(value);
    assert.equal(valid, false);
    assert.match(error, /digits only/);
  }
});

test("empty input is rejected", () => {
  const { valid, error } = validateAccountNumber("");
  assert.equal(valid, false);
  assert.match(error, /required/);
});

test("a bad checksum digit is rejected", () => {
  // 1234567890128 is valid; flipping the check digit must fail.
  const { valid, error } = validateAccountNumber("1234567890129");
  assert.equal(valid, false);
  assert.match(error, /failed validation/);
});

test("a single digit typo is rejected (weighted sum is sensitive)", () => {
  // Change the 4th digit of a valid number.
  const { valid } = validateAccountNumber("1235567890128");
  assert.equal(valid, false);
});

test("buildAccountNumber produces a number that passes validation", () => {
  const built = buildAccountNumber("111222333444");
  assert.equal(built.length, 13);
  assert.equal(validateAccountNumber(built).valid, true);
  assert.throws(() => buildAccountNumber("12345"), /exactly 12 digits/);
});

test("maskAccountNumber keeps only the last four digits", () => {
  assert.equal(maskAccountNumber("1234567890128"), "••••••••••0128");
  assert.equal(maskAccountNumber("short"), "••••••••••••");
});
