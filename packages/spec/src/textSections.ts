import type { TextSectionItem } from "./models.js";

/**
 * Tekstsektionerne har to kilder: CVR (branche, formål, tegningsregler) og Lassos
 * regnskabsanalyse (ét afsnit pr. felt, se adaptReportAnalysisSections). Hvilke afsnit et
 * element viser, afgøres her, så komponenten, komponisten (vægt og placering) og tekstkortet
 * altid er enige:
 * - "profil" (overblik): formål og tegningsregler fra CVR plus analysens tre korte afsnit
 *   (konklusion, resultat, likviditet). Branche står i hovedet og gentages ikke.
 * - "analyse" (oekonomi): hele regnskabsanalysen, alle afsnit, ingen CVR-tekster.
 */
export const TEXT_SECTIONS_VARIANTS = ["profil", "analyse"] as const;
export type TextSectionsVariant = (typeof TEXT_SECTIONS_VARIANTS)[number];

/** Analysens afsnit med de overskrifter, adapteren giver dem, i den bekræftede rækkefølge. */
export const ANALYSIS_HEADINGS = [
  "Regnskabsanalyse: konklusion",
  "Resultat",
  "Likviditet",
  "Balance og kapitalforhold",
  "Branchestatistik",
  "Revisoroplysninger",
  "Spørgsmål til overvejelse",
] as const;

/**
 * De afsnit af analysen, profilen på overblik viser. "Regnskabsanalyse" er hele analysen som
 * ét afsnit (svar uden `sections`); den er selv konklusionen og står derfor også i profilen.
 */
const PROFILE_ANALYSIS: ReadonlySet<string> = new Set(["Regnskabsanalyse: konklusion", "Regnskabsanalyse", "Resultat", "Likviditet"]);

/** Kilden i analysens kildelinje, når afsnittet ikke selv har en. */
export const ANALYSIS_SOURCE = "Lasso regnskabsanalyse";

/** Afsnittet kommer fra Lassos regnskabsanalyse (overskrift eller kildenote), ikke fra CVR. */
export function isAnalysisSection(s: Pick<TextSectionItem, "heading" | "note">): boolean {
  return /^Regnskabsanalyse/i.test(s.heading) || (ANALYSIS_HEADINGS as readonly string[]).includes(s.heading) || /Lasso regnskabsanalyse/i.test(s.note ?? "");
}

/** Branche står i hovedets CVR-linje og vises ikke som eget afsnit. */
function isIndustry(s: Pick<TextSectionItem, "heading">): boolean {
  return /^branche$/i.test(s.heading.trim());
}

/** De afsnit, et element med den givne variant viser, i kildens rækkefølge. Uden variant: "profil". */
export function textSectionsFor(sections: readonly TextSectionItem[], variant: TextSectionsVariant = "profil"): TextSectionItem[] {
  if (variant === "analyse") return sections.filter(isAnalysisSection);
  return sections.filter((s) => !isIndustry(s) && (!isAnalysisSection(s) || PROFILE_ANALYSIS.has(s.heading)));
}

/** Kildelinjens tekst for analysen: afsnittets egen note uden "Kilde: " (fx med dato), ellers standardkilden. */
export function analysisSource(sections: readonly TextSectionItem[]): string {
  const note = sections.find((s) => isAnalysisSection(s) && s.note)?.note;
  return note ? note.replace(/^Kilde:\s*/i, "").trim() || ANALYSIS_SOURCE : ANALYSIS_SOURCE;
}
