import type { NewsItemVM, NewsVM, ObservationRowVM, ObservationsVM, Severity } from "@lasso/spec";
import { arr, at, dateStr, isObj, items, pick, str, type Json } from "./adapters.js";
import { plainTextFromMarkup, stripHtml } from "./newsMarkup.js";

/**
 * Risiko- og nyhedsadaptere, skrevet ud fra Lassos officielle dokumentation af de svarformer,
 * disse to moduler faktisk bruger (docs/endpoints-risiko-nyheder.md). De ældre, gættede
 * feltnavne (fra dengang formerne var ubekræftede) er bevaret som fallback EFTER de
 * dokumenterede felter, så et svar i en anden form stadig giver noget frem for at kaste.
 */

/* ------------------------------------------------------------------------------------------
 * Observationer (katalog 17). POST /modules/observations/{lassoId}, body
 * { observationTags: ["CompanyInsight"] } (portalens Firmaindsigt-modul). 120 kald/min.
 *
 * Dokumenteret svar:
 * { relatedLassoId, relatedCompanyName,
 *   observations: [{ title, type, tags[], shortDescription, description, outcome: 0|25|50|100,
 *                     notAvailable, errors, relatedLassoId, data? }],
 *   relatedObservations: { "<personLassoId>": [ ...samme form... ] } }
 * ------------------------------------------------------------------------------------------ */

/** `outcome` er allerede 0/25/50/100 og 1:1 med vores Severity-skala (0 grøn, 25/50 gul, 100 rød). */
function outcomeSeverity(v: Json): Severity | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : undefined;
  return n === 0 || n === 25 || n === 50 || n === 100 ? n : undefined;
}

/** Fallback, hvis `outcome` mangler: et tal 0-100 eller en tekst som "high"/"vigtig"/"info". */
function guessedSeverity(v: Json): Severity {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : undefined;
  if (typeof n === "number" && Number.isFinite(n)) {
    if (n >= 90) return 100;
    if (n >= 40) return 50;
    if (n >= 10) return 25;
    return 0;
  }
  const s = typeof v === "string" ? v.toLowerCase() : "";
  if (/high|vigtig|critical|important|konflikt|alert/.test(s)) return 100;
  if (/medium|mulig|warning|moderat/.test(s)) return 50;
  if (/low|info|minor|notice/.test(s)) return 25;
  return 0;
}

function firstOtherThan(title: string, ...candidates: (string | undefined)[]): string | undefined {
  for (const c of candidates) if (c && c !== title) return c;
  return undefined;
}

/**
 * Én observation, direkte eller under `relatedObservations` (samme form ifølge dokumentationen).
 * `title`/`shortDescription` er de dokumenterede titel-/beskrivelsesfelter; `type` gemmes råt
 * (fx "DirectBankruptcies"), og `notAvailable` markerer, at Lasso ikke kunne beregne observationen.
 */
function parseObservationRow(o: Json, idPrefix: string, index: number): ObservationRowVM | null {
  const title = str(o, "title") ?? str(o, "headline", "summary", "text", "message", "name", "description");
  if (!title) return null;
  const detail = firstOtherThan(title, str(o, "shortDescription"), str(o, "description"), str(o, "detail", "explanation", "body", "text"));
  const type = str(o, "type");
  const notAvailable = pick(o, "notAvailable") === true ? true : undefined;
  return {
    id: str(o, "id", "observationId", "uuid") ?? `${idPrefix}-${type ?? index}`,
    severity: outcomeSeverity(pick(o, "outcome")) ?? guessedSeverity(pick(o, "severity", "score", "riskScore", "level", "importance", "category")),
    title,
    detail,
    source: str(o, "source", "category", "origin", "basedOn", "module"),
    date: dateStr(o, "date", "observedAt", "createdAt", "eventDate", "occurredAt", "reportedAt"),
    type,
    notAvailable,
  };
}

