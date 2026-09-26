import { useMemo, useState } from "react";
import { formatDate, type TimelineVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";

const ALL = "Alle typer";

/**
 * Tidslinje (katalog 12, "Tidslinje"). Årsoverskrift som overlinje, nyeste
 * begivenhed har koral prik, ændringer vises som "fra → til", kategori og
 * dato i sidste linje.
 */
export function LassoTimeline({ timeline, title, error }: { timeline?: TimelineVM; title?: string; error?: string }) {
  const heading = title ?? "Historik";
  const categories = useMemo(() => [...new Set((timeline?.events ?? []).map((e) => e.category))], [timeline]);
  const [filter, setFilter] = useState(ALL);
  const [expanded, setExpanded] = useState(false);
  if (!timeline) {
    return (
      <Section title={heading} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={6} height={320} />}
      </Section>
    );
  }
  const matching = filter === ALL ? timeline.events : timeline.events.filter((e) => e.category === filter);
  // Regel 9: i et overblik vises de seneste 5; resten bag "Se alle N".
  const events = expanded ? matching : matching.slice(0, 5);
  const picker =
    categories.length > 1 ? (
      <select className="lasso-select lasso-select--sm" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Vis type">
        <option value={ALL}>{ALL}</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    ) : null;
  if (matching.length === 0) {
    return (
      <Section title={heading} action={picker} span="half">
        <DataState state="empty" reason="Der er ingen registrerede begivenheder i CVR endnu." />
      </Section>
    );
  }
  let lastYear: number | null = null;
  return (
    <Section title={heading} action={picker} span="half">
      <div className="lasso-timeline">
        {events.map((e, i) => {
          const year = Number(e.date.slice(0, 4));
          const showYear = year !== lastYear;
          lastYear = year;
          return (
            <div key={i}>
              {showYear ? <div className="lasso-timeline__year">{year}</div> : null}
              <div className="lasso-timeline__row">
                <div className="lasso-timeline__rail">
                  <span className={`lasso-timeline__dot ${i === 0 ? "lasso-timeline__dot--latest" : ""}`} aria-hidden="true" />
                  {i < events.length - 1 ? <span className="lasso-timeline__line" aria-hidden="true" /> : null}
                </div>
                <div className="lasso-timeline__body">
                  <div className="lasso-timeline__title">{e.title}</div>
                  {e.from || e.to ? (
                    <div className="lasso-timeline__change">
                      {e.from ? <span className="lasso-timeline__from">{e.from}</span> : null}
                      <span aria-hidden="true">→</span>
                      {e.to ? <span className="lasso-timeline__to">{e.to}</span> : null}
                    </div>
                  ) : e.detail ? (
                    <div className="lasso-row__sub">{e.detail}</div>
                  ) : null}
                  <div className="lasso-timeline__meta">
                    {formatDate(e.date)}, {e.category}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {matching.length > 5 ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis færre" : `Se alle ${matching.length} begivenheder`}
        </button>
      ) : null}
    </Section>
  );
}
