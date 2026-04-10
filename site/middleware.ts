import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { paymentMiddleware } from "x402-next";
import { X402_ENABLED, X402_PAYMENT_ADDRESS, X402_ROUTES, isX402GatedRoute } from "@/lib/x402";

// Build the x402 payment middleware once at module load time.
const x402 = X402_ENABLED
  ? paymentMiddleware(X402_PAYMENT_ADDRESS, X402_ROUTES)
  : null;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- UI auth gates ---
  if (pathname.startsWith("/submit") || pathname.startsWith("/admin") || pathname.startsWith("/monitor")) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      const url = new URL("/auth", request.url);
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // --- x402 payment gate for data API routes ---
  // Authenticated web-app users (session cookie present) get free access.
  // Requests originating from the app itself (same origin) also bypass payment.
  if (x402 && isX402GatedRoute(pathname)) {
    const sessionCookie = getSessionCookie(request);
    const requestOrigin = request.headers.get("origin");
    const appOrigin =
      process.env.NEXT_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const isSameOrigin =
      requestOrigin !== null && requestOrigin === appOrigin;
    if (!sessionCookie && !isSameOrigin) {
      return x402(request);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // UI auth gates
    "/submit",
    "/admin/:path*",
    "/monitor",
    "/monitor/:path*",
    // x402 data API gates
    "/api/wallets/:path*",
    "/api/leaderboard/:path*",
    "/api/trades/:path*",
    "/api/smart-money/:path*",
    "/api/x-tracker/:path*",
    "/api/portfolio/:path*",
    "/api/scanner/:path*",
    "/api/x-profiles/:path*",
    "/api/trending/:path*",
    "/api/search/:path*",
    "/api/token/:path*",
    "/api/proxy/:path*",
  ],
};
