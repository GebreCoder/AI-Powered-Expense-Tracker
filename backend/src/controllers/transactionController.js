const db = require("../config/db");
const { invalidateInsights } = require("../services/insightsService");

const VALID_TYPES = new Set(["expense", "income"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Normalize a provided optional field: empty string means "no value".
// Fields that were not sent at all (undefined) are left undefined so callers
// can distinguish "keep the old value" (omitted) from "clear it" (null).
const toNullable = (value) =>
  value === undefined ? undefined : value === "" ? null : value;

function isValidDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  // Reject impossible calendar dates (e.g. Feb 30) that JS rolls over.
  const parts = value.split("-").map(Number);
  return (
    d.getUTCFullYear() === parts[0] &&
    d.getUTCMonth() + 1 === parts[1] &&
    d.getUTCDate() === parts[2]
  );
}

// categoryId must be a positive integer when provided.
function isValidCategoryId(value) {
  return value === null || (/^\d+$/.test(String(value)) && Number(value) > 0);
}

function validateTransaction(body, { partial = false } = {}) {
  const { categoryId, type, amount, description, transactionDate } = body;

  if (!partial || type !== undefined) {
    if (type === undefined || type === null || type === "") {
      return { error: "Type is required" };
    }
    if (!VALID_TYPES.has(type)) {
      return { error: "Type must be 'expense' or 'income'" };
    }
  }

  if (!partial || amount !== undefined) {
    if (amount === undefined || amount === null || amount === "") {
      return { error: "Amount is required" };
    }
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      return { error: "Amount must be a number greater than zero" };
    }
  }

  if (!partial || transactionDate !== undefined) {
    if (transactionDate === undefined || transactionDate === null || transactionDate === "") {
      return { error: "Transaction date is required" };
    }
    if (!isValidDate(transactionDate)) {
      return { error: "Transaction date must be in YYYY-MM-DD format" };
    }
  }

  return {
    data: {
      type,
      amount: amount === undefined ? undefined : Number(amount),
      transactionDate,
      description: toNullable(description),
      categoryId: toNullable(categoryId),
    },
  };
}

// Ensure a provided category actually belongs to the requesting user, so we
// never create orphaned rows or leak another user's category.
async function categoryOwnedByUser(categoryId, userId) {
  if (categoryId === null || categoryId === undefined) return true;
  const result = await db.query(
    "SELECT id FROM categories WHERE id = $1 AND user_id = $2",
    [categoryId, userId],
  );
  return result.rows.length > 0;
}

exports.createTransaction = async (req, res, next) => {
  try {
    const { error, data } = validateTransaction(req.body);
    if (error) return res.status(400).json({ error });

    // Omitted (undefined) and explicit null both mean "no category".
    const categoryId =
      data.categoryId === null || data.categoryId === undefined
        ? null
        : Number(data.categoryId);
    if (!isValidCategoryId(categoryId)) {
      return res.status(400).json({ error: "Category must be a positive number" });
    }
    if (!(await categoryOwnedByUser(categoryId, req.user.id))) {
      return res.status(400).json({ error: "Category not found" });
    }

    const result = await db.query(
      "INSERT INTO transactions (user_id, category_id, type, amount, description, transaction_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [req.user.id, categoryId, data.type, data.amount, data.description, data.transactionDate],
    );

    // Insights summarize financial data — clear the cache (fire-and-forget)
    // so the next dashboard load shows fresh ones.
    invalidateInsights(req.user.id).catch(() => {});

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.getTransactions = async (req, res, next) => {
  try {
    const { type, categoryId, startDate, endDate } = req.query;
    let query =
      "SELECT t.*, c.name AS category_name FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE t.user_id = $1";
    const params = [req.user.id];
    let index = 2;

    if (type) {
      query += ` AND t.type = $${index}`;
      params.push(type);
      index += 1;
    }

    if (categoryId) {
      query += ` AND t.category_id = $${index}`;
      params.push(categoryId);
      index += 1;
    }

    if (startDate) {
      query += ` AND t.transaction_date >= $${index}`;
      params.push(startDate);
      index += 1;
    }

    if (endDate) {
      query += ` AND t.transaction_date <= $${index}`;
      params.push(endDate);
      index += 1;
    }

    query += " ORDER BY t.transaction_date DESC, t.created_at DESC";

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

exports.updateTransaction = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const { error, data } = validateTransaction(req.body, { partial: true });
    if (error) return res.status(400).json({ error });

    // Build the SET clause only from fields the client actually sent, so a
    // partial update can't wipe fields it didn't include. Explicit nulls
    // clear nullable columns (description, category_id).
    const sets = [];
    const params = [];
    let index = 1;
    const push = (column, value) => {
      sets.push(`${column} = $${index}`);
      params.push(value);
      index += 1;
    };

    if (data.description !== undefined) push("description", data.description);
    if (data.categoryId !== undefined) {
      const categoryId = data.categoryId === null ? null : Number(data.categoryId);
      if (!isValidCategoryId(categoryId)) {
        return res.status(400).json({ error: "Category must be a positive number" });
      }
      if (!(await categoryOwnedByUser(categoryId, req.user.id))) {
        return res.status(400).json({ error: "Category not found" });
      }
      push("category_id", categoryId);
    }
    if (data.type !== undefined) push("type", data.type);
    if (data.amount !== undefined) push("amount", data.amount);
    if (data.transactionDate !== undefined) push("transaction_date", data.transactionDate);

    if (sets.length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    params.push(req.params.id, req.user.id);
    const result = await db.query(
      `UPDATE transactions SET ${sets.join(", ")} WHERE id = $${index} AND user_id = $${index + 1} RETURNING *`,
      params,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    invalidateInsights(req.user.id).catch(() => {});

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.deleteTransaction = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const result = await db.query(
      "DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    invalidateInsights(req.user.id).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTransaction: exports.createTransaction,
  getTransactions: exports.getTransactions,
  updateTransaction: exports.updateTransaction,
  deleteTransaction: exports.deleteTransaction,
  // Exported for unit tests (no DB required).
  validateTransaction,
  isValidDate,
  isValidCategoryId,
};
