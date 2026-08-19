// Loads DATABASE_URL for the standalone Prisma CLI (prisma generate / migrate),
// which runs outside Next.js's own env loading. This project's convention is
// .env.local (see .env.example), not the Prisma-default .env.
import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
