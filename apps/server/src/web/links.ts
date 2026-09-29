import { createHmac, timingSafeEqual } from "node:crypto";
import { FOCUSES, isFocusFor, isPersonFocus, METRICS, type Focus, type Metric, type PageFocus, type PersonFocus, type ViewSpec } from "@lasso/spec";
import { isSet, type Config } from "../config.js";

/**
 * Signerede links til den interaktive virksomhedsvisning: /k/<cvr>?m=…&y=…&e=…&s=…
 * Siden henter friske tal ved hver visning. Signaturen forhindrer, at man kan slå
 * vilkårlige virksomheder op gratis; linket udløber efter LINK_TTL_DAYS.
 */

export interface CompanyLink {
  cvr: string;
  metric: Metric;
  years: number;
  /** Visningens focus (fx "oekonomi"), så linket åbner samme visning som i chatten. Udeladt = overblik. */
  focus?: Focus;
  /** Brugerens spørgsmål (q=, højst 300 tegn), så linket åbner samme svar som i chatten. */
  question?: string;
  /** Nøgletal, modellen genkendte i spørgsmålet (qm=, kun med q): samme spørgsmålsprofil på siden. */
  metrics?: Metric[];
}

/** Et spørgsmål i et link er 1–300 tegn (som show_company/show_person's question). */
export const LINK_QUESTION_MAX = 300;

/**
 * Spørgsmålet i den signerede payload. Uden spørgsmål er payloaden præcis som før, så ældre links
 * (uden q) stadig verificeres. URI-kodet, så punktummer i spørgsmålet ikke kan flytte felterne.
 */
const askPayload = (question?: string, metrics?: readonly Metric[]) =>
  question ? `.q=${encodeURIComponent(question)}${metrics?.length ? `.qm=${metrics.join(",")}` : ""}` : "";

/** q og qm fra en adresse: tomt uden q; null, når de er ugyldige (for langt, tomt, ukendt nøgletal). */
function readQuestion(query: Record<string, unknown>): { question?: string; metrics?: Metric[] } | null {
  if (query.q === undefined) return query.qm === undefined ? {} : null;
  const question = String(query.q);
  if (!question.trim() || question.length > LINK_QUESTION_MAX) return null;
  if (query.qm === undefined) return { question };
  const metrics = String(query.qm).split(",");
  if (metrics.length > 5 || metrics.some((m) => !(METRICS as readonly string[]).includes(m))) return null;
  return { question, metrics: metrics as Metric[] };
}

/** Hemmeligheden bag alle signaturer (links og portal-sessioner). Tom lokalt uden nøgler. */
export function linkSecret(config: Config): string {
  return secret(config);
}

function secret(config: Config): string {
  if (isSet(config.LINK_SECRET)) return config.LINK_SECRET;
  // Uden egen nøgle afledes den af MCP-nøglen (eller brugernøglerne); lokalt uden nøgler er links usignerede.
  if (isSet(config.MCP_ACCESS_KEY)) return `mcp:${config.MCP_ACCESS_KEY}`;
  return config.MCP_USER_KEYS.trim() ? `mcpusers:${config.MCP_USER_KEYS.trim()}` : "";
}

const payload = (l: CompanyLink, exp: number) =>
  `k1.${l.cvr}.${l.metric}.${l.years}.${exp}${l.focus && l.focus !== "overblik" ? `.${l.focus}` : ""}${askPayload(l.question, l.metrics)}`;
const sign = (key: string, text: string) => createHmac("sha256", key).update(text).digest("base64url").slice(0, 22);

export function companyLink(config: Config, input: CompanyLink, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + config.LINK_TTL_DAYS * 86_400;
  const question = input.question?.trim().slice(0, LINK_QUESTION_MAX) || undefined;
  const link: CompanyLink = { ...input, question, metrics: question && input.metrics?.length ? input.metrics.slice(0, 5) : undefined };
  const query = new URLSearchParams({ m: link.metric, y: String(link.years), e: exp.toString(36) });
  if (link.focus && link.focus !== "overblik") query.set("f", link.focus);
  if (link.question) query.set("q", link.question);
  if (link.metrics?.length) query.set("qm", link.metrics.join(","));
  const key = secret(config);
  if (key) query.set("s", sign(key, payload(link, exp)));
  return `${config.publicBaseUrl}/k/${link.cvr}?${query}`;
}

