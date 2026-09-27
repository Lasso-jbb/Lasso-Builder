import pg from "pg";

/** En connection string tæller som sat, medmindre den er Railways uudfyldte pladsholder. */
export function isDatabaseUrl(value: string | undefined): value is string {
  return Boolean(value) && !value!.startsWith("${{");
}

/**
 * Én pool pr. proces, delt af gemte visninger (views/store.ts) og gemte sider (pages/store.ts).
 * null uden DATABASE_URL: så holder begge lagre data i hukommelsen (kun lokalt).
 */
export function createPool(databaseUrl: string): pg.Pool | null {
  if (!isDatabaseUrl(databaseUrl)) return null;
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  pool.on("error", (err) => console.error("[db] pool error:", err.message));
  return pool;
}
