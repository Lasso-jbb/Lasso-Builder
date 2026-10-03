import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { mcpKeyRequired, providedKey, userForKey, demoUser, type CurrentUser } from "../auth/user.js";
import { CSRF_HEADER, parseCookies, portalLoginRequired, SESSION_COOKIE, verifySession } from "../auth/session.js";
import { isSet, type Config } from "../config.js";
import { linkSecret } from "../web/links.js";
import type { UseCaseCtx } from "../usecases/index.js";
import { anthropicModelCall, runChat, type ChatEvent, type ModelCall } from "./agent.js";
import { parseContext, verifyChoice } from "./context.js";

/**
 * /api/chat (docs/chat.md): ét brugerspørgsmål ind, hændelser ud som Server-Sent Events.
 *
 * Body: { message, context?, history?, sig? }. history og sig er præcis det, sidste "done"-hændelse gav; serveren
 * gemmer ingen samtaler. sig er en HMAC over brugeren og historikken, så en klient ikke kan lægge falske
 * værktøjssvar ind i samtalen. context (chat/context.ts) er den fane, brugeren står på, de åbne faner og et
 * evt. valg fra en valgmenu; uden context svares der globalt.
 *
 * Adgang: en portal-session (cookie + CSRF-header, som /api/portal) eller en brugernøgle (Bearer,
 * x-api-key) til server-til-server-kald fra Lassos produkt. Er portalen åben (PORTAL_PUBLIC), er chatten
 * også åben fra portalens side som demobrugeren, med bremsen pr. IP-adresse.
 */

export interface ChatDeps extends Omit<UseCaseCtx, "user"> {
  /** Udskiftes i test; ellers Claude Platform med ANTHROPIC_API_KEY. */
  model?: ModelCall;
}

export function chatEnabled(config: Config): boolean {
  return isSet(config.ANTHROPIC_API_KEY);
}

/** Brugeren bag et chatkald, eller en fejl med status. */
export function chatUser(req: Request, config: Config): CurrentUser | { status: 401 | 403; error: string } {
  const key = providedKey(req);
  if (key) return userForKey(config, key) ?? { status: 401, error: "Ugyldig nøgle" };
  const session = verifySession(config, parseCookies(req.header("cookie"))[SESSION_COOKIE]);
  if (session) {
    if (req.header(CSRF_HEADER) !== "1") return { status: 403, error: `Kald til chatten skal sende headeren ${CSRF_HEADER}: 1` };
    return session;
  }
  // Den åbne portal (PORTAL_PUBLIC) og lokalt uden nøgler: demobrugeren, men kun fra portalens egen side
  // (CSRF-headeren). Bremsen gælder så pr. IP-adresse, så én besøgende ikke bruger alles kvote.
  if (!portalLoginRequired(config)) {
    if (mcpKeyRequired(config) && req.header(CSRF_HEADER) !== "1") return { status: 403, error: `Kald til chatten skal sende headeren ${CSRF_HEADER}: 1` };
    return demoUser(config);
  }
  return { status: 401, error: "Ikke logget ind" };
}

/** Nøglen, bremsen tæller på: brugeren, og for demobrugeren også IP-adressen. */
function limitKey(req: Request, user: CurrentUser): string {
  return user.isDemo ? `${user.id}@${req.ip ?? req.socket.remoteAddress ?? "?"}` : user.id;
}

const signHistory = (secret: string, userId: string, history: unknown) =>
  createHmac("sha256", `chat:${secret}`).update(`${userId}\n${JSON.stringify(history)}`).digest("base64url");

export function historySig(config: Config, userId: string, history: unknown): string {
  return signHistory(linkSecret(config), userId, history);
}

