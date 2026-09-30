import type { ReactNode } from "react";
import { moreText,
  statusGroup,
  currencyUnit,
  formatAmount,
  formatDate,
  formatNumber,
  formatPercent,
  mainMetric,
  METRIC_FIELD,
  METRIC_LABELS,
  changePercent,
  personCompanies,
  personCounts,
  personRisk,
  textSectionsFor,
  type Dataset,
  type FinancialYear,
  type Metric,
} from "@lasso/spec";
import { LassoMark, LassoWordmark } from "../LassoMark.js";
import { observationLevel, sortObservations } from "./RiskObservations.js";
import { severityWord } from "../primitives.js";

/**
 * Rapporter og PDF som A4 (katalog 27 "Rapporter og PDF, A4", node DO8-0). To slags PDF:
 * standardrapporter (virksomhed 27.1-27.2, person 27.4) og "det man står i" (27.3, fx regnskabsanalysen
 * 19.6). A4 (794×1123 px ved 96 dpi, margen 56), samme typografi og elementer som skærmen, men uden
 * interaktion. Ingen knapper, ingen hover, tal altid som tekst, grafer som vektor. Sidehoved og sidefod
 * gentages på alle sider; sidefoden bærer "Data pr. …" og sidetal "x af n" (ingen kildevisning, G3).
 * Sider og blokke uden data udelades, og sidetallene beregnes derefter.
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

/** Samme tre trin som scoremåleren (katalog 10.1/18.1): 0–59 lav, 60–79 moderat, 80–100 høj (100 = høj risiko). */
function scoreBand(score: number): { label: string; short: string; index: 0 | 1 | 2 } {
  if (score < 60) return { label: "Lav risiko", short: "lav", index: 0 };
  if (score < 80) return { label: "Moderat risiko", short: "moderat", index: 1 };
  return { label: "Høj risiko", short: "høj", index: 2 };
}

/** "▲ 7,5 %" / "▼ 163,2 %" som ren tekst med retning (02c.4: pil + procent, også ved fortegnsskift). */
function delta(prev: number | null | undefined, last: number | null | undefined): { text: string; tone: "up" | "down" | "" } {
  if (typeof prev !== "number" || typeof last !== "number") return { text: "", tone: "" };
  if (prev === last) return { text: "Uændret", tone: "" };
  const pct = changePercent(prev, last);
  if (pct === null) return { text: "", tone: "" };
  return { text: `${pct < 0 ? "▼" : "▲"} ${formatPercent(Math.abs(pct), false)}`, tone: pct < 0 ? "down" : "up" };
}

/** Beløb i t. kr. som tekst med tusindtalspunktum og ægte minus; "-" når tallet mangler. */
function thousands(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-";
  return formatNumber(Math.round(v / 1000));
}

