import type { ScoreVM } from "@lasso/spec";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";

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
          <span>0, lav risiko</span>
          <span>Høj risiko, 100</span>
        </div>
      </div>
    </Section>
  );
}
