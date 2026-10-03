const db = require("../config/db");

exports.createCategory = async (req, res, next) => {
  try {
    const { name, icon, color } = req.body;
    if (!name)
      return res.status(400).json({ error: "Category name is required" });

    const result = await db.query(
      "INSERT INTO categories (user_id, name, icon, color) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.user.id, name, icon || null, color || null],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT * FROM categories WHERE user_id = $1 ORDER BY created_at DESC",
      [req.user.id],
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id))
      return res.status(404).json({ error: "Category not found" });

    const { name, icon, color } = req.body;
    const result = await db.query(
      "UPDATE categories SET name = COALESCE($1, name), icon = COALESCE($2, icon), color = COALESCE($3, color) WHERE id = $4 AND user_id = $5 RETURNING *",
      [name, icon, color, req.params.id, req.user.id],
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Category not found" });

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id))
      return res.status(404).json({ error: "Category not found" });

    const result = await db.query(
      "DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.user.id],
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Category not found" });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
