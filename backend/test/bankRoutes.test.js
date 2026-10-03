// Force the demo bank surface on for these route tests, regardless of the
// local .env (this test file runs in its own process under node --test).
process.env.DEMO_BANK_ENABLED = "true";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../src/app");

test("bank routes require authentication", async () => {
  for (const path of [
    "/api/bank/config",
    "/api/bank/providers",
    "/api/bank/demo/accounts",
    "/api/bank/connections",
    "/api/bank/accounts",
  ]) {
    const res = await request(app).get(path);
    assert.equal(res.status, 401, `expected 401 for ${path}`);
  }
});

test("invalid bearer token is rejected on bank routes", async () => {
  const res = await request(app)
    .get("/api/bank/connections")
    .set("Authorization", "Bearer not-a-real-token");
  assert.equal(res.status, 401);
});

test("bank mutation routes require authentication", async () => {
  for (const path of [
    "/api/bank/accounts/1/sync",
    "/api/bank/accounts/1/simulate",
    "/api/bank/accounts/1/demo",
  ]) {
    const res = await request(app).post(path);
    assert.equal(res.status, 401, `expected 401 for POST ${path}`);
  }
});


