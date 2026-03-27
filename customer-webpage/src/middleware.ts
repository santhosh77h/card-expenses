import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/navigation";

const intlMiddleware = createMiddleware(routing);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin routes: skip i18n, apply admin auth
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (pathname === "/admin/login" || pathname === "/api/admin/login") {
      return NextResponse.next();
    }
    const session = request.cookies.get("admin_session")?.value;
    if (!session || session !== process.env.ADMIN_SESSION_SECRET) {
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
