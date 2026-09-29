import cors from "cors";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  cvrFromLassoId,
  FOCUSES,
  isPersonFocus,
  isPersonId,
  mainMetric,
  PERSON_FOCUSES,
  toLassoId,
  viewSpecSchema,
  type Dataset,
  type Focus,
  type PersonFocus,
  type ViewSpec,
} from "@lasso/spec";
import type { CurrentUser } from "../auth/user.js";
import type { Config } from "../config.js";
import type { DataProvider } from "../data/provider.js";
import { errorMessage, resolveSpec } from "../data/resolve.js";
import { pageKindOf, type SavedPageStore } from "../pages/store.js";
import { resolveView } from "../usecases/index.js";
import type { ViewStore } from "../views/store.js";
import { ASK_AGAIN, failPage, FROM_LIST, linkFailure, VIEW_MISSING, VIEW_OUTDATED } from "../web/linkErrors.js";
import { companyLink, personLink, verifyCompanyLink, verifyEntityLink, verifyPersonLink } from "../web/links.js";
import { loadViewHtml } from "../web/page.js";
import { companyReportJob, contentDisposition, entityOfSpec, pdfFilename, personPageJob, viewPageJob, type JobResult } from "./jobs.js";
import { pdfSnapshots, printPageHandler, type PrintJob } from "./printPages.js";
import { pdfAvailable, PDF_UNAVAILABLE, PdfUnavailableError, type PdfRenderer } from "./renderer.js";

/**
 * Ruterne bag "Gem som PDF" (docs/design/README.md, "A4-eksport (27)"). Alle svarer application/pdf
 * med Content-Disposition: attachment, så browseren gemmer filen.
 *
 * - /k/<cvr>.pdf, /p/<id>.pdf, /e/<lassoId>.pdf: samme signerede query som HTML-siderne (samme
 *   signatur, samme fejl). Virksomhed = rapport (ReportA4), person = siden i print-tilstand.
 * - /v/<org>/<slug>.pdf: en gemt visning som side-PDF (samme adgang som /v/).
 * - /x/<token>.pdf: MCP-appens render_view og search_companies: specen og data, som de blev vist,
 *   i et kortlivet lager (10 min). Tokenet er 32 tilfældige bytes og er selve adgangen.
 * - /print/<token>: siden, serverens egen Chromium tegner (kun loopback, printPages.ts).
 * - /api/portal/pdf/* (portalPdfRoutes): portalens knap, bag session.
 *
 * Uden Chromium svarer alle PDF-ruter 503 { error: "PDF er ikke slået til på denne server." }.
 */
export interface PdfDeps {
  config: Config;
  provider: DataProvider;
  store: ViewStore;
  pdf: PdfRenderer;
}

export interface PortalPdfDeps extends PdfDeps {
  pages: SavedPageStore;
}

/** Til de delte siders boot: om PDF er slået til, og det signerede .pdf-link til netop denne side. */
export function pdfBoot(config: Config, req: Request): { pdf: boolean; pdfUrl?: string } {
  if (!pdfAvailable(config)) return { pdf: false };
  const q = req.originalUrl.indexOf("?");
  const query = q >= 0 ? req.originalUrl.slice(q) : "";
  return { pdf: true, pdfUrl: `${config.publicBaseUrl}${req.path.replace(/\/+$/, "")}.pdf${query}` };
}

