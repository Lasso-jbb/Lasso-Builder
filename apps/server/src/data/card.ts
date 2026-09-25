import {
  amountScale,
  chartSeries,
  formatAmount,
  formatDate,
  formatNumber,
  formatPercent,
  formatScaled,
  percentChange,
  METRIC_FIELD,
  METRIC_LABELS,
  searchKey,
  type Dataset,
  type FinancialsVM,
  type Metric,
  type ViewSpec,
} from "@lasso/spec";

/**
 * Tekstkort: samme visning tegnet med tegn i en kodeblok, til apps der ikke kan
 * vise Lassos grafiske visning (fx Claude Code, terminaler og apps uden MCP Apps).
 * Smalt nok til en mobil: 38 tegn i alt.
 */

const W = 34; // indre bredde
const LABEL = 12;
const VALUE = W - LABEL - 1;
const EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];

const len = (s: string) => [...s].length;
const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - len(s)));
const padStart = (s: string, n: number) => " ".repeat(Math.max(0, n - len(s))) + s;

/** Faste forkortelser i lange selskabsnavne, fx revisorer. */
const ABBREVIATIONS: [RegExp, string][] = [[/\bstatsautoriseret\b/gi, "statsaut."], [/\bregistreret\b/gi, "reg."]];
/** Sammensatte ord deles helst foran et kendt efterled: "REVISIONSPARTNER-" + "SELSKAB". */
const SUFFIXES = /(selskab|forening|industri|holding|service|gruppen|partner)/gi;

function splitLong(word: string, width: number): [string, string] {
  let at = -1;
  for (const m of word.matchAll(SUFFIXES)) if (m.index! > 2 && m.index! <= width - 1) at = m.index!;
  const cut = at > 0 ? at : width - 1;
  return [`${[...word].slice(0, cut).join("")}-`, [...word].slice(cut).join("")];
}

/** Ombryder ved mellemrum; ord, der er for lange til linjen, deles med bindestreg. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  const abbreviated = ABBREVIATIONS.reduce((t, [re, to]) => (len(t) > width ? t.replace(re, (m) => (m === m.toUpperCase() ? to.toUpperCase() : to)) : t), text);
  for (let word of abbreviated.split(/\s+/).filter(Boolean)) {
    while (len(word) > width) {
      if (line) lines.push(line);
      line = "";
      const [head, rest] = splitLong(word, width);
      lines.push(head);
      word = rest;
    }
    if (!line) line = word;
    else if (len(line) + 1 + len(word) <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

class Card {
  private lines: string[] = [];
  text(s: string) {
    for (const l of wrap(s, W)) this.lines.push(`│ ${pad(l, W)} │`);
  }
  row(label: string, value: string | undefined) {
    if (!value) return;
    wrap(value, VALUE).forEach((v, i) => this.lines.push(`│ ${pad(`${pad(i === 0 ? label : "", LABEL)} ${v}`, W)} │`));
  }
  raw(s: string) {
    this.lines.push(`│ ${pad(s, W)} │`);
  }
  section(title: string) {
    if (this.lines.length) this.lines.push(`├${"─".repeat(W + 2)}┤`);
    this.text(title.toUpperCase());
  }
  get empty() {
    return this.lines.length === 0;
  }
  toString() {
    return [`┌${"─".repeat(W + 2)}┐`, ...this.lines, `└${"─".repeat(W + 2)}┘`].join("\n");
  }
}

const short = (v: number | null | undefined, metric: Metric) =>
  metric === "ansatte" ? formatNumber(v) : formatAmount(v).replace(" kr.", "");

function delta(from: number | null | undefined, to: number | null | undefined): string {
  if (typeof from !== "number" || typeof to !== "number" || from === 0) return "";
  const pct = percentChange([from, to]);
  if (pct === null) return to < 0 ? "▼ underskud" : "▲ overskud";
  const text = new Intl.NumberFormat("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(pct));
  return `${pct >= 0 ? "▲" : "▼"} ${padStart(text, 4)} %`;
}

function chart(card: Card, f: FinancialsVM, wanted: Metric, years: number) {
  const { metric, points } = chartSeries(f, wanted, years);
  if (points.length === 0) return;
  const scale = metric === "ansatte" ? null : amountScale(points.map((p) => p.value));
  card.section(`${METRIC_LABELS[metric]}${scale ? `, ${scale.label}` : ""}`);
  const max = Math.max(...points.map((p) => Math.abs(p.value))) || 1;
  for (const p of points) {
    const units = (Math.abs(p.value) / max) * 20;
    let full = Math.floor(units);
    let rest = Math.round((units - full) * 8);
    if (rest === 8) {
      full += 1;
      rest = 0;
    }
    const bar = (p.value < 0 ? "▒" : "█").repeat(full) + (p.value < 0 ? "" : EIGHTHS[rest]);
    const value = scale ? formatScaled(p.value, scale) : formatNumber(p.value);
    card.raw(`${p.year} ${pad(bar || "▏", 20)} ${padStart(value, 7)}`);
  }
}

const amt = (v: number | null | undefined) => formatAmount(v).replace(" kr.", "");

/**
 * Samme trin som `LassoWaterfallChart` (packages/ui/src/components/WaterfallChart.tsx),
 * med forkortede etiketter, så de kan stå i kortets faste labelbredde (12 tegn).
 */
