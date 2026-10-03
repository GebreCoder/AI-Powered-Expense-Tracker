// Demo Account Validation (mirror of backend/src/services/bank/accountNumber.js).
//
// FICTIONAL checksum for the 13-digit simulated account numbers used by the
// Demo Bank feature — never a real banking validation scheme.
//
//   digits 1..12  -> account identifier
//   digit  13     -> check digit
//   weights cycle [7, 3, 1]; check digit = (10 − (Σ digit×weight) mod 10) mod 10

const LENGTH = 13;
const WEIGHTS = [7, 3, 1];

export function computeCheckDigit(identifier) {
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
 * @returns {{ valid: boolean, code?: 'required'|'digits'|'length'|'checksum' }}
 */
export function validateDemoAccountNumber(value) {
  const raw = String(value ?? "").trim();
  if (raw === "") return { valid: false, code: "required" };
  if (!/^\d+$/.test(raw)) return { valid: false, code: "digits" };
  if (raw.length !== LENGTH) return { valid: false, code: "length" };
  const identifier = raw.slice(0, LENGTH - 1);
  const checkDigit = Number(raw[LENGTH - 1]);
  if (computeCheckDigit(identifier) !== checkDigit) {
    return { valid: false, code: "checksum" };
  }
  return { valid: true };
}

export function maskAccountNumber(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "••••••••••••";
  return `••••••••••${digits.slice(-4)}`;
}
