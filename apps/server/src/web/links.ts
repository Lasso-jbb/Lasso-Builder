import { createHmac, timingSafeEqual } from "node:crypto";
import { METRICS, type Metric } from "@lasso/spec";
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
}

function secret(config: Config): string {
  if (isSet(config.LINK_SECRET)) return config.LINK_SECRET;
  // Uden egen nøgle afledes den af MCP-nøglen; lokalt uden nøgler er links usignerede.
  return isSet(config.MCP_ACCESS_KEY) ? `mcp:${config.MCP_ACCESS_KEY}` : "";
}

const payload = (l: CompanyLink, exp: number) => `k1.${l.cvr}.${l.metric}.${l.years}.${exp}`;
const sign = (key: string, text: string) => createHmac("sha256", key).update(text).digest("base64url").slice(0, 22);

export function companyLink(config: Config, link: CompanyLink, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + config.LINK_TTL_DAYS * 86_400;
  const query = new URLSearchParams({ m: link.metric, y: String(link.years), e: exp.toString(36) });
  const key = secret(config);
  if (key) query.set("s", sign(key, payload(link, exp)));
  return `${config.publicBaseUrl}/k/${link.cvr}?${query}`;
}

export type LinkCheck = { ok: true; link: CompanyLink } | { ok: false; reason: "invalid" | "expired" };

export function verifyCompanyLink(config: Config, cvr: string, query: Record<string, unknown>, now = Date.now()): LinkCheck {
  const metric = String(query.m ?? "");
  const years = Number(query.y);
  const exp = parseInt(String(query.e ?? ""), 36);
  if (!/^\d{8}$/.test(cvr) || !(METRICS as readonly string[]).includes(metric) || !Number.isInteger(years) || years < 2 || years > 10 || !Number.isFinite(exp)) {
    return { ok: false, reason: "invalid" };
  }
  const link: CompanyLink = { cvr, metric: metric as Metric, years };
  const key = secret(config);
  if (key) {
    const expected = Buffer.from(sign(key, payload(link, exp)));
    const given = Buffer.from(String(query.s ?? ""));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "invalid" };
  }
  if (exp * 1000 < now) return { ok: false, reason: "expired" };
  return { ok: true, link };
}
