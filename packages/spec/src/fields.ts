import type { Operator } from "./criteria.js";

export type FieldType = "text" | "number" | "amount" | "date" | "enum";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Tilladte værdier for enum-felter. */
  options?: readonly string[];
  unit?: string;
  description: string;
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
  { key: "kommune", label: "Kommune", type: "text", description: "Kommune for hovedadressen." },
  { key: "postnummer", label: "Postnummer", type: "number", description: "Firecifret postnummer." },
  { key: "branchekode", label: "Branchekode", type: "text", description: "DB07-branchekode, fx 692000 (revision). starts_with giver hele grupper." },
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
  date: ["before", "after", "between", "eq"],
  enum: ["eq", "neq", "in", "not_in"],
};
