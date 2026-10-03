// Controlled generation of fictional transactions for the live simulator and
// the manual "Simulate Expense / Simulate Income" controls.
//
// Deliberately NOT an "infinite chaos engine": the pool is small, amounts are
// believable, and frequency is capped by the caller (simulator interval, one
// click at a time for the manual controls).

const MERCHANT_POOLS = {
  "Food & Dining": [
    { merchant: "Kaldi's Coffee", amount: [8, 22] },
    { merchant: "Tomoca Coffee", amount: [10, 26] },
    { merchant: "Yod Abyssinia", amount: [14, 32] },
    { merchant: "Shibel Buna", amount: [5, 15] },
  ],
  Groceries: [
    { merchant: "Friendship Supermarket", amount: [28, 95] },
    { merchant: "Shoa Supermarket", amount: [14, 48] },
  ],
  Transportation: [
    { merchant: "Anbessa City Bus", amount: [3, 12] },
    { merchant: "FuelStation — Bole", amount: [30, 58] },
    { merchant: "Blue Taxi (Ride)", amount: [9, 22] },
  ],
  Utilities: [{ merchant: "Ethiopian Electric Utility", amount: [300, 900] }],
  Entertainment: [
    { merchant: "Yoftahe Cinema", amount: [120, 300] },
    { merchant: "GameSphere Addis", amount: [150, 400] },
  ],
  Shopping: [
    { merchant: "Edna Mall", amount: [250, 900] },
    { merchant: "Gebeta Mall", amount: [200, 1100] },
  ],
  Health: [
    { merchant: "Addis Pharmacy", amount: [90, 400] },
    { merchant: "City Care Clinic", amount: [350, 800] },
  ],
  Subscriptions: [
    { merchant: "DStv", amount: 899 },
    { merchant: "Telebirr Top-Up", amount: [50, 200] },
  ],
};

const INCOME_POOL = [
  { merchant: "AddisTech Software PLC", amount: [1500, 9000], category: "Income" },
  { merchant: "Freelance Project", amount: [2000, 12000], category: "Income" },
  { merchant: "Telebirr Cashback", amount: [50, 400], category: "Income" },
  { merchant: "Interest Credit", amount: [100, 600], category: "Income" },
];

const EXPENSE_CATEGORIES = Object.keys(MERCHANT_POOLS);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function amountFor(poolEntry) {
  const [min, max] = Array.isArray(poolEntry.amount)
    ? poolEntry.amount
    : [poolEntry.amount, poolEntry.amount];
  if (min === max) return min;
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

/**
 * Generate a fictional expense entry for the demo ledger.
 */
function generateExpense() {
  const category = pick(EXPENSE_CATEGORIES);
  const entry = pick(MERCHANT_POOLS[category]);
  return {
    type: "expense",
    amount: amountFor(entry),
    merchantName: entry.merchant,
    category,
    description: entry.merchant,
  };
}

/**
 * Generate a fictional income entry for the demo ledger.
 */
function generateIncome() {
  const entry = pick(INCOME_POOL);
  return {
    type: "income",
    amount: amountFor(entry),
    merchantName: entry.merchant,
    category: entry.category,
    description: entry.merchant,
  };
}

module.exports = { generateExpense, generateIncome };
