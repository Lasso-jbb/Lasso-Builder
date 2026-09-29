import { useState, type ReactNode } from "react";
import { Icon } from "./Icon.js";

/**
 * Layoutmønstre fra Paper 30 (node J48-0), der ikke allerede dækkes af grid'et i LassoView
 * (mønster 1–7 er bredder ¼/½/¾/fuld og kolonner) eller af AppShell (06).
 *
 * Mønster 8, Kortgitter: artikler/kort i to kolonner med højde efter indhold, adskilt af luft og
 * tynde linjer, aldrig skygge. Én kolonne på mobil.
 *
 * Mønster 9, Harmonika: 48 px rækker med navn til venstre og pil til højre; bruges når ét modul
 * samler mange lange sektioner (fx Firmaindsigt). Flere kan stå åbne på desktop; på mobil åbner
 * en ny række den forrige lukker (styres af `single`).
 */
export function CardGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`lasso-cardgrid ${className}`}>{children}</div>;
}

export interface AccordionItem {
  id: string;
  title: ReactNode;
  /** Kort tekst til højre for navnet, fx "3 kommentarer" eller "Se detaljer" (ren tekst, ingen tæller-pille). */
  meta?: ReactNode;
  children: ReactNode;
}

export interface AccordionProps {
  items: readonly AccordionItem[];
  /** Åbne rækker (styret). Udeladt = komponenten holder selv styr på det. */
  open?: readonly string[];
  onToggle?: (id: string, open: boolean) => void;
  defaultOpen?: readonly string[];
  /** Kun én åben ad gangen (mobilregel i 30). */
  single?: boolean;
  className?: string;
}

export function Accordion({ items, open, onToggle, defaultOpen = [], single = false, className = "" }: AccordionProps) {
  const [inner, setInner] = useState<readonly string[]>(defaultOpen);
  const current = open ?? inner;
  const toggle = (id: string) => {
    const isOpen = current.includes(id);
    const next = isOpen ? current.filter((x) => x !== id) : single ? [id] : [...current, id];
    if (open === undefined) setInner(next);
    onToggle?.(id, !isOpen);
  };
  return (
    <div className={`lasso-accordion ${className}`}>
      {items.map((it) => {
        const isOpen = current.includes(it.id);
        return (
          <section key={it.id} className={`lasso-accordion__item ${isOpen ? "is-open" : ""}`}>
            <h3 className="lasso-accordion__head">
              <button type="button" className="lasso-accordion__button" aria-expanded={isOpen} aria-controls={`acc-${it.id}`} onClick={() => toggle(it.id)}>
                <span className="lasso-accordion__title">{it.title}</span>
                {it.meta ? <span className="lasso-accordion__meta">{it.meta}</span> : null}
                <Icon name="chevron-down" size={14} className="lasso-accordion__chevron" />
              </button>
            </h3>
            <div id={`acc-${it.id}`} className="lasso-accordion__panel" hidden={!isOpen}>
              {it.children}
            </div>
          </section>
        );
      })}
    </div>
  );
}
