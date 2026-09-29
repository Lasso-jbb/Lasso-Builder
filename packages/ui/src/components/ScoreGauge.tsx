import { useState } from "react";
import type { ScoreVM } from "@lasso/spec";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";

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
 * Scoremåler (katalog 10.1, node 9ZT-0): tal 0–100, vurdering som ikon + ord, bånd i grøn/gul/rød
 * (0–60 lav, 60–80 moderat, 80–100 høj) og en lodret markør ved scoren; nøgle-værdi-linjer under
 * (fx Kreditmaksimum, International score).
 *
 * Hente-tilstande (node BGZ-0): stiplet ramme = kan hentes (handlingen koster, prisen står i knappen),
 * fuld ramme + spinner og 4 px fremdriftsbjælke = henter, grå flade = kan ikke hentes (altid med
 * årsag). Tallet og skalaen vises først, når scoren er hentet.
 * Mobil (26b): scoremåleren som kort med 36 px tal.
 *
 * Ingen bekræftet live datakilde (se catalog.ts): DemoProvider giver eksempelscorer og -tilstande,
 * LiveProvider giver "ikke oplyst".
 */
export function ScoreGauge({ score, title, error, onFetch }: { score?: ScoreVM; title?: string; error?: string; onFetch?: () => void }) {
  const heading = title ?? "Score";
  const [requested, setRequested] = useState(false);
  if (!score) {
    return (
      <Section title={heading} span="half" className="lasso-gauge-section">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={200} />}
      </Section>
    );
  }
  const state = requested && score.state === "notfetched" ? "fetching" : (score.state ?? (score.score === null ? undefined : "ok"));

  if (state === "notfetched") {
    const cost = score.cost ?? "1 kredit";
    return (
      <Section title={heading} span="half" className="lasso-gauge-section">
        <div className="lasso-gauge-state lasso-gauge-state--idle">
          <div className="lasso-gauge-state__title">Scoren er ikke hentet</div>
          <p className="lasso-gauge-state__text">{score.reason ?? "Hent scoren for at se vurderingen og skalaen."}</p>
          {onFetch ? (
            <button
              type="button"
              className="lasso-btn lasso-btn--sm"
              onClick={() => {
                setRequested(true);
                onFetch();
              }}
            >
              Hent score, {cost}
            </button>
          ) : (
            <p className="lasso-gauge-state__cost">Koster {cost} at hente.</p>
          )}
        </div>
      </Section>
    );
  }
  if (state === "fetching") {
    const p = typeof score.progress === "number" ? Math.max(0, Math.min(1, score.progress)) : null;
    return (
      <Section title={heading} span="half" className="lasso-gauge-section">
        <div className="lasso-gauge-state lasso-gauge-state--busy" aria-busy="true">
          <div className="lasso-gauge-state__row">
            <span className="lasso-spinner" aria-hidden="true" />
            <span className="lasso-gauge-state__title">Henter score</span>
          </div>
          <p className="lasso-gauge-state__text">{score.reason ?? "Det kan tage op til 45 sekunder."}</p>
          <div className={`lasso-gauge-state__progress${p === null ? " is-indeterminate" : ""}`} role="progressbar" aria-label="Henter score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p === null ? undefined : Math.round(p * 100)}>
            <span style={p === null ? undefined : { width: `${p * 100}%` }} />
          </div>
        </div>
      </Section>
    );
  }
  if (state === "unavailable") {
    return (
      <Section title={heading} span="half" className="lasso-gauge-section">
        <div className="lasso-gauge-state lasso-gauge-state--off">
          <div className="lasso-gauge-state__title">Scoren kan ikke hentes</div>
          <p className="lasso-gauge-state__text">{score.reason ?? "Der er ingen score for virksomheden."}</p>
        </div>
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
  return (
    <Section title={heading} span="half" className="lasso-gauge-section">
      <div className="lasso-gauge">
        <div className="lasso-gauge__value">
          <span className="lasso-gauge__number">{Math.round(value)}</span>
          <span className="lasso-gauge__of">af 100</span>
          <span className={`lasso-gauge__label lasso-gauge__label--${index}`}>
            <BandIcon index={index} />
            {label}
          </span>
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
          <span>0, lav risiko</span>
          <span>Høj risiko, 100</span>
        </div>
        <Facts facts={score.facts} />
      </div>
      {score.source ? <SourceLine source={score.source} updated={score.updated} /> : null}
    </Section>
  );
}
