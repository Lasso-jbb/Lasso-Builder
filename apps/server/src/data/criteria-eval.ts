import { FIELD_BY_KEY, formatCriterion, type CompanyRowVM, type Criterion, type SearchQuery } from "@lasso/spec";

/** Henter en rækkes værdi for et felt. undefined = datakilden har ikke feltet. */
export function rowValue(row: CompanyRowVM, field: string): string | number | null | undefined {
  switch (field) {
    case "navn":
      return row.name;
    case "region":
      return row.region;
    case "kommune":
      return row.city;
    case "branche":
      return row.industryText;
    case "status":
      return row.status;
    case "ansatte":
      return row.employees;
    case "omsaetning":
      return row.revenue;
    case "bruttofortjeneste":
      return row.grossProfit;
    case "resultat":
      return row.profit;
    default:
      return undefined;
  }
}

const FINANCIAL_FIELDS = new Set(["omsaetning", "bruttofortjeneste", "resultat", "egenkapital"]);

export function needsFinancials(q: SearchQuery): boolean {
  return (
    q.criteria.some((c) => FINANCIAL_FIELDS.has(c.field)) ||
    (q.sort !== undefined && ["omsaetning", "bruttofortjeneste", "resultat"].includes(q.sort.field))
  );
}

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function matchStatus(value: string, wanted: string): boolean {
  const v = norm(value);
  const w = norm(wanted);
  if (w === "aktiv") return /aktiv|normal|active/.test(v) && !/ophør|inaktiv/.test(v);
  return v.includes(w);
}

/** true/false = kriteriet kunne afgøres; null = feltet findes ikke på rækken. */
export function evaluate(row: CompanyRowVM, c: Criterion): boolean | null {
  const raw = rowValue(row, c.field);
  if (raw === undefined) return null;
  if (raw === null) return false;
  const type = FIELD_BY_KEY.get(c.field)?.type ?? "text";
  const values = Array.isArray(c.value) ? c.value : [c.value];

  if (type === "number" || type === "amount") {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) return false;
    const [a, b] = values.map(Number);
    switch (c.operator) {
      case "eq":
        return n === a;
      case "neq":
        return n !== a;
      case "gt":
        return n > a!;
      case "gte":
        return n >= a!;
      case "lt":
        return n < a!;
      case "lte":
        return n <= a!;
      case "between":
        return n >= Math.min(a!, b!) && n <= Math.max(a!, b!);
      case "in":
        return values.map(Number).includes(n);
      case "not_in":
        return !values.map(Number).includes(n);
      default:
        return null;
    }
  }

  const s = norm(raw);
  const eq = (w: unknown) => (c.field === "status" ? matchStatus(String(raw), String(w)) : s === norm(w));
  switch (c.operator) {
    case "eq":
      return eq(values[0]);
    case "neq":
      return !eq(values[0]);
    case "in":
      return values.some(eq);
    case "not_in":
      return !values.some(eq);
    case "contains":
      return s.includes(norm(values[0]));
    case "starts_with":
      return s.startsWith(norm(values[0]));
    default:
      return null;
  }
}

/**
 * Filtrerer rækker med kriterierne. Kriterier, som ingen rækker har data til,
 * returneres som "unsupported", så brugeren kan se, hvad der ikke blev anvendt.
 */
export function applyCriteria(rows: CompanyRowVM[], criteria: readonly Criterion[]) {
  const unsupported: string[] = [];
  let out = rows;
  for (const c of criteria) {
    const results = out.map((r) => evaluate(r, c));
    if (results.length > 0 && results.every((r) => r === null)) {
      unsupported.push(formatCriterion(c));
      continue;
    }
    out = out.filter((_, i) => results[i] === true);
  }
  return { rows: out, unsupported };
}

export function sortRows(rows: CompanyRowVM[], sort: SearchQuery["sort"]): CompanyRowVM[] {
  if (!sort || sort.field === "relevans") return rows;
  const dir = sort.direction === "asc" ? 1 : -1;
  const key = sort.field;
  const val = (r: CompanyRowVM) => (key === "navn" ? r.name : (rowValue(r, key) as number | null | undefined));
  return [...rows].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va === vb) return 0;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === "string" || typeof vb === "string") return String(va).localeCompare(String(vb), "da") * dir;
    return (va - vb) * dir;
  });
}
