import { formatDate } from "@lasso/spec";
import { Section } from "../primitives.js";

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
  /** Tredje linje under teksten, fx "gældende fra 01.09.2026" (28.3; ingen kildetype, jf. 21.1). */
  source?: string;
}

/** "I dag, 09.14", "I går, 16.40" eller "22.09.2026" (28.3). Uden klokkeslæt kun dag/dato. */
export function updateTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatDate(iso);
  const hasTime = /T\d{2}:\d{2}/.test(iso);
  const clock = hasTime ? `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}` : "";
  const day = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n).toDateString() === d.toDateString();
  if (day(0)) return clock ? `I dag, ${clock}` : "I dag";
  if (day(1)) return clock ? `I går, ${clock}` : "I går";
  return formatDate(iso.slice(0, 10));
}

/**
 * Opdateringer på personer og P-enheder (katalog 28.3, node H5N-0): kort med samme feed-mønster som
 * 21, tid i venstre kolonne ("I dag, 09.14"), rækkens hoved er personen eller den ejende virksomhed
 * (navn 15); ved P-enheder står typen som muted tekst efter (28.3: intet efter personnavnet), teksten og en kildelinje ("CVR, gældende fra …").
 * Mobil: ingen tidskolonne; tiden står i kildelinjen.
 * Kun "P-enhed fjernet" farves (mørk rød, med ordet). Fra → til skrives i teksten med pil. Rækken
 * linker til personsiden (16) eller P-enhedslisten (20) via `onOpen`. Kilder (people-updates,
 * production-unit-updates, webhooks pUnitAdded/Updated/Removed) er ubekræftede; ren UI-komponent.
 */
export function EntityUpdates({ items, onOpen, title = "Opdateringer på personer og P-enheder", subtitle, now }: { items: readonly EntityUpdateVM[]; onOpen?: (item: EntityUpdateVM) => void; title?: string; subtitle?: string; now?: Date }) {
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Section title={title} subtitle={subtitle} card className="lasso-entupd">
      {sorted.length === 0 ? (
        <div className="lasso-state">
          <div className="lasso-small">Ingen opdateringer på personer eller produktionsenheder i perioden.</div>
        </div>
      ) : (
        <ul className="lasso-entupd__rows">
          {sorted.map((u) => (
            <li key={u.id} className="lasso-entupd__row">
              <span className="lasso-entupd__when">{updateTime(u.at, now)}</span>
              <span className="lasso-entupd__main">
              <span className="lasso-entupd__head">
                {onOpen ? (
                  <button type="button" className="lasso-link lasso-entupd__subject" onClick={() => onOpen(u)}>
                    {u.subject}
                  </button>
                ) : (
                  <span className="lasso-entupd__subject">{u.subject}</span>
                )}
                {/* 28.3 (Jakob 29.09): intet efter personnavnet; typen står kun ved P-enhederne. */}
                {u.subjectKind === "person" ? null : <span className={`lasso-entupd__type${u.type === "P-enhed fjernet" ? " lasso-entupd__type--removed" : ""}`}>{u.type}</span>}
              </span>
              <span className="lasso-entupd__text">
                {u.text}
                {u.from || u.to ? `: ${u.from ?? "-"} → ${u.to ?? "-"}` : ""}
              </span>
              <span className="lasso-entupd__source">
                {u.source ?? ""}
                <span className="lasso-entupd__mtime">{`${u.source ? ", " : ""}${updateTime(u.at, now).toLowerCase()}`}</span>
              </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
