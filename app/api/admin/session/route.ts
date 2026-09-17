import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_NO_STORE_HEADERS,
  ADMIN_SESSION_SECONDS,
  adminCookieOptions,
  createAdminSession,
  createLoginLimiter,
  getAdminConfig,
  isAdminAuthenticated,
  isSameOrigin,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const checkLoginLimit = createLoginLimiter();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: ADMIN_NO_STORE_HEADERS });
}

export function GET(request: NextRequest) {
  return json({
    authenticated: isAdminAuthenticated(request),
    configured: getAdminConfig() !== null,
  });
}

async function readLoginBody(request: NextRequest): Promise<unknown> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new Error("Invalid input");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Invalid input");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2048) {
        await reader.cancel();
        throw new Error("Invalid input");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request))
    return json({ error: "Request origin rejected." }, 403);
  const config = getAdminConfig();
  if (!config) return json({ error: "Admin access is not configured." }, 503);
  const retryAfter = checkLoginLimit();
  if (retryAfter) {
    const response = json(
      { error: "Too many login attempts. Try again later." },
      429,
    );
    response.headers.set("Retry-After", String(retryAfter));
    return response;
  }
  try {
    const body = await readLoginBody(request);
    if (
      !body ||
      typeof body !== "object" ||
      !("password" in body) ||
      !(await verifyAdminPassword(body.password, config))
    ) {
      return json({ error: "Invalid password." }, 401);
    }
    const response = json({ authenticated: true, configured: true });
    response.cookies.set(ADMIN_COOKIE_NAME, createAdminSession(config), {
      ...adminCookieOptions,
      maxAge: ADMIN_SESSION_SECONDS,
    });
    return response;
  } catch {
    return json({ error: "Invalid login request." }, 401);
  }
}

export function DELETE(request: NextRequest) {
  if (!isSameOrigin(request))
    return json({ error: "Request origin rejected." }, 403);
  const response = json({
    authenticated: false,
    configured: getAdminConfig() !== null,
  });
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    ...adminCookieOptions,
    maxAge: 0,
  });
  return response;
}
