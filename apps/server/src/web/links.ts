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
  // Uden egen nøgle afledes den af MCP-nøglen; lokalt uden nøgler er links usignerede.
  return isSet(config.MCP_ACCESS_KEY) ? `mcp:${config.MCP_ACCESS_KEY}` : "";
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
