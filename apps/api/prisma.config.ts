import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

config({ path: resolve(import.meta.dirname, "../../.env"), quiet: true });

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://athlon:change-me@localhost:5432/athlon?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
