import pg from "pg";
import { createPool, isDatabaseUrl } from "../db.js";

/**
 * Rating-historik (plan C2, docs/plan-c1-c2-score.md): ét punkt pr. Creditsafe-vurdering, som kunden har
 * abonnement på. Kun virksomheders score (CVR), ingen persondata. Samme mønster som views/store.ts:
 * `CREATE TABLE IF NOT EXISTS` ved første brug, og hukommelseslager uden DATABASE_URL.
 */
export interface ScorePointInput {
  lassoId: string;
  /** Ratingens egen dato (ÅÅÅÅ-MM-DD eller ISO-tidspunkt); opslagstidspunktet, når den mangler. */
  observedAt: string;
  /** Lassos skala 0–100 (0 = lav risiko). */
  score: number;
  /** Creditsafe 1–100 som modtaget. */
  localScore?: number;
  /** International score A–E. */
  intlScore?: string;
  creditMax?: number;
  currency?: string;
}

export interface StoredScorePoint {
  lassoId: string;
  /** ISO-tidspunkt (UTC). */
  observedAt: string;
  score: number;
  localScore?: number;
  intlScore?: string;
  creditMax?: number;
  currency?: string;
}

export interface ScoreStore {
  readonly kind: "postgres" | "memory";
  migrate(): Promise<void>;
  /** Idempotent: samme (lassoId, observedAt, score) giver ingen ny række. */
  record(points: readonly ScorePointInput[]): Promise<void>;
  /** Stigende efter observedAt. */
  history(lassoId: string): Promise<StoredScorePoint[]>;
  close(): Promise<void>;
}

const MIGRATION = `
CREATE TABLE IF NOT EXISTS score_points (
  id           BIGSERIAL PRIMARY KEY,
  lasso_id     TEXT NOT NULL,
  observed_at  TIMESTAMPTZ NOT NULL,
  score        SMALLINT NOT NULL,
  local_score  SMALLINT,
  intl_score   CHAR(1),
  credit_max   NUMERIC,
  currency     CHAR(3),
  source       TEXT NOT NULL DEFAULT 'creditsafe',
  UNIQUE (lasso_id, observed_at, score)
);
CREATE INDEX IF NOT EXISTS score_points_lasso_idx ON score_points (lasso_id, observed_at);
`;

/** ÅÅÅÅ-MM-DD (eller længere ISO) -> ISO-tidspunkt i UTC; null ved ugyldig dato. */
export function normalizeObservedAt(value: string): string | null {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function clean(points: readonly ScorePointInput[]): (ScorePointInput & { observedAt: string })[] {
  const out: (ScorePointInput & { observedAt: string })[] = [];
  for (const p of points) {
    const observedAt = normalizeObservedAt(p.observedAt);
    if (!observedAt || !Number.isFinite(p.score)) continue;
    out.push({ ...p, observedAt, score: Math.round(p.score) });
  }
  return out;
}

interface Row {
  lasso_id: string;
  observed_at: Date;
  score: number;
  local_score: number | null;
  intl_score: string | null;
  credit_max: string | null;
  currency: string | null;
}

export class PgScoreStore implements ScoreStore {
  readonly kind = "postgres" as const;
  private readonly pool: pg.Pool;
  private readonly ownsPool: boolean;
  private migrated: Promise<void> | null = null;

  constructor(conn: string | pg.Pool) {
    this.ownsPool = typeof conn === "string";
    this.pool = typeof conn === "string" ? createPool(conn)! : conn;
  }

  /** Idempotent. Fejler den, prøves igen ved næste kald. */
  migrate(): Promise<void> {
    if (!this.migrated) {
      this.migrated = this.pool.query(MIGRATION).then(
        () => undefined,
        (err: unknown) => {
          this.migrated = null;
          throw err;
        },
      );
    }
    return this.migrated;
  }

  async record(points: readonly ScorePointInput[]) {
    const rows = clean(points);
    if (rows.length === 0) return;
    await this.migrate();
    for (const p of rows) {
      await this.pool.query(
        `INSERT INTO score_points (lasso_id, observed_at, score, local_score, intl_score, credit_max, currency)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (lasso_id, observed_at, score) DO NOTHING`,
        [p.lassoId, p.observedAt, p.score, p.localScore ?? null, p.intlScore ?? null, p.creditMax ?? null, p.currency ?? null],
      );
    }
  }

  async history(lassoId: string): Promise<StoredScorePoint[]> {
    await this.migrate();
    const r = await this.pool.query<Row>(
      "SELECT lasso_id, observed_at, score, local_score, intl_score, credit_max, currency FROM score_points WHERE lasso_id = $1 ORDER BY observed_at",
      [lassoId],
    );
    return r.rows.map((x) => ({
      lassoId: x.lasso_id,
      observedAt: x.observed_at.toISOString(),
      score: x.score,
      ...(x.local_score !== null ? { localScore: x.local_score } : {}),
      ...(x.intl_score ? { intlScore: x.intl_score.trim() } : {}),
      ...(x.credit_max !== null ? { creditMax: Number(x.credit_max) } : {}),
      ...(x.currency ? { currency: x.currency.trim() } : {}),
    }));
  }

  async close() {
    if (this.ownsPool) await this.pool.end();
  }
}

/** Til lokal udvikling uden Postgres. Forsvinder ved genstart. */
export class MemoryScoreStore implements ScoreStore {
  readonly kind = "memory" as const;
  private readonly points = new Map<string, StoredScorePoint>();

  async migrate() {}
  async close() {}

  async record(points: readonly ScorePointInput[]) {
    for (const p of clean(points)) {
      const key = `${p.lassoId}|${p.observedAt}|${p.score}`;
      if (this.points.has(key)) continue;
      const { observedAt, lassoId, score, localScore, intlScore, creditMax, currency } = p;
      this.points.set(key, {
        lassoId,
        observedAt,
        score,
        ...(localScore !== undefined ? { localScore } : {}),
        ...(intlScore ? { intlScore } : {}),
        ...(creditMax !== undefined ? { creditMax } : {}),
        ...(currency ? { currency } : {}),
      });
    }
  }

  async history(lassoId: string) {
    return [...this.points.values()].filter((p) => p.lassoId === lassoId).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  }
}

export function createScoreStore(conn: string | pg.Pool): ScoreStore {
  if (typeof conn !== "string") return new PgScoreStore(conn);
  return isDatabaseUrl(conn) ? new PgScoreStore(conn) : new MemoryScoreStore();
}