export type LinkCheck = { ok: true; link: CompanyLink } | { ok: false; reason: "invalid" | "expired" };

export function verifyCompanyLink(config: Config, cvr: string, query: Record<string, unknown>, now = Date.now()): LinkCheck {
  const metric = String(query.m ?? "");
  const years = Number(query.y);
  const exp = parseInt(String(query.e ?? ""), 36);
  const focus = query.f === undefined ? undefined : String(query.f);
  if (focus !== undefined && !(FOCUSES as readonly string[]).includes(focus)) return { ok: false, reason: "invalid" };
  if (!/^\d{8}$/.test(cvr) || !(METRICS as readonly string[]).includes(metric) || !Number.isInteger(years) || years < 2 || years > 10 || !Number.isFinite(exp)) {
    return { ok: false, reason: "invalid" };
  }
  const ask = readQuestion(query);
  if (!ask) return { ok: false, reason: "invalid" };
  const link: CompanyLink = { cvr, metric: metric as Metric, years, ...(focus ? { focus: focus as Focus } : {}), ...ask };
  const key = secret(config);
  if (key) {
    const expected = Buffer.from(sign(key, payload(link, exp)));
    const given = Buffer.from(String(query.s ?? ""));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "invalid" };
  }
  if (exp * 1000 < now) return { ok: false, reason: "expired" };
  return { ok: true, link };
}

/**
 * Katalog 16: signeret link til personsiden, /p/<lassoId>?f=…&q=…&e=…&s=… (samme nøgle og udløb som /k/).
 * f = personfokus (fx "risiko"), udeladt for overblik; q = brugerens spørgsmål. Begge indgår i
 * signaturen, og links uden f og q fra før personfokus og spørgsmål har samme signatur som nu.
 */
const personPayload = (lassoId: string, exp: number, focus?: PersonFocus, question?: string) =>
  `p1.${lassoId}.${exp}${focus && focus !== "overblik" ? `.${focus}` : ""}${askPayload(question)}`;

export function personLink(config: Config, lassoId: string, focus?: PersonFocus, now?: number): string;
export function personLink(config: Config, lassoId: string, focus: PersonFocus | undefined, question: string | undefined, now?: number): string;
export function personLink(config: Config, lassoId: string, focus?: PersonFocus, questionOrNow?: string | number, later?: number): string {
  // Ældre kald giver tidspunktet som fjerde parameter.
  const now = typeof questionOrNow === "number" ? questionOrNow : (later ?? Date.now());
  const question = typeof questionOrNow === "string" ? questionOrNow.trim().slice(0, LINK_QUESTION_MAX) || undefined : undefined;
  const exp = Math.floor(now / 1000) + config.LINK_TTL_DAYS * 86_400;
  const f = focus && focus !== "overblik" ? focus : undefined;
  const query = new URLSearchParams({ e: exp.toString(36) });
  if (f) query.set("f", f);
  if (question) query.set("q", question);
  const key = secret(config);
  if (key) query.set("s", sign(key, personPayload(lassoId, exp, f, question)));
  return `${config.publicBaseUrl}/p/${encodeURIComponent(lassoId)}?${query}`;
}

export type PersonLinkCheck = { ok: true; lassoId: string; focus?: PersonFocus; question?: string } | { ok: false; reason: "invalid" | "expired" };

