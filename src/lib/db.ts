import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 7 client instances always need an explicit driver adapter — there's
// no more implicit "read DATABASE_URL from the schema" at query time (that
// env var is still what `prisma migrate`/`prisma.config.ts` use). The adapter
// wants a plain file path, not the "file:" prefixed connection string form.
const databaseUrl = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");

function createPrismaClient() {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
