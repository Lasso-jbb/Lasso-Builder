import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.js";

/**
 * Laget, alt det svævende tegnes i (katalog 07): dialoger, menuer og beskeder.
 *
 * I browseren tegnes indholdet i en React-portal i document.body, pakket i sin egen
 * `.lasso-root.lasso-layer` (fixed, hele viewporten), så tokens, tema og container-forespørgslen
 * "mobil < 560 px" gælder også dér, og intet element klippes af en rullende forælder.
 * Uden document (SSR, renderToStaticMarkup) tegnes indholdet på stedet.
 *
 * `ready` er sand, når laget er monteret. Fokusstyring skal vente på det, fordi React flytter
 * DOM-noderne, når indholdet går fra "på stedet" til portalen.
 */
export function useLayer(): { render: (node: ReactNode) => ReactNode; ready: boolean; anchor: () => HTMLElement | null } {
  const anchor = useRef<HTMLSpanElement>(null);
  const [mount, setMount] = useState<{ el: HTMLElement; theme: string } | null>(null);

  // Monteres, når ankeret står i dokumentet: komponentens eget dokument (fx en iframe i designguiden),
  // ikke altid det globale. Et lag, der først tegnes senere (et lukket panel), monteres dér, når det åbnes.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = anchor.current;
    if (!el) return;
    const body = el.ownerDocument.body;
    if (mount?.el === body) return;
    const root = el.closest<HTMLElement>(".lasso-root");
    setMount({ el: body, theme: root?.getAttribute("data-theme") ?? "light" });
  });

  const render = (node: ReactNode) => (
    <>
      <span ref={anchor} hidden data-lasso-anchor="" />
      {mount ? (
        createPortal(
          <div className="lasso-root lasso-layer" data-theme={mount.theme}>
            {node}
          </div>,
          mount.el,
        )
      ) : (
        node
      )}
    </>
  );
  return { render, ready: mount !== null, anchor: () => anchor.current };
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hidden && el.getAttribute("aria-hidden") !== "true");
}

/** Luk-kryds, 32 px neutral (07). Fra ikonsættet (01, streg 1,8). */
export function CloseIcon({ size = 16 }: { size?: number }) {
  return <Icon name="close" size={size} />;
}

/** Flueben til valgt punkt (vælgerliste) og "gemt"-beskeder. Fra ikonsættet (01, streg 1,8). */
export function CheckIcon({ size = 16 }: { size?: number }) {
  return <Icon name="check" size={size} />;
}
