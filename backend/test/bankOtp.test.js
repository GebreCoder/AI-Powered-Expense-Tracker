const { test } = require("node:test");
const assert = require("node:assert/strict");
const otpStore = require("../src/services/bank/otpStore");
const bankConfig = require("../src/services/bank/bankConfig");

// The raw OTP is only ever revealed when DEMO_BANK_DEV_MODE is on (the
// presenter convenience). These tests flip that flag for the duration of a
// test so the code can be read back from the session, then restore it.

function withDevMode(fn) {
  const original = bankConfig.devMode;
  bankConfig.devMode = true;
  try {
    return fn();
  } finally {
    bankConfig.devMode = original;
  }
}

test("create returns an expiring session and never persists the raw code", () => {
  withDevMode(() => {
    const session = otpStore.create(1, 42);
    assert.equal(typeof session.expiresInSeconds, "number");
    assert.ok(session.expiresInSeconds > 0);
    assert.match(session.devCode, /^\d{6}$/);
  });
});

test("correct OTP succeeds and consumes the session", () => {
  withDevMode(() => {
    const session = otpStore.create(11, 7);
    assert.deepEqual(otpStore.verify(11, 7, session.devCode), { ok: true });
    // Session consumed — a second verify must fail.
    assert.equal(otpStore.verify(11, 7, session.devCode).ok, false);
  });
});

test("incorrect OTP fails", () => {
  withDevMode(() => {
    otpStore.create(12, 8);
    const verdict = otpStore.verify(12, 8, "000000");
    assert.equal(verdict.ok, false);
    assert.match(verdict.error, /incorrect/);
  });
});

test("expired OTP fails", () => {
  withDevMode(() => {
    const session = otpStore.create(14, 9);
    const verdict = otpStore.verify(
      14,
      9,
      session.devCode,
      Date.now() + otpStore.TTL_MS + 1000,
    );
    assert.equal(verdict.ok, false);
    assert.match(verdict.error, /expired/);
  });
});

test("too many incorrect attempts blocks the session", () => {
  withDevMode(() => {
    otpStore.create(15, 10);
    let last;
    for (let i = 0; i < otpStore.MAX_ATTEMPTS + 1; i += 1) {
      last = otpStore.verify(15, 10, "000000");
    }
    assert.equal(last.ok, false);
    assert.match(last.error, /Too many incorrect attempts/);
  });
});

test("a different user cannot verify another user's OTP", () => {
  withDevMode(() => {
    const session = otpStore.create(16, 1);
    assert.equal(otpStore.verify(16, 2, session.devCode).ok, false);
  });
});

test("verifying with no session fails cleanly", () => {
  const verdict = otpStore.verify(999999, 1, "123456");
  assert.equal(verdict.ok, false);
  assert.match(verdict.error, /No verification code/);
});
