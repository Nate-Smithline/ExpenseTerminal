import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: true, t: new Date().toISOString() });
}
