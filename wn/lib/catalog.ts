import { prisma } from "./prisma";

export const gamesCatalog = [
  {
    slug: "find",
    title: "In Depth",
    description: "A top-down survival shooter with patrol AI, power-ups, and a quickfire arsenal.",
    coverUrl: null,
  },
  {
    slug: "stock",
    title: "WebNerd Stocks",
    description: "A fast-paced market sim where you trade, track charts, and outplay volatility.",
    coverUrl: null,
  },
];

export const achievementsCatalog = {
  find: [
    { key: "first-blood", title: "First Blood", description: "Defeat your first enemy.", points: 10 },
    { key: "power-up", title: "Overclocked", description: "Pick up any power-up.", points: 15 },
    { key: "survivor", title: "Survivor", description: "Reach 500 points in a single run.", points: 25 },
  ],
  stock: [
    { key: "first-trade", title: "Opening Bell", description: "Complete your first trade.", points: 10 },
    { key: "net-positive", title: "In The Green", description: "Reach a net worth of $15,000.", points: 20 },
    { key: "market-maker", title: "Market Maker", description: "Trigger 20 market ticks.", points: 15 },
  ],
};

export async function syncCatalog() {
  for (const game of gamesCatalog) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      create: {
        slug: game.slug,
        title: game.title,
        description: game.description,
        coverUrl: game.coverUrl ?? null,
      },
      update: {
        title: game.title,
        description: game.description,
        coverUrl: game.coverUrl ?? null,
      },
    });

    const gameRecord = await prisma.game.findUnique({ where: { slug: game.slug } });
    if (!gameRecord) continue;

    const achievements = achievementsCatalog[game.slug as keyof typeof achievementsCatalog] || [];
    for (const achievement of achievements) {
      await prisma.achievement.upsert({
        where: { gameId_key: { gameId: gameRecord.id, key: achievement.key } },
        create: {
          gameId: gameRecord.id,
          key: achievement.key,
          title: achievement.title,
          description: achievement.description,
          points: achievement.points,
        },
        update: {
          title: achievement.title,
          description: achievement.description,
          points: achievement.points,
        },
      });
    }
  }
}
