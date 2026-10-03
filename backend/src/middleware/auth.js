const jwt = require("jsonwebtoken");
const db = require("../config/db");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userResult = await db.query(
      "SELECT id, email, full_name, token_version, deleted_at FROM users WHERE id = $1",
      [decoded.userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Reject deactivated accounts (soft deleted)
    if (userResult.rows[0].deleted_at) {
      return res.status(401).json({ error: "Account not found" });
    }

    const user = userResult.rows[0];

    // Session revocation: tokens signed with an older version are rejected.
    // Tokens issued before this feature existed carry no version and still pass.
    if (
      decoded.v !== undefined &&
      Number(decoded.v) !== Number(user.token_version)
    ) {
      return res.status(401).json({ error: "Session ended. Please sign in again." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
};

module.exports = authMiddleware;
