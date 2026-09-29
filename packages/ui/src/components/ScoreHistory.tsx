import { formatDate, formatNumber, type ScoreHistoryVM } from "@lasso/spec";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";
import { ChartReadout, ChartTooltip, isCompact, useChartPick, type PickRow } from "../chartPick.js";
import { scoreBand } from "./ScoreGauge.js";
import { ScoreCompare } from "./ScoreCompare.js";

const DAY = 86_400_000;
const time = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`).getTime();
const TONE = ["ok", "warning", "danger"] as const;
const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
/** "jan 23" til aksens yderpunkter. */
const monthTick = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1] ?? ""} ${d.slice(2, 4)}`;
/** Hele måneder mellem to datoer, "6 mdr." (18.1). */
function monthsBetween(a: string, b: string): string {
  const m = (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
  return m <= 0 ? "under 1 md." : `${formatNumber(m)} ${m === 1 ? "md." : "mdr."}`;
}

/** Ændring i point mellem to hentninger: stigning = mere risiko (warning-tekst), aldrig grøn. */
function delta(prev: number, cur: number): PickRow["change"] {
  const d = Math.round(cur - prev);
  if (d === 0) return { text: "uændret", dir: "flat" };
  return { text: `${d > 0 ? "▲" : "▼"} ${formatNumber(Math.abs(d))} point`, dir: d > 0 ? "up" : "down" };
}

/**
 * Scorehistorik, trinlinje (katalog 18.2, node BY5-0). Trinlinje (ikke skrå), fordi scoren kun ændrer
 * sig, når den hentes; hver hentning er et punkt. Skalaen går fra 0 = lav risiko nederst til 100 =
 * høj risiko øverst med zonerne lav (grøn, 0–60), moderat (gul, 60–80) og høj (rød, 80–100) som svage
 * flader bag linjen. X-aksen er reel tid, så lange huller mellem hentninger er synlige. Sidste punkt er
 * fyldt og har tallet over, forrige punkt har sit tal under. Linjen og punkterne er koral (2 px, hule
 * punkter). Y-aksen har kun zonegrænserne 0/60/80/100; x-aksen har start og slut som "jan 23"/"sep 26"
 * (slut 600) og årsskifterne imellem. Titel "Kreditscore 2023–2026" + "0–100, N hentninger". Over grafen: forrige vs. nu
 * (18.1), medmindre `compare` er fra.
 * Mobil: tryk vælger en hentning, som står i et fast felt under grafen.
 */
export function ScoreHistory({
  history,
  title,
  error,
  onFetch,
  compare = true,
}: {
  history?: ScoreHistoryVM;
  title?: string;
  error?: string;
  onFetch?: () => void;
  /** Forrige vs. nu (18.1) over grafen. Fra = grafen alene, som katalog 18.2. Standard: til. */
  compare?: boolean;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const compact = isCompact(W);
  const points = history?.points ?? [];
  const pick = useChartPick(points.length, compact);
  // 18.2: "Kreditscore 2023–2026" (første og sidste hentnings år).
  const years = points.length ? [points[0]!.date.slice(0, 4), points.at(-1)!.date.slice(0, 4)] : [];
  const heading = title ?? (years.length ? `Kreditscore ${years[0] === years[1] ? years[0] : `${years[0]}\u2013${years[1]}`}` : "Kreditscore");
  if (!history) {
    return (
      <Section title={heading} span="half" className="lasso-chart lasso-scorehist">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={260} />}
      </Section>
    );
  }
  if (points.length === 0) {
    return (
      <Section title={heading} span="half" className="lasso-chart lasso-scorehist">
        <DataState state="empty" reason={history.reason ?? "Scoren er ikke hentet endnu, så der er ingen historik."} height={200} />
      </Section>
    );
  }

  const H = 220;
  const axisW = 32;
  const zoneW = compact ? 0 : 64;
  const top = 12;
  const bottom = 26;
  const plotH = H - top - bottom;
  const plotW = Math.max(0, W - axisW - zoneW - 16);
  const t0 = time(points[0]!.date);
  const t1 = Math.max(time(points.at(-1)!.date), t0 + DAY);
  const x = (d: string) => axisW + 8 + ((time(d) - t0) / (t1 - t0)) * plotW;
  const y = (v: number) => top + ((100 - v) / 100) * plotH;

  // Trinlinje: vandret til næste hentning, så lodret.
  let d = `M${x(points[0]!.date)},${y(points[0]!.score)}`;
  for (let i = 1; i < points.length; i++) d += ` H${x(points[i]!.date)} V${y(points[i]!.score)}`;

  // X-aksens år (reel tid): ét mærke pr. årsskifte inden for perioden, ellers start og slut.
  const y0 = new Date(t0).getUTCFullYear();
  const y1 = new Date(t1).getUTCFullYear();
  const yearTicks = y1 > y0 ? Array.from({ length: y1 - y0 }, (_, i) => `${y0 + i + 1}-01-01`) : [];
  const last = points.at(-1)!;
  const prev = points.at(-2);
  const lastBand = scoreBand(last.score);

  const rowsFor = (i: number): PickRow[] => {
    const p = points[i]!;
    const b = scoreBand(p.score);
    return [
      { label: "Score", value: `${formatNumber(Math.round(p.score))} af 100`, change: i > 0 ? delta(points[i - 1]!.score, p.score) : null },
      { label: "Vurdering", value: p.label ?? b.label },
    ];
  };
  const tip = pick.tooltip;
  const zones = [
    { from: 0, to: 60, cls: "low", label: "lav" },
    { from: 60, to: 80, cls: "mid", label: "moderat" },
    { from: 80, to: 100, cls: "high", label: "høj" },
  ];

  return (
    <Section title={heading} subtitle={`0\u2013100, ${formatNumber(points.length)} ${points.length === 1 ? "hentning" : "hentninger"}`} span="half" className="lasso-chart lasso-scorehist">
      {prev && compare ? (
        <ScoreCompare
          previous={{ value: formatNumber(Math.round(prev.score)), of: "af 100", word: prev.label ?? scoreBand(prev.score).label, tone: TONE[scoreBand(prev.score).index], date: prev.date }}
          current={{ value: formatNumber(Math.round(last.score)), of: "af 100", word: last.label ?? lastBand.label, tone: TONE[lastBand.index], date: last.date }}
          direction={last.score > prev.score ? "worse" : last.score < prev.score ? "better" : "same"}
          delta={last.score !== prev.score ? `${last.score > prev.score ? "+" : "\u2212"}${formatNumber(Math.abs(Math.round(last.score - prev.score)))}` : undefined}
          period={monthsBetween(prev.date, last.date)}
          action={onFetch ? { label: "Hent ny, 1 kredit", onClick: onFetch, primary: true } : undefined}
        />
      ) : null}
      <div ref={ref} className="lasso-chart__plot" {...pick.frame} aria-label={`${heading}. Brug piletasterne for at se hver hentning.`}>
        {W > 0 ? (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${heading}, seneste ${Math.round(last.score)} af 100`}>
            {zones.map((z) => (
              <g key={z.cls}>
                <rect className={`lasso-scorehist__zone lasso-scorehist__zone--${z.cls}`} x={axisW} y={y(z.to)} width={W - axisW} height={y(z.from) - y(z.to)} />
                {zoneW ? (
                  <text className={`lasso-scorehist__zone-label lasso-scorehist__zone-label--${z.cls}`} x={W - 6} y={(y(z.from) + y(z.to)) / 2 + 4} textAnchor="end">
                    {z.label}
                  </text>
                ) : null}
              </g>
            ))}
            {[0, 60, 80, 100].map((tk) => (
              <text key={tk} className="lasso-chart__tick" x={0} y={y(tk) + 4}>
                {tk}
              </text>
            ))}
            <line className="lasso-chart__axis" x1={axisW} x2={W} y1={y(0)} y2={y(0)} />
            {yearTicks.map((tk) => (
              <g key={tk}>
                <line className="lasso-chart__grid" x1={x(tk)} x2={x(tk)} y1={top} y2={y(0)} />
                {x(tk) - x(points[0]!.date) > 44 && x(last.date) - x(tk) > 44 ? (
                  <text className="lasso-chart__label" x={x(tk)} y={H - 6} textAnchor="middle">
                    {tk.slice(0, 4)}
                  </text>
                ) : null}
              </g>
            ))}
            <text className="lasso-chart__label" x={x(points[0]!.date)} y={H - 6} textAnchor="start">
              {monthTick(points[0]!.date)}
            </text>
            <text className="lasso-chart__label lasso-scorehist__xlast" x={x(last.date)} y={H - 6} textAnchor="end">
              {monthTick(last.date)}
            </text>
            <path className="lasso-scorehist__line" d={d} />
            {pick.active !== null ? <line className="lasso-chart__hairline" x1={x(points[pick.active]!.date)} x2={x(points[pick.active]!.date)} y1={top} y2={y(0)} /> : null}
            {points.map((p, i) => {
              const isLast = i === points.length - 1;
              return (
                <g key={`${p.date}-${i}`}>
                  <circle className={`lasso-scorehist__dot${isLast ? " is-last" : ""}${pick.active === i ? " is-active" : ""}`} cx={x(p.date)} cy={y(p.score)} r={isLast || pick.active === i ? 5 : 4} />
                  {isLast ? (
                    <text className="lasso-chart__value lasso-chart__value--last" x={x(p.date)} y={y(p.score) - 12} textAnchor="middle">
                      {formatNumber(Math.round(p.score))}
                    </text>
                  ) : i === points.length - 2 ? (
                    <text className="lasso-chart__value" x={x(p.date)} y={y(p.score) + 20} textAnchor="middle">
                      {formatNumber(Math.round(p.score))}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {points.map((p, i) => {
              const cx = x(p.date);
              const left = i === 0 ? axisW : (x(points[i - 1]!.date) + cx) / 2;
              const right = i === points.length - 1 ? W : (cx + x(points[i + 1]!.date)) / 2;
              return <rect key={`hit-${i}`} className="lasso-chart__hit" x={left} y={0} width={Math.max(0, right - left)} height={H} onMouseEnter={() => pick.enter(i)} onClick={() => pick.pick(i)} />;
            })}
          </svg>
        ) : null}
        {tip !== null && W > 0 ? <ChartTooltip x={x(points[tip]!.date)} y={y(points[tip]!.score)} width={W} title={formatDate(points[tip]!.date)} rows={rowsFor(tip)} /> : null}
      </div>
      {pick.readout !== null ? <ChartReadout title={formatDate(points[pick.readout]!.date)} rows={rowsFor(pick.readout)} hint="Tryk på et punkt for at se hentningen" /> : null}
      {history.source ? <SourceLine source={history.source} updated={history.updated} /> : null}
    </Section>
  );
}
