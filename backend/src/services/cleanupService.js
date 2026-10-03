const db = require("../config/db");

const GRACE_PERIOD_DAYS = 30;

/**
 * Permanently delete accounts that have been soft-deleted for more than 30 days.
 * This removes all user data (cascade) and the user record itself.
 * 
 * Can be called:
 * - On a schedule (cron job)
 * - During server startup
 * - During login (lightweight check)
 */
async function cleanupExpiredAccounts() {
  try {
    // Find accounts deactivated more than 30 days ago
    const expired = await db.query(
      `SELECT id, username, deleted_at FROM users 
       WHERE deleted_at IS NOT NULL 
       AND deleted_at < NOW() - INTERVAL '${GRACE_PERIOD_DAYS} days'`
    );

    if (expired.rows.length === 0) {
      return { deleted: 0 };
    }

    console.log(
      `[cleanup] Permanently deleting ${expired.rows.length} expired account(s): ` +
      expired.rows.map((u) => u.username).join(", ")
    );

    // Delete each expired account (cascade handles related data)
    for (const user of expired.rows) {
      await db.query("DELETE FROM users WHERE id = $1", [user.id]);
    }

    return { deleted: expired.rows.length };
  } catch (error) {
    console.error("[cleanup] Error cleaning up expired accounts:", error.message);
    return { deleted: 0, error: error.message };
  }
}

module.exports = { cleanupExpiredAccounts, GRACE_PERIOD_DAYS };
