import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { routing } from "@/i18n/navigation";

const intlMiddleware = createMiddleware(routing);

async function verifyAdminToken(token: string): Promise<boolean> {
  const secret = process.env.JWT_SECRET_KEY;
  if (!secret) return false;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    return payload.type === "admin_access" && payload.role === "admin";
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes: skip i18n, apply admin auth
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (
      pathname === "/admin/login" ||
      pathname === "/api/admin/login" ||
      pathname === "/api/admin/logout"
    ) {
      return NextResponse.next();
    }
    const token = request.cookies.get("admin_session")?.value;
    if (!token || !(await verifyAdminToken(token))) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // All other routes: apply i18n locale detection
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Match all paths except static files and _next
    "/((?!_next|api(?!/admin)|.*\\..*).*)",
    "/admin/:path*",
  ],
};
