const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DemoBankLedger } = require("../src/services/bank/demoBankLedger");
const seedData = require("../src/services/bank/seed/demoBanks");

function freshLedger() {
  return new DemoBankLedger();
}

test("accounts start clean — no transaction history until posted", () => {
  const ledger = freshLedger();
  assert.deepEqual(ledger.getTransactions("1234567890128"), []);
});

test("opening balance equals the seeded balance when nothing was posted", () => {
  const ledger = freshLedger();
  const number = "1234567890128";
  const seed = seedData.getAccountByNumber(number);
  assert.equal(ledger.getOpeningBalance(number), seed.currentBalance);
  assert.equal(ledger.getBalance(number), seed.currentBalance);
});

test("postTransaction updates the ledger balance consistently", () => {
  const ledger = freshLedger();
  const number = "1234567890128";
  const before = ledger.getBalance(number);

  ledger.postTransaction(number, {
    type: "expense",
    amount: 50,
    merchantName: "Test Shop",
    category: "Shopping",
  });
  assert.equal(ledger.getBalance(number), before - 50);

  ledger.postTransaction(number, {
    type: "income",
    amount: 200,
    merchantName: "Test Credit",
    category: "Income",
  });
  assert.equal(ledger.getBalance(number), before - 50 + 200);

  // Posted entries carry unique, timestamped ids.
  const ids = ledger.getTransactions(number).map((t) => t.externalId);
  assert.equal(ids.length, 2);
  assert.ok(ids.every((id) => id.startsWith("sim-")), "live ids use the sim- prefix");
  assert.equal(new Set(ids).size, ids.length, "no duplicate ids");
});

test("posted transactions carry valid provider shapes", () => {
  const ledger = freshLedger();
  ledger.postTransaction("1234567890128", {
    type: "expense",
    amount: 12.5,
    merchantName: "Kaldi's Coffee",
    category: "Food & Dining",
  });
  const [entry] = ledger.getTransactions("1234567890128");
  assert.match(entry.externalId, /^sim-1234567890128-\d+-\d+$/);
  assert.match(entry.transactionDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(entry.amount, 12.5);
  assert.equal(entry.type, "expense");
  assert.equal(entry.merchantName, "Kaldi's Coffee");
  assert.equal(entry.category, "Food & Dining");
  assert.equal(entry.status, "posted");
  assert.equal(entry.currency, "ETB");
});

test("postTransaction rejects invalid input", () => {
  const ledger = freshLedger();
  assert.throws(
    () =>
      ledger.postTransaction("1234567890128", { type: "expense", amount: -5 }),
    /positive/,
  );
  assert.throws(
    () => ledger.postTransaction("1234567890128", { type: "expense", amount: 0 }),
    /positive/,
  );
});

test("unknown accounts are not found and have empty ledgers", () => {
  const ledger = freshLedger();
  assert.equal(ledger.find("0000000000000"), null);
  assert.deepEqual(ledger.getTransactions("0000000000000"), []);
  const { valid } = ledger.validateAndLocate("0000000000000");
  assert.equal(valid, false);
});

test("validateAndLocate rejects a valid-format but unseeded number", () => {
  const ledger = freshLedger();
  // 5555555555550 has a valid checksum but is not a seeded account.
  const { valid, error } = ledger.validateAndLocate("5555555555550");
  assert.equal(valid, false);
  assert.match(error, /couldn't find that demo account/);
});

test("discovery lists every seeded institution and account", () => {
  const ledger = freshLedger();
  const institutions = seedData.getInstitutions();
  assert.equal(institutions.length, 3);
  const accounts = ledger.listSeedAccounts();
  assert.equal(accounts.length, seedData.getAccounts().length);
  for (const account of accounts) {
    assert.equal(typeof account.currentBalance, "number");
    assert.equal(typeof account.name, "string");
    assert.equal(account.currency, "ETB");
  }
});