function waterfallSteps(revenue: number | null | undefined, grossProfit: number | null | undefined, profit: number | null | undefined) {
  const steps: { label: string; value: number }[] = [];
  let cursor: number | null = null;
  if (typeof revenue === "number") {
    steps.push({ label: "Omsætning", value: revenue });
    cursor = revenue;
  }
  if (typeof grossProfit === "number") {
    if (cursor === null) steps.push({ label: "Bruttofortj.", value: grossProfit });
    else steps.push({ label: "Vareforbrug", value: grossProfit - cursor });
    cursor = grossProfit;
  }
  if (typeof profit === "number" && cursor !== null) {
    steps.push({ label: "Øvrige post.", value: profit - cursor });
    steps.push({ label: "Resultat", value: profit });
  }
  return steps;
}

function stackedText(card: Card, f: FinancialsVM, years: number) {
  const rows = f.years.slice(-years).filter((y) => typeof y.equity === "number" && typeof y.liabilities === "number");
  if (!rows.length) return;
  card.section("Balance, egenkapital / gæld");
  for (const y of rows) card.row(String(y.year), `${amt(y.equity)} / ${amt(y.liabilities)}`);
}

function waterfallText(card: Card, f: FinancialsVM) {
  const yr = f.years.at(-1);
  if (!yr) return;
  const steps = waterfallSteps(yr.revenue, yr.grossProfit, yr.profit);
  if (steps.length < 2) return;
  card.section(`Fra omsætning til resultat ${yr.year}`);
  for (const s of steps) card.row(s.label, amt(s.value));
}

function shareBarsText(card: Card, f: FinancialsVM) {
  const yr = [...f.years].reverse().find((y) => typeof y.equity === "number" && typeof y.liabilities === "number");
  if (!yr) return;
  const equity = yr.equity as number;
  const liabilities = yr.liabilities as number;
  const total = equity + liabilities;
  if (total <= 0) return;
  card.section(`Fordeling af balancen ${yr.year}`);
  card.row("Egenkapital", `${amt(equity)}, ${formatPercent((equity / total) * 100, false)}`);
  card.row("Gæld", `${amt(liabilities)}, ${formatPercent((liabilities / total) * 100, false)}`);
}

