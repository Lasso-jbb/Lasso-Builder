import { formatDate } from "@lasso/spec";
import type { ReactNode } from "react";

export interface ScoreSide {
  /** Scoren som tekst: "52" (0–100) eller "B" (Creditsafe A–E). */
  value: string;
  /** Vurderingen som ord, fx "Moderat risiko". */
  word?: string;
  /** Ikon ved ordet (regel 7: ikon + ord). */
  icon?: ReactNode;
  /** Tonens klasse til ordet: "ok" | "warning" | "danger". */
  tone?: "ok" | "warning" | "danger";
  /** Hentet/vurderet dato, ÅÅÅÅ-MM-DD. */
  date?: string;
}

export interface ScoreCompareProps {
  previous: ScoreSide;
  current: ScoreSide;
  /**
   * Ændringen på risikoskalaen: "worse" = mere risiko (▲, warning-tekst, aldrig grøn), "better" = mindre
   * risiko (▼, almindelig tekst), "same" = uændret.
   */
  direction: "better" | "worse" | "same";
  /** Fx "5 point" eller "1 trin". */
  amount?: string;
  /** Handling til højre, fx "Hent ny vurdering". */
  action?: { label: string; onClick: () => void };
}

function Side({ label, side, strong }: { label: string; side: ScoreSide; strong?: boolean }) {
  return (
    <div className={`lasso-scorecmp__side${strong ? " is-current" : ""}`}>
      <span className="lasso-scorecmp__label">{label}</span>
      <span className="lasso-scorecmp__value">{side.value}</span>
      {side.word ? (
        <span className={`lasso-scorecmp__word${side.tone ? ` lasso-scorecmp__word--${side.tone}` : ""}`}>
          {side.icon}
          {side.word}
        </span>
      ) : null}
      {side.date ? <span className="lasso-scorecmp__date">{formatDate(side.date)}</span> : null}
    </div>
  );
}

/**
 * Forrige vs. nu (katalog 18.1, node BX9-0): to scorer side om side, ændringen som pil imellem og en
 * handling til højre. En stigning er mere risiko og står i warning-tekst, aldrig grøn (18.2).
 * Mobil: de to scorer står stadig side om side; handlingen lægger sig under i fuld bredde.
 */
export function ScoreCompare({ previous, current, direction, amount, action }: ScoreCompareProps) {
  const arrow = direction === "worse" ? "▲" : direction === "better" ? "▼" : "";
  const word = direction === "worse" ? "mere risiko" : direction === "better" ? "mindre risiko" : "uændret";
  return (
    <div className="lasso-scorecmp">
      <Side label="Forrige" side={previous} />
      <div className={`lasso-scorecmp__change lasso-scorecmp__change--${direction}`}>
        <svg className="lasso-scorecmp__arrow" width="28" height="12" viewBox="0 0 28 12" fill="none" aria-hidden="true">
          <path d="M1 6h24M20 1l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="lasso-scorecmp__delta">
          {arrow ? `${arrow} ` : ""}
          {amount ? `${amount}, ` : ""}
          {word}
        </span>
      </div>
      <Side label="Nu" side={current} strong />
      {action ? (
        <button type="button" className="lasso-btn lasso-btn--sm lasso-scorecmp__action" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
