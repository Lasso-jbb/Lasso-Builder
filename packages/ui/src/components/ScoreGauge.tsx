import { formatDate, type ScoreVM } from "@lasso/spec";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";

/** "09.2026" fra en ISO-dato. */
function monthYear(iso: string): string {
  const d = formatDate(iso);
  return d.length === 10 ? d.slice(3) : d;
}

/** "09.26" til aksen. */
function monthShort(iso: string): string {
  const m = monthYear(iso);
  return m.length === 7 ? `${m.slice(0, 3)}${m.slice(5)}` : m;
}

/** Fortegn med ægte minus (09): "+5", "−4", "0". */
function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `\u2212${Math.abs(n)}` : "0";
}

/**
 * Udvikling, 24 måneder (26d.7): linje med maks 6 punkter over de tre risikobånd, seneste punkt
 * som ring, og et fast valgfelt under grafen med dato, score, tolkning og ændring. Ingen hover.
 */
function ScoreHistory({ history }: { history: NonNullable<ScoreVM["history"]> }) {
  const [ref, width] = useWidth<HTMLDivElement>(356);
  const pts = history.slice(-6);
  if (pts.length < 2) return null;
  const h = 120;
  const padL = 26;
  const padR = 10;
  const top = 6;
  const bottom = 22;
  const plotH = h - top - bottom;
  const x = (i: number) => padL + (i / (pts.length - 1)) * (width - padL - padR);
  const y = (v: number) => top + (1 - v / 100) * plotH;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
  const last = pts.at(-1)!;
  const first = pts[0]!;
  const delta = last.score - first.score;
  return (
    <div className="lasso-gauge-history">
      <div className="lasso-gauge-history__head">
        <span className="lasso-gauge-history__title">Udvikling, 24 måneder</span>
      </div>
      <div ref={ref} className="lasso-gauge-history__chart">
        <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} role="img" aria-label={`Score fra ${first.score} i ${monthYear(first.date)} til ${last.score} i ${monthYear(last.date)}`}>
          <rect className="lasso-gauge-history__band lasso-gauge-history__band--2" x={padL} y={y(100)} width={width - padL - padR} height={y(80) - y(100)} />
          <rect className="lasso-gauge-history__band lasso-gauge-history__band--1" x={padL} y={y(80)} width={width - padL - padR} height={y(60) - y(80)} />
          <rect className="lasso-gauge-history__band lasso-gauge-history__band--0" x={padL} y={y(60)} width={width - padL - padR} height={y(0) - y(60)} />
          {[100, 80, 60, 0].map((v) => (
            <text key={v} className="lasso-gauge-history__tick" x={0} y={y(v) + 3}>
              {v}
            </text>
          ))}
          <path className="lasso-gauge-history__line" d={d} />
          {pts.map((p, i) =>
            i === pts.length - 1 ? (
              <circle key={p.date} className="lasso-gauge-history__last" cx={x(i)} cy={y(p.score)} r={5} />
            ) : (
              <circle key={p.date} className="lasso-gauge-history__dot" cx={x(i)} cy={y(p.score)} r={3} />
            ),
          )}
          {pts.map((p, i) => (
            <text key={`l-${p.date}`} className={`lasso-gauge-history__x${i === pts.length - 1 ? " is-last" : ""}`} x={x(i)} y={h - 6} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}>
              {monthShort(p.date)}
            </text>
          ))}
        </svg>
      </div>
      <div className="lasso-gauge-history__readout">
        <span className="lasso-gauge-history__date">{monthYear(last.date)}</span>
        <span>{`${last.score}, ${band(last.score).label.toLowerCase()}, ${signed(delta)} siden ${monthYear(first.date)}`}</span>
      </div>
    </div>
  );
}

/** Seneste ændringer (26d.7): 40 px rækker med årsag, dato og delta (+ = højere risiko, ord og fortegn, ikke kun farve). */
function ScoreChanges({ changes }: { changes: NonNullable<ScoreVM["changes"]> }) {
  if (!changes.length) return null;
  return (
    <div className="lasso-gauge-changes">
      <p className="lasso-gauge-changes__title">Seneste ændringer</p>
      <ul className="lasso-gauge-changes__list">
        {changes.slice(0, 3).map((c) => (
          <li key={`${c.date}-${c.label}`} className="lasso-gauge-changes__row">
            <span className="lasso-gauge-changes__label">{c.label}</span>
            <span className="lasso-gauge-changes__date">{monthYear(c.date)}</span>
            <span className={`lasso-gauge-changes__delta lasso-gauge-changes__delta--${c.delta > 0 ? "up" : c.delta < 0 ? "down" : "flat"}`} title={c.delta > 0 ? "Højere risiko" : c.delta < 0 ? "Lavere risiko" : "Uændret"}>
              {signed(c.delta)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Samme tre trin som målerens farvebånd (60/20/20), katalog 10. */
function band(score: number): { label: string; index: 0 | 1 | 2 } {
  if (score < 60) return { label: "Lav risiko", index: 0 };
  if (score < 80) return { label: "Mulig risiko", index: 1 };
  return { label: "Høj risiko", index: 2 };
}

/**
 * Scoremåler (katalog 10): tal 0–100, vurdering som ord (regel 7: aldrig kun
 * farve), bånd i grøn/gul/rød og en lodret markør ved scoren. Ingen live
 * datakilde endnu (se catalog.ts): DemoProvider giver eksempelscorer,
 * LiveProvider giver "ikke oplyst" (tilstanden "notreported", ikke en fejl).
 */
export function ScoreGauge({ score, title, error }: { score?: ScoreVM; title?: string; error?: string }) {
  const heading = title ?? "Score";
  if (!score) {
    return (
      <Section title={heading} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={200} />}
      </Section>
    );
  }
  if (score.score === null) {
    return (
      <Section title={heading} span="half">
        <DataState state="notreported" />
      </Section>
    );
  }
  const value = Math.max(0, Math.min(100, score.score));
  const { label, index } = band(value);
  return (
    <Section title={heading} span="half">
      {score.source ? <SourceLine source={score.source} updated={score.updated} /> : null}
      <div className="lasso-gauge">
        <div className="lasso-gauge__value">
          <span className="lasso-gauge__number">{Math.round(value)}</span>
          <span className="lasso-gauge__of">af 100</span>
          <span className={`lasso-gauge__label lasso-gauge__label--${index}`}>{label}</span>
        </div>
        <div className="lasso-gauge__bar">
          <div className="lasso-gauge__track" aria-hidden="true">
            <span className="lasso-gauge__seg lasso-gauge__seg--0" style={{ flexGrow: 60 }} />
            <span className="lasso-gauge__seg lasso-gauge__seg--1" style={{ flexGrow: 20 }} />
            <span className="lasso-gauge__seg lasso-gauge__seg--2" style={{ flexGrow: 20 }} />
          </div>
          <span className="lasso-gauge__pointer" style={{ left: `calc(${value}% - 1.5px)` }} aria-hidden="true" />
        </div>
        <div className="lasso-gauge__scale">
          <span>
            0, lav<span className="lasso-gauge__long"> risiko</span>
          </span>
          <span className="lasso-gauge__tick" style={{ left: "60%" }}>
            60
          </span>
          <span className="lasso-gauge__tick" style={{ left: "80%" }}>
            80
          </span>
          <span>
            100, høj<span className="lasso-gauge__long"> risiko</span>
          </span>
        </div>
      </div>
      {score.history?.length ? <ScoreHistory history={score.history} /> : null}
      {score.changes?.length ? <ScoreChanges changes={score.changes} /> : null}
    </Section>
  );
}
