const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const PUBLIC_COLUMNS =
  "id, username, email, full_name, created_at, currency, avatar_color, avatar_image";

const USERNAME_RE = /^[a-z0-9_.-]{3,20}$/;

const userShape = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  full_name: row.full_name,
  created_at: row.created_at,
  currency: row.currency || "ETB",
  avatar_color: row.avatar_color || null,
  avatar_image: row.avatar_image || null,
});

const signToken = (user) =>
  jwt.sign(
    { userId: user.id, v: user.token_version },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

const ALLOWED_CURRENCIES = new Set([
  "USD",
  "EUR",
  "GBP",
  "ETB",
  "KES",
  "NGN",
  "ZAR",
  "INR",
  "JPY",
  "CAD",
  "AUD",
]);

exports.register = async (req, res, next) => {
  try {
    const { username, email, password, fullName } = req.body;

    if (!username || !email || !password || !fullName) {
      return res
        .status(400)
        .json({ error: "Username, email, password, and full name are required" });
    }

    const normalizedUsername = String(username).trim().toLowerCase();
    if (!USERNAME_RE.test(normalizedUsername)) {
      return res
        .status(400)
        .json({
          error: "Username must be 3-20 characters using letters, numbers, _ . or -",
        });
    }

    const existing = await db.query(
      "SELECT id, username FROM users WHERE email = $1 OR username = $2",
      [email, normalizedUsername],
    );
    if (existing.rows.length > 0) {
      const usernameTaken = existing.rows.some(
        (row) => row.username === normalizedUsername,
      );
      return res
        .status(409)
        .json({
          error: usernameTaken ? "Username already taken" : "Email already registered",
        });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ($1, $2, $3, $4)
       RETURNING ${PUBLIC_COLUMNS}, token_version`,
      [normalizedUsername, email, passwordHash, fullName],
    );

    const user = result.rows[0];
    const token = signToken(user);

    res.status(201).json({ token, user: userShape(user) });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const result = await db.query(
      `SELECT ${PUBLIC_COLUMNS}, password_hash, token_version, deleted_at FROM users WHERE username = $1`,
      [String(username).trim().toLowerCase()],
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Reject deactivated accounts — show generic error to avoid leaking info
    if (result.rows[0].deleted_at) {
      return res.status(401).json({ error: "Account not found" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken(user);

    res.json({ token, user: userShape(user) });
  } catch (error) {
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`,
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(userShape(result.rows[0]));
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { username, fullName, email, avatarColor, currency, avatarImage, currentPassword } = req.body;
    const userId = req.user.id;

    const current = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
    const user = current.rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const updates = [];
    const values = [];
    const push = (col, val) => {
      values.push(val);
      updates.push(`${col} = $${values.length}`);
    };

    if (fullName !== undefined) {
      const name = String(fullName || "").trim();
      if (!name) return res.status(400).json({ error: "Full name is required" });
      push("full_name", name);
    }

    if (avatarColor !== undefined) {
      push("avatar_color", avatarColor ? String(avatarColor) : null);
    }

    if (avatarImage !== undefined) {
      const img = avatarImage ? String(avatarImage) : null;
      if (img) {
        const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(img);
        if (!m) {
          return res.status(400).json({ error: "Unsupported image format" });
        }
        const bytes = Math.floor((m[2].length * 3) / 4);
        if (bytes > 5 * 1024 * 1024) {
          return res.status(400).json({ error: "Image must be 5 MB or smaller" });
        }
        push("avatar_image", img);
      } else {
        push("avatar_image", null);
      }
    }

    if (currency !== undefined) {
      const code = String(currency || "USD").toUpperCase();
      if (!ALLOWED_CURRENCIES.has(code)) {
        return res.status(400).json({ error: "Unsupported currency" });
      }
      push("currency", code);
    }

    if (
      username !== undefined &&
      String(username).trim().toLowerCase() !== (user.username || "").toLowerCase()
    ) {
      const newUsername = String(username).trim().toLowerCase();
      if (!USERNAME_RE.test(newUsername)) {
        return res
          .status(400)
          .json({
            error: "Username must be 3-20 characters using letters, numbers, _ . or -",
          });
      }
      if (!currentPassword) {
        return res
          .status(400)
          .json({ error: "Current password is required to change your username" });
      }
      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      const taken = await db.query(
        "SELECT id FROM users WHERE username = $1 AND id <> $2",
        [newUsername, userId],
      );
      if (taken.rows.length > 0) {
        return res.status(409).json({ error: "Username already in use" });
      }
      push("username", newUsername);
    }

    if (email !== undefined && String(email).trim().toLowerCase() !== user.email.toLowerCase()) {
      const newEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return res.status(400).json({ error: "A valid email is required" });
      }
      if (!currentPassword) {
        return res
          .status(400)
          .json({ error: "Current password is required to change your email" });
      }
      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
      const taken = await db.query(
        "SELECT id FROM users WHERE email = $1 AND id <> $2",
        [newEmail, userId],
      );
      if (taken.rows.length > 0) {
        return res.status(409).json({ error: "Email already in use" });
      }
      push("email", newEmail);
    }

    if (updates.length === 0) {
      return res.json({ user: userShape(user) });
    }

    const result = await db.query(
      `UPDATE users SET ${updates.join(", ")}
       WHERE id = $${values.length + 1}
       RETURNING ${PUBLIC_COLUMNS}`,
      [...values, userId],
    );

    res.json({ user: userShape(result.rows[0]) });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current and new password are required" });
    }
    if (String(newPassword).length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const user = (
      await db.query(
        "SELECT id, password_hash, token_version FROM users WHERE id = $1",
        [userId],
      )
    ).rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    // Bump the token version so sessions on other devices are invalidated.
    const result = await db.query(
      `UPDATE users
       SET password_hash = $1, token_version = token_version + 1
       WHERE id = $2
       RETURNING id, token_version`,
      [hash, userId],
    );
    const updated = result.rows[0];

    res.json({ success: true, token: signToken(updated) });
  } catch (error) {
    next(error);
  }
};

exports.revokeSessions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      "UPDATE users SET token_version = token_version + 1 WHERE id = $1 RETURNING id, token_version",
      [userId],
    );
    const updated = result.rows[0];
    if (!updated) return res.status(404).json({ error: "User not found" });

    res.json({ token: signToken(updated) });
  } catch (error) {
    next(error);
  }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    const { currentPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword) {
      return res.status(400).json({ error: "Current password is required" });
    }

    const user = (
      await db.query("SELECT id, password_hash FROM users WHERE id = $1", [userId])
    ).rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Soft delete: mark account as deactivated instead of removing it.
    // Data stays in the database; account can be permanently removed after 30-day grace period.
    await db.query("UPDATE users SET deleted_at = NOW() WHERE id = $1", [userId]);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
