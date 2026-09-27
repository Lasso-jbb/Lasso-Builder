import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { CheckIcon, useLayer } from "./Layer.js";

/**
 * Menu (katalog 07, node 9L1-0): svæver med --lasso-shadow-pop, radius 10, 6 px padding, 36 px punkter
 * med ikon. Destruktivt punkt i rød nederst, adskilt af en linje. Vælgerliste (Picker) er samme
 * markup med gruppeoverskrift som overlinje og valgt punkt = koral-soft flade + flueben.
 *
 * Mobil (26a, < 560 px): "…"-menuer bliver handlingsark nederst: kontekst øverst (hvad handler det
 * om), 52 px rækker med ikon, destruktiv i rød nederst, separat Annuller-kort. CSS vælger; markup er ens.
 *
 * Tilgængelighed: knap med aria-haspopup/aria-expanded, liste role=menu med menuitem
 * (menuitemradio + aria-checked i vælgerlisten). Piletaster, Home/End, Esc lukker og giver fokus
 * tilbage til knappen, klik udenfor lukker. Listen står altid i markup (hidden når lukket).
 */
export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Lille tekst under navnet, fx "Start forfra". */
  sub?: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface MenuGroup {
  /** Gruppeoverskrift som overlinje (11/600, versaler), fx "Gemte". */
  label?: string;
  items: readonly MenuItem[];
}

export interface MenuProps {
  /** Knappens indhold, fx "Flere" eller et "…"-ikon. */
  trigger: ReactNode;
  triggerClassName?: string;
  /** Skærmlæsertekst på knappen, når indholdet kun er et ikon. */
  triggerLabel?: string;
  items?: readonly MenuItem[];
  /** Vælgerliste: grupper i stedet for en flad liste. */
  groups?: readonly MenuGroup[];
  /** Vælgerliste: id på det valgte punkt (flueben + koral-soft). */
  value?: string;
  /** Hvilken kant af knappen listen flugter med. */
  align?: "start" | "end";
  /** Mobil: kontekst øverst i handlingsarket. */
  context?: { title: string; subtitle?: string };
  /** aria-label på listen, fx "Flere faner". */
  label?: string;
  cancelLabel?: string;
  className?: string;
  /** Åben fra start (statisk forhåndsvisning og tests). */
  defaultOpen?: boolean;
}

type Pos = { x: number; y: number; up: boolean };

export function Menu({ trigger, triggerClassName = "lasso-btn lasso-btn--ghost", triggerLabel, items, groups, value, align = "start", context, label, cancelLabel = "Annuller", className = "", defaultOpen = false }: MenuProps) {
  const layer = useLayer();
  const id = useId();
  const listId = `${id}-menu`;
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [pos, setPos] = useState<Pos | null>(null);

  const allGroups: readonly MenuGroup[] = groups ?? [{ items: items ?? [] }];
  const picker = groups !== undefined || value !== undefined;
  const flat = allGroups.flatMap((g) => g.items);

  const place = useCallback(() => {
    const b = button.current;
    if (!b || typeof window === "undefined") return;
    const r = b.getBoundingClientRect();
    const h = list.current?.offsetHeight ?? 0;
    const up = r.bottom + 6 + h > window.innerHeight && r.top - 6 - h > 0;
    setPos({ x: align === "end" ? r.right : r.left, y: up ? r.top - 6 : r.bottom + 6, up });
  }, [align]);

  const close = useCallback(
    (refocus = false) => {
      setOpen(false);
      if (refocus) button.current?.focus();
    },
    [],
  );

  // Åben: placér ved knappen, fokus på første punkt, luk ved klik udenfor, Esc, rul og resize.
  useEffect(() => {
    if (!open || !layer.ready) return;
    place();
    const first = list.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])');
    first?.focus();
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (list.current?.contains(t) || button.current?.contains(t)) return;
      close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, layer.ready, place, close]);

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const els = Array.from(list.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? []);
    if (els.length === 0) return;
    const i = els.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => els[(n + els.length) % els.length]?.focus();
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(els.length - 1);
    else if (e.key === "Tab") return close();
    else return;
    e.preventDefault();
  };

  const select = (item: MenuItem) => {
    if (item.disabled) return;
    close(true);
    item.onSelect?.();
  };

  const style = pos
    ? ({ "--lasso-menu-x": `${Math.round(pos.x)}px`, "--lasso-menu-y": `${Math.round(pos.y)}px` } as CSSProperties)
    : undefined;

  return (
    <span className={`lasso-menu ${className}`}>
      <button
        ref={button}
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={triggerLabel}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {trigger}
      </button>
      {layer.render(
        <>
        <div className="lasso-menu__scrim" onClick={() => close()} aria-hidden="true" hidden={!open} />
        <div
          ref={list}
          id={listId}
          className={`lasso-menu__pop ${picker ? "lasso-menu__pop--picker" : ""} ${layer.ready ? "lasso-menu__pop--layer" : ""} ${pos?.up ? "lasso-menu__pop--up" : ""} ${align === "end" ? "lasso-menu__pop--end" : ""} ${flat.length > 0 ? "" : "is-empty"}`}
          hidden={!open}
          style={style}
        >
          {context ? (
            <div className="lasso-menu__context">
              <div className="lasso-menu__context-title">{context.title}</div>
              {context.subtitle ? <div className="lasso-menu__context-sub">{context.subtitle}</div> : null}
            </div>
          ) : null}
          <div role="menu" aria-label={label} className="lasso-menu__list" onKeyDown={onListKey}>
            {allGroups.map((g, gi) => (
              <div key={gi} className="lasso-menu__group" role="group" aria-label={g.label}>
                {g.label ? <div className="lasso-menu__heading">{g.label}</div> : null}
                {g.items.map((item) => {
                  const on = value !== undefined && item.id === value;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role={picker ? "menuitemradio" : "menuitem"}
                      aria-checked={picker ? on : undefined}
                      disabled={item.disabled}
                      tabIndex={-1}
                      className={`lasso-menu__item ${item.destructive ? "lasso-menu__item--danger" : ""} ${on ? "is-on" : ""}`}
                      onClick={() => select(item)}
                    >
                      {item.icon ? <span className="lasso-menu__icon">{item.icon}</span> : null}
                      <span className="lasso-menu__text">
                        <span className="lasso-menu__label">{item.label}</span>
                        {item.sub ? <span className="lasso-menu__sub">{item.sub}</span> : null}
                      </span>
                      {on ? (
                        <span className="lasso-menu__check">
                          <CheckIcon />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <button type="button" className="lasso-menu__cancel" onClick={() => close(true)}>
            {cancelLabel}
          </button>
        </div>
        </>,
      )}
    </span>
  );
}

export interface PickerProps extends Omit<MenuProps, "items" | "groups" | "value"> {
  groups: readonly MenuGroup[];
  value?: string;
  onChange?: (id: string) => void;
}

/** Vælgerliste (07): grupper med overlinje, valgt punkt får koral-soft flade og flueben. */
export function Picker({ groups, value, onChange, ...rest }: PickerProps) {
  const wired = groups.map((g) => ({
    ...g,
    items: g.items.map((item) => ({
      ...item,
      onSelect: () => {
        item.onSelect?.();
        onChange?.(item.id);
      },
    })),
  }));
  return <Menu {...rest} groups={wired} value={value ?? ""} />;
}
