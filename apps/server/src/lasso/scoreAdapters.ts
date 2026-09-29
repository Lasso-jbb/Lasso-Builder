import type { CreditAssessment, CreditRatingVM, ScoreHistoryVM, ScorePointVM, ScoreVM } from "@lasso/spec";
import { formatAmount, currencyUnit } from "@lasso/spec";
import type { ScorePointInput, StoredScorePoint } from "../scores/store.js";

/**
 * C1 (docs/plan-c1-c2-score.md): score og scorehistorik afledes udelukkende af kreditvurderingen
 * (Creditsafe via Lasso), aldrig af et kald for scorens skyld. Ingen funktion her henter noget.
 *
 * FORBEHOLD: Creditsafe-svarets form er taget fra docs.lassox.com og endnu ikke set mod et rigtigt svar
 * (creditAdapters.ts). Skalaen `100 - localScore` verificeres mod ét rigtigt svar på staging, før prod (E1).
 * Er `localScore` allerede en risikoskala (høj = høj risiko), vendes fortegnet ét sted: `toLassoScore`.
 */

export const SCORE_SOURCE = "Creditsafe via Lasso";
export const SCORE_LOCKED_REASON = "Kræver Creditsafe-abonnement. Score og kreditvurdering vises, når Creditsafe er tilføjet Lasso-abonnementet.";
export const SCORE_NONE_REASON = "Creditsafe har ingen score for virksomheden.";
export const SCORE_HISTORY_BUILDING_REASON = "Historikken bygges op, hver gang kreditvurderingen hentes.";

const INTL_SCORE: Record<string, number> = { A: 10, B: 30, C: 50, D: 70, E: 90 };

/** Creditsafes lokale score (1–100) -> Lassos skala (0 = lav risiko, 100 = høj risiko). Det ene sted, fortegnet vendes. */
export function toLassoScore(localScore: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - localScore)));
}

/** Score og bogstav for én vurdering; null uden begge dele. */
export function assessmentScore(a: CreditAssessment | undefined): { score: number; label?: string } | null {
  if (!a) return null;
  if (typeof a.localScore === "number" && Number.isFinite(a.localScore)) {
    return { score: toLassoScore(a.localScore), ...(a.internationalScore ? { label: `Creditsafe ${a.internationalScore}` } : {}) };
  }
  if (a.internationalScore && a.internationalScore in INTL_SCORE) {
    return { score: INTL_SCORE[a.internationalScore]!, label: `Creditsafe ${a.internationalScore}` };
  }
  return null;
}

/** "Creditsafe-rating B, lokal score 62/100, kreditmaksimum 250 t. kr." – kun de felter, der findes. */
function basisOf(a: CreditAssessment): string | undefined {
  const parts = [
    a.internationalScore ? `Creditsafe-rating ${a.internationalScore}` : null,
    typeof a.localScore === "number" ? `lokal score ${a.localScore}/100` : null,
    typeof a.creditMax === "number" ? `kreditmaksimum ${formatAmount(a.creditMax, currencyUnit(a.creditCurrency))}` : null,
  ].filter((x): x is string => x !== null);
  return parts.length ? parts.join(", ") : undefined;
}

/** Ratingens egen dato, hvis den findes (`date` på vurderingen), ellers opslagets dato. */
function dateOf(a: CreditAssessment | undefined): string | undefined {
  const d = (a as { date?: unknown } | undefined)?.date;
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : undefined;
}

