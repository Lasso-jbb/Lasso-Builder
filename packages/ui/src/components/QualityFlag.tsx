import { ShellIcon } from "./ShellIcons.js";
import { Tooltip } from "./Tooltip.js";

/**
 * Kvalitetsflag (katalog 09.1): lille gult udråbstegn (14 px) ved tallet. Forklaringen står i
 * tooltip ved mouseover og tastaturfokus og på mobil ved tap (knappen får fokus), aldrig som mærke,
 * pille eller understregning. Ordet bæres af aria-label (regel 7).
 */
export function QualityFlag({ text }: { text: string }) {
  return (
    <Tooltip text={text} className="lasso-qflag-tip">
      <button type="button" className="lasso-qflag" aria-label={`Bemærk: ${text}`}>
        <ShellIcon name="alert" size={14} />
      </button>
    </Tooltip>
  );
}

/** Info-ikon ved en nøgle (katalog 09.2): forklarer begrebet i tooltip. */
export function InfoHint({ text, label }: { text: string; label: string }) {
  return (
    <Tooltip text={text} className="lasso-infohint-tip">
      <button type="button" className="lasso-infohint" aria-label={`Hvad er ${label.toLowerCase()}?`}>
        <ShellIcon name="info" size={13} />
      </button>
    </Tooltip>
  );
}
