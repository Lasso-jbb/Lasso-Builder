import { moreText } from "@lasso/spec";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { CloseIcon, focusables, useLayer } from "./Layer.js";
import { ShellIcon } from "./ShellIcons.js";

/**
 * "Se alle"-panelet fra højre (katalog 08.7, node I7B-0). Det generelle mønster, når der er flere
 * værdier, end formen på siden kan vise (kontaktpersoner, telefonnumre, e-mails, P-enheder,
 * bibrancher, ejere): siden viser de første 3 og et "Se N …"-link, og klik på link, række eller ikon
 * åbner panelet over siden.
 *
 * - Desktop: 720 px, glider ind fra højre, 30 % mørk overlay; liste til venstre (grupper) og detalje
 *   til højre.
 * - Tablet (≤ 960 px): 600 px, liste 240 + detalje.
 * - Mobil (≤ 560 px): fuldskærmsark; først listen, klik på en række viser detaljen med tilbagepil.
 *
 * Luk-knappen er neutral 32 px med kant (aldrig koral cirkel). Esc og klik på overlayet lukker,
 * fokusfælde mens panelet er åbent, fokus tilbage til det, der åbnede det.
 */
export interface SidePanelProps {
  open: boolean;
  title: string;
  /** Muted efter titlen, fx "LASSO X A/S, 16 personer, eksempeldata". */
  subtitle?: ReactNode;
  onClose: () => void;
  /** Venstre kolonne (fx SidePanelList). */
  list: ReactNode;
  /** Højre kolonne: detaljen for det valgte punkt. Uden detalje fylder listen hele panelet. */
  detail?: ReactNode;
  /**
   * Mobil: hvilken side af arket der vises. "detail" viser detaljen med tilbagepil ("Tilbage til
   * listen" kalder onBack). Desktop og tablet viser altid begge kolonner.
   */
  view?: "list" | "detail";
  onBack?: () => void;
  /** Titel på detaljesiden på mobil, fx "Kontaktperson". */
  detailTitle?: string;
  closeLabel?: string;
  className?: string;
  /**
   * "seeall" (08.7, Paper L75-0): på skærme ≥ 1200 px et bredt panel (1104 px) i portalens ramme med
   * tre kolonner: `aside` (virksomheden, 320) | liste (flex) | detalje (360). Under 1200 px det
   * almindelige panel fra højre (08.9) og arket på mobil (08.10/08.11), uden `aside`.
   */
  /**
   * "flere" (Se flere, Jakob 01.10): panelet glider ind fra højre og dækker de højre 2/3 af visningen
   * (siden bag panelet, typisk første kolonne, står synlig), uden mørk overlay; liste i midten og
   * detalje til højre. Smallere visning end 560 px: hele bredden (arket på mobil).
   */
  variant?: "default" | "seeall" | "flere";
  /** Første kolonne i "seeall" på desktop (fx virksomhedens kontaktoplysninger og genveje). */
  aside?: ReactNode;
}

/** Lukke-animationens længde (fade ud); panelet afmonteres bagefter. */
const CLOSE_MS = 180;

