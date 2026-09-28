import {
  hasNoStatements,
  noStatementsReason,
  amountScale,
  changeFeedKey,
  CHANGE_TYPE_LABELS,
  chartSeries,
  creditRatingText,
  currencyUnit,
  isForeignCurrency,
  formatAmount,
  formatDate,
  formatNumber,
  formatPercent,
  formatScaled,
  formatShare,
  ownershipGraphKey,
  percentChange,
  personCompanies,
  personCounts,
  personFactOptions,
  personFacts,
  personRisk,
  personRoleRows,
  riskTimeline,
  savedPagesKey,
  METRIC_FIELD,
  METRIC_KIND,
  METRIC_LABELS,
  searchKey,
  textSectionsFor,
  type Dataset,
  type FinancialsVM,
  type FinancialStatementsVM,
  type Metric,
  type OwnershipGraphVM,
  type ViewSpec,
} from "@lasso/spec";
import { SAVED_PAGES_NO_USER } from "./resolve.js";

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
    // En etiket, der er længere end kolonnen, står på sin egen linje, så kortet aldrig bliver bredere.
    const long = [...label].length > LABEL;
    if (long) this.lines.push(`│ ${pad(label, W)} │`);
    wrap(value, VALUE).forEach((v, i) => this.lines.push(`│ ${pad(`${pad(i === 0 && !long ? label : "", LABEL)} ${v}`, W)} │`));
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

/** Beløb uden "kr." (kortets beløb er kroner), men med valutakoden ved fx EUR/USD, så de aldrig læses som kroner. */
const short = (v: number | null | undefined, metric: Metric, currency?: string) => {
  const kind = METRIC_KIND[metric];
  if (kind === "count") return formatNumber(v);
  if (kind === "percent") return formatPercent(v, false);
  return formatAmount(v, currencyUnit(currency)).replace(" kr.", "");
};

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
  const kind = METRIC_KIND[metric];
  const scale = kind === "amount" ? amountScale(points.map((p) => p.value), currencyUnit(f.currency)) : null;
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
    const value = kind === "percent" ? formatPercent(p.value, false) : scale ? formatScaled(p.value, scale) : formatNumber(p.value);
    card.raw(`${p.year} ${pad(bar || "▏", 20)} ${padStart(value, 7)}`);
  }
}

const amt = (v: number | null | undefined, currency?: string) => formatAmount(v, currencyUnit(currency)).replace(" kr.", "");

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
  for (const y of rows) card.row(String(y.year), `${amt(y.equity, f.currency)} / ${amt(y.liabilities, f.currency)}`);
}

function waterfallText(card: Card, f: FinancialsVM) {
  const yr = f.years.at(-1);
  if (!yr) return;
  const steps = waterfallSteps(yr.revenue, yr.grossProfit, yr.profit);
  if (steps.length < 2) return;
  card.section(`Fra omsætning til resultat ${yr.year}`);
  for (const s of steps) card.row(s.label, amt(s.value, f.currency));
}

function shareBarsText(card: Card, f: FinancialsVM) {
  const yr = [...f.years].reverse().find((y) => typeof y.equity === "number" && typeof y.liabilities === "number");
  if (!yr) return;
  const equity = yr.equity as number;
  const liabilities = yr.liabilities as number;
  const total = equity + liabilities;
  if (total <= 0) return;
  card.section(`Fordeling af balancen ${yr.year}`);
  card.row("Egenkapital", `${amt(equity, f.currency)}, ${formatPercent((equity / total) * 100, false)}`);
  card.row("Gæld", `${amt(liabilities, f.currency)}, ${formatPercent((liabilities / total) * 100, false)}`);
}

/**
 * Ejerstruktur som indrykket liste (samme form som mobilvisningen i 26c): ejere opad og
 * datterselskaber nedad, højst 4 pr. niveau og 3 niveauer. Cirkulært ejerskab markeres.
 */
