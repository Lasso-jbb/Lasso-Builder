import { useState } from "react";
import { ExpandLink, foldedCount, LIST_FOLD } from "./ExpandLink.js";
import { moreText, formatDate, type ObservationRowVM, type ObservationsVM, type Severity } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, SeverityIcon, severityWord, stateForError } from "../primitives.js";

/**
 * Alvorsniveau (bruges i A4-rapporten): høj, middel, info. Mobilens filterchips bruger desktopordene (vigtig, mulig, info). Neutrale fakta (0) er ikke et
 * fund og tælles for sig. Desktop (17.2) bruger skalaens ord (severityWord: Vigtig, Mulig vigtig, Info, Neutral).
 */
export function observationLevel(severity: Severity): "høj" | "middel" | "info" | "neutral" {
  return severity === 100 ? "høj" : severity === 50 ? "middel" : severity === 25 ? "info" : "neutral";
}

/** Kontrol r5 (17.2): mobilens filterchips bruger samme ord som desktop (vigtig, mulig, info). */
const FILTERS: { severity: Severity; word: "vigtig" | "mulig" | "info" }[] = [
  { severity: 100, word: "vigtig" },
  { severity: 50, word: "mulig" },
  { severity: 25, word: "info" },
];

/** Højst så mange observationer før "Se alle N" (regel 9). */
const SHOWN = LIST_FOLD; // Global regel (Jakob 01.10): over 6 → 5 + "Vis alle N"
/** Kompakt (uden for fokus risiko): højst tre. */
const COMPACT_SHOWN = 3;

/** "1 vigtig, 2 mulig og 3 info" som sætning til skærmlæsere og print. */
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

/**
 * Sammenfatningens overskrift på desktop (17.2): "1 vigtig, 2 mulige, 3 til orientering".
 * Info og neutrale fakta tælles sammen som "til orientering".
 */
export function observationHeadline(rows: readonly ObservationRowVM[]): string {
  const counted = rows.filter((r) => !r.notAvailable);
  const important = counted.filter((r) => r.severity === 100).length;
  const possible = counted.filter((r) => r.severity === 50).length;
  const fyi = counted.filter((r) => r.severity <= 25).length;
  const parts = [
    important ? `${important} ${important === 1 ? "vigtig" : "vigtige"}` : null,
    possible ? `${possible} ${possible === 1 ? "mulig" : "mulige"}` : null,
    fyi ? `${fyi} til orientering` : null,
  ].filter((p): p is string => Boolean(p));
  return parts.join(", ");
}

/** Sorteret efter alvor (100 først), derefter nyeste dato først; "ikke tilgængelig" sidst. */
export function sortObservations(rows: readonly ObservationRowVM[]): ObservationRowVM[] {
  return [...rows].sort((a, b) => {
    if (Boolean(a.notAvailable) !== Boolean(b.notAvailable)) return a.notAvailable ? 1 : -1;
    if (b.severity !== a.severity) return b.severity - a.severity;
    return (b.date ?? "").localeCompare(a.date ?? "");
  });
}


/** Kilder, der har en sektion at åbne ("Se regnskab"). */
const SECTION_FOR_SOURCE: Record<string, string> = { regnskab: "regnskab", ledelse: "ledelse", ejerskab: "ejerskab" };

