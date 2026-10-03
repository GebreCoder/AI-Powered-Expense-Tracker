const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../src/app");

test("GET /health returns ok", async () => {
  const res = await request(app).get("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "ok");
});

test("protected routes return 401 without a token", async () => {
  for (const path of [
    "/api/insights",
    "/api/dashboard/summary",
    "/api/transactions",
    "/api/categories",
    "/api/budgets",
  ]) {
    const res = await request(app).get(path);
    assert.equal(res.status, 401, `expected 401 for ${path}`);
  }
});

test("unknown routes return 404", async () => {
  const res = await request(app).get("/api/does-not-exist");
  assert.equal(res.status, 404);
});

test("auth routes are rate limited", async () => {
  // 20 requests are allowed per 15 minutes; the 21st must be rejected.
  let last;
  for (let i = 0; i < 21; i++) {
    last = await request(app)
      .post("/api/auth/login")
      .send({ username: "nobody", password: "wrong" });
  }
  assert.equal(last.status, 429);
  assert.ok(last.body.error);
});
