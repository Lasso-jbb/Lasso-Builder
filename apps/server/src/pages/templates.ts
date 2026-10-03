import { randomUUID } from "node:crypto";
import pg from "pg";
import type { ViewSpec } from "@lasso/spec";
import { createPool, isDatabaseUrl } from "../db.js";
import { hasPlaceholder, type TemplateKind } from "./templateSpec.js";

/**
 * Sideskabeloner (docs/chat.md, "Tilføj som fane"): brugerens egne sider, bundet til en slags (virksomhed eller person),
 * der vises som et ekstra modul på alle virksomheder eller personer, brugeren åbner. Specen er uden entitet (pladsholderen
 * {{entity}}, se templateSpec.ts); data hentes friskt, hver gang siden vises. Samme mønster som gemte sider (pages/store.ts):
 * Postgres nu, hukommelse uden database; alt er pr. organisation og bruger.
 */

export interface PageTemplateInput {
  org: string;
  userId: string;
  kind: TemplateKind;
  title: string;
  subtitle?: string;
  /** Entitetsuafhængig spec (med {{entity}}). */
  spec: ViewSpec;
}

export interface PageTemplateRecord extends PageTemplateInput {
  id: string;
  createdAt: string;
}

export class PageTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageTemplateError";
  }
}

export interface PageTemplateStore {
  readonly kind: "postgres" | "memory";
  migrate(): Promise<void>;
  create(input: PageTemplateInput): Promise<PageTemplateRecord>;
  /** Ældste først (så modulerne står i den rækkefølge, de blev tilføjet). */
  list(org: string, userId: string, kind?: TemplateKind): Promise<PageTemplateRecord[]>;
  get(org: string, userId: string, id: string): Promise<PageTemplateRecord | null>;
  /** true, hvis skabelonen fandtes (og var brugerens egen). */
  remove(org: string, userId: string, id: string): Promise<boolean>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

const MAX_TITLE = 120;
const MAX_SUBTITLE = 200;
/** Højst så mange skabeloner pr. bruger, og så stor en spec (JSON) pr. skabelon. */
export const MAX_TEMPLATES = 50;
export const MAX_SPEC_BYTES = 200_000;
const ID_PART = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,79}$/;

/** Fælles validering for begge lagre; kaster PageTemplateError med en tekst, der kan vises til brugeren. */
export function validateTemplate(input: PageTemplateInput): PageTemplateInput {
  if (!ID_PART.test(input.org) || !ID_PART.test(input.userId)) throw new PageTemplateError("Ugyldig bruger eller organisation.");
  if (input.kind !== "company" && input.kind !== "person") throw new PageTemplateError("kind skal være company eller person.");
  const title = input.title.trim().slice(0, MAX_TITLE);
  if (!title) throw new PageTemplateError("Siden mangler en titel.");
  const subtitle = input.subtitle?.trim().slice(0, MAX_SUBTITLE) || undefined;
  if (!hasPlaceholder(input.spec)) throw new PageTemplateError("Skabelonen er ikke bundet til en entitet.");
  if (Buffer.byteLength(JSON.stringify(input.spec), "utf8") > MAX_SPEC_BYTES) throw new PageTemplateError("Siden er for stor til at blive gemt.");
  return { org: input.org, userId: input.userId, kind: input.kind, title, subtitle, spec: input.spec };
}

const MIGRATION = `
CREATE TABLE IF NOT EXISTS page_templates (
  id         TEXT        PRIMARY KEY,
  org        TEXT        NOT NULL,
  user_id    TEXT        NOT NULL,
  kind       TEXT        NOT NULL CHECK (kind IN ('company', 'person')),
  title      TEXT        NOT NULL,
  subtitle   TEXT,
  spec       JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS page_templates_user_idx ON page_templates (org, user_id, kind, created_at);
`;

interface Row {
  id: string;
  org: string;
  user_id: string;
  kind: TemplateKind;
  title: string;
  subtitle: string | null;
  spec: ViewSpec;
  created_at: Date;
}

