import { z } from "zod";

/**
 * Al konfiguration kommer fra miljøvariabler (Railway). Se .env.example.
 * Hemmeligheder logges aldrig.
 */
const schema = z.object({
  NODE_ENV: z.string().default("development"),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  /** Offentlig adresse, bruges til delte links. På Railway: https://${{RAILWAY_PUBLIC_DOMAIN}} */
  PUBLIC_BASE_URL: z.string().default(""),

  /** Postgres. Tom = gemte visninger holdes i hukommelsen (kun til lokal udvikling). */
  DATABASE_URL: z.string().default(""),

  /** Beskytter /mcp. Sendes som ?key=, /mcp/<key>, x-api-key eller Bearer. Tom = åben (kun lokalt). */
  MCP_ACCESS_KEY: z.string().default(""),
  /** Beskytter /api/views (skriv) og /api/debug. */
  ADMIN_API_KEY: z.string().default(""),

  /** Hardcoded demobruger, indtil Lasso ID kobles på (se src/auth/user.ts). */
  DEMO_USER_ID: z.string().default("demo"),
  DEMO_USER_NAME: z.string().default("Demobruger"),
  DEMO_ORG: z.string().default("lasso-demo"),

  LASSO_API_BASE_URL: z.string().default("https://api.lassox.com"),
  LASSO_API_USERNAME: z.string().default(""),
  LASSO_API_PASSWORD: z.string().default(""),
  /** Alternativ til brugernavn/password: en API-nøgle/token. */
  LASSO_API_TOKEN: z.string().default(""),
  /** Header til token. "Authorization" sender "<scheme> <token>"; andre headere sender token rent. */
  LASSO_API_TOKEN_HEADER: z.string().default("Authorization"),
  LASSO_API_AUTH_SCHEME: z.string().default("Bearer"),
  LASSO_API_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  LASSO_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(300),
  LASSO_COMPANY_ID_PREFIX: z.string().default("CVR-1-"),
  /** auto = live når der er credentials, ellers demodata. */
  LASSO_DATA_SOURCE: z.enum(["auto", "live", "demo"]).default("auto"),
  /** Log strukturen (kun feltnavne) af Lassos svar ved opstart. Hjælper med at tilpasse adapters. */
  LASSO_STARTUP_PROBE: z
    .string()
    .default("true")
    .transform((v) => v !== "false" && v !== "0"),
  LASSO_STARTUP_PROBE_QUERY: z.string().default("lasso"),
});

export type Config = z.infer<typeof schema> & { publicBaseUrl: string };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Ugyldig konfiguration: ${issues}`);
  }
  const c = parsed.data;
  const publicBaseUrl = (isSet(c.PUBLIC_BASE_URL) ? c.PUBLIC_BASE_URL : `http://localhost:${c.PORT}`).replace(/\/+$/, "");
  return { ...c, publicBaseUrl };
}

/** Pladsholderen, variablerne blev oprettet med på Railway, tæller som "ikke sat". */
export function isSet(value: string | undefined): value is string {
  if (!value) return false;
  const v = value.trim();
  return v.length > 0 && v !== "CHANGE_ME" && !v.startsWith("https://${{");
}

export function hasLassoCredentials(c: Config): boolean {
  return isSet(c.LASSO_API_TOKEN) || (isSet(c.LASSO_API_USERNAME) && isSet(c.LASSO_API_PASSWORD));
}
