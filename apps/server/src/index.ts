import { timingSafeEqual } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import cors from "cors";
import type { NextFunction, Request, Response } from "express";
import {
  companyTemplate,
  composeCompany,
  composeProbe,
  composePerson,
  composePersonProbe,
  cvrFromLassoId,
  FOCUSES,
  isFocusFor,
  isPersonFocus,
  listTemplate,
  mainMetric,
  parseAsk,
  parseViewSpec,
  searchQuerySchema,
  toLassoId,
  viewSpecSchema,
  type Dataset,
  PERSON_FOCUSES,
  type Focus,
  type Metric,
  type PageFocus,
  type PersonFocus,
} from "@lasso/spec";
import { getCurrentUser, isValidMcpKey, mcpKeyRequired, providedKey } from "./auth/user.js";
import { createLoginLimiter, loginWithKey, portalLoginRequired, portalUser, requirePortal, sessionCookie, signSession } from "./auth/session.js";
import { createPool } from "./db.js";
import { entitySnapshot, savedPageVM } from "./pages/resolveExtras.js";
import { createSavedPageStore, pageKindOf, SavedPageError, validateSavedPage, type SavedPageStore } from "./pages/store.js";
import { hasLassoCredentials, isSet, loadConfig, type Config } from "./config.js";
import { createProvider, type DataProvider } from "./data/index.js";
import { datasetEntityIds, errorMessage, normalizeSpec, resolveSpec } from "./data/resolve.js";
import { findCompany } from "./data/lookup.js";
import { summarizeView } from "./data/summary.js";
import { adaptPeople, adaptSearch, at, participantFieldNames } from "./lasso/adapters.js";
import { describeShape, LassoApiError, LassoClient, probeAuthVariants, type Query } from "./lasso/client.js";
import { createMcpServer } from "./mcp/server.js";
import { companyNameHints } from "./usecases/index.js";
import { createViewStore, SLUG_PATTERN, slugify, ViewConflictError, VISIBILITIES, type ViewStore } from "./views/store.js";
import { entityLink, focusLinks, isEntityId, sendToLassoLink, verifyCompanyLink, verifyEntityLink, verifyPersonLink, verifySendToLassoLink } from "./web/links.js";
import { injectBoot, loadViewHtml } from "./web/page.js";
import { ASK_AGAIN, failPage, FROM_LIST, linkFailure, VIEW_MISSING, VIEW_OUTDATED } from "./web/linkErrors.js";
import { portalApi, portalErrorHandler } from "./web/portalApi.js";
import { pdfAvailable, pdfRendererFor, type PdfRenderer } from "./pdf/renderer.js";
import { pdfBoot, pdfRoutes, portalPdfRoutes } from "./pdf/routes.js";

const VERSION = "0.1.0";

export interface AppDeps {
  config: Config;
  client: LassoClient;
  provider: DataProvider;
  store: ViewStore;
  /** Gem-laget: brugerens gemte sider (docs/gem-lag.md). */
  pages: SavedPageStore;
  /** "Gem som PDF" (pdf/renderer.ts). Udeladt: en renderer ud fra PDF_CHROMIUM_PATH. */
  pdf?: PdfRenderer;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Kræver nøglen, hvis den er sat. Uden nøgle er ruten åben (kun til lokal udvikling). */
function requireKey(expected: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isSet(expected)) return next();
    if (safeEqual(providedKey(req), expected)) return next();
    res.status(401).json({ error: "Unauthorized" });
  };
}

/** Nøglen til "send til Lasso" (POST /api/send-to-lasso og …/link): SEND_TO_LASSO_KEY, ellers ADMIN_API_KEY. */
export function sendToLassoKey(config: Config): string {
  return isSet(config.SEND_TO_LASSO_KEY) ? config.SEND_TO_LASSO_KEY : config.ADMIN_API_KEY;
}

type SendRequest = { lassoId: string; userId: string; org: string; focus?: PageFocus; note?: string };

/**
 * Body til send-til-Lasso: { lassoId | cvr, userId, org?, focus?, note? }. Bruger og org
 * valideres med samme regler som lageret (validateSavedPage), så et link aldrig kan pege på
 * en liste, lageret ville afvise.
 */
