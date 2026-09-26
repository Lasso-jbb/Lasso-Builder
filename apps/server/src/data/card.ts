import {
  amountScale,
  chartSeries,
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
  personRisk,
  METRIC_FIELD,
  METRIC_KIND,
  METRIC_LABELS,
  searchKey,
  type Dataset,
  type FinancialsVM,
  type FinancialStatementsVM,
  type Metric,
  type OwnershipGraphVM,
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

const short = (v: number | null | undefined, metric: Metric) => {
  const kind = METRIC_KIND[metric];
  if (kind === "count") return formatNumber(v);
  if (kind === "percent") return formatPercent(v, false);
  return formatAmount(v).replace(" kr.", "");
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
  const scale = kind === "amount" ? amountScale(points.map((p) => p.value)) : null;
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
function statementRows(card: Card, label: string, rows: { label: string; values: readonly (number | null | undefined)[] }[], yearsShown: readonly number[]) {
  card.section(`${label} ${yearsShown.join("/")}`);
  for (const r of rows) {
    const parts = r.values.map((v) => (v == null ? "—" : amt(v)));
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
      { label: "Årets resultat", values: shown.map((y) => y.profit) },
    ],
    shown.map((y) => y.year),
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
    if (stmt && c.type === "LassoIncomeStatement" && c.company === lassoId) incomeStatementText(card, stmt, c.years);
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

  if (types.has("LassoTextSections")) {
    const t = ds.textSections[lassoId];
    if (t?.sections.length) {
      for (const s of t.sections) {
        card.section(s.heading);
        card.text(s.body);
      }
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


  const observations = types.has("LassoRiskObservations") ? ds.observations[lassoId] : undefined;
  if (observations) {
    card.section("Risikoobservationer");
    if (observations.observations.length === 0) {
      card.text("Ingen observationer fundet");
    } else {
      const sorted = [...observations.observations].sort((a, b) => b.severity - a.severity);
      const word = (s: number) => (s === 100 ? "Vigtig" : s === 50 ? "Mulig vigtig" : s === 25 ? "Info" : "Neutral");
      for (const o of sorted.slice(0, 3)) card.text(`${word(o.severity)}: ${o.title}`);
      if (sorted.length > 3) card.text(`Se ${sorted.length - 3} flere`);
    }
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

/** Katalog 16: personsiden som tekst. Hoved, roller pr. selskab, netværk og risiko. */
function personCard(spec: ViewSpec, ds: Dataset, lassoId: string): string | null {
  const types = new Set(spec.components.filter((c) => "person" in c && c.person === lassoId).map((c) => c.type));
  const p = ds.persons[lassoId];
  const card = new Card();
  const year = (d?: string) => (d ? d.slice(0, 4) : "");
  if (p) {
    const n = personCounts(p);
    card.text(p.name);
    card.text(["Person", p.city].filter(Boolean).join(", "));
    const pl = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
    card.text(`${pl(n.activeRoles, "aktiv rolle", "aktive roller")} i ${pl(n.activeCompanies, "selskab", "selskaber")}${n.endedRoles ? `, ${pl(n.endedRoles, "ophørt", "ophørte")}` : ""}`);
  }
  if (p && types.has("LassoPersonRoles")) {
    const companies = personCompanies(p);
    card.section("Roller");
    for (const c of companies.slice(0, 6)) {
      const ended = c.companyStatusKind === "warning" || c.companyStatusKind === "inactive";
      card.text(`${c.companyName}${ended ? ` (${(c.companyStatus ?? "ophørt").toLowerCase()})` : ""}`);
      for (const r of c.roles.slice(0, 2)) {
        const what = `${r.role}${r.share ? ` ${r.share}` : ""}`;
        const when = r.active ? (r.from ? `siden ${year(r.from)}` : "") : [year(r.from), year(r.to)].filter(Boolean).join("–");
        for (const l of wrap([what, when].filter(Boolean).join(", "), W - 2)) card.raw(`  ${l}`);
      }
    }
    if (companies.length > 6) card.text(`og ${companies.length - 6} flere selskaber`);
  }
  const net = types.has("LassoPersonNetwork") ? ds.personNetworks[lassoId] : undefined;
  if (net?.people.length) {
    card.section("Sidder sammen med");
    for (const x of net.people.slice(0, 5)) {
      const yrs = x.overlapYears < 1 ? "<1 år" : `${x.overlapYears} år`;
      wrap(x.name, W - 8).forEach((l, i, all) => card.raw(`${pad(l, W - 7)}${i === all.length - 1 ? padStart(yrs, 7) : ""}`));
    }
    if (net.people.length > 5) card.text(`og ${net.people.length - 5} flere`);
  }
  if (p && types.has("LassoPersonRisk")) {
    const risk = personRisk(p);
    card.section("Risiko");
    const word = (cases: typeof risk.bankruptcies) => (cases.length === 0 ? "Ingen" : cases.some((c) => c.involved) ? "Mulig vigtig" : "Info");
    card.row("Konkurser", `${risk.bankruptcies.length}, ${word(risk.bankruptcies)}`);
    card.row("Tvangsopl.", `${risk.dissolutions.length}, ${word(risk.dissolutions)}`);
    for (const c of [...risk.bankruptcies, ...risk.dissolutions].slice(0, 3)) {
      card.text(`${c.companyName}, ${c.status.toLowerCase()}${c.date ? ` ${year(c.date)}` : ""}${c.personLeft ? `, fratrådt ${year(c.personLeft)}` : ""}`);
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
    card.raw(`    ${[r.city, typeof v === "number" ? short(v, metric) : null].filter(Boolean).join(", ")}`);
  });
  return card.toString();
}

/** Tekstkort for visningen, eller null når den ikke har noget, der kan vises som tekst. */
export function textCard(spec: ViewSpec, ds: Dataset): string | null {
  const companies = [...new Set(spec.components.flatMap((c) => ("company" in c ? [c.company] : [])))];
  const persons = [...new Set(spec.components.flatMap((c) => ("person" in c ? [c.person] : [])))];
  const cards = [
    ...(companies.length === 1 ? [companyCard(spec, ds, companies[0]!)] : []),
    ...(persons.length === 1 ? [personCard(spec, ds, persons[0]!)] : []),
    listCard(spec, ds),
    summaryCard(spec),
  ].filter((c): c is string => Boolean(c));
  return cards.length ? cards.join("\n") : null;
}
