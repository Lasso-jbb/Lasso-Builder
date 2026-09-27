import { createHmac, timingSafeEqual } from "node:crypto";
import { FOCUSES, METRICS, type Focus, type Metric } from "@lasso/spec";
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
}

function secret(config: Config): string {
  if (isSet(config.LINK_SECRET)) return config.LINK_SECRET;
  // Uden egen nøgle afledes den af MCP-nøglen (eller brugernøglerne); lokalt uden nøgler er links usignerede.
  if (isSet(config.MCP_ACCESS_KEY)) return `mcp:${config.MCP_ACCESS_KEY}`;
  return config.MCP_USER_KEYS.trim() ? `mcpusers:${config.MCP_USER_KEYS.trim()}` : "";
}

const payload = (l: CompanyLink, exp: number) => `k1.${l.cvr}.${l.metric}.${l.years}.${exp}${l.focus && l.focus !== "overblik" ? `.${l.focus}` : ""}`;
const sign = (key: string, text: string) => createHmac("sha256", key).update(text).digest("base64url").slice(0, 22);

export function companyLink(config: Config, link: CompanyLink, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + config.LINK_TTL_DAYS * 86_400;
  const query = new URLSearchParams({ m: link.metric, y: String(link.years), e: exp.toString(36) });
  if (link.focus && link.focus !== "overblik") query.set("f", link.focus);
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
  const link: CompanyLink = { cvr, metric: metric as Metric, years, ...(focus ? { focus: focus as Focus } : {}) };
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
 * Katalog 16: signeret link til personsiden, /p/<lassoId>?e=…&s=… (samme nøgle og udløb som /k/).
 */
const personPayload = (lassoId: string, exp: number) => `p1.${lassoId}.${exp}`;

export function personLink(config: Config, lassoId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + config.LINK_TTL_DAYS * 86_400;
  const query = new URLSearchParams({ e: exp.toString(36) });
  const key = secret(config);
  if (key) query.set("s", sign(key, personPayload(lassoId, exp)));
  return `${config.publicBaseUrl}/p/${encodeURIComponent(lassoId)}?${query}`;
}

export type PersonLinkCheck = { ok: true; lassoId: string } | { ok: false; reason: "invalid" | "expired" };

export function verifyPersonLink(config: Config, lassoId: string, query: Record<string, unknown>, now = Date.now()): PersonLinkCheck {
  const exp = parseInt(String(query.e ?? ""), 36);
  const focus = query.f === undefined ? undefined : String(query.f);
  if (focus !== undefined && !(FOCUSES as readonly string[]).includes(focus)) return { ok: false, reason: "invalid" };
  if (!/^CVR-[34]-\d{1,12}$/.test(lassoId) || !Number.isFinite(exp)) return { ok: false, reason: "invalid" };
  const key = secret(config);
  if (key) {
    const expected = Buffer.from(sign(key, personPayload(lassoId, exp)));
    const given = Buffer.from(String(query.s ?? ""));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "invalid" };
  }
  if (exp * 1000 < now) return { ok: false, reason: "expired" };
  return { ok: true, lassoId };
}

/* ---------------------------------------------------------------------------------------
 * Gem-laget (docs/gem-lag.md): ét signeret link pr. entitet og "send til Lasso"-links.
 * ------------------------------------------------------------------------------------- */

/** Virksomhed CVR-1-<8 cifre> eller person CVR-3-/CVR-4-<id>. */
export const ENTITY_ID = /^CVR-(1-\d{8}|[34]-\d{1,12})$/;
export function isEntityId(id: string): boolean {
  return ENTITY_ID.test(id);
}

const entityPayload = (lassoId: string, focus: Focus | undefined, exp: number) => `e1.${lassoId}.${focus && focus !== "overblik" ? focus : ""}.${exp}`;

/**
 * /e/<lassoId>?f=…&e=…&s=…: den hostede side for én virksomhed eller person, komponeret som i chatten,
 * med friske data ved hver visning. Samme nøgle og udløb (LINK_TTL_DAYS) som /k/ og /p/. Med
 * ENTITY_PAGES_PUBLIC=true er signaturen valgfri (ellers er siden et gratis opslag på servernøglen).
 */
export function entityLink(config: Config, lassoId: string, opts: { focus?: Focus } = {}, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + config.LINK_TTL_DAYS * 86_400;
  const focus = opts.focus && opts.focus !== "overblik" ? opts.focus : undefined;
  const query = new URLSearchParams({ e: exp.toString(36) });
  if (focus) query.set("f", focus);
  const key = secret(config);
  if (key) query.set("s", sign(key, entityPayload(lassoId, focus, exp)));
  return `${config.publicBaseUrl}/e/${encodeURIComponent(lassoId)}?${query}`;
}

export type EntityLinkCheck = { ok: true; lassoId: string; focus?: Focus } | { ok: false; reason: "invalid" | "expired" };

export function verifyEntityLink(config: Config, lassoId: string, query: Record<string, unknown>, now = Date.now()): EntityLinkCheck {
  if (!isEntityId(lassoId)) return { ok: false, reason: "invalid" };
  const focusRaw = query.f === undefined ? undefined : String(query.f);
  if (focusRaw !== undefined && !(FOCUSES as readonly string[]).includes(focusRaw)) return { ok: false, reason: "invalid" };
  const focus = focusRaw && focusRaw !== "overblik" ? (focusRaw as Focus) : undefined;
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

/** Bruger-id og org i et link: samme tegnsæt som i MCP_USER_KEYS og saved_pages. */
const ID_PART = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,79}$/;

export interface SendToLassoLink {
  lassoId: string;
  userId: string;
  org: string;
  focus?: Focus;
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
  if (focusRaw !== undefined && !(FOCUSES as readonly string[]).includes(focusRaw)) return { ok: false, reason: "invalid" };
  const exp = parseInt(String(query.e ?? ""), 36);
  if (!Number.isFinite(exp)) return { ok: false, reason: "invalid" };
  const link: SendToLassoLink = { lassoId, userId, org, ...(focusRaw && focusRaw !== "overblik" ? { focus: focusRaw as Focus } : {}) };
  const key = secret(config);
  if (key) {
    const expected = Buffer.from(sign(key, sendPayload(link, exp)));
    const given = Buffer.from(String(query.s ?? ""));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "invalid" };
  }
  if (exp * 1000 < now) return { ok: false, reason: "expired" };
  return { ok: true, link };
}