function parseSendRequest(body: unknown, config: Config, withNote: boolean): SendRequest | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const rawId = typeof b.lassoId === "string" && b.lassoId.trim() ? b.lassoId : typeof b.cvr === "string" || typeof b.cvr === "number" ? String(b.cvr) : "";
  const lassoId = toLassoId(rawId, config.LASSO_COMPANY_ID_PREFIX);
  if (!isEntityId(lassoId)) return { error: "Angiv lassoId (CVR-1-… for en virksomhed, CVR-3-… for en person) eller et 8-cifret cvr." };
  if (typeof b.userId !== "string" || !b.userId.trim()) return { error: "Angiv userId." };
  if (b.org !== undefined && typeof b.org !== "string") return { error: "org skal være tekst." };
  const userId = b.userId.trim();
  const org = typeof b.org === "string" && b.org.trim() ? b.org.trim() : config.DEMO_ORG;
  // Virksomhedsfokus for en virksomhed, personfokus for en person.
  const kind = pageKindOf(lassoId)!;
  const allowed: readonly string[] = kind === "person" ? PERSON_FOCUSES : FOCUSES;
  if (b.focus !== undefined && (typeof b.focus !== "string" || !isFocusFor(kind, b.focus))) return { error: `focus skal være en af: ${allowed.join(", ")}.` };
  const focus = b.focus as PageFocus | undefined;
  if (withNote && b.note !== undefined && (typeof b.note !== "string" || b.note.length > 500)) return { error: "note skal være tekst på højst 500 tegn." };
  const note = withNote && typeof b.note === "string" ? b.note : undefined;
  try {
    // Navnet er ikke hentet endnu; kun bruger, org og ID tjekkes her.
    validateSavedPage({ org, userId, lassoId, kind, name: lassoId, origin: "send" });
  } catch (err) {
    if (err instanceof SavedPageError) return { error: err.message };
    throw err;
  }
  return { lassoId, userId, org, ...(focus ? { focus } : {}), ...(note ? { note } : {}) };
}

/** /mcp: MCP_ACCESS_KEY eller en af brugernøglerne i MCP_USER_KEYS (se auth/user.ts). Uden nøgler er ruten åben. */
function requireMcpKey(config: Config) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!mcpKeyRequired(config)) return next();
    if (isValidMcpKey(config, providedKey(req))) return next();
    res.status(401).json({ error: "Unauthorized" });
  };
}

