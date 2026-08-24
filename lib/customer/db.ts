import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { DatabaseConfigurationError } from "./repository";

/**
 * Lazy, serverless-safe PrismaClient singleton. Nothing here connects to a
 * database at module load — getPrismaClient() only constructs the client
 * (and the underlying `pg` connection pool) on first real use, and throws
 * DatabaseConfigurationError if DATABASE_URL is unset. This is what lets
 * the whole app (including every route that doesn't touch the customer
 * domain) keep working with zero database configured, exactly like
 * SPLIT_GENERATION_ENABLED defaulting off in Phase 2a.
 *
 * The globalThis cache avoids exhausting Postgres connections across
 * Next.js dev-mode hot reloads (standard Prisma+Next.js pattern).
 */
const globalForPrisma = globalThis as unknown as { __nasirBespokePrisma?: PrismaClient };

export function getPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseConfigurationError();

  if (!globalForPrisma.__nasirBespokePrisma) {
    const adapter = new PrismaPg({ connectionString: url });
    globalForPrisma.__nasirBespokePrisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.__nasirBespokePrisma;
}

export function isCustomerDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
