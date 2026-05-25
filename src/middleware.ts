import { NextResponse, type NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  // Firebase Web Auth state is enforced by ProtectedRoute in each protected page.
  return NextResponse.next();
}

export const config = {
  matcher: ["/upload/:path*", "/processing/:path*", "/result/:path*", "/history/:path*"],
};