function ownershipTreeCard(card: Card, g: OwnershipGraphVM) {
  const names = new Map(g.nodes.map((n) => [n.id, n.name]));
  const ref = g.onDate ?? new Date().toISOString().slice(0, 10);
  // Ophørte ejerskaber er ikke en del af strukturen på datoen.
  const edges = g.edges.filter((e) => !e.until || e.until.slice(0, 10) > ref);
  if (card.empty) card.text(names.get(g.rootId) ?? g.rootId);
  const seen = new Set([g.rootId]);
  // En enhed, der både ejer og ejes af roden (cirkulært), står på den side, hvor andelen er størst.
  const share = (from: string, to: string) => edges.find((e) => e.from === from && e.to === to)?.share?.[1];
  const both = (id: string) => share(id, g.rootId) !== undefined && share(g.rootId, id) !== undefined;
  const belowRoot = (id: string) => both(id) && (share(g.rootId, id) ?? 0) > (share(id, g.rootId) ?? 0);
  const branch = (title: string, upward: boolean, depth: number) => {
    if (depth <= 0) return;
    const onSide = (e: { from: string; to: string }) => (upward ? !belowRoot(e.from) : !both(e.to) || belowRoot(e.to));
    const first = edges.filter((e) => (upward ? e.to : e.from) === g.rootId && onSide(e));
    if (!first.length) return;
    card.section(title);
    const walk = (id: string, level: number) => {
      const list = edges
        .filter((e) => (upward ? e.to : e.from) === id && (level > 0 || onSide(e)))
        .sort((a, b) => (b.share?.[1] ?? -1) - (a.share?.[1] ?? -1) || (names.get(upward ? a.from : a.to) ?? "").localeCompare(names.get(upward ? b.from : b.to) ?? "", "da"));
      list.slice(0, 4).forEach((e) => {
        const other = upward ? e.from : e.to;
        const indent = "  ".repeat(level);
        const repeat = seen.has(other);
        const pct = e.share ? formatShare(e.share) : "";
        const label = `${names.get(other) ?? other}${repeat || (level === 0 && both(other)) ? " (cirkulært)" : ""}`;
        const width = W - indent.length - len(pct) - 1;
        wrap(label, width).forEach((l, i, all) => card.raw(`${indent}${pad(l, width)} ${i === all.length - 1 ? pct : ""}`.trimEnd()));
        if (repeat) return;
        seen.add(other);
        if (level + 1 < Math.min(depth, 3)) walk(other, level + 1);
      });
      if (list.length > 4) card.raw(`${"  ".repeat(level)}og ${list.length - 4} flere`);
    };
    walk(g.rootId, 0);
  };
  branch("Ejere", true, g.ingoingDepth);
  branch("Datterselskaber", false, g.outgoingDepth);
  if (edges.length === 0) {
    card.section("Ejerstruktur");
    card.text("Ingen registrerede ejere eller datterselskaber.");
  }
}

/** Katalog 19: hele resultatopgørelsen, balancen og pengestrømmen som rækker i tekstkortet. */
function statementRows(card: Card, label: string, rows: { label: string; values: readonly (number | null | undefined)[] }[], yearsShown: readonly number[], currency?: string) {
  card.section(`${label} ${yearsShown.join("/")}${isForeignCurrency(currency) ? `, ${currencyUnit(currency)}` : ""}`);
  for (const r of rows) {
    const parts = r.values.map((v) => (v == null ? "—" : amt(v, currency)));
    card.row(r.label, parts.join(" → "));
  }
}

function incomeStatementText(card: Card, s: FinancialStatementsVM, years: number) {
  const shown = s.incomeStatement.slice(-Math.max(2, Math.min(3, years)));
  if (!shown.length) return;
  const revenueTop = shown.some((y) => y.revenue != null);
  statementRows(
    card,
    "Resultatopgørelse",
    [
      { label: revenueTop ? "Omsætning" : "Bruttofortj.", values: shown.map((y) => (revenueTop ? y.revenue : y.grossProfit)) },
      { label: "Personale", values: shown.map((y) => y.staffCosts) },
      { label: "Andre drift", values: shown.map((y) => y.otherOperatingCosts) },
      { label: "EBITDA", values: shown.map((y) => y.ebitda) },
      { label: "Af-/nedskr.", values: shown.map((y) => y.depreciation) },
      { label: "Finansielle", values: shown.map((y) => y.financialItemsNet) },
      { label: "Før skat", values: shown.map((y) => y.profitBeforeTax) },
      { label: "Skat", values: shown.map((y) => y.tax) },
      { label: "Resultat", values: shown.map((y) => y.profit) },
    ],
    shown.map((y) => y.year),
    s.currency,
  );
}

function balanceSheetText(card: Card, s: FinancialStatementsVM, years: number) {
  const shown = s.balanceSheet.slice(-Math.max(2, Math.min(3, years)));
  if (!shown.length) return;
  statementRows(
    card,
    "Balance",
    [
      { label: "Anlægsakt. i alt", values: shown.map((y) => y.fixedAssetsTotal) },
      { label: "Omsætn.akt. i alt", values: shown.map((y) => y.currentAssetsTotal) },
      { label: "Aktiver i alt", values: shown.map((y) => y.assetsTotal) },
      { label: "Egenkapital", values: shown.map((y) => y.equityTotal) },
      { label: "Gæld i alt", values: shown.map((y) => y.liabilitiesTotal) },
      { label: "Passiver i alt", values: shown.map((y) => y.liabilitiesAndEquityTotal) },
    ],
    shown.map((y) => y.year),
    s.currency,
  );
}

