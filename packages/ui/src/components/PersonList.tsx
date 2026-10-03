import { useState } from "react";
import { ExpandLink, foldedCount, LIST_FOLD } from "./ExpandLink.js";
import { formatDate, isPersonId, PERSON_LIST_ROLE_TITLES, peopleWithRole, type PersonListRole, type PersonRowVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";
import { Tabs } from "./Tabs.js";
import { usePrintMode } from "../print.js";
import { Icon } from "./Icon.js";

/** Store bestyrelser (fx 18 personer) foldes sammen efter de første (regel 9). */
const COLLAPSED_ROWS = LIST_FOLD;

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
const EMPTY: Record<PersonListRole | "all", string> = {
  all: "Der er ingen registrerede personer i ledelsen.",
  direktion: "Der er ingen registrerede personer i direktionen.",
  bestyrelse: "Der er ingen registrerede personer i bestyrelsen.",
};

export function PersonList({
  people: all,
  show,
  roles,
  title,
  error,
  onOpen,
}: {
  people?: PersonRowVM[];
  show: "current" | "all";
  /** Kun direktionen eller kun bestyrelsen (spørgsmålet "hvem er direktør"); titlen følger filteret. */
  roles?: PersonListRole;
  title?: string;
  error?: string;
  onOpen?: (a: ViewAction) => void;
}) {
  const heading = title ?? (roles ? PERSON_LIST_ROLE_TITLES[roles] : "Ledelse");
  const [mode, setMode] = useState<"current" | "all">(show);
  const [expanded, setExpanded] = useState(usePrintMode());
  const people = all ? peopleWithRole(all, roles) : undefined;
  if (!people) {
    return (
      <Section title={heading} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={240} />}
      </Section>
    );
  }
  const hasEnded = people.some((p) => p.to);
  const rows = (mode === "all" ? people : people.filter((p) => !p.to)).slice().sort((a, b) => Number(Boolean(a.to)) - Number(Boolean(b.to)));
  // Niveau 3-faner (29): skifter kun elementets egen visning.
  const segment = hasEnded ? (
    <Tabs
      level={3}
      className="lasso-seg-pill"
      ariaLabel="Vis personer"
      items={[
        { id: "current", label: "Nuværende" },
        { id: "all", label: "Alle" },
      ]}
      value={mode}
      onChange={(id) => setMode(id as "current" | "all")}
    />
  ) : null;
  // 26c.4 mobil: intet segment, men antallet ("5 personer") til højre for titlen.
  const toggle = (
    <>
      {segment ? <span className="lasso-personlist__segment">{segment}</span> : null}
      <span className="lasso-personlist__count">{`${people.length} ${people.length === 1 ? "person" : "personer"}`}</span>
    </>
  );
  if (rows.length === 0) {
    return (
      <Section title={heading} action={toggle} span="half">
        <DataState state="empty" reason={EMPTY[roles ?? "all"]} />
      </Section>
    );
  }
  // Global regel (Jakob 01.10): over 6 → 5 + "Vis alle N".
  const foldable = foldedCount(rows.length, COLLAPSED_ROWS) < rows.length;
  const visible = foldable && !expanded ? rows.slice(0, COLLAPSED_ROWS) : rows;
  return (
    <Section title={heading} action={toggle} span="half">
      <ul className="lasso-rows lasso-personlist">
        {visible.map((p, i) => {
          const { role, chair } = splitChair(p.role);
          const period = p.to ? `${p.from ? p.from.slice(0, 4) : ""} – ${p.to.slice(0, 4)}`.trim() : p.from ? `siden ${formatDate(p.from)}` : "";
          return (
            <li key={`${p.name}-${p.role}-${i}`} className={`lasso-row ${p.to ? "lasso-row--ended" : ""}`}>
              <div className="lasso-row__main">
                <div className="lasso-row__name">
                  {onOpen && isPersonId(p.lassoId) ? (
                    <button type="button" className="lasso-link lasso-row__open" onClick={() => onOpen({ kind: "open-person", lassoId: p.lassoId!, name: p.name })}>
                      {p.name}
                    </button>
                  ) : (
                    p.name
                  )}
                  {chair ? <span className="lasso-row__note">(formand)</span> : null}
                </div>
                <div className="lasso-row__sub">
                  {p.to ? `${role}, fratrådt` : role}
                </div>
              </div>
              <div className="lasso-row__side">{period}</div>
              {/* 11.2: chevron yderst til højre, når personen kan åbnes. */}
              {onOpen && isPersonId(p.lassoId) ? <Icon name="chevron-right" size={16} className="lasso-row__chevron" /> : null}
            </li>
          );
        })}
      </ul>
      {foldable ? (
        <ExpandLink expanded={expanded} total={rows.length} onToggle={() => setExpanded(!expanded)} />
      ) : null}
      {hasEnded && mode === "current" ? (
        <button type="button" className="lasso-link lasso-personlist__all" onClick={() => setMode("all")}>
          {`Vis alle ${people.length}, inkl. fratrådte`}
        </button>
      ) : null}
    </Section>
  );
}
