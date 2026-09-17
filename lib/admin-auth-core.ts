import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;
export const ADMIN_COOKIE_NAME = "gacha-admin-session";

export type AdminConfig = {
  salt: string;
  passwordHash: string;
  sessionSecret: string;
};

export function readAdminConfig(
  env: Record<string, string | undefined>,
): AdminConfig | null {
  const salt = env.ADMIN_PASSWORD_SALT;
  const passwordHash = env.ADMIN_PASSWORD_HASH;
  const sessionSecret = env.ADMIN_SESSION_SECRET;
  if (
    !salt ||
    !/^(?:[a-f\d]{2}){16,64}$/i.test(salt) ||
    !passwordHash ||
    !/^[a-f\d]{128}$/i.test(passwordHash) ||
    !sessionSecret ||
    sessionSecret.length < 32
  )
    return null;
  return { salt, passwordHash, sessionSecret };
}

export async function verifyAdminPassword(
  password: unknown,
  config: AdminConfig,
): Promise<boolean> {
  if (
    typeof password !== "string" ||
    password.length === 0 ||
    Buffer.byteLength(password) > 1024
  )
    return false;
  const derived = await new Promise<Buffer>((resolve, reject) => {
    // The salt is its hexadecimal text, matching Node's scrypt(password, salt, 64).
    scrypt(password, config.salt, 64, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
  return timingSafeEqual(derived, Buffer.from(config.passwordHash, "hex"));
}

function signature(payload: string, config: AdminConfig): Buffer {
  return createHmac("sha256", config.sessionSecret)
    .update(`${config.salt}:${config.passwordHash}:${payload}`)
    .digest();
}

export function createAdminSession(
  config: AdminConfig,
  now = Date.now(),
): string {
  const issued = Math.floor(now / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      issued,
      expires: issued + ADMIN_SESSION_SECONDS,
      nonce: randomBytes(24).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${signature(payload, config).toString("base64url")}`;
}

export function verifyAdminSession(
  token: string | undefined,
  config: AdminConfig,
  now = Date.now(),
): boolean {
  if (!token || token.length > 512) return false;
  const parts = token.split(".");
  if (
    parts.length !== 2 ||
    !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))
  )
    return false;
  const [payload, encodedSignature] = parts;
  const actual = Buffer.from(encodedSignature, "base64url");
  const expected = signature(payload, config);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const seconds = Math.floor(now / 1000);
    return (
      Number.isSafeInteger(data.issued) &&
      Number.isSafeInteger(data.expires) &&
      data.issued <= seconds &&
      data.expires > seconds &&
      data.expires - data.issued === ADMIN_SESSION_SECONDS &&
      typeof data.nonce === "string" &&
      /^[a-f\d]{48}$/.test(data.nonce)
    );
  } catch {
    return false;
  }
}

export function isSameOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const requestUrl = new URL(request.url);
    // Next.js can normalize a loopback URL to localhost. The HTTP Host header
    // retains the address used by the browser and cannot be set by cross-site JS.
    // Do not substitute forwarded-host headers supplied by an untrusted client.
    const host = request.headers.get("host");
    if (host !== null && !/^[a-z\d.\-:[\]]+$/i.test(host)) return false;
    const expected =
      host === null
        ? requestUrl.origin
        : new URL(`${requestUrl.protocol}//${host}`).origin;
    return origin === expected;
  } catch {
    return false;
  }
}

// An aggregate limit avoids trusting spoofable client IP headers. This is a
// basic single-process safeguard, not a distributed production rate limiter.
export function createLoginLimiter(limit = 10, windowMs = 5 * 60 * 1000) {
  let count = 0;
  let resetAt = 0;
  return (now = Date.now()): number => {
    if (now >= resetAt) {
      count = 0;
      resetAt = now + windowMs;
    }
    if (count >= limit) return Math.max(1, Math.ceil((resetAt - now) / 1000));
    count += 1;
    return 0;
  };
}
