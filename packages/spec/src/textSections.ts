import type { TextSectionItem } from "./models.js";

/**
 * Tekstsektionerne har to kilder: CVR (branche, formål, tegningsregler) og Lassos
 * regnskabsanalyse (ét afsnit pr. felt, se adaptReportAnalysisSections). Hvilke afsnit et
 * element viser, afgøres her, så komponenten, komponisten (vægt og placering) og tekstkortet
 * altid er enige:
 * - "profil" (overblik): formål og tegningsregler fra CVR plus analysens korte afsnit
 *   (konklusion, resultat). Branchen står i LassoKeyValueList og gentages ikke.
 * Likviditet og Spørgsmål til overvejelse vises aldrig (Jakob 03.10): Likviditet bærer en uformateret tabel, og
 * spørgsmålene er ikke analyse. De udelades i adapteren og her (DROPPED_ANALYSIS_HEADINGS), så alle elementer og
 * tekstkort er enige, også for ældre data.
 * - "analyse" (oekonomi): hele regnskabsanalysen, alle afsnit, ingen CVR-tekster.
 */
export const TEXT_SECTIONS_VARIANTS = ["profil", "analyse", "cvr", "resume"] as const;
export type TextSectionsVariant = (typeof TEXT_SECTIONS_VARIANTS)[number];

/** Analysens afsnit med de overskrifter, adapteren giver dem, i den bekræftede rækkefølge. */
export const ANALYSIS_HEADINGS = ["Regnskabsanalyse: konklusion", "Resultat", "Balance og kapitalforhold", "Branchestatistik", "Revisoroplysninger"] as const;

/** Afsnit af analysen, der aldrig vises (Jakob 03.10): API-nøglerne likviditet og sprgsml. */
export const DROPPED_ANALYSIS_HEADINGS: ReadonlySet<string> = new Set(["Likviditet", "Spørgsmål til overvejelse"]);

/**
 * De afsnit af analysen, profilen på overblik viser. "Regnskabsanalyse" er hele analysen som
 * ét afsnit (svar uden `sections`); den er selv konklusionen og står derfor også i profilen.
 */
const PROFILE_ANALYSIS: ReadonlySet<string> = new Set(["Regnskabsanalyse: konklusion", "Regnskabsanalyse", "Resultat"]);

/** Kilden i analysens kildevisning, når afsnittet ikke selv har en. */
export const ANALYSIS_SOURCE = "Lasso regnskabsanalyse";

/** Afsnittet kommer fra Lassos regnskabsanalyse (overskrift eller kildenote), ikke fra CVR. */
export function isAnalysisSection(s: Pick<TextSectionItem, "heading" | "note">): boolean {
  return /^Regnskabsanalyse/i.test(s.heading) || (ANALYSIS_HEADINGS as readonly string[]).includes(s.heading) || /Lasso regnskabsanalyse/i.test(s.note ?? "");
}

/** Branchen står i LassoKeyValueList (variant company) og vises ikke som eget afsnit. */
function isIndustry(s: Pick<TextSectionItem, "heading">): boolean {
  return /^branche$/i.test(s.heading.trim());
}

/** De afsnit, et element med den givne variant viser, i kildens rækkefølge. Uden variant: "profil". */
export function textSectionsFor(all: readonly TextSectionItem[], variant: TextSectionsVariant = "profil"): TextSectionItem[] {
  const sections = all.filter((s) => !DROPPED_ANALYSIS_HEADINGS.has(s.heading.trim()));
  if (variant === "analyse") return sections.filter(isAnalysisSection);
  // Portalens "Virksomhedsprofil" (Jakob 30.09): kun CVR-teksterne, med branchen (NACE-kode som note).
  if (variant === "cvr") return sections.filter((s) => !isAnalysisSection(s));
  if (variant === "resume") return [...sections];
  return sections.filter((s) => !isIndustry(s) && (!isAnalysisSection(s) || PROFILE_ANALYSIS.has(s.heading)));
}

/** Kildevisningns tekst for analysen: afsnittets egen note uden "Kilde: " (fx med dato), ellers standardkilden. */
export function analysisSource(sections: readonly TextSectionItem[]): string {
  const note = sections.find((s) => isAnalysisSection(s) && s.note)?.note;
  return note ? note.replace(/^Kilde:\s*/i, "").trim() || ANALYSIS_SOURCE : ANALYSIS_SOURCE;
}

/**
 * Portalens "Erhvervsresume" (Jakob 30.09): en fortællende tekst om virksomheden ud fra stamdata,
 * det første navn i historikken, ledelsen og seneste regnskab. Ren funktion; kun kendte fakta.
 */
export function businessResume(input: {
  name: string;
  founded?: string;
  city?: string;
  industryText?: string;
  purpose?: string;
  employees?: number;
  firstName?: string;
  ceo?: string;
  lastYear?: { year: number; grossProfit?: number | null; revenue?: number | null; profit?: number | null };
  today?: Date;
}): string | undefined {
  const parts: string[] = [];
  const now = input.today ?? new Date();
  if (input.founded) {
    const years = now.getFullYear() - Number(input.founded.slice(0, 4));
    parts.push(`For ${years} år siden blev virksomheden ${input.name} stiftet${input.city ? ` i ${input.city}` : ""}.`);
  } else parts.push(`${input.name} er registreret i CVR${input.city ? ` i ${input.city}` : ""}.`);
  if (input.firstName && input.firstName.toLowerCase() !== input.name.toLowerCase()) parts.push(`På daværende tidspunkt blev firmaet grundlagt under navnet ${input.firstName}.`);
  if (input.industryText) {
    const purpose = input.purpose ? `, og deres formål er angivet som "${input.purpose.replace(/\.$/, "")}"` : "";
    parts.push(`Firmaet er registreret i branchen '${input.industryText.charAt(0).toLowerCase()}${input.industryText.slice(1)}'${purpose}.`);
  }
  if (input.employees != null) parts.push(`Der arbejder ${input.employees} på deres arbejdsplads${input.city ? ` i ${input.city}` : ""}.`);
  if (input.ceo) parts.push(`Virksomheden ledes af ${input.ceo}.`);
  const y = input.lastYear;
  if (y) {
    const mio = (v: number) => `${(v / 1_000_000).toLocaleString("da-DK", { maximumFractionDigits: 1 })} mio. kr.`;
    const top = typeof y.revenue === "number" ? `en omsætning på ${mio(y.revenue)}` : typeof y.grossProfit === "number" ? `en bruttofortjeneste på ${mio(y.grossProfit)}` : undefined;
    const res = typeof y.profit === "number" ? `et resultat på ${mio(y.profit)}` : undefined;
    const both = [top, res].filter(Boolean).join(" og ");
    if (both) parts.push(`I regnskabsåret ${y.year} havde virksomheden ${both}.`.replace(/\.\.$/, "."));
  }
  return parts.length > 1 ? parts.join(" ") : undefined;
}
