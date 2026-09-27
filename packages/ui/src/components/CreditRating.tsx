import {
  CREDIT_COST_NOTE,
  CREDIT_LOCKED_REASON,
  CREDIT_PENDING_REASON,
  CREDIT_SCORES,
  creditChange,
  creditDescription,
  creditScoreWord,
  creditTone,
  formatCreditMax,
  formatDate,
  formatNumber,
  type CreditRatingVM,
  type CreditTone,
} from "@lasso/spec";
import type { ReactNode } from "react";
import { DataState, Missing, Section, SourceLine, stateForError } from "../primitives.js";
import type { ViewAction } from "../types.js";

/**
 * Kreditvurdering fra Creditsafe (katalog 17, datatyper del B afsnit 5). Creditsafes egen skala:
 * international score A–E og en lokal talscore. Den blandes aldrig med Lassos 0–100-score
 * (ScoreGauge) eller observationernes 0/25/50/100 (RiskObservations), derfor en A–E-række i
 * stedet for en måler. Regel 7: tonen står altid som ikon + ord, bogstavet og skalaen er i ink.
 * Regel 1–4: ingen piller, bannere eller farvede flader; den aktuelle position har kun 1 px kant.
 */
export interface CreditRatingProps {
  rating?: CreditRatingVM;
  title?: string;
  /** Teknisk fejl fra hentningen (resolveSpec), når der slet ingen vurdering er. */
  error?: string;
  /** PDF-rapporten (open-link) og "Prøv igen"/"Hent igen" (refresh). Uden den vises et almindeligt link og ingen knap. */
  onAction?: (a: ViewAction) => void;
}

const TONE_LABEL: Record<CreditTone, string> = { ok: "Lav risiko", warning: "Moderat risiko", danger: "Høj risiko" };

/** Sætning med punktum til sidst, uanset om grunden selv har et. */
const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

