import { createHash, randomBytes } from "node:crypto";
import pg from "pg";
import type { ViewSpec } from "@lasso/spec";
import { createPool, isDatabaseUrl } from "../db.js";

export const VISIBILITIES = ["private", "org", "link"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export interface SavedView {
  org: string;
  slug: string;
  name: string | null;
  spec: ViewSpec;
  visibility: Visibility;
  owner: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaveInput {
  org: string;
  slug?: string;
  name?: string;
  spec: ViewSpec;
  visibility?: Visibility;
  owner: string;
}

export class ViewConflictError extends Error {
  constructor(org: string, slug: string) {
    super(`Adressen ${org}/${slug} er allerede taget af en anden bruger`);
    this.name = "ViewConflictError";
  }
}

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/** "Revisionskunder – Midt" -> "revisionskunder-midt" */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

export function randomSlug(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/**
 * Korte links (/d/<id>): en visning gemt under et kort, tilfældigt id (ikke at gætte), pr. organisation og med oprettelsestid, så den
 * kan udløbe (LINK_TTL_DAYS). Specen gemmes, ikke data: siden henter friskt, hver gang den vises. entity er den ene virksomhed eller
 * person, visningen handler om (til "Åben i Lasso"), ellers udeladt.
 */
export interface ShortView {
  id: string;
  org: string;
  owner: string | null;
  spec: ViewSpec;
  entity?: { kind: "company" | "person"; id: string };
  title: string;
  subtitle?: string;
  createdAt: string;
}

export interface ShortViewInput {
  org: string;
  owner: string;
  spec: ViewSpec;
  entity?: { kind: "company" | "person"; id: string };
  title: string;
  subtitle?: string;
  /** Kun til test af udløb. */
  createdAt?: string;
}

const SHORT_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
/** 10 tegn af 31 (ca. 49 bit): kort nok til en adresse, for stort til at gætte. */
export const SHORT_ID_LENGTH = 10;
export const SHORT_ID_PATTERN = /^[a-z0-9]{8,10}$/;

export function randomShortId(): string {
  return Array.from(randomBytes(SHORT_ID_LENGTH), (b) => SHORT_ALPHABET[b % SHORT_ALPHABET.length]).join("");
}

/** Stabil tekstform (sorterede nøgler), så samme visning altid giver samme hash, også efter en tur gennem JSONB. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

export const specHash = (v: unknown): string => createHash("sha1").update(canonicalJson(v)).digest("hex");

const shortHash = (i: ShortViewInput) => specHash({ spec: i.spec, entity: i.entity ?? null, title: i.title, subtitle: i.subtitle ?? null });

export interface ViewStore {
  readonly kind: "postgres" | "memory";
  /** Gemmer en visning under et kort id. Den samme visning (samme bruger, spec og entitet) inden for ttlDays giver det samme id igen. */
  saveShort(input: ShortViewInput, ttlDays: number): Promise<ShortView>;
  /** Visningen bag et kort id (også udløbne; kalderen tjekker alder med shortExpired). */
  getShort(id: string): Promise<ShortView | null>;
  migrate(): Promise<void>;
  save(input: SaveInput): Promise<SavedView>;
  get(org: string, slug: string): Promise<SavedView | null>;
  list(org: string, owner?: string): Promise<SavedView[]>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * Specen gemmes, ikke data. Gemmer man igen på samme adresse, opdateres den,
 * og den forrige version ligger i view_versions.
 */
const MIGRATION = `
CREATE TABLE IF NOT EXISTS views (
  org         TEXT        NOT NULL,
  slug        TEXT        NOT NULL,
  name        TEXT,
  spec        JSONB       NOT NULL,
  visibility  TEXT        NOT NULL DEFAULT 'org',
  owner       TEXT,
  version     INTEGER     NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org, slug)
);
CREATE TABLE IF NOT EXISTS view_versions (
  org       TEXT        NOT NULL,
  slug      TEXT        NOT NULL,
  version   INTEGER     NOT NULL,
  name      TEXT,
  spec      JSONB       NOT NULL,
  saved_by  TEXT,
  saved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org, slug, version),
  FOREIGN KEY (org, slug) REFERENCES views (org, slug) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS views_owner_idx ON views (org, owner, updated_at DESC);
CREATE TABLE IF NOT EXISTS short_views (
  id          TEXT        PRIMARY KEY,
  org         TEXT        NOT NULL,
  owner       TEXT,
  hash        TEXT        NOT NULL,
  spec        JSONB       NOT NULL,
  entity_kind TEXT,
  entity_id   TEXT,
  title       TEXT        NOT NULL,
  subtitle    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS short_views_hash_idx ON short_views (org, owner, hash, created_at DESC);
`;

interface ShortRow {
  id: string;
  org: string;
  owner: string | null;
  spec: ViewSpec;
  entity_kind: "company" | "person" | null;
  entity_id: string | null;
  title: string;
  subtitle: string | null;
  created_at: Date;
}

const shortFromRow = (r: ShortRow): ShortView => ({
  id: r.id,
  org: r.org,
  owner: r.owner,
  spec: r.spec,
  ...(r.entity_kind && r.entity_id ? { entity: { kind: r.entity_kind, id: r.entity_id } } : {}),
  title: r.title,
  ...(r.subtitle ? { subtitle: r.subtitle } : {}),
  createdAt: r.created_at.toISOString(),
});

/** Er det korte link udløbet (ældre end ttlDays)? */
export function shortExpired(v: ShortView, ttlDays: number, now = Date.now()): boolean {
  return now - Date.parse(v.createdAt) > ttlDays * 86_400_000;
}

interface Row {
  org: string;
  slug: string;
  name: string | null;
  spec: ViewSpec;
  visibility: Visibility;
  owner: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

function fromRow(r: Row): SavedView {
  return {
    org: r.org,
    slug: r.slug,
    name: r.name,
    spec: r.spec,
    visibility: r.visibility,
    owner: r.owner,
    version: r.version,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export class PgViewStore implements ViewStore {
  readonly kind = "postgres" as const;
  private readonly pool: pg.Pool;
  private migrated: Promise<void> | null = null;

  private readonly ownsPool: boolean;

  /** Tager en connection string (egen pool) eller en delt pool (se db.ts), som ejeren selv lukker. */
  constructor(conn: string | pg.Pool) {
    this.ownsPool = typeof conn === "string";
    this.pool = typeof conn === "string" ? createPool(conn)! : conn;
  }

  /** Idempotent. Fejler den (fx fordi databasen ikke er oppe endnu), prøves igen ved næste kald. */
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

  async save(input: SaveInput): Promise<SavedView> {
    await this.migrate();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (let attempt = 0; attempt < 5; attempt++) {
        const slug = input.slug ?? randomSlug();
        const existing = await client.query<Row>("SELECT * FROM views WHERE org = $1 AND slug = $2 FOR UPDATE", [input.org, slug]);
        const row = existing.rows[0];
        if (row) {
          if (!input.slug) continue; // tilfældig adresse ramte en eksisterende; prøv igen
          if (row.owner && row.owner !== input.owner) throw new ViewConflictError(input.org, slug);
          const updated = await client.query<Row>(
            `UPDATE views SET name = COALESCE($3, name), spec = $4, visibility = COALESCE($5, visibility),
               version = version + 1, updated_at = now()
             WHERE org = $1 AND slug = $2 RETURNING *`,
            [input.org, slug, input.name ?? null, JSON.stringify(input.spec), input.visibility ?? null],
          );
          const saved = updated.rows[0]!;
          await client.query(
            "INSERT INTO view_versions (org, slug, version, name, spec, saved_by) VALUES ($1, $2, $3, $4, $5, $6)",
            [saved.org, saved.slug, saved.version, saved.name, JSON.stringify(saved.spec), input.owner],
          );
          await client.query("COMMIT");
          return fromRow(saved);
        }
        const inserted = await client.query<Row>(
          `INSERT INTO views (org, slug, name, spec, visibility, owner) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [input.org, slug, input.name ?? null, JSON.stringify(input.spec), input.visibility ?? "org", input.owner],
        );
        const saved = inserted.rows[0]!;
        await client.query(
          "INSERT INTO view_versions (org, slug, version, name, spec, saved_by) VALUES ($1, $2, 1, $3, $4, $5)",
          [saved.org, saved.slug, saved.name, JSON.stringify(saved.spec), input.owner],
        );
        await client.query("COMMIT");
        return fromRow(saved);
      }
      throw new Error("Kunne ikke finde en ledig adresse");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async saveShort(input: ShortViewInput, ttlDays: number): Promise<ShortView> {
    await this.migrate();
    const hash = shortHash(input);
    const cutoff = new Date(Date.now() - ttlDays * 86_400_000);
    const existing = await this.pool.query<ShortRow>("SELECT * FROM short_views WHERE org = $1 AND owner = $2 AND hash = $3 AND created_at > $4 ORDER BY created_at DESC LIMIT 1", [input.org, input.owner, hash, cutoff]);
    if (existing.rows[0]) return shortFromRow(existing.rows[0]);
    // Udløbne rækker ryddes løbende, så tabellen ikke vokser uden grænse.
    await this.pool.query("DELETE FROM short_views WHERE created_at < $1", [cutoff]).catch(() => {});
    for (let attempt = 0; attempt < 5; attempt++) {
      const r = await this.pool.query<ShortRow>(
        `INSERT INTO short_views (id, org, owner, hash, spec, entity_kind, entity_id, title, subtitle, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, now())) ON CONFLICT (id) DO NOTHING RETURNING *`,
        [randomShortId(), input.org, input.owner, hash, JSON.stringify(input.spec), input.entity?.kind ?? null, input.entity?.id ?? null, input.title, input.subtitle ?? null, input.createdAt ?? null],
      );
      if (r.rows[0]) return shortFromRow(r.rows[0]);
    }
    throw new Error("Kunne ikke finde et ledigt kort id");
  }

  async getShort(id: string) {
    await this.migrate();
    const r = await this.pool.query<ShortRow>("SELECT * FROM short_views WHERE id = $1", [id]);
    return r.rows[0] ? shortFromRow(r.rows[0]) : null;
  }

  async get(org: string, slug: string) {
    await this.migrate();
    const r = await this.pool.query<Row>("SELECT * FROM views WHERE org = $1 AND slug = $2", [org, slug]);
    return r.rows[0] ? fromRow(r.rows[0]) : null;
  }

  async list(org: string, owner?: string) {
    await this.migrate();
    const r = owner
      ? await this.pool.query<Row>("SELECT * FROM views WHERE org = $1 AND owner = $2 ORDER BY updated_at DESC LIMIT 100", [org, owner])
      : await this.pool.query<Row>("SELECT * FROM views WHERE org = $1 ORDER BY updated_at DESC LIMIT 100", [org]);
    return r.rows.map(fromRow);
  }

  async close() {
    if (this.ownsPool) await this.pool.end();
  }
}

/** Til lokal udvikling uden Postgres. Forsvinder ved genstart. */
export class MemoryViewStore implements ViewStore {
  readonly kind = "memory" as const;
  private readonly views = new Map<string, SavedView>();

  async migrate() {}
  async ping() {
    return true;
  }
  async close() {}

  async save(input: SaveInput): Promise<SavedView> {
    let slug = input.slug ?? randomSlug();
    while (!input.slug && this.views.has(`${input.org}/${slug}`)) slug = randomSlug();
    const key = `${input.org}/${slug}`;
    const existing = this.views.get(key);
    if (existing?.owner && existing.owner !== input.owner) throw new ViewConflictError(input.org, slug);
    const now = new Date().toISOString();
    const saved: SavedView = {
      org: input.org,
      slug,
      name: input.name ?? existing?.name ?? null,
      spec: input.spec,
      visibility: input.visibility ?? existing?.visibility ?? "org",
      owner: existing?.owner ?? input.owner,
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.views.set(key, saved);
    return saved;
  }

  private readonly shorts = new Map<string, ShortView & { hash: string }>();

  async saveShort(input: ShortViewInput, ttlDays: number): Promise<ShortView> {
    const hash = shortHash(input);
    const t = Date.now();
    for (const [id, v] of this.shorts) if (shortExpired(v, ttlDays, t)) this.shorts.delete(id);
    for (const { hash: h, ...v } of this.shorts.values()) if (v.org === input.org && v.owner === input.owner && h === hash) return v;
    let id = randomShortId();
    while (this.shorts.has(id)) id = randomShortId();
    const v = { id, org: input.org, owner: input.owner, spec: input.spec, ...(input.entity ? { entity: input.entity } : {}), title: input.title, ...(input.subtitle ? { subtitle: input.subtitle } : {}), createdAt: input.createdAt ?? new Date(t).toISOString(), hash };
    this.shorts.set(id, v);
    const { hash: _h, ...out } = v;
    return out;
  }

  async getShort(id: string) {
    const v = this.shorts.get(id);
    if (!v) return null;
    const { hash: _h, ...out } = v;
    return out;
  }

  async get(org: string, slug: string) {
    return this.views.get(`${org}/${slug}`) ?? null;
  }

  async list(org: string, owner?: string) {
    return [...this.views.values()].filter((v) => v.org === org && (!owner || v.owner === owner));
  }
}

export function createViewStore(conn: string | pg.Pool): ViewStore {
  if (typeof conn !== "string") return new PgViewStore(conn);
  return isDatabaseUrl(conn) ? new PgViewStore(conn) : new MemoryViewStore();
}
