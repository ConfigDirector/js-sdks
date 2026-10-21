import { NextResponse } from "next/server";

// Any middleware makes `next build` also compile instrumentation.js for the edge runtime.
export function middleware() {
  return NextResponse.next();
}
