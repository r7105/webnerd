import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSessionUserFromRequest } from "../../../../lib/auth";

export async function POST(req: Request) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gameSlug, seconds } = (await req.json()) as { gameSlug?: string; seconds?: number };
  const safeSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
  if (!gameSlug || safeSeconds <= 0) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!game) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }

  const stat = await prisma.userGameStat.upsert({
    where: { userId_gameId: { userId: user.id, gameId: game.id } },
    create: {
      userId: user.id,
      gameId: game.id,
      playtimeSeconds: safeSeconds,
      lastPlayedAt: new Date(),
    },
    update: {
      playtimeSeconds: { increment: safeSeconds },
      lastPlayedAt: new Date(),
    },
  });

  return NextResponse.json({ playtimeSeconds: stat.playtimeSeconds });
}
