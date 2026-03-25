import { neon } from "@neondatabase/serverless";
import { requiredEnv } from "./env";

let sql: ReturnType<typeof neon> | null = null;

export function getSql() {
  if (!sql) {
    // Vercel/Neon projects sometimes expose the connection string under different env var names.
    // Keep the lookup flexible so the app doesn't crash during Server Components render.
    const databaseUrl =
      process.env.DATABASE_URL ??
      process.env.NEON_DATABASE_URL ??
      process.env.POSTGRES_URL ??
      process.env.POSTGRES_URL_NON_POOLING;

    if (!databaseUrl) {
      throw new Error(
        "Missing required database connection string env var (tried DATABASE_URL, NEON_DATABASE_URL, POSTGRES_URL, POSTGRES_URL_NON_POOLING)"
      );
    }

    sql = neon(databaseUrl);
  }
  return sql;
}

