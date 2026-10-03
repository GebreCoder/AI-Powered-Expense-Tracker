// BankProvider — the interface every bank provider implements.
//
// The application's bank logic (sync pipeline, categorization, controllers,
// simulator) depends only on this interface, never on a concrete provider.
// That is what lets a real provider (e.g. PlaidBankProvider) be added later
// without rewriting the transaction/budget/insight logic.
//
// Interface contract
// ------------------
//   id                     string                    unique provider key ("demo")
//   name                   string                    display name
//   isSimulation           boolean                   true = fictional data
//
//   listInstitutions()                              -> [{ id, name }]
//   listAvailableAccounts(institutionId?)           -> [{ institutionId, accountNumber,
//                                                         accountNumberMasked, name, type,
//                                                         currency, currentBalance }]
//   validateAccount(accountNumber)                  -> { valid, error?, account? }
//   linkAccount(accountNumber)                      -> { externalConnectionId, account }
//   getAccounts(connection)                         -> [{ externalAccountId, accountNumber,
//                                                         accountNumberMasked, accountName,
//                                                         accountType, currency, currentBalance }]
//   getTransactions(externalAccountId)              -> [{ externalId, merchantName, description,
//                                                         amount, type, category,
//                                                         transactionDate, status, currency }]
//   getBalance(externalAccountId)                   -> number
//   postTransaction(externalAccountId, input)       -> ledger entry (see getTransactions shape)
//   disconnectAccount(externalConnectionId)         -> void
//
// Sync-safe rules for provider data:
//   * `externalId` must be stable for the same bank transaction forever —
//     the sync pipeline relies on it for deduplication.
//   * `type` is 'expense' | 'income'; `amount` is always a positive number.
//   * `transactionDate` is 'YYYY-MM-DD'.

const { demoBankProvider } = require("./demoBankProvider");

const PROVIDERS = new Map([[demoBankProvider.id, demoBankProvider]]);

/**
 * Resolve a provider by id.
 * @param {string} providerId
 * @returns provider object (BankProvider interface)
 * @throws if the provider id is unknown
 */
function getProvider(providerId) {
  const provider = PROVIDERS.get(providerId);
  if (!provider) {
    throw new Error(`Unknown bank provider: ${providerId}`);
  }
  return provider;
}

/** All registered providers. */
function listProviders() {
  return Array.from(PROVIDERS.values()).map((p) => ({
    id: p.id,
    name: p.name,
    isSimulation: p.isSimulation,
  }));
}

module.exports = { getProvider, listProviders };