export function verifyPersonLink(config: Config, lassoId: string, query: Record<string, unknown>, now = Date.now()): PersonLinkCheck {
  const exp = parseInt(String(query.e ?? ""), 36);
  const focusRaw = query.f === undefined ? undefined : String(query.f);
  if (focusRaw !== undefined && !isPersonFocus(focusRaw)) return { ok: false, reason: "invalid" };
  const focus = focusRaw && focusRaw !== "overblik" ? (focusRaw as PersonFocus) : undefined;
  if (!/^CVR-[34]-\d{1,12}$/.test(lassoId) || !Number.isFinite(exp)) return { ok: false, reason: "invalid" };
  const ask = readQuestion(query);
  if (!ask || ask.metrics) return { ok: false, reason: "invalid" };
  const key = secret(config);
  if (key) {
    const expected = Buffer.from(sign(key, personPayload(lassoId, exp, focus, ask.question)));
    const given = Buffer.from(String(query.s ?? ""));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "invalid" };
  }
  if (exp * 1000 < now) return { ok: false, reason: "expired" };
  return { ok: true, lassoId, ...(focus ? { focus } : {}), ...(ask.question ? { question: ask.question } : {}) };
}

/* ---------------------------------------------------------------------------------------
 * Gem-laget (docs/gem-lag.md): ét signeret link pr. entitet og "send til Lasso"-links.
 * ------------------------------------------------------------------------------------- */

/** Virksomhed CVR-1-<8 cifre> eller person CVR-3-/CVR-4-<id>. */
export const ENTITY_ID = /^CVR-(1-\d{8}|[34]-\d{1,12})$/;
export function isEntityId(id: string): boolean {
  return ENTITY_ID.test(id);
}

/** Et fokus, der passer til entiteten: virksomhedsfokus for CVR-1-…, personfokus for CVR-3-/CVR-4-…. */
export function focusFitsEntity(lassoId: string, focus: string): focus is PageFocus {
  return isFocusFor(/^CVR-1-/.test(lassoId) ? "company" : "person", focus);
}

const entityPayload = (lassoId: string, focus: PageFocus | undefined, exp: number) => `e1.${lassoId}.${focus && focus !== "overblik" ? focus : ""}.${exp}`;

/**
 * /e/<lassoId>?f=…&e=…&s=…: den hostede side for én virksomhed eller person, komponeret som i chatten
 * med samme fokus (virksomhedsfokus for en virksomhed, personfokus for en person),
 * med friske data ved hver visning. Samme nøgle og udløb (LINK_TTL_DAYS) som /k/ og /p/. Med
 * ENTITY_PAGES_PUBLIC=true er signaturen valgfri (ellers er siden et gratis opslag på servernøglen).
 */
export function entityLink(config: Config, lassoId: string, opts: { focus?: PageFocus } = {}, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + config.LINK_TTL_DAYS * 86_400;
  const focus = opts.focus && opts.focus !== "overblik" ? opts.focus : undefined;
  const query = new URLSearchParams({ e: exp.toString(36) });
  if (focus) query.set("f", focus);
  const key = secret(config);
  if (key) query.set("s", sign(key, entityPayload(lassoId, focus, exp)));
  return `${config.publicBaseUrl}/e/${encodeURIComponent(lassoId)}?${query}`;
}

export type EntityLinkCheck = { ok: true; lassoId: string; focus?: PageFocus } | { ok: false; reason: "invalid" | "expired" };

export function verifyEntityLink(config: Config, lassoId: string, query: Record<string, unknown>, now = Date.now()): EntityLinkCheck {
  if (!isEntityId(lassoId)) return { ok: false, reason: "invalid" };
  const focusRaw = query.f === undefined ? undefined : String(query.f);
  if (focusRaw !== undefined && !focusFitsEntity(lassoId, focusRaw)) return { ok: false, reason: "invalid" };
  const focus = focusRaw && focusRaw !== "overblik" ? (focusRaw as PageFocus) : undefined;
  // Offentlige sider: et link uden udløb og signatur er gyldigt; et link MED signatur tjekkes stadig.
  if (config.ENTITY_PAGES_PUBLIC && query.e === undefined && query.s === undefined) return { ok: true, lassoId, ...(focus ? { focus } : {}) };
  const exp = parseInt(String(query.e ?? ""), 36);
  if (!Number.isFinite(exp)) return { ok: false, reason: "invalid" };
  const key = secret(config);
  if (key) {
    const expected = Buffer.from(sign(key, entityPayload(lassoId, focus, exp)));
    const given = Buffer.from(String(query.s ?? ""));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "invalid" };
  }
  if (exp * 1000 < now) return { ok: false, reason: "expired" };
  return { ok: true, lassoId, ...(focus ? { focus } : {}) };
}

