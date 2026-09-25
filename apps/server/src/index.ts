import { timingSafeEqual } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import cors from "cors";
import type { NextFunction, Request, Response } from "express";
import { companyTemplate, listTemplate, parseViewSpec, searchQuerySchema, toLassoId } from "@lasso/spec";
import { getCurrentUser } from "./auth/user.js";
import { hasLassoCredentials, isSet, loadConfig, type Config } from "./config.js";
import { createProvider, type DataProvider } from "./data/index.js";
import { errorMessage, normalizeSpec, resolveSpec } from "./data/resolve.js";
import { summarizeView } from "./data/summary.js";
import { adaptSearch, at } from "./lasso/adapters.js";
import { describeShape, LassoApiError, LassoClient, probeAuthVariants, type Query } from "./lasso/client.js";
import { createMcpServer } from "./mcp/server.js";
import { createViewStore, SLUG_PATTERN, slugify, ViewConflictError, VISIBILITIES, type ViewStore } from "./views/store.js";
import { injectBoot, loadViewHtml } from "./web/page.js";

const VERSION = "0.1.0";

export interface AppDeps {
  config: Config;
  client: LassoClient;
  provider: DataProvider;
  store: ViewStore;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

function providedKey(req: Request): string {
  const auth = req.header("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : undefined;
  const fromQuery = typeof req.query.key === "string" ? req.query.key : undefined;
  const fromPath = typeof req.params.key === "string" ? req.params.key : undefined;
  return fromPath ?? req.header("x-api-key") ?? bearer ?? fromQuery ?? "";
}

/** Kræver nøglen, hvis den er sat. Uden nøgle er ruten åben (kun til lokal udvikling). */
function requireKey(expected: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isSet(expected)) return next();
    if (safeEqual(providedKey(req), expected)) return next();
    res.status(401).json({ error: "Unauthorized" });
  };
}

export function createApp({ config, client, provider, store }: AppDeps) {
  const app = createMcpExpressApp({ host: "0.0.0.0", jsonLimit: "1mb" });
  app.disable("x-powered-by");

  app.get("/", (_req, res) => {
    res.json({
      name: "lasso-mcp",
      version: VERSION,
      env: config.APP_ENV,
      mcp: `${config.publicBaseUrl}/mcp`,
      health: `${config.publicBaseUrl}/health`,
    });
  });

  app.get("/health", async (_req, res) => {
    // Altid 200, så en midlertidig databasefejl ikke stopper et deploy. Tilstanden står i svaret.
    const dbOk = await store.ping();
    res.json({
      status: dbOk ? "ok" : "degraded",
      version: VERSION,
      env: config.APP_ENV,
      dataSource: provider.kind,
      lassoCredentials: hasLassoCredentials(config),
      database: store.kind,
      databaseOk: dbOk,
      mcpKeyRequired: isSet(config.MCP_ACCESS_KEY),
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  // --- MCP (Streamable HTTP, stateless: ny server pr. request) --------------
  const handleMcp = async (req: Request, res: Response) => {
    const user = getCurrentUser(req, config);
    const server = createMcpServer({ config, provider, store, user });
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
  app.all("/mcp", requireKey(config.MCP_ACCESS_KEY), handleMcp);
  app.all("/mcp/:key", requireKey(config.MCP_ACCESS_KEY), handleMcp);

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

  // --- Delt side: specen hentes, data hentes friskt, render-appen tegner -----
  app.get("/v/:org/:slug", async (req, res) => {
    const view = await store.get(req.params.org, req.params.slug);
    const html = await loadViewHtml();
    if (!view) {
      res.status(404).type("html").send(injectBoot(html, { mode: "web", error: "Visningen findes ikke eller er slettet." }, "Ikke fundet"));
      return;
    }
    const dataset = await resolveSpec(view.spec, provider);
    const url = `${config.publicBaseUrl}/v/${view.org}/${view.slug}`;
    res
      .type("html")
      .set("Cache-Control", "no-store")
      .send(injectBoot(html, { mode: "web", spec: view.spec, dataset, url, name: view.name, version: view.version, updatedAt: view.updatedAt }, view.name ?? view.spec.title));
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
        const newest = [...reports].sort((a, b) => Number(at(b, "reportYear") ?? 0) - Number(at(a, "reportYear") ?? 0))[0];
        const node = at(newest, "data.company.facts.incomeStatement") ?? at(newest, "data.group.facts.incomeStatement");
        if (node !== undefined) console.log(`[lasso-probe] incomeStatement (${String(at(newest, "reportYear"))}) udsnit: ${JSON.stringify(node).slice(0, 3000)}`);
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

async function main() {
  const config = loadConfig();
  const client = new LassoClient(config);
  const provider = createProvider(config, client);
  const store = createViewStore(config.DATABASE_URL);

  // Databasen kan starte efter appen på Railway: prøv i baggrunden med backoff.
  // Lykkes det ikke, prøver hvert kald til databasen igen.
  void (async () => {
    for (let attempt = 1; attempt <= 8; attempt++) {
      try {
        await store.migrate();
        if (attempt > 1) console.log(`[db] migreret (forsøg ${attempt})`);
        return;
      } catch (err) {
        console.error(`[db] migrering fejlede (forsøg ${attempt}): ${errorMessage(err)}`);
        await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * 2 ** attempt)));
      }
    }
  })();

  const app = createApp({ config, client, provider, store });
  const server = app.listen(config.PORT, "0.0.0.0", () => {
    console.log(
      `[lasso-mcp] v${VERSION} ${config.APP_ENV} på port ${config.PORT} | data: ${provider.kind} | lasso-credentials: ${hasLassoCredentials(config) ? "ja" : "nej"} | db: ${store.kind} | mcp-nøgle: ${isSet(config.MCP_ACCESS_KEY) ? "ja" : "nej"} | ${config.publicBaseUrl}/mcp`,
    );
    void probeLasso(config, client, provider).catch((err) => console.error("[lasso-probe] fejl:", errorMessage(err)));
  });

  const shutdown = () => {
    console.log("[lasso-mcp] lukker ned");
    server.close(() => {
      void store.close().finally(() => process.exit(0));
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
