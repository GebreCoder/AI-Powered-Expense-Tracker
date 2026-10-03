const db = require("../config/db");

exports.getSummary = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS net_balance
      FROM transactions WHERE user_id = $1`,
      [req.user.id],
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.getMonthlyTrend = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT TO_CHAR(transaction_date, 'YYYY-MM') AS month,
       SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
       FROM transactions WHERE user_id = $1 GROUP BY TO_CHAR(transaction_date, 'YYYY-MM') ORDER BY month`,
      [req.user.id],
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

exports.getCategoryBreakdown = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT c.name AS category_name, SUM(t.amount) AS total_spent
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1 AND t.type = 'expense'
       GROUP BY c.name ORDER BY total_spent DESC`,
      [req.user.id],
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};
