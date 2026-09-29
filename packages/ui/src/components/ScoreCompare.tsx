import { formatDate } from "@lasso/spec";
import type { ReactNode } from "react";

export interface ScoreSide {
  /** Scoren som tekst: "52" (0–100) eller "B" (Creditsafe A–E). */
  value: string;
  /** Skalaen efter tallet, fx "af 100" (18.1). Udelades ved Creditsafes bogstaver. */
  of?: string;
  /** Vurderingen som ord, fx "Moderat risiko". */
  word?: string;
  /** Ikon ved ordet (regel 7: ikon + ord). */
  icon?: ReactNode;
  /** Tonens klasse til ordet: "ok" | "warning" | "danger". */
  tone?: "ok" | "warning" | "danger";
  /** Hentet/vurderet dato, ÅÅÅÅ-MM-DD. Står i overlinjen: "FORRIGE, 14.03.2026". */
  date?: string;
  /** Ekstra linje under ordet, fx "Kreditmaks 1,25 mio. kr., international score B. Kilde: Creditsafe". */
  detail?: ReactNode;
}

export interface ScoreCompareProps {
  previous: ScoreSide;
  current: ScoreSide;
  /**
   * Ændringen på risikoskalaen: "worse" = mere risiko (warning-tekst, aldrig grøn), "better" = mindre
   * risiko (almindelig tekst), "same" = uændret.
   */
  direction: "better" | "worse" | "same";
  /** Fx "5 point" eller "1 trin" (vises som "▲ 5 point, mere risiko"). Bruges, når `delta` mangler. */
  amount?: string;
  /** Ændringen med fortegn, fx "+5" (18.1: "+5, mere risiko"). Går forud for `amount`. */
  delta?: string;
  /** Tiden mellem de to vurderinger, fx "6 mdr." (muted under ændringen). */
  period?: string;
  /**
   * Handling i højre celle, fx "Hent ny, 1 kredit" (primær koral i 18.1). `note` står muted under
   * knappen, fx "Du har 38 kreditter, seneste hentning for 13 dage siden".
   */
  action?: { label: string; onClick: () => void; primary?: boolean; note?: ReactNode };
}

function Side({ label, side, strong }: { label: string; side: ScoreSide; strong?: boolean }) {
  return (
    <div className={`lasso-scorecmp__cell lasso-scorecmp__side${strong ? " is-current" : ""}`}>
      <span className="lasso-scorecmp__label">
        {label}
        {side.date ? `, ${formatDate(side.date)}` : ""}
      </span>
      <span className="lasso-scorecmp__score">
        <span className="lasso-scorecmp__value">{side.value}</span>
        {side.of ? <span className="lasso-scorecmp__of">{side.of}</span> : null}
      </span>
      {side.word ? (
        <span className={`lasso-scorecmp__word${side.tone ? ` lasso-scorecmp__word--${side.tone}` : ""}`}>
          {side.icon}
          {side.word}
        </span>
      ) : null}
      {side.detail ? <span className="lasso-scorecmp__detail">{side.detail}</span> : null}
    </div>
  );
}

/**
 * Forrige vs. nu (katalog 18.1, node BX9-0): én stribe i kortramme med fire celler adskilt af 1 px
 * linjer. Forrige (panel-flade, overlinje med dato), ændringen med koral pil ("+5, mere risiko" i
 * warning 600 og tiden imellem i muted), nu (koral overlinje med dato) og handlingen til højre
 * (primær "Hent ny, 1 kredit" med kreditsaldo under). En stigning er mere risiko og står i
 * warning-tekst, aldrig grøn (18.2).
 * Mobil: forrige, ændring og nu står side om side; handlingen lægger sig under i fuld bredde.
 */
export function ScoreCompare({ previous, current, direction, amount, delta, period, action }: ScoreCompareProps) {
  const arrow = direction === "worse" ? "▲" : direction === "better" ? "▼" : "";
  const word = direction === "worse" ? "mere risiko" : direction === "better" ? "mindre risiko" : "uændret";
  const text = delta ? (direction === "same" ? word : `${delta}, ${word}`) : `${arrow ? `${arrow} ` : ""}${amount ? `${amount}, ` : ""}${word}`;
  return (
    <div className={`lasso-scorecmp${action ? "" : " lasso-scorecmp--noact"}`}>
      <Side label="Forrige" side={previous} />
      <div className={`lasso-scorecmp__cell lasso-scorecmp__change lasso-scorecmp__change--${direction}`}>
        <svg className="lasso-scorecmp__arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="lasso-scorecmp__delta">{text}</span>
        {period ? <span className="lasso-scorecmp__period">{period}</span> : null}
      </div>
      <Side label="Nu" side={current} strong />
      {action ? (
        <div className="lasso-scorecmp__cell lasso-scorecmp__act">
          <button type="button" className={`lasso-btn${action.primary ? " lasso-btn--primary" : ""} lasso-scorecmp__action`} onClick={action.onClick}>
            {action.label}
          </button>
          {action.note ? <span className="lasso-scorecmp__note">{action.note}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