function Chevron() {
  return (
    <svg className="lasso-obs-card__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Ét observationskort på mobil (26d.6): 3 px farvekant til venstre (høj rød, middel gul, info grå),
 * titel 14/600, forklaring 13 muted, kilde + dato 12 muted og chevron til højre. Alvorsordet står
 * som skjult tekst (chipsene over listen bærer ordene synligt, regel 7).
 */
function ObservationCard({ o }: { o: ObservationRowVM }) {
  const level = o.notAvailable ? "na" : observationLevel(o.severity);
  const word = o.notAvailable ? "Ikke tilgængelig" : level === "neutral" ? null : `${level[0]!.toUpperCase()}${level.slice(1)}`;
  const meta = [o.source, o.date ? formatDate(o.date) : null].filter(Boolean).join(", ");
  return (
    <li className="lasso-obs__item">
      <div className={`lasso-obs-card lasso-obs-card--${level}`}>
        <span className="lasso-obs-card__body">
          {word ? <span className="lasso-sr">{`${word}: `}</span> : null}
          <span className="lasso-obs-card__title">{o.title}</span>
          {o.detail ? <span className="lasso-obs-card__detail">{o.detail}</span> : null}
          {meta ? <span className="lasso-obs-card__meta">{meta}</span> : null}
        </span>
        <Chevron />
      </div>
    </li>
  );
}

/**
 * Én observation på desktop (17.2): ikon i venstre kolonne, alvorsordet som farvet overlinje
 * (VIGTIG, MULIG VIGTIG), titel 15/600, forklaring 14 og "Kilde, dato. Se regnskab". Ingen farvet
 * flade (17.2): alvoren bæres af ikon + ord. Info og neutrale fakta er kompakte rækker (44 px) med dato til højre.
 */
function ObservationRow({ o, lassoId, onAction }: { o: ObservationRowVM; lassoId: string; onAction?: (a: ViewAction) => void }) {
  const compact = o.notAvailable || o.severity <= 25;
  const word = o.notAvailable ? "Ikke tilgængelig" : o.severity === 0 ? "-" : severityWord(o.severity);
  const section = o.source ? SECTION_FOR_SOURCE[o.source.toLowerCase()] : undefined;
  const cls = `lasso-obsrow lasso-obsrow--${o.notAvailable ? "na" : o.severity}${compact ? " lasso-obsrow--compact" : ""}`;
  if (compact) {
    return (
      <li className={cls}>
        <span className="lasso-obsrow__icon">{o.notAvailable ? <span className="lasso-sev-dot" aria-hidden="true" /> : <SeverityIcon severity={o.severity} />}</span>
        <span className="lasso-obsrow__word">
          {o.severity === 0 && !o.notAvailable ? <span aria-hidden="true">-</span> : word}
          {o.severity === 0 && !o.notAvailable ? <span className="lasso-sr">Neutral</span> : null}
        </span>
        <span className="lasso-obsrow__title">{o.title}</span>
        <span className="lasso-obsrow__date">{[o.source, o.date ? formatDate(o.date) : null].filter(Boolean).join(", ")}</span>
      </li>
    );
  }
  const meta = [o.source, o.date ? formatDate(o.date) : null].filter(Boolean).join(", ");
  return (
    <li className={cls}>
      <span className="lasso-obsrow__icon">
        <SeverityIcon severity={o.severity} />
      </span>
      <span className="lasso-obsrow__body">
        <span className="lasso-obsrow__word">{word}</span>
        <span className="lasso-obsrow__title">{o.title}</span>
        {o.detail ? <span className="lasso-obsrow__detail">{o.detail}</span> : null}
        {meta || section ? (
          <span className="lasso-obsrow__meta">
            {meta ? `${meta}.` : null}
            {section && onAction ? (
              <>
                {" "}
                <button type="button" className="lasso-link lasso-obsrow__action" onClick={() => onAction({ kind: "open-section", lassoId, pageKind: "company", section })}>
                  {`Se ${o.source!.toLowerCase()}`}
                </button>
              </>
            ) : null}
          </span>
        ) : null}
      </span>
    </li>
  );
}

/** Alvorsbjælken i sammenfatningen: ét segment pr. observation i alvorens farve. */
function SeverityBar({ rows }: { rows: readonly ObservationRowVM[] }) {
  return (
    <span className="lasso-obs-summary__bar" aria-hidden="true">
      {rows.map((r) => (
        <span key={r.id} className={`lasso-obs-summary__seg lasso-obs-summary__seg--${r.severity}`} />
      ))}
    </span>
  );
}

/** De tre årsager til, at der ikke er observationer at vise (17.3). */
export type RiskUnavailableReason = "none" | "cannot" | "package";

export interface RiskUnavailableProps {
  reason: RiskUnavailableReason;
  /** Ingen observationer: hvornår Lasso sidst tjekkede. */
  checkedAt?: string;
  /** Overstyr forklaringen. */
  detail?: string;
  /** Ikke i din pakke: "Se pakker →". */
  onSeePackages?: () => void;
}

/**
 * Risiko ikke tilgængelig (17.3): stiplet kort med venstrestillet titel 15/600 og forklaring. Tom
 * tilstand er positiv information og må aldrig ligne en fejl (ingen rød kant, ingen grå fyld).
 */
export function RiskUnavailable({ reason, checkedAt, detail, onSeePackages }: RiskUnavailableProps) {
  const title = reason === "none" ? "Ingen observationer" : reason === "cannot" ? "Kan ikke beregnes" : "Ikke i din pakke";
  const text =
    detail ??
    (reason === "none"
      ? "Lasso har gennemgået virksomheden og fandt intet at bemærke."
      : reason === "cannot"
        ? "Virksomheden er under 1 år gammel og har ikke aflagt regnskab. Vi begynder efter første regnskab."
        : "Risikoobservationer er en del af Lasso Risiko.");
  return (
    <div className={`lasso-riskna lasso-riskna--${reason}`}>
      <p className="lasso-riskna__title">{title}</p>
      <p className="lasso-riskna__text">{text}</p>
      {reason === "none" && checkedAt ? <p className="lasso-riskna__meta">{`Tjekket ${formatDate(checkedAt)}`}</p> : null}
      {/* G1: "Se pakker" kun, når værten kan vise pakkerne. */}
      {reason === "package" && onSeePackages ? (
        <button type="button" className="lasso-link lasso-riskna__link" onClick={onSeePackages}>
          Se pakker →
        </button>
      ) : null}
    </div>
  );
}

export interface RiskObservationsProps {
  data?: ObservationsVM;
  error?: string;
  title?: string;
  /** Uden for fokus risiko: højst tre observationer og "Se alle", ingen relaterede. */
  compact?: boolean;
  /** Markér hele listen som eksempeldata i hovedet ("3, eksempeldata"). */
  demo?: boolean;
  /** "Se regnskab" i observationens kildevisning (open-section). */
  onAction?: (a: ViewAction) => void;
}

/**
 * Risikoobservationer. Desktop (17.2): sammenfatningskort øverst ("1 vigtig, 2 mulige, 3 til
 * orientering", seneste dato, alvorsbjælke), derefter observationerne sorteret efter alvor med ikon,
 * alvorsord som overlinje og kilde. Mobil (26d.6, container ≤ 560): filterchips "1 høj / 1 middel /
 * 1 info" og kort med farvekant og chevron; neutrale fakta vises ikke dér. Begge former tegnes, og
 * containerbredden vælger (CSS), så visningen følger panelets bredde uden JavaScript-måling.
 */
export function RiskObservations({ data, error, title, compact = false, demo = false, onAction }: RiskObservationsProps) {
  const heading = title ?? "Risikoobservationer";
  const [filter, setFilter] = useState<Severity | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (!data) {
    return (
      <Section title={heading} span="full" className="lasso-obs">
        {error ? (
          stateForError(error) === "noaccess" ? (
            <RiskUnavailable reason="package" />
          ) : (
            <DataState state="error" title="Risikoobservationer kunne ikke hentes" reason={error} />
          )
        ) : (
          <DataState state="loading" lines={6} height={320} />
        )}
      </Section>
    );
  }

  const rows = sortObservations(data.observations);
  const findings = rows.filter((r) => !r.notAvailable && r.severity >= 25);

  if (findings.length === 0 && !(data.related ?? []).some((p) => p.rows.some((r) => r.severity >= 25))) {
    // Positiv tom tilstand (17.3): "Ingen observationer" og hvornår der blev tjekket.
    // 17.2 (Jakob 01.10): neutrale fakta uden udslag vises ikke; kun det, der ikke kunne tjekkes.
    const neutral: typeof rows = [];
    const na = rows.filter((r) => r.notAvailable);
    return (
      <Section title={heading} span="full" className="lasso-obs">
        <RiskUnavailable
          reason="none"
          checkedAt={data.checkedAt}
          detail={data.checkedAt ? undefined : "Lasso har ingen risikoobservationer om virksomheden."}
        />
        {neutral.length || na.length ? (
          <ul className="lasso-obsrows lasso-obsrows--after">
            {[...neutral, ...na].slice(0, 3).map((o) => (
              <ObservationRow key={o.id} o={o} lassoId={data.lassoId} onAction={onAction} />
            ))}
          </ul>
        ) : null}
      </Section>
    );
  }

  const limit = compact ? COMPACT_SHOWN : SHOWN;
  const latest = rows.map((r) => r.date).filter((d): d is string => Boolean(d)).sort().at(-1);
  // 17.2 (Jakob 01.10): kun observationer med udslag (≥ 25) og "ikke tilgængelig"; neutrale fakta ("-") vises ikke.
  const deskRows = rows.filter((r) => r.notAvailable || r.severity >= 25);
  const deskVisible = expanded ? deskRows : deskRows.slice(0, foldedCount(deskRows.length, limit));

  // Mobil: kun fund (≥ 25) og "ikke tilgængelig"; neutrale fakta står kun på desktop.
  const mobRows = rows.filter((r) => r.notAvailable || r.severity >= 25);
  const counts = FILTERS.map((f) => ({ ...f, n: mobRows.filter((r) => !r.notAvailable && r.severity === f.severity).length })).filter((f) => f.n > 0);
  const filtered = filter === null ? mobRows : mobRows.filter((r) => !r.notAvailable && r.severity === filter);
  const mobVisible = expanded ? filtered : filtered.slice(0, foldedCount(filtered.length, limit));
  const related = compact ? [] : (data.related ?? []).map((p) => ({ ...p, rows: sortObservations(p.rows.filter((r) => !r.notAvailable && r.severity >= 25)) })).filter((p) => p.rows.length > 0);

  return (
    <Section
      title={heading}
      span="full"
      className="lasso-obs"
      action={<span className="lasso-obs__count lasso-obs__mob">{`${findings.length}${demo ? ", eksempeldata" : ""}`}</span>}
    >
      <div className="lasso-obs__desk">
        <div className="lasso-obs-summary">
          <div className="lasso-obs-summary__text">
            <p className="lasso-obs-summary__head">{observationHeadline(rows)}</p>
            <p className="lasso-obs-summary__sub">
              {/* Jakob runde 6: ingen kildevisning, derfor ikke "baseret på CVR og regnskab". */}
              {latest ? `Seneste observation ${formatDate(latest)}` : null}
              {demo ? ", eksempeldata" : ""}
            </p>
          </div>
          <SeverityBar rows={rows.filter((r) => !r.notAvailable)} />
        </div>
        <ul className="lasso-obsrows">
          {deskVisible.map((o) => (
            <ObservationRow key={o.id} o={o} lassoId={data.lassoId} onAction={onAction} />
          ))}
        </ul>
        {foldedCount(deskRows.length, limit) < deskRows.length ? (
          <ExpandLink expanded={expanded} total={deskRows.length} onToggle={() => setExpanded(!expanded)} />
        ) : null}
      </div>

      <div className="lasso-obs__mob">
        <div className="lasso-obs__filters" role="group" aria-label={`Sammenfatning: ${observationSummary(mobRows)}. Filtrér efter alvor`}>
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
          {mobVisible.map((o) => (
            <ObservationCard key={o.id} o={o} />
          ))}
        </ul>
        {foldedCount(filtered.length, limit) < filtered.length ? (
          <ExpandLink expanded={expanded} total={filtered.length} onToggle={() => setExpanded(!expanded)} />
        ) : null}
      </div>

      {related.length ? (
        <div className="lasso-obs__related">
          <p className="lasso-obs__related-title">Vedrører ledelse og ejere</p>
          {related.slice(0, 3).map((p) => (
            <div key={p.lassoId} className="lasso-obs__related-group">
              <p className="lasso-obs__related-name">{p.name ?? p.lassoId}</p>
              <ul className="lasso-obsrows">
                {p.rows.map((o) => (
                  <ObservationRow key={`${p.lassoId}-${o.id}`} o={o} lassoId={p.lassoId} />
                ))}
              </ul>
            </div>
          ))}
          {related.length > 3 ? <p className="lasso-row__sub">{`Se ${moreText(related.length - 3, "relateret", "relaterede")} i Lasso.`}</p> : null}
        </div>
      ) : null}
    </Section>
  );
}

const SCALE: { severity: Severity; text: string }[] = [
  { severity: 0, text: "Faktuel oplysning uden betydning for risikoen, fx nyt medlem i ledelsen." },
  { severity: 25, text: "Til orientering. Værd at kende, men ikke et fund i sig selv." },
  { severity: 50, text: "Bør vurderes. Kan være et tegn på risiko afhængigt af sammenhængen." },
  { severity: 100, text: "Kræver opmærksomhed, fx negativ egenkapital eller konkurs." },
];

/**
 * Alvorsskalaen (17.1): fire kort med ikon + ord + tal på skalaen 0–100 og en forklaring. Farven
 * forstærker kun; ordet og tallet bærer betydningen (regel 7 og 10).
 */
export function SeverityScale() {
  return (
    <ul className="lasso-sev-scale">
      {SCALE.map((s) => (
        <li key={s.severity} className="lasso-sev-scale__item">
          <span className="lasso-sev-scale__head">
            <span className={`lasso-sev-icon-wrap lasso-sev-icon-wrap--${s.severity}`}>
              <SeverityIcon severity={s.severity} />
            </span>
            <span className="lasso-sev-scale__word">{severityWord(s.severity)}</span>
            <span className="lasso-sev-scale__num">{s.severity}</span>
          </span>
          <span className="lasso-sev-scale__desc">{s.text}</span>
        </li>
      ))}
    </ul>
  );
}
