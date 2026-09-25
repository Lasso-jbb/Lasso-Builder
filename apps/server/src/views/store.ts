import { randomBytes } from "node:crypto";
import pg from "pg";
import type { ViewSpec } from "@lasso/spec";

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

export interface ViewStore {
  readonly kind: "postgres" | "memory";
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
`;

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

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
    this.pool.on("error", (err) => console.error("[db] pool error:", err.message));
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
    await this.pool.end();
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

  async get(org: string, slug: string) {
    return this.views.get(`${org}/${slug}`) ?? null;
  }

  async list(org: string, owner?: string) {
    return [...this.views.values()].filter((v) => v.org === org && (!owner || v.owner === owner));
  }
}

export function createViewStore(databaseUrl: string): ViewStore {
  return databaseUrl && !databaseUrl.startsWith("${{") ? new PgViewStore(databaseUrl) : new MemoryViewStore();
}
