import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = ["/upload", "/result", "/history"];

export function middleware(request: NextRequest) {
  const isProtected = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route));

  if (!isProtected) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/upload/:path*", "/result/:path*", "/history/:path*"],
};