function cashFlowText(card: Card, s: FinancialStatementsVM, years: number) {
  if (!s.cashFlow.length) {
    card.section("Pengestrømsopgørelse");
    card.text("Pengestrømsopgørelse er ikke indberettet.");
    return;
  }
  const shown = s.cashFlow.slice(-Math.max(2, Math.min(3, years)));
  statementRows(
    card,
    "Pengestrøm",
    [
      { label: "Fra drift", values: shown.map((y) => y.operatingCashFlow) },
      { label: "Fra investering", values: shown.map((y) => y.investingCashFlow) },
      { label: "Fra finansiering", values: shown.map((y) => y.financingCashFlow) },
      { label: "Årets pengestrøm", values: shown.map((y) => y.netCashFlow) },
      { label: "Likvider ultimo", values: shown.map((y) => y.cashEnding) },
    ],
    shown.map((y) => y.year),
    s.currency,
  );
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
    if (types.has("LassoKeyValueList")) {
      const auditorFrom = ds.ownership[lassoId]?.auditor?.from;
      if (auditorFrom) card.row("Revisorskift", formatDate(auditorFrom));
    }
    card.row("Stiftet", co.founded ? formatDate(co.founded) : undefined);
    card.row("Ansatte", co.employees != null ? `${formatNumber(co.employees)} (CVR)` : undefined);
    card.row("Telefon", co.phone?.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4"));
    card.row("E-mail", co.email);
    card.row("Web", co.website);
  } else if (types.has("LassoContact")) {
    // LassoContact kan bruges alene, uden LassoCompanyHead/LassoKeyValueList; company() er
    // da ikke hentet, så kontaktblokkens egne data (ds.contact) bruges i stedet.
    const contact = ds.contact[lassoId];
    if (contact) {
      card.text(spec.title);
      card.section("Kontakt");
      const a = contact.address;
      card.row("Adresse", a?.street);
      card.row(a?.street ? "" : "Adresse", [a?.zip, a?.city].filter(Boolean).join(" ") || undefined);
      card.row("Telefon", contact.phone?.replace(/^(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4"));
      card.row("E-mail", contact.email);
      card.row("Web", contact.website);
    }
  }

  const people = types.has("LassoPersonList") || types.has("LassoRelations") ? (ds.people[lassoId] ?? []).filter((p) => !p.to) : [];
  const owners = types.has("LassoOwnerList") || types.has("LassoRelations") ? ds.ownership[lassoId] : undefined;
  if (people.length || owners) {
    card.section(owners ? "Ledelse og ejere" : "Ledelse");
    const ceo = people.find((p) => /direktør/i.test(p.role));
    const chair = people.find((p) => /formand/i.test(p.role));
    const board = people.filter((p) => /bestyrelse/i.test(p.role));
    card.row(/administrerende/i.test(ceo?.role ?? "") ? "Adm. dir." : "Direktør", ceo?.name);
    card.row("Formand", chair?.name);
    if (board.length > 1) card.row("Bestyrelse", `${board.length} inkl. formand`);
    // Ingen direktion eller bestyrelse (fx en enkeltmandsvirksomhed med en fuldt ansvarlig deltager): rollerne som de er, regel 9.
    if (!ceo && !chair && board.length === 0) {
      for (const p of people.slice(0, 3)) card.row(p.role, p.name);
      if (people.length > 3) card.row("", `Se ${people.length - 3} flere`);
    }
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
    const cur = last.currency ?? f.currency;
    // Valuta og koncern står i overskriften, så rækkerne holder kortets bredde.
    card.section(`Regnskab ${last.year}${last.scope === "Koncern" ? " (koncern)" : ""}${prev ? `, ændring fra ${prev.year}` : ""}${isForeignCurrency(cur) ? `, beløb i ${currencyUnit(cur)}` : ""}`);
    const metrics: Metric[] = [last.revenue != null ? "omsaetning" : "bruttofortjeneste", "resultat", "egenkapital", "ansatte"];
    for (const m of metrics) {
      const v = last[METRIC_FIELD[m]];
      if (typeof v !== "number") continue;
      const SHORT_LABEL: Record<Metric, string> = {
        omsaetning: "Omsætning",
        bruttofortjeneste: "Bruttofortj.",
        resultat: "Resultat",
        egenkapital: "Egenkapital",
        ansatte: "Ansatte",
        ebitda: "EBITDA",
        balancesum: "Balancesum",
        gaeld: "Gæld",
        soliditetsgrad: "Soliditet",
        overskudsgrad: "Overskudsgr.",
        likviditetsgrad: "Likviditet",
      };
      const label = SHORT_LABEL[m];
      card.raw(`${pad(label, 12)}${padStart(short(v, m), 10)} ${delta(prev?.[METRIC_FIELD[m]] as number | null | undefined, v)}`);
    }
  }
  for (const c of spec.components) {
    // Grafer kræver regnskabsdata; ejerdiagrammet gør ikke.
    if (f && (c.type === "LassoBarChart" || c.type === "LassoLineChart") && c.company === lassoId) chart(card, f, c.metric, c.years);
    if (f && c.type === "LassoGroupedBarChart" && c.company === lassoId) for (const m of c.metrics) chart(card, f, m, c.years);
    if (f && c.type === "LassoStackedBarChart" && c.company === lassoId) stackedText(card, f, c.years);
    if (f && c.type === "LassoWaterfallChart" && c.company === lassoId) waterfallText(card, f);
    if (f && c.type === "LassoShareBars" && c.company === lassoId) shareBarsText(card, f);
    const stmt = ds.financialStatements[lassoId];
    if (stmt && c.type === "LassoIncomeStatement" && c.company === lassoId) {
      // Intet offentliggjort regnskab: tekstkortet siger hvorfor, som visningen (én gang, ikke pr. tabel).
      if (hasNoStatements(stmt)) {
        card.section(c.title ?? "Regnskab");
        card.text(noStatementsReason(ds.companies[lassoId]));
      } else incomeStatementText(card, stmt, c.years);
    }
    if (stmt && c.type === "LassoBalanceSheet" && c.company === lassoId) balanceSheetText(card, stmt, c.years);
    if (stmt && c.type === "LassoCashFlow" && c.company === lassoId) cashFlowText(card, stmt, c.years);
    if (c.type === "LassoOwnershipDiagram" && c.company === lassoId) {
      const g = ds.ownershipGraphs[ownershipGraphKey(c)];
      if (g) ownershipTreeCard(card, g);
    }
  }
  const score = types.has("LassoScoreGauge") ? ds.scores[lassoId] : undefined;
  if (score) {
    card.section("Score");
    card.raw(score.score != null ? `${padStart(String(Math.round(score.score)), 3)} af 100` : "Ikke oplyst");
  }

  if (types.has("LassoBeneficialOwners")) {
    const b = ds.beneficialOwnership[lassoId];
    if (b) {
      card.section("Reelle ejere");
      if (b.owners.length === 0 && !b.gaps?.length) card.text("Ingen registreret reel ejer");
      for (const o of b.owners.slice(0, 3)) {
        card.row("Ejer", o.name);
        card.row("", o.share ? `Reelt ${o.share}` : undefined);
      }
      for (const g of b.gaps ?? []) card.text(`Ingen reel ejer for ${g.share ?? "en del"}`);
    }
  }

  if (types.has("LassoContactPersons")) {
    const cp = ds.contactPersons[lassoId];
    if (cp) {
      card.section("Kontaktpersoner");
      if (cp.people.length === 0) {
        card.text("Ingen kontaktpersoner fundet");
      } else {
        for (const p of cp.people.slice(0, 3)) {
          card.row(p.role ?? "Kontakt", p.name);
          card.row("", [p.phone, p.email].filter(Boolean).join(", ") || undefined);
        }
        if (cp.people.length > 3) card.row("", `og ${cp.people.length - 3} flere`);
      }
    }
  }

  // Samme afsnit som visningen: profilen uden branche (den står under stamoplysninger), analysen for sig.
  for (const c of spec.components) {
    if (c.type !== "LassoTextSections" || c.company !== lassoId) continue;
    for (const s of textSectionsFor(ds.textSections[lassoId]?.sections ?? [], c.variant)) {
      card.section(s.heading);
      card.text(s.body);
    }
  }

  if (types.has("LassoTimeline")) {
    const tl = ds.timeline[lassoId];
    if (tl?.events.length) {
      card.section("Historik");
      for (const e of tl.events.slice(0, 6)) {
        card.text(e.title);
        card.text(`${formatDate(e.date)}, ${e.category}`);
      }
    }
  }

  if (types.has("LassoNews")) {
    const n = ds.news[lassoId];
    if (n?.items.length) {
      card.section("Nyheder");
      for (const item of n.items.slice(0, 3)) {
        card.text(item.headline);
        card.text(item.source);
      }
    }
  }


  // Katalog 17.2: observationerne sorteret efter alvor, 3 + "Se N flere"; tom liste er positiv information.
  if (types.has("LassoRiskObservations")) {
    const obs = ds.observations[lassoId];
    if (obs) {
      card.section("Risikoobservationer");
      const level = (s: number) => (s === 100 ? "Høj" : s === 50 ? "Middel" : s === 25 ? "Info" : "Neutral");
      const sorted = obs.observations.filter((o) => !o.notAvailable).sort((a, b) => b.severity - a.severity);
      if (!sorted.some((o) => o.severity >= 25)) {
        card.text(obs.checkedAt ? `Intet at bemærke, tjekket ${formatDate(obs.checkedAt)}` : "Ingen risikoobservationer");
      } else {
        for (const o of sorted.slice(0, 3)) card.text(`${level(o.severity)}: ${o.title}`);
        if (sorted.length > 3) card.text(`Se ${sorted.length - 3} flere`);
      }
    }
  }

  // Katalog 17: Creditsafe på én linje, egen skala A–E (blandes aldrig med scoren eller observationerne).
  const credit = types.has("LassoCreditRating") ? ds.creditRatings?.[lassoId] : undefined;
  if (credit) {
    card.section("Kreditvurdering (Creditsafe)");
    const line = creditRatingText(credit);
    card.text(line.charAt(0).toUpperCase() + line.slice(1));
  }

  const auditorIndependence = types.has("LassoAuditorIndependence") ? ds.auditorIndependence[lassoId] : undefined;
  if (auditorIndependence) {
    card.section("Revisoruafhængighed");
    if (auditorIndependence.relations.length === 0) {
      card.text(auditorIndependence.unavailableReason ?? "Ingen kendte relationer");
    } else {
      const sorted = [...auditorIndependence.relations].sort((a, b) => b.assessment - a.assessment);
      const word = (s: number) => (s === 100 ? "Konflikt" : s === 50 ? "Vurdér" : "Neutral");
      for (const r of sorted.slice(0, 3)) card.text(`${word(r.assessment)}: ${r.name}, ${r.relation}`);
      if (sorted.length > 3) card.text(`Se ${sorted.length - 3} flere`);
    }
  }


  const units = types.has("LassoProductionUnits") ? ds.productionUnits[lassoId] : undefined;
  if (units?.units.length) {
    card.section("Produktionsenheder");
    for (const u of units.units.slice(0, 5)) {
      card.row(u.pNumber ?? "P-nr.", [u.name, u.isMain ? "hovedenhed" : undefined].filter(Boolean).join(", "));
    }
    if (units.units.length > 5) card.row("", `og ${units.units.length - 5} flere`);
  }

  const properties = types.has("LassoProperties") ? ds.properties[lassoId] : undefined;
  if (properties?.properties.length) {
    card.section("Ejendomme, BBR");
    for (const p of properties.properties.slice(0, 3)) {
      const addr = p.address ? [p.address.street, p.address.city].filter(Boolean).join(", ") : p.matrikel;
      card.row("Ejendom", addr);
      card.row("", p.buildings.length ? `${p.buildings.length} bygninger` : undefined);
    }
  }

  const livestock = types.has("LassoLivestock") ? ds.livestock[lassoId] : undefined;
  if (livestock?.chrNumber && livestock.herds.length) {
    card.section(`CHR ${livestock.chrNumber}`);
    for (const h of livestock.herds.slice(0, 5)) {
      card.row([h.species, h.category].filter(Boolean).join(", "), h.count != null ? `${formatNumber(h.count)} ${h.unit ?? ""}`.trim() : undefined);
    }
  }

  return card.empty ? null : card.toString();
}

/**
 * Katalog 16: personsiden som tekst, i sidens rækkefølge og kun det, fokus viser (som companyCard
 * følger de komponenter, composeCompany har valgt): hoved, rollelister og tidsbånd, stamoplysninger
 * (uden hovedets tal), netværk, risiko, historik (evt. kun forløbet i konkursselskaberne), nyheder og
 * ejerskab (de selskaber, personen ejer, fra ejerdiagrammet). Lister viser det antal, siden viser,
 * resten som "og N flere".
 */
function personCard(spec: ViewSpec, ds: Dataset, lassoId: string): string | null {
  const p = ds.persons[lassoId];
  const card = new Card();
  const year = (d?: string) => (d ? d.slice(0, 4) : "");
  const pl = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const mine = spec.components.filter((c) => "person" in c && c.person === lassoId);
  const ownerList = mine.some((c) => c.type === "LassoPersonRoles" && c.show === "owner");
  for (const c of mine) {
    switch (c.type) {
      case "LassoPersonHead": {
        if (!p) break;
        const n = personCounts(p);
        card.text(p.name);
        card.text(["Person", p.city].filter(Boolean).join(", "));
        card.text(`${pl(n.activeRoles, "aktiv rolle", "aktive roller")} i ${pl(n.activeCompanies, "selskab", "selskaber")}${n.endedRoles ? `, ${pl(n.endedRoles, "ophørt", "ophørte")}` : ""}`);
        break;
      }
      case "LassoPersonRoles": {
        if (!p) break;
        const show = c.show ?? "all";
        if (show === "all") {
          const companies = personCompanies(p);
          const limit = c.limit ?? 3;
          card.section(c.title ?? "Roller");
          if (companies.length === 0) card.text("Ingen registrerede roller i selskaber");
          for (const x of companies.slice(0, limit)) {
            const ended = x.companyStatusKind === "warning" || x.companyStatusKind === "inactive";
            card.text(`${x.companyName}${ended ? ` (${(x.companyStatus ?? "ophørt").toLowerCase()})` : ""}`);
            for (const r of x.roles.slice(0, 2)) {
              const what = `${r.role}${r.share ? ` ${r.share}` : ""}`;
              const when = r.active ? (r.from ? `siden ${year(r.from)}` : "") : [year(r.from), year(r.to)].filter(Boolean).join("–");
              for (const l of wrap([what, when].filter(Boolean).join(", "), W - 2)) card.raw(`  ${l}`);
            }
          }
          if (companies.length > limit) card.text(`og ${companies.length - limit} flere selskaber`);
          break;
        }
        const rows = personRoleRows(p, show, { except: c.except });
        const limit = c.limit ?? 5;
        card.section(c.title ?? { current: "Aktive roller", ended: "Ophørte roller", owner: "Ejerskaber" }[show]);
        if (rows.length === 0) card.text({ current: "Ingen aktive roller i selskaber", ended: "Ingen ophørte roller", owner: "Ejer ingen selskaber i CVR" }[show]);
        for (const r of rows.slice(0, limit)) {
          card.text(`${r.companyName}${r.companyStatus ? ` (${r.companyStatus.toLowerCase()}${r.companyEnded ? ` ${year(r.companyEnded)}` : ""})` : ""}`);
          for (const l of wrap([r.text, r.period].filter(Boolean).join(", "), W - 2)) card.raw(`  ${l}`);
        }
        if (rows.length > limit) card.text(`og ${rows.length - limit} flere selskaber`);
        break;
      }
      case "LassoPersonFacts": {
        if (!p) break;
        const f = personFacts(p);
        // Som på siden: hovedets tal (roller, ejerskaber, første registrering) gentages ikke.
        const { hideCounts } = personFactOptions(spec.components, lassoId);
        card.section("Stamoplysninger");
        // Kun postnummer og by, som på siden; aldrig gade og husnummer.
        card.row("Bopæl", p.addressProtected ? "Adressebeskyttet" : [[p.zip, p.city].filter(Boolean).join(" "), p.country].filter(Boolean).join(", ") || "Ikke oplyst");
        // Som på siden: kommunen kun, når den ikke blot gentager byen.
        if (!p.addressProtected && !(p.municipality && p.city?.toLowerCase().startsWith(p.municipality.toLowerCase()))) card.row("Kommune", p.municipality);
        card.row("Enhedsnummer", p.unitNumber ?? /^CVR-3-(\d+)$/i.exec(p.lassoId)?.[1]);
        if (!hideCounts) {
          card.row("Aktive", f.activeRoles ? `${pl(f.activeRoles, "rolle", "roller")} i ${pl(f.activeCompanies, "selskab", "selskaber")}` : "Ingen roller");
          card.row("Ophørte", f.endedRoles ? pl(f.endedRoles, "rolle", "roller") : "Ingen");
          card.row("Ejer af", f.ownedCompanies ? pl(f.ownedCompanies, "selskab", "selskaber") : "Ingen");
          card.row("Første reg.", f.firstRegistered ? year(f.firstRegistered) : undefined);
        }
        card.row("Seneste ænd.", f.latestChange ? formatDate(f.latestChange) : undefined);
        break;
      }
      case "LassoPersonNetwork": {
        const net = ds.personNetworks[lassoId];
        if (!net) break;
        const limit = c.limit ?? 3;
        card.section(c.title ?? "Sidder sammen med");
        if (net.people.length === 0) card.text("Sidder ikke sammen med andre i registrerede selskaber");
        for (const x of net.people.slice(0, limit)) {
          const yrs = x.overlapYears < 1 ? "<1 år" : `${x.overlapYears} år`;
          wrap(x.name, W - 8).forEach((l, i, all) => card.raw(`${pad(l, W - 7)}${i === all.length - 1 ? padStart(yrs, 7) : ""}`));
        }
        if (net.people.length > limit) card.text(`og ${net.people.length - limit} flere`);
        break;
      }
      case "LassoPersonStats": {
        // Katalog 26d.5: tre tal på én linje hver.
        if (!p) break;
        const risk = personRisk(p);
        const net = ds.personNetworks[lassoId];
        card.section("Netværkstal");
        card.row("Netværk", net ? `${net.people.length} i 1. led` : undefined);
        card.row("Konkurser", String(risk.bankruptcies.length));
        card.row("Tvangsopl.", String(risk.dissolutions.length));
        break;
      }
      case "LassoPersonRisk": {
        if (!p) break;
        const risk = personRisk(p);
        card.section(c.title ?? "Risiko");
        const word = (cases: typeof risk.bankruptcies) => (cases.length === 0 ? "Ingen" : cases.some((x) => x.involved) ? "Mulig vigtig" : "Info");
        card.row("Konkurser", `${risk.bankruptcies.length}, ${word(risk.bankruptcies)}`);
        card.row("Tvangsopl.", `${risk.dissolutions.length}, ${word(risk.dissolutions)}`);
        for (const x of [...risk.bankruptcies, ...risk.dissolutions]) {
          card.text(`${x.companyName}, ${x.status.toLowerCase()}${x.date ? ` ${year(x.date)}` : ""}${x.personLeft ? `, fratrådt ${year(x.personLeft)}` : ""}`);
        }
        break;
      }
      case "LassoTimeline": {
        const all = ds.timeline[lassoId];
        const events = (c.filter === "risiko" && all && p ? riskTimeline(all, p) : all)?.events;
        if (!events?.length) break;
        // Som på siden: de seneste `limit` (overblikket 3, ellers 5), resten som "og N flere".
        const limit = c.limit ?? 5;
        card.section(c.title ?? "Historik");
        for (const e of events.slice(0, limit)) {
          card.text(formatDate(e.date));
          for (const l of wrap(e.title, W - 2)) card.raw(`  ${l}`);
        }
        if (events.length > limit) card.text(`og ${events.length - limit} flere begivenheder`);
        break;
      }
      case "LassoNews": {
        const news = ds.news[lassoId]?.items;
        if (!news?.length) break;
        card.section("Nyheder");
        for (const n of news.slice(0, c.limit)) {
          card.text([n.source, n.time ? formatDate(n.time) : null].filter(Boolean).join(", "));
          for (const l of wrap(n.headline, W - 2)) card.raw(`  ${l}`);
        }
        if (news.length > c.limit) card.text(`og ${news.length - c.limit} flere nyheder`);
        break;
      }
      case "LassoOwnershipDiagram": {
        const graph = ds.ownershipGraphs[ownershipGraphKey(c)];
        if (!graph) break;
        const owned = graph.edges.filter((e) => e.from === lassoId && !e.until);
        card.section(c.title ?? "Ejerstruktur");
        // Står ejerskaberne (med andel) allerede som liste på siden, viser diagrammet kun strukturen under dem.
        if (!ownerList) {
          if (owned.length === 0) card.text("Ejer ingen selskaber i CVR");
          for (const e of owned.slice(0, 5)) {
            card.text(graph.nodes.find((n) => n.id === e.to)?.name ?? e.to);
            card.raw(`  Ejerandel ${e.share ? formatShare(e.share) : "ikke oplyst"}`);
          }
          if (owned.length > 5) card.text(`og ${owned.length - 5} flere selskaber`);
        }
        const below = graph.edges.filter((e) => e.from !== lassoId && !e.until);
        if (below.length && ownerList) {
          card.text(`Under de ejede selskaber (${below.length}):`);
          for (const e of below.slice(0, 5)) {
            for (const l of wrap(`${graph.nodes.find((n) => n.id === e.to)?.name ?? e.to}${e.share ? `, ${formatShare(e.share)}` : ""}`, W - 2)) card.raw(`  ${l}`);
          }
          if (below.length > 5) card.text(`og ${below.length - 5} flere selskaber`);
        } else if (below.length) card.text(`De ejede selskaber ejer ${below.length} ${below.length === 1 ? "selskab" : "selskaber"} mere`);
        else if (ownerList) card.text("De ejede selskaber ejer ingen andre selskaber");
        break;
      }
    }
  }
  return card.empty ? null : card.toString();
}

function summaryCard(spec: ViewSpec): string | null {
  const s = spec.components.find((c) => c.type === "LassoSummary");
  if (!s || s.type !== "LassoSummary") return null;
  const card = new Card();
  card.section(s.title ?? "Resumé");
  card.text(s.text);
  card.text(`Kilde: ${s.source}${s.updated ? `, opdateret ${formatDate(s.updated)}` : ""}`);
  return card.toString();
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
    card.raw(`    ${[r.city, typeof v === "number" ? short(v, metric, r.currency) : null].filter(Boolean).join(", ")}`);
  });
  return card.toString();
}

/** Katalog 21: ændringsfeedet som tekst. Navn, type; beskrivelse (status som "fra -> til"); kilde, klokkeslæt. 3 + "Se N flere". */
function changeFeedCard(spec: ViewSpec, ds: Dataset): string | null {
  const c = spec.components.find((x) => x.type === "LassoChangeFeed");
  if (!c || c.type !== "LassoChangeFeed") return null;
  const feed = ds.changeFeeds[changeFeedKey(c)];
  if (!feed) return null;
  const card = new Card();
  const title = c.title ?? (feed.listName ? `Ændringer i "${feed.listName}"` : "Ændringer i overvågningen");
  card.section(`${title} (${formatNumber(feed.total)})`);
  if (feed.entries.length === 0) {
    card.text(feed.emptyReason ?? `Ingen ændringer de seneste ${feed.days} dage`);
    return card.toString();
  }
  const clock = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : `kl. ${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  };
  let lastDay = "";
  let shown = 0;
  for (const e of feed.entries.slice(0, 3)) {
    const day = e.at.slice(0, 10);
    if (day !== lastDay) {
      card.text(formatDate(day));
      lastDay = day;
    }
    const who = (e.count ?? 1) > 1 ? `${formatNumber(e.count)} virksomheder` : e.companyName;
    card.text(`${who}, ${CHANGE_TYPE_LABELS[e.type].toLowerCase()}`);
    const body = e.type === "status" && (e.from || e.to) ? `${e.from ?? ""} -> ${e.to ?? ""}`.trim() : e.text;
    for (const l of wrap(`${body}${e.read ? "" : ", ulæst"}`, W - 2)) card.raw(`  ${l}`);
    for (const l of wrap(`${e.source}, ${clock(e.at)}`, W - 2)) card.raw(`  ${l}`);
    shown++;
  }
  if (feed.entries.length > shown) card.text(`Se ${feed.entries.length - shown} flere`);
  return card.toString();
}

const SAVED_TITLE = { all: "Mine gemte sider", company: "Mine gemte virksomheder", person: "Mine gemte personer" } as const;

/**
 * Gem-laget: brugerens gemte sider som tekst. Navn, slags og gemt-dato pr. side (som søgelisten),
 * og efter kortet et "Åbn"-link pr. side, så værter uden MCP Apps kan åbne siderne.
 */
function savedPagesCard(spec: ViewSpec, ds: Dataset): string | null {
  const c = spec.components.find((x) => x.type === "LassoSavedPages");
  if (!c || c.type !== "LassoSavedPages") return null;
  const key = savedPagesKey(c);
  const list = ds.savedPages[key];
  const card = new Card();
  const title = c.title ?? SAVED_TITLE[c.kind];
  if (!list) {
    card.section(title);
    card.text(ds.errors[`savedPages:${key}`] ?? SAVED_PAGES_NO_USER);
    return card.toString();
  }
  card.section(`${title} (${formatNumber(list.total)})`);
  if (list.pages.length === 0) {
    card.text("Ingen gemte sider endnu.");
    return card.toString();
  }
  const shown = list.pages.slice(0, 20);
  shown.forEach((p, i) => {
    const n = `${i + 1}.`;
    wrap(p.name, W - 4).forEach((l, j) => card.raw(`${pad(j === 0 ? n : "", 3)} ${l}`));
    card.raw(`    ${p.kind === "company" ? "Virksomhed" : "Person"}, gemt ${formatDate(p.savedAt)}`);
  });
  const more = list.total - shown.length;
  if (more > 0) card.text(`og ${formatNumber(more)} flere`);
  const links = shown.flatMap((p, i) => (p.url ? [`${i + 1}. Åbn: ${p.url}`] : []));
  return [card.toString(), ...links].join("\n");
}

/** Tekstkort for visningen, eller null når den ikke har noget, der kan vises som tekst. */
export function textCard(spec: ViewSpec, ds: Dataset): string | null {
  // Tidslinje, nyheder og ejerdiagram har enten company eller person.
  const companies = [...new Set(spec.components.flatMap((c) => ("company" in c && typeof c.company === "string" ? [c.company] : [])))];
  const persons = [...new Set(spec.components.flatMap((c) => ("person" in c && typeof c.person === "string" ? [c.person] : [])))];
  const cards = [
    ...(companies.length === 1 ? [companyCard(spec, ds, companies[0]!)] : []),
    ...(persons.length === 1 ? [personCard(spec, ds, persons[0]!)] : []),
    listCard(spec, ds),
    changeFeedCard(spec, ds),
    savedPagesCard(spec, ds),
    summaryCard(spec),
  ].filter((c): c is string => Boolean(c));
  return cards.length ? cards.join("\n") : null;
}