export function createApp({ config, client, provider, store, pages, pdf = pdfRendererFor(config) }: AppDeps) {
  const app = createMcpExpressApp({ host: "0.0.0.0", jsonLimit: "1mb" });
  app.disable("x-powered-by");

  // Roden er portalen (docs/portal.md); den gamle JSON-info ligger under /api/info.
  app.get("/", (_req, res) => void res.redirect(302, "/portal"));
  app.get("/api/info", (_req, res) => {
    res.json({
      name: "lasso-mcp",
      version: VERSION,
      env: config.APP_ENV,
      mcp: `${config.publicBaseUrl}/mcp`,
      portal: `${config.publicBaseUrl}/portal`,
      health: `${config.publicBaseUrl}/health`,
    });
  });

  // --- Portal: login og session (docs/portal.md). Selve portal-API'et står længere nede. ----
  const loginLimiter = createLoginLimiter();
  app.post("/api/portal/login", (req, res) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "?";
    if (!loginLimiter.allow(ip)) return void res.status(429).json({ error: "For mange loginforsøg. Prøv igen om et kvarter." });
    const body = (req.body ?? {}) as { user?: unknown; key?: unknown };
    const user = typeof body.user === "string" && typeof body.key === "string" ? loginWithKey(config, body.user, body.key) : null;
    if (!user) return void res.status(401).json({ error: "Forkert bruger eller adgangsnøgle." });
    res.setHeader("Set-Cookie", sessionCookie(config, signSession(config, user)));
    res.json({ user });
  });
  app.post("/api/portal/logout", (_req, res) => {
    res.setHeader("Set-Cookie", sessionCookie(config, null));
    res.json({ ok: true });
  });
  app.get("/api/portal/me", (req, res) => {
    const user = portalUser(req, config);
    if (!user) return void res.status(401).json({ error: "Ikke logget ind" });
    res.json({ user });
  });

  // Portalens side: render-appen med boot { mode: "portal" }. Uden session viser appen login.
  app.get("/portal", async (req, res) => {
    const html = await loadViewHtml();
    const user = portalUser(req, config);
    res
      .type("html")
      .set("Cache-Control", "no-store")
      .send(injectBoot(html, { mode: "portal", user, loginRequired: portalLoginRequired(config), baseUrl: config.publicBaseUrl, pdf: pdfAvailable(config) }, "Portal"));
  });

  app.get("/health", async (_req, res) => {
    // Altid 200, så en midlertidig databasefejl ikke stopper et deploy. Tilstanden står i svaret.
    const dbOk = (await store.ping()) && (await pages.ping());
    res.json({
      status: dbOk ? "ok" : "degraded",
      version: VERSION,
      env: config.APP_ENV,
      dataSource: provider.kind,
      lassoCredentials: hasLassoCredentials(config),
      database: store.kind,
      databaseOk: dbOk,
      mcpKeyRequired: mcpKeyRequired(config),
      pdf: pdfAvailable(config),
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  // --- MCP (Streamable HTTP, stateless: ny server pr. request) --------------
  const handleMcp = async (req: Request, res: Response) => {
    const user = getCurrentUser(req, config);
    const server = createMcpServer({ config, provider, store, pages, user });
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[mcp] fejl:", error);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
    }
  };
  app.use("/mcp", cors({ exposedHeaders: ["Mcp-Session-Id"] }));
  app.all("/mcp", requireMcpKey(config), handleMcp);
  app.all("/mcp/:key", requireMcpKey(config), handleMcp);

  // --- Portal-API (docs/portal.md): samme use-cases som MCP-tools, kræver session ----------
  // Login, logout og me står øverst og kræver ikke session; alt andet under /api/portal gør.
  app.use("/api/portal/pdf", requirePortal(config), portalPdfRoutes({ config, provider, store, pages, pdf }));
  app.use("/api/portal", requirePortal(config), portalApi({ config, provider, store, pages }));
  app.use("/api/portal", portalErrorHandler);

  // --- Gemte visninger -------------------------------------------------------
  app.get("/api/views/:org/:slug", async (req, res) => {
    const view = await store.get(req.params.org, req.params.slug);
    if (!view) return void res.status(404).json({ error: "Visningen findes ikke" });
    res.json({ ...view, url: `${config.publicBaseUrl}/v/${view.org}/${view.slug}` });
  });

  app.get("/api/views", requireKey(config.ADMIN_API_KEY), async (req, res) => {
    const user = getCurrentUser(req, config);
    res.json(await store.list(user.org));
  });

  app.post("/api/views", requireKey(config.ADMIN_API_KEY), async (req, res) => {
    const user = getCurrentUser(req, config);
    try {
      const body = req.body ?? {};
      const spec = normalizeSpec(parseViewSpec(body.spec), config.LASSO_COMPANY_ID_PREFIX);
      const slug = typeof body.slug === "string" && body.slug ? slugify(body.slug) : undefined;
      if (slug !== undefined && !SLUG_PATTERN.test(slug)) return void res.status(400).json({ error: "Ugyldig adresse" });
      const visibility = VISIBILITIES.includes(body.visibility) ? body.visibility : undefined;
      const saved = await store.save({ org: user.org, slug, name: body.name, spec, visibility, owner: user.id });
      res.status(201).json({ ...saved, url: `${config.publicBaseUrl}/v/${saved.org}/${saved.slug}` });
    } catch (err) {
      if (err instanceof ViewConflictError) return void res.status(409).json({ error: err.message });
      res.status(400).json({ error: errorMessage(err) });
    }
  });

  /**
   * Links på de delte sider: et signeret /e/-link pr. virksomhed og person i datasættet (navnene
   * på siden), så den delte side kan åbne dem uden chat. Kun ID'er, siden selv viser, får et link,
   * så signaturen stadig afgør, hvilke opslag et link giver adgang til.
   */
  const pageLinks = (dataset: Dataset): Record<string, string> => Object.fromEntries(datasetEntityIds(dataset).map((id) => [id, entityLink(config, id)]));

  // "Gem som PDF": /k/, /p/, /e/, /v/ med .pdf (før HTML-siderne), /x/<token>.pdf og print-siden.
  app.use(pdfRoutes({ config, provider, store, pdf }));

  // --- Delt side: specen hentes, data hentes friskt, render-appen tegner -----
  app.get("/v/:org/:slug", async (req, res) => {
    const view = await store.get(req.params.org, req.params.slug);
    const html = await loadViewHtml();
    if (!view) {
      res.status(404).type("html").send(injectBoot(html, { mode: "web", error: VIEW_MISSING }, "Ikke fundet"));
      return;
    }
    // Visninger fra før komponentsættet blev bygget om efter Paper-kataloget (spec v1) kan ikke vises.
    const parsed = viewSpecSchema.safeParse(view.spec);
    if (!parsed.success || (view.spec as { version?: number }).version !== 2) {
      res.status(410).type("html").send(injectBoot(html, { mode: "web", error: VIEW_OUTDATED }, view.name ?? "Ældre visning"));
      return;
    }
    const dataset = await resolveSpec(parsed.data, provider);
    const url = `${config.publicBaseUrl}/v/${view.org}/${view.slug}`;
    res
      .type("html")
      .set("Cache-Control", "no-store")
      .send(
        injectBoot(
          html,
          { mode: "web", spec: view.spec, dataset, url, name: view.name, version: view.version, updatedAt: view.updatedAt, links: pageLinks(dataset), focusLinks: focusLinks(config, parsed.data), ...pdfBoot(config, req) },
          view.name ?? view.spec.title,
        ),
      );
  });

  // --- Hostede sider for én virksomhed eller person (signerede links, se web/links.ts) ----
  // /k/<cvr> og /p/<id> fra show_company/show_person, og /e/<lassoId> fra gem-laget, deler de to
  // hjælpere nedenfor: samme komponist som i chatten, friske data ved hver visning, ingen
  // opfølgningsknapper (ingen chat på websiden), og aldrig i søgemaskiner.
  // "Gem som PDF": pdf og pdfUrl (samme side som .pdf, samme signerede query) i boot'en (pdf/routes.ts).
  const sendPage = (req: Request, res: Response, html: string, boot: Record<string, unknown>, title: string) =>
    void res
      .type("html")
      .set("Cache-Control", "no-store")
      .set("X-Robots-Tag", "noindex")
      .send(injectBoot(html, { mode: "web", ...boot, url: `${config.publicBaseUrl}${req.originalUrl}`, ...pdfBoot(config, req) }, title));

  /**
   * Virksomhedssiden. metric udeladt = hovednøgletallet (som show_company). Med spørgsmålet (q i et
   * /k/-link) samme spørgsmålsprofil som i chatten: læst uden virksomhedens navn, med modellens nøgletal.
   */
  async function renderCompanyPage(req: Request, res: Response, html: string, lassoId: string, opts: { focus: Focus; years: number; metric?: Metric; question?: string; metrics?: Metric[]; topic?: string }) {
    let name: string;
    try {
      name = (await provider.company(lassoId)).name;
    } catch (err) {
      return failPage(res, html, 404, `Virksomheden kunne ikke hentes: ${errorMessage(err)}`);
    }
    const ask = opts.question ? parseAsk(opts.question, "company", { metrics: opts.metrics, name: companyNameHints(name), topic: opts.topic }) : undefined;
    const dataset = await resolveSpec(composeProbe(lassoId, opts.focus, ask), provider);
    const metric = opts.metric ?? mainMetric(dataset.financials[lassoId]?.years ?? []);
    const spec = composeCompany(lassoId, dataset, { focus: opts.focus, years: opts.years, chartMetric: metric, name, followUps: false, ask });
    sendPage(req, res, html, { spec, dataset, name, links: pageLinks(dataset), focusLinks: focusLinks(config, spec) }, name);
  }

  /** Personsiden (katalog 16) med personfokus (standard overblik) og evt. spørgsmålet fra /p/-linket. */
  async function renderPersonPage(req: Request, res: Response, html: string, lassoId: string, focus: PersonFocus = "overblik", question?: string, topic?: string) {
    // Spørgsmålet læses uden personens navn (som i chatten); navnet hentes først (samme opslag som hovedet).
    const official = question ? await provider.person(lassoId).then((x) => x.name).catch(() => undefined) : undefined;
    const ask = question ? parseAsk(question, "person", { name: official, topic }) : undefined;
    const dataset = await resolveSpec(composePersonProbe(lassoId, focus, ask), provider);
    const person = dataset.persons[lassoId];
    if (!person) return failPage(res, html, 404, `Personen kunne ikke hentes: ${dataset.errors[`person:${lassoId}`] ?? "ukendt fejl"}`);
    const spec = composePerson(lassoId, dataset, { focus, name: person.name, followUps: false, ask });
    sendPage(req, res, html, { spec, dataset, name: person.name, links: pageLinks(dataset), focusLinks: focusLinks(config, spec) }, person.name);
  }

  app.get("/k/:cvr", async (req, res) => {
    const html = await loadViewHtml();
    const check = verifyCompanyLink(config, String(req.params.cvr), req.query as Record<string, unknown>);
    if (!check.ok) {
      const f = linkFailure(check.reason, ASK_AGAIN("virksomheden"));
      return failPage(res, html, f.status, f.message);
    }
    const lassoId = toLassoId(check.link.cvr, config.LASSO_COMPANY_ID_PREFIX);
    await renderCompanyPage(req, res, html, lassoId, {
      focus: check.link.focus ?? "overblik",
      years: check.link.years,
      metric: check.link.metric,
      question: check.link.question,
      metrics: check.link.metrics,
      topic: check.link.topic,
    });
  });

  app.get("/p/:id", async (req, res) => {
    const html = await loadViewHtml();
    const check = verifyPersonLink(config, String(req.params.id), req.query as Record<string, unknown>);
    if (!check.ok) {
      const f = linkFailure(check.reason, ASK_AGAIN("personen"));
      return failPage(res, html, f.status, f.message);
    }
    await renderPersonPage(req, res, html, check.lassoId, check.focus, check.question, check.topic);
  });

  // Gem-laget: én side pr. entitet (virksomhed CVR-1-…, person CVR-3-/CVR-4-…), fra gemte sider og send-til-Lasso.
  app.get("/e/:lassoId", async (req, res) => {
    const html = await loadViewHtml();
    const check = verifyEntityLink(config, String(req.params.lassoId), req.query as Record<string, unknown>);
    if (!check.ok) {
      const f = linkFailure(check.reason, FROM_LIST);
      return failPage(res, html, f.status, f.message);
    }
    // verifyEntityLink har tjekket, at fokus passer til entiteten (virksomheds- eller personfokus).
    if (pageKindOf(check.lassoId) === "company") {
      const focus = (check.focus ?? "overblik") as Focus;
      return renderCompanyPage(req, res, html, check.lassoId, { focus, years: focus === "oekonomi" ? 10 : 5 });
    }
    await renderPersonPage(req, res, html, check.lassoId, isPersonFocus(check.focus) ? check.focus : "overblik");
  });

  // --- Send til Lasso (docs/gem-lag.md, "Indgange udefra") ---------------------
  // Server-til-server fra portalen, et CRM eller en e-mail-tjeneste: gemmer siden på brugerens liste.
  // Skriver til brugernes lister ud fra et userId i body'en, så uden nøgle er ruten lukket
  // (503) uden for lokal udvikling; de øvrige admin-ruter er åbne uden nøgle, men de er kun læsning.
  const sendKey = (req: Request, res: Response, next: NextFunction) => {
    const expected = sendToLassoKey(config);
    if (!isSet(expected)) {
      if (config.APP_ENV === "development") return next();
      return void res.status(503).json({ error: "Send til Lasso er ikke sat op: SEND_TO_LASSO_KEY (eller ADMIN_API_KEY) mangler." });
    }
    if (safeEqual(providedKey(req), expected)) return next();
    res.status(401).json({ error: "Unauthorized" });
  };

  app.post("/api/send-to-lasso", sendKey, async (req, res) => {
    const parsed = parseSendRequest(req.body, config, true);
    if ("error" in parsed) return void res.status(400).json({ error: parsed.error });
    let snapshot: Awaited<ReturnType<typeof entitySnapshot>>;
    try {
      snapshot = await entitySnapshot(provider, parsed.lassoId);
    } catch (err) {
      return void res.status(404).json({ error: `Kunne ikke hente ${parsed.lassoId}: ${errorMessage(err)}` });
    }
    try {
      const { page, created } = await pages.save({ ...parsed, kind: snapshot.kind, name: snapshot.name, cvr: snapshot.cvr, origin: "send" });
      res.status(created ? 201 : 200).json({ saved: savedPageVM(config, page), created, url: entityLink(config, page.lassoId, { focus: parsed.focus }) });
    } catch (err) {
      if (err instanceof SavedPageError) return void res.status(400).json({ error: err.message });
      throw err;
    }
  });

  // Et signeret link til en knap i en e-mail eller et CRM. Gemmer intet; det gør GET /send-to-lasso.
  app.post("/api/send-to-lasso/link", sendKey, (req, res) => {
    const parsed = parseSendRequest(req.body, config, false);
    if ("error" in parsed) return void res.status(400).json({ error: parsed.error });
    const { lassoId, userId, org, focus } = parsed;
    res.json({ url: sendToLassoLink(config, { lassoId, userId, org, ...(focus ? { focus } : {}) }) });
  });

  // Knappen i e-mailen/CRM'et: gemmer siden (oprindelse "link") og sender videre til /e/<lassoId>.
  app.get("/send-to-lasso", async (req, res) => {
    const html = await loadViewHtml();
    const check = verifySendToLassoLink(config, req.query as Record<string, unknown>);
    if (!check.ok) {
      const f = linkFailure(check.reason, "Siden er ikke gemt. Bed om et nyt link.");
      return failPage(res, html, f.status, f.message);
    }
    const { lassoId, userId, org, focus } = check.link;
    let snapshot: Awaited<ReturnType<typeof entitySnapshot>>;
    try {
      snapshot = await entitySnapshot(provider, lassoId);
    } catch (err) {
      return failPage(res, html, 404, `Kunne ikke hente ${pageKindOf(lassoId) === "person" ? "personen" : "virksomheden"}: ${errorMessage(err)}`);
    }
    try {
      await pages.save({ org, userId, lassoId, kind: snapshot.kind, name: snapshot.name, cvr: snapshot.cvr, focus, origin: "link" });
    } catch (err) {
      if (err instanceof SavedPageError) return failPage(res, html, 400, err.message);
      throw err;
    }
    res.set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex").redirect(302, entityLink(config, lassoId, { focus }));
  });

  // --- Fejlfinding (kræver ADMIN_API_KEY) ------------------------------------
  // Rå svar fra Lasso, så adapters kan tilpasses: /api/debug/lasso/CVR-1-12345678/reports/advanced
  app.get(/^\/api\/debug\/lasso\/(.+)$/, requireKey(config.ADMIN_API_KEY), async (req, res) => {
    const path = (req.params as unknown as Record<string, string>)[0] ?? "";
    const query: Query = {};
    for (const [k, v] of Object.entries(req.query)) if (k !== "key" && typeof v === "string") query[k] = v;
    try {
      const raw = await client.get(path, query);
      res.json(req.query.shape === "true" ? describeShape(raw, 6) : raw);
    } catch (err) {
      const status = err instanceof LassoApiError ? err.status : 502;
      res.status(status).json({ error: errorMessage(err), body: err instanceof LassoApiError ? err.body : undefined });
    }
  });

  // Datasættet, som UI'en ville få for en virksomhed: /api/debug/company/12345678
  app.get("/api/debug/company/:ref", requireKey(config.ADMIN_API_KEY), async (req, res) => {
    const spec = companyTemplate(toLassoId(String(req.params.ref), config.LASSO_COMPANY_ID_PREFIX));
    res.json(await resolveSpec(spec, provider));
  });

  app.use((_req, res) => void res.status(404).json({ error: "Not found" }));
  return app;
}

/**
 * Opstartstjek mod Lassos API. Normalt kun status og røgtest af show_company og
 * search_companies. Med LOG_LEVEL=debug logges også svarenes form og et råt
 * udsnit af det nyeste regnskab (offentlige data, aldrig nøgler).
 */
async function probeLasso(config: Config, client: LassoClient, provider: DataProvider) {
  if (!config.LASSO_STARTUP_PROBE || !hasLassoCredentials(config)) return;
  const verbose = config.LOG_LEVEL === "debug";
  const log = (label: string, v: unknown) => console.log(`[lasso-probe] ${label}: ${JSON.stringify(v)}`);
  try {
    const raw = await client.search({ query: config.LASSO_STARTUP_PROBE_QUERY, type: "all", pageSize: 3 });
    const found = adaptSearch(raw, config.LASSO_COMPANY_ID_PREFIX);
    log("search OK", verbose ? describeShape(raw, 5) : `${found.total ?? found.rows.length} virksomheder`);
    const first = config.LASSO_STARTUP_PROBE_ID.trim()
      ? { lassoId: toLassoId(config.LASSO_STARTUP_PROBE_ID, config.LASSO_COMPANY_ID_PREFIX) }
      : found.rows[0];
    if (!first) return log("search", "ingen virksomheder at teste videre med");
    log("tester med", first.lassoId);

    // Røgtest af de rigtige flows (samme kode som MCP-tools) med kold cache, kun resumé i loggen.
    if (provider.kind === "live") {
      const lookup = await findCompany(provider, config.LASSO_STARTUP_PROBE_QUERY);
      log(`navneopslag "${config.LASSO_STARTUP_PROBE_QUERY}"`, lookup ? [lookup.pick, ...lookup.alternatives].map((r) => `${r.name} (${r.cvr ?? r.lassoId})`) : "intet match");
      const t1 = Date.now();
      const company = await resolveSpec(companyTemplate(first.lassoId), provider);
      log(`show_company-resumé (${Date.now() - t1} ms)`, summarizeView(companyTemplate(first.lassoId), company).split("\n"));
      const listSpec = listTemplate(searchQuerySchema.parse({ query: config.LASSO_STARTUP_PROBE_QUERY, limit: 5 }));
      const t0 = Date.now();
      const list = await resolveSpec(listSpec, provider);
      log(`search_companies-resumé (${Date.now() - t0} ms)`, summarizeView(listSpec, list).split("\n"));
      // Hele datasættet (offentlige CVR- og regnskabsdata), så visningen kan gengives lokalt med rigtige data.
      if (verbose) {
        console.log(`[lasso-probe] dataset show_company: ${JSON.stringify({ spec: companyTemplate(first.lassoId), dataset: company })}`);
        console.log(`[lasso-probe] dataset search_companies: ${JSON.stringify({ spec: listSpec, dataset: list })}`);
      }
    }
    // Lassos søgning (dev3 med egen nøgle): prompt -> filtre -> lassoId'er. Kører, når nøglen er sat,
    // og logger formen, så søgningen kan kobles på search_companies.
    if (client.hasSearchCredentials) {
      const prompt = "Revisorer i Region Midtjylland med mindst 10 ansatte";
      const fail = (step: string, err: unknown, ms: number) =>
        log(`${step} FEJL efter ${ms} ms`, `${errorMessage(err)}${err instanceof LassoApiError ? ` (HTTP ${err.status}) ${JSON.stringify(err.body).slice(0, 500)}` : ""}`);
      const t0 = Date.now();
      let raw: unknown;
      try {
        raw = await client.searchPrompt(prompt);
        log(`search/query/prompt "${prompt}" (${Date.now() - t0} ms), form`, describeShape(raw, 6));
        console.log(`[lasso-probe] search/query/prompt rå: ${JSON.stringify(raw).slice(0, 3000)}`);
      } catch (err) {
        fail("search/query/prompt", err, Date.now() - t0);
      }
      if (raw !== undefined) {
        const filters = Array.isArray(raw) ? raw : (at(raw, "filters") ?? raw);
        const firstFilter = Array.isArray(filters) ? filters[0] : undefined;
        const fieldName = String(at(firstFilter, "FieldName") ?? "") || undefined;
        const t1 = Date.now();
        try {
          const ids = await client.searchByFilters(filters, fieldName);
          const summary =
            typeof ids === "object" && ids !== null && !Array.isArray(ids)
              ? Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, Array.isArray(v) ? [`${v.length} stk.`, ...v.slice(0, 5)] : v]))
              : describeShape(ids, 2);
          log(`search/lassoid OrderBy=${fieldName ?? "(ingen)"} (${Date.now() - t1} ms)`, summary);
        } catch (err) {
          fail("search/lassoid", err, Date.now() - t1);
        }
      }
    }
    // Svarformer for de endpoints, adapterne er skrevet efter Lassos dokumentation uden en nøgle
    // (docs/endpoints-*.md): ét kald pr. endpoint mod testvirksomheden, kun struktur og et kort
    // udsnit af første element i loggen (offentlige CVR-data, aldrig nøgler). Creditsafe udelades,
    // fordi et opslag koster en kredit. Tilkøb (Paqle, live number, CHR) logges som deres HTTP-status.
    await probeEndpointShapes(client, first.lassoId, log);
    if (!verbose) return;

    for (const [name, fn] of [
      ["search extended=true", () => client.search({ query: config.LASSO_STARTUP_PROBE_QUERY, type: "all", pageSize: 1, extended: true })],
      ["company", () => client.company(first.lassoId)],
      ["reports", () => client.reports(first.lassoId)],
      ["valuations", () => client.valuations(first.lassoId)],
      ["websites", () => client.websites(first.lassoId)],
    ] as const) {
      try {
        log(`${name} OK, shape`, describeShape(await fn(), 6));
      } catch (err) {
        log(`${name} FEJL`, errorMessage(err));
      }
    }
    try {
      const reports = await client.reports(first.lassoId);
      if (Array.isArray(reports) && reports.length) {
        const sections = (r: unknown, scope: string) => Object.keys((at(r, `data.${scope}.facts`) as object | undefined) ?? {});
        log(
          "reports oversigt",
          reports.map((r) => ({ year: at(r, "reportYear"), company: sections(r, "company"), group: sections(r, "group") })),
        );
        // Nyeste og ældste regnskab med XBRL-data (begreberne skifter mellem taksonomier).
        const withFacts = [...reports]
          .filter((r) => sections(r, "company").length || sections(r, "group").length)
          .sort((a, b) => Number(at(b, "reportYear") ?? 0) - Number(at(a, "reportYear") ?? 0));
        for (const r of new Set([withFacts[0], withFacts.at(-1)])) {
          const node = at(r, "data.company.facts.incomeStatement") ?? at(r, "data.group.facts.incomeStatement");
          if (node !== undefined) console.log(`[lasso-probe] incomeStatement (${String(at(r, "reportYear"))}) udsnit: ${JSON.stringify(node).slice(0, 3000)}`);
        }
      }
    } catch (err) {
      log("reports-udsnit FEJL", errorMessage(err));
    }
  } catch (err) {
    log("search FEJL", `${errorMessage(err)}${err instanceof LassoApiError ? ` (HTTP ${err.status})` : ""}`);
    if (err instanceof LassoApiError && (err.status === 401 || err.status === 403)) {
      const q = config.LASSO_STARTUP_PROBE_QUERY;
      log("login-varianter mod /data/cvr/search (kun HTTP-status)", await probeAuthVariants(config, "data/cvr/search", { query: q, pageSize: 1, type: "all", page: 1 }));
      log("401-svarets indhold", typeof err.body === "string" ? err.body.slice(0, 300) : describeShape(err.body, 3));
    }
  }
}