/** Listen af observationer i ét svar: rent array, `{observations:[...]}`, eller en ældre pakke-nøgle. */
function parseObservationList(raw: Json, idPrefix: string): ObservationRowVM[] {
  const list = Array.isArray(raw) ? raw : arr(raw, "observations", "results", "items", "hits", "data", "records", "value");
  const rows: ObservationRowVM[] = [];
  let i = 0;
  for (const o of list) {
    const row = parseObservationRow(o, idPrefix, i);
    if (row) {
      rows.push(row);
      i++;
    }
  }
  return rows;
}

export function adaptObservations(lassoId: string, raw: Json): ObservationsVM {
  const observations = parseObservationList(raw, lassoId);

  // Indirekte observationer (fx DirectBankruptcies) måler egentlig en tilknyttet person og
  // gengives derfor separat, keyed på personens Lasso Id. Navnet kendes ikke her (adapteren
  // har kun det rå svar) og fyldes evt. ind af LiveProvider (apps/server/src/data/live.ts).
  const relatedRaw = pick(raw, "relatedObservations");
  const related: NonNullable<ObservationsVM["related"]> = [];
  if (isObj(relatedRaw)) {
    for (const [personLassoId, personRaw] of Object.entries(relatedRaw)) {
      const rows = parseObservationList(personRaw, personLassoId);
      if (rows.length) related.push({ lassoId: personLassoId, rows });
    }
  }

  return {
    lassoId,
    observations,
    related: related.length ? related : undefined,
    checkedAt: dateStr(raw, "checkedAt", "generatedAt", "lastChecked", "updatedAt", "meta.checkedAt", "meta.generatedAt"),
    sources: undefined,
  };
}

/* ------------------------------------------------------------------------------------------
 * Nyheder (katalog 12). To kilder: Lasso News (POST /modules/news) og Paqle
 * (GET /data/paqle/{lassoId}/news). LiveProvider.news (apps/server/src/data/live.ts) henter
 * begge og fletter dem med `mergeNews`.
 * ------------------------------------------------------------------------------------------ */

/** Nyhedstype -> dansk etiket (docs/endpoints-risiko-nyheder.md). */
const NEWS_TYPE_LABELS: Record<string, string> = {
  Account: "Nyt regnskab",
  Accountant: "Revisorskift",
  Ownership: "Ejerskifte",
  Board: "Bestyrelsesændring",
  Management: "Ledelsesændring",
  Information: "Stamdataændring",
  NewCompany: "Nystiftet",
  StatusChange: "Statusændring",
  Lifetime: "Start/ophør",
  Ritzau: "Pressemeddelelse",
  Statstidende: "Statstidende",
  Stakeholder: "Interessent",
};

export function newsTypeLabel(type: string | undefined): string | undefined {
  return type ? NEWS_TYPE_LABELS[type] : undefined;
}

/**
 * Lasso News' `provider` er den bagvedliggende datakilde (fx "VIRK" for de CVR-udledte
 * hændelser), ikke en læservendt kilde. Ritzau og Statstidende er selv navngivne udgivere og
 * vises som dem selv; alt andet (typisk VIRK) vises som "Lasso".
 */
function lassoNewsSourceLabel(provider: string | undefined): string {
  if (provider === "Ritzau" || provider === "Statstidende") return provider;
  return "Lasso";
}

/**
 * Lasso News (POST /modules/news). Dokumenteret svar: array af { headline, content (HTML),
 * tagLine, time, promotedUntil, type, provider, url, lassoIds[] }. headline/content/tagLine
 * indeholder entitets-markup "{Navn|LassoId}" (newsMarkup.ts); content strippes for HTML til
 * ren tekst — UI'en sætter aldrig innerHTML.
 */
export function adaptLassoNews(raw: Json): NewsItemVM[] {
  const list = Array.isArray(raw) ? raw : items(raw);
  const out: NewsItemVM[] = [];
  for (const n of list) {
    const headline = plainTextFromMarkup(str(n, "headline"));
    if (!headline) continue;
    const tagLine = plainTextFromMarkup(str(n, "tagLine"));
    const content = plainTextFromMarkup(stripHtml(str(n, "content")));
    out.push({
      source: lassoNewsSourceLabel(str(n, "provider")),
      url: str(n, "url", "link"),
      time: dateStr(n, "time", "promotedUntil"),
      headline,
      excerpt: tagLine ?? content,
      typeLabel: newsTypeLabel(str(n, "type")),
    });
  }
  return out;
}

