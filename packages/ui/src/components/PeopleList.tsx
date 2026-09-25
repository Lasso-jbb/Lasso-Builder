import { useState } from "react";
import { formatDate, type PersonRowVM } from "@lasso/spec";
import { Card, StateBox, initials, stateForError } from "../primitives.js";

const TWO_YEARS_MS = 2 * 365 * 24 * 3600 * 1000;
/** Store bestyrelser (fx 18 personer) foldes sammen efter de første. */
const COLLAPSED_ROWS = 8;

export function PeopleList({ people, show, title, error }: { people?: PersonRowVM[]; show: "current" | "all"; title?: string; error?: string }) {
  const heading = title ?? "Ledelse og bestyrelse";
  const [expanded, setExpanded] = useState(false);
  if (!people) return <Card title={heading}>{error ? <StateBox kind={stateForError(error)} message={error} /> : <StateBox kind="loading" />}</Card>;
  const rows = (show === "all" ? people : people.filter((p) => !p.to)).slice().sort((a, b) => Number(Boolean(a.to)) - Number(Boolean(b.to)));
  if (rows.length === 0) return <Card title={heading}><StateBox kind="empty" message="Ingen registrerede personer." /></Card>;
  const now = Date.now();
  const foldable = rows.length > COLLAPSED_ROWS + 2;
  const visible = foldable && !expanded ? rows.slice(0, COLLAPSED_ROWS) : rows;
  return (
    <Card title={heading}>
      <ul className="lasso-list">
        {visible.map((p, i) => {
          const isNew = !p.to && p.from !== undefined && now - new Date(p.from).getTime() < TWO_YEARS_MS;
          return (
            <li key={`${p.name}-${p.role}-${i}`} className={`lasso-list__item ${p.to ? "lasso-list__item--ended" : ""}`}>
              <span className="lasso-avatar" aria-hidden="true">{initials(p.name)}</span>
              <div className="lasso-list__main">
                <div className="lasso-list__name">
                  {p.name}
                  {isNew ? <span className="lasso-new">Ny</span> : null}
                </div>
                <div className="lasso-list__sub">{p.role}</div>
              </div>
              <div className="lasso-list__side">
                {p.to ? `Fratrådt ${formatDate(p.to)}` : p.from ? `Tiltrådt ${formatDate(p.from)}` : ""}
              </div>
            </li>
          );
        })}
      </ul>
      {foldable ? (
        <button type="button" className="lasso-btn lasso-btn--ghost lasso-btn--sm lasso-list__more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis færre" : `Vis alle ${rows.length}`}
        </button>
      ) : null}
    </Card>
  );
}
