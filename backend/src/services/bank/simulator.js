// Background simulator — DISABLED.
//
// Automatic timed/background transaction generation has been removed.
// Simulated transactions are now only created when the user explicitly
// clicks "Simulate Expense" or "Simulate Income" (via the /simulate API
// endpoint, which goes through bankSyncService.simulateTransaction).
//
// This file is kept as a no-op stub so existing imports do not break.

/** Start — no-op. Background auto-simulation is disabled. */
function start() {
  // Intentionally empty: transactions are only created by manual user action.
}

/** Stop — no-op. */
function stop() {
  // Intentionally empty: no background timer to clear.
}

module.exports = { start, stop };
