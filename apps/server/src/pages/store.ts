import pg from "pg";
import type { SavedPageKind, SavedPageOrigin } from "@lasso/spec";
import { createPool, isDatabaseUrl } from "../db.js";

/**
 * Gem-laget (docs/gem-lag.md): en personlig, brugerbunden liste af gemte Lasso-entiteter
 * (CVR-1-<cvr> for virksomheder, CVR-3-<id> for personer) med tre operationer: gem, list, fjern.
 *
 * Specen gemmes ikke, kun Lasso-ID'et og et navnesnapshot: siden komponeres og hentes friskt,
 * hver gang den vises. Ingen dubletter pr. bruger (primærnøgle org + bruger + Lasso-ID); gemmes
 * samme side igen, flyttes den øverst og navn/focus/note/oprindelse opdateres.
 *
 * Interface, så lageret kan skiftes: Postgres nu; Lassos Lists/tags-API kan lægges bag samme
 * interface, når brugeridentiteten mod Lasso er afklaret (se docs/gem-lag.md, "Hvorfor ikke Lists").
 */

export const COMPANY_ID = /^CVR-1-\d{8}$/;
export const PERSON_ID = /^CVR-[34]-\d{1,12}$/;

/** "company" for CVR-1-…, "person" for CVR-3-…/CVR-4-…, ellers null. */
export function pageKindOf(lassoId: string): SavedPageKind | null {
  if (COMPANY_ID.test(lassoId)) return "company";
  if (PERSON_ID.test(lassoId)) return "person";
  return null;
}

export interface SavedPageInput {
  org: string;
  userId: string;
  lassoId: string;
  kind: SavedPageKind;
  /** Navnesnapshot fra gemmetidspunktet. */
  name: string;
  cvr?: string;
  focus?: string;
  note?: string;
  origin: SavedPageOrigin;
}

export interface SavedPageRecord extends SavedPageInput {
  savedAt: string;
  createdAt: string;
}

export interface ListOptions {
  kind?: SavedPageKind | "all";
  /** 1–100, standard 20. */
  limit?: number;
}

export class SavedPageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SavedPageError";
  }
}

export interface SavedPageStore {
  readonly kind: "postgres" | "memory";
  migrate(): Promise<void>;
  /** Upsert: samme (org, bruger, Lasso-ID) opdaterer og flytter siden øverst. `created` = ny på listen. */
  save(input: SavedPageInput): Promise<{ page: SavedPageRecord; created: boolean }>;
  /** Nyeste først. `total` er antallet af den valgte slags før limit. */
  list(org: string, userId: string, opts?: ListOptions): Promise<{ pages: SavedPageRecord[]; total: number }>;
  get(org: string, userId: string, lassoId: string): Promise<SavedPageRecord | null>;
  /** true, hvis siden var på listen. */
  remove(org: string, userId: string, lassoId: string): Promise<boolean>;
  /** Hvilke af ID'erne der er gemt (til Gem/Gemt-knappen på et hoved). */
  has(org: string, userId: string, lassoIds: readonly string[]): Promise<Set<string>>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

const MAX_NAME = 200;
const MAX_NOTE = 500;
const MAX_FOCUS = 40;
const ID_PART = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,79}$/;

/** Fælles validering for begge lagre; kaster SavedPageError med en tekst, der kan vises til brugeren. */
export function validateSavedPage(input: SavedPageInput): SavedPageInput {
  const lassoId = input.lassoId.trim();
  const kind = pageKindOf(lassoId);
  if (!kind) throw new SavedPageError(`"${input.lassoId}" er ikke et Lasso-ID for en virksomhed (CVR-1-…) eller person (CVR-3-…).`);
  if (kind !== input.kind) throw new SavedPageError(`${lassoId} er en ${kind === "company" ? "virksomhed" : "person"}, ikke en ${input.kind === "company" ? "virksomhed" : "person"}.`);
  if (!ID_PART.test(input.org) || !ID_PART.test(input.userId)) throw new SavedPageError("Ugyldig bruger eller organisation.");
  const name = input.name.trim().slice(0, MAX_NAME);
  if (!name) throw new SavedPageError("Siden mangler et navn.");
  const cvr = input.cvr?.trim() || undefined;
  if (cvr !== undefined && !/^\d{8}$/.test(cvr)) throw new SavedPageError("CVR-nummeret skal være 8 cifre.");
  const focus = input.focus?.trim().slice(0, MAX_FOCUS) || undefined;
  const note = input.note?.trim().slice(0, MAX_NOTE) || undefined;
  return { org: input.org, userId: input.userId, lassoId, kind, name, cvr, focus, note, origin: input.origin };
}