/** Om historikken er den, serveren selv sendte til brugeren. Lokalt uden hemmelighed tjekkes intet. */
export function verifyHistory(config: Config, userId: string, history: unknown, sig: unknown): boolean {
  const secret = linkSecret(config);
  if (!secret) return true;
  if (typeof sig !== "string") return false;
  const a = Buffer.from(signHistory(secret, userId, history));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Højst `max` beskeder pr. bruger pr. time. Nulstilles ved genstart. */
export function createChatLimiter(max: number, windowMs = 60 * 60_000, now = () => Date.now()) {
  const hits = new Map<string, number[]>();
  const allow = (userId: string): boolean => {
    const t = now();
    const list = (hits.get(userId) ?? []).filter((x) => t - x < windowMs);
    if (list.length >= max) {
      hits.set(userId, list);
      return false;
    }
    list.push(t);
    hits.set(userId, list);
    // Nøgler uden beskeder i vinduet fjernes, så kortet ikke vokser med hver ny bruger eller adresse.
    if (hits.size > 1000) for (const [k, v] of hits) if (v.every((x) => t - x >= windowMs)) hits.delete(k);
    return true;
  };
  // Antal nøgler, der huskes (til test).
  return Object.assign(allow, { size: () => hits.size });
}

const MAX_MESSAGE = 4000;

export function chatRoutes({ model, ...deps }: ChatDeps): Router {
  const router = Router();
  const { config } = deps;
  const allow = createChatLimiter(config.CHAT_MAX_PER_HOUR);
  let call = model;

  router.get("/status", (req, res) => {
    const user = chatUser(req, config);
    res.set("Cache-Control", "no-store").json({ enabled: chatEnabled(config) || Boolean(model), user: "status" in user ? null : user, model: config.CHAT_MODEL });
  });

  router.post("/", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    if (!chatEnabled(config) && !model) return void res.status(503).json({ error: "Chatten er ikke slået til (ANTHROPIC_API_KEY mangler)." });
    const user = chatUser(req, config);
    if ("status" in user) return void res.status(user.status).json({ error: user.error });

    const body = (req.body ?? {}) as { message?: unknown; history?: unknown; sig?: unknown; context?: unknown };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return void res.status(400).json({ error: "Skriv en besked." });
    if (message.length > MAX_MESSAGE) return void res.status(400).json({ error: `Beskeden må højst være ${MAX_MESSAGE} tegn.` });
    // Bremsen før det dyre (HMAC over historikken, skemaer, valgtjek), så store kald tælles, selv om de afvises.
    if (!allow(limitKey(req, user))) return void res.status(429).json({ error: `Du har brugt chatten ${config.CHAT_MAX_PER_HOUR} gange den seneste time. Prøv igen senere.` });
    const history = body.history === undefined ? [] : body.history;
    if (!Array.isArray(history)) return void res.status(400).json({ error: "history skal være en liste." });
    if (history.length && !verifyHistory(config, user.id, history, body.sig)) {
      return void res.status(400).json({ error: "Samtalen kunne ikke genkendes. Start en ny samtale." });
    }
    const context = parseContext(body.context);
    if (!context) return void res.status(400).json({ error: "context er ugyldig" });
    if (context.choice) {
      // Et valg i menuen skal pege på det ask_choice-kald, modellen selv lavede, med præcis dets handling.
      const v = verifyChoice(history as BetaMessageParam[], context.choice);
      if ("error" in v) return void res.status(400).json({ error: v.error });
      context.choice = { ...context.choice, ...v };
    }

    call ??= anthropicModelCall(config.ANTHROPIC_API_KEY);
    res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
    const abort = new AbortController();
    res.on("close", () => abort.abort());
    const send = (e: ChatEvent) => {
      if (res.writableEnded) return;
      // "done" får signaturen med, så næste spørgsmål kan bygge videre på samtalen.
      const payload = e.type === "done" ? { ...e, sig: historySig(config, user.id, e.history) } : e;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };
    try {
      await runChat({ ctx: { ...deps, user }, config, model: call, history: history as BetaMessageParam[], message, context, emit: send, signal: abort.signal });
    } catch (e) {
      console.error("[chat] fejl:", e);
      send({ type: "error", message: "Der skete en fejl. Prøv igen." });
    }
    res.end();
  });

  return router;
}