/** Kort udsnit af første element i en liste (eller af objektet), så brøk/procent og feltnavne kan ses. */
function firstSlice(raw: unknown, maxChars: number, ...paths: string[]): string {
  let node: unknown = raw;
  for (const path of paths) {
    const next = at(node as Parameters<typeof at>[0], path);
    if (next !== undefined) {
      node = next;
      break;
    }
  }
  const item = Array.isArray(node) ? node[0] : node;
  return JSON.stringify(item ?? null).slice(0, maxChars);
}

/** Top-niveauets skalarfelter (fx observations' score og version), uden listerne. */
function scalarsOf(raw: unknown): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return JSON.stringify(raw ?? null).slice(0, 200);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (v === null || typeof v !== "object") out[k] = v;
  return JSON.stringify(out).slice(0, 400);
}

/**
 * Logger form og et udsnit af svaret fra de endpoints, adapterne bygger på (opstartsprobe).
 * Fejl logges som status, fx "403 (tilkøb?)", og stopper aldrig opstarten.
 */
export async function probeEndpointShapes(client: LassoClient, lassoId: string, log: (label: string, v: unknown) => void): Promise<void> {
  const cvr = cvrFromLassoId(lassoId) ?? "";
  // Feltnavnene (kun nøgler, aldrig værdier) på første medlem af ledelse, bestyrelse og stakeholders
  // i company-full, så det kan ses, hvor personernes Lasso-ID står (adaptPeople/participantLassoId).
  try {
    const companyRaw = await client.company(lassoId);
    log("felter company-full deltagere", participantFieldNames(companyRaw));
    // Hvor mange ledelsesrækker ender med et Lasso-ID (= link i visningerne). Kun tal, ingen navne.
    const people = adaptPeople(companyRaw);
    const withId = people.filter((x) => x.lassoId !== undefined && isEntityId(x.lassoId)).length;
    log("ledelse med Lasso-ID", `${withId} af ${people.length}`);
  } catch (err) {
    log("felter company-full deltagere FEJL", err instanceof LassoApiError ? `HTTP ${err.status}` : errorMessage(err));
  }
  // [navn, kald, stier til første element, maks tegn i udsnittet]
  const calls: [string, () => Promise<unknown>, string[], number][] = [
    ["owners/legal", () => client.get(`${encodeURIComponent(lassoId)}/owners/legal`), ["owners"], 700],
    ["owners/beneficial", () => client.get(`${encodeURIComponent(lassoId)}/owners/beneficial`), ["owners"], 700],
    [
      "relations/graph",
      () => client.post("modules/relations/graph", { ids: [lassoId], relationTypes: ["ownership"], enrichments: ["companyinfo", "personinfo"], ingoingDepth: 1, outgoingDepth: 1 }),
      ["relations"],
      700,
    ],
    ["relations/graph entity", () => client.post("modules/relations/graph", { ids: [lassoId], relationTypes: ["ownership"], enrichments: ["companyinfo", "personinfo"], ingoingDepth: 1, outgoingDepth: 1 }), ["entities"], 900],
    ["observations (CompanyInsight)", () => client.post(`modules/observations/${encodeURIComponent(lassoId)}`, { observationTags: ["CompanyInsight"] }), ["observations"], 700],
    ["modules/news", () => client.post("modules/news?limit=2&orderBy=publishtime", [lassoId]), [], 700],
    ["productionUnit (CVR-2)", async () => {
      const units = at((await client.company(lassoId)) as Parameters<typeof at>[0], "productionUnits");
      const first = Array.isArray(units) ? units[0] : undefined;
      const id = first && typeof first === "object" ? (first as { lassoId?: string }).lassoId : undefined;
      return id ? client.get(encodeURIComponent(id)) : undefined;
    }, [], 900],
    ["paqle/news", () => client.get(`data/paqle/${encodeURIComponent(lassoId)}/news`), ["news"], 700],
    ["livenumber", () => client.get(`data/livenumber/${encodeURIComponent(lassoId)}`), ["numbers"], 700],
    ["CHR/livestock", () => client.get(`data/CHR/livestock/${cvr}`, { onlyCurrent: "true" }), [], 3500],
    ["reportanalysis", () => client.post(`modules/reportanalysis/${encodeURIComponent(lassoId)}`, {}, {}, { timeoutMs: 30_000 }), [], 600],
  ];
  for (const [name, fn, paths, maxChars] of calls) {
    const t0 = Date.now();
    try {
      const raw = await fn();
      log(`form ${name} (${Date.now() - t0} ms)`, describeShape(raw, 5));
      if (raw && typeof raw === "object" && !Array.isArray(raw)) log(`felter ${name}`, scalarsOf(raw));
      log(`udsnit ${name}`, firstSlice(raw, maxChars, ...paths));
    } catch (err) {
      const status = err instanceof LassoApiError ? `HTTP ${err.status}${err.status === 401 || err.status === 403 ? " (tilkøb eller ingen adgang)" : ""}` : errorMessage(err);
      log(`form ${name} FEJL (${Date.now() - t0} ms)`, status);
    }
  }
}

