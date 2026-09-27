import type { ReactNode } from "react";
import {
  currencyUnit,
  formatAmount,
  formatDate,
  formatNumber,
  formatPercent,
  mainMetric,
  METRIC_FIELD,
  METRIC_LABELS,
  percentChange,
  riskSignals,
  extraSignals,
  type Dataset,
  type FinancialYear,
  type Metric,
  type ObservationRowVM,
  type RelationAssessment,
  type Severity,
} from "@lasso/spec";
import { LassoMark, LassoWordmark } from "../LassoMark.js";
import { SeverityIcon, severityWord } from "../primitives.js";

/**
 * Eksport, virksomhedsrapport som A4-PDF (katalog 27, node DO8-0). Det, der kommer ud,
 * når man trykker "Eksportér" på en virksomhed: A4 (794×1123 px ved 96 dpi, margen 56),
 * samme typografi og elementer som skærmen, men uden interaktion. Ingen knapper, ingen
 * hover, tal altid som tekst, grafer som vektor. Sidehoved og sidefod gentages på alle
 * sider; sidefoden bærer kilder, datastempel og sidetal "x af n". Sider uden data
 * udelades, og sidetallene beregnes derefter.
 *
 * Print-regler (katalog 27): alt i sort/grå + koral, ingen fyldte farveflader større end
 * 24 px, "Eksempeldata" må aldrig indgå i en rigtig rapport (kun demo).
 */
export interface ReportA4Props {
  /** Lasso-ID for virksomheden, fx "CVR-1-12345678". */
  company: string;
  dataset: Dataset;
  /** ISO-tidsstempel for genereringen; standard er datasættets generatedAt. */
  generatedAt?: string;
}

/** Hvor mange rækker en liste på siderne må fylde, før resten tælles ("og N flere"). */
const MAX_ROWS = 8;
/** Regnskabsår i tabellerne (seneste først). */
const YEARS = 5;

function formatStamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: formatDate(iso), time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`, time: `${pad(d.getHours())}.${pad(d.getMinutes())}` };
}

/** Samme tre trin som scoremåleren (katalog 10): 0–59 lav, 60–79 mulig, 80–100 høj. */
function scoreBand(score: number): { label: string; index: 0 | 1 | 2 } {
  if (score < 60) return { label: "Lav risiko", index: 0 };
  if (score < 80) return { label: "Mulig risiko", index: 1 };
  return { label: "Høj risiko", index: 2 };
}

/** "▲ 7,5 %" / "▼ underskud" som ren tekst med retning (katalog 09). */
function delta(prev: number | null | undefined, last: number | null | undefined): { text: string; tone: "up" | "down" | "" } {
  if (typeof prev !== "number" || typeof last !== "number") return { text: "", tone: "" };
  if (prev === last) return { text: "Uændret", tone: "" };
  if (prev !== 0 && Math.sign(prev) !== Math.sign(last)) return { text: last < 0 ? "▼ underskud" : "▲ overskud", tone: last < 0 ? "down" : "up" };
  const pct = percentChange([prev, last]);
  if (pct === null) return { text: "", tone: "" };
  return { text: `${pct < 0 ? "▼" : "▲"} ${formatPercent(Math.abs(pct), false)}`, tone: pct < 0 ? "down" : "up" };
}

/** Beløb i t. kr. som tekst med tusindtalspunktum og ægte minus; "—" når tallet mangler. */
function thousands(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return formatNumber(Math.round(v / 1000));
}

function pct(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? formatPercent(v, false) : "—";
}

/** Fælles skala for søjlegrafen: "mio. kr." osv., altid med én decimal i mio./mia. */
function chartScale(values: number[], unit: string): { divisor: number; label: string; fmt: (v: number) => string } {
  const max = Math.max(0, ...values.map((v) => Math.abs(v)));
  const one = new Intl.NumberFormat("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const minus = (s: string) => s.replace(/^-/, "−");
  if (max >= 1_000_000_000) return { divisor: 1e9, label: `mia. ${unit}`, fmt: (v) => minus(one.format(v / 1e9)) };
  if (max >= 1_000_000) return { divisor: 1e6, label: `mio. ${unit}`, fmt: (v) => minus(one.format(v / 1e6)) };
  if (max >= 10_000) return { divisor: 1e3, label: `t. ${unit}`, fmt: (v) => formatNumber(Math.round(v / 1e3)) };
  return { divisor: 1, label: unit, fmt: (v) => formatNumber(v) };
}

/** Pæne akseværdier 0..max i 4 trin (samme idé som charts.ts, men uden negativ skala). */
function ticks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v < max + step; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

/** Sidehoved: forsiden kun navnelogo + tidsstempel, øvrige sider navnelogo + virksomhed + CVR. */
function PageHead({ cover, name, cvr, stamp }: { cover?: boolean; name: string; cvr?: string; stamp: { date: string; time: string } }) {
  if (cover) {
    return (
      <header className="lasso-a4__head lasso-a4__head--cover">
        <LassoWordmark className="lasso-a4__wordmark" />
        <span className="lasso-a4__stamp">
          Virksomhedsrapport, genereret {stamp.date}
          {stamp.time ? ` kl. ${stamp.time}` : ""}
        </span>
      </header>
    );
  }
  return (
    <header className="lasso-a4__head">
      <span className="lasso-a4__head-left">
        <LassoWordmark className="lasso-a4__wordmark lasso-a4__wordmark--small" />
        <span className="lasso-a4__head-divider" aria-hidden="true" />
        <span className="lasso-a4__head-name">{name},</span>
        {cvr ? <span className="lasso-a4__head-cvr">CVR {cvr}</span> : null}
      </span>
      <span className="lasso-a4__stamp">Virksomhedsrapport, {stamp.date}</span>
    </header>
  );
}

function PageFoot({ sources, date, page, total }: { sources: string; date: string; page: number; total: number }) {
  return (
    <footer className="lasso-a4__foot">
      <span>
        Kilder: {sources}. Data pr. {date}
      </span>
      <span className="lasso-a4__foot-right">
        <LassoMark className="lasso-a4__mark" />
        <span>
          Udarbejdet i Lasso, lassox.com, side {page} af {total}
        </span>
      </span>
    </footer>
  );
}

interface PageDef {
  key: string;
  /** Overskrifter til indholdsfortegnelsen (forsiden har ingen). */
  toc: string[];
  render: (page: number, total: number) => ReactNode;
}

/** Regnskabsrække i tabellerne på side 3. */
interface Row {
  label: string;
  values: readonly string[];
  /** "line" = underpost 12/400 indrykket, "plain" = 12/400 uden indryk, "sum" = 12/600, "bottom" = 12/700 med 2 px ink-kant over. */
  kind?: "line" | "plain" | "sum" | "bottom";
}

function StatementTable({ title, years, rows }: { title: string; years: readonly number[]; rows: readonly Row[] }) {
  return (
    <div className="lasso-a4-stmt">
      <div className="lasso-a4-stmt__row lasso-a4-stmt__row--head">
        <span className="lasso-a4-stmt__label">{title}</span>
        {years.map((y, i) => (
          <span key={y} className={`lasso-a4-stmt__cell ${i === 0 ? "lasso-a4-stmt__cell--last" : ""}`}>
            {y}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div key={r.label} className={`lasso-a4-stmt__row lasso-a4-stmt__row--${r.kind ?? "line"}`}>
          <span className="lasso-a4-stmt__label">{r.label}</span>
          {r.values.map((v, i) => (
            <span
              key={years[i] ?? i}
              className={`lasso-a4-stmt__cell ${i === 0 ? "lasso-a4-stmt__cell--last" : ""} ${v === "—" ? "lasso-a4__faint" : ""} ${
                r.kind && r.kind !== "line" && v.startsWith("−") ? "lasso-a4__neg" : ""
              }`}
            >
              {v}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ReportA4({ company, dataset, generatedAt }: ReportA4Props) {
  const c = dataset.companies[company];
  const name = c?.name ?? company;
  const cvr = c?.cvr;
  const fin = dataset.financials[company];
  const years: FinancialYear[] = fin?.years ?? [];
  const last = years.at(-1);
  const prev = years.at(-2);
  const unit = currencyUnit(fin?.currency);
  const statements = dataset.financialStatements[company];
  const people = (dataset.people[company] ?? []).filter((p) => !p.to);
  const ownership = dataset.ownership[company];
  const owners = ownership?.owners ?? [];
  const beneficial = dataset.beneficialOwnership[company];
  const score = dataset.scores[company];
  const lassoObs = dataset.observations[company];
  const derived = riskSignals(company, dataset);
  const observations: ObservationRowVM[] = [...(lassoObs?.observations ?? []), ...extraSignals(lassoObs?.observations ?? [], derived.signals)].sort((a, b) => b.severity - a.severity);
  const auditor = dataset.auditorIndependence[company];
  const auditorName = auditor?.auditorName ?? ownership?.auditor?.name;

  const stamp = formatStamp(generatedAt ?? dataset.generatedAt);
  const sourceNames = ["CVR", ...(years.length ? ["Erhvervsstyrelsen (regnskaber)"] : []), ...(score?.source && score.score !== null ? [score.source] : [])].filter(
    (s, i, a) => a.indexOf(s) === i,
  );
  const sources = sourceNames.join(", ");

  const metric: Metric = years.length ? mainMetric(years) : "bruttofortjeneste";
  const field = METRIC_FIELD[metric];
  const mainValue = last ? (last[field] as number | null | undefined) : undefined;
  const mainPrev = prev ? (prev[field] as number | null | undefined) : undefined;
  const mainPct = percentChange([mainPrev, mainValue]);
  const coverDelta = mainPct !== null ? formatPercent(mainPct) : delta(mainPrev, mainValue).text;
  const firstYear = years.at(-YEARS)?.year ?? years[0]?.year;
  const span = last ? (firstYear && firstYear !== last.year ? `${firstYear}–${last.year}` : String(last.year)) : "";

  const pages: PageDef[] = [];

  // Side 2: Nøgletal seneste år, søjlegraf, ledelse og legale ejere.
  if (last || people.length || owners.length) {
    pages.push({
      key: "noegletal",
      toc: [...(last ? ["Nøgletal og udvikling"] : []), ...(people.length || owners.length ? ["Ledelse og ejere"] : [])],
      render: (page, total) => {
        const kpis: Metric[] = [metric, "resultat", "egenkapital", "soliditetsgrad", "ansatte"];
        const points = years.slice(-YEARS).flatMap((y) => (typeof y[field] === "number" ? [{ year: y.year, value: y[field] as number }] : []));
        const scale = chartScale(
          points.map((p) => p.value),
          unit,
        );
        const tk = ticks(Math.max(0, ...points.map((p) => p.value / scale.divisor)));
        const tMax = tk.at(-1)!;
        const plotH = 182;
        const yOf = (v: number) => plotH - (v / tMax) * plotH;
        const W = 640;
        const slot = W / Math.max(points.length, 1);
        const barW = 48;
        return (
          <section className="lasso-a4-page" key="p2">
            <PageHead name={name} cvr={cvr} stamp={stamp} />
            {last ? (
              <>
                <div className="lasso-a4-block">
                  <h2 className="lasso-a4__h2">Nøgletal {last.year}</h2>
                  <div className="lasso-a4-kpis">
                    {kpis.map((m) => {
                      const f = METRIC_FIELD[m];
                      const v = last[f] as number | null | undefined;
                      const p = prev?.[f] as number | null | undefined;
                      const d = delta(p, v);
                      const text = v == null ? "Ikke oplyst" : m === "ansatte" ? formatNumber(v) : m === "soliditetsgrad" ? formatPercent(v, false) : formatAmount(v, unit);
                      return (
                        <div key={m} className="lasso-a4-kpi">
                          <span className="lasso-a4-kpi__label">{m === "resultat" ? "Resultat efter skat" : METRIC_LABELS[m]}</span>
                          <span className={`lasso-a4-kpi__value ${v == null ? "lasso-a4__faint" : ""}`}>{text}</span>
                          <span className={`lasso-a4-kpi__delta ${d.tone === "up" ? "lasso-a4__up" : d.tone === "down" ? "lasso-a4__down" : ""}`}>
                            {d.text}
                            {d.text && prev && d.text !== "Uændret" && m === metric ? ` fra ${prev.year}` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {points.length > 0 ? (
                  <div className="lasso-a4-block">
                    <div className="lasso-a4__titlerow">
                      <h2 className="lasso-a4__h2">
                        {METRIC_LABELS[metric]} {points.length > 1 ? `${points[0]!.year}–${points.at(-1)!.year}` : points[0]!.year}
                      </h2>
                      <span className="lasso-a4__note">{scale.label.endsWith(".") ? scale.label : `${scale.label}.`} Kilde: årsrapporter</span>
                    </div>
                    <svg className="lasso-a4-chart" width={682} height={plotH + 40} viewBox={`0 0 682 ${plotH + 40}`} role="img" aria-label={`${METRIC_LABELS[metric]} pr. år, ${scale.label}`}>
                      {tk.map((t) => (
                        <g key={t}>
                          <line className={t === 0 ? "lasso-a4-chart__axis" : "lasso-a4-chart__grid"} x1={32} x2={682} y1={6 + yOf(t)} y2={6 + yOf(t)} />
                          <text className="lasso-a4-chart__tick" x={22} y={6 + yOf(t) + 4} textAnchor="end">
                            {formatNumber(t)}
                          </text>
                        </g>
                      ))}
                      {points.map((p, i) => {
                        const isLast = i === points.length - 1;
                        const v = p.value / scale.divisor;
                        const x = 32 + i * slot + (slot - barW) / 2;
                        const y0 = 6 + yOf(0);
                        const yv = 6 + yOf(Math.max(0, v));
                        const h = Math.max(1, y0 - yv);
                        return (
                          <g key={p.year}>
                            <rect className={`lasso-a4-chart__bar ${isLast ? "lasso-a4-chart__bar--last" : ""}`} x={x} y={yv} width={barW} height={h} rx={4} />
                            <text className={`lasso-a4-chart__value ${isLast ? "lasso-a4-chart__value--last" : ""}`} x={x + barW / 2} y={yv - 6} textAnchor="middle">
                              {scale.fmt(p.value)}
                            </text>
                            <text className={`lasso-a4-chart__label ${isLast ? "lasso-a4-chart__label--last" : ""}`} x={x + barW / 2} y={plotH + 32} textAnchor="middle">
                              {p.year}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                ) : null}
              </>
            ) : null}
            {people.length || owners.length ? (
              <div className="lasso-a4-cols">
                <div className="lasso-a4-col">
                  <h3 className="lasso-a4__h3">Ledelse</h3>
                  {people.length ? (
                    <div className="lasso-a4-rows">
                      {people.slice(0, MAX_ROWS).map((p, i) => (
                        <div key={`${p.name}-${i}`} className="lasso-a4-row">
                          <span className="lasso-a4-row__name">{p.name}</span>
                          <span className="lasso-a4-row__side">{p.role}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="lasso-a4__note">Der er ingen registrerede personer i ledelsen.</p>
                  )}
                  {people.length > MAX_ROWS ? <p className="lasso-a4__note">og {people.length - MAX_ROWS} flere</p> : null}
                  <p className="lasso-a4__note">
                    Revisor: {ownership?.auditor?.name ?? auditorName ?? "Ikke oplyst"}
                    {ownership?.auditor?.from ? `, siden ${formatDate(ownership.auditor.from)}` : ""}
                  </p>
                </div>
                <div className="lasso-a4-col">
                  <h3 className="lasso-a4__h3">Legale ejere</h3>
                  {owners.length ? (
                    <div className="lasso-a4-rows">
                      {owners.slice(0, MAX_ROWS).map((o, i) => (
                        <div key={`${o.name}-${i}`} className="lasso-a4-row">
                          <span className="lasso-a4-row__name">{o.name}</span>
                          <span className={`lasso-a4-row__value ${o.share ? "" : "lasso-a4__faint"}`}>{o.share ?? "Ikke oplyst"}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="lasso-a4__note">Der er ingen registrerede legale ejere i CVR.</p>
                  )}
                  {owners.length > MAX_ROWS ? <p className="lasso-a4__note">og {owners.length - MAX_ROWS} flere</p> : null}
                  <p className="lasso-a4__note">Ejerandele som CVR-intervaller{beneficial ? `, reelle ejere på side ${total}` : ""}</p>
                </div>
              </div>
            ) : null}
            <PageFoot sources={sources} date={stamp.date} page={page} total={total} />
          </section>
        );
      },
    });
  }

  // Side 3: Regnskab 5 år, seneste først.
  const shownYears = years.slice(-YEARS).reverse();
  if (shownYears.length) {
    pages.push({
      key: "regnskab",
      toc: [`Regnskab ${span}`],
      render: (page, total) => {
        const ys = shownYears.map((y) => y.year);
        const inc = ys.map((y) => statements?.incomeStatement.find((s) => s.year === y));
        const bal = ys.map((y) => statements?.balanceSheet.find((s) => s.year === y));
        const revenueTop = shownYears.some((y) => y.revenue != null);
        const income: Row[] = [
          ...(revenueTop ? [{ label: "Omsætning", values: shownYears.map((y) => thousands(y.revenue)), kind: "sum" as const }] : []),
          { label: "Bruttofortjeneste", values: shownYears.map((y) => thousands(y.grossProfit)), kind: "sum" },
          { label: "Personaleomkostninger", values: inc.map((s) => thousands(s?.staffCosts)) },
          { label: "Andre driftsomkostninger", values: inc.map((s) => thousands(s?.otherOperatingCosts)) },
          { label: "EBITDA", values: shownYears.map((y, i) => thousands(y.ebitda ?? inc[i]?.ebitda)), kind: "sum" },
          { label: "Af- og nedskrivninger", values: inc.map((s) => thousands(s?.depreciation)) },
          { label: "Finansielle poster, netto", values: inc.map((s) => thousands(s?.financialItemsNet)) },
          { label: "Resultat før skat", values: inc.map((s) => thousands(s?.profitBeforeTax)), kind: "sum" },
          { label: "Skat af årets resultat", values: inc.map((s) => thousands(s?.tax)) },
          { label: "Årets resultat", values: shownYears.map((y) => thousands(y.profit)), kind: "bottom" },
        ];
        const balance: Row[] = [
          { label: "Anlægsaktiver", values: bal.map((s) => thousands(s?.fixedAssetsTotal)) },
          { label: "Omsætningsaktiver", values: bal.map((s) => thousands(s?.currentAssetsTotal)) },
          { label: "Aktiver i alt", values: shownYears.map((y, i) => thousands(y.assetsTotal ?? bal[i]?.assetsTotal)), kind: "sum" },
          { label: "Egenkapital", values: shownYears.map((y) => thousands(y.equity)), kind: "sum" },
          { label: "Langfristet gæld", values: bal.map((s) => thousands(s?.longTermLiabilities)) },
          { label: "Kortfristet gæld", values: bal.map((s) => thousands(s?.shortTermLiabilities)) },
          { label: "Passiver i alt", values: shownYears.map((y, i) => thousands(bal[i]?.liabilitiesAndEquityTotal ?? y.assetsTotal)), kind: "bottom" },
        ];
        const ratios: Row[] = [
          { label: "Soliditetsgrad", values: shownYears.map((y) => pct(y.soliditetsgrad)), kind: "plain" },
          { label: "Likviditetsgrad", values: shownYears.map((y) => pct(y.likviditetsgrad)), kind: "plain" },
          { label: "Overskudsgrad", values: shownYears.map((y) => pct(y.overskudsgrad)), kind: "plain" },
          { label: "Ansatte (årsrapport)", values: shownYears.map((y) => (typeof y.employees === "number" ? formatNumber(y.employees) : "—")), kind: "plain" },
        ];
        const period = last?.periodStart && last.periodEnd ? `regnskabsår ${formatDate(last.periodStart).slice(0, 5)}–${formatDate(last.periodEnd).slice(0, 5)}` : "";
        const scopeNote = shownYears.some((y) => y.scope === "Koncern") ? "Koncerntal, hvor koncernregnskab findes. " : "";
        return (
          <section className="lasso-a4-page" key="p3">
            <PageHead name={name} cvr={cvr} stamp={stamp} />
            <div className="lasso-a4__titlerow">
              <h2 className="lasso-a4__h2">Regnskab {span}</h2>
              <span className="lasso-a4__note">
                t. {unit}
                {period ? `, ${period}` : ""}. Kilde: årsrapporter
              </span>
            </div>
            <StatementTable title="Resultatopgørelse" years={ys} rows={income} />
            <StatementTable title="Balance pr. 31.12" years={ys} rows={balance} />
            <StatementTable title="Nøgletal" years={ys} rows={ratios} />
            <p className="lasso-a4__note lasso-a4__note--small">
              {scopeNote}Hovedtal (omsætning/bruttofortjeneste, årets resultat, egenkapital, balancesum, ansatte) er fra årsrapporterne. Underposter og nøgletal er beregnet eller
              hentet fra XBRL og kan mangle ("—").
            </p>
            <PageFoot sources={sources} date={stamp.date} page={page} total={total} />
          </section>
        );
      },
    });
  }

  // Side 4: Kreditvurdering, risikoobservationer, reelle ejere, revisor og "Om rapporten".
  if (score || observations.length || beneficial || auditorName || auditor) {
    pages.push({
      key: "risiko",
      toc: ["Kreditvurdering og risiko", ...(beneficial || owners.length ? ["Reelle ejere og ejerstruktur"] : []), ...(auditorName || auditor ? ["Revisor og uafhængighed"] : [])],
      render: (page, total) => {
        const value = score && score.score !== null ? Math.max(0, Math.min(100, score.score)) : null;
        const band = value !== null ? scoreBand(value) : null;
        const relations = [...(auditor?.relations ?? [])].sort((a, b) => b.assessment - a.assessment);
        const toSeverity = (a: RelationAssessment): Severity => a;
        return (
          <section className="lasso-a4-page" key="p4">
            <PageHead name={name} cvr={cvr} stamp={stamp} />
            <div className="lasso-a4-cols">
              <div className="lasso-a4-col">
                <h2 className="lasso-a4__h2">Kreditvurdering</h2>
                {value !== null && band ? (
                  <>
                    <div className="lasso-a4-score">
                      <span className="lasso-a4-score__number">
                        {Math.round(value)}
                        <span className="lasso-a4-score__of">af 100</span>
                      </span>
                      <span className="lasso-a4-score__text">
                        <span className={`lasso-a4-score__band lasso-a4-score__band--${band.index}`}>{band.label}</span>
                        <span className="lasso-a4__small">
                          {score?.source ?? "Lasso"}
                          {score?.updated ? `, ${formatDate(score.updated)}` : ""}
                        </span>
                      </span>
                    </div>
                    <div className="lasso-a4-scale">
                      <div className="lasso-a4-scale__track" aria-hidden="true">
                        <span className="lasso-a4-scale__seg lasso-a4-scale__seg--0" />
                        <span className="lasso-a4-scale__seg lasso-a4-scale__seg--1" />
                        <span className="lasso-a4-scale__seg lasso-a4-scale__seg--2" />
                        <span className="lasso-a4-scale__marker" style={{ left: `${value}%` }} />
                      </div>
                      <div className="lasso-a4-scale__labels">
                        <span>0, lav risiko</span>
                        <span>60</span>
                        <span>80</span>
                        <span>100, høj risiko</span>
                      </div>
                    </div>
                    <p className="lasso-a4__small">Score 0 (lav risiko) til 100 (høj risiko). Vurderingen er en modelvurdering og ikke en garanti.</p>
                  </>
                ) : (
                  <>
                    <p className="lasso-a4-score__missing">Ikke oplyst</p>
                    <p className="lasso-a4__small">Der findes ingen kreditvurdering for virksomheden.</p>
                  </>
                )}
              </div>
              <div className="lasso-a4-col">
                <h2 className="lasso-a4__h2">Risikoobservationer</h2>
                {observations.length ? (
                  <div className="lasso-a4-obs">
                    {observations.slice(0, 5).map((o) => (
                      <div key={o.id} className="lasso-a4-obs__row">
                        <span className="lasso-a4-obs__icon">
                          <SeverityIcon severity={o.severity} />
                        </span>
                        <span className="lasso-a4-obs__main">
                          <span className="lasso-a4-obs__title">
                            {o.severity === 0 ? "" : `${severityWord(o.severity)}, `}
                            {o.title}
                          </span>
                          {o.detail ? <span className="lasso-a4-obs__detail">{o.detail}</span> : null}
                          {o.source || o.date ? <span className="lasso-a4-obs__meta">{[o.source, o.date ? formatDate(o.date) : null].filter(Boolean).join(", ")}</span> : null}
                        </span>
                      </div>
                    ))}
                    {observations.length > 5 ? <p className="lasso-a4__note">og {observations.length - 5} flere</p> : null}
                  </div>
                ) : (
                  <p className="lasso-a4__small">
                    {lassoObs?.checkedAt ? `Lasso har gennemgået virksomheden og fandt intet at bemærke. Tjekket ${formatDate(lassoObs.checkedAt)}.` : "Lasso har ingen observationer om virksomheden."}
                  </p>
                )}
              </div>
            </div>

            {beneficial || owners.length ? (
              <div className="lasso-a4-block">
                <h2 className="lasso-a4__h2">Reelle ejere og ejerstruktur</h2>
                <div className="lasso-a4-cols">
                  <div className="lasso-a4-col">
                    <div className="lasso-a4-table">
                      <div className="lasso-a4-table__row lasso-a4-table__row--head">
                        <span className="lasso-a4-table__label">Legal ejer</span>
                        <span className="lasso-a4-table__cell">Ejerandel</span>
                        <span className="lasso-a4-table__cell">Stemmer</span>
                      </div>
                      {owners.slice(0, MAX_ROWS).map((o, i) => (
                        <div key={`${o.name}-${i}`} className="lasso-a4-table__row">
                          <span className="lasso-a4-table__label">{o.name}</span>
                          <span className={`lasso-a4-table__cell ${o.share ? "" : "lasso-a4__faint"}`}>{o.share ?? "Ikke oplyst"}</span>
                          <span className={`lasso-a4-table__cell ${o.votes ?? o.share ? "" : "lasso-a4__faint"}`}>{o.votes ?? o.share ?? "Ikke oplyst"}</span>
                        </div>
                      ))}
                      {owners.length === 0 ? (
                        <div className="lasso-a4-table__row">
                          <span className="lasso-a4-table__label lasso-a4__faint">Ingen registrerede legale ejere</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="lasso-a4-col">
                    <div className="lasso-a4-table__row lasso-a4-table__row--head">
                      <span className="lasso-a4-table__label">Reelle ejere (personer bag holdingselskaber)</span>
                    </div>
                    {beneficial && beneficial.owners.length ? (
                      <div className="lasso-a4-table">
                        {beneficial.owners.slice(0, MAX_ROWS).map((o, i) => (
                          <div key={`${o.name}-${i}`} className="lasso-a4-table__row lasso-a4-table__row--tall">
                            <span className="lasso-a4-table__label">
                              {o.name}
                              {o.chain ? <span className="lasso-a4-table__sub">{o.chain}</span> : null}
                            </span>
                            <span className={`lasso-a4-table__cell lasso-a4-table__cell--wide ${o.share ? "" : "lasso-a4__faint"}`}>{o.share ? `Reelt ${o.share}` : "Ikke oplyst"}</span>
                          </div>
                        ))}
                        {(beneficial.gaps ?? []).map((g, i) => (
                          <div key={`gap-${i}`} className="lasso-a4-table__row lasso-a4-table__row--tall">
                            <span className="lasso-a4-table__label">
                              Ingen reel ejer for {g.share ?? "en del af ejerskabet"}
                              {g.reason ? <span className="lasso-a4-table__sub">{g.reason}</span> : null}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="lasso-a4-empty">
                        {beneficial?.gaps?.length
                          ? `Ingen reel ejer registreret for ${beneficial.gaps.map((g) => g.share ?? "en del af ejerskabet").join(", ")}`
                          : "Der er ikke registreret nogen reel ejer for virksomheden"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {auditorName || auditor ? (
              <div className="lasso-a4-block">
                <h2 className="lasso-a4__h2">Revisor og uafhængighed</h2>
                <div className="lasso-a4-cols">
                  <div className="lasso-a4-col">
                    <span className="lasso-a4__strong">{auditorName ?? "Ikke oplyst"}</span>
                    <span className="lasso-a4__small">
                      {ownership?.auditor?.from ? `Revisor siden ${formatDate(ownership.auditor.from)}` : "Revisor ifølge CVR"}
                      {auditor?.checkedAt ? `, relationer tjekket ${formatDate(auditor.checkedAt)}` : ""}
                    </span>
                  </div>
                  <div className="lasso-a4-col">
                    {relations.length ? (
                      relations.slice(0, 4).map((r) => (
                        <span key={r.id} className="lasso-a4-rel">
                          <SeverityIcon severity={toSeverity(r.assessment)} />
                          <span>
                            {severityWord(r.assessment, "assessment")}, {r.name}: {r.relation}
                            {r.to ? " (afsluttet)" : ""}
                          </span>
                        </span>
                      ))
                    ) : (
                      <span className="lasso-a4-rel">
                        <SeverityIcon severity={0} />
                        <span>{auditor?.unavailableReason ?? "Ingen fundne relationer mellem revisor, kunden og personer"}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="lasso-a4-about">
              <span className="lasso-a4__strong">Om rapporten</span>
              <span className="lasso-a4-about__text">
                Data er samlet af Lasso fra {sources}. Ejerandele vises som CVR-intervaller. En kreditscore er en modelvurdering og ikke en garanti. Rapporten er genereret{" "}
                {stamp.date}
                {stamp.time ? ` kl. ${stamp.time}` : ""} og afspejler data på dette tidspunkt.
                {dataset.source === "demo" ? " Alle tal er eksempeldata." : ""}
              </span>
            </div>
            <PageFoot sources={sources} date={stamp.date} page={page} total={total} />
          </section>
        );
      },
    });
  }

  const total = pages.length + 1;
  const toc: { title: string; page: number }[] = pages.flatMap((p, i) => p.toc.map((title) => ({ title, page: i + 2 })));
  const facts = [
    [cvr ? `CVR ${cvr}` : null, c?.form, c?.status].filter(Boolean).join(", "),
    c?.address ? [c.address.street, [c.address.zip, c.address.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "",
    [c?.industryCode, c?.industryText].filter(Boolean).join(" "),
  ].filter(Boolean);
  const scoreText = score && score.score !== null ? `${Math.round(score.score)}, ${scoreBand(score.score).label.toLowerCase()}` : "Ikke oplyst";

  return (
    <div className="lasso-a4">
      <section className="lasso-a4-page lasso-a4-page--cover" key="p1">
        <PageHead cover name={name} cvr={cvr} stamp={stamp} />
        <div className="lasso-a4-cover">
          <span className="lasso-a4__overline">Virksomhedsrapport</span>
          <h1 className="lasso-a4-cover__name">{name}</h1>
          <p className="lasso-a4-cover__facts">
            {facts.map((f, i) => (
              <span key={i}>
                {f}
                <br />
              </span>
            ))}
          </p>
          <div className="lasso-a4-cover__figures">
            <div className="lasso-a4-cover__figure">
              <span className="lasso-a4-cover__label">Kreditscore</span>
              <span className={`lasso-a4-cover__value ${score && score.score !== null ? "" : "lasso-a4__faint"}`}>{scoreText}</span>
            </div>
            <div className="lasso-a4-cover__figure">
              <span className="lasso-a4-cover__label">
                {METRIC_LABELS[metric]}
                {last ? ` ${last.year}` : ""}
                {coverDelta ? `, ${coverDelta}` : ""}
              </span>
              <span className={`lasso-a4-cover__value ${mainValue == null ? "lasso-a4__faint" : ""}`}>{mainValue == null ? "Ikke oplyst" : formatAmount(mainValue, unit)}</span>
            </div>
            <div className="lasso-a4-cover__figure">
              <span className="lasso-a4-cover__label">Ansatte</span>
              <span className={`lasso-a4-cover__value lasso-a4-cover__value--ink ${typeof c?.employees === "number" ? "" : "lasso-a4__faint"}`}>
                {typeof c?.employees === "number" ? formatNumber(c.employees) : "Ikke oplyst"}
              </span>
            </div>
          </div>
        </div>
        <div className="lasso-a4-toc">
          <span className="lasso-a4__overline lasso-a4__overline--muted">Indhold</span>
          <div className="lasso-a4-toc__rows">
            {toc.length ? (
              toc.map((t) => (
                <div key={t.title} className="lasso-a4-toc__row">
                  <span>{t.title}</span>
                  <span className="lasso-a4-toc__page">{t.page}</span>
                </div>
              ))
            ) : (
              <span className="lasso-a4__note">Der er ingen data ud over stamdata for virksomheden.</span>
            )}
          </div>
        </div>
        <PageFoot sources={sources} date={stamp.date} page={1} total={total} />
      </section>
      {pages.map((p, i) => p.render(i + 2, total))}
    </div>
  );
}
