import pg from "pg";

function url(): string {
  const u = process.env.DATABASE_URL;
  if (!u) throw new Error("DATABASE_URL is required");
  if (!/e2e|test/.test(u)) throw new Error("Refusing to touch a database whose name does not contain e2e or test");
  return u;
}

export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: url() });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

/** Empties every app table so each run starts from a blank site. */
export async function resetDatabase(): Promise<void> {
  const tables = await query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public'",
  );
  if (tables.length === 0) return;
  await query(`truncate ${tables.map((t) => `"${t.tablename}"`).join(", ")} restart identity cascade`);
}
