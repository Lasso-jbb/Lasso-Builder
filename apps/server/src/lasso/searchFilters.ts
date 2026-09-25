import type { Criterion, Operator } from "@lasso/spec";
import { municipalityCode, municipalityName } from "../data/municipalities.js";

/**
 * Oversætter mellem vores kriterier (filterpanelet) og filtrene i Lassos søgning
 * (POST /apps/search/lassoid, som /apps/search/query/prompt også svarer med).
 * Formatet er kortlagt mod dev3.api.lassox.com 25.09.2026, se docs/lasso-endpoints.md.
 */

export interface LassoFilter {
  filterName: string;
  fieldName: string;
  fieldNames?: string[] | null;
  operator: string;
  values: string[];
  fallbackFields?: null;
  config?: unknown;
}

const REGION_CODES: Record<string, string> = { Hovedstaden: "1", Sjælland: "2", Syddanmark: "3", Midtjylland: "4", Nordjylland: "5" };

const FORM_CODES: Record<string, string[]> = {
  "A/S": ["60"],
  ApS: ["80"],
  IVS: ["81"],
  "I/S": ["30"],
  "K/S": ["40"],
  "P/S": ["70"],
  Enkeltmandsvirksomhed: ["10"],
  Fond: ["90", "100"],
  Forening: ["110", "115", "130", "140", "150", "152"],
};

const STATUS_VALUES: Record<string, string[]> = {
  aktiv: ["Aktiv"],
  ophørt: ["Ophørt"],
  "under konkurs": ["UNDERKONKURS"],
  "under likvidation": ["UNDERFRIVILLIGLIKVIDATION", "UNDERTVANGSOPLØSNING"],
};

type Kind = "code" | "integer" | "amount" | "date";

interface FieldMap {
  filterName: string;
  fieldName: string;
  kind: Kind;
  /** Vores værdi -> Lassos værdier (undefined = kan ikke oversættes). */
  encode?: (value: string | number) => string[] | undefined;
  /** Lassos værdi -> vores værdi. */
  decode?: (value: string) => string | number | undefined;
}

const invert = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));
const REGION_BY_CODE = invert(REGION_CODES);

const FIELDS: Record<string, FieldMap> = {
  region: {
    filterName: "geography-region",
    fieldName: "BasicInfo.region",
    kind: "code",
    encode: (v) => (REGION_CODES[String(v)] ? [REGION_CODES[String(v)]!] : undefined),
    decode: (v) => REGION_BY_CODE[v],
  },
  kommune: {
    filterName: "geography-municipality",
    fieldName: "BasicInfo.municipalityCode",
    kind: "code",
    encode: (v) => {
      const code = municipalityCode(String(v));
      return code ? [code] : undefined;
    },
    decode: (v) => municipalityName(v),
  },
  postnummer: { filterName: "geography-postal-code", fieldName: "BasicInfo.PostalCode", kind: "integer" },
  branchekode: {
    filterName: "basic-industry",
    fieldName: "industrycode",
    kind: "code",
    encode: (v) => (/^\d{6}$/.test(String(v)) ? [String(v)] : undefined),
    decode: (v) => v,
  },
  status: {
    filterName: "basic-company-status",
    fieldName: "BasicInfo.CompanyStatus",
    kind: "code",
    encode: (v) => STATUS_VALUES[String(v).toLowerCase()],
    decode: (v) => Object.entries(STATUS_VALUES).find(([, codes]) => codes.includes(v))?.[0],
  },
  virksomhedsform: {
    filterName: "basic-company-type",
    fieldName: "BasicInfo.formCode",
    kind: "code",
    encode: (v) => FORM_CODES[String(v)],
    decode: (v) => Object.entries(FORM_CODES).find(([, codes]) => codes.includes(v))?.[0],
  },
  ansatte: { filterName: "basic-employees-value", fieldName: "employees", kind: "integer" },
  bruttofortjeneste: { filterName: "economy-gross-profit-value", fieldName: "Financial.Reports[0].GrossProfitLoss.Value", kind: "amount" },
  resultat: { filterName: "economy-net-profit-value", fieldName: "Financial.Reports[0].ProfitLoss.Value", kind: "amount" },
  egenkapital: { filterName: "economy-equity-value", fieldName: "Financial.Reports[0].Equity.Value", kind: "amount" },
  stiftet: { filterName: "basic-creation-date", fieldName: "BasicInfo.CreationDate", kind: "date" },
};

const FIELD_BY_LASSO = new Map(Object.entries(FIELDS).map(([key, f]) => [f.fieldName.toLowerCase(), key]));

