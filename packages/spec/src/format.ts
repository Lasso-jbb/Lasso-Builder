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

/**
 * Enheden for et beløb i en given valuta: DKK (eller ukendt) -> "kr.", ellers ISO-koden
 * ("EUR", "USD"), så fx Vestas vises som "18,8 mia. EUR" og aldrig som kroner.
 */
export function currencyUnit(currency?: string | null): string {
  const c = (currency ?? "").trim().toUpperCase();
  return !c || c === "DKK" || c === "KR." || c === "KR" ? "kr." : c;
}

/** Om et regnskab er i en anden valuta end kroner. */
export function isForeignCurrency(currency?: string | null): boolean {
  return currencyUnit(currency) !== "kr.";
}

/**
 * 12500000 -> "12,5 mio. kr." ; 950000 -> "950 t. kr.". `unit` er enheden efter tallet;
 * brug `currencyUnit(financials.currency)` for regnskabstal ("mio. EUR").
 */
export function formatAmount(value: number | null | undefined, unit = "kr.", options: { trimZero?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING;
  const abs = Math.abs(value);
  const suffix = unit ? ` ${unit}` : "";
  // 01.7/02c.4: mio. og mia. altid med én decimal ("34,0 mio. kr."), så beløbene står ens.
  // trimZero: grænseværdier i kriterier skrives uden ",0" ("større end 10 mio. kr.").
  const dec = options.trimZero ? oneDecimal : fixedOneDecimal;
  if (abs >= 1_000_000_000) return minus(`${dec.format(value / 1_000_000_000)} mia.${suffix}`);
  if (abs >= 1_000_000) return minus(`${dec.format(value / 1_000_000)} mio.${suffix}`);
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

/**
 * 02c.9: tællingen efter de viste navne: "1 mere" ved én ekstra, "N flere" ved to eller flere.
 * Bruges overalt, hvor en liste opsummeres ("og 1 mere", "og 2 flere", "Se 1 mere").
 */
export function moreText(rest: number, one?: string, many?: string): string {
  // Med navneord: "1 selskab mere" / "3 flere selskaber".
  if (rest === 1) return one ? `1 ${one} mere` : "1 mere";
  return `${intFormat.format(rest)} flere${many ? ` ${many}` : ""}`;
}

/** "Normal / aktiv, Ophørt og 1 mere" / "… og 3 flere" – de to første nævnes, resten tælles. */
export function summarizeList(values: readonly string[]): string {
  if (values.length <= 2) return values.join(", ");
  return `${values.slice(0, 2).join(", ")} og ${moreText(values.length - 2)}`;
}

/**
 * 02c.4: procentvis ændring fra forrige til nu, også ved fortegnsskift (fra overskud til underskud
 * eller omvendt): (nu − forrige) / |forrige|. null, når den ikke kan beregnes (intet forrige år,
 * forrige = 0 eller manglende tal).
 */
export function changePercent(from: number | null | undefined, to: number | null | undefined): number | null {
  if (typeof from !== "number" || typeof to !== "number" || !Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
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
    if (field?.type === "percent") return formatPercent(value, false);
    if (field?.type === "amount") return formatAmount(value, field.unit ?? "kr.", { trimZero: true });
    if (field?.key === "postnummer") return String(value);
    return formatNumber(value);
  }
  if (typeof value === "boolean") return value ? "Ja" : "Nej";
  if (field?.type === "percent" && typeof value === "number") return formatPercent(value, false);
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

const shareFormat = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 });

/**
 * Ejerandel som CVR-interval (katalog 11 og 14): [20, 24.99] -> "20–24,99 %", [100, 100] -> "100 %".
 * Tallene er procent (0–100), ikke brøker.
 */
export function formatShare(range: readonly [number, number] | null | undefined): string {
  if (!range) return MISSING;
  const [lo, hi] = range;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return MISSING;
  const a = shareFormat.format(lo);
  return Math.abs(hi - lo) < 0.005 ? `${a} %` : `${a}–${shareFormat.format(hi)} %`;
}

/**
 * 02c.14: en ejerandel, der allerede er tekst (fra API'et eller demodata), vises altid med tankestreg
 * uden mellemrum: "66,67-89,99 %" -> "66,67–89,99 %". Andre tekster vises uændret.
 */
export function shareText(value: string): string;
export function shareText(value: string | undefined): string | undefined;
export function shareText(value: string | undefined): string | undefined {
  return value?.replace(/(\d)\s*[-\u2010\u2011\u2012]\s*(\d)/g, "$1\u2013$2");
}

// ---------- 02c Felter med data: visning af enkeltværdier ----------

/** 02c.17: "Ikke oplyst" når virksomheden ikke skal oplyse det, "Ikke registreret" når kilden er tom. */
export const NOT_REPORTED = "Ikke oplyst";
export const NOT_REGISTERED = "Ikke registreret";

/**
 * 02c.3 Tal-interval: tankestreg uden mellemrum ("10–19"), åbne intervaller som "1.000+" og
 * "under 5", aldrig "10 til 19". `null` i en ende betyder åben.
 */
export function formatRange(lo: number | null | undefined, hi: number | null | undefined, unit = ""): string {
  const u = unit ? ` ${unit}` : "";
  const hasLo = typeof lo === "number" && Number.isFinite(lo);
  const hasHi = typeof hi === "number" && Number.isFinite(hi);
  if (hasLo && hasHi) return lo === hi ? `${formatNumber(lo)}${u}` : `${formatNumber(lo)}–${formatNumber(hi)}${u}`;
  if (hasLo) return `${formatNumber(lo)}+${u}`;
  if (hasHi) return `under ${formatNumber(hi)}${u}`;
  return MISSING;
}

/**
 * 02c.6 Periode: datoer med tankestreg uden mellemrum ("01.01.2025–31.12.2025"). Åben periode
 * (ingen slutdato) som "siden 2016" (style "since") eller "2016 →" (style "arrow"); kun år, når
 * `yearOnly` er sat. Ingen dato i det hele taget giver "—".
 */
export function formatPeriod(from: string | null | undefined, to: string | null | undefined, options: { yearOnly?: boolean; open?: "since" | "arrow" } = {}): string {
  const fmt = (v: string) => (options.yearOnly ? (/^(\d{4})/.exec(v)?.[1] ?? v) : formatDate(v));
  if (from && to) return `${fmt(from)}–${fmt(to)}`;
  if (from) return options.open === "arrow" ? `${fmt(from)} →` : `siden ${fmt(from)}`;
  if (to) return `til ${fmt(to)}`;
  return MISSING;
}

/** 02c.6: alder eller varighed som muted tillæg, fx "9 år" eller "3 mdr." fra en dato til i dag. */
export function formatAge(from: string | null | undefined, today: Date = new Date()): string {
  if (!from) return "";
  const d = new Date(`${from.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  let months = (today.getUTCFullYear() - d.getUTCFullYear()) * 12 + (today.getUTCMonth() - d.getUTCMonth());
  if (today.getUTCDate() < d.getUTCDate()) months -= 1;
  if (months < 0) return "";
  if (months < 12) return months <= 1 ? "1 md." : `${months} mdr.`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 år" : `${years} år`;
}

/**
 * 02c.12 Telefon i grupper af to: "86123456" -> "86 12 34 56", "+4586123456" -> "+45 86 12 34 56".
 * Andre formater (udenlandske numre) vises uændret.
 */
export function formatPhone(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  const compact = v.replace(/[\s-]/g, "");
  const m = /^(\+45|0045)?(\d{8})$/.exec(compact);
  if (!m) return v;
  const local = m[2]!.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4");
  return m[1] ? `+45 ${local}` : local;
}

/** 02c.12 Web uden https:// og www. (og uden afsluttende skråstreg): "https://www.eksempelbyg.dk/" -> "eksempelbyg.dk". */
export function formatWeb(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
}

/** 02c.12 E-mail i små bogstaver. */
export function formatEmail(value: string | null | undefined): string | undefined {
  return value ? value.trim().toLowerCase() : undefined;
}

/** 02c.7 Ja/nej: altid ordene, ukendt skrives "Ikke oplyst". Konsekvensen kan følge efter komma. */
export function formatBoolean(value: boolean | null | undefined, consequence?: string): string {
  if (value === null || value === undefined) return NOT_REPORTED;
  const word = value ? "Ja" : "Nej";
  return consequence ? `${word}, ${consequence}` : word;
}

/**
 * 02c.9 Liste af værdier: komma, "og" før sidste, afkortet efter `max` navne med "og 1 mere" /
 * "og N flere".
 * Returnerer delene, så "og N flere" kan tegnes som et link. Tom liste = "Ingen".
 */
export function listParts(values: readonly string[], max = 2): { shown: string[]; rest: number; text: string } {
  const clean = values.filter((v) => v && v.trim());
  if (clean.length === 0) return { shown: [], rest: 0, text: "Ingen" };
  if (clean.length <= max) {
    const text = clean.length === 1 ? clean[0]! : `${clean.slice(0, -1).join(", ")} og ${clean.at(-1)}`;
    return { shown: clean, rest: 0, text };
  }
  const shown = clean.slice(0, max);
  const rest = clean.length - max;
  return { shown, rest, text: `${shown.join(", ")} og ${moreText(rest)}` };
}

/**
 * 02c.4: ændringen som pil + procent, uden ord efter: "▲ 12,4 %" (grøn) eller "▼ 15,1 %" (rød).
 * Ved fortegnsskift vises stadig pil + procent; kan ændringen ikke beregnes (intet forrige år,
 * eller forrige = 0), er svaret null, og der vises ingen ændring. `text` er procenten uden pil.
 */
export function changeText(from: number | null | undefined, to: number | null | undefined): { arrow: "▲" | "▼"; text: string; tone: "up" | "down" } | null {
  const pct = changePercent(from, to);
  if (pct === null) return null;
  return pct < 0 ? { arrow: "▼", text: formatPercent(Math.abs(pct), false), tone: "down" } : { arrow: "▲", text: formatPercent(pct, false), tone: "up" };
}

/** 02c.4: fuldt beløb til tooltip, "18.812.400 kr." med ægte minus. */
export function formatFullAmount(value: number | null | undefined, unit = "kr."): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  return `${formatNumber(Math.round(value))} ${unit}`.trim();
}

/** 02c.15 Score: tolkningen som ord, samme tre trin som scoremåleren (10): under 60, 60–79, 80+. */
export function scoreWord(score: number): "lav risiko" | "mulig risiko" | "høj risiko" {
  return score >= 80 ? "høj risiko" : score >= 60 ? "mulig risiko" : "lav risiko";
}
