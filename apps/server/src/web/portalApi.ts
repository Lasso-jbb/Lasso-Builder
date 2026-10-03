import { Router, type NextFunction, type Request, type Response } from "express";
import { summarizeView } from "../data/summary.js";
import { z } from "zod";
import { FOCUSES, METRICS, PAGE_FOCUSES, PERSON_FOCUSES, searchQuerySchema } from "@lasso/spec";
import type { CurrentUser } from "../auth/user.js";
import type { Config } from "../config.js";
import type { DataProvider } from "../data/provider.js";
import type { SavedPageStore } from "../pages/store.js";
import {
  listSavedPages,
  removeSavedPage,
  resolveView,
  savePage,
  saveView,
  searchCompanies,
  showCompany,
  showPerson,
  type UseCaseCtx,
  type UseCaseError,
} from "../usecases/index.js";
import { VISIBILITIES, type ViewStore } from "../views/store.js";
import { entityLink } from "./links.js";

/**
 * Portal-API'et (docs/portal.md): samme use-cases som MCP-tools (usecases/), så resultatet i
 * browseren er identisk med det i Claude. Monteres i index.ts bag requirePortal, som kræver session
 * (401) og CSRF-header på alt andet end GET/HEAD (403) og lægger brugeren på res.locals.user.
 *
 * Alle svar er JSON med Cache-Control: no-store. Fejl er { error } med dansk tekst: 400 ugyldigt
 * input, 404 findes ikke, 409 optaget adresse (views).
 */
export interface PortalApiDeps {
  config: Config;
  provider: DataProvider;
  store: ViewStore;
  pages: SavedPageStore;
}

const oneOf = (name: string, values: readonly string[]) => `${name} skal være en af: ${values.join(", ")}.`;
const between = (name: string, min: number, max: number) => `${name} skal være et helt tal fra ${min} til ${max}.`;
const wholeNumber = (name: string, min: number, max: number) =>
  z.coerce.number({ error: between(name, min, max) }).int(between(name, min, max)).min(min, between(name, min, max)).max(max, between(name, min, max));
const text = (name: string, max: number) => z.string({ error: `${name} skal være tekst.` }).max(max, `${name} må højst være ${max} tegn.`);

const searchParams = z.object({
  query: text("query", 200).default(""),
  limit: wholeNumber("limit", 1, 100).optional(),
  title: text("title", 120).optional(),
});

const companyParams = z.object({
  focus: z.enum(FOCUSES, { error: oneOf("focus", FOCUSES) }).optional(),
  years: wholeNumber("years", 2, 10).optional(),
  metric: z.enum(METRICS, { error: oneOf("metric", METRICS) }).optional(),
});

const personParams = z.object({
  focus: z.enum(PERSON_FOCUSES, { error: oneOf("focus", PERSON_FOCUSES) }).optional(),
});

const PAGE_LIST_KINDS = ["company", "person", "all"] as const;
const listPagesParams = z.object({
  kind: z.enum(PAGE_LIST_KINDS, { error: oneOf("kind", PAGE_LIST_KINDS) }).optional(),
  limit: wholeNumber("limit", 1, 100).optional(),
});

const PAGE_KINDS = ["company", "person"] as const;
const BODY_ERROR = "Body skal være et JSON-objekt.";
const savePageBody = z.object(
  {
    page: z.string({ error: "Angiv page: Lasso-ID, CVR-nummer eller navn." }).trim().min(1, "Angiv page: Lasso-ID, CVR-nummer eller navn."),
    kind: z.enum(PAGE_KINDS, { error: oneOf("kind", PAGE_KINDS) }).optional(),
    // Virksomheds- eller personfokus; et fokus, der ikke passer til siden, gemmes ikke (savePage).
    focus: z.enum(PAGE_FOCUSES, { error: oneOf("focus", PAGE_FOCUSES) }).optional(),
    note: text("note", 500).optional(),
  },
  { error: BODY_ERROR },
);

const saveViewBody = z.object(
  {
    // Specen valideres af use-casen (samme tekst som save_view).
    spec: z.unknown().optional(),
    name: text("name", 120).min(1, "name må ikke være tom.").optional(),
    slug: text("slug", 64).optional(),
    visibility: z.enum(VISIBILITIES, { error: oneOf("visibility", VISIBILITIES) }).optional(),
  },
  { error: BODY_ERROR },
);

const lookupParams = z.object({ q: text("q", 120).default("") });

const resolveBody = z.object({ spec: z.unknown().optional() }, { error: BODY_ERROR });

/** Ét 400-svar med zod-fejlenes (danske) tekster. */
function parseOr400<T>(schema: z.ZodType<T>, input: unknown, res: Response): T | undefined {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const messages = [...new Set(parsed.error.issues.map((i) => i.message))];
  res.status(400).json({ error: messages.join(" ") });
  return undefined;
}

const sendError = (res: Response, err: UseCaseError) => void res.status(err.status).json({ error: err.error });

