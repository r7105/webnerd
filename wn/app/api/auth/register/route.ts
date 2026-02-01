import { NextResponse } from "next/server";
import { serialize } from "cookie";
import { prisma } from "../../../../lib/prisma";
import { hashPassword, signSessionToken, SESSION_COOKIE } from "../../../../lib/auth";

export async function POST(req: Request) {
  const { username, password } = (await req.json()) as { username?: string; password?: string };

  const trimmedUsername = (username || "").trim();
  if (trimmedUsername.length < 3 || !password || password.length < 6) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username: trimmedUsername } });
  if (existing) {
    return NextResponse.json({ error: "Username already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username: trimmedUsername,
      passwordHash,
    },
  });

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
