import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { isSet, type Config } from "../config.js";

export interface CurrentUser {
  id: string;
  name: string;
  org: string;
  isDemo: boolean;
}

/** En adgangsnøgle bundet til en bruger (MCP_USER_KEYS). */
export interface KeyedUser {
  key: string;
  id: string;
  name: string;
  org: string;
}

const ID_PART = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,79}$/;

/**
 * MCP_USER_KEYS: "nøgle:bruger-id:Navn:org;nøgle2:id2". Navn og org kan udelades (org = DEMO_ORG).
 * Ugyldige poster springes over og logges én gang, aldrig med nøglen.
 */
export function parseUserKeys(raw: string, defaultOrg: string): KeyedUser[] {
  const out: KeyedUser[] = [];
  for (const entry of raw.split(/[;\n]/)) {
    const line = entry.trim();
    if (!line) continue;
    const [key = "", id = "", name = "", org = ""] = line.split(":").map((s) => s.trim());
    if (key.length < 8 || !ID_PART.test(id) || (org && !ID_PART.test(org))) {
      console.warn(`[auth] MCP_USER_KEYS: springer en ugyldig post over (bruger "${id || "?"}")`);
      continue;
    }
    out.push({ key, id, name: name || id, org: org || defaultOrg });
  }
  return out;
}

const parsedCache = new WeakMap<Config, KeyedUser[]>();
function userKeys(config: Config): KeyedUser[] {
  let users = parsedCache.get(config);
  if (!users) {
    users = parseUserKeys(config.MCP_USER_KEYS, config.DEMO_ORG);
    parsedCache.set(config, users);
  }
  return users;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Nøglen i requesten: /mcp/<key>, x-api-key, Bearer eller ?key=. */
export function providedKey(req: Request): string {
  const auth = req.header("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : undefined;
  const fromQuery = typeof req.query.key === "string" ? req.query.key : undefined;
  const fromPath = typeof req.params.key === "string" ? req.params.key : undefined;
  return fromPath ?? req.header("x-api-key") ?? bearer ?? fromQuery ?? "";
}

/** Om /mcp kræver en nøgle: MCP_ACCESS_KEY eller mindst én brugernøgle. Uden begge er ruten åben (kun lokalt). */
export function mcpKeyRequired(config: Config): boolean {
  return isSet(config.MCP_ACCESS_KEY) || userKeys(config).length > 0;
}

/** Om nøglen er den fælles MCP_ACCESS_KEY eller en af brugernøglerne. Altid tidskonstant. */
export function isValidMcpKey(config: Config, key: string): boolean {
  if (!key) return false;
  let ok = isSet(config.MCP_ACCESS_KEY) && safeEqual(key, config.MCP_ACCESS_KEY);
  for (const u of userKeys(config)) ok = safeEqual(key, u.key) || ok;
  return ok;
}

export function demoUser(config: Config): CurrentUser {
  return { id: config.DEMO_USER_ID, name: config.DEMO_USER_NAME, org: config.DEMO_ORG, isDemo: true };
}

/**
 * "Hvem er brugeren, og hvad må han se?" – ÉT sted (docs/gem-lag.md, "Identitet").
 *
 * 1. En brugernøgle fra MCP_USER_KEYS giver den bruger, nøglen er bundet til. Så er gemte sider
 *    personlige uden OAuth: hver kollega får sin egen nøgle i sin Claude/ChatGPT-connector.
 * 2. Ellers (den fælles MCP_ACCESS_KEY, eller ingen nøgle lokalt) er det demobrugeren.
 *
 * Når Lasso ID (OAuth 2.1 + PKCE) kobles på, er det kun denne funktion, der ændres: læs token
 * fra requesten, slå brugeren op, og returnér id og organisation. Alt andet går gennem CurrentUser.
 */
export function getCurrentUser(req: Request | undefined, config: Config): CurrentUser {
  return userForKey(config, req ? providedKey(req) : "") ?? demoUser(config);
}

/**
 * Brugeren bag en nøgle: en brugernøgle giver sin bruger, den fælles MCP_ACCESS_KEY giver
 * demobrugeren, og en ukendt nøgle giver null. Tidskonstant sammenligning i alle grene.
 */
export function userForKey(config: Config, key: string): CurrentUser | null {
  if (!key) return null;
  let found: CurrentUser | null = null;
  for (const u of userKeys(config)) {
    if (safeEqual(key, u.key)) found = { id: u.id, name: u.name, org: u.org, isDemo: false };
  }
  if (found) return found;
  if (isSet(config.MCP_ACCESS_KEY) && safeEqual(key, config.MCP_ACCESS_KEY)) return demoUser(config);
  return null;
}
