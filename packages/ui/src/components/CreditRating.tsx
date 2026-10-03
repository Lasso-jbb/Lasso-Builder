import {
  CREDIT_COST_NOTE,
  CREDIT_LOCKED_REASON,
  CREDIT_PENDING_REASON,
  CREDIT_PURCHASE_INCLUDES,
  CREDIT_SCORES,
  creditDescription,
  creditScoreWord,
  creditTone,
  formatCreditMax,
  formatDate,
  formatNumber,
  type CreditRatingVM,
  type CreditTone,
} from "@lasso/spec";
import { useState, type ReactNode } from "react";
import { DataState, Missing, Section, stateForError } from "../primitives.js";
import type { ViewAction } from "../types.js";
import { CreditConfirmDialog } from "./CreditConfirmDialog.js";
import { ShellIcon } from "./ShellIcons.js";

/**
 * Kreditvurdering fra Creditsafe (katalog 17, datatyper del B afsnit 5). Creditsafes egen skala:
 * international score A–E og en lokal talscore. Den blandes aldrig med Lassos 0–100-score
 * (ScoreGauge) eller observationernes 0/25/50/100 (RiskObservations). Kortet har samme form som
 * risikoscoren (18.1, Jakob 30.09): stort bogstav + farvet ord, fem lige A–E-felter (kun det aktuelle
 * i tonens farve, bogstaverne under), 36 px rækker, link med ikon, knap og note nederst.
 */
export interface CreditRatingProps {
  rating?: CreditRatingVM;
  title?: string;
  /** Teknisk fejl fra hentningen (resolveSpec), når der slet ingen vurdering er. */
  error?: string;
  /** PDF-rapporten (open-link) og "Prøv igen"/"Hent igen" (refresh). Uden den vises et almindeligt link og ingen knap. */
  onAction?: (a: ViewAction) => void;
}


/** Sætning med punktum til sidst, uanset om grunden selv har et. */
const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

/** Samme kort som Lassos risikoscore (18.1): ramme, titel 18/600, stort tegn + farvet ord, 36 px rækker. */
const CARD = "lasso-riskscore lasso-credit";
const TONE_INDEX: Record<CreditTone, 0 | 1 | 2> = { ok: 0, warning: 1, danger: 2 };

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
    <div className="lasso-riskscore__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const credits = (n: number) => `${formatNumber(n)} ${n === 1 ? "kredit" : "kreditter"}`;

/**
 * Købstrinnet (katalog 38, Jakob 01.10): vurderingen betales pr. styk, så kortet viser, hvad man får,
 * før man køber: en dæmpet forhåndsvisning af selve kortet (A–E-skalaen og rækkerne uden værdier),
 * en liste over indholdet, prisen og saldoen, og én primær knap med prisen. Købet bekræftes i dialogen
 * fra 18.3 og sendes som "refresh" (hent vurderingen).
 */
