import { useState } from "react";
import { formatDate, type ScoreVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { ShellIcon } from "./ShellIcons.js";
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
function ScoreHistory({ history, note }: { history: NonNullable<ScoreVM["history"]>; note?: string }) {
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
  // Paper 26d.7: ændringen siden forrige måling ("+5 siden 01.2026").
  const prev = pts.at(-2)!;
  const delta = last.score - prev.score;
  return (
    <div className="lasso-gauge-history">
      <div className="lasso-gauge-history__head">
        <span className="lasso-gauge-history__title">Udvikling, 24 måneder</span>
        {note ? <span className="lasso-gauge-history__note">{note}</span> : null}
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
        <span>{`${last.score}, ${scoreBand(last.score).label.toLowerCase()}, ${signed(delta)} siden ${monthYear(prev.date)}`}</span>
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

/** Samme tre trin som målerens farvebånd (60/20/20) og scorehistorikkens zoner (18.2). */
export function scoreBand(score: number): { label: string; index: 0 | 1 | 2 } {
  if (score < 60) return { label: "Lav risiko", index: 0 };
  if (score < 80) return { label: "Moderat risiko", index: 1 };
  return { label: "Høj risiko", index: 2 };
}

/** Ikon ved vurderingsordet (regel 7: ikon + ord, aldrig kun farve). Samme former som alvorsikonerne (17). */
export function BandIcon({ index }: { index: 0 | 1 | 2 }) {
  if (index === 0) {
    return (
      <svg className="lasso-gauge__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 12.5l2.7 2.7L16 9.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg className="lasso-gauge__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M10.3 3.9L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="lasso-gauge__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 7v6M12 16.5v.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M8.3 2.5h7.4l5.8 5.8v7.4l-5.8 5.8H8.3l-5.8-5.8V8.3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function Facts({ facts }: { facts?: ScoreVM["facts"] }) {
  if (!facts?.length) return null;
  return (
    <dl className="lasso-gauge__facts">
      {facts.map((f) => (
        <div className="lasso-gauge__fact" key={f.label}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Scoremåler (katalog 10.1, node 9ZT-0): Lassos risikoscore 0-100, hvor 100 = HØJ risiko (Jakob 29.09).
 * Titel "Risikoscore", tal 40/700 + "af 100" + vurderingen som farvet ord, bånd i grøn/gul/rød (0-60 lav,
 * 60-80 moderat, 80-100 høj = rød) med en 2 px ink-markør ved scoren, akselabels "0, lav" og "100, høj".
 * Kun den aktuelle score: ingen forrige måling, kreditmaks eller Creditsafe, og ingen kildelinje (G3).
 * `detail` giver den fulde form med 60/80-mærker (26d.7-formen); udvikling og ændringer vises kun, hvis data har dem.
 *
 * Hente-tilstande (10.4, node BGZ-0): stiplet ramme = kan hentes (primær knap med prisen højrestillet
 * ved teksten), fuld ramme + spinner og 4 px fremdriftsbjælke under teksten = henter, grå flade = kan
 * ikke hentes (altid med årsag). Tallet og skalaen vises først, når scoren er hentet.
 * Mobil (26b.9): kompakt kort med 36 px tal, vurderingen til højre og faktaene på én linje.
 *
 * Ingen bekræftet live datakilde (se catalog.ts): DemoProvider giver eksempelscorer og -tilstande,
 * LiveProvider giver "ikke oplyst".
 */
export function ScoreGauge({
  score,
  title,
  error,
  onFetch,
  onReport,
  detail = false,
}: {
  score?: ScoreVM;
  title?: string;
  error?: string;
  onFetch?: () => void;
  /** "Hent rapport". Uden den vises knappen ikke (G1); Creditsafe-rapporten hører ikke til Lassos score (29.09). */
  onReport?: () => void;
  /** Udvikling over 24 måneder og seneste ændringer under måleren (26d.7). */
  detail?: boolean;
}) {
  // Lassos risikoscore (Jakob 29.09): 0-100, hvor 100 = høj risiko. Ikke Creditsafe; ingen kildelinje (G3).
  const heading = title ?? "Risikoscore";
  const [requested, setRequested] = useState(false);
  if (!score) {
    return (
      <Section title={heading} span="half" className="lasso-gauge-section">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={200} />}
      </Section>
    );
  }
  const state = requested && score.state === "notfetched" ? "fetching" : (score.state ?? (score.score === null ? undefined : "ok"));

  // 10.4 (runde 5, Paper LG2-0): tilstandene i det fælles tilstandssprog (10b): samme overskrift, kun
  // indholdet skifter. Ikke beregnet = titel, årsag og "Beregn score" (primær, ✧); henter = skelet af
  // måleren med shimmer; ikke tilgængelig = ikon, titel og årsag uden handling. Ingen kreditpris.
  if (state === "notfetched") {
    return (
      <Section title={heading} span="half" className="lasso-gauge-section">
        <DataState
          state="ondemand"
          title="Ikke beregnet endnu"
          reason={score.reason ?? "Scoren beregnes ud fra seneste regnskab, status og observationer."}
          actionLabel="Beregn score"
          onAction={
            onFetch
              ? () => {
                  setRequested(true);
                  onFetch();
                }
              : undefined
          }
          height={140}
        />
      </Section>
    );
  }
  if (state === "fetching") {
    return (
      <Section title={heading} span="half" className="lasso-gauge-section">
        <DataState state="loading" shape="gauge" note={score.reason ?? "Tager typisk et par sekunder. Du kan fortsætte på siden."} />
      </Section>
    );
  }
  if (state === "unavailable") {
    return (
      <Section title={heading} span="half" className="lasso-gauge-section">
        <DataState state="unavailable" title="Score ikke tilgængelig" reason={score.reason ?? "Der beregnes ikke en score for virksomheden."} height={140} />
      </Section>
    );
  }
  if (score.score === null) {
    return (
      <Section title={heading} span="half" className="lasso-gauge-section">
        <DataState state="notreported" />
      </Section>
    );
  }
  const value = Math.max(0, Math.min(100, score.score));
  const { label, index } = scoreBand(value);
  if (detail) {
    // 26d.7: fuld form. Vurderingsordet ved siden af tallet og zonebjælke med 60/80-mærker. Ingen kilde (G3)
    // og ingen udvikling/ændringer: der findes ingen scorehistorik (18.2 udgår, Jakob 29.09); de vises kun,
    // hvis data en dag leverer dem.
    return (
      <Section title={heading} span="half" className="lasso-gauge-section lasso-gauge-section--detail">
        <div className="lasso-gauge lasso-gauge--detail">
          <div className="lasso-gauge__value">
            <span className="lasso-gauge__number">{Math.round(value)}</span>
            <span className="lasso-gauge__of">af 100</span>
            <span className="lasso-gauge__side">
              <span className={`lasso-gauge__label lasso-gauge__label--${index}`}>{label}</span>
            </span>
          </div>
          <div className="lasso-gauge__bar">
            <div className="lasso-gauge__track" aria-hidden="true">
              <span className="lasso-gauge__seg lasso-gauge__seg--0" style={{ flexGrow: 60 }} />
              <span className="lasso-gauge__seg lasso-gauge__seg--1" style={{ flexGrow: 20 }} />
              <span className="lasso-gauge__seg lasso-gauge__seg--2" style={{ flexGrow: 20 }} />
            </div>
            <span className="lasso-gauge__pointer" style={{ left: `calc(${value}% - 1px)` }} aria-hidden="true" />
          </div>
          <div className="lasso-gauge__scale lasso-gauge__scale--ticks">
            <span>0, lav</span>
            <span>60</span>
            <span>80</span>
            <span>100, høj</span>
          </div>
        </div>
        {score.history?.length ? <ScoreHistory history={score.history} note={score.historyNote} /> : null}
        {score.changes?.length ? <ScoreChanges changes={score.changes} /> : null}
      </Section>
    );
  }
  // 18.1/10.1 (Jakob 29.09): kun den aktuelle score; ingen "Forrige", kreditmaks eller kilde.
  return (
    <Section title={heading} span="half" className="lasso-gauge-section">
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
          <span className="lasso-gauge__pointer" style={{ left: `calc(${value}% - 1px)` }} aria-hidden="true" />
        </div>
        <div className="lasso-gauge__scale">
          <span>0, lav</span>
          <span>100, høj</span>
        </div>
        <Facts facts={score.facts} />
        {onReport ? (
          <button type="button" className="lasso-btn lasso-btn--sm lasso-gauge__report" onClick={onReport}>
            <ShellIcon name="document" size={15} />
            Hent rapport
          </button>
        ) : null}
      </div>
    </Section>
  );
}
