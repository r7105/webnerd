import { NextResponse } from "next/server";
import { serialize } from "cookie";
import { SESSION_COOKIE } from "../../../../lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    serialize(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      secure: process.env.NODE_ENV === "production",
    })
  );
  return response;
}
