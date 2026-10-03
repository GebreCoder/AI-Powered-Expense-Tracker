// Seed data for the Demo Bank simulation.
//
// A small, clean universe: three institutions styled after Ethiopian banks and
// six fictional accounts with opening balances. There is NO pre-seeded
// transaction history — accounts start clean and the user controls everything
// from there (manual entries, the Simulate buttons, the demo sequence, and the
// background simulator).
//
// Institution NAMES are used for demonstration purposes only. All account
// numbers and balances are FICTIONAL — this feature never connects to a real
// bank, never moves real money, and never touches real financial data.
// Account numbers satisfy the demo checksum in services/bank/accountNumber.js
// so they behave like "valid" demo accounts.

const { buildAccountNumber } = require("../accountNumber");

const INSTITUTIONS = [
  { id: "anbessa", name: "Anbessa Bank", color: "#d9a441" },
  { id: "cbe", name: "Commercial Bank of Ethiopia", color: "#1e6fd9" },
  { id: "dashen", name: "Dashen Bank", color: "#c0392b" },
];

// 13-digit account identifiers (12-digit prefix) — check digits are computed
// so every seeded account passes demo validation.
const ACCOUNTS = [
  {
    institutionId: "anbessa",
    accountNumber: buildAccountNumber("123456789012"),
    name: "Primary Checking",
    type: "checking",
    currency: "ETB",
    currentBalance: 85000,
  },
  {
    institutionId: "anbessa",
    accountNumber: buildAccountNumber("987654321098"),
    name: "Everyday Account",
    type: "checking",
    currency: "ETB",
    currentBalance: 42500,
  },
  {
    institutionId: "anbessa",
    accountNumber: buildAccountNumber("456789012345"),
    name: "Savings Account",
    type: "savings",
    currency: "ETB",
    currentBalance: 150000,
  },
  {
    institutionId: "cbe",
    accountNumber: buildAccountNumber("555123456789"),
    name: "Everyday Account",
    type: "checking",
    currency: "ETB",
    currentBalance: 23000,
  },
  {
    institutionId: "cbe",
    accountNumber: buildAccountNumber("111222333444"),
    name: "Cash Plus Account",
    type: "checking",
    currency: "ETB",
    currentBalance: 8700,
  },
  {
    institutionId: "dashen",
    accountNumber: buildAccountNumber("777888999000"),
    name: "Salary Account",
    type: "checking",
    currency: "ETB",
    currentBalance: 61000,
  },
];

// ---------- lookups ----------

function getInstitutions() {
  return INSTITUTIONS.map(({ id, name }) => ({ id, name }));
}

function getInstitutionById(id) {
  return INSTITUTIONS.find((i) => i.id === id) || null;
}

function getAccounts() {
  return ACCOUNTS;
}

function getAccountByNumber(accountNumber) {
  return ACCOUNTS.find((a) => a.accountNumber === String(accountNumber)) || null;
}

module.exports = {
  INSTITUTIONS,
  ACCOUNTS,
  getInstitutions,
  getInstitutionById,
  getAccounts,
  getAccountByNumber,
};
