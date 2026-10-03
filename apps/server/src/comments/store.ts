import { randomUUID } from "node:crypto";
import pg from "pg";
import { createPool, isDatabaseUrl } from "../db.js";

/**
 * Kommentarer i designguiden (/designguide): feedback på et modul i en bestemt bredde og tilstand, et
 * element fra galleriet, en hel side, et token eller en tekst. Hver kommentar har et mål (target), en
 * læsbar etiket, konteksten (modultype, bredde, skærm, data …), evt. en nål (x, y i rammens pixels),
 * og en status med svar, når den er rettet. Samme mønster som scores/store.ts: `CREATE TABLE IF NOT
 * EXISTS` ved første brug og hukommelseslager uden DATABASE_URL.
 */
export const COMMENT_STATUSES = ["aaben", "rettet", "afvist"] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

export interface CommentContext {
  /** modul, element, side, token, tekst, regel eller sti (en hel side i guiden). */
  kind: string;
  /** Komponenttype (fx LassoKeyFigureCards), katalognummer, token, fil … */
  ref?: string;
  viewport?: string;
  vw?: number;
  width?: string;
  mode?: string;
  /** Datakilden, modulet blev vist med (fx "Eksempel Byg A/S" eller "Fiktive data"). */
  data?: string;
  /** Adressen i guiden (#/…), så kommentaren kan åbnes igen. */
  hash?: string;
  theme?: string;
  /** Elementet under nålen (tag, klasser og tekst), så det kan findes i koden. */
  element?: string;
}

export interface CommentInput {
  target: string;
  label: string;
  context: CommentContext;
  pin?: { x: number; y: number };
  text: string;
  author: string;
}

export interface Comment extends CommentInput {
  id: string;
  status: CommentStatus;
  /** Svaret, når kommentaren er rettet eller afvist (hvad der blev gjort). */
  reply?: string;
  /** Commit, der rettede den. */
  commit?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentPatch {
  status?: CommentStatus;
  reply?: string;
  commit?: string;
  text?: string;
}

export interface CommentStore {
  readonly kind: "postgres" | "memory";
  migrate(): Promise<void>;
  list(): Promise<Comment[]>;
  add(input: CommentInput): Promise<Comment>;
  update(id: string, patch: CommentPatch): Promise<Comment | null>;
  remove(id: string): Promise<boolean>;
  /** Godkendte former pr. modul (designguidens "Fra største til mindste"). */
  listFormats(): Promise<FormatApproval[]>;
  setFormats(input: FormatApproval): Promise<FormatApproval>;
  close(): Promise<void>;
}

/** De former, et modul må bruge (packages/spec/src/layoutFormats.ts), som de er godkendt i designguiden. */
export interface FormatApproval {
  type: string;
  approved: string[];
  author: string;
  updatedAt?: string;
}

/** Validerer en godkendelse mod modulets former; kaster en fejl med en læsbar besked. */
export function cleanFormatApproval(type: string, body: unknown, known: readonly string[] | undefined): FormatApproval {
  if (!known) throw new Error(`Modulet har ingen former: ${type}`);
  const b = (body ?? {}) as Record<string, unknown>;
  const approved = Array.isArray(b.approved) ? b.approved.filter((x): x is string => typeof x === "string") : null;
  if (!approved) throw new Error("approved mangler");
  const unknown = approved.filter((x) => !known.includes(x));
  if (unknown.length) throw new Error(`Ukendte former: ${unknown.join(", ")}`);
  const author = typeof b.author === "string" ? b.author.trim() : "";
  if (!author) throw new Error("Navnet mangler");
  if (author.length > COMMENT_LIMITS.author) throw new Error("Navnet er for langt");
  return { type, approved: known.filter((x) => approved.includes(x)), author };
}

/** Grænser, så en kommentar ikke kan fylde databasen. */
export const COMMENT_LIMITS = { text: 4000, label: 300, target: 300, author: 80, reply: 4000 } as const;

/** Validerer og renser input fra browseren; kaster en fejl med en læsbar besked. */
export function cleanCommentInput(body: unknown): CommentInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number, name: string, required = true) => {
    const s = typeof v === "string" ? v.trim() : "";
    if (required && !s) throw new Error(`${name} mangler`);
    if (s.length > max) throw new Error(`${name} er for lang (højst ${max} tegn)`);
    return s;
  };
  const ctx = (b.context ?? {}) as Record<string, unknown>;
  const context: CommentContext = { kind: str(ctx.kind, 40, "context.kind") };
  for (const k of ["ref", "viewport", "width", "mode", "data", "hash", "theme", "element"] as const) {
    const v = str(ctx[k], 300, `context.${k}`, false);
    if (v) context[k] = v;
  }
  if (typeof ctx.vw === "number" && Number.isFinite(ctx.vw)) context.vw = Math.round(ctx.vw);
  const pinRaw = b.pin as { x?: unknown; y?: unknown } | undefined;
  const pin = pinRaw && typeof pinRaw.x === "number" && typeof pinRaw.y === "number" && Number.isFinite(pinRaw.x) && Number.isFinite(pinRaw.y) ? { x: Math.round(pinRaw.x), y: Math.round(pinRaw.y) } : undefined;
  return {
    target: str(b.target, COMMENT_LIMITS.target, "target"),
    label: str(b.label, COMMENT_LIMITS.label, "label"),
    context,
    ...(pin ? { pin } : {}),
    text: str(b.text, COMMENT_LIMITS.text, "Teksten"),
    author: str(b.author, COMMENT_LIMITS.author, "Navnet"),
  };
}

