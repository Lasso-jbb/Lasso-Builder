import { useState } from "react";
import { formatDate, type ObservationRowVM, type ObservationsVM, type Severity } from "@lasso/spec";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";

/**
 * Alvor som ord i observationslisten (katalog 17 og 26d): høj, middel, info. Neutrale fakta (0)
 * er ikke et fund og tælles for sig. Ordet står altid ved farven (regel 7).
 */
export function observationLevel(severity: Severity): "høj" | "middel" | "info" | "neutral" {
  return severity === 100 ? "høj" : severity === 50 ? "middel" : severity === 25 ? "info" : "neutral";
}

const FILTERS: { severity: Severity; word: "høj" | "middel" | "info" }[] = [
  { severity: 100, word: "høj" },
  { severity: 50, word: "middel" },
  { severity: 25, word: "info" },
];

/** Højst så mange kort før "Se alle N" (regel 9). */
const SHOWN = 6;
/** Kompakt (uden for fokus risiko): højst tre kort. */
const COMPACT_SHOWN = 3;

/** "1 høj, 2 middel og 3 info" som sætning til skærmlæsere og print. */
export function observationSummary(rows: readonly ObservationRowVM[]): string {
  const counted = rows.filter((r) => !r.notAvailable);
  const parts = FILTERS.map((f) => ({ n: counted.filter((r) => r.severity === f.severity).length, word: f.word }))
    .filter((p) => p.n > 0)
    .map((p) => `${p.n} ${p.word}`);
  const neutral = counted.filter((r) => r.severity === 0).length;
  if (neutral) parts.push(`${neutral} neutral${neutral === 1 ? "" : "e"}`);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} og ${parts.at(-1)}`;
}

/** Sorteret efter alvor (100 først), derefter nyeste dato først; "ikke tilgængelig" sidst. */
export function sortObservations(rows: readonly ObservationRowVM[]): ObservationRowVM[] {
  return [...rows].sort((a, b) => {
    if (Boolean(a.notAvailable) !== Boolean(b.notAvailable)) return a.notAvailable ? 1 : -1;
    if (b.severity !== a.severity) return b.severity - a.severity;
    return (b.date ?? "").localeCompare(a.date ?? "");
  });
}

/**
 * Ét observationskort (26d.6): 3 px farvekant til venstre (høj rød, middel gul, info og neutral
 * grå), titel i ink, forklaring i sekundær tekst og kilde + dato i muted. Alvorsordet står som
 * skjult tekst først, så farven aldrig bærer betydningen alene.
 */
function ObservationCard({ o }: { o: ObservationRowVM }) {
  const level = o.notAvailable ? "na" : observationLevel(o.severity);
  // Regel 7: alvorsordet står i metalinjen, så farvekanten aldrig bærer betydningen alene.
  const word = o.notAvailable ? "Ikke tilgængelig" : level === "neutral" ? null : `${level[0]!.toUpperCase()}${level.slice(1)}`;
  const meta = [word, o.source, o.date ? formatDate(o.date) : null].filter(Boolean).join(", ");
  return (
    <li className="lasso-obs__item">
      <div className={`lasso-obs-card lasso-obs-card--${level}`}>
        <span className="lasso-obs-card__title">{o.title}</span>
        {o.detail ? <span className="lasso-obs-card__detail">{o.detail}</span> : null}
        {meta ? <span className="lasso-obs-card__meta">{meta}</span> : null}
      </div>
    </li>
  );
}

export interface RiskObservationsProps {
  data?: ObservationsVM;
  error?: string;
  title?: string;
  /** Uden for fokus risiko: højst tre kort og "Se alle", ingen relaterede. */
  compact?: boolean;
  /** Markér hele listen som eksempeldata i hovedet ("3, eksempeldata"). */
  demo?: boolean;
}

/**
 * Risikoobservationer (katalog 17.2, mobil 26d.6): sammenfatning øverst som valgbare
 * filterchips ("1 høj", "1 middel", "1 info"), derefter observationerne sorteret efter alvor
 * som kort med farvekant. Tom tilstand er positiv information ("intet fundet") med dato for
 * tjekket og stiplet ramme, aldrig grå fyld som ved fejl.
 */
export function RiskObservations({ data, error, title, compact = false, demo = false }: RiskObservationsProps) {
  const heading = title ?? "Risikoobservationer";
  const [filter, setFilter] = useState<Severity | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (!data) {
    return (
      <Section title={heading} span="full" className="lasso-obs">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} title="Risikoobservationer kunne ikke hentes" reason={error} /> : <DataState state="loading" lines={6} height={320} />}
      </Section>
    );
  }

  const rows = sortObservations(data.observations);
  const findings = rows.filter((r) => !r.notAvailable && r.severity >= 25);
  const source = data.sources?.length ? `Lasso (${data.sources.join(", ")})` : "Lasso";

  if (findings.length === 0 && !(data.related ?? []).some((p) => p.rows.some((r) => r.severity >= 25))) {
    // Positiv tom tilstand: "intet fundet" og hvornår der blev tjekket.
    const neutral = rows.filter((r) => !r.notAvailable);
    const na = rows.filter((r) => r.notAvailable);
    return (
      <Section title={heading} span="full" className="lasso-obs">
        <DataState
          state="empty"
          positive
          title="Intet at bemærke"
          reason={data.checkedAt ? "Lasso har gennemgået virksomheden og fandt ingen risikoobservationer." : "Lasso har ingen risikoobservationer om virksomheden."}
          checkedAt={data.checkedAt}
        />
        {neutral.length || na.length ? (
          <ul className="lasso-obs__list lasso-obs__list--after">
            {[...neutral, ...na].slice(0, 3).map((o) => (
              <ObservationCard key={o.id} o={o} />
            ))}
          </ul>
        ) : null}
        {data.checkedAt ? <SourceLine source={source} updated={data.checkedAt} /> : null}
      </Section>
    );
  }

  const counts = FILTERS.map((f) => ({ ...f, n: rows.filter((r) => !r.notAvailable && r.severity === f.severity).length })).filter((f) => f.n > 0);
  const filtered = filter === null ? rows : rows.filter((r) => !r.notAvailable && r.severity === filter);
  const limit = compact ? COMPACT_SHOWN : SHOWN;
  const visible = expanded ? filtered : filtered.slice(0, limit);
  const related = compact ? [] : (data.related ?? []).map((p) => ({ ...p, rows: sortObservations(p.rows.filter((r) => !r.notAvailable && r.severity >= 25)) })).filter((p) => p.rows.length > 0);

  return (
    <Section
      title={heading}
      span="full"
      className="lasso-obs"
      action={<span className="lasso-obs__count">{`${findings.length}${demo ? ", eksempeldata" : ""}`}</span>}
    >
      <div className="lasso-obs__filters" role="group" aria-label={`Sammenfatning: ${observationSummary(rows)}. Filtrér efter alvor`}>
        {counts.map((c) => (
          <button
            key={c.severity}
            type="button"
            className={`lasso-obs__chip lasso-obs__chip--${c.word}${filter === c.severity ? " is-selected" : ""}`}
            aria-pressed={filter === c.severity}
            onClick={() => {
              setFilter(filter === c.severity ? null : c.severity);
              setExpanded(false);
            }}
          >
            {`${c.n} ${c.word}`}
          </button>
        ))}
      </div>
      <ul className="lasso-obs__list">
        {visible.map((o) => (
          <ObservationCard key={o.id} o={o} />
        ))}
      </ul>
      {filtered.length > limit ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis færre" : `Se alle ${filtered.length} observationer`}
        </button>
      ) : null}
      {related.length ? (
        <div className="lasso-obs__related">
          <p className="lasso-obs__related-title">Vedrører ledelse og ejere</p>
          {related.slice(0, 3).map((p) => (
            <div key={p.lassoId} className="lasso-obs__related-group">
              <p className="lasso-obs__related-name">{p.name ?? p.lassoId}</p>
              <ul className="lasso-obs__list">
                {p.rows.map((o) => (
                  <ObservationCard key={`${p.lassoId}-${o.id}`} o={o} />
                ))}
              </ul>
            </div>
          ))}
          {related.length > 3 ? <p className="lasso-row__sub">{`Se ${related.length - 3} flere relaterede i Lasso.`}</p> : null}
        </div>
      ) : null}
      {data.checkedAt ? <SourceLine source={source} updated={data.checkedAt} /> : null}
    </Section>
  );
}
