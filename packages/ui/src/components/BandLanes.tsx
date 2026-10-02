import type { ReactNode } from "react";
import { Icon } from "./Icon.js";

/**
 * Rollernes farver i alle tidsbånd (Jakob 02.10): direktion, bestyrelse og ejer har hver sin farve; alt andet
 * (stifter, interessent, reel ejer …) er stiplet og har ingen etiket i legenden. Ophørte roller står i samme
 * farve, men dæmpet.
 */
export type RoleTone = "direction" | "board" | "owner" | "other";
export const ROLE_TONE_LABEL: Record<Exclude<RoleTone, "other">, string> = { direction: "Direktion", board: "Bestyrelse", owner: "Ejer" };

export function toneOfKind(kind: string | undefined): RoleTone {
  return kind === "direction" || kind === "board" || kind === "owner" ? kind : "other";
}

/** Tonen ud fra rolleteksten (netværket har kun teksten), fx "bestyrelsesformand" → bestyrelse. */
export function toneOfRole(role: string | undefined): RoleTone {
  const r = (role ?? "").toLowerCase();
  if (/reel/.test(r)) return "other";
  if (/ejer/.test(r)) return "owner";
  if (/bestyrelse|formand|suppleant/.test(r)) return "board";
  if (/direkt/.test(r)) return "direction";
  return "other";
}

export function roleBandClass(tone: RoleTone, ended: boolean): string {
  return `lasso-role-band lasso-role-band--${tone}${ended ? " is-ended" : ""}`;
}

/** Legenden: kun de tre farver, der forekommer; det stiplede navngives ikke. */
export function RoleLegend({ tones }: { tones: Iterable<RoleTone> }) {
  const present = new Set(tones);
  const shown = (["direction", "board", "owner"] as const).filter((t) => present.has(t));
  if (!shown.length) return null;
  return (
    <div className="lasso-personroles__legend" aria-hidden="true">
      {shown.map((t) => (
        <span key={t} className="lasso-personroles__key">
          <span className={`lasso-role-swatch lasso-role-band--${t}`} />
          {ROLE_TONE_LABEL[t]}
        </span>
      ))}
    </div>
  );
}

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
              // Bjælken holdes inden for sporet (et bånd, der starter i år, flyttes ind, så det ikke løber ud).
              <span key={k} className={b.cls} style={{ left: `${Math.min(b.left, 100 - b.width)}%`, width: `${b.width}%` }} />
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
