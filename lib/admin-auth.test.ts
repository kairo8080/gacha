import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, scryptSync } from "node:crypto";
import {
  ADMIN_SESSION_SECONDS,
  createAdminSession,
  createLoginLimiter,
  isSameOrigin,
  readAdminConfig,
  verifyAdminPassword,
  verifyAdminSession,
} from "./admin-auth-core.ts";

const password = randomBytes(24).toString("hex");
const salt = randomBytes(16).toString("hex");
const env = {
  ADMIN_PASSWORD_SALT: salt,
  ADMIN_PASSWORD_HASH: scryptSync(password, salt, 64).toString("hex"),
  ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
};
const config = readAdminConfig(env)!;
const now = 1_800_000_000_000;

test("admin configuration fails closed for absent or malformed secrets", () => {
  assert.equal(readAdminConfig({}), null);
  assert.equal(readAdminConfig({ ...env, ADMIN_PASSWORD_HASH: "bad" }), null);
  assert.equal(readAdminConfig({ ...env, ADMIN_PASSWORD_SALT: "short" }), null);
  assert.equal(
    readAdminConfig({ ...env, ADMIN_SESSION_SECRET: "short" }),
    null,
  );
  assert.notEqual(config, null);
});

test("password check accepts the configured password and rejects wrong or invalid input", async () => {
  assert.equal(await verifyAdminPassword(password, config), true);
  assert.equal(
    await verifyAdminPassword(randomBytes(24).toString("hex"), config),
    false,
  );
  assert.equal(await verifyAdminPassword(undefined, config), false);
  assert.equal(await verifyAdminPassword("", config), false);
  assert.equal(await verifyAdminPassword("a".repeat(1025), config), false);
});

test("signed sessions expire, reject future issuance, and are unique", () => {
  const token = createAdminSession(config, now);
  assert.equal(verifyAdminSession(token, config, now), true);
  assert.equal(
    verifyAdminSession(token, config, now + ADMIN_SESSION_SECONDS * 1000 - 1),
    true,
  );
  assert.equal(
    verifyAdminSession(token, config, now + ADMIN_SESSION_SECONDS * 1000),
    false,
  );
  assert.equal(verifyAdminSession(token, config, now - 1000), false);
  assert.notEqual(token, createAdminSession(config, now));
});

test("session signatures reject tampering, malformed tokens, and rotated credentials", () => {
  const token = createAdminSession(config, now);
  const [payload, signature] = token.split(".");
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  parsed.expires += 86400;
  const tampered = `${Buffer.from(JSON.stringify(parsed)).toString("base64url")}.${signature}`;
  assert.equal(verifyAdminSession(tampered, config, now), false);
  assert.equal(
    verifyAdminSession(`${payload}.${signature.slice(1)}`, config, now),
    false,
  );
  assert.equal(
    verifyAdminSession(
      token,
      { ...config, sessionSecret: randomBytes(32).toString("hex") },
      now,
    ),
    false,
  );
  assert.equal(
    verifyAdminSession(
      token,
      { ...config, passwordHash: "0".repeat(128) },
      now,
    ),
    false,
  );
  for (const invalid of [undefined, "", "x", "x.y.z", ".", "a".repeat(513)]) {
    assert.equal(verifyAdminSession(invalid, config, now), false);
  }
});

test("mutations require an exact same origin and reject cross-site requests", () => {
  const url = "https://arcade.example/api/admin/session";
  assert.equal(
    isSameOrigin(
      new Request(url, { headers: { origin: "https://arcade.example" } }),
    ),
    true,
  );
  assert.equal(isSameOrigin(new Request(url)), false);
  assert.equal(
    isSameOrigin(
      new Request(url, { headers: { origin: "https://other.example" } }),
    ),
    false,
  );
  assert.equal(
    isSameOrigin(
      new Request(url, {
        headers: {
          origin: "https://arcade.example",
          "sec-fetch-site": "cross-site",
        },
      }),
    ),
    false,
  );
});

test("origin validation preserves the browser Host when Next normalizes loopback URLs", () => {
  const normalizedUrl = "http://localhost:3000/api/admin/session";
  const headers = { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" };
  assert.equal(isSameOrigin(new Request(normalizedUrl, { headers })), true);
  assert.equal(
    isSameOrigin(
      new Request(normalizedUrl, {
        headers: { ...headers, origin: "http://localhost:3000" },
      }),
    ),
    false,
  );
  assert.equal(
    isSameOrigin(
      new Request(normalizedUrl, {
        headers: { ...headers, origin: "http://127.0.0.1:3001" },
      }),
    ),
    false,
  );
  assert.equal(
    isSameOrigin(
      new Request(normalizedUrl, {
        headers: { ...headers, origin: "https://127.0.0.1:3000" },
      }),
    ),
    false,
  );
  assert.equal(
    isSameOrigin(
      new Request(normalizedUrl, {
        headers: { ...headers, "sec-fetch-site": "cross-site" },
      }),
    ),
    false,
  );
});

test("origin validation rejects Host mismatches, malformed hosts, and forwarded-host overrides", () => {
  const url = "https://arcade.example/api/admin/session";
  const headers = {
    host: "arcade.example",
    origin: "https://attacker.example",
    "x-forwarded-host": "attacker.example",
  };
  assert.equal(isSameOrigin(new Request(url, { headers })), false);
  assert.equal(
    isSameOrigin(
      new Request(url, {
        headers: { host: "other.example", origin: "https://arcade.example" },
      }),
    ),
    false,
  );
  for (const host of [
    "arcade.example/path",
    "arcade.example@attacker.example",
    "arcade.example,attacker.example",
    "",
  ]) {
    assert.equal(
      isSameOrigin(
        new Request(url, {
          headers: { host, origin: "https://arcade.example" },
        }),
      ),
      false,
    );
  }
});

test("login attempts throttle in one window then recover", () => {
  const limit = createLoginLimiter(2, 60_000);
  assert.equal(limit(now), 0);
  assert.equal(limit(now + 1), 0);
  assert.equal(limit(now + 2), 60);
  assert.equal(limit(now + 59_000), 1);
  assert.equal(limit(now + 60_000), 0);
});
