const db = require("../config/db");
const { invalidateInsights } = require("../services/insightsService");

exports.createBudget = async (req, res, next) => {
  try {
    const { categoryId, amount, period, startDate, endDate } = req.body;
    if (!categoryId || !amount || !startDate)
      return res
        .status(400)
        .json({ error: "Category, amount, and start date are required" });

    const result = await db.query(
      "INSERT INTO budgets (user_id, category_id, amount, period, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [
        req.user.id,
        categoryId,
        amount,
        period || "monthly",
        startDate,
        endDate || null,
      ],
    );

    invalidateInsights(req.user.id).catch(() => {});

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.getBudgets = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT b.*, c.name AS category_name,
       COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS spent
       FROM budgets b
       LEFT JOIN categories c ON c.id = b.category_id
       LEFT JOIN transactions t ON t.user_id = b.user_id AND t.category_id = b.category_id
       WHERE b.user_id = $1
       GROUP BY b.id, c.id
       ORDER BY b.created_at DESC`,
      [req.user.id],
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

exports.updateBudget = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id))
      return res.status(404).json({ error: "Budget not found" });

    const { categoryId, amount, period, startDate, endDate } = req.body;
    const result = await db.query(
      "UPDATE budgets SET category_id = COALESCE($1, category_id), amount = COALESCE($2, amount), period = COALESCE($3, period), start_date = COALESCE($4, start_date), end_date = COALESCE($5, end_date) WHERE id = $6 AND user_id = $7 RETURNING *",
      [
        categoryId,
        amount,
        period,
        startDate,
        endDate,
        req.params.id,
        req.user.id,
      ],
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Budget not found" });

    invalidateInsights(req.user.id).catch(() => {});

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.deleteBudget = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id))
      return res.status(404).json({ error: "Budget not found" });

    const result = await db.query(
      "DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.user.id],
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Budget not found" });

    invalidateInsights(req.user.id).catch(() => {});

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