function companyCard(spec: ViewSpec, ds: Dataset, lassoId: string): string | null {
  const card = new Card();
  const types = new Set(spec.components.filter((c) => "company" in c && c.company === lassoId).map((c) => c.type));
  const co = ds.companies[lassoId];
  if (co) {
    card.text(co.name);
    card.text([co.status, co.form, co.address?.city].filter(Boolean).join(", "));
    card.section("Stamoplysninger");
    const a = co.address;
    card.row("CVR", co.cvr);
    card.row("Adresse", a?.street);
    card.row(a?.street ? "" : "Adresse", [a?.zip, a?.city].filter(Boolean).join(" ") || undefined);
    card.row("Kommune", a?.municipality);
    card.row("Region", a?.region);
    card.row("Branche", co.industryText ? `${co.industryText}${co.industryCode ? ` (${co.industryCode})` : ""}` : undefined);
    card.row("Stiftet", co.founded ? formatDate(co.founded) : undefined);
    card.row("Ansatte", co.employees != null ? `${formatNumber(co.employees)} (CVR)` : undefined);
    card.row("Telefon", co.phone?.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4"));
    card.row("E-mail", co.email);
    card.row("Web", co.website);
  }

  const people = types.has("LassoPersonList") ? (ds.people[lassoId] ?? []).filter((p) => !p.to) : [];
  const owners = types.has("LassoOwnerList") ? ds.ownership[lassoId] : undefined;
  if (people.length || owners) {
    card.section(owners ? "Ledelse og ejere" : "Ledelse");
    const ceo = people.find((p) => /direktør/i.test(p.role));
    const chair = people.find((p) => /formand/i.test(p.role));
    const board = people.filter((p) => /bestyrelse/i.test(p.role));
    card.row(/administrerende/i.test(ceo?.role ?? "") ? "Adm. dir." : "Direktør", ceo?.name);
    card.row("Formand", chair?.name);
    if (board.length > 1) card.row("Bestyrelse", `${board.length} inkl. formand`);
    for (const o of owners?.owners.slice(0, 3) ?? []) {
      card.row("Ejer", o.name);
      card.row("", o.share ? `${o.share}${o.votes ? " kapital" : ""}` : undefined);
      card.row("", o.votes ? `${o.votes} stemmer` : undefined);
    }
    if (owners && owners.owners.length > 3) card.row("", `og ${owners.owners.length - 3} flere ejere`);
    card.row("Revisor", owners?.auditor?.name);
  }

  const f = ds.financials[lassoId];
  const last = f?.years.at(-1);
  const prev = f?.years.at(-2);
  if (f && last && types.has("LassoKeyFigureCards")) {
    card.section(`Regnskab ${last.year}${prev ? `, ændring fra ${prev.year}` : ""}`);
    const metrics: Metric[] = [last.revenue != null ? "omsaetning" : "bruttofortjeneste", "resultat", "egenkapital", "ansatte"];
    for (const m of metrics) {
      const v = last[METRIC_FIELD[m]];
      if (typeof v !== "number") continue;
      const label = { omsaetning: "Omsætning", bruttofortjeneste: "Bruttofortj.", resultat: "Resultat", egenkapital: "Egenkapital", ansatte: "Ansatte" }[m];
      card.raw(`${pad(label, 12)}${padStart(short(v, m), 10)} ${delta(prev?.[METRIC_FIELD[m]] as number | null | undefined, v)}`);
    }
  }
  for (const c of spec.components) {
    if (!f) continue;
    if ((c.type === "LassoBarChart" || c.type === "LassoLineChart") && c.company === lassoId) chart(card, f, c.metric, c.years);
    if (c.type === "LassoGroupedBarChart" && c.company === lassoId) for (const m of c.metrics) chart(card, f, m, c.years);
    if (c.type === "LassoStackedBarChart" && c.company === lassoId) stackedText(card, f, c.years);
    if (c.type === "LassoWaterfallChart" && c.company === lassoId) waterfallText(card, f);
    if (c.type === "LassoShareBars" && c.company === lassoId) shareBarsText(card, f);
  }
  return card.empty ? null : card.toString();
}

/** Nøgletal, en søgerække har (egenkapital hentes ikke til lister). */
const ROW_FIELD = { omsaetning: "revenue", bruttofortjeneste: "grossProfit", resultat: "profit", ansatte: "employees" } as const;
type RowMetric = keyof typeof ROW_FIELD;

function listCard(spec: ViewSpec, ds: Dataset): string | null {
  const table = spec.components.find((c) => c.type === "LassoCompanyTable");
  if (!table || table.type !== "LassoCompanyTable") return null;
  const result = ds.searches[searchKey(table.search)];
  if (!result) return null;
  const card = new Card();
  card.text(spec.title);
  card.text(`${formatNumber(result.total ?? result.rows.length)} virksomheder, viser ${result.rows.length}`);
  const sortField = table.search.sort?.field;
  const metric: RowMetric = sortField && sortField in ROW_FIELD ? (sortField as RowMetric) : "bruttofortjeneste";
  card.section(`Navn, by, ${METRIC_LABELS[metric].toLowerCase()}`);
  result.rows.slice(0, 20).forEach((r, i) => {
    const n = `${i + 1}.`;
    wrap(r.name, W - 4).forEach((l, j) => card.raw(`${pad(j === 0 ? n : "", 3)} ${l}`));
    const v = r[ROW_FIELD[metric]];
    card.raw(`    ${[r.city, typeof v === "number" ? short(v, metric) : null].filter(Boolean).join(", ")}`);
  });
  return card.toString();
}

/** Tekstkort for visningen, eller null når den ikke har noget, der kan vises som tekst. */
export function textCard(spec: ViewSpec, ds: Dataset): string | null {
  const companies = [...new Set(spec.components.flatMap((c) => ("company" in c ? [c.company] : [])))];
  const cards = [
    ...(companies.length === 1 ? [companyCard(spec, ds, companies[0]!)] : []),
    listCard(spec, ds),
  ].filter((c): c is string => Boolean(c));
  return cards.length ? cards.join("\n") : null;
}
