import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSessionUserFromRequest } from "../../../../lib/auth";

export async function POST(req: Request) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gameSlug, key } = (await req.json()) as { gameSlug?: string; key?: string };
  if (!gameSlug || !key) {
    return NextResponse.json({ error: "Missing achievement info." }, { status: 400 });
  }

  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!game) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }

  const achievement = await prisma.achievement.findUnique({
    where: { gameId_key: { gameId: game.id, key } },
  });
  if (!achievement) {
    return NextResponse.json({ error: "Achievement not found." }, { status: 404 });
  }

  await prisma.userAchievement.upsert({
    where: { userId_achievementId: { userId: user.id, achievementId: achievement.id } },
    create: {
      userId: user.id,
      achievementId: achievement.id,
    },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