async function main() {
  const config = loadConfig();
  const client = new LassoClient(config);
  const provider = createProvider(config, client);
  // Én pool deles af gemte visninger og gemte sider; uden DATABASE_URL holdes begge i hukommelsen.
  const pool = createPool(config.DATABASE_URL);
  const store = createViewStore(pool ?? "");
  const pages = createSavedPageStore(pool ?? "");

  // Databasen kan starte efter appen på Railway: prøv i baggrunden med backoff.
  // Lykkes det ikke, prøver hvert kald til databasen igen.
  void (async () => {
    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        await store.migrate();
        await pages.migrate();
        if (attempt > 1) console.log(`[db] migreret (forsøg ${attempt})`);
        return;
      } catch (err) {
        console.error(`[db] migrering fejlede (forsøg ${attempt}): ${errorMessage(err)}`);
        await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * 2 ** attempt)));
      }
    }
  })();

  const pdf = pdfRendererFor(config);
  const app = createApp({ config, client, provider, store, pages, pdf });
  const server = app.listen(config.PORT, "0.0.0.0", () => {
    console.log(
      `[lasso-mcp] v${VERSION} ${config.APP_ENV} på port ${config.PORT} | data: ${provider.kind} | lasso-credentials: ${hasLassoCredentials(config) ? "ja" : "nej"} | søgning: ${client.hasSearchCredentials ? config.LASSO_SEARCH_API_BASE_URL : "ingen nøgle"} | db: ${store.kind} | mcp-nøgle: ${mcpKeyRequired(config) ? "ja" : "nej"} | pdf: ${pdfAvailable(config) ? "ja" : "nej"} | portal: ${portalLoginRequired(config) ? "login" : "åben"} | ${config.publicBaseUrl}/mcp`,
    );
    void probeLasso(config, client, provider).catch((err) => console.error("[lasso-probe] fejl:", errorMessage(err)));
  });

  const shutdown = () => {
    console.log("[lasso-mcp] lukker ned");
    server.close(() => {
      void Promise.all([store.close(), pages.close(), pdf.close()])
        .then(() => pool?.end())
        .finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.env.LASSO_NO_MAIN !== "1") {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