/** Tabellen i C1: én af de seks tilstande. Kaster aldrig. */
export function scoreFromCredit(lassoId: string, rating: CreditRatingVM, checkedAt: string = new Date().toISOString().slice(0, 10)): ScoreVM {
  if (rating.state === "locked") return { lassoId, score: null, state: "unavailable", reason: SCORE_LOCKED_REASON };
  if (rating.state === "unavailable") return { lassoId, score: null, state: "unavailable", reason: rating.reason ?? SCORE_NONE_REASON };
  if (rating.state === "error") {
    return { lassoId, score: null, state: "unavailable", reason: `Kreditvurderingen kunne ikke hentes (${rating.reason ?? "ukendt fejl"})` };
  }
  const s = assessmentScore(rating.current);
  if (!s) return { lassoId, score: null, state: "unavailable", reason: SCORE_NONE_REASON };
  const basis = rating.current ? basisOf(rating.current) : undefined;
  return {
    lassoId,
    score: s.score,
    state: "ok",
    source: SCORE_SOURCE,
    updated: dateOf(rating.current) ?? rating.updated ?? checkedAt,
    ...(basis ? { basis } : {}),
    // ScoreVM har intet `label`-felt (spec: "Creditsafe {bogstav}"); bogstavet vises som fakta-linje, når
    // scoren kommer fra bogstavet alene (ingen lokal score). Eskaleret i C3-rapporten.
    ...(typeof rating.current?.localScore !== "number" && rating.current?.internationalScore
      ? { facts: [{ label: "International score", value: `Creditsafe ${rating.current.internationalScore}` }] }
      : {}),
  };
}

/** Punkterne, ét opslag giver: nuværende (og forrige, når dens dato kendes). Tom uden score. */
export function pointsFromCredit(lassoId: string, rating: CreditRatingVM, checkedAt: string = new Date().toISOString().slice(0, 10)): ScorePointInput[] {
  if (rating.state !== "ok") return [];
  const out: ScorePointInput[] = [];
  for (const [a, fallback] of [[rating.current, rating.updated ?? checkedAt], [rating.previous, undefined]] as const) {
    const s = assessmentScore(a);
    const observedAt = dateOf(a) ?? fallback;
    if (!a || !s || !observedAt) continue;
    out.push({
      lassoId,
      observedAt,
      score: s.score,
      ...(typeof a.localScore === "number" ? { localScore: a.localScore } : {}),
      ...(a.internationalScore ? { intlScore: a.internationalScore } : {}),
      ...(typeof a.creditMax === "number" ? { creditMax: a.creditMax } : {}),
      ...(a.creditCurrency ? { currency: a.creditCurrency } : {}),
    });
  }
  return out;
}

/** Slår gemte og friske punkter sammen (én pr. dato+score), stigende efter dato. */
export function mergePoints(stored: readonly StoredScorePoint[], fresh: readonly ScorePointInput[]): ScorePointVM[] {
  const byKey = new Map<string, ScorePointVM>();
  const add = (observedAt: string, score: number, intl: string | undefined) => {
    const date = observedAt.slice(0, 10);
    byKey.set(`${date}|${score}`, { date, score, ...(intl ? { label: `Creditsafe ${intl}` } : {}) });
  };
  for (const p of stored) add(p.observedAt, p.score, p.intlScore);
  for (const p of fresh) add(p.observedAt, p.score, p.intlScore);
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Historikken for én virksomhed ud fra ratingen og det, lageret allerede ved. */
export function historyFromCredit(lassoId: string, rating: CreditRatingVM, stored: readonly StoredScorePoint[], checkedAt?: string): ScoreHistoryVM {
  if (rating.state === "locked") return { lassoId, points: [], reason: SCORE_LOCKED_REASON };
  if (rating.state !== "ok") {
    const reason = rating.state === "error" ? `Kreditvurderingen kunne ikke hentes (${rating.reason ?? "ukendt fejl"})` : (rating.reason ?? SCORE_NONE_REASON);
    return { lassoId, points: [], reason };
  }
  const points = mergePoints(stored, pointsFromCredit(lassoId, rating, checkedAt));
  if (points.length === 0) return { lassoId, points: [], reason: SCORE_NONE_REASON };
  return {
    lassoId,
    points,
    source: SCORE_SOURCE,
    ...(rating.updated ? { updated: rating.updated } : {}),
    ...(points.length < 2 ? { reason: SCORE_HISTORY_BUILDING_REASON } : {}),
  };
}
