import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSessionUserFromRequest } from "../../../../lib/auth";

export async function POST(req: Request) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = (await req.json()) as { username?: string };
  const trimmed = (username || "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Missing username." }, { status: 400 });
  }

  const invite = await prisma.chitterInvite.create({
    data: {
      fromUserId: user.id,
      toUsername: trimmed,
    },
  });

  return NextResponse.json({ invite });
}
