import {
  CREDIT_LOCKED_REASON,
  CREDIT_PENDING_REASON,
  CREDIT_SOURCE,
  cvrFromLassoId,
  toCreditScore,
  type CreditAssessment,
  type CreditRatingVM,
} from "@lasso/spec";
import { at, dateStr, isObj, num, pick, str, type Json } from "./adapters.js";
import { LassoApiError } from "./client.js";

/**
 * Katalog 17: Creditsafe via Lasso (GET /data/creditsafe/rating/{cvr}). Formen er taget fra
 * docs.lassox.com og er endnu ikke set mod et rigtigt svar; se docs/endpoints-creditsafe.md.
 * Alle felter er valgfrie, og feltnavne slås op uden hensyn til store/små bogstaver (at()).
 *
 *   { current: { creditMax, creditCurrency, internationalScore, internationalDescription, localScore, localDescription },
 *     previous: { …samme felter… }, latestChange, pdfUrl }
 */

/** Creditsafe har ingen vurdering (404 eller tomt svar). */
export const CREDIT_NONE_REASON = "Creditsafe har ingen vurdering af virksomheden endnu.";
const NO_CVR_REASON = "Kreditvurderingen kræver et CVR-nummer.";

/** Et tal, null når feltet findes men er tomt (Creditsafe anbefaler ingen kredit), ellers undefined. */
function numOrNull(raw: Json, ...paths: string[]): number | null | undefined {
  const n = num(raw, ...paths);
  if (n !== undefined) return n;
  return paths.some((p) => at(raw, p) === null) ? null : undefined;
}

/** Kun http(s)-links; alt andet (javascript:, relative stier) droppes. */
function safeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

function assessment(raw: Json): CreditAssessment | undefined {
  if (!isObj(raw)) return undefined;
  const a: CreditAssessment = {
    creditMax: numOrNull(raw, "creditMax", "creditLimit"),
    creditCurrency: str(raw, "creditCurrency", "currency"),
    internationalScore: toCreditScore(str(raw, "internationalScore", "internationalRating")),
    internationalDescription: str(raw, "internationalDescription"),
    localScore: numOrNull(raw, "localScore", "localRating"),
    localDescription: str(raw, "localDescription"),
  };
  const filled = Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)) as CreditAssessment;
  // En vurdering uden bogstav, tal og kreditmaksimum er tom, også hvis der står en valuta.
  const meaningful = filled.internationalScore !== undefined || typeof filled.localScore === "number" || filled.creditMax !== undefined;
  return meaningful ? filled : undefined;
}

export function adaptCreditRating(lassoId: string, raw: Json, now: Date = new Date()): CreditRatingVM {
  const cvr = cvrFromLassoId(lassoId) ?? undefined;
  const base = { lassoId, ...(cvr ? { cvr } : {}), source: CREDIT_SOURCE };
  const current = assessment(pick(raw, "current"));
  const previous = assessment(pick(raw, "previous"));
  if (!current && !previous) return { ...base, state: "unavailable", reason: CREDIT_NONE_REASON };
  const latestChange = dateStr(raw, "latestChange", "lastChange", "latestChangeDate");
  const pdfUrl = safeUrl(str(raw, "pdfUrl", "pdfLink", "reportUrl"));
  // Hvornår Creditsafe beregnede vurderingen, hvis Lasso sender det; ellers tidspunktet for opslaget.
  const updated = dateStr(raw, "updated", "lastUpdated", "createdAt", "cachedAt", "timestamp") ?? now.toISOString().slice(0, 10);
  const cachedUntil = str(raw, "cachedUntil", "cacheExpires", "expires");
  return {
    ...base,
    state: "ok",
    ...(current ? { current } : {}),
    ...(previous ? { previous } : {}),
    ...(latestChange ? { latestChange } : {}),
    ...(pdfUrl ? { pdfUrl } : {}),
    updated,
    ...(cachedUntil ? { cachedUntil } : {}),
  };
}

/** Lassos fejltekst ({ errorMessage }) som tillæg, hvis den findes. */
function detail(err: LassoApiError): string {
  const body = err.body as { errorMessage?: unknown } | null;
  return body && typeof body === "object" && typeof body.errorMessage === "string" ? `: ${body.errorMessage}` : "";
}

/**
 * Fejl fra Creditsafe-kaldet som tilstand, ikke undtagelse: 401/403 = låst (tilkøb mangler),
 * 404 = ikke beregnet, timeout = Creditsafe beregner stadig, alt andet = fejl.
 */
export function creditRatingFromError(lassoId: string, err: unknown): CreditRatingVM {
  const cvr = cvrFromLassoId(lassoId) ?? undefined;
  const base = { lassoId, ...(cvr ? { cvr } : {}), source: CREDIT_SOURCE };
  if (err instanceof LassoApiError) {
    if (err.status === 401 || err.status === 403) return { ...base, state: "locked", reason: CREDIT_LOCKED_REASON };
    if (err.status === 404) return { ...base, state: "unavailable", reason: CREDIT_NONE_REASON };
    if (err.status === 429) return { ...base, state: "error", reason: "Lasso API: for mange kald, prøv igen om lidt" };
    return { ...base, state: "error", reason: `Lasso API-fejl (${err.status})${detail(err)}` };
  }
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return { ...base, state: "unavailable", reason: CREDIT_PENDING_REASON };
  }
  if (err instanceof TypeError && /fetch failed/i.test(err.message)) return { ...base, state: "error", reason: "Kunne ikke nå Lasso API" };
  return { ...base, state: "error", reason: err instanceof Error ? err.message : String(err) };
}

/**
 * Henter og oversætter kreditvurderingen for et Lasso-ID. `fetch` får CVR-nummeret og kalder
 * LassoClient.creditsafeRating uden skipCache, så Lassos 24-timers cache altid bruges.
 */
export async function loadCreditRating(lassoId: string, fetch: (cvr: string) => Promise<Json>, now: Date = new Date()): Promise<CreditRatingVM> {
  const cvr = cvrFromLassoId(lassoId);
  if (!cvr) return { lassoId, state: "unavailable", reason: NO_CVR_REASON, source: CREDIT_SOURCE };
  try {
    return adaptCreditRating(lassoId, await fetch(cvr), now);
  } catch (err) {
    return creditRatingFromError(lassoId, err);
  }
}
