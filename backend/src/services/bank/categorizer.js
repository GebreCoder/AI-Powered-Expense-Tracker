// Categorizer — maps a provider's transaction category to one of the user's
// categories, creating a sensible default category on first use (the same way
// real budgeting apps auto-create categories when a new bank transaction
// arrives). This is what makes budgets and insights "just work" immediately
// after a bank account is connected.

const db = require("../../config/db");

// Provider category -> default { name, icon, color }.
// Icon names match the frontend's ICON_OPTIONS (components/icons.jsx).
const DEFAULT_CATEGORY_BY_PROVIDER = {
  "Food & Dining": { name: "Food & Dining", icon: "utensils", color: "#f97316" },
  Groceries: { name: "Groceries", icon: "shopping-cart", color: "#2ebd59" },
  Transportation: { name: "Transportation", icon: "car", color: "#0ea5e9" },
  Utilities: { name: "Utilities", icon: "zap", color: "#f0b429" },
  Entertainment: { name: "Entertainment", icon: "film", color: "#8b5cf6" },
  Shopping: { name: "Shopping", icon: "shopping-bag", color: "#e2483d" },
  Subscriptions: { name: "Subscriptions", icon: "smartphone", color: "#3b82f6" },
  Health: { name: "Health", icon: "heart", color: "#f2554c" },
  Rent: { name: "Rent", icon: "home", color: "#64748b" },
  Transfers: { name: "Transfers", icon: "wallet", color: "#64748b" },
  Income: { name: "Income", icon: "briefcase", color: "#1e9e50" },
};

const FALLBACK = { name: null, icon: "wallet", color: "#64748b" };

function defaultFor(providerCategory) {
  if (!providerCategory) return FALLBACK;
  return (
    DEFAULT_CATEGORY_BY_PROVIDER[providerCategory] ||
    DEFAULT_CATEGORY_BY_PROVIDER[
      Object.keys(DEFAULT_CATEGORY_BY_PROVIDER).find(
        (key) => key.toLowerCase() === String(providerCategory).toLowerCase(),
      )
    ] ||
    FALLBACK
  );
}

/**
 * Resolve a provider category name to the user's category id, creating the
 * category (with a sensible icon/color) the first time it is seen.
 * @param {number} userId
 * @param {string|null} providerCategory
 * @returns {Promise<number|null>}
 */
async function resolveCategoryId(userId, providerCategory) {
  const name = String(providerCategory || "").trim();
  if (!name) return null;

  const found = await db.query(
    "SELECT id FROM categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)",
    [userId, name],
  );
  if (found.rows[0]) return found.rows[0].id;

  const defaults = defaultFor(name);
  const displayName = defaults.name || name;
  try {
    const created = await db.query(
      `INSERT INTO categories (user_id, name, icon, color)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, displayName, defaults.icon, defaults.color],
    );
    return created.rows[0].id;
  } catch {
    // Concurrent sync created it between our SELECT and INSERT — re-read.
    const retry = await db.query(
      "SELECT id FROM categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)",
      [userId, displayName],
    );
    return retry.rows[0] ? retry.rows[0].id : null;
  }
}

module.exports = { resolveCategoryId, DEFAULT_CATEGORY_BY_PROVIDER };
