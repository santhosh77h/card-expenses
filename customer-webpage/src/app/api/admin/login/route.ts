import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data.detail || "Login failed" },
      { status: res.status }
    );
  }

  // Set the JWT token as an httpOnly cookie
  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin_session", data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}
