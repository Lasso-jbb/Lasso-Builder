import { useEffect, useRef, useState } from "react";
import { CHANGE_TYPE_LABELS, formatNumber, type ActivityHeatmapVM } from "@lasso/spec";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";

const MONTHS = ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."];
/** Aksens korte månedsnavne under gitteret (13.11: "jul … jun"). */
const AXIS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** "2026-03" -> "mar." (og året, når det skifter eller er første kolonne). */
function monthLabel(m: string): { month: string; year: string } {
  const [y, mm] = m.split("-");
  return { month: MONTHS[Number(mm) - 1] ?? m, year: y ?? "" };
}

/**
 * Trin 1–5 på den sekventielle skala: 0 ændringer = trin 1 (surface-muted), ellers 2–5 i forhold til
 * det største tal. Aldrig en divergerende (rød/grøn) skala til mængder.
 */
export function heatStep(count: number, max: number): 1 | 2 | 3 | 4 | 5 {
  if (count <= 0 || max <= 0) return 1;
  return (Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) + 1) as 2 | 3 | 4 | 5;
}

/**
 * Heatmap, aktivitet pr. måned i en overvåget liste (katalog 13.11, node AKQ-0). Sekventiel skala i 5
 * trin fra surface-muted til koral, celle 34×18 med 4 px imellem, månedsetiketter under gitteret
 * (seneste måned 600). Hover, fokus og tryk: 1 px ink-ramme og tallet inde i cellen. Legende
 * "Færre … Flere" under.
 * Mobil (26b.10): kvadratiske 24 px celler, 6 måneder synlige (swipe for flere, de nyeste i syne), den
 * valgte celle med ink-ramme og tallet; ingen legende eller kildelinje.
 */
export function Heatmap({ heatmap, title, error }: { heatmap?: ActivityHeatmapVM; title?: string; error?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [ref, W] = useWidth<HTMLDivElement>(1048);
  const compact = W <= 560;
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [heatmap, compact]);
  const heading = title ?? (heatmap?.listName ? `Aktivitet i "${heatmap.listName}"` : "Aktivitet pr. måned");
  if (!heatmap) {
    return (
      <Section title={heading} span="full" className="lasso-heat">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={160} />}
      </Section>
    );
  }
  if (heatmap.rows.length === 0 || heatmap.months.length === 0 || heatmap.total === 0) {
    return (
      <Section title={heading} span="full" className="lasso-heat">
        <DataState state="empty" reason={heatmap.emptyReason ?? "Der er ingen ændringer i perioden."} height={160} />
      </Section>
    );
  }
  const max = Math.max(0, ...heatmap.rows.flatMap((r) => r.counts));
  const first = monthLabel(heatmap.months[0]!);
  const lastM = monthLabel(heatmap.months.at(-1)!);
  const subtitle = `Ændringer pr. måned, ${first.month} ${first.year}–${lastM.month} ${lastM.year}, ${formatNumber(heatmap.total)} i alt`;
  // Mobil: uden valg står den største celle blandt de 6 synlige måneder valgt, så tallet kan læses uden hover.
  const n = heatmap.months.length;
  let fallback: string | null = null;
  if (compact) {
    let best = -1;
    heatmap.rows.forEach((r) => r.counts.forEach((c, i) => {
      if (i >= n - 6 && c > best) {
        best = c;
        fallback = `${r.type}:${i}`;
      }
    }));
  }
  const selected = picked ?? fallback;
  return (
    <Section title={heading} subtitle={compact ? undefined : subtitle} span="full" className="lasso-heat">
      <div className="lasso-heat__frame" ref={ref}>
        <div className="lasso-heat__labels" aria-hidden="true">
          {heatmap.rows.map((r) => (
            <span className="lasso-heat__rowlabel" key={r.type}>
              {CHANGE_TYPE_LABELS[r.type]}
            </span>
          ))}
          <span className="lasso-heat__corner" />
        </div>
        <div className="lasso-heat__scroll" ref={scroller}>
          <table className="lasso-heat__grid">
            <caption className="lasso-sr">{subtitle}</caption>
            <tbody>
              {heatmap.rows.map((r) => (
                <tr key={r.type}>
                  <th scope="row" className="lasso-sr">
                    {CHANGE_TYPE_LABELS[r.type]}
                  </th>
                  {r.counts.map((c, i) => {
                    const l = monthLabel(heatmap.months[i]!);
                    const id = `${r.type}:${i}`;
                    return (
                      <td key={i}>
                        <span
                          className={`lasso-heat__cell lasso-heat__cell--${heatStep(c, max)}${selected === id ? " is-selected" : ""}`}
                          tabIndex={0}
                          data-n={formatNumber(c)}
                          role="button"
                          aria-pressed={selected === id}
                          aria-label={`${CHANGE_TYPE_LABELS[r.type]}, ${l.month} ${l.year}: ${formatNumber(c)} ${c === 1 ? "ændring" : "ændringer"}`}
                          title={`${CHANGE_TYPE_LABELS[r.type]}, ${l.month} ${l.year}: ${formatNumber(c)}`}
                          onClick={() => setPicked(selected === id ? null : id)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="lasso-sr">
                  Måned
                </th>
                {heatmap.months.map((m, i) => {
                  const mm = Number(m.split("-")[1]);
                  return (
                    <th scope="col" key={m} className={`lasso-heat__month${i === n - 1 ? " is-current" : ""}`}>
                      {AXIS[mm - 1] ?? m}
                    </th>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      {compact ? null : (
        <>
          <div className="lasso-heat__legend" aria-hidden="true">
            <span>Færre</span>
            {[1, 2, 3, 4, 5].map((st) => (
              <span key={st} className={`lasso-heat__swatch lasso-heat__cell--${st}`} />
            ))}
            <span>Flere</span>
          </div>
          {heatmap.source ? <SourceLine source={heatmap.source} updated={heatmap.updated} /> : null}
        </>
      )}
    </Section>
  );
}
