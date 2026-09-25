import { useState } from "react";
import { formatDate, type PersonRowVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";

/** Store bestyrelser (fx 18 personer) foldes sammen efter de første (regel 9). */
const COLLAPSED_ROWS = 8;

/** "Bestyrelsesformand" -> rolle "Bestyrelse" + "(formand)" som tekst i parentes. */
function splitChair(role: string): { role: string; chair: boolean } {
  if (/formand/i.test(role) && !/næstformand/i.test(role)) return { role: role.replace(/sformand|formand/i, "").trim() || "Bestyrelse", chair: true };
  return { role, chair: false };
}

/**
 * Personliste, udfoldet (katalog 11). Navn 14/500 står alene, rolle 13 grå under,
 * periode i fast kolonne til højre. Fratrådte kun under "Alle", dæmpet med ordet
 * "fratrådt" i rolleteksten. Formand som tekst i parentes. Ingen initial-cirkler.
 */
export function PeopleList({ people, show, title, error }: { people?: PersonRowVM[]; show: "current" | "all"; title?: string; error?: string }) {
  const heading = title ?? "Ledelse";
  const [mode, setMode] = useState<"current" | "all">(show);
  const [expanded, setExpanded] = useState(false);
  if (!people) {
    return (
      <Section title={heading} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={240} />}
      </Section>
    );
  }
  const hasEnded = people.some((p) => p.to);
  const rows = (mode === "all" ? people : people.filter((p) => !p.to)).slice().sort((a, b) => Number(Boolean(a.to)) - Number(Boolean(b.to)));
  const toggle = hasEnded ? (
    <div className="lasso-segment" role="tablist" aria-label="Vis personer">
      {(["current", "all"] as const).map((m) => (
        <button key={m} type="button" role="tab" aria-selected={mode === m} className={`lasso-segment__item ${mode === m ? "is-on" : ""}`} onClick={() => setMode(m)}>
          {m === "current" ? "Nuværende" : "Alle"}
        </button>
      ))}
    </div>
  ) : null;
  if (rows.length === 0) {
    return (
      <Section title={heading} action={toggle} span="half">
        <DataState state="empty" reason="Der er ingen registrerede personer i ledelsen." />
      </Section>
    );
  }
  const foldable = rows.length > COLLAPSED_ROWS + 2;
  const visible = foldable && !expanded ? rows.slice(0, COLLAPSED_ROWS) : rows;
  return (
    <Section title={heading} action={toggle} span="half">
      <ul className="lasso-rows">
        {visible.map((p, i) => {
          const { role, chair } = splitChair(p.role);
          const period = p.to ? `${p.from ? p.from.slice(0, 4) : ""} – ${p.to.slice(0, 4)}`.trim() : p.from ? `siden ${formatDate(p.from)}` : "";
          return (
            <li key={`${p.name}-${p.role}-${i}`} className={`lasso-row ${p.to ? "lasso-row--ended" : ""}`}>
              <div className="lasso-row__main">
                <div className="lasso-row__name">
                  {p.name}
                  {chair ? <span className="lasso-row__note">(formand)</span> : null}
                </div>
                <div className="lasso-row__sub">{p.to ? `${role}, fratrådt` : role}</div>
              </div>
              <div className="lasso-row__side">{period}</div>
            </li>
          );
        })}
      </ul>
      {foldable ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis færre" : `Se alle ${rows.length}`}
        </button>
      ) : null}
    </Section>
  );
}
