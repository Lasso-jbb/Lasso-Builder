import { useMemo, useState } from "react";
import { CHANGE_TYPES, CHANGE_TYPE_LABELS, formatDate, formatNumber, type ChangeEntryVM, type ChangeFeedVM, type ChangeType } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";

/** Rækker vist før "Se alle N ændringer" (regel 9). */
const COLLAPSED_ROWS = 8;
/** Foldes først, når der er mere end to rækker at spare (som PersonList), så "Se alle 9" aldrig skjuler én række. */
const FOLD_FROM = COLLAPSED_ROWS + 2;

/**
 * 21.1 (Jakob 29.09): ændringstypen "Kredit" forudsætter scorehistorik, som ikke findes (18.2 udgår).
 * Afklaret (Jakob 15:41): typen udgår og vises hverken i feedet, filtervalget, heatmap eller overvågningsindstillingerne.
 */
export const HIDDEN_CHANGE_TYPES: readonly ChangeType[] = ["kredit"];

const WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

/** Lokal dato ÅÅÅÅ-MM-DD, så dagsgrupperne følger brugerens døgn og ikke UTC. */
function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Dagsoverskrift som overlinje: "I DAG, FREDAG 25.09.2026", "I GÅR, 24.09.2026", ellers "ONSDAG 23.09.2026".
 * Skrives med små bogstaver her; CSS sætter versaler.
 */
export function dayHeading(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = localDay(d);
  const today = localDay(now);
  const yesterday = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const date = formatDate(day);
  if (day === today) return `I dag, ${WEEKDAYS[d.getDay()]} ${date}`;
  if (day === yesterday) return `I går, ${date}`;
  return `${WEEKDAYS[d.getDay()]} ${date}`;
}

