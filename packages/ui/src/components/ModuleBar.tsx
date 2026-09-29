import { useEffect, useState, type ReactNode } from "react";
import { useWidth } from "../useWidth.js";
import { Menu, type MenuItem } from "./Menu.js";
import { ShellIcon } from "./ShellIcons.js";
import { Tabs, type TabItem } from "./Tabs.js";

/**
 * Modulbjælken (katalog 06, node 9I4-0): 56 px øverst på sidens hvide flade. Hvert punkt er et
 * modul (Overblik, Salg, Stamoplysninger, Nøgletal, Ejerdiagram …), tegnet med Tabs niveau 1
 * (ink 600 + 2 px koral streg). Der vises så mange moduler, som der er plads til mellem venstre kant og
 * handlingerne (06.1: ved fuld bredde 8–9); resten samles bag "Flere" med pilen lige efter ordet.
 * På tablet (bjælken under 900 px) højst 4 + Flere.
 *
 * Sidens handlinger står yderst til højre adskilt af 1 px lodrette linjer: "Eksportér ▾" (menu),
 * "Gemt" (koral bogmærke + koral tekst, tone "accent") og "Overvåg" (koral ikon + tekst).
 */
export interface ModuleAction {
  id: string;
  label: string;
  icon?: ReactNode;
  /** "accent": koral ikon og tekst (Gemt, Overvåg). Ellers ink. */
  tone?: "accent";
  /** Åbner en menu: viser en pil efter navnet og aria-haspopup. */
  menu?: boolean;
  /** Menuens punkter (24.3: "Eksportér ▾" med PDF, CSV og link). Sat: knappen åbner selv menuen. */
  items?: readonly MenuItem[];
  onSelect?: () => void;
}

export interface ModuleBarProps {
  modules: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
  actions?: readonly ModuleAction[];
  ariaLabel?: string;
  /** Samme id gives til <TabPanel>, så aria-controls hænger sammen. */
  id?: string;
  /** Fast antal pladser inkl. "Flere" (ellers så mange, der er plads til; højst 5 under 900 px). */
  maxVisible?: number;
  className?: string;
}

/** Fanernes mål i modulbjælken (styles.css .lasso-modulebar): 24 px venstre luft, 28 px mellem faner, 16 px før handlingerne. */
const PAD_LEFT = 24;
const TAB_GAP = 28;
const BAR_GAP = 16;
/** "Flere" + pil (padding-right 18 px). */
const MORE_W = 54;

let canvas: CanvasRenderingContext2D | null | undefined;
/** Tekstens bredde i 14 px Poppins (400, valgt fane 600); uden DOM et skøn på 7,6 px pr. tegn. */
function labelWidth(label: string, bold = false): number {
  if (canvas === undefined) canvas = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!canvas) return label.length * 7.6;
  canvas.font = `${bold ? 600 : 400} 14px Poppins, system-ui, sans-serif`;
  return Math.ceil(canvas.measureText(label).width);
}

/**
 * Antal pladser (inkl. "Flere") til modulerne på `available` px. Alle, hvis de kan stå uden "Flere";
 * ellers så mange, at de sammen med "Flere" er inden for bredden (mindst 2 pladser).
 */
export function fitModules(labels: readonly string[], available: number, measure: (label: string) => number = labelWidth): number {
  const w = labels.map((l) => measure(l));
  const total = w.reduce((a, b, i) => a + b + (i > 0 ? TAB_GAP : 0), 0);
  if (total <= available) return labels.length;
  let used = MORE_W;
  let k = 0;
  while (k < labels.length && used + w[k]! + TAB_GAP <= available) used += w[k++]! + TAB_GAP;
  return Math.max(2, k + 1);
}

export function ModuleBar({ modules, value, onChange, actions = [], ariaLabel = "Moduler", id, maxVisible: fixed, className = "" }: ModuleBarProps) {
  const [ref, width] = useWidth<HTMLDivElement>(1200);
  const [actionsRef, actionsWidth] = useWidth<HTMLDivElement>(0);
  // Tekstbredderne måles med skriften; mål igen, når Poppins er hentet (ellers måles med reserveskriften).
  const [, setFontsReady] = useState(false);
  useEffect(() => {
    let live = true;
    void (typeof document !== "undefined" ? document.fonts?.ready : undefined)?.then(() => live && setFontsReady(true));
    return () => {
      live = false;
    };
  }, []);
  const room = width - PAD_LEFT - (actions.length > 0 ? actionsWidth + BAR_GAP : 0);
  const fit = fitModules(modules.map((m) => m.label), room, (l) => labelWidth(l, modules.find((m) => m.label === l)?.id === value));
  const maxVisible = fixed ?? (width < 900 ? Math.min(5, fit) : fit);
  return (
    <div ref={ref} className={`lasso-modulebar ${className}`}>
      <Tabs level={1} id={id} items={modules} value={value} onChange={onChange} ariaLabel={ariaLabel} maxVisible={maxVisible} className="lasso-modulebar__tabs" />
      {actions.length > 0 ? (
        <div ref={actionsRef} className="lasso-modulebar__actions">
          {actions.map((a) =>
            a.items?.length ? (
              <Menu
                key={a.id}
                trigger={
                  <>
                    {a.icon ? <span className="lasso-modulebar__action-icon">{a.icon}</span> : null}
                    <span>{a.label}</span>
                    <ShellIcon name="chevron-down" size={13} className="lasso-modulebar__caret" />
                  </>
                }
                triggerClassName={`lasso-modulebar__action ${a.tone === "accent" ? "lasso-modulebar__action--accent" : ""}`}
                items={a.items}
                align="end"
                label={a.label}
              />
            ) : (
            <button key={a.id} type="button" className={`lasso-modulebar__action ${a.tone === "accent" ? "lasso-modulebar__action--accent" : ""}`} aria-haspopup={a.menu ? "menu" : undefined} title={a.label} onClick={a.onSelect}>
              {a.icon ? <span className="lasso-modulebar__action-icon">{a.icon}</span> : null}
              <span>{a.label}</span>
              {a.menu ? <ShellIcon name="chevron-down" size={13} className="lasso-modulebar__caret" /> : null}
            </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
