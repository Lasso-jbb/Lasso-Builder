import type { Operator } from "./criteria.js";

/**
 * Felttyper (katalog 02a–02b). "percent" er nøgletal i procent (soliditetsgrad), "boolean" er
 * Ja/Nej (to chips, eller en kontakt når kun "Ja" giver mening).
 */
export type FieldType = "text" | "number" | "amount" | "percent" | "date" | "enum" | "boolean";

/**
 * Hvilken kontrol filterpanelet tegner, når typen alene ikke afgør det (katalog 02a/02b):
 * "list" = søgbar liste med tags (postnummer, kommune), "hierarchy" = branchevælger i dialog,
 * "toggle" = til/fra-kontakt (kun "Ja" giver mening), "segment" = segmenteret ja/nej (02b.8).
 */
export type FieldControl = "list" | "hierarchy" | "toggle" | "segment";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Tilladte værdier for enum-felter. */
  options?: readonly string[];
  unit?: string;
  description: string;
  /** Kontroltype i filterpanelet, når typen alene ikke afgør den. */
  control?: FieldControl;
  /** Multivalg med loft (02a.13): højst så mange værdier. */
  max?: number;
  /** Beløb + ændring (02a.4): nøglen på ændringsfeltet ("% ændring"), hvis det findes. */
  changeField?: string;
}

export const REGIONS = [
  "Hovedstaden",
  "Sjælland",
  "Syddanmark",
  "Midtjylland",
  "Nordjylland",
] as const;

export const COMPANY_STATUSES = ["aktiv", "ophørt", "under konkurs", "under likvidation"] as const;

export const COMPANY_FORMS = [
  "A/S",
  "ApS",
  "IVS",
  "I/S",
  "K/S",
  "P/S",
  "Enkeltmandsvirksomhed",
  "Forening",
  "Fond",
  "Andet",
] as const;

/** Felter man kan søge og filtrere på. Nøglerne er stabile; labels er kun visning. */
export const FIELDS: readonly FieldDef[] = [
  { key: "navn", label: "Navn", type: "text", description: "Virksomhedens navn." },
  { key: "region", label: "Region", type: "enum", options: REGIONS, description: "Region for hovedadressen." },
  { key: "kommune", label: "Kommune", type: "text", control: "list", description: "Kommune for hovedadressen." },
  { key: "postnummer", label: "Postnummer", type: "number", control: "list", description: "Firecifret postnummer." },
  { key: "branchekode", label: "Branchekode", type: "text", control: "hierarchy", description: "DB07-branchekode, fx 692000 (revision). starts_with giver hele grupper." },
  { key: "branche", label: "Branche", type: "text", description: "Branchetekst, fx 'Revision og bogføring'." },
  { key: "status", label: "Status", type: "enum", options: COMPANY_STATUSES, description: "Virksomhedens status i CVR." },
  { key: "virksomhedsform", label: "Virksomhedsform", type: "enum", options: COMPANY_FORMS, description: "Juridisk form." },
  { key: "ansatte", label: "Ansatte", type: "number", description: "Antal ansatte (seneste indberetning)." },
  { key: "omsaetning", label: "Omsætning", type: "amount", unit: "kr.", description: "Nettoomsætning i seneste regnskab." },
  { key: "bruttofortjeneste", label: "Bruttofortjeneste", type: "amount", unit: "kr.", description: "Bruttofortjeneste i seneste regnskab." },
  { key: "resultat", label: "Årets resultat", type: "amount", unit: "kr.", description: "Årets resultat i seneste regnskab." },
  { key: "egenkapital", label: "Egenkapital", type: "amount", unit: "kr.", description: "Egenkapital i seneste regnskab." },
  { key: "stiftet", label: "Stiftet", type: "date", description: "Stiftelsesdato (ÅÅÅÅ-MM-DD)." },
  { key: "revisor", label: "Revisor", type: "text", description: "Navn på revisor/revisionsfirma." },
];

export const FIELD_BY_KEY: ReadonlyMap<string, FieldDef> = new Map(FIELDS.map((f) => [f.key, f]));

export const OPERATORS_BY_TYPE: Record<FieldType, readonly Operator[]> = {
  text: ["eq", "neq", "contains", "starts_with", "in", "not_in"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "in", "not_in"],
  amount: ["gt", "gte", "lt", "lte", "between"],
  percent: ["gt", "gte", "lt", "lte", "between"],
  date: ["before", "after", "between", "eq"],
  enum: ["eq", "neq", "in", "not_in"],
  boolean: ["eq"],
};

/**
 * Operatorerne i den rækkefølge og det udvalg, filterpanelet viser (katalog 02a). Validering bruger
 * stadig OPERATORS_BY_TYPE, så kriterier fra modellen med en operator uden for listen virker; den
 * aktuelle operator lægges da bagerst, så feltet kan vise den.
 *
 * - Fritekst (02a.1): indeholder, begynder med, er lig med, er ikke
 * - Søgbar liste (02a.11, 03): er en af, er ikke en af
 * - Dato (02a.6): efter den, før den, præcis den, mellem
 * - Beløb og procent (02a.4, 02a.5): er mindst, er højst, er mellem, er større end, er mindre end
 */
export function fieldOperators(field: FieldDef | undefined, current?: Operator): readonly Operator[] {
  let ops: readonly Operator[];
  if (!field) ops = ["contains", "starts_with", "eq", "neq"];
  else if (field.control === "list" || field.control === "hierarchy") ops = ["in", "not_in"];
  else if (field.type === "text") ops = ["contains", "starts_with", "eq", "neq"];
  else if (field.type === "date") ops = ["after", "before", "eq", "between"];
  else if (field.type === "amount" || field.type === "percent") ops = ["gte", "lte", "between", "gt", "lt"];
  else if (field.type === "enum") ops = ["in", "not_in"];
  else if (field.type === "boolean") ops = ["eq"];
  else ops = OPERATORS_BY_TYPE[field.type];
  return current && !ops.includes(current) ? [...ops, current] : ops;
}
