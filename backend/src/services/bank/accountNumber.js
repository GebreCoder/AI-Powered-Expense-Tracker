// Demo Account Validation — a deterministic checksum for the 13-digit
// simulated account numbers used by the Demo Bank feature.
//
// IMPORTANT: this is a FICTIONAL algorithm for a simulation only. It is NOT
// a real banking account-number validation scheme (e.g. IBAN, NUBAN, ABA) and
// must never be presented as one.
//
// Format
// ------
//   digits 1..12  -> account identifier
//   digit  13     -> check digit
//
// Algorithm
// ---------
//   weight digits 1..12 with the repeating pattern [7, 3, 1]:
//     sum = Σ digit(i) × weight(i)
//   check digit = (10 − (sum mod 10)) mod 10
//
// The weighted sum makes common typos (one digit wrong, two adjacent digits
// swapped) fail validation deterministically.

const LENGTH = 13;
const WEIGHTS = [7, 3, 1];

/**
 * Compute the check digit for a 12-digit account identifier.
 * @param {string} identifier - exactly 12 digits
 * @returns {number} 0-9
 */
function computeCheckDigit(identifier) {
  const digits = String(identifier);
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    const d = Number(digits[i]);
    if (!Number.isInteger(d)) return null;
    sum += d * WEIGHTS[i % WEIGHTS.length];
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Validate a demo account number.
 * @param {string|number} value
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAccountNumber(value) {
  const raw = String(value ?? "").trim();

  if (raw === "") {
    return { valid: false, error: "Account number is required" };
  }
  if (!/^\d+$/.test(raw)) {
    return { valid: false, error: "Account number must contain digits only" };
  }
  if (raw.length !== LENGTH) {
    return {
      valid: false,
      error: `Account number must be exactly ${LENGTH} digits`,
    };
  }

  const identifier = raw.slice(0, LENGTH - 1);
  const checkDigit = Number(raw[LENGTH - 1]);
  if (computeCheckDigit(identifier) !== checkDigit) {
    return { valid: false, error: "This account number failed validation" };
  }

  return { valid: true, error: undefined };
}

/**
 * Build a valid 13-digit demo account number from a 12-digit identifier.
 * Used by the seed data so every seeded account passes validation.
 * @param {string} identifier - exactly 12 digits
 * @returns {string} 13-digit account number
 */
function buildAccountNumber(identifier) {
  const id = String(identifier);
  if (!/^\d{12}$/.test(id)) {
    throw new Error("Account identifier must be exactly 12 digits");
  }
  return `${id}${computeCheckDigit(id)}`;
}

/** Mask an account number for display: keep the last four digits. */
function maskAccountNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "••••••••••••";
  return `••••••••••${digits.slice(-4)}`;
}

module.exports = { validateAccountNumber, computeCheckDigit, buildAccountNumber, maskAccountNumber };
