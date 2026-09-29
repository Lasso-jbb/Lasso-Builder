import type { ReactNode } from "react";
import { useWidth } from "../useWidth.js";
import { Menu, type MenuItem } from "./Menu.js";
import { ShellIcon } from "./ShellIcons.js";
import { Tabs, type TabItem } from "./Tabs.js";

/**
 * Modulbjælken (katalog 06, node 9I4-0): 56 px øverst på sidens hvide flade. Hvert punkt er et
 * modul (Overblik, Salg, Stamoplysninger, Nøgletal, Ejerdiagram …), tegnet med Tabs niveau 1
 * (ink 600 + 2 px koral streg). Over 8 moduler samles resten bag "Flere"; på tablet (bjælken
 * under 900 px) maks 5 synlige + Flere.
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
  /** Fast antal synlige moduler (ellers 8, og 5 når bjælken er under 900 px). */
  maxVisible?: number;
  className?: string;
}

export function ModuleBar({ modules, value, onChange, actions = [], ariaLabel = "Moduler", id, maxVisible: fixed, className = "" }: ModuleBarProps) {
  const [ref, width] = useWidth<HTMLDivElement>(1200);
  const maxVisible = fixed ?? (width < 900 ? 5 : 8);
  return (
    <div ref={ref} className={`lasso-modulebar ${className}`}>
      <Tabs level={1} id={id} items={modules} value={value} onChange={onChange} ariaLabel={ariaLabel} maxVisible={maxVisible} className="lasso-modulebar__tabs" />
      {actions.length > 0 ? (
        <div className="lasso-modulebar__actions">
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
