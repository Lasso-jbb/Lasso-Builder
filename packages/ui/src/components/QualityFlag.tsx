import { useState } from "react";
import { ShellIcon } from "./ShellIcons.js";
import { Tooltip } from "./Tooltip.js";

/**
 * Kvalitetsflag (katalog 09.1 og 02c.16): 14 px udråbstegn i warning-farve 6 px efter tallet.
 * Forklaringen står i tooltip ved mouseover og tastaturfokus; på mobil, uden hover, vises den som
 * en linje under feltet ved tryk. Aldrig mærke, pille eller understregning. Ordet bæres af
 * aria-label (regel 7). `text` og `reason` er det samme (begge navne bruges i koden).
 */
export function QualityFlag({ text, reason, defaultOpen = false }: { text?: string; reason?: string; /** Forklaringen vist fra start (statisk forhåndsvisning): tooltip til højre på desktop, linje under på mobil. */ defaultOpen?: boolean }) {
  const msg = text ?? reason ?? "";
  const [open, setOpen] = useState(defaultOpen);
  return (
    <span className={open ? "lasso-qflag lasso-qflag--open" : "lasso-qflag"}>
      <Tooltip text={msg} className="lasso-qflag-tip lasso-tip--narrow" placement="right" open={defaultOpen ? true : undefined}>
        <button type="button" className="lasso-qflag__btn" aria-label={`Mulig fejl: ${msg}`} aria-expanded={open} onClick={() => setOpen(!open)}>
          <ShellIcon name="alert" size={14} />
        </button>
      </Tooltip>
      {open ? <span className="lasso-qflag__line">{msg}</span> : null}
    </span>
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
