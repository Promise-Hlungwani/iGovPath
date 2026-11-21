import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Fast, optimistic check only: no session cookie -> go to sign-in.
// Real role and department checks run on the server in each layout, page and action.
export function middleware(req: NextRequest) {
  if (!getSessionCookie(req)) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Node runtime: the auth library's cookie helper pulls in code the Edge runtime doesn't support.
  runtime: "nodejs",
  matcher: ["/portal/:path*", "/admin/:path*", "/account/:path*", "/saved/:path*", "/notifications/:path*"],
};
