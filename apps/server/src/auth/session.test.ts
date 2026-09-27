import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request } from "express";
import { loadConfig } from "../config.js";
import { createLoginLimiter, loginWithKey, parseCookies, portalUser, SESSION_COOKIE, sessionCookie, signSession, verifySession } from "./session.js";

const config = loadConfig({ MCP_ACCESS_KEY: "shared-key-1", MCP_USER_KEYS: "userkey-jbb:jbb:Jakob:lasso", LINK_SECRET: "hemmelig", PUBLIC_BASE_URL: "https://lasso.test" });
const jbb = { id: "jbb", name: "Jakob", org: "lasso", isDemo: false };
const req = (cookie?: string) => ({ header: (name: string) => (name === "cookie" ? cookie : undefined) }) as unknown as Request;

test("session signeres, verificeres, udløber og afviser ændringer", () => {
  const now = Date.UTC(2026, 8, 27);
  const token = signSession(config, jbb, now);
  assert.deepEqual(verifySession(config, token, now), jbb);
  assert.equal(verifySession(config, token, now + 31 * 86_400_000), null);
  const [body, sig] = token.split(".");
  const tampered = Buffer.from(JSON.stringify({ id: "anna", name: "Anna", org: "lasso", demo: false, exp: 9999999999 })).toString("base64url");
  assert.equal(verifySession(config, `${tampered}.${sig}`, now), null);
  assert.equal(verifySession(config, body, now), null);
  assert.equal(verifySession(config, undefined, now), null);
  assert.equal(verifySession(config, "ikke.en.session", now), null);
});

test("cookies parses og sættes med HttpOnly, SameSite=Lax og Secure på https", () => {
  assert.deepEqual(parseCookies("a=1; lasso_session=x%2Ey; b = 2"), { a: "1", lasso_session: "x.y", b: "2" });
  assert.deepEqual(parseCookies(undefined), {});
  const set = sessionCookie(config, "tok.en");
  assert.match(set, /^lasso_session=tok\.en; Path=\/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure$/);
  assert.match(sessionCookie(config, null), /Max-Age=0/);
  assert.doesNotMatch(sessionCookie(loadConfig({ PUBLIC_BASE_URL: "http://localhost:3000" }), "t"), /Secure/);
});

test("portalUser læser cookien; uden nøgler er alle demobrugeren", () => {
  const token = signSession(config, jbb);
  assert.deepEqual(portalUser(req(`${SESSION_COOKIE}=${encodeURIComponent(token)}`), config), jbb);
  assert.equal(portalUser(req(undefined), config), null);
  assert.equal(portalUser(req(`${SESSION_COOKIE}=forkert`), config), null);
  const open = loadConfig({});
  assert.equal(portalUser(req(undefined), open)?.isDemo, true);
});

test("login kræver rigtig nøgle OG det bruger-id, nøglen hører til", () => {
  assert.deepEqual(loginWithKey(config, "JBB", "userkey-jbb"), jbb);
  assert.equal(loginWithKey(config, "anna", "userkey-jbb"), null);
  assert.equal(loginWithKey(config, "jbb", "userkey-jbx"), null);
  assert.equal(loginWithKey(config, "", "userkey-jbb"), null);
  // Den fælles nøgle logger demobrugeren ind.
  assert.equal(loginWithKey(config, "demo", "shared-key-1")?.isDemo, true);
  assert.equal(loginWithKey(config, "jbb", "shared-key-1"), null);
});

test("login-bremsen tillader max forsøg pr. vindue", () => {
  let t = 0;
  const limiter = createLoginLimiter(3, 1000, () => t);
  assert.equal(limiter.allow("1.1.1.1"), true);
  assert.equal(limiter.allow("1.1.1.1"), true);
  assert.equal(limiter.allow("1.1.1.1"), true);
  assert.equal(limiter.allow("1.1.1.1"), false);
  assert.equal(limiter.allow("2.2.2.2"), true);
  t = 1500;
  assert.equal(limiter.allow("1.1.1.1"), true);
});