const fromRow = (r: Row): PageTemplateRecord => ({ id: r.id, org: r.org, userId: r.user_id, kind: r.kind, title: r.title, subtitle: r.subtitle ?? undefined, spec: r.spec, createdAt: r.created_at.toISOString() });

export class PgPageTemplateStore implements PageTemplateStore {
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

  async create(raw: PageTemplateInput) {
    const input = validateTemplate(raw);
    await this.migrate();
    // Tælling og indsættelse i én transaktion bag en advisory lock pr. bruger, så to samtidige kald ikke begge slipper under grænsen.
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`page_templates:${input.org}:${input.userId}`]);
      const r = await client.query<Row>(
        `INSERT INTO page_templates (id, org, user_id, kind, title, subtitle, spec)
         SELECT $1, $2, $3, $4, $5, $6, $7
         WHERE (SELECT count(*) FROM page_templates WHERE org = $2 AND user_id = $3) < ${MAX_TEMPLATES}
         RETURNING *`,
        [randomUUID(), input.org, input.userId, input.kind, input.title, input.subtitle ?? null, JSON.stringify(input.spec)],
      );
      await client.query("COMMIT");
      if (!r.rows[0]) throw new PageTemplateError(`Du kan højst have ${MAX_TEMPLATES} egne sider.`);
      return fromRow(r.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  async list(org: string, userId: string, kind?: TemplateKind) {
    await this.migrate();
    const r = kind
      ? await this.pool.query<Row>("SELECT * FROM page_templates WHERE org = $1 AND user_id = $2 AND kind = $3 ORDER BY created_at, id", [org, userId, kind])
      : await this.pool.query<Row>("SELECT * FROM page_templates WHERE org = $1 AND user_id = $2 ORDER BY created_at, id", [org, userId]);
    return r.rows.map(fromRow);
  }

  async get(org: string, userId: string, id: string) {
    await this.migrate();
    const r = await this.pool.query<Row>("SELECT * FROM page_templates WHERE org = $1 AND user_id = $2 AND id = $3", [org, userId, id]);
    return r.rows[0] ? fromRow(r.rows[0]) : null;
  }

  async remove(org: string, userId: string, id: string) {
    await this.migrate();
    const r = await this.pool.query("DELETE FROM page_templates WHERE org = $1 AND user_id = $2 AND id = $3", [org, userId, id]);
    return (r.rowCount ?? 0) > 0;
  }

  async close() {
    if (this.ownsPool) await this.pool.end();
  }
}

/** Til lokal udvikling og tests uden Postgres. Forsvinder ved genstart. */
export class MemoryPageTemplateStore implements PageTemplateStore {
  readonly kind = "memory" as const;
  private readonly rows: PageTemplateRecord[] = [];

  async migrate() {}
  async ping() {
    return true;
  }
  async close() {}

  async create(raw: PageTemplateInput) {
    const input = validateTemplate(raw);
    if (this.rows.filter((t) => t.org === input.org && t.userId === input.userId).length >= MAX_TEMPLATES) throw new PageTemplateError(`Du kan højst have ${MAX_TEMPLATES} egne sider.`);
    const record: PageTemplateRecord = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    this.rows.push(record);
    return record;
  }

  async list(org: string, userId: string, kind?: TemplateKind) {
    return this.rows.filter((t) => t.org === org && t.userId === userId && (!kind || t.kind === kind));
  }

  async get(org: string, userId: string, id: string) {
    return this.rows.find((t) => t.org === org && t.userId === userId && t.id === id) ?? null;
  }

  async remove(org: string, userId: string, id: string) {
    const i = this.rows.findIndex((t) => t.org === org && t.userId === userId && t.id === id);
    if (i < 0) return false;
    this.rows.splice(i, 1);
    return true;
  }
}

export function createPageTemplateStore(conn: string | pg.Pool): PageTemplateStore {
  if (typeof conn !== "string") return new PgPageTemplateStore(conn);
  return isDatabaseUrl(conn) ? new PgPageTemplateStore(conn) : new MemoryPageTemplateStore();
}