export function cleanCommentPatch(body: unknown): CommentPatch {
  const b = (body ?? {}) as Record<string, unknown>;
  const patch: CommentPatch = {};
  if (b.status !== undefined) {
    if (!COMMENT_STATUSES.includes(b.status as CommentStatus)) throw new Error(`Ukendt status: ${String(b.status)}`);
    patch.status = b.status as CommentStatus;
  }
  for (const k of ["reply", "commit", "text"] as const) {
    if (b[k] === undefined) continue;
    const s = typeof b[k] === "string" ? (b[k] as string).trim() : "";
    if (s.length > COMMENT_LIMITS.reply) throw new Error(`${k} er for lang`);
    if (k === "text" && !s) throw new Error("Teksten mangler");
    patch[k] = s;
  }
  return patch;
}

const MIGRATION = `
CREATE TABLE IF NOT EXISTS designguide_comments (
  id          TEXT PRIMARY KEY,
  target      TEXT NOT NULL,
  label       TEXT NOT NULL,
  context     JSONB NOT NULL,
  pin         JSONB,
  text        TEXT NOT NULL,
  author      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'aaben',
  reply       TEXT,
  commit_sha  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS designguide_comments_target_idx ON designguide_comments (target);
CREATE TABLE IF NOT EXISTS designguide_formats (
  type        TEXT PRIMARY KEY,
  approved    JSONB NOT NULL,
  author      TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

interface Row {
  id: string;
  target: string;
  label: string;
  context: CommentContext;
  pin: { x: number; y: number } | null;
  text: string;
  author: string;
  status: CommentStatus;
  reply: string | null;
  commit_sha: string | null;
  created_at: Date;
  updated_at: Date;
}

const fromRow = (r: Row): Comment => ({
  id: r.id,
  target: r.target,
  label: r.label,
  context: r.context,
  ...(r.pin ? { pin: r.pin } : {}),
  text: r.text,
  author: r.author,
  status: r.status,
  ...(r.reply ? { reply: r.reply } : {}),
  ...(r.commit_sha ? { commit: r.commit_sha } : {}),
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

export class PgCommentStore implements CommentStore {
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

  async list() {
    await this.migrate();
    const r = await this.pool.query<Row>("SELECT * FROM designguide_comments ORDER BY created_at");
    return r.rows.map(fromRow);
  }

  async add(input: CommentInput) {
    await this.migrate();
    const r = await this.pool.query<Row>(
      `INSERT INTO designguide_comments (id, target, label, context, pin, text, author) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [randomUUID(), input.target, input.label, JSON.stringify(input.context), input.pin ? JSON.stringify(input.pin) : null, input.text, input.author],
    );
    return fromRow(r.rows[0]!);
  }

  async update(id: string, patch: CommentPatch) {
    await this.migrate();
    const r = await this.pool.query<Row>(
      `UPDATE designguide_comments SET
         status = COALESCE($2, status), reply = COALESCE($3, reply), commit_sha = COALESCE($4, commit_sha),
         text = COALESCE($5, text), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, patch.status ?? null, patch.reply ?? null, patch.commit ?? null, patch.text ?? null],
    );
    return r.rows[0] ? fromRow(r.rows[0]) : null;
  }

  async remove(id: string) {
    await this.migrate();
    const r = await this.pool.query("DELETE FROM designguide_comments WHERE id = $1", [id]);
    return (r.rowCount ?? 0) > 0;
  }

  async listFormats() {
    await this.migrate();
    const r = await this.pool.query<{ type: string; approved: string[]; author: string; updated_at: Date }>("SELECT * FROM designguide_formats ORDER BY type");
    return r.rows.map((x) => ({ type: x.type, approved: x.approved, author: x.author, updatedAt: x.updated_at.toISOString() }));
  }

  async setFormats(input: FormatApproval) {
    await this.migrate();
    const r = await this.pool.query<{ updated_at: Date }>(
      `INSERT INTO designguide_formats (type, approved, author) VALUES ($1, $2, $3)
       ON CONFLICT (type) DO UPDATE SET approved = EXCLUDED.approved, author = EXCLUDED.author, updated_at = now() RETURNING updated_at`,
      [input.type, JSON.stringify(input.approved), input.author],
    );
    return { type: input.type, approved: input.approved, author: input.author, updatedAt: r.rows[0]!.updated_at.toISOString() };
  }

  async close() {
    if (this.ownsPool) await this.pool.end();
  }
}

/** Til lokal udvikling uden Postgres. Forsvinder ved genstart. */
export class MemoryCommentStore implements CommentStore {
  readonly kind = "memory" as const;
  private readonly items = new Map<string, Comment>();
  async migrate() {}
  async close() {}
  async list() {
    return [...this.items.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async add(input: CommentInput) {
    const now = new Date().toISOString();
    const c: Comment = { ...input, id: randomUUID(), status: "aaben", createdAt: now, updatedAt: now };
    this.items.set(c.id, c);
    return c;
  }
  async update(id: string, patch: CommentPatch) {
    const c = this.items.get(id);
    if (!c) return null;
    const next: Comment = { ...c, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)), updatedAt: new Date().toISOString() };
    this.items.set(id, next);
    return next;
  }
  async remove(id: string) {
    return this.items.delete(id);
  }
  private readonly formats = new Map<string, FormatApproval>();
  async listFormats() {
    return [...this.formats.values()];
  }
  async setFormats(input: FormatApproval) {
    const f = { ...input, updatedAt: new Date().toISOString() };
    this.formats.set(input.type, f);
    return f;
  }
}

export function createCommentStore(conn: string | pg.Pool): CommentStore {
  if (typeof conn !== "string") return new PgCommentStore(conn);
  return isDatabaseUrl(conn) ? new PgCommentStore(conn) : new MemoryCommentStore();
}

/**
 * Arbejdslisten til Claude (og udviklere): de åbne kommentarer som markdown, grupperet efter mål, med alt
 * det, der skal til for at finde og rette det (modultype, bredde, skærm, data, nål og adressen i guiden).
 */
export function commentsMarkdown(comments: readonly Comment[], baseUrl: string, status: CommentStatus | "alle" = "aaben"): string {
  const list = comments.filter((c) => status === "alle" || c.status === status);
  const lines = [`# Kommentarer i designguiden (${status === "alle" ? "alle" : status === "aaben" ? "åbne" : status})`, "", `${list.length} kommentarer. Hentet ${new Date().toISOString()}.`, ""];
  const byTarget = new Map<string, Comment[]>();
  for (const c of list) byTarget.set(c.target, [...(byTarget.get(c.target) ?? []), c]);
  for (const [, cs] of byTarget) {
    const first = cs[0]!;
    const ctx = first.context;
    lines.push(`## ${first.label}`, "");
    const facts = [
      ["Slags", ctx.kind],
      ["Reference", ctx.ref],
      ["Skærm", ctx.viewport ? `${ctx.viewport}${ctx.vw ? ` (${ctx.vw} px)` : ""}` : undefined],
      ["Bredde", ctx.width],
      ["Tilstand", ctx.mode],
      ["Data", ctx.data],
      ["Tema", ctx.theme],
      ["Åbn", ctx.hash ? `${baseUrl}/designguide${ctx.hash}` : undefined],
    ].filter(([, v]) => v);
    for (const [k, v] of facts) lines.push(`- ${k}: ${v}`);
    lines.push("");
    for (const c of cs) {
      lines.push(`### ${c.id.slice(0, 8)}: ${c.author}, ${c.createdAt.slice(0, 16).replace("T", " ")}${c.status !== "aaben" ? ` (${c.status})` : ""}`, "");
      if (c.pin) lines.push(`Nål: x ${c.pin.x}, y ${c.pin.y} px i rammen${c.context.element ? `, på ${c.context.element}` : ""}.`, "");
      lines.push(c.text, "");
      if (c.reply) lines.push(`> Svar: ${c.reply}${c.commit ? ` (${c.commit})` : ""}`, "");
    }
  }
  return lines.join("\n");
}