/**
 * Et Paqle-tekstsegment: `{text, highlight}`. Bruges til at fremhæve firmanavnet (regel 17).
 * `text` læses råt (uden trim), da mellemrummet mellem segmenterne er en del af sætningen.
 */
function parseSegments(v: Json): { text: string; highlight?: boolean }[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const segments = v
    .map((s) => {
      const raw = at(s, "text");
      const text = typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
      return { text, highlight: pick(s, "highlight") === true ? true : undefined };
    })
    .filter((s) => s.text !== "");
  return segments.length ? segments : undefined;
}

function plainFromSegments(segments: { text: string }[] | undefined): string | undefined {
  if (!segments?.length) return undefined;
  return segments
    .map((s) => s.text)
    .join("")
    .trim() || undefined;
}

/**
 * Paqle (GET /data/paqle/{lassoId}/news): { news: [...], continuationToken }. `providerData`
 * har `sourceName` (kilden), `published` og `headline`/`extract` som lister af tekstsegmenter
 * med `highlight:true/false`, der fremhæver firmanavnet. Ét storyId/clusterHash er ÉN nyhed
 * (kataloget forbyder at samle flere kilder til "+N kilder"), så hvert element i `news` bliver
 * netop én NewsItemVM.
 */
export function adaptNews(lassoId: string, raw: Json, limit: number): NewsVM {
  const list = arr(raw, "news").length ? arr(raw, "news") : items(raw);
  const newsItems = list
    .map((n): NewsItemVM | null => {
      const headlineSegments = parseSegments(at(n, "providerData.headline"));
      const extractSegments = parseSegments(at(n, "providerData.extract"));
      const headline = str(n, "headline") ?? plainFromSegments(headlineSegments);
      if (!headline) return null;
      return {
        source: str(n, "providerData.sourceName", "provider", "source") ?? "Ukendt kilde",
        url: str(n, "url", "link"),
        time: dateStr(n, "time", "providerData.published", "publishedAt"),
        headline,
        excerpt: str(n, "content", "excerpt") ?? plainFromSegments(extractSegments),
        language: str(n, "language", "lang"),
        headlineSegments,
        extractSegments,
      };
    })
    .filter((n): n is NewsItemVM => n !== null)
    .slice(0, limit);
  return { lassoId, items: newsItems };
}

export interface NewsSourceInput {
  items: readonly NewsItemVM[];
  /** Etiket til sektionens kildelinje (regel 8), fx "Lasso News" eller "Paqle". */
  label: string;
}

/**
 * Fletter flere nyhedskilder efter tid (nyeste først) og skærer til `limit`. Poster uden
 * tidsstempel havner sidst, i den rækkefølge kilden leverede dem (stabil sortering). Kildelinjen
 * nævner kun de kilder, der faktisk bidrog med mindst én nyhed; `updatedAt` er den nyeste post
 * på tværs af kilder.
 */
export function mergeNews(lassoId: string, sources: readonly NewsSourceInput[], limit: number): NewsVM {
  const contributing = sources.filter((s) => s.items.length > 0).map((s) => s.label);
  const withTime = sources.flatMap((s) => s.items.map((item) => ({ item, t: item.time ? Date.parse(item.time) : NaN })));
  const items = withTime
    .map((x, i) => ({ ...x, i }))
    .sort((a, b) => {
      if (Number.isNaN(a.t) && Number.isNaN(b.t)) return a.i - b.i;
      if (Number.isNaN(a.t)) return 1;
      if (Number.isNaN(b.t)) return -1;
      return b.t - a.t || a.i - b.i;
    })
    .slice(0, Math.max(0, limit))
    .map((x) => x.item);
  const updatedAt = items
    .map((i) => i.time)
    .filter((t): t is string => !!t && !Number.isNaN(Date.parse(t)))
    .sort()
    .at(-1);
  return { lassoId, items, sources: contributing.length ? contributing : undefined, updatedAt };
}
