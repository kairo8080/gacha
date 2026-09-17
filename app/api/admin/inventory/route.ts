import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_NO_STORE_HEADERS,
  getAdminConfig,
  isAdminAuthenticated,
} from "@/lib/admin-auth";
import { readPrivateStock } from "@/lib/private-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!getAdminConfig())
    return NextResponse.json(
      { error: "Admin access is not configured." },
      { status: 503, headers: ADMIN_NO_STORE_HEADERS },
    );
  if (!isAdminAuthenticated(request))
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: ADMIN_NO_STORE_HEADERS },
    );
  return NextResponse.json(await readPrivateStock(), {
    headers: ADMIN_NO_STORE_HEADERS,
  });
}
