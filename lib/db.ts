import { neon } from "@neondatabase/serverless";
import { requiredEnv } from "./env";

let sql: ReturnType<typeof neon> | null = null;

export function getSql() {
  if (!sql) {
    const databaseUrl = requiredEnv("DATABASE_URL");
    sql = neon(databaseUrl);
  }
  return sql;
}

