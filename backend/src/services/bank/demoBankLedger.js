// Demo Bank Ledger — the simulated bank's book of records.
//
// This is the "bank side" of the simulation: it owns each demo account's
// balance and posted transactions, exactly as a real bank's core ledger would.
// The rest of the application never touches it directly — it goes through
// DemoBankProvider (and ultimately the BankProvider interface).
//
// Accounts start clean (an opening balance, no transaction history); every
// transaction is created live through postTransaction (the Simulate buttons,
// the demo sequence, or the background simulator). Posted entries carry
// timestamped ids, so they are never duplicated by the sync pipeline's dedup.
//
// State is in-memory by design: a server restart resets the live ledger
// (balances revert to the seeded opening values). This is an acceptable,
// documented demo tradeoff — no real money or accounts are involved.

const seedData = require("./seed/demoBanks");
const { validateAccountNumber } = require("./accountNumber");

function maskForLogging(accountNumber) {
  const digits = String(accountNumber).replace(/\D/g, "");
  return `••••••••••${digits.slice(-4)}`;
}

class DemoBankLedger {
  constructor() {
    this.accounts = new Map();
    for (const seed of seedData.getAccounts()) {
      this.accounts.set(seed.accountNumber, {
        seed,
        posted: [],
        seq: 0,
      });
    }
  }

  /** @param {string} accountNumber */
  find(accountNumber) {
    const record = this.accounts.get(String(accountNumber));
    return record ? record.seed : null;
  }

  /** All seeded accounts (for the demo "available accounts" discovery UI). */
  listSeedAccounts() {
    return seedData
      .getAccounts()
      .map((a) => ({ ...a, history: undefined, profile: undefined }));
  }

  /** Accounts belonging to one institution. */
  listSeedAccountsByInstitution(institutionId) {
    return this.listSeedAccounts().filter(
      (a) => a.institutionId === institutionId,
    );
  }

  /**
   * Validate an account number against demo rules AND confirm it exists
   * in the seeded ledger. Returns { valid, error }.
   */
  validateAndLocate(accountNumber) {
    const { valid, error } = validateAccountNumber(accountNumber);
    if (!valid) return { valid, error };
    const account = this.find(accountNumber);
    if (!account) {
      return {
        valid: false,
        error: "We couldn't find that demo account. Choose one of the available demo accounts.",
      };
    }
    return { valid: true, account };
  }

  /**
   * All ledger transactions for an account: the live posted entries, newest
   * first. Each entry is shaped for the provider:
   *   { externalId, merchantName, description, amount, type, category,
   *     transactionDate, status, currency }
   */
  getTransactions(accountNumber) {
    const record = this.accounts.get(String(accountNumber));
    if (!record) return [];
    return [...record.posted].sort((a, b) =>
      b.transactionDate.localeCompare(a.transactionDate),
    );
  }

  /**
   * Current balance = seeded balance + net effect of live posts.
   * Deterministic and consistent for a given ledger state.
   */
  getBalance(accountNumber) {
    const record = this.accounts.get(String(accountNumber));
    if (!record) return 0;
    const net = record.posted.reduce((sum, t) => {
      const signed = t.type === "income" ? t.amount : -t.amount;
      return sum + signed;
    }, 0);
    return Math.round((record.seed.currentBalance + net) * 100) / 100;
  }

  /** Opening balance (what the account starts with before any live posts). */
  getOpeningBalance(accountNumber) {
    const record = this.accounts.get(String(accountNumber));
    if (!record) return 0;
    return record.seed.currentBalance;
  }

  /**
   * Post a new transaction to the ledger (used by the live simulator and the
   * manual "Simulate Transaction" controls). Returns the created entry.
   *
   * @param {string} accountNumber
   * @param {{ type: 'expense'|'income', amount: number, merchantName: string,
   *           category?: string, description?: string, transactionDate?: string }} input
   */
  postTransaction(accountNumber, input) {
    const record = this.accounts.get(String(accountNumber));
    if (!record) throw new Error("Demo account not found in ledger");
    const amount = Math.round(Number(input.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Amount must be a positive number");
    }
    const type = input.type === "income" ? "income" : "expense";
    record.seq += 1;
    const entry = {
      externalId: `sim-${accountNumber}-${Date.now()}-${record.seq}`,
      merchantName: input.merchantName || (type === "income" ? "Cash Credit" : "Demo Purchase"),
      description: input.description || input.merchantName || "",
      amount,
      type,
      category: input.category || (type === "income" ? "Income" : "Shopping"),
      transactionDate: input.transactionDate || new Date().toISOString().slice(0, 10),
      status: "posted",
      currency: record.seed.currency,
    };
    record.posted.push(entry);
    return entry;
  }

  /** Count of live posts (used by the simulator to pace generation). */
  postedCount(accountNumber) {
    const record = this.accounts.get(String(accountNumber));
    return record ? record.posted.length : 0;
  }
}

module.exports = { DemoBankLedger, maskForLogging };
