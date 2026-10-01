import { currencyUnit, formatAmount, formatDate, formatNumber } from "./format.js";
import { CREDIT_SCORES, type CreditAssessment, type CreditRatingVM, type CreditScore } from "./models.js";

/**
 * Kreditvurdering fra Creditsafe (katalog 17, datatyper del B afsnit 5). Egen skala: international
 * score A (meget lav risiko) til E (meget høj risiko) plus en lokal talscore. Den blandes aldrig
 * med Lassos 0–100-score (LassoScoreGauge) eller observationernes 0/25/50/100 (LassoRiskObservations).
 */

export type CreditTone = "ok" | "warning" | "danger";

/** Tone til ikon og ord (regel 7: aldrig kun farve): A–B ok, C warning, D–E danger. */
export function creditTone(score: CreditScore): CreditTone {
  if (score === "A" || score === "B") return "ok";
  if (score === "C") return "warning";
  return "danger";
}

/** Vores ord pr. bogstav, når Creditsafe ingen beskrivelse sender. */
export const CREDIT_SCORE_WORDS: Record<CreditScore, string> = {
  A: "Meget lav risiko",
  B: "Lav risiko",
  C: "Moderat risiko",
  D: "Høj risiko",
  E: "Meget høj risiko",
};

/** Creditsafes engelske risikoord på dansk. Ukendte tekster vises, som Creditsafe sender dem. */
const DESCRIPTION_DA: readonly [RegExp, string][] = [
  [/^very\s+low(\s+risk)?$/i, "Meget lav risiko"],
  [/^low(\s+risk)?$/i, "Lav risiko"],
  [/^(moderate|medium)(\s+risk)?$/i, "Moderat risiko"],
  [/^very\s+high(\s+risk)?$/i, "Meget høj risiko"],
  [/^high(\s+risk)?$/i, "Høj risiko"],
  [/^not\s+rated$/i, "Ikke vurderet"],
];

/** "Low Risk" -> "Lav risiko"; en dansk eller ukendt tekst returneres uændret. */
export function creditDescription(text: string | undefined): string | undefined {
  const t = text?.trim();
  if (!t) return undefined;
  return DESCRIPTION_DA.find(([re]) => re.test(t))?.[1] ?? t;
}

/** Ordet ved bogstavet: Creditsafes beskrivelse, når den findes (på dansk, når den er kendt), ellers vores. */
export function creditScoreWord(score: CreditScore, description?: string): string {
  return creditDescription(description) ?? CREDIT_SCORE_WORDS[score];
}

/** Bogstavet, hvis værdien er et af A–E (store eller små bogstaver). */
export function toCreditScore(value: unknown): CreditScore | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim().toUpperCase();
  return (CREDIT_SCORES as readonly string[]).includes(s) ? (s as CreditScore) : undefined;
}

export interface CreditChange {
  /** Risikoen er faldet (bedre), steget (dårligere) eller uændret. */
  direction: "better" | "worse" | "same";
  /** Risikoskalaen: stigning = mere risiko = ▲ (datatyper del A), fald = ▼. */
  arrow: "▲" | "▼" | "";
  word: "bedre" | "dårligere" | "uændret";
}

/** Ændringen fra forrige til nuværende vurdering. null, når et af bogstaverne mangler. */
export function creditChange(current: CreditScore | undefined, previous: CreditScore | undefined): CreditChange | null {
  if (!current || !previous) return null;
  const d = CREDIT_SCORES.indexOf(current) - CREDIT_SCORES.indexOf(previous);
  if (d === 0) return { direction: "same", arrow: "", word: "uændret" };
  return d < 0 ? { direction: "better", arrow: "▼", word: "bedre" } : { direction: "worse", arrow: "▲", word: "dårligere" };
}

/** Kreditmaksimum i Creditsafes valuta, fx "250 t. kr." eller "1,2 mio. EUR". */
export function formatCreditMax(a: CreditAssessment | undefined): string {
  return formatAmount(a?.creditMax ?? null, currencyUnit(a?.creditCurrency));
}

export const CREDIT_SOURCE = "Creditsafe via Lasso";
export const CREDIT_LOCKED_REASON = "Kræver Creditsafe-tilføjelse til Lasso-abonnementet";
/** Grunden, når Creditsafe ikke nåede at beregne inden for klientens timeout. UI'en tilbyder "Hent igen" ved den. */
export const CREDIT_PENDING_REASON = "Creditsafe beregner stadig, prøv igen om lidt";
/** Hvad man får for kreditten (købstrinnet, katalog 38). */
export const CREDIT_PURCHASE_INCLUDES = [
  "Kreditscore A–E",
  "Anbefalet kreditmaksimum",
  "Lokal score og risikovurdering",
  "Fuld kreditrapport som PDF",
] as const;
export const CREDIT_COST_NOTE = "Ny beregning hos Creditsafe koster en kredit og tager 5–45 sekunder; vurderingen gemmes 24 timer.";

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Én linje til tekstkortet og resuméet: "B, lav risiko, kreditmaksimum 250 t. kr., lokal score 62, forrige C".
 * Låst: "låst: kræver Creditsafe-tilføjelse". Nævner aldrig Lassos 0–100-score.
 */
export function creditRatingText(r: CreditRatingVM): string {
  if (r.state === "locked") return "låst: kræver Creditsafe-tilføjelse";
  if (r.state === "purchase") return "ikke købt endnu (koster en kredit pr. opslag)";
  if (r.state === "unavailable") return `ikke beregnet endnu${r.reason ? ` (${lower(r.reason)})` : ""}`;
  if (r.state === "error") return `kunne ikke hentes${r.reason ? ` (${r.reason})` : ""}`;
  const c = r.current;
  if (!c) return "ikke oplyst";
  const score = c.internationalScore;
  const parts = [
    score ? `${score}, ${lower(creditScoreWord(score, c.internationalDescription))}` : undefined,
    typeof c.creditMax === "number" ? `kreditmaksimum ${formatCreditMax(c)}` : undefined,
    typeof c.localScore === "number" ? `lokal score ${formatNumber(c.localScore)}` : undefined,
    r.previous?.internationalScore ? `forrige ${r.previous.internationalScore}` : undefined,
    r.latestChange ? `ændret ${formatDate(r.latestChange)}` : undefined,
  ].filter((p): p is string => Boolean(p));
  return parts.length ? parts.join(", ") : "ikke oplyst";
}
