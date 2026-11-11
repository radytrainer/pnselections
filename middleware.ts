import { NextResponse, type NextRequest } from "next/server";
import { ID_TOKEN_COOKIE } from "@/lib/constants";

const PUBLIC_PATHS = ["/login", "/offline", "/manifest.webmanifest", "/sw.js", "/icons", "/brand"];

/**
 * UX-level route gating only — presence-checks the session cookie to avoid
 * flashing protected UI before redirecting to /login. This is NOT the
 * security boundary: Postgres RLS (db/migrations), applied by the API, is authoritative,
 * and the API (api/src/auth.ts) verifies the token signature on every request before
 * ever trusting it. Edge middleware can't run the Firebase Admin SDK
 * (Node-only), so it can't verify signatures here.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isPublic) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(ID_TOKEN_COOKIE);

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
