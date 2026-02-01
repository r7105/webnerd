import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getSessionUserFromRequest } from "../../../../lib/auth";

type Params = {
  params: { slug: string };
};

export async function GET(req: Request, { params }: Params) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ state: null }, { status: 200 });
  }

  const slug = params.slug;
  const entry = await prisma.userGameState.findUnique({
    where: { userId_gameSlug: { userId: user.id, gameSlug: slug } },
  });

  if (!entry) {
    return NextResponse.json({ state: null }, { status: 200 });
  }

  try {
    return NextResponse.json({ state: JSON.parse(entry.stateJson) });
  } catch (err) {
    return NextResponse.json({ state: null }, { status: 200 });
  }
}

export async function POST(req: Request, { params }: Params) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = params.slug;
  const { state } = (await req.json()) as { state?: unknown };
  if (!state) {
    return NextResponse.json({ error: "Missing state" }, { status: 400 });
  }

  const stateJson = JSON.stringify(state);
  await prisma.userGameState.upsert({
    where: { userId_gameSlug: { userId: user.id, gameSlug: slug } },
    create: {
      userId: user.id,
      gameSlug: slug,
      stateJson,
    },
    update: {
      stateJson,
    },
  });

  return NextResponse.json({ ok: true });
}