/**
 * De delte siders "Se alle … i Historik" (smagsprøvernes `more` i specen): et signeret /e/-link pr.
 * fane til sidens egen virksomhed eller person (første company/person i specen, som hovedet), så
 * siden kan åbne fanen uden chat. Samme entitet som siden, så linket giver ikke adgang til mere.
 * Kun for virksomheds- og personsider; undefined, når ingen smagsprøve peger på en fane.
 */
export function focusLinks(config: Config, spec: ViewSpec, now = Date.now()): Record<string, string> | undefined {
  if (spec.kind !== "company" && spec.kind !== "person") return undefined;
  const key = spec.kind;
  const id = spec.components.map((c) => (key in c ? (c as Record<string, unknown>)[key] : undefined)).find((v): v is string => typeof v === "string" && isEntityId(v));
  if (!id) return undefined;
  const tabs = new Set<string>();
  for (const c of spec.components) if ("more" in c && c.more && c.more !== "expand") tabs.add(c.more);
  const entries = [...tabs].filter((f) => focusFitsEntity(id, f)).map((f) => [f, entityLink(config, id, { focus: f as PageFocus }, now)] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** Bruger-id og org i et link: samme tegnsæt som i MCP_USER_KEYS og saved_pages. */
const ID_PART = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,79}$/;

export interface SendToLassoLink {
  lassoId: string;
  userId: string;
  org: string;
  focus?: PageFocus;
}

const sendPayload = (l: SendToLassoLink, exp: number) => `s1.${l.lassoId}.${l.userId}.${l.org}.${l.focus && l.focus !== "overblik" ? l.focus : ""}.${exp}`;

/**
 * GET /send-to-lasso?id=…&u=…&o=…&f=…&e=…&s=…: et link til en e-mail-knap eller et CRM, som lægger
 * siden på brugerens gemte liste (oprindelse "link") og sender videre til /e/<lassoId>. Altid
 * signeret, når der er en nøgle: bruger-id'et i linket er det, siden gemmes under.
 */
export function sendToLassoLink(config: Config, link: SendToLassoLink, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + config.LINK_TTL_DAYS * 86_400;
  const l: SendToLassoLink = { ...link, focus: link.focus && link.focus !== "overblik" ? link.focus : undefined };
  const query = new URLSearchParams({ id: l.lassoId, u: l.userId, o: l.org, e: exp.toString(36) });
  if (l.focus) query.set("f", l.focus);
  const key = secret(config);
  if (key) query.set("s", sign(key, sendPayload(l, exp)));
  return `${config.publicBaseUrl}/send-to-lasso?${query}`;
}

export type SendToLassoCheck = { ok: true; link: SendToLassoLink } | { ok: false; reason: "invalid" | "expired" };

export function verifySendToLassoLink(config: Config, query: Record<string, unknown>, now = Date.now()): SendToLassoCheck {
  const lassoId = String(query.id ?? "");
  const userId = String(query.u ?? "");
  const org = String(query.o ?? "");
  const focusRaw = query.f === undefined ? undefined : String(query.f);
  if (!isEntityId(lassoId) || !ID_PART.test(userId) || !ID_PART.test(org)) return { ok: false, reason: "invalid" };
  if (focusRaw !== undefined && !focusFitsEntity(lassoId, focusRaw)) return { ok: false, reason: "invalid" };
  const exp = parseInt(String(query.e ?? ""), 36);
  if (!Number.isFinite(exp)) return { ok: false, reason: "invalid" };
  const link: SendToLassoLink = { lassoId, userId, org, ...(focusRaw && focusRaw !== "overblik" ? { focus: focusRaw as PageFocus } : {}) };
  const key = secret(config);
  if (key) {
    const expected = Buffer.from(sign(key, sendPayload(link, exp)));
    const given = Buffer.from(String(query.s ?? ""));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "invalid" };
  }
  if (exp * 1000 < now) return { ok: false, reason: "expired" };
  return { ok: true, link };
}
