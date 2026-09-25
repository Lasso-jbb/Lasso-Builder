import { operatorLabel, type Criterion, type CriterionValue } from "./criteria.js";
import { FIELD_BY_KEY, type FieldDef } from "./fields.js";

const intFormat = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });
const fixedOneDecimal = new Intl.NumberFormat("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Katalog 09: manglende værdi vises som "—" (i text-faint). */
export const MISSING = "—";

/** Katalog 09: negative tal med ægte minus (U+2212), aldrig bindestreg eller parentes. */
function minus(s: string): string {
  return s.replace(/^-/, "\u2212").replace(/^\u002D/, "\u2212");
}

/** 12500000 -> "12,5 mio. kr." ; 950000 -> "950 t. kr." */
export function formatAmount(value: number | null | undefined, unit = "kr."): string {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING;
  const abs = Math.abs(value);
  const suffix = unit ? ` ${unit}` : "";
  if (abs >= 1_000_000_000) return minus(`${oneDecimal.format(value / 1_000_000_000)} mia.${suffix}`);
  if (abs >= 1_000_000) return minus(`${oneDecimal.format(value / 1_000_000)} mio.${suffix}`);
  if (abs >= 10_000) return minus(`${intFormat.format(Math.round(value / 1_000))} t.${suffix}`);
  return minus(`${intFormat.format(value)}${suffix}`);
}

export interface AmountScale {
  divisor: number;
  /** Fx "mia. kr." */
  label: string;
}

/** Fælles enhed for en række beløb, fx søjlerne i en graf: 117,1 og 250,3 i "mia. kr.". */
export function amountScale(values: readonly number[], unit = "kr."): AmountScale {
  const max = Math.max(0, ...values.map((v) => Math.abs(v)));
  if (max >= 1_000_000_000) return { divisor: 1_000_000_000, label: `mia. ${unit}` };
  if (max >= 1_000_000) return { divisor: 1_000_000, label: `mio. ${unit}` };
  if (max >= 10_000) return { divisor: 1_000, label: `t. ${unit}` };
  return { divisor: 1, label: unit };
}

export function formatScaled(value: number, scale: AmountScale): string {
  // Fast én decimal i mio./mia., så søjlerne står ens: "177,0" ved siden af "140,8".
  return minus((scale.divisor >= 1_000_000 ? fixedOneDecimal : intFormat).format(value / scale.divisor));
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING;
  return minus(intFormat.format(value));
}

export function formatPercent(value: number | null | undefined, withSign = true): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  const sign = withSign && value > 0 ? "+" : "";
  return `${sign}${minus(fixedOneDecimal.format(value))} %`;
}

/** "2021-03-01" -> "01.03.2021" (dansk dd.mm.åååå). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return MISSING;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** "Normal / aktiv, Ophørt og 3 flere" – de to første nævnes, resten tælles. */
export function summarizeList(values: readonly string[]): string {
  if (values.length <= 2) return values.join(", ");
  return `${values.slice(0, 2).join(", ")} og ${values.length - 2} flere`;
}

/** Procentvis ændring fra første til sidste tal i en serie. */
export function percentChange(series: readonly (number | null | undefined)[]): number | null {
  const values = series.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (values.length < 2) return null;
  const first = values[0]!;
  const last = values[values.length - 1]!;
  // Fra overskud til underskud (eller omvendt) er en procentændring meningsløs.
  if (first === 0 || Math.sign(first) * Math.sign(last) < 0) return null;
  return ((last - first) / Math.abs(first)) * 100;
}

export function formatCriterionValue(field: FieldDef | undefined, value: CriterionValue): string {
  if (Array.isArray(value)) return summarizeList(value.map((v) => formatCriterionValue(field, v)));
  if (typeof value === "number") {
    if (field?.type === "amount") return formatAmount(value, field.unit ?? "kr.");
    if (field?.key === "postnummer") return String(value);
    return formatNumber(value);
  }
  if (typeof value === "boolean") return value ? "ja" : "nej";
  if (field?.type === "date") return formatDate(value);
  return value;
}

/**
 * Tekst til en kriterie-tag. Lighed og lister vises som "Region: Midtjylland"
 * (feltnavn og værdi); alt andet som "Omsætning er større end 10 mio. kr.".
 */
export function formatCriterion(c: Criterion): string {
  const field = FIELD_BY_KEY.get(c.field);
  const label = field?.label ?? c.field;
  if (c.operator === "between" && Array.isArray(c.value) && c.value.length === 2) {
    return `${label} ${operatorLabel("between", field?.type)} ${formatCriterionValue(field, c.value[0]!)} og ${formatCriterionValue(field, c.value[1]!)}`;
  }
  if ((c.operator === "eq" && field?.type !== "date") || c.operator === "in") {
    return `${label}: ${formatCriterionValue(field, c.value)}`;
  }
  return `${label} ${operatorLabel(c.operator, field?.type)} ${formatCriterionValue(field, c.value)}`;
}
