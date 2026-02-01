import { PrismaClient as ChitterPrismaClient } from "../src/generated/chitterhaven";

const globalForChitter = globalThis as unknown as { chitterPrisma?: ChitterPrismaClient };

export const chitterPrisma =
  globalForChitter.chitterPrisma ??
  new ChitterPrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForChitter.chitterPrisma = chitterPrisma;
}