function pct(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? formatPercent(v, false) : "-";
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
              className={`lasso-a4-stmt__cell ${i === 0 ? "lasso-a4-stmt__cell--last" : ""} ${v === "-" ? "lasso-a4__faint" : ""} ${
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

/**
 * Sidehoved (27, 19.6): forsiden og enkeltsider med stor titel har navnelogo + etiket til højre
 * ("Virksomhedsrapport, genereret …"); øvrige sider navnelogo | NAVN, CVR over en linje og etiketten
 * til højre ("Virksomhedsrapport, 25.09.2026", "Regnskab, hentet …", "Personrapport, …"). G9: navnet
 * står alene; en person har ingen CVR.
 */
function PageHead({ cover, label, name, cvr }: { cover?: boolean; label: string; name?: string; cvr?: string }) {
  if (cover) {
    return (
      <header className="lasso-a4__head lasso-a4__head--cover">
        <LassoWordmark className="lasso-a4__wordmark" />
        <span className="lasso-a4__stamp">{label}</span>
      </header>
    );
  }
  return (
    <header className="lasso-a4__head">
      <span className="lasso-a4__head-left">
        <LassoWordmark className="lasso-a4__wordmark lasso-a4__wordmark--small" />
        <span className="lasso-a4__head-divider" aria-hidden="true" />
        <span className="lasso-a4__head-name">
          {name}
          {cvr ? "," : ""}
        </span>
        {cvr ? <span className="lasso-a4__head-cvr">CVR {cvr}</span> : null}
      </span>
      <span className="lasso-a4__stamp">{label}</span>
    </header>
  );
}

/** Sidefod (27): "Data pr. …" til venstre (ingen kildevisning, G3), Lasso-ikon og "side x af n" til højre. */
function PageFoot({ date, page, total, left }: { date: string; page: number; total: number; left?: string }) {
  return (
    <footer className="lasso-a4__foot">
      <span>{left ?? `Data pr. ${date}`}</span>
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

/** Nøgle-værdi-række (27.2 "Kontakt og oplysninger", 19.6 "Tal der indgår i analysen"). */
function KvRows({ rows, className = "" }: { rows: readonly { label: string; value: string; tone?: "ok" | "warning" | "danger" | "muted" }[]; className?: string }) {
  return (
    <div className={`lasso-a4-kv ${className}`}>
      {rows.map((r) => (
        <div key={r.label} className="lasso-a4-kv__row">
          <span className="lasso-a4-kv__label">{r.label}</span>
          <span className={`lasso-a4-kv__value${r.tone ? ` lasso-a4-kv__value--${r.tone}` : ""}`}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Måleren (samme tre zoner som 10.1/18.1) med markør og akselabels "0, lav risiko" / "Høj risiko, 100". */
function ScoreScale({ value }: { value: number }) {
  return (
    <div className="lasso-a4-scale">
      <div className="lasso-a4-scale__track" aria-hidden="true">
        <span className="lasso-a4-scale__seg lasso-a4-scale__seg--0" />
        <span className="lasso-a4-scale__seg lasso-a4-scale__seg--1" />
        <span className="lasso-a4-scale__seg lasso-a4-scale__seg--2" />
        <span className="lasso-a4-scale__marker" style={{ left: `${value}%` }} />
      </div>
      <div className="lasso-a4-scale__labels">
        <span>0, lav risiko</span>
        <span>Høj risiko, 100</span>
      </div>
    </div>
  );
}

/** "01.01–31.12" ud fra seneste regnskabsperiode. */
function periodText(y: FinancialYear | undefined): string | undefined {
  if (!y?.periodStart || !y.periodEnd) return undefined;
  return `${formatDate(y.periodStart).slice(0, 5)}–${formatDate(y.periodEnd).slice(0, 5)}`;
}

function companyStamp(dataset: Dataset, generatedAt?: string) {
  return formatStamp(generatedAt ?? dataset.generatedAt);
}

/**
 * Standard virksomhedsrapport som A4-PDF (katalog 27.1 + 27.2, Paper DO8-0). Det, der kommer ud, når man
 * vælger "Virksomhedsrapport (PDF)" på en virksomhed: to sider med kun det relevante for et overblik.
 * Side 1 (27.1) er forsiden: navnelogo, overlinje, navn, CVR/form/status, adresse, branche, risikoscore,
 * hovedtal og ansatte, og indholdsfortegnelsen nederst. Side 2 (27.2) er overblikket: nøgletal for seneste
 * år (pil + procent), grafen for hovedtallet over 5 år, ledelse og legale ejere, og båndet MIT-0 med
 * Risiko (score, måler og de to vigtigste observationer) og Kontakt og oplysninger. A4 794×1123 px ved
 * 96 dpi, margen 56, samme typografi som skærmen, uden interaktion; sidefoden bærer kun "Data pr. …" og
 * sidetal (G3: ingen kildevisning). Blokke uden data udelades. "Eksempeldata" indgår kun i demo.
 * Rapport "af det man står i" (27.3): se StatementsReportA4 og AnalysisReportA4.
 */
export function ReportA4({ company, dataset, generatedAt }: ReportA4Props) {
  const c = dataset.companies[company];
  const name = c?.name ?? company;
  const cvr = c?.cvr;
  const fin = dataset.financials[company];
  const years: FinancialYear[] = fin?.years ?? [];
  const last = years.at(-1);
  const prev = years.at(-2);
  const unit = currencyUnit(fin?.currency);
  const people = (dataset.people[company] ?? []).filter((p) => !p.to);
  const ownership = dataset.ownership[company];
  const owners = ownership?.owners ?? [];
  const beneficial = dataset.beneficialOwnership[company];
  const score = dataset.scores[company];
  const scoreValue = score && score.score !== null && (score.state ?? "ok") === "ok" ? Math.max(0, Math.min(100, score.score)) : null;
  const lassoObs = dataset.observations[company];
  const observations = lassoObs ? sortObservations(lassoObs.observations.filter((o) => !o.notAvailable)) : [];
  const auditorName = ownership?.auditor?.name ?? dataset.auditorIndependence[company]?.auditorName;
  const contact = dataset.contact[company];
  const units = dataset.productionUnits[company]?.units ?? [];

  const stamp = companyStamp(dataset, generatedAt);
  const metric: Metric = years.length ? mainMetric(years) : "bruttofortjeneste";
  const field = METRIC_FIELD[metric];
  const mainValue = last ? (last[field] as number | null | undefined) : undefined;
  const mainPrev = prev ? (prev[field] as number | null | undefined) : undefined;
  const coverDelta = delta(mainPrev, mainValue).text;

  const phone = c?.phone ?? contact?.phone;
  const email = c?.email ?? contact?.email;
  const web = c?.website ?? contact?.website;
  const activeUnits = units.filter((u) => u.statusKind !== "inactive" && !u.endedYear);
  const contactRows = [
    ...(phone ? [{ label: "Telefon", value: phone }] : []),
    ...(email ? [{ label: "E-mail", value: email }] : []),
    ...(web ? [{ label: "Web", value: web.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") }] : []),
    ...(periodText(last) ? [{ label: "Regnskabsperiode", value: periodText(last)! }] : []),
    ...(c?.founded ? [{ label: "Stiftet", value: formatDate(c.founded) }] : []),
    ...(activeUnits.length ? [{ label: "Produktionsenheder", value: activeUnits.length === 1 && activeUnits[0]!.address?.city ? `1, ${activeUnits[0]!.address.city}` : formatNumber(activeUnits.length) }] : []),
  ];
  const hasRisk = scoreValue !== null || observations.length > 0;

  const toc = [
    ...(last ? ["Nøgletal og udvikling"] : []),
    ...(people.length || owners.length ? ["Ledelse, ejere og revisor"] : []),
    ...(hasRisk ? ["Risiko og observationer"] : []),
    ...(contactRows.length ? ["Kontakt og oplysninger"] : []),
  ];
  const pages: PageDef[] = [];
  if (toc.length) {
    pages.push({
      key: "overblik",
      toc,
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
        // 27.2: søjler ca. 40 px som i Paper (koral-soft, seneste år koral); tallet står som tekst over søjlen.
        const barW = 40;
        const band = scoreValue !== null ? scoreBand(scoreValue) : null;
        const beneficialNames = beneficial?.owners.map((o) => o.name) ?? [];
        return (
          <section className="lasso-a4-page" key="p2">
            <PageHead name={name} cvr={cvr} label={`Virksomhedsrapport, ${stamp.date}`} />
            {last ? (
              <>
                <div className="lasso-a4-block">
                  <h2 className="lasso-a4__h2">Nøgletal {last.year}</h2>
                  <div className="lasso-a4-kpis">
                    {kpis.map((m) => {
                      const f = METRIC_FIELD[m];
                      const v = last[f] as number | null | undefined;
                      const p = prev?.[f] as number | null | undefined;
                      // 27.2: soliditetsgraden har "af aktiver" under tallet i stedet for en ændring.
                      const d = m === "soliditetsgrad" ? { text: "af aktiver", tone: "" as const } : delta(p, v);
                      const text = v == null ? "Ikke oplyst" : m === "ansatte" ? formatNumber(v) : m === "soliditetsgrad" ? formatPercent(v, false) : formatAmount(v, unit);
                      return (
                        <div key={m} className="lasso-a4-kpi">
                          <span className="lasso-a4-kpi__label">{m === "resultat" ? "Resultat efter skat" : METRIC_LABELS[m]}</span>
                          <span className={`lasso-a4-kpi__value ${v == null ? "lasso-a4__faint" : ""}`}>{text}</span>
                          <span className={`lasso-a4-kpi__delta ${d.tone === "up" ? "lasso-a4__up" : d.tone === "down" ? "lasso-a4__down" : ""}`}>{d.text}</span>
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
                      <span className="lasso-a4__note">{scale.label}</span>
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
                      {points.map((pt, i) => {
                        const isLast = i === points.length - 1;
                        const v = pt.value / scale.divisor;
                        const x = 32 + i * slot + (slot - barW) / 2;
                        const y0 = 6 + yOf(0);
                        const yv = 6 + yOf(Math.max(0, v));
                        const h = Math.max(1, y0 - yv);
                        return (
                          <g key={pt.year}>
                            <rect className={`lasso-a4-chart__bar ${isLast ? "lasso-a4-chart__bar--last" : ""}`} x={x} y={yv} width={barW} height={h} rx={3} />
                            <text className={`lasso-a4-chart__value ${isLast ? "lasso-a4-chart__value--last" : ""}`} x={x + barW / 2} y={yv - 6} textAnchor="middle">
                              {scale.fmt(pt.value)}
                            </text>
                            <text className={`lasso-a4-chart__label ${isLast ? "lasso-a4-chart__label--last" : ""}`} x={x + barW / 2} y={plotH + 32} textAnchor="middle">
                              {pt.year}
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
                  {people.length > MAX_ROWS ? <p className="lasso-a4__note">og {moreText(people.length - MAX_ROWS)}</p> : null}
                  {auditorName ? (
                    <p className="lasso-a4__note">
                      Revisor: {auditorName}
                      {ownership?.auditor?.from ? `, siden ${formatDate(ownership.auditor.from)}` : ""}
                    </p>
                  ) : null}
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
                  {owners.length > MAX_ROWS ? <p className="lasso-a4__note">og {moreText(owners.length - MAX_ROWS)}</p> : null}
                  <p className="lasso-a4__note">
                    Ejerandele som CVR-intervaller.
                    {beneficialNames.length ? ` Reelle ejere: ${beneficialNames.slice(0, 3).join(", ")}${beneficialNames.length > 3 ? ` og ${moreText(beneficialNames.length - 3)}` : ""}` : ""}
                  </p>
                </div>
              </div>
            ) : null}
            {hasRisk || contactRows.length ? (
              <div className="lasso-a4-cols">
                {hasRisk ? (
                  <div className="lasso-a4-col lasso-a4-risk">
                    <h3 className="lasso-a4__h3">Risiko</h3>
                    {scoreValue !== null && band ? (
                      <>
                        <div className="lasso-a4-risk__score">
                          <span className="lasso-a4-risk__number">{Math.round(scoreValue)}</span>
                          <span className="lasso-a4-risk__of">af 100</span>
                          <span className={`lasso-a4-risk__band lasso-a4-score__band--${band.index}`}>{band.label}</span>
                        </div>
                        <ScoreScale value={scoreValue} />
                      </>
                    ) : null}
                    {observations.length ? (
                      <div className="lasso-a4-obs lasso-a4-obs--compact">
                        {observations.slice(0, 2).map((o) => {
                          const level = observationLevel(o.severity);
                          return (
                            <div key={o.id} className="lasso-a4-obs__row">
                              <span className={`lasso-a4-obs__dot lasso-a4-obs__dot--${level}`} aria-hidden="true" />
                              <span className="lasso-a4-obs__main">
                                <span className="lasso-a4-obs__title">
                                  {severityWord(o.severity)}: {o.title}
                                </span>
                                {o.detail || o.date ? <span className="lasso-a4-obs__detail">{[o.detail?.replace(/\.\s*$/, ""), o.date ? formatDate(o.date) : null].filter(Boolean).join(", ")}</span> : null}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="lasso-a4-col" />
                )}
                {contactRows.length ? (
                  <div className="lasso-a4-col">
                    <h3 className="lasso-a4__h3">Kontakt og oplysninger</h3>
                    <KvRows rows={contactRows} />
                  </div>
                ) : (
                  <div className="lasso-a4-col" />
                )}
              </div>
            ) : null}
            <PageFoot date={stamp.date} page={page} total={total} />
          </section>
        );
      },
    });
  }

  const total = pages.length + 1;
  const tocRows: { title: string; page: number }[] = pages.flatMap((p, i) => p.toc.map((title) => ({ title, page: i + 2 })));
  const facts = [
    // Runde 6: status kun ved afvigelse (ikke Aktiv/Normal).
    [cvr ? `CVR ${cvr}` : null, c?.form, statusGroup(c?.status) === "active" ? null : c?.status].filter(Boolean).join(", "),
    c?.address ? [c.address.street, [c.address.zip, c.address.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "",
    [c?.industryCode, c?.industryText].filter(Boolean).join(" "),
  ].filter(Boolean);
  const scoreText = scoreValue !== null ? `${Math.round(scoreValue)} af 100, ${scoreBand(scoreValue).short}` : "Ikke oplyst";

  return (
    <div className="lasso-a4">
      <section className="lasso-a4-page lasso-a4-page--cover" key="p1">
        <PageHead cover label={`Virksomhedsrapport, genereret ${stamp.date}${stamp.time ? ` kl. ${stamp.time}` : ""}`} />
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
              <span className="lasso-a4-cover__label">Risikoscore</span>
              <span className={`lasso-a4-cover__value ${scoreValue !== null ? "" : "lasso-a4__faint"}`}>{scoreText}</span>
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
            {tocRows.length ? (
              tocRows.map((t) => (
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
        <PageFoot date={stamp.date} page={1} total={total} />
      </section>
      {pages.map((p, i) => p.render(i + 2, total))}
    </div>
  );
}

/**
 * Rapport "af det man står i" (katalog 27.3, Paper FUE-0): PDF af Regnskab-fanen, samme indhold som
 * skærmen (resultatopgørelse, balance og nøgletal for 5 år, seneste først), sidehoved "Regnskab, hentet …"
 * og "side 1 af 1". Eksemplet på princippet: siden/fanen/elementet printes, som det vises, uden interaktion.
 */
export function StatementsReportA4({ company, dataset, generatedAt }: ReportA4Props) {
  const c = dataset.companies[company];
  const fin = dataset.financials[company];
  const years: FinancialYear[] = fin?.years ?? [];
  const last = years.at(-1);
  const unit = currencyUnit(fin?.currency);
  const statements = dataset.financialStatements[company];
  const stamp = companyStamp(dataset, generatedAt);
  const shownYears = years.slice(-YEARS).reverse();
  const firstYear = years.at(-YEARS)?.year ?? years[0]?.year;
  const span = last ? (firstYear && firstYear !== last.year ? `${firstYear}–${last.year}` : String(last.year)) : "";
  const ys = shownYears.map((y) => y.year);
  const inc = ys.map((y) => statements?.incomeStatement.find((s) => s.year === y));
  const bal = ys.map((y) => statements?.balanceSheet.find((s) => s.year === y));
  const revenueTop = shownYears.some((y) => y.revenue != null);
  const has = (vals: readonly string[]) => vals.some((v) => v !== "-");
  // Mangler en post i data, udelades rækken (19.1: ingen tomme rækker).
  const keep = (rows: Row[]) => rows.filter((r) => has(r.values));
  const income = keep([
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
  ]);
  const balance = keep([
    { label: "Anlægsaktiver", values: bal.map((s) => thousands(s?.fixedAssetsTotal)) },
    { label: "Omsætningsaktiver", values: bal.map((s) => thousands(s?.currentAssetsTotal)) },
    { label: "Aktiver i alt", values: shownYears.map((y, i) => thousands(y.assetsTotal ?? bal[i]?.assetsTotal)), kind: "sum" },
    { label: "Egenkapital", values: shownYears.map((y) => thousands(y.equity)), kind: "sum" },
    { label: "Langfristet gæld", values: bal.map((s) => thousands(s?.longTermLiabilities)) },
    { label: "Kortfristet gæld", values: bal.map((s) => thousands(s?.shortTermLiabilities)) },
    { label: "Passiver i alt", values: shownYears.map((y, i) => thousands(bal[i]?.liabilitiesAndEquityTotal ?? y.assetsTotal)), kind: "bottom" },
  ]);
  const ratios = keep([
    { label: "Soliditetsgrad", values: shownYears.map((y) => pct(y.soliditetsgrad)), kind: "plain" },
    { label: "Likviditetsgrad", values: shownYears.map((y) => pct(y.likviditetsgrad)), kind: "plain" },
    { label: "Overskudsgrad", values: shownYears.map((y) => pct(y.overskudsgrad)), kind: "plain" },
    { label: "Ansatte (årsrapport)", values: shownYears.map((y) => (typeof y.employees === "number" ? formatNumber(y.employees) : "-")), kind: "plain" },
  ]);
  const period = periodText(last);
  return (
    <div className="lasso-a4">
      <section className="lasso-a4-page" key="stmt">
        <PageHead name={c?.name ?? company} cvr={c?.cvr} label={`Regnskab, hentet ${stamp.date}`} />
        {shownYears.length ? (
          <>
            <div className="lasso-a4__titlerow">
              <h2 className="lasso-a4__h2">Regnskab {span}</h2>
              <span className="lasso-a4__note">
                t. {unit}
                {period ? `, regnskabsår ${period}` : ""}
              </span>
            </div>
            {income.length ? <StatementTable title="Resultatopgørelse" years={ys} rows={income} /> : null}
            {balance.length ? <StatementTable title="Balance pr. 31.12" years={ys} rows={balance} /> : null}
            {ratios.length ? <StatementTable title="Nøgletal" years={ys} rows={ratios} /> : null}
          </>
        ) : (
          <p className="lasso-a4__note">Der er ingen offentliggjorte regnskaber for virksomheden.</p>
        )}
        <PageFoot date={stamp.date} page={1} total={1} />
      </section>
    </div>
  );
}

/**
 * Regnskabsanalysen som A4-PDF (katalog 19.6, Paper LZM-0/LZP-0): det, "Hent som PDF" i 19.3 laver.
 * Sidehoved som 27.1 (navnelogo + "Regnskabsanalyse, genereret …"), overlinje REGNSKABSANALYSE, navnet
 * 28/700, "CVR …, regnskabsår … (periode), sammenlignet med …", ALLE afsnit foldet ud, "Tal der indgår i
 * analysen" som nøgle-værdi-liste og forbeholdet som sidste linje. Ingen kildevisning (G3); "genereret"
 * står kun i sidehovedet. Sidefod: navn, CVR og "regnskabsanalyse <år>" til venstre, sidetal til højre.
 * Ved lange analyser fortsætter teksten på næste side (samme hoved/fod) via print-CSS (break-inside).
 */
export function AnalysisReportA4({ company, dataset, generatedAt, disclaimer, name: fallbackName }: ReportA4Props & { disclaimer: string; /** Navnet, når virksomheden ikke er i datasættet (fx visningens titel). */ name?: string }) {
  const c = dataset.companies[company];
  const name = c?.name ?? fallbackName ?? company;
  const v = dataset.textSections[company];
  const items = v ? textSectionsFor(v.sections, "analyse") : [];
  const fin = dataset.financials[company];
  const years: FinancialYear[] = fin?.years ?? [];
  const last = years.at(-1);
  const unit = currencyUnit(fin?.currency);
  const stamp = companyStamp(dataset, v?.analysisGenerated ?? generatedAt);
  const first = years.at(-YEARS)?.year;
  const periodLong = last?.periodStart && last.periodEnd ? ` (${formatDate(last.periodStart)}–${formatDate(last.periodEnd)})` : "";
  const sub = [cvr(c?.cvr), last ? `regnskabsår ${last.year}${periodLong}${first && first < last.year ? `, sammenlignet med ${first}–${last.year - 1}` : ""}` : null].filter(Boolean).join(", ");
  const heading = (h: string, i: number) => (i === 0 && v?.analysisHeadline ? v.analysisHeadline : h.replace(/^Regnskabsanalyse:?\s*/i, "").replace(/^./, (x) => x.toUpperCase()) || "Konklusion");
  const numbers = last
    ? [
        ...(typeof last.grossProfit === "number" ? [{ label: `Bruttofortjeneste ${last.year}`, value: formatAmount(last.grossProfit, unit) }] : []),
        ...(typeof last.ebitda === "number" ? [{ label: `EBITDA ${last.year}`, value: formatAmount(last.ebitda, unit) }] : []),
        ...(typeof last.profit === "number" ? [{ label: `Årets resultat ${last.year}`, value: formatAmount(last.profit, unit) }] : []),
        ...(typeof last.soliditetsgrad === "number" ? [{ label: "Soliditetsgrad", value: formatPercent(last.soliditetsgrad, false) }] : []),
        ...(typeof last.likviditetsgrad === "number" ? [{ label: "Likviditetsgrad", value: formatPercent(last.likviditetsgrad, false) }] : []),
      ]
    : [];
  return (
    <div className="lasso-a4">
      <section className="lasso-a4-page lasso-a4-page--flow" key="analysis">
        <PageHead cover label={`Regnskabsanalyse, genereret ${stamp.date}${stamp.time ? ` kl. ${stamp.time}` : ""}`} />
        <div className="lasso-a4-doc__intro">
          <span className="lasso-a4__overline">Regnskabsanalyse</span>
          <h1 className="lasso-a4-doc__title">{name}</h1>
          {sub ? <p className="lasso-a4-doc__sub">{sub}</p> : null}
        </div>
        <div className="lasso-a4-doc__sections">
          {items.map((it, i) => (
            <div key={`${it.heading}-${i}`} className="lasso-a4-doc__section">
              <h2 className="lasso-a4-doc__h">{heading(it.heading, i)}</h2>
              <p className="lasso-a4-doc__body">{it.segments?.length ? it.segments.map((s) => s.text).join("") : it.body}</p>
            </div>
          ))}
        </div>
        {numbers.length ? (
          <div className="lasso-a4-block">
            <span className="lasso-a4__overline lasso-a4__overline--muted">Tal der indgår i analysen</span>
            <KvRows rows={numbers} className="lasso-a4-kv--doc" />
          </div>
        ) : null}
        <p className="lasso-a4-doc__disclaimer">{disclaimer}</p>
        <PageFoot date={stamp.date} page={1} total={1} left={[name, cvr(c?.cvr), last ? `regnskabsanalyse ${last.year}` : "regnskabsanalyse"].filter(Boolean).join(", ")} />
      </section>
    </div>
  );
}

function cvr(n: string | undefined): string | null {
  return n ? `CVR ${n}` : null;
}

export interface PersonReportA4Props {
  /** Lasso-ID for personen, fx "CVR-3-4000000001". */
  person: string;
  dataset: Dataset;
  generatedAt?: string;
}

const yearOf = (d?: string) => (d ? d.slice(0, 4) : "");

/**
 * Standard personrapport som A4-PDF (katalog 27.4, Paper FZF-0/FZH-0): én side med kun det relevante for et
 * overblik. Sidehoved med navnet alene (G9) og "Personrapport, <dato>"; overlinje PERSONRAPPORT og navnet
 * 28/700; persontal MK4-0/MK7-0 (aktive roller, tidligere roller, ejerskab, netværk 1. led, konkurser);
 * aktive roller som tabel (selskab, rolle, siden, status, MKS-0); tidligere roller dæmpet (MLF-0, konkurs i
 * rødt); "Sidder sammen med" (de 3 med længst fælles periode) og "Risiko" (PEP, stråmand, konkurser,
 * tvangsopløsninger) side om side (MLS-0). Ingen CPR, adresse eller kildevisning.
 */
export function PersonReportA4({ person, dataset, generatedAt }: PersonReportA4Props) {
  const p = dataset.persons[person];
  const stamp = formatStamp(generatedAt ?? dataset.generatedAt);
  const name = p?.name ?? person;
  const network = dataset.personNetworks[person];
  if (!p) {
    return (
      <div className="lasso-a4">
        <section className="lasso-a4-page">
          <PageHead name={name} label={`Personrapport, ${stamp.date}`} />
          <p className="lasso-a4__note">Der er ingen data om personen.</p>
          <PageFoot date={stamp.date} page={1} total={1} />
        </section>
      </div>
    );
  }
  const companies = personCompanies(p);
  const active = companies.filter((c) => c.active);
  const ended = companies.filter((c) => !c.active);
  const counts = personCounts(p);
  const risk = personRisk(p);
  const owned = companies.filter((c) => c.active && c.roles.some((r) => r.active && r.kind === "owner"));
  const lastLeft = ended.flatMap((c) => c.roles.map((r) => r.to)).filter((t): t is string => Boolean(t)).sort().at(-1);
  const bankrupt = risk.bankruptcies[0];
  const roleText = (c: (typeof companies)[number], onlyActive: boolean) => {
    const rs = c.roles.filter((r) => (onlyActive ? r.active : true));
    const labels = rs.map((r) => (r.kind === "owner" && r.share ? `${r.role} ${r.share}` : r.role));
    const uniq = labels.filter((l, i) => labels.indexOf(l) === i);
    return uniq.map((l, i) => (i === 0 ? l : l.charAt(0).toLowerCase() + l.slice(1))).join(", ");
  };
  const stats: { label: string; value: string; sub: string; danger?: boolean }[] = [
    { label: "Aktive roller", value: formatNumber(counts.activeRoles), sub: `i ${active.length} ${active.length === 1 ? "selskab" : "selskaber"}` },
    { label: "Tidligere roller", value: formatNumber(counts.endedRoles), sub: lastLeft ? `seneste fratrådt ${yearOf(lastLeft)}` : "ingen" },
    {
      label: "Ejerskab",
      value: formatNumber(owned.length),
      sub: owned.length === 1 ? [owned[0]!.companyName, owned[0]!.roles.find((r) => r.kind === "owner")?.share].filter(Boolean).join(", ") : owned.length ? "selskaber" : "ingen",
    },
    ...(network ? [{ label: "Netværk, 1. led", value: formatNumber(network.people.length), sub: "personer" }] : []),
    {
      label: "Konkurser i netværket",
      value: formatNumber(risk.bankruptcies.length),
      sub: bankrupt ? (bankrupt.yearsBefore !== undefined ? `fratrådt ${bankrupt.yearsBefore} år før` : bankrupt.involved ? "med rolle ved konkursen" : "registreret") : "ingen",
      danger: risk.bankruptcies.length > 0,
    },
  ];
  const peers = network ? [...network.people].sort((a, b) => Number(b.active) - Number(a.active) || b.overlapYears - a.overlapYears).slice(0, 3) : [];
  const riskRows: { label: string; value: string; tone?: "ok" | "warning" | "danger" | "muted" }[] = [
    { label: "PEP, politisk eksponeret", value: p.pep ? (p.pep.match ? "Ja" : "Nej") : "Ikke tjekket", tone: p.pep ? (p.pep.match ? "warning" : "ok") : "muted" },
    ...(p.strawman ? [{ label: "Stråmandsindikator", value: p.strawman.level === "possible" ? "Mulig" : "Nej", tone: p.strawman.level === "possible" ? ("warning" as const) : ("ok" as const) }] : []),
    { label: "Konkurser i netværket", value: risk.bankruptcies.length ? `${risk.bankruptcies.length}${risk.bankruptcies.every((b) => !b.involved) ? ", neutral" : ""}` : "0" },
    { label: "Tvangsopløsninger", value: formatNumber(risk.dissolutions.length) },
  ];
  const riskNote = [p.pep?.checkedAt ? `PEP tjekket ${formatDate(p.pep.checkedAt)}.` : null, p.strawman?.level === "possible" && p.strawman.detail ? `Stråmand: ${p.strawman.detail}` : null].filter(Boolean).join(" ");
  const RoleRows = ({ list, past }: { list: typeof companies; past?: boolean }) => (
    <div className={`lasso-a4-roles${past ? " lasso-a4-roles--past" : ""}`}>
      {list.slice(0, MAX_ROWS).map((c) => {
        const froms = c.roles.map((r) => r.from).filter((f): f is string => Boolean(f)).sort();
        const tos = c.roles.map((r) => r.to).filter((t): t is string => Boolean(t)).sort();
        const bankruptHere = /konkurs/i.test(c.companyStatus ?? "");
        const status = past ? (bankruptHere ? `${c.companyStatus ?? "Konkurs"}${c.companyEnded ? ` ${yearOf(c.companyEnded)}` : ""}` : "Fratrådt") : (c.companyStatus ?? "Aktiv");
        return (
          <div key={c.key} className="lasso-a4-roles__row">
            <span className="lasso-a4-roles__company">{c.companyName}</span>
            <span className="lasso-a4-roles__role">{roleText(c, !past)}</span>
            <span className="lasso-a4-roles__since">{past ? [yearOf(froms[0]), yearOf(tos.at(-1))].filter(Boolean).join("–") : froms[0] ? formatDate(froms[0]) : "-"}</span>
            <span className={`lasso-a4-roles__status${past && bankruptHere ? " lasso-a4__neg" : ""}`}>{status}</span>
          </div>
        );
      })}
      {list.length > MAX_ROWS ? <p className="lasso-a4__note">og {moreText(list.length - MAX_ROWS)}</p> : null}
    </div>
  );
  return (
    <div className="lasso-a4">
      <section className="lasso-a4-page lasso-a4-page--person" key="person">
        <PageHead name={name} label={`Personrapport, ${stamp.date}`} />
        <div className="lasso-a4-doc__intro">
          <span className="lasso-a4__overline">Personrapport</span>
          <h1 className="lasso-a4-doc__title">{name}</h1>
        </div>
        <div className="lasso-a4-kpis lasso-a4-kpis--person">
          {stats.map((s) => (
            <div key={s.label} className="lasso-a4-kpi">
              <span className="lasso-a4-kpi__label">{s.label}</span>
              <span className={`lasso-a4-kpi__value${s.danger ? " lasso-a4__neg" : ""}`}>{s.value}</span>
              <span className="lasso-a4-kpi__sub">{s.sub}</span>
            </div>
          ))}
        </div>
        {active.length ? (
          <div className="lasso-a4-block">
            <h2 className="lasso-a4__h2">Aktive roller</h2>
            <div className="lasso-a4-roles__row lasso-a4-roles__row--head">
              <span className="lasso-a4-roles__company">Selskab</span>
              <span className="lasso-a4-roles__role">Rolle</span>
              <span className="lasso-a4-roles__since">Siden</span>
              <span className="lasso-a4-roles__status">Status</span>
            </div>
            <RoleRows list={active} />
          </div>
        ) : null}
        {ended.length ? (
          <div className="lasso-a4-block">
            <h2 className="lasso-a4__h2">Tidligere roller</h2>
            <RoleRows list={ended} past />
          </div>
        ) : null}
        <div className="lasso-a4-cols">
          <div className="lasso-a4-col">
            <h3 className="lasso-a4__h3">Sidder sammen med</h3>
            {peers.length ? (
              <div className="lasso-a4-rows">
                {peers.map((n, i) => {
                  const shared = n.companies.length;
                  const tail = n.active ? `${n.overlapYears} år` : "afsluttet";
                  return (
                    <div key={`${n.name}-${i}`} className={`lasso-a4-row${n.active ? "" : " lasso-a4-row--muted"}`}>
                      <span className="lasso-a4-row__name">{n.name}</span>
                      <span className="lasso-a4-row__side">{`${shared} ${shared === 1 ? "fælles selskab" : "fælles selskaber"}, ${tail}`}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="lasso-a4__note">{network ? "Personen sidder ikke sammen med andre i CVR." : "Netværket er ikke hentet."}</p>
            )}
            {network && network.people.length > peers.length ? <p className="lasso-a4__note">De {peers.length} med længst fælles periode; {network.people.length - peers.length} flere i portalen</p> : null}
          </div>
          <div className="lasso-a4-col">
            <h3 className="lasso-a4__h3">Risiko</h3>
            <KvRows rows={riskRows} className="lasso-a4-kv--risk" />
            {riskNote ? <p className="lasso-a4__note">{riskNote}</p> : null}
          </div>
        </div>
        <PageFoot date={stamp.date} page={1} total={1} />
      </section>
    </div>
  );
}
