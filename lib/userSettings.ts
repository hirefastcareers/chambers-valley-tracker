import { getSql } from "@/lib/db";

type Sql = ReturnType<typeof getSql>;

/** Drop legacy settings PK on `key` alone so per-user rows can coexist. */
export async function ensureSettingsMultitenancySchema(sql: Sql) {
  await sql`
    ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS user_id TEXT;
  `;

  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'settings'::regclass
          AND conname = 'settings_pkey'
          AND pg_get_constraintdef(oid) = 'PRIMARY KEY (key)'
      ) THEN
        ALTER TABLE settings DROP CONSTRAINT settings_pkey;
      END IF;
    END
    $$;
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_key_user_id
      ON settings (key, user_id);
  `;
}

export async function upsertUserSetting(
  sql: Sql,
  userId: string,
  key: string,
  value: string
) {
  await ensureSettingsMultitenancySchema(sql);
  await sql`
    INSERT INTO settings (key, value, user_id)
    VALUES (${key}, ${value}, ${userId})
    ON CONFLICT (key, user_id) DO UPDATE SET value = EXCLUDED.value;
  `;
}