export function portalApi({ config, provider, store, pages }: PortalApiDeps): Router {
  const router = Router();
  const ctx = (res: Response): UseCaseCtx => ({ config, provider, store, pages, user: res.locals.user as CurrentUser });

  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  // Som search_companies: Lassos fortolkning af friteksten, kriterierne som chips.
  router.get("/search", async (req, res) => {
    const params = parseOr400(searchParams, req.query, res);
    if (!params) return;
    const r = await searchCompanies(ctx(res), { ...searchQuerySchema.parse({ query: params.query, limit: params.limit }), title: params.title });
    if ("error" in r) return sendError(res, r);
    res.json({ spec: r.spec, dataset: r.dataset, ...(r.note ? { note: r.note } : {}) });
  });

  // Søgefeltet i den nye portal (søg mens man skriver): firmaer og personer på navn eller CVR-nummer,
  // Lassos navnesøgning (data/cvr/search), ikke AI-søgningen. Fejler den ene del, er den tom.
  router.get("/lookup", async (req, res) => {
    const params = parseOr400(lookupParams, req.query, res);
    if (!params) return;
    const q = params.q.trim();
    if (q.length < 2) return void res.json({ q, companies: [], persons: [] });
    const [companies, persons] = await Promise.all([
      provider.findCompanies(q, 20).catch(() => []),
      /^\d+$/.test(q.replace(/\s/g, "")) ? Promise.resolve([]) : provider.findPersons(q, 20).catch(() => []),
    ]);
    res.json({
      q,
      companies: companies.map((c) => ({ lassoId: c.lassoId, name: c.name, ...(c.cvr ? { cvr: c.cvr } : {}), ...(c.city ? { city: c.city } : {}), ...(c.status ? { status: c.status } : {}), ...(c.statusKind ? { statusKind: c.statusKind } : {}) })),
      persons: persons.map((p) => ({ lassoId: p.lassoId, name: p.name, ...(p.city ? { city: p.city } : {}) })),
    });
  });

  // Som show_company. link = den signerede /e/-side med samme focus (samme side som gemte sider).
  router.get("/company/:ref", async (req, res) => {
    const params = parseOr400(companyParams, req.query, res);
    if (!params) return;
    const r = await showCompany(ctx(res), { company: String(req.params.ref), focus: params.focus, years: params.years, chart_metric: params.metric });
    if ("error" in r) return sendError(res, r);
    // summary: samme resumé som værktøjssvarene giver modellen; portalen sender det som chattens kontekst (chat/context.ts).
    res.json({ spec: r.spec, dataset: r.dataset, ...(r.note ? { note: r.note } : {}), link: entityLink(config, r.lassoId, { focus: params.focus }), summary: summarizeView(r.spec, r.dataset) });
  });

  // Som show_person. link = den signerede /e/-side med samme focus, samme form som for virksomheder i portalen.
  router.get("/person/:ref", async (req, res) => {
    const params = parseOr400(personParams, req.query, res);
    if (!params) return;
    const r = await showPerson(ctx(res), { person: String(req.params.ref), focus: params.focus });
    if ("error" in r) return sendError(res, r);
    res.json({ spec: r.spec, dataset: r.dataset, ...(r.note ? { note: r.note } : {}), link: entityLink(config, r.lassoId, { focus: params.focus }), summary: summarizeView(r.spec, r.dataset) });
  });

  // Som resolve_view: drill-down, filterændring og opdatér.
  router.post("/resolve", async (req, res) => {
    const body = parseOr400(resolveBody, req.body ?? {}, res);
    if (!body) return;
    const r = await resolveView(ctx(res), body.spec);
    if ("error" in r) return sendError(res, r);
    res.json({ spec: r.spec, dataset: r.dataset });
  });

  // --- Gemte sider (som list_saved_pages, save_page og remove_saved_page) ---
  router.get("/pages", async (req, res) => {
    const params = parseOr400(listPagesParams, req.query, res);
    if (!params) return;
    const r = await listSavedPages(ctx(res), params);
    res.json({ spec: r.spec, dataset: r.dataset });
  });

  router.post("/pages", async (req, res) => {
    const body = parseOr400(savePageBody, req.body ?? {}, res);
    if (!body) return;
    const r = await savePage(ctx(res), body);
    if ("error" in r) return sendError(res, r);
    res.json({ lassoId: r.lassoId, kind: r.kind, name: r.name, ...(r.cvr ? { cvr: r.cvr } : {}), savedAt: r.savedAt, created: r.created, total: r.total, url: r.url });
  });

  router.delete("/pages/:lassoId", async (req, res) => {
    const r = await removeSavedPage(ctx(res), { page: String(req.params.lassoId) });
    if ("error" in r) return sendError(res, r);
    res.json({ lassoId: r.lassoId, removed: r.removed, total: r.total });
  });

  // Som save_view: et delbart link til /v/<org>/<slug>.
  router.post("/views", async (req, res) => {
    const body = parseOr400(saveViewBody, req.body ?? {}, res);
    if (!body) return;
    const r = await saveView(ctx(res), { ...body, spec: body.spec });
    if ("error" in r) return sendError(res, r);
    res.json(r);
  });

  router.use(portalErrorHandler);
  return router;
}

/**
 * Fejl under /api/portal som JSON (ikke Express' HTML-side). Monteres også i index.ts efter routeren,
 * så JSON-parserens fejl (ugyldig eller for stor body), der sker før ruterne, også bliver JSON.
 * Uventede fejl giver 500 uden detaljer ud til browseren; detaljerne står i loggen.
 */
export function portalErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) return next(err);
  res.set("Cache-Control", "no-store");
  // JSON-parserens fejl (body-parser) har en type som "entity.parse.failed" og en 4xx-status.
  const { status, type } = (err ?? {}) as { status?: unknown; type?: unknown };
  if (typeof type === "string" && typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({ error: type === "entity.too.large" ? "Body er for stor." : "Body kunne ikke læses som JSON." });
    return;
  }
  console.error("[portal] fejl:", err);
  res.status(500).json({ error: "Der skete en fejl på serveren. Prøv igen om lidt." });
}
