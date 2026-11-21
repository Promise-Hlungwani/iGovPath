import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { PROFILE_COOKIE } from "@/lib/profile";

// Fast, optimistic check only: no session cookie -> go to sign-in.
// Real role and department checks run on the server in each layout, page and action.
export function middleware(req: NextRequest) {
  if (!getSessionCookie(req)) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  const p = req.nextUrl.pathname;
  if ((p.startsWith("/portal") || p.startsWith("/admin")) && req.cookies.get(PROFILE_COOKIE)?.value !== "officer") {
    res.cookies.set(PROFILE_COOKIE, "officer", { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}

export const config = {
  // Node runtime: the auth library's cookie helper pulls in code the Edge runtime doesn't support.
  runtime: "nodejs",
  matcher: ["/portal/:path*", "/admin/:path*", "/account/:path*", "/saved/:path*", "/notifications/:path*", "/applications/:path*"],
};
