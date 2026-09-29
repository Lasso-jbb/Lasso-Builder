import {
  composePerson,
  composePersonProbe,
  isPersonId,
  parseViewSpec,
  type Dataset,
  type PersonFocus,
  type ViewComponent,
  type ViewSpec,
} from "@lasso/spec";
import type { DataProvider } from "../data/provider.js";
import { resolveSpec } from "../data/resolve.js";
import type { PrintJob } from "./printPages.js";

/**
 * Hvad der står i PDF'en: virksomheder som rapport (ReportA4, katalog 27), alt andet som selve
 * visningen i print-tilstand. Data hentes friskt som til HTML-siderne; kun rapporten henter mere,
 * end fokus viser, fordi den altid har de samme fire sider.
 */

export type JobResult = { ok: true; job: PrintJob } | { ok: false; status: 404; error: string };

/**
 * Alt, rapporten bruger: stamdata, regnskab (5 år og fuldt regnskab), ledelse, ejere, reelle ejere,
 * score og revisor. Creditsafe kun med `credit` (fokus risiko): et opslag kan koste en kredit og tage
 * op til 45 s, så rapporten henter det kun, hvor siden selv har vist det.
 */
export function reportSpec(lassoId: string, opts: { credit?: boolean } = {}): ViewSpec {
  const c = lassoId;
  const components: ViewComponent[] = [
    { type: "LassoCompanyHead", company: c },
    { type: "LassoMultiYearTable", company: c, years: 5 },
    { type: "LassoIncomeStatement", company: c, years: 3 },
    { type: "LassoPersonList", company: c, show: "current" },
    { type: "LassoOwnerList", company: c },
    { type: "LassoBeneficialOwners", company: c },
    { type: "LassoScoreGauge", company: c },
    ...(opts.credit ? [{ type: "LassoCreditRating", company: c } as ViewComponent] : []),
    { type: "LassoAuditorIndependence", company: c },
  ];
  return parseViewSpec({ kind: "company", title: "Virksomhedsrapport", components });
}

/** Virksomhedsrapporten for én virksomhed (CVR-1-…). 404, når virksomheden ikke kan hentes. */
export async function companyReportJob(provider: DataProvider, lassoId: string, opts: { credit?: boolean } = {}): Promise<JobResult> {
  const spec = reportSpec(lassoId, opts);
  const dataset = await resolveSpec(spec, provider);
  const name = dataset.companies[lassoId]?.name;
  if (!name) return { ok: false, status: 404, error: `Virksomheden kunne ikke hentes: ${dataset.errors[`company:${lassoId}`] ?? "ukendt fejl"}` };
  return { ok: true, job: { kind: "report", spec, dataset, name, generatedAt: dataset.generatedAt } };
}

/** Personsiden med fokus, komponeret som /p/ (uden opfølgninger). 404, når personen ikke kan hentes. */
export async function personPageJob(provider: DataProvider, lassoId: string, focus: PersonFocus = "overblik"): Promise<JobResult> {
  const dataset = await resolveSpec(composePersonProbe(lassoId, focus), provider);
  const person = dataset.persons[lassoId];
  if (!person) return { ok: false, status: 404, error: `Personen kunne ikke hentes: ${dataset.errors[`person:${lassoId}`] ?? "ukendt fejl"}` };
  const spec = composePerson(lassoId, dataset, { focus, name: person.name, followUps: false });
  return { ok: true, job: { kind: "page", spec, dataset, name: person.name, generatedAt: dataset.generatedAt } };
}

/** En visning, der allerede har data (gemt visning, liste, render_view): selve siden. */
export function viewPageJob(spec: ViewSpec, dataset: Dataset, name?: string | null): PrintJob {
  return { kind: "page", spec, dataset, name: (name ?? spec.title) || "Lasso", generatedAt: dataset.generatedAt };
}

/** Sidens virksomhed eller person: første `company` på en virksomhedsside, første `person` på en personside. */
export function entityOfSpec(spec: ViewSpec): { kind: "company" | "person"; lassoId: string } | null {
  if (spec.kind !== "company" && spec.kind !== "person") return null;
  const key = spec.kind;
  const id = spec.components.map((c) => (key in c ? (c as Record<string, unknown>)[key] : undefined)).find((v): v is string => typeof v === "string");
  if (!id) return null;
  if (key === "person" && !isPersonId(id)) return null;
  return { kind: key, lassoId: id };
}

/* --- Filnavn og Content-Disposition --------------------------------------------------------- */

/** ÅÅÅÅ-MM-DD i dansk tid. */
export function isoDate(iso: string): string {
  const d = new Date(iso);
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Bogstaver, tal, mellemrum, bindestreg og punktum står; alt andet bliver "-". */
export function safeFilePart(text: string): string {
  return text
    .replace(/[^\p{L}\p{N} .-]/gu, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
}

/** "Virksomhedsrapport <navn> <ÅÅÅÅ-MM-DD>.pdf" eller "<sidens titel> <ÅÅÅÅ-MM-DD>.pdf". */
export function pdfFilename(job: Pick<PrintJob, "kind" | "name" | "generatedAt">): string {
  const base = job.kind === "report" ? `Virksomhedsrapport ${job.name}` : job.name;
  return `${safeFilePart(base) || "Lasso"} ${isoDate(job.generatedAt)}.pdf`;
}

/** attachment med ASCII-navn til gamle klienter og det rigtige navn i filename* (RFC 6266/5987). */
export function contentDisposition(filename: string): string {
  const ascii = filename
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "Ae")
    .replace(/ø/g, "oe")
    .replace(/Ø/g, "Oe")
    .replace(/å/g, "aa")
    .replace(/Å/g, "Aa")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .-]/g, "-");
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
