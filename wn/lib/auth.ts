import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "wn_session";

type SessionPayload = {
  sub: string;
  username: string;
};

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = "7d";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signSessionToken(payload: SessionPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifySessionToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as SessionPayload;
}

export async function getSessionUserFromCookies() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const payload = verifySessionToken(token);
    return prisma.user.findUnique({
      where: { id: payload.sub },
    });
  } catch (err) {
    return null;
  }
}

export function getSessionTokenFromRequest(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  return decodeURIComponent(match.split("=")[1] || "");
}

export async function getSessionUserFromRequest(req: Request) {
  const token = getSessionTokenFromRequest(req);
  if (!token) return null;
  try {
    const payload = verifySessionToken(token);
    return prisma.user.findUnique({ where: { id: payload.sub } });
  } catch (err) {
    return null;
  }
}
