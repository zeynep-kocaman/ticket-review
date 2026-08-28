import { NextResponse, type NextRequest } from "next/server";

/**
 * Simple auth check: if accessing /review without the auth cookie, redirect to /login.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/review")) {
    const isLoggedIn = request.cookies.get("reviewerAuth")?.value === "true";

    if (!isLoggedIn) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