function CreditPurchase({ rating, heading, onAction }: { rating: CreditRatingVM; heading: string; onAction?: (a: ViewAction) => void }) {
  const [confirm, setConfirm] = useState(false);
  const price = rating.price ?? 1;
  const balance = rating.creditBalance;
  return (
    <Section title={heading} span="half" className={`${CARD} lasso-creditbuy`}>
      <div className="lasso-riskscore__body">
        <div className="lasso-creditbuy__preview" aria-hidden="true">
          <div className="lasso-riskscore__value">
            <span className="lasso-riskscore__number lasso-creditbuy__q">?</span>
            <span className="lasso-creditbuy__hint">Score A–E</span>
          </div>
          <ol className="lasso-credit__steps">
            {CREDIT_SCORES.map((l) => (
              <li key={l} className="lasso-credit__step">
                <span className="lasso-credit__bar" />
                <span>{l}</span>
              </li>
            ))}
          </ol>
          <dl className="lasso-riskscore__rows">
            <Fact label="Kreditmaksimum">
              <span className="lasso-creditbuy__blur" />
            </Fact>
            <Fact label="Lokal score">
              <span className="lasso-creditbuy__blur" />
            </Fact>
          </dl>
        </div>

        <div className="lasso-creditbuy__offer">
          <p className="lasso-creditbuy__lead">Køb kreditvurderingen fra {rating.source.replace(/ via Lasso$/, "")} og få:</p>
          <ul className="lasso-creditbuy__list">
            {CREDIT_PURCHASE_INCLUDES.map((t) => (
              <li key={t}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
          <div className="lasso-creditbuy__price">
            <span className="lasso-creditbuy__amount">{credits(price)}</span>
            <span className="lasso-creditbuy__per">pr. virksomhed{typeof balance === "number" ? `, du har ${credits(balance)}` : ""}</span>
          </div>
          {onAction ? (
            <button type="button" className="lasso-btn lasso-btn--primary lasso-creditbuy__btn" onClick={() => (typeof balance === "number" ? setConfirm(true) : onAction({ kind: "refresh" }))}>
              Køb kreditvurdering
            </button>
          ) : null}
          <p className="lasso-credit__note">Klar på 5–45 sekunder og gemt hos Lasso i 24 timer, så hele organisationen kan se den.</p>
        </div>
        {onAction && typeof balance === "number" ? (
          <CreditConfirmDialog
            open={confirm}
            onClose={() => setConfirm(false)}
            onConfirm={() => {
              setConfirm(false);
              onAction({ kind: "refresh" });
            }}
            balance={balance}
            price={price}
            title="Køb kreditvurdering?"
            what={`kreditvurderingen hos ${rating.source}`}
          />
        ) : null}
      </div>
    </Section>
  );
}

export function CreditRating({ rating, title, error, onAction }: CreditRatingProps) {
  const heading = title ?? "Kreditvurdering";
  const retry = onAction ? () => onAction({ kind: "refresh" }) : undefined;
  const [confirm, setConfirm] = useState(false);

  if (!rating) {
    if (error) {
      return (
        <Section title={heading} span="half" className={CARD}>
          {stateForError(error) === "noaccess" ? <DataState state="empty" reason={`Låst. ${sentence(error)}`} /> : <DataState state="error" reason={error} onRetry={retry} />}
        </Section>
      );
    }
    // Ventetilstanden: Creditsafe svarer på 5–45 sekunder, når vurderingen skal beregnes.
    return (
      <Section title={heading} span="half" className={CARD}>
        <DataState state="loading" lines={5} height={240} />
        <p className="lasso-credit__note">Henter vurderingen hos Creditsafe. Det kan tage op til 45 sekunder.</p>
      </Section>
    );
  }

  if (rating.state === "locked") {
    return (
      <Section title={heading} span="half" className={CARD}>
        {/* Låst (26h.1): indholdet dæmpes bag et forklarende kort. */}
        <DataState state="locked" reason={`Låst. ${sentence(rating.reason ?? CREDIT_LOCKED_REASON)}`} lines={4} />
      </Section>
    );
  }

  if (rating.state === "purchase") return <CreditPurchase rating={rating} heading={heading} onAction={onAction} />;

  if (rating.state === "unavailable") {
    const pending = rating.reason === CREDIT_PENDING_REASON;
    if (pending) {
      // På forespørgsel (26h.1): pris og varighed først, ventetilstand som 48 px række med ring.
      return (
        <Section title={heading} span="half" className={CARD}>
          <DataState
            state="onrequest"
            reason={`Ikke beregnet endnu. ${sentence(rating.reason!)} ${CREDIT_COST_NOTE}`}
            pending={{ title: "Henter vurdering …", detail: "ca. 5–45 sek. Du kan fortsætte imens." }}
          />
          {retry ? (
            <button type="button" className="lasso-riskscore__link" onClick={retry}>
              Hent igen
            </button>
          ) : null}
        </Section>
      );
    }
    return (
      <Section title={heading} span="half" className={CARD}>
        <DataState state="empty" reason={`Ikke beregnet endnu.${rating.reason ? ` ${sentence(rating.reason)}` : ""}`} />
      </Section>
    );
  }

  if (rating.state === "error") {
    return (
      <Section title={heading} span="half" className={CARD}>
        <DataState state="error" reason={rating.reason ?? error} onRetry={retry} />
      </Section>
    );
  }

  const current = rating.current;
  if (!current) {
    return (
      <Section title={heading} span="half" className={CARD}>
        <DataState state="notreported" />
      </Section>
    );
  }

  const score = current.internationalScore;
  const tone = score ? creditTone(score) : undefined;
  const word = score ? creditScoreWord(score, current.internationalDescription) : undefined;
  const local = typeof current.localScore === "number" ? `${formatNumber(current.localScore)}${current.localDescription ? `, ${creditDescription(current.localDescription)}` : ""}` : creditDescription(current.localDescription);

  return (
    <Section title={heading} span="half" className={CARD}>
      <div className="lasso-riskscore__body">
        {score && tone && word ? (
          <>
            <div className="lasso-riskscore__value">
              <span className="lasso-riskscore__number" aria-hidden="true">
                {score}
              </span>
              {/* Regel 7: tonen står som ikon + ord, aldrig farve alene. */}
              <span className={`lasso-riskscore__word lasso-riskscore__word--${TONE_INDEX[tone]} lasso-credit__word`}>
                <CreditToneIcon tone={tone} />
                <span className="lasso-sr-only">{score}, </span>
                {word}
              </span>
            </div>
            {/* Creditsafes A–E er ikke Lassos 0–100: fem lige felter, kun det aktuelle i tonens farve, bogstavet under. */}
            <ol className="lasso-credit__steps" aria-label="Creditsafes internationale score, A er lavest risiko og E højest">
              {CREDIT_SCORES.map((l) => (
                <li key={l} className={`lasso-credit__step${l === score ? ` is-current lasso-credit__step--${TONE_INDEX[tone]}` : ""}`} aria-current={l === score ? "true" : undefined} title={`${l}, ${creditScoreWord(l)}`}>
                  <span className="lasso-credit__bar" aria-hidden="true" />
                  <span>{l}</span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="lasso-riskscore__value">
            <span className="lasso-notreported">International score ikke oplyst</span>
          </p>
        )}

        {/* 18.1 (Jakob 29.09): ingen historik; kun den aktuelle score. Ingen "forrige" og ingen ændring. */}
        <dl className="lasso-riskscore__rows">
          <Fact label="Kreditmaksimum">{typeof current.creditMax === "number" ? formatCreditMax(current) : <Missing />}</Fact>
          <Fact label="Lokal score">{local ?? <Missing />}</Fact>
          {rating.latestChange ? <Fact label="Seneste ændring">{formatDate(rating.latestChange)}</Fact> : null}
        </dl>

        {rating.pdfUrl ? (
          onAction ? (
            <button type="button" className="lasso-riskscore__link" onClick={() => onAction({ kind: "open-link", url: rating.pdfUrl! })}>
              <ShellIcon name="download" size={14} />
              Hent kreditrapport (PDF)
            </button>
          ) : (
            <a className="lasso-riskscore__link" href={rating.pdfUrl} target="_blank" rel="noopener noreferrer">
              <ShellIcon name="download" size={14} />
              Hent kreditrapport (PDF)
            </a>
          )
        ) : null}

        {onAction && typeof rating.creditBalance === "number" ? (
          <>
            <button type="button" className="lasso-btn lasso-btn--sm lasso-credit__refresh" onClick={() => setConfirm(true)}>
              Hent ny vurdering
            </button>
            <CreditConfirmDialog
              open={confirm}
              onClose={() => setConfirm(false)}
              onConfirm={() => {
                setConfirm(false);
                onAction({ kind: "refresh" });
              }}
              balance={rating.creditBalance}
              what={`kreditvurderingen hos ${rating.source}`}
            />
          </>
        ) : null}

        <p className="lasso-credit__note">
          {CREDIT_COST_NOTE}
          {rating.cachedUntil ? ` Gemt hos Lasso til ${formatDate(rating.cachedUntil)}.` : ""}
        </p>
      </div>
    </Section>
  );
}
