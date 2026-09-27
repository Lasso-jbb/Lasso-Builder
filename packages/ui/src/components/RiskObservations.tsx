import { useState } from "react";
import { extraSignals, formatDate, type ObservationRowVM, type ObservationsVM, type RiskSignals, type Severity } from "@lasso/spec";
import { DataState, Section, SeverityIcon, SourceLine, severityWord, stateForError } from "../primitives.js";

/** Alvorsskalaen som fast legende (katalog 17: 0 neutral, 25 info, 50 mulig vigtig, 100 vigtig). */
const SCALE: { severity: Severity; desc: string }[] = [
  { severity: 0, desc: "Faktum uden betydning for risiko." },
  { severity: 25, desc: "Værd at vide, kræver ikke handling." },
  { severity: 50, desc: "Bør undersøges før beslutning." },
  { severity: 100, desc: "Kræver stillingtagen." },
];

/** Store lister foldes sammen efter de første (regel 9). */
const COLLAPSED_ROWS = 6;

/** "Ikke tilgængelig"-rækker er ikke et risikofund og tælles ikke med i sammenfatningen. */
function summarize(rows: readonly ObservationRowVM[]): string {
  const counted = rows.filter((r) => !r.notAvailable);
  const important = counted.filter((r) => r.severity === 100).length;
  const possible = counted.filter((r) => r.severity === 50).length;
  const info = counted.filter((r) => r.severity === 25 || r.severity === 0).length;
  const parts: string[] = [];
  if (important) parts.push(`${important} vigtig${important === 1 ? "" : "e"}`);
  if (possible) parts.push(`${possible} mulige`);
  if (info) parts.push(`${info} til orientering`);
  return parts.join(", ");
}

/**
 * Én observationsrække, brugt både til virksomhedens egne observationer og til "Vedrører
 * personer" (relatedObservations pr. person). `notAvailable` (Lasso kunne ikke beregne
 * observationen) vises som ren tekst i muted, uden badge eller farve (guide 23 regel 1 og 7).
 */
function ObservationRow({ o }: { o: ObservationRowVM }) {
  return (
    <li className={`lasso-observation ${!o.notAvailable && o.severity === 100 ? "lasso-observation--important" : ""}`}>
      <span className="lasso-sev-icon-wrap">{o.notAvailable ? <span className="lasso-sev-dot" aria-hidden="true" /> : <SeverityIcon severity={o.severity} />}</span>
      <div className="lasso-row__main">
        <div className="lasso-observation__head">
          {o.notAvailable ? (
            <span className="lasso-observation__tag">Ikke tilgængelig</span>
          ) : (
            <span className={`lasso-observation__tag lasso-sev-text--${o.severity}`}>{o.severity === 0 ? "—" : severityWord(o.severity)}</span>
          )}
          <span className="lasso-observation__title">{o.title}</span>
        </div>
        {o.detail ? <div className="lasso-row__sub">{o.detail}</div> : null}
        {o.source || o.date ? <div className="lasso-observation__meta">{[o.source, o.date ? formatDate(o.date) : null].filter(Boolean).join(", ")}</div> : null}
      </div>
    </li>
  );
}

/**
 * Risikoobservationer (katalog 17): alvorsskala øverst, så en sammenfatning og
 * observationerne sorteret efter alvor. Kun den vigtigste alvorsgrad (100) får en
 * svagt tonet baggrund ("Maks én farveflade pr. skærm i hvile", guide 23).
 * Tom tilstand er positiv information ("intet fundet"), ikke en fejl, men den må kun
 * påstå det, der faktisk er tjekket: "Lasso har gennemgået ..." kræver Lassos gennemgang
 * (checkedAt). Egne signaler afledt af status, regnskab og ledelse (`derived`) lægges til,
 * så et konkursbo aldrig får grønt lys, når Lassos observationer er tomme (review P0-3).
 */
const CHECKED_WORDS: Record<string, string> = { status: "status", regnskab: "regnskab", revisor: "revisor", ledelse: "ledelse" };

export function RiskObservations({ data, derived, error, title }: { data?: ObservationsVM; derived?: RiskSignals; error?: string; title?: string }) {
  const heading = title ?? "Risikoobservationer";
  const [expanded, setExpanded] = useState(false);

  const own = data?.observations ?? [];
  const extra = extraSignals(own, derived?.signals ?? []);

  if (!data && extra.length === 0) {
    return (
      <Section title={heading} span="full">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={6} height={320} />}
      </Section>
    );
  }

  const rows = [...own, ...extra].sort((a, b) => b.severity - a.severity);
  const related = data?.related ?? [];

  if (rows.length === 0 && related.length === 0) {
    const checked = (derived?.checked ?? []).map((c) => CHECKED_WORDS[c] ?? c);
    const ours = checked.length ? ` ${checked.length > 1 ? `${checked.slice(0, -1).join(", ")} og ${checked.at(-1)}` : checked[0]} giver ingen risikosignaler.` : "";
    const reason = data?.checkedAt
      ? `Lasso har gennemgået virksomheden og fandt intet at bemærke. Tjekket ${formatDate(data.checkedAt)}.`
      : `Lasso har ingen observationer om virksomheden.${ours ? ours.replace(/^ (\p{L})/u, (_m, a: string) => ` ${a.toUpperCase()}`) : ""}`;
    return (
      <Section title={heading} span="full">
        <DataState state="empty" reason={reason} />
      </Section>
    );
  }

  const foldable = rows.length > COLLAPSED_ROWS + 2;
  const visible = foldable && !expanded ? rows.slice(0, COLLAPSED_ROWS) : rows;

  return (
    <Section title={heading} span="full">
      <ul className="lasso-sev-scale">
        {SCALE.map((s) => (
          <li key={s.severity} className="lasso-sev-scale__item">
            <span className="lasso-sev-icon-wrap">
              <SeverityIcon severity={s.severity} />
            </span>
            <span className="lasso-sev-scale__head">
              <span className="lasso-sev-scale__word">{severityWord(s.severity)}</span>
              <span className="lasso-sev-scale__num">{s.severity}</span>
            </span>
            <span className="lasso-sev-scale__desc">{s.desc}</span>
          </li>
        ))}
      </ul>

      {rows.length > 0 ? (
        <>
          <p className="lasso-observations__summary">{summarize(rows)}</p>
          <ul className="lasso-rows lasso-observations__list">
            {visible.map((o) => (
              <ObservationRow key={o.id} o={o} />
            ))}
          </ul>
          {foldable ? (
            <button type="button" className="lasso-link lasso-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
              {expanded ? "Vis færre" : `Se alle ${rows.length}`}
            </button>
          ) : null}
          {extra.length > 0 ? <p className="lasso-row__sub">Afledt af CVR-status, regnskab og ledelse, hvor Lasso ingen observation har.</p> : null}
        </>
      ) : null}

      {related.length > 0 ? (
        <div className="lasso-observations__related">
          <p className="lasso-section__subtitle">Vedrører personer</p>
          {related.map((person) => (
            <div key={person.lassoId}>
              <p className="lasso-row__sub">
                <strong>{person.name ?? person.lassoId}</strong>
              </p>
              <ul className="lasso-rows lasso-observations__list">
                {person.rows.map((o) => (
                  <ObservationRow key={o.id} o={o} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {data?.checkedAt ? <SourceLine source={data.sources?.join(", ") ?? "Lasso"} updated={data.checkedAt} /> : null}
    </Section>
  );
}