/** Tonens ikon i samme stil som SeverityIcon (14 px omrids). Forstærker kun ordet ved siden af. */
function CreditToneIcon({ tone }: { tone: CreditTone }) {
  if (tone === "ok") {
    return (
      <svg className="lasso-credit__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 12.5l2.7 2.7L16 9.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === "warning") {
    return (
      <svg className="lasso-credit__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M10.3 3.9L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="lasso-credit__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 7v6M12 16.5v.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M8.3 2.5h7.4l5.8 5.8v7.4l-5.8 5.8H8.3l-5.8-5.8V8.3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="lasso-credit__fact">
      <dt className="lasso-credit__key">{label}</dt>
      <dd className="lasso-credit__value">{children}</dd>
    </div>
  );
}

export function CreditRating({ rating, title, error, onAction }: CreditRatingProps) {
  const heading = title ?? "Kreditvurdering";
  const retry = onAction ? () => onAction({ kind: "refresh" }) : undefined;

  if (!rating) {
    if (error) {
      return (
        <Section title={heading} span="half" className="lasso-credit">
          {stateForError(error) === "noaccess" ? <DataState state="empty" reason={`Låst. ${sentence(error)}`} /> : <DataState state="error" reason={error} onRetry={retry} />}
        </Section>
      );
    }
    // Ventetilstanden: Creditsafe svarer på 5–45 sekunder, når vurderingen skal beregnes.
    return (
      <Section title={heading} span="half" className="lasso-credit">
        <DataState state="loading" lines={5} height={240} />
        <p className="lasso-credit__note">Henter vurderingen hos Creditsafe. Det kan tage op til 45 sekunder.</p>
      </Section>
    );
  }

  if (rating.state === "locked") {
    return (
      <Section title={heading} span="half" className="lasso-credit">
        <DataState state="empty" reason={`Låst. ${sentence(rating.reason ?? CREDIT_LOCKED_REASON)}`} />
      </Section>
    );
  }

  if (rating.state === "unavailable") {
    const pending = rating.reason === CREDIT_PENDING_REASON;
    return (
      <Section title={heading} span="half" className="lasso-credit">
        <DataState state="empty" reason={`Ikke beregnet endnu.${rating.reason ? ` ${sentence(rating.reason)}` : ""}`} />
        {pending && retry ? (
          <button type="button" className="lasso-link lasso-credit__action" onClick={retry}>
            Hent igen
          </button>
        ) : null}
      </Section>
    );
  }

  if (rating.state === "error") {
    return (
      <Section title={heading} span="half" className="lasso-credit">
        <DataState state="error" reason={rating.reason ?? error} onRetry={retry} />
      </Section>
    );
  }

  const current = rating.current;
  if (!current) {
    return (
      <Section title={heading} span="half" className="lasso-credit">
        <DataState state="notreported" />
        <SourceLine source={rating.source} updated={rating.updated} />
      </Section>
    );
  }

  const score = current.internationalScore;
  const tone = score ? creditTone(score) : undefined;
  const word = score ? creditScoreWord(score, current.internationalDescription) : undefined;
  const prev = rating.previous;
  const prevScore = prev?.internationalScore;
  const change = creditChange(score, prevScore);
  const local = typeof current.localScore === "number" ? `${formatNumber(current.localScore)}${current.localDescription ? `, ${creditDescription(current.localDescription)}` : ""}` : creditDescription(current.localDescription);

  return (
    <Section title={heading} span="half" className="lasso-credit">
      {score && tone && word ? (
        <>
          <div className="lasso-credit__score">
            <span className="lasso-credit__letter" aria-hidden="true">
              {score}
            </span>
            <span className={`lasso-credit__word lasso-credit__tone--${tone}`}>
              <CreditToneIcon tone={tone} />
              <span className="lasso-credit__sr">{score}, </span>
              {word}
            </span>
          </div>
          <ol className="lasso-credit__scale" aria-label="Creditsafes internationale score, A er lavest risiko og E højest">
            {CREDIT_SCORES.map((l) => (
              <li
                key={l}
                className={`lasso-credit__step${l === score ? " is-current" : ""}`}
                aria-current={l === score ? "true" : undefined}
                title={`${l}, ${creditScoreWord(l)}`}
              >
                {l}
              </li>
            ))}
          </ol>
          <div className="lasso-credit__ends" aria-hidden="true">
            <span>A, {TONE_LABEL.ok.toLowerCase()}</span>
            <span>{TONE_LABEL.danger}, E</span>
          </div>
        </>
      ) : (
        <p className="lasso-credit__score">
          <span className="lasso-notreported">International score ikke oplyst</span>
        </p>
      )}

      <dl className="lasso-credit__facts">
        <Fact label="Kreditmaksimum">{typeof current.creditMax === "number" ? formatCreditMax(current) : <Missing />}</Fact>
        <Fact label="Lokal score">{local ?? <Missing />}</Fact>
        {prevScore ? (
          <Fact label="Forrige vurdering">
            {prevScore} ({creditScoreWord(prevScore, prev?.internationalDescription)})
            {rating.latestChange ? `, ændret ${formatDate(rating.latestChange)}` : ""}
            {change ? (
              <span className={`lasso-credit__change lasso-credit__change--${change.direction}`}>
                {", "}
                {change.arrow ? <span aria-hidden="true">{`${change.arrow}\u00a0`}</span> : null}
                {change.word}
              </span>
            ) : null}
          </Fact>
        ) : rating.latestChange ? (
          <Fact label="Seneste ændring">{formatDate(rating.latestChange)}</Fact>
        ) : null}
      </dl>

      {rating.pdfUrl ? (
        onAction ? (
          <button type="button" className="lasso-link lasso-credit__action" onClick={() => onAction({ kind: "open-link", url: rating.pdfUrl! })}>
            Hent kreditrapport (PDF)
          </button>
        ) : (
          <a className="lasso-link lasso-credit__action" href={rating.pdfUrl} target="_blank" rel="noopener noreferrer">
            Hent kreditrapport (PDF)
          </a>
        )
      ) : null}

      <p className="lasso-credit__note">
        {CREDIT_COST_NOTE}
        {rating.cachedUntil ? ` Gemt hos Lasso til ${formatDate(rating.cachedUntil)}.` : ""}
      </p>
      <SourceLine source={rating.source} updated={rating.updated} />
    </Section>
  );
}
