import { NextResponse } from "next/server";
import { serialize } from "cookie";
import { prisma } from "../../../../lib/prisma";
import { signSessionToken, verifyPassword, SESSION_COOKIE } from "../../../../lib/auth";

export async function POST(req: Request) {
  const { username, password } = (await req.json()) as { username?: string; password?: string };

  const trimmedUsername = (username || "").trim();
  if (!trimmedUsername || !password) {
    return NextResponse.json({ error: "Missing credentials." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username: trimmedUsername } });
  if (!user) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const token = signSessionToken({ sub: user.id, username: user.username });
  const response = NextResponse.json({ user: { id: user.id, username: user.username } });
  response.headers.append(
    "Set-Cookie",
    serialize(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === "production",
    })
  );
  return response;
}
