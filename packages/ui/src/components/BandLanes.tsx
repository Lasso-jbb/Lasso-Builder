import type { ReactNode } from "react";
import { Icon } from "./Icon.js";

/** Ét bånd på tidsaksen: venstre kant og bredde i procent, båndets klasse og etiketten over det. */
export interface LaneSeg {
  left: number;
  width: number;
  /** Fx "lasso-personroles__band lasso-personroles__band--owner". */
  cls: string;
  label: string;
  /** Tilføjelse efter etiketten, fx ", under konkurs" i rødt. */
  tail?: ReactNode;
}

/**
 * Tidsbånd for én række (roller i et selskab eller relationer til en person), Jakob 02.10: lukket står alle
 * bånd på ÉN linje med en samlet etiket; åbnet står hvert bånd på sin egen linje med sin etiket. Med ét
 * bånd er der ingen forskel. Etiketten bliver altid inden for sporet (afkortes med "…"; fuld tekst i title).
 */
export function BandLanes({ segs, summary, open, children }: { segs: readonly LaneSeg[]; summary: string; open: boolean; children?: ReactNode }) {
  // På den samlede linje tegnes de længste bånd først, så de korte (fx en direktørpost oven i et ejerskab) står øverst og ses.
  const lanes = open || segs.length <= 1 ? segs.map((s) => ({ label: s.label, tail: s.tail, bands: [s] })) : [{ label: summary, tail: undefined, bands: [...segs].sort((a, b) => b.width - a.width) }];
  return (
    <div className="lasso-personroles__track">
      {lanes.map((lane, i) => {
        const left = Math.min(...lane.bands.map((b) => b.left));
        const right = Math.max(...lane.bands.map((b) => b.left + b.width));
        const anchorRight = left > 55;
        return (
          <div key={i} className="lasso-personroles__lane" title={lane.label}>
            <span
              className="lasso-personroles__bandlabel"
              style={anchorRight ? { right: `${Math.max(0, 100 - right)}%`, textAlign: "right", maxWidth: `${Math.max(40, right)}%` } : { left: `${left}%`, maxWidth: `${100 - left}%` }}
            >
              {lane.label}
              {lane.tail}
            </span>
            {lane.bands.map((b, k) => (
              <span key={k} className={b.cls} style={{ left: `${b.left}%`, width: `${b.width}%` }} />
            ))}
          </div>
        );
      })}
      {children}
    </div>
  );
}

/** Fold-knappen foran navnet: "▸" lukket, "▾" åben; kun når rækken har mere end ét bånd. */
export function LaneToggle({ open, count, what, onToggle }: { open: boolean; count: number; what: string; onToggle: () => void }) {
  return (
    <button type="button" className="lasso-lanes__toggle" aria-expanded={open} aria-label={`${open ? "Skjul" : "Vis"} alle ${count} ${what}`} title={`${open ? "Skjul" : "Vis"} alle ${count} ${what}`} onClick={onToggle}>
      <Icon name={open ? "chevron-down" : "chevron-right"} size={14} />
    </button>
  );
}