const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 100;
const clampLimit = (n: number | undefined) => Math.min(LIMIT_MAX, Math.max(1, Math.floor(n ?? LIMIT_DEFAULT)));

const MIGRATION = `
CREATE TABLE IF NOT EXISTS saved_pages (
  org        TEXT        NOT NULL,
  user_id    TEXT        NOT NULL,
  lasso_id   TEXT        NOT NULL,
  kind       TEXT        NOT NULL CHECK (kind IN ('company', 'person')),
  name       TEXT        NOT NULL,
  cvr        TEXT,
  focus      TEXT,
  note       TEXT,
  origin     TEXT        NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'link', 'send')),
  saved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org, user_id, lasso_id)
);
CREATE INDEX IF NOT EXISTS saved_pages_user_idx ON saved_pages (org, user_id, saved_at DESC);
`;

interface Row {
  org: string;
  user_id: string;
  lasso_id: string;
  kind: SavedPageKind;
  name: string;
  cvr: string | null;
  focus: string | null;
  note: string | null;
  origin: SavedPageOrigin;
  saved_at: Date;
  created_at: Date;
  inserted?: boolean;
}

function fromRow(r: Row): SavedPageRecord {
  return {
    org: r.org,
    userId: r.user_id,
    lassoId: r.lasso_id,
    kind: r.kind,
    name: r.name,
    cvr: r.cvr ?? undefined,
    focus: r.focus ?? undefined,
    note: r.note ?? undefined,
    origin: r.origin,
    savedAt: r.saved_at.toISOString(),
    createdAt: r.created_at.toISOString(),
  };
}

export class PgSavedPageStore implements SavedPageStore {
  readonly kind = "postgres" as const;
  private readonly pool: pg.Pool;
  private readonly ownsPool: boolean;
  private migrated: Promise<void> | null = null;

  constructor(conn: string | pg.Pool) {
    this.ownsPool = typeof conn === "string";
    this.pool = typeof conn === "string" ? createPool(conn)! : conn;
  }

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