/** "kl. 09.14" (dansk klokkeslæt med punktum). */
export function clockText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `kl. ${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
}

const PERIODS: { days: number; label: string }[] = [
  { days: 1, label: "Seneste 24 timer" },
  { days: 7, label: "Seneste 7 dage" },
  { days: 30, label: "Seneste 30 dage" },
  { days: 90, label: "Seneste 90 dage" },
];

function ChangeRow({ entry, firstUnread, onOpen }: { entry: ChangeEntryVM; firstUnread: boolean; onOpen?: (a: ViewAction) => void }) {
  const [showAll, setShowAll] = useState(false);
  const folded = (entry.count ?? 1) > 1;
  const name = folded ? `${formatNumber(entry.count)} virksomheder` : entry.companyName;
  const canOpen = !folded && onOpen && entry.lassoId;
  return (
    <li className={`lasso-feed__row ${entry.read ? "" : "lasso-feed__row--unread"} ${firstUnread ? "lasso-feed__row--first" : ""}`}>
      <div className="lasso-feed__main">
        <div className="lasso-feed__head">
          {canOpen ? (
            <button type="button" className="lasso-link lasso-feed__name" onClick={() => onOpen({ kind: "open-company", lassoId: entry.lassoId!, name: entry.companyName })}>
              {name}
            </button>
          ) : (
            <span className="lasso-feed__name">{name}</span>
          )}
          <span className={`lasso-feed__type ${entry.type === "status" ? "lasso-feed__type--status" : ""}`}>{CHANGE_TYPE_LABELS[entry.type]}</span>
        </div>
        {entry.type === "status" && (entry.from || entry.to) ? (
          <div className="lasso-feed__change">
            {entry.from ? <span className="lasso-feed__from">{entry.from}</span> : null}
            <span aria-hidden="true">→</span>
            {entry.to ? <span className="lasso-feed__to">{entry.to}</span> : null}
          </div>
        ) : (
          <div className="lasso-feed__text">
            {folded && entry.companies?.length && !/[.!?]$/.test(entry.text) ? `${entry.text}.` : entry.text}
            {folded && entry.companies?.length ? (
              <>
                {" "}
                <button type="button" className="lasso-link lasso-feed__more" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
                  {showAll ? "Skjul" : "Vis alle"}
                </button>
              </>
            ) : null}
          </div>
        )}
        {folded && showAll && entry.companies?.length ? <div className="lasso-feed__companies">{entry.companies.join(", ")}</div> : null}
        {/* 21.1 (Jakob): kun klokkeslættet; kildetypen ("CVR", "Kredit") står ikke i tredje linje. */}
        <div className="lasso-feed__meta">{clockText(entry.at)}</div>
      </div>
      {entry.read ? <span className="lasso-feed__dotspace" aria-hidden="true" /> : <span className="lasso-feed__dot" role="img" aria-label="Ulæst" />}
    </li>
  );
}

/**
 * Ændringsfeed (katalog 21, node CA3-0): ændringer på tværs af de overvågede virksomheder,
 * grupperet pr. dag med dagsoverskrift som overlinje og filter-chips pr. ændringstype (med antal).
 * Ulæst = koral prik til højre + 3 px koral venstrekant (ingen farvet flade, kontrol r5).
 * Ændringstypen står som ren tekst i muted, kun Status i mørk rød. Statusændringer vises som
 * "fra → til" som i tidslinjen (12). Mange små ændringer af samme type samme dag er foldet til
 * én række ("5 virksomheder") af serveren.
 */
export function ChangeFeed({ feed, title, types, error, now, onOpen }: { feed?: ChangeFeedVM; title?: string; types?: readonly ChangeType[]; error?: string; now?: Date; onOpen?: (a: ViewAction) => void }) {
  const [filter, setFilter] = useState<ChangeType | "alle">("alle");
  const [days, setDays] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const shownDays = days ?? feed?.days ?? 7;
  const clock = now ?? new Date();

  const inPeriod = useMemo(() => {
    if (!feed) return [];
    const cutoff = clock.getTime() - shownDays * 86_400_000;
    return feed.entries.filter((e) => !HIDDEN_CHANGE_TYPES.includes(e.type) && new Date(e.at).getTime() >= cutoff);
  }, [feed, shownDays, clock]);

  const typeList = (types ?? CHANGE_TYPES).filter((t) => !HIDDEN_CHANGE_TYPES.includes(t));
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of inPeriod) c[e.type] = (c[e.type] ?? 0) + (e.count ?? 1);
    return c;
  }, [inPeriod]);
  const totalInPeriod = inPeriod.reduce((n, e) => n + (e.count ?? 1), 0);

  const heading = title ?? (feed?.listName ? `Ændringer i "${feed.listName}"` : "Ændringer i overvågningen");
  const headingWithCount = feed ? `${heading} (${formatNumber(totalInPeriod)})` : heading;

  const picker = feed ? (
    <select className="lasso-select lasso-select--sm" value={shownDays} onChange={(e) => setDays(Number(e.target.value))} aria-label="Vælg periode">
      {PERIODS.map((p) => (
        <option key={p.days} value={p.days} disabled={p.days > feed.days}>
          {p.label}
        </option>
      ))}
    </select>
  ) : null;

  if (!feed) {
    return (
      <Section title={heading} span="full">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={6} height={360} />}
      </Section>
    );
  }
  if (feed.entries.length === 0) {
    return (
      <Section title={heading} span="full">
        <DataState state="empty" reason={feed.emptyReason ?? `Ingen ændringer i "${feed.listName ?? "overvågningen"}" de seneste ${feed.days} dage.`} />
      </Section>
    );
  }

  const matching = filter === "alle" ? inPeriod : inPeriod.filter((e) => e.type === filter);
  const foldable = matching.length > FOLD_FROM;
  const rows = expanded || !foldable ? matching : matching.slice(0, COLLAPSED_ROWS);
  const firstUnread = rows.find((e) => !e.read);
  // Grupperet pr. dag, nyeste dag først (rækkerne er allerede sorteret nyeste først).
  const groups: { day: string; heading: string; rows: ChangeEntryVM[] }[] = [];
  for (const e of rows) {
    const day = localDay(new Date(e.at));
    const g = groups.at(-1);
    if (g && g.day === day) g.rows.push(e);
    else groups.push({ day, heading: dayHeading(e.at, clock), rows: [e] });
  }

  return (
    <Section title={headingWithCount} action={picker} span="full" className="lasso-feed-section">
      <div className="lasso-feed__filters" role="group" aria-label="Filtrér på ændringstype">
        <button type="button" className={`lasso-feed__chip ${filter === "alle" ? "is-on" : ""}`} aria-pressed={filter === "alle"} onClick={() => setFilter("alle")}>
          Alle ({formatNumber(totalInPeriod)})
        </button>
        {typeList.map((t) => (
          <button key={t} type="button" className={`lasso-feed__chip ${filter === t ? "is-on" : ""}`} aria-pressed={filter === t} onClick={() => setFilter(t)}>
            {CHANGE_TYPE_LABELS[t]} ({formatNumber(counts[t] ?? 0)})
          </button>
        ))}
      </div>
      {matching.length === 0 ? (
        <DataState state="empty" reason={`Ingen ændringer af typen ${filter === "alle" ? "" : CHANGE_TYPE_LABELS[filter].toLowerCase()} i perioden.`.replace("typen  i", "i")} />
      ) : (
        <div className="lasso-feed">
          {groups.map((g) => (
            <section key={g.day} className="lasso-feed__group" aria-label={g.heading}>
              <div className="lasso-feed__day">{g.heading}</div>
              <ul className="lasso-feed__rows">
                {g.rows.map((e) => (
                  <ChangeRow key={`${e.lassoId ?? e.companyName}-${e.at}-${e.type}`} entry={e} firstUnread={e === firstUnread} onOpen={onOpen} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {foldable ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis færre" : `Se alle ${formatNumber(matching.length)} ændringer`}
        </button>
      ) : null}
    </Section>
  );
}
