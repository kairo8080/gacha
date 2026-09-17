import "server-only";
import type { NextRequest } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  readAdminConfig,
  verifyAdminSession,
} from "./admin-auth-core";

export {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_SECONDS,
  createAdminSession,
  createLoginLimiter,
  isSameOrigin,
  verifyAdminPassword,
} from "./admin-auth-core";

export const ADMIN_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

export function getAdminConfig() {
  return readAdminConfig(process.env);
}

export function isAdminAuthenticated(request: NextRequest): boolean {
  const config = getAdminConfig();
  return (
    config !== null &&
    verifyAdminSession(request.cookies.get(ADMIN_COOKIE_NAME)?.value, config)
  );
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/admin",
};
