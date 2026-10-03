// OTP store for the Demo Bank connect flow — completely simulated.
//
// Requirements honoured here:
//   * random 6-digit code
//   * stored hashed (sha256 with a per-session salt) — the raw code never
//     lives at rest
//   * expires after a short window
//   * limited verification attempts
//   * never persisted permanently (in-memory, deleted on success/expiry)
//   * never logged — the raw code is only ever returned when dev mode is on,
//     so a presenter can complete the flow without reading logs
//
// In-memory is the right tradeoff for a demo: OTPs are ephemeral by nature,
// and a server restart simply invalidates any outstanding codes.

const crypto = require("crypto");
const bankConfig = require("./bankConfig");

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

// connectionId -> session
const sessions = new Map();

function generateCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
}

function hash(code, salt) {
  return crypto.createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

/**
 * Create an OTP session for a connection.
 * @param {number} connectionId
 * @param {number} userId
 * @returns {{ expiresInSeconds: number, devCode: string|null }}
 */
function create(connectionId, userId) {
  const code = generateCode();
  const salt = crypto.randomBytes(16).toString("hex");
  sessions.set(connectionId, {
    userId,
    hash: hash(code, salt),
    salt,
    expiresAt: Date.now() + TTL_MS,
    attempts: 0,
  });
  return {
    expiresInSeconds: Math.floor(TTL_MS / 1000),
    devCode: bankConfig.devMode ? code : null,
  };
}

/**
 * Verify a submitted code.
 * @param {number} connectionId
 * @param {number} userId
 * @param {string} code
 * @returns {{ ok: boolean, error?: string }}
 */
function verify(connectionId, userId, code, now = Date.now()) {
  const session = sessions.get(connectionId);
  if (!session) {
    return { ok: false, error: "No verification code was requested. Start over." };
  }
  if (session.userId !== userId) {
    return { ok: false, error: "Invalid verification request." };
  }
  if (now > session.expiresAt) {
    sessions.delete(connectionId);
    return { ok: false, error: "This verification code has expired. Request a new code." };
  }
  if (session.attempts >= MAX_ATTEMPTS) {
    sessions.delete(connectionId);
    return { ok: false, error: "Too many incorrect attempts. Request a new code." };
  }

  session.attempts += 1;
  const candidate = hash(String(code ?? "").trim(), session.salt);
  if (candidate !== session.hash) {
    return {
      ok: false,
      error:
        session.attempts >= MAX_ATTEMPTS
          ? "Too many incorrect attempts. Request a new code."
          : "The verification code is incorrect. Please try again.",
    };
  }

  sessions.delete(connectionId);
  return { ok: true };
}

/** Drop a session (e.g. when a pending connection is discarded). */
function clear(connectionId) {
  sessions.delete(connectionId);
}

module.exports = { create, verify, clear, TTL_MS, MAX_ATTEMPTS };