export function SidePanel({ open, title, subtitle, onClose, list, detail, view = "list", onBack, detailTitle, closeLabel = "Luk", className = "", variant = "default", aside }: SidePanelProps) {
  const layer = useLayer();
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  // Lukning fader ud, før panelet forsvinder: `shown` holder det tegnet, mens `closing` er sand.
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      setShown(true);
      setClosing(false);
      return;
    }
    if (!shown) return;
    setClosing(true);
    const t = setTimeout(() => {
      setShown(false);
      setClosing(false);
    }, CLOSE_MS);
    return () => clearTimeout(t);
  }, [open]);

  // "flere": panelets plads er de højre 2/3 af visningen, den blev åbnet fra (følger rulning og størrelse).
  const [area, setArea] = useState<CSSProperties | undefined>(undefined);
  useLayoutEffect(() => {
    if (variant !== "flere" || !shown || !layer.ready) return;
    const anchor = layer.anchor();
    const root = anchor?.closest<HTMLElement>(".lasso-root:not(.lasso-layer)");
    const win = anchor?.ownerDocument.defaultView;
    if (!root || !win) return;
    const place = () => {
      const r = root.getBoundingClientRect();
      const full = r.width <= 560;
      const width = full ? r.width : Math.round((r.width * 2) / 3);
      setArea({ top: Math.max(0, r.top), bottom: Math.max(0, win.innerHeight - r.bottom), right: Math.max(0, win.innerWidth - r.right), width });
    };
    place();
    win.addEventListener("resize", place);
    win.addEventListener("scroll", place, true);
    return () => {
      win.removeEventListener("resize", place);
      win.removeEventListener("scroll", place, true);
    };
  }, [variant, shown, layer.ready]);

  useEffect(() => {
    if (!open || !layer.ready) return;
    const previous = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    (panel.current?.querySelector<HTMLElement>("[aria-current='true']") ?? panel.current)?.focus();
    return () => previous?.focus?.();
  }, [open, layer.ready]);

  if (!shown) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    // Skjulte elementer (mobilens anden side af arket) springes over.
    const els = focusables(panel.current).filter((el) => el.offsetParent !== null);
    if (els.length === 0) return;
    const first = els[0]!;
    const last = els[els.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return layer.render(
    <div className={`lasso-sidepanel-wrap${variant === "flere" ? " lasso-sidepanel-wrap--flere" : ""}${closing ? " is-closing" : ""}`}>
      {variant === "flere" ? null : <div className="lasso-sidepanel__scrim" onClick={onClose} aria-hidden="true" />}
      <div
        ref={panel}
        role="dialog"
        aria-modal={variant === "flere" ? undefined : "true"}
        aria-labelledby={titleId}
        tabIndex={-1}
        style={variant === "flere" ? area : undefined}
        className={`lasso-sidepanel${detail ? "" : " lasso-sidepanel--list-only"}${variant === "seeall" ? " lasso-sidepanel--seeall" : ""}${variant === "flere" ? " lasso-sidepanel--flere" : ""}${aside ? " lasso-sidepanel--aside" : ""}${closing ? " is-closing" : ""} ${className}`}
        data-view={detail ? view : "list"}
        onKeyDown={onKeyDown}
      >
        <header className="lasso-sidepanel__head">
          <div className="lasso-sidepanel__titles lasso-sidepanel__titles--list">
            <h2 id={titleId} className="lasso-sidepanel__title">
              {title}
            </h2>
            {subtitle ? <span className="lasso-sidepanel__subtitle">{subtitle}</span> : null}
          </div>
          {detail ? (
            <div className="lasso-sidepanel__titles lasso-sidepanel__titles--detail">
              <button type="button" className="lasso-sidepanel__back" onClick={onBack} aria-label="Tilbage til listen">
                <ShellIcon name="chevron-left" size={18} />
              </button>
              <span className="lasso-sidepanel__title">{detailTitle ?? title}</span>
            </div>
          ) : null}
          <button type="button" className="lasso-sidepanel__close" onClick={onClose} aria-label={closeLabel}>
            <CloseIcon />
          </button>
        </header>
        <div className="lasso-sidepanel__body">
          {aside ? <div className="lasso-sidepanel__aside">{aside}</div> : null}
          <div className="lasso-sidepanel__list">{list}</div>
          {detail ? <div className="lasso-sidepanel__detail">{detail}</div> : null}
        </div>
      </div>
    </div>,
  );
}

export interface SidePanelListItem {
  id: string;
  title: string;
  sub?: string;
  /** Til højre i rækken, fx kanal-ikoner (faint, når kanalen mangler). */
  trailing?: ReactNode;
}

export interface SidePanelListProps {
  groups: readonly { label?: string; items: readonly SidePanelListItem[] }[];
  selected?: string;
  onSelect: (id: string) => void;
  /** Antal rækker før "Vis N flere" (standard 8). */
  limit?: number;
  ariaLabel?: string;
}

/**
 * Panelets venstre kolonne: grupper med overlinje (11/600), rækker med navn og rolle i muted,
 * valgt række = koral-soft flade + 2 px koral venstrekant. På mobil 52 px rækker med pil.
 */
export function SidePanelList({ groups, selected, onSelect, limit = 8, ariaLabel }: SidePanelListProps) {
  const [all, setAll] = useState(false);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  let left = all ? Infinity : limit;
  // Den valgte række skal altid kunne ses, også når den står efter grænsen.
  const selectedIndex = groups.flatMap((g) => g.items).findIndex((i) => i.id === selected);
  if (!all && selectedIndex >= limit) left = selectedIndex + 1;
  const shownTotal = Math.min(total, left);
  return (
    <nav className="lasso-panellist" aria-label={ariaLabel}>
      {groups.map((g, gi) => {
        if (left <= 0) return null;
        const items = g.items.slice(0, left);
        left -= items.length;
        return (
          <div className="lasso-panellist__group" key={`${g.label ?? ""}-${gi}`}>
            {g.label ? <div className="lasso-panellist__label">{g.label}</div> : null}
            <ul className="lasso-panellist__items">
              {items.map((it) => (
                <li key={it.id}>
                  <button type="button" className={`lasso-panellist__row${it.id === selected ? " is-selected" : ""}`} aria-current={it.id === selected ? "true" : undefined} onClick={() => onSelect(it.id)}>
                    <span className="lasso-panellist__main">
                      <span className="lasso-panellist__name">{it.title}</span>
                      {it.sub ? <span className="lasso-panellist__sub">{it.sub}</span> : null}
                    </span>
                    {it.trailing ? <span className="lasso-panellist__trailing">{it.trailing}</span> : null}
                    <ShellIcon name="chevron-right" size={16} className="lasso-panellist__chevron" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {shownTotal < total ? (
        <button type="button" className="lasso-link lasso-panellist__more" onClick={() => setAll(true)}>
          Vis {moreText(total - shownTotal)}
        </button>
      ) : null}
    </nav>
  );
}
