import { formatDate } from "@lasso/spec";

export type EntityUpdateType = "Person, ledelse" | "Person, ejerskab" | "P-enhed tilføjet" | "P-enhed opdateret" | "P-enhed fjernet";

export interface EntityUpdateVM {
  id: string;
  /** Rækkens hoved: personen eller den ejende virksomhed. */
  subject: string;
  subjectId?: string;
  subjectKind: "person" | "company";
  type: EntityUpdateType;
  /** Beskrivelsen; "fra → til" skrives med pil i teksten. */
  text: string;
  from?: string;
  to?: string;
  /** ISO-dato eller tidsstempel. */
  at: string;
}

/**
 * Opdateringer på personer og P-enheder (katalog 28.3, node H5N-0): samme feed-mønster som 21, men
 * rækkens hoved er personen eller den ejende virksomhed, og typen står som muted tekst efter navnet.
 * Kun "P-enhed fjernet" farves (mørk rød, med ordet). Fra → til skrives i teksten med pil. Rækken
 * linker til personsiden (16) eller P-enhedslisten (20) via `onOpen`. Kilder (people-updates,
 * production-unit-updates, webhooks pUnitAdded/Updated/Removed) er ubekræftede; ren UI-komponent.
 */
export function EntityUpdates({ items, onOpen, title = "Opdateringer på personer og P-enheder" }: { items: readonly EntityUpdateVM[]; onOpen?: (item: EntityUpdateVM) => void; title?: string }) {
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section className="lasso-entupd">
      <h3 className="lasso-entupd__title">{title}</h3>
      {sorted.length === 0 ? (
        <div className="lasso-state">
          <div className="lasso-small">Ingen opdateringer på personer eller produktionsenheder i perioden.</div>
        </div>
      ) : (
        <ul className="lasso-entupd__rows">
          {sorted.map((u) => (
            <li key={u.id} className="lasso-entupd__row">
              <span className="lasso-entupd__head">
                {onOpen ? (
                  <button type="button" className="lasso-link lasso-entupd__subject" onClick={() => onOpen(u)}>
                    {u.subject}
                  </button>
                ) : (
                  <span className="lasso-entupd__subject">{u.subject}</span>
                )}
                <span className={`lasso-entupd__type${u.type === "P-enhed fjernet" ? " lasso-entupd__type--removed" : ""}`}>{u.type}</span>
                <span className="lasso-entupd__date">{formatDate(u.at)}</span>
              </span>
              <span className="lasso-entupd__text">
                {u.text}
                {u.from || u.to ? `: ${u.from ?? "—"} → ${u.to ?? "—"}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