/** Et signeret .pdf-link ud fra sidens link (/k/…?m=…, /p/…?e=…, /e/…?e=…): samme query, samme signatur. */
export function pdfUrlOf(link: string): string {
  const url = new URL(link);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}.pdf`;
  return url.toString();
}

/**
 * pdfLink i MCP-svarene (show_company, show_person, render_view, search_companies, list_saved_pages
 * og resolve_view): sidens eget link med .pdf, ellers et /x/-link til specen og data, som de blev
 * vist. Virksomheder og personer uden link (drill-down i appen) får deres signerede /k/ og /p/.
 * Uden Chromium: intet link, og appen skjuler knappen.
 */
export function mcpPdfLink(config: Config, view: { spec: ViewSpec; dataset: Dataset; link?: string }): string | undefined {
  if (!pdfAvailable(config)) return undefined;
  if (view.link) return pdfUrlOf(view.link);
  const entity = entityOfSpec(view.spec);
  if (entity?.kind === "company") {
    const cvr = cvrFromLassoId(entity.lassoId);
    if (cvr) return pdfUrlOf(companyLink(config, { cvr, metric: mainMetric(view.dataset.financials[entity.lassoId]?.years ?? []), years: 5 }));
  }
  if (entity?.kind === "person") return pdfUrlOf(personLink(config, entity.lassoId));
  const token = pdfSnapshots.create(viewPageJob(view.spec, view.dataset));
  return `${config.publicBaseUrl}/x/${token}.pdf`;
}

/** Tegner og sender PDF'en. 503 uden Chromium, 500 hvis Chromium fejler (detaljer i loggen). */
async function sendPdf(res: Response, renderer: PdfRenderer, job: PrintJob, label: string): Promise<void> {
  let pdf: Buffer;
  try {
    pdf = await renderer.render(job, label);
  } catch (err) {
    if (err instanceof PdfUnavailableError) return void res.status(503).json({ error: PDF_UNAVAILABLE });
    console.error(`[pdf] ${label}:`, errorMessage(err));
    return void res.status(500).json({ error: "PDF'en kunne ikke laves. Prøv igen om lidt." });
  }
  res
    .status(200)
    .type("application/pdf")
    .set("Content-Disposition", contentDisposition(pdfFilename(job)))
    .set("Cache-Control", "no-store")
    .set("X-Robots-Tag", "noindex")
    .send(pdf);
}

const unavailable = (res: Response) => void res.status(503).json({ error: PDF_UNAVAILABLE });

/** Svaret fra et PDF-job: fejlsiden (404) som på HTML-siden, ellers PDF'en. */
async function sendJob(res: Response, renderer: PdfRenderer, html: () => Promise<string>, result: JobResult, label: string): Promise<void> {
  if (!result.ok) return failPage(res, await html(), result.status, result.error);
  await sendPdf(res, renderer, result.job, label);
}

export function pdfRoutes({ config, provider, store, pdf }: PdfDeps): Router {
  const router = Router();
  // MCP-appen henter PDF'en fra sin egen sandkasse (anden origin); linket er selv adgangen, og
  // filnavnet står i Content-Disposition.
  const allowFetch = cors({ methods: ["GET"], exposedHeaders: ["Content-Disposition"] });

  router.get("/print/:token", printPageHandler(loadViewHtml));

  router.get("/k/:cvr.pdf", allowFetch, async (req, res) => {
    const check = verifyCompanyLink(config, String(req.params.cvr), req.query as Record<string, unknown>);
    if (!check.ok) {
      const f = linkFailure(check.reason, ASK_AGAIN("virksomheden"));
      return failPage(res, await loadViewHtml(), f.status, f.message);
    }
    if (!pdf.available) return unavailable(res);
    const lassoId = toLassoId(check.link.cvr, config.LASSO_COMPANY_ID_PREFIX);
    await sendJob(res, pdf, loadViewHtml, await companyReportJob(provider, lassoId, { credit: check.link.focus === "risiko" }), `company ${lassoId}`);
  });

  router.get("/p/:id.pdf", allowFetch, async (req, res) => {
    const check = verifyPersonLink(config, String(req.params.id), req.query as Record<string, unknown>);
    if (!check.ok) {
      const f = linkFailure(check.reason, ASK_AGAIN("personen"));
      return failPage(res, await loadViewHtml(), f.status, f.message);
    }
    if (!pdf.available) return unavailable(res);
    await sendJob(res, pdf, loadViewHtml, await personPageJob(provider, check.lassoId, check.focus), `person ${check.lassoId}`);
  });

  router.get("/e/:lassoId.pdf", allowFetch, async (req, res) => {
    const check = verifyEntityLink(config, String(req.params.lassoId), req.query as Record<string, unknown>);
    if (!check.ok) {
      const f = linkFailure(check.reason, FROM_LIST);
      return failPage(res, await loadViewHtml(), f.status, f.message);
    }
    if (!pdf.available) return unavailable(res);
    if (pageKindOf(check.lassoId) === "company") {
      const result = await companyReportJob(provider, check.lassoId, { credit: check.focus === "risiko" });
      return sendJob(res, pdf, loadViewHtml, result, `company ${check.lassoId}`);
    }
    const focus = isPersonFocus(check.focus) ? check.focus : "overblik";
    await sendJob(res, pdf, loadViewHtml, await personPageJob(provider, check.lassoId, focus), `person ${check.lassoId}`);
  });

  router.get("/v/:org/:slug.pdf", allowFetch, async (req, res) => {
    const view = await store.get(String(req.params.org), String(req.params.slug));
    if (!view) return failPage(res, await loadViewHtml(), 404, VIEW_MISSING);
    const parsed = viewSpecSchema.safeParse(view.spec);
    if (!parsed.success || (view.spec as { version?: number }).version !== 2) {
      return failPage(res, await loadViewHtml(), 410, VIEW_OUTDATED);
    }
    if (!pdf.available) return unavailable(res);
    const dataset = await resolveSpec(parsed.data, provider);
    await sendPdf(res, pdf, viewPageJob(parsed.data, dataset, view.name), `view ${view.org}/${view.slug}`);
  });

  router.get("/x/:token.pdf", allowFetch, async (req, res) => {
    if (!pdf.available) return unavailable(res);
    const job = pdfSnapshots.take(String(req.params.token));
    if (!job) return void res.status(404).json({ error: "PDF-linket er udløbet. Vis siden igen, og tryk på Gem som PDF." });
    await sendPdf(res, pdf, job, `page ${job.spec.kind}`);
  });

  return router;
}

/* --- Portalen: /api/portal/pdf/* bag requirePortal (session; GET kræver ingen CSRF-header) --- */

const oneOf = (name: string, values: readonly string[]) => `${name} skal være en af: ${values.join(", ")}.`;
const companyQuery = z.object({ focus: z.enum(FOCUSES, { error: oneOf("focus", FOCUSES) }).optional() });
const personQuery = z.object({ focus: z.enum(PERSON_FOCUSES, { error: oneOf("focus", PERSON_FOCUSES) }).optional() });
const specBody = z.object({ spec: z.unknown().optional() }, { error: "Body skal være et JSON-objekt." });

function parsed<T>(schema: z.ZodType<T>, input: unknown, res: Response): T | undefined {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  res.status(400).json({ error: [...new Set(r.error.issues.map((i) => i.message))].join(" ") });
  return undefined;
}

/** Som sendJob, men med portalens JSON-fejl ({ error }) i stedet for en fejlside. */
async function sendPortalJob(res: Response, renderer: PdfRenderer, result: JobResult, label: string): Promise<void> {
  if (!result.ok) return void res.status(result.status).json({ error: result.error });
  await sendPdf(res, renderer, result.job, label);
}

export function portalPdfRoutes({ config, provider, store, pages, pdf }: PortalPdfDeps): Router {
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  // Virksomhedsfanen: rapporten (samme data som fanen; Creditsafe kun fra fanen Risiko).
  router.get("/company/:id", async (req, res) => {
    const q = parsed(companyQuery, req.query, res);
    if (!q) return;
    const lassoId = toLassoId(String(req.params.id), config.LASSO_COMPANY_ID_PREFIX);
    if (!/^CVR-1-\d{8}$/.test(lassoId)) return void res.status(400).json({ error: "Angiv virksomhedens Lasso-ID (CVR-1-…) eller CVR-nummer." });
    if (!pdf.available) return unavailable(res);
    const focus: Focus = q.focus ?? "overblik";
    await sendPortalJob(res, pdf, await companyReportJob(provider, lassoId, { credit: focus === "risiko" }), `company ${lassoId}`);
  });

  // Personfanen: siden med samme fokus i print-tilstand.
  router.get("/person/:id", async (req, res) => {
    const q = parsed(personQuery, req.query, res);
    if (!q) return;
    const lassoId = String(req.params.id);
    if (!isPersonId(lassoId)) return void res.status(400).json({ error: "Angiv personens Lasso-ID (CVR-3-…)." });
    if (!pdf.available) return unavailable(res);
    const focus: PersonFocus = q.focus ?? "overblik";
    await sendPortalJob(res, pdf, await personPageJob(provider, lassoId, focus), `person ${lassoId}`);
  });

  // Søgning og gemte sider: den viste spec (som POST /resolve), friske data, siden i print-tilstand.
  router.post("/spec", async (req, res) => {
    const body = parsed(specBody, req.body ?? {}, res);
    if (!body) return;
    if (!pdf.available) return unavailable(res);
    const r = await resolveView({ config, provider, store, pages, user: res.locals.user as CurrentUser }, body.spec);
    if ("error" in r) return void res.status(r.status).json({ error: r.error });
    await sendPdf(res, pdf, viewPageJob(r.spec, r.dataset), `page ${r.spec.kind}`);
  });

  return router;
}
