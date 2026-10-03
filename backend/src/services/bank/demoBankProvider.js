// DemoBankProvider — first implementation of the BankProvider interface.
//
// It fronts the in-memory Demo Bank Ledger and exposes bank-shaped operations.
// The rest of the application (sync pipeline, controllers) must talk to this
// provider through the BankProvider registry (see bankProvider.js) so a real
// provider (e.g. PlaidBankProvider) can be swapped in later without touching
// the sync, categorization, budget, or insight logic.

const { DemoBankLedger } = require("./demoBankLedger");
const seedData = require("./seed/demoBanks");
const { maskAccountNumber } = require("./accountNumber");

// The simulated bank core. One instance per process = one consistent ledger.
const ledger = new DemoBankLedger();

const PREFIX = "demo";

function externalIdFor(accountNumber) {
  return `${PREFIX}:${String(accountNumber)}`;
}

function accountNumberFromExternal(externalAccountId) {
  const prefix = `${PREFIX}:`;
  if (String(externalAccountId).startsWith(prefix)) {
    return String(externalAccountId).slice(prefix.length);
  }
  return String(externalAccountId);
}

function toAccountView(seedAccount) {
  const institution = seedData.getInstitutionById(seedAccount.institutionId);
  return {
    externalAccountId: externalIdFor(seedAccount.accountNumber),
    accountNumber: seedAccount.accountNumber,
    accountNumberMasked: maskAccountNumber(seedAccount.accountNumber),
    accountName: seedAccount.name,
    accountType: seedAccount.type,
    currency: seedAccount.currency,
    currentBalance: ledger.getBalance(seedAccount.accountNumber),
    institutionId: seedAccount.institutionId,
    institutionName: institution ? institution.name : "Simulated Bank",
  };
}

const demoBankProvider = {
  id: "demo",
  name: "Simulated Bank Network",
  isSimulation: true,

  // ---- institution / account discovery (used by the Connect Bank UI) ----

  listInstitutions() {
    return seedData.getInstitutions();
  },

  listAvailableAccounts(institutionId) {
    const accounts = institutionId
      ? ledger.listSeedAccountsByInstitution(institutionId)
      : ledger.listSeedAccounts();
    return accounts.map((a) => ({
      institutionId: a.institutionId,
      accountNumber: a.accountNumber,
      accountNumberMasked: maskAccountNumber(a.accountNumber),
      name: a.name,
      type: a.type,
      currency: a.currency,
      currentBalance: a.currentBalance,
    }));
  },

  validateAccount(accountNumber) {
    return ledger.validateAndLocate(accountNumber);
  },

  // ---- connection lifecycle (mirrors a real bank's OAuth-style flow) ----

  /**
   * "Link" an account at the bank. In a real provider this would complete an
   * OAuth handshake; here it simply confirms the seeded account exists.
   */
  linkAccount(accountNumber) {
    const { valid, error, account } = ledger.validateAndLocate(accountNumber);
    if (!valid) throw new Error(error);
    return {
      externalConnectionId: `demo-conn-${account.accountNumber}`,
      account: toAccountView(account),
    };
  },

  /** Accounts visible under a connection (one per seeded account here). */
  getAccounts(connection) {
    const account = ledger.find(
      accountNumberFromExternal(connection.externalAccountId),
    );
    if (!account) return [];
    return [toAccountView(account)];
  },

  /** @param {string} externalAccountId — `demo:<13-digit number>` */
  getTransactions(externalAccountId) {
    return ledger.getTransactions(accountNumberFromExternal(externalAccountId));
  },

  getBalance(externalAccountId) {
    return ledger.getBalance(accountNumberFromExternal(externalAccountId));
  },

  getOpeningBalance(externalAccountId) {
    return ledger.getOpeningBalance(accountNumberFromExternal(externalAccountId));
  },

  /**
   * Post a transaction at the bank (manual demo control / background
   * simulator). Returns the created ledger entry.
   */
  postTransaction(externalAccountId, input) {
    return ledger.postTransaction(accountNumberFromExternal(externalAccountId), input);
  },

  /** A real provider would revoke the OAuth token; here it's a no-op. */
  disconnectAccount() {
    return true;
  },
};

module.exports = { demoBankProvider, ledger, externalIdFor, accountNumberFromExternal };
