import type { Dataset, ViewSpec } from "@lasso/spec";

/**
 * Den nye portal (prototypen "lasso-portal - new.html"): rene hjælpefunktioner uden React, så de kan
 * testes i node. Siden er enten forsiden, en virksomhed/person med faner eller et resultat (søgning,
 * sammenligning, liste), som spørgefeltet eller søgefeltet har hentet.
 */

export type EntityKind = "company" | "person";

/** "lasso" = fanen med Lasso-mærket: det, chatten senest hentede om siden. */
export const LASSO_TAB = "lasso";

export interface Shown {
  spec: ViewSpec;
  dataset: Dataset;
}

/** Hvad chatten senest svarede: spørgsmålet, Claudes tekst og visningen. */
export interface Answer {
  question: string;
  text: string;
  /** "Vis virksomhed …", mens værktøjet henter. */
  status?: string;
  error?: string;
  view?: Shown;
  pending: boolean;
}

export type Page =
  | { kind: "home" }
  | { kind: "entity"; entity: EntityKind; id: string; name: string; tab: string }
  | { kind: "result"; title: string };

/** Hovedet tegnes af portalen selv (navn, adresse, CVR-linje), så visningens eget hoved udelades. */
export function withoutHead(spec: ViewSpec): ViewSpec {
  const components = spec.components.filter((c) => c.type !== "LassoCompanyHead" && c.type !== "LassoPersonHead");
  return components.length === spec.components.length || components.length === 0 ? spec : { ...spec, components };
}

/** Linjerne under navnet: adresse, og CVR, telefon og web, som i prototypen. */
export function headLines(kind: EntityKind, id: string, ds: Dataset | undefined): string[] {
  if (!ds) return [];
  if (kind === "person") {
    const p = ds.persons[id] as { city?: string; address?: { city?: string } } | undefined;
    const city = p?.city ?? p?.address?.city;
    return city ? [city] : [];
  }
  const c = ds.companies[id];
  if (!c) return [];
  const a = c.address;
  const address = a ? [a.street, [a.zip, a.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";
  const contact = [c.cvr ? `CVR: ${c.cvr}` : "", c.phone ? `Telefon: ${c.phone}` : "", c.website ? c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : ""].filter(Boolean).join(", ");
  return [address, contact].filter(Boolean);
}

/**
 * Beskeden til chatten. Kigger brugeren på en anden virksomhed eller person end den, samtalen sidst
 * handlede om (fx efter et klik i søgningen), får Claude det at vide, så "hvem ejer den?" virker.
 */
export function messageFor(text: string, page: Page, lastEntityId: string | undefined): string {
  if (page.kind !== "entity" || page.id === lastEntityId) return text;
  return `${text}\n\n(Kontekst: brugeren kigger på ${page.name}, ${page.id}.)`;
}

/** Forslagene under spørgefeltet. */
export function suggestions(page: Page): string[] {
  if (page.kind === "entity" && page.entity === "company") return ["Hvordan går det økonomisk?", `Hvem ejer ${page.name}?`, "Er der røde flag?"];
  if (page.kind === "entity") return [`Hvilke selskaber er ${page.name} involveret i?`, "Hvem sidder personen sammen med?", "Har der været konkurser?"];
  return ["Hvordan går det økonomisk med Novo Nordisk?", "Revisorer i Aarhus med mindst 10 ansatte", "Sammenlign Carlsberg og Royal Unibrew"];
}

export function askPlaceholder(page: Page): string {
  return page.kind === "entity" ? `Spørg om ${page.name}` : "Spørg Lasso om en virksomhed, en person eller en målgruppe";
}