  async ping() {
    try {
      await this.migrate();
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async save(raw: SavedPageInput) {
    const input = validateSavedPage(raw);
    await this.migrate();
    const r = await this.pool.query<Row>(
      `INSERT INTO saved_pages (org, user_id, lasso_id, kind, name, cvr, focus, note, origin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (org, user_id, lasso_id) DO UPDATE SET
         name = EXCLUDED.name,
         cvr = COALESCE(EXCLUDED.cvr, saved_pages.cvr),
         focus = COALESCE(EXCLUDED.focus, saved_pages.focus),
         note = COALESCE(EXCLUDED.note, saved_pages.note),
         origin = EXCLUDED.origin,
         saved_at = now()
       RETURNING *, (xmax = 0) AS inserted`,
      [input.org, input.userId, input.lassoId, input.kind, input.name, input.cvr ?? null, input.focus ?? null, input.note ?? null, input.origin],
    );
    const row = r.rows[0]!;
    return { page: fromRow(row), created: Boolean(row.inserted) };
  }

  async list(org: string, userId: string, opts: ListOptions = {}) {
    await this.migrate();
    const kind = opts.kind ?? "all";
    const limit = clampLimit(opts.limit);
    const where = kind === "all" ? "org = $1 AND user_id = $2" : "org = $1 AND user_id = $2 AND kind = $3";
    const params: unknown[] = kind === "all" ? [org, userId] : [org, userId, kind];
    const [rows, count] = await Promise.all([
      this.pool.query<Row>(`SELECT * FROM saved_pages WHERE ${where} ORDER BY saved_at DESC, lasso_id LIMIT ${limit}`, params),
      this.pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM saved_pages WHERE ${where}`, params),
    ]);
    return { pages: rows.rows.map(fromRow), total: Number(count.rows[0]?.n ?? 0) };
  }

  async get(org: string, userId: string, lassoId: string) {
    await this.migrate();
    const r = await this.pool.query<Row>("SELECT * FROM saved_pages WHERE org = $1 AND user_id = $2 AND lasso_id = $3", [org, userId, lassoId]);
    return r.rows[0] ? fromRow(r.rows[0]) : null;
  }

  async remove(org: string, userId: string, lassoId: string) {
    await this.migrate();
    const r = await this.pool.query("DELETE FROM saved_pages WHERE org = $1 AND user_id = $2 AND lasso_id = $3", [org, userId, lassoId]);
    return (r.rowCount ?? 0) > 0;
  }

  async has(org: string, userId: string, lassoIds: readonly string[]) {
    const ids = [...new Set(lassoIds)].filter((id) => pageKindOf(id));
    if (ids.length === 0) return new Set<string>();
    await this.migrate();
    const r = await this.pool.query<{ lasso_id: string }>("SELECT lasso_id FROM saved_pages WHERE org = $1 AND user_id = $2 AND lasso_id = ANY($3::text[])", [org, userId, ids]);
    return new Set(r.rows.map((x) => x.lasso_id));
  }

  async close() {
    if (this.ownsPool) await this.pool.end();
  }
}

/** Til lokal udvikling og tests uden Postgres. Forsvinder ved genstart. */
export class MemorySavedPageStore implements SavedPageStore {
  readonly kind = "memory" as const;
  private readonly pages = new Map<string, SavedPageRecord>();

  async migrate() {}
  async ping() {
    return true;
  }
  async close() {}

  private key(org: string, userId: string, lassoId: string) {
    return `${org}\u0000${userId}\u0000${lassoId}`;
  }

  async save(raw: SavedPageInput) {
    const input = validateSavedPage(raw);
    const key = this.key(input.org, input.userId, input.lassoId);
    const existing = this.pages.get(key);
    const now = new Date().toISOString();
    const page: SavedPageRecord = {
      ...input,
      cvr: input.cvr ?? existing?.cvr,
      focus: input.focus ?? existing?.focus,
      note: input.note ?? existing?.note,
      savedAt: now,
      createdAt: existing?.createdAt ?? now,
    };
    this.pages.set(key, page);
    return { page, created: !existing };
  }

  async list(org: string, userId: string, opts: ListOptions = {}) {
    const kind = opts.kind ?? "all";
    const all = [...this.pages.values()]
      .filter((p) => p.org === org && p.userId === userId && (kind === "all" || p.kind === kind))
      .sort((a, b) => (a.savedAt === b.savedAt ? a.lassoId.localeCompare(b.lassoId) : b.savedAt.localeCompare(a.savedAt)));
    return { pages: all.slice(0, clampLimit(opts.limit)), total: all.length };
  }

  async get(org: string, userId: string, lassoId: string) {
    return this.pages.get(this.key(org, userId, lassoId)) ?? null;
  }

  async remove(org: string, userId: string, lassoId: string) {
    return this.pages.delete(this.key(org, userId, lassoId));
  }

  async has(org: string, userId: string, lassoIds: readonly string[]) {
    return new Set(lassoIds.filter((id) => this.pages.has(this.key(org, userId, id))));
  }
}

export function createSavedPageStore(conn: string | pg.Pool): SavedPageStore {
  if (typeof conn !== "string") return new PgSavedPageStore(conn);
  return isDatabaseUrl(conn) ? new PgSavedPageStore(conn) : new MemorySavedPageStore();
}