const num = (v: unknown) => (typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", ".")));
const isDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v));
const shiftDate = (d: string, days: number) => new Date(Date.parse(`${d}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const list = (v: Criterion["value"]) => (Array.isArray(v) ? v : [v]).filter((x): x is string | number => typeof x !== "boolean");

/** Ét kriterium -> ét Lasso-filter, eller null når Lasso ikke kan filtrere på det. */
function toFilter(c: Criterion): LassoFilter | null {
  const f = FIELDS[c.field];
  if (!f) return null;
  const base = { filterName: f.filterName, fieldName: f.fieldName, fieldNames: null, fallbackFields: null };
  const encodeAll = (values: (string | number)[]) => {
    if (!f.encode) return values.map(String);
    const out: string[] = [];
    for (const v of values) {
      const e = f.encode(v);
      if (!e) return null;
      out.push(...e);
    }
    return out;
  };

  switch (c.operator) {
    case "eq":
    case "in":
    case "neq":
    case "not_in": {
      if (f.kind === "date" && c.operator === "eq" && isDate(c.value)) {
        return { ...base, operator: "Between", values: [String(c.value), String(c.value)] };
      }
      if (f.kind === "date" || f.kind === "amount") return null;
      const values = encodeAll(list(c.value));
      if (!values?.length) return null;
      return { ...base, operator: c.operator === "eq" || c.operator === "in" ? "Equal" : "NotEqual", values };
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (f.kind === "code") return null;
      if (f.kind === "date") {
        if (!isDate(c.value)) return null;
        const d = String(c.value);
        if (c.operator === "gt") return { ...base, operator: "After", values: [d] };
        if (c.operator === "gte") return { ...base, operator: "After", values: [shiftDate(d, -1)] };
        if (c.operator === "lt") return { ...base, operator: "Before", values: [d] };
        return { ...base, operator: "Before", values: [shiftDate(d, 1)] };
      }
      const n = num(c.value);
      if (!Number.isFinite(n)) return null;
      // Lasso har kun strenge sammenligninger; hele tal og kroner flyttes én enhed ("mindst 10" = "større end 9").
      if (c.operator === "gt") return { ...base, operator: "GreaterThan", values: [String(n)] };
      if (c.operator === "gte") return { ...base, operator: "GreaterThan", values: [String(n - 1)] };
      if (c.operator === "lt") return { ...base, operator: "LessThan", values: [String(n)] };
      return { ...base, operator: "LessThan", values: [String(n + 1)] };
    }
    case "between": {
      const [a, b] = list(c.value);
      if (a === undefined || b === undefined || f.kind === "code") return null;
      if (f.kind === "date") return isDate(a) && isDate(b) ? { ...base, operator: "Between", values: [String(a), String(b)] } : null;
      return Number.isFinite(num(a)) && Number.isFinite(num(b)) ? { ...base, operator: "Between", values: [String(num(a)), String(num(b))] } : null;
    }
    case "before":
      return f.kind === "date" && isDate(c.value) ? { ...base, operator: "Before", values: [String(c.value)] } : null;
    case "after":
      return f.kind === "date" && isDate(c.value) ? { ...base, operator: "After", values: [String(c.value)] } : null;
    default:
      return null;
  }
}

/** Kriterier -> Lasso-filtre. Det, Lasso ikke kan filtrere på, kommer tilbage i `rest` og anvendes lokalt. */
export function criteriaToFilters(criteria: readonly Criterion[]): { filters: LassoFilter[]; rest: Criterion[] } {
  const filters: LassoFilter[] = [];
  const rest: Criterion[] = [];
  for (const c of criteria) {
    const f = toFilter(c);
    if (f) filters.push(f);
    else rest.push(c);
  }
  return { filters, rest };
}

/**
 * Lasso-filtre (fx fra prompt-søgningen) -> kriterier til filterpanelet.
 * Filtre uden et felt hos os (fx ContactConfiguration) springes over; ukendte felter nævnes i `unknown`.
 */
export function filtersToCriteria(filters: readonly LassoFilter[]): { criteria: Criterion[]; unknown: string[] } {
  const criteria: Criterion[] = [];
  const unknown: string[] = [];
  for (const f of filters) {
    if (f.operator === "ContactConfiguration" || f.filterName === "ContactConfiguration") continue;
    const key = FIELD_BY_LASSO.get(String(f.fieldName).toLowerCase());
    const map = key ? FIELDS[key] : undefined;
    if (!key || !map) {
      unknown.push(`${f.filterName} ${f.operator} ${f.values.join(", ")}`);
      continue;
    }
    const decode = (v: string) => (map.decode ? map.decode(v) : map.kind === "date" ? v : num(v));
    const decoded = [...new Set(f.values.map(decode))];
    if (decoded.some((v) => v === undefined || (typeof v === "number" && !Number.isFinite(v)))) {
      unknown.push(`${f.filterName} ${f.operator} ${f.values.join(", ")}`);
      continue;
    }
    const values = decoded as (string | number)[];
    const add = (operator: Operator, value: Criterion["value"]) => criteria.push({ field: key, operator, value });
    switch (f.operator) {
      case "Equal":
        add(values.length === 1 ? "eq" : "in", values.length === 1 ? values[0]! : values);
        break;
      case "NotEqual":
        add(values.length === 1 ? "neq" : "not_in", values.length === 1 ? values[0]! : values);
        break;
      case "GreaterThan":
        add("gt", values[0]!);
        break;
      case "LessThan":
        add("lt", values[0]!);
        break;
      case "Between":
        add("between", [values[0]!, values[1] ?? values[0]!]);
        break;
      case "Before":
        add("before", values[0]!);
        break;
      case "After":
        add("after", values[0]!);
        break;
      default:
        unknown.push(`${f.filterName} ${f.operator} ${f.values.join(", ")}`);
    }
  }
  return { criteria, unknown };
}

/** Felter, Lasso kan sortere på (altid stigende). Økonomiske felter giver 500 hos Lasso. */
export const SERVER_SORT: Record<string, string> = { ansatte: "employees", navn: "BasicInfo.name" };
