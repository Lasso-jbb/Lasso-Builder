import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Config } from "../config.js";
import { linkSecret } from "../web/links.js";
import { demoUser, isValidMcpKey, mcpKeyRequired, userForKey, type CurrentUser } from "./user.js";

/**
 * Portalens login (docs/portal.md): bruger-id + adgangsnøgle (samme nøgler som MCP-connectoren)
 * giver en signeret, httpOnly session-cookie i SESSION_TTL_DAYS dage. Ingen sessioner i databasen:
 * cookien bærer selv bruger, org og udløb, og signaturen (HMAC, samme hemmelighed som links)
 * gør, at den ikke kan ændres. Uden nøgler (lokalt) er portalen åben som demobrugeren, ligesom /mcp.
 *
 * CSRF: cookien er SameSite=Lax, og alle ændrende kald til /api/portal/* skal sende headeren
 * CSRF_HEADER, som et fremmed sted ikke kan sætte i en almindelig formular-POST.
 */
export const SESSION_COOKIE = "lasso_session";
export const SESSION_TTL_DAYS = 30;
export const CSRF_HEADER = "x-lasso-portal";

export type SessionUser = CurrentUser;

const enc = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const dec = (s: string) => Buffer.from(s, "base64url").toString("utf8");
const sign = (key: string, text: string) => createHmac("sha256", `session:${key}`).update(text).digest("base64url");

export function signSession(config: Config, user: SessionUser, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + SESSION_TTL_DAYS * 86_400;
  const body = enc(JSON.stringify({ id: user.id, name: user.name, org: user.org, demo: user.isDemo, exp }));
  const key = linkSecret(config);
  return key ? `${body}.${sign(key, body)}` : body;
}

export function verifySession(config: Config, token: string | undefined, now = Date.now()): SessionUser | null {
  if (!token) return null;
  const [body = "", sig = ""] = token.split(".");
  if (!body) return null;
  const key = linkSecret(config);
  if (key) {
    const expected = Buffer.from(sign(key, body));
    const given = Buffer.from(sig);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  }
  let parsed: { id?: unknown; name?: unknown; org?: unknown; demo?: unknown; exp?: unknown };
  try {
    parsed = JSON.parse(dec(body)) as typeof parsed;
  } catch {
    return null;
  }
  if (typeof parsed.id !== "string" || typeof parsed.org !== "string" || typeof parsed.exp !== "number") return null;
  if (parsed.exp * 1000 < now) return null;
  return { id: parsed.id, name: typeof parsed.name === "string" ? parsed.name : parsed.id, org: parsed.org, isDemo: parsed.demo === true };
}

/** "a=1; b=2" -> { a: "1", b: "2" }. Ingen afhængighed af cookie-parser. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    const name = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (name) {
      try {
        out[name] = decodeURIComponent(value);
      } catch {
        out[name] = value;
      }
    }
  }
  return out;
}

/** Set-Cookie-værdien. token null = slet cookien. Secure, når portalen kører på https. */
export function sessionCookie(config: Config, token: string | null): string {
  const secure = config.publicBaseUrl.startsWith("https://") ? "; Secure" : "";
  if (token === null) return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_TTL_DAYS * 86_400}; HttpOnly; SameSite=Lax${secure}`;
}

/**
 * Brugeren bag requesten i portalen: session-cookien, ellers null. Uden nøgler (lokalt) er
 * alle demobrugeren, så portalen kan bruges uden login, ligesom /mcp er åben.
 */
export function portalUser(req: Request, config: Config): SessionUser | null {
  const session = verifySession(config, parseCookies(req.header("cookie"))[SESSION_COOKIE]);
  // Åben portal (PORTAL_PUBLIC, eller ingen MCP-nøgle lokalt): en besøgende uden session er
  // demobrugeren; et personligt login (MCP_USER_KEYS) gælder stadig, hvis cookien er der.
  if (!portalLoginRequired(config)) return session ?? demoUser(config);
  return session;
}

/** Login kræves, når /mcp er beskyttet af en nøgle, og portalen ikke er sat åben med PORTAL_PUBLIC. */
export function portalLoginRequired(config: Config): boolean {
  return mcpKeyRequired(config) && !config.PORTAL_PUBLIC;
}

/**
 * Login: nøglen skal være gyldig, og bruger-id'et skal være det, nøglen er bundet til
 * (den fælles nøgle hører til demobrugeren). Bruger-id sammenlignes uden hensyn til store/små
 * bogstaver, så "JBB" og "jbb" er den samme. Forkert nøgle og forkert bruger giver samme svar.
 */
export function loginWithKey(config: Config, userId: string, key: string): SessionUser | null {
  const id = userId.trim().toLowerCase();
  const k = key.trim();
  if (!id || !k || !isValidMcpKey(config, k)) return null;
  const user = userForKey(config, k);
  if (!user || user.id.toLowerCase() !== id) return null;
  return user;
}

/** Simpel bremse på login: højst `max` forsøg pr. IP pr. `windowMs`. Nulstilles ved genstart. */
export function createLoginLimiter(max = 10, windowMs = 15 * 60_000, now = () => Date.now()) {
  const hits = new Map<string, number[]>();
  return {
    allow(ip: string): boolean {
      const t = now();
      const list = (hits.get(ip) ?? []).filter((x) => t - x < windowMs);
      if (list.length >= max) {
        hits.set(ip, list);
        return false;
      }
      list.push(t);
      hits.set(ip, list);
      // Nøgler uden forsøg i vinduet fjernes, så kortet ikke vokser med hver ny adresse.
      if (hits.size > 1000) for (const [k, v] of hits) if (v.every((x) => t - x >= windowMs)) hits.delete(k);
      return true;
    },
    /** Antal adresser, der huskes (til test). */
    size: () => hits.size,
  };
}

/**
 * Middleware til /api/portal/*: kræver en session (401 ellers) og, for alt andet end GET/HEAD,
 * CSRF-headeren (403 ellers). Brugeren lægges på res.locals.user.
 */
export function requirePortal(config: Config) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = portalUser(req, config);
    if (!user) return void res.status(401).json({ error: "Ikke logget ind" });
    if (req.method !== "GET" && req.method !== "HEAD" && req.header(CSRF_HEADER) !== "1") {
      return void res.status(403).json({ error: `Kald til portalen skal sende headeren ${CSRF_HEADER}: 1` });
    }
    res.locals.user = user;
    next();
  };
}
