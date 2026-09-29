import { cloneElement, isValidElement, useEffect, useLayoutEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";

/**
 * Tooltip (katalog 07, node 9L1-0): maks 280 bred, mørk flade (--lasso-tooltip) med lys tekst 13,
 * over elementet, centreret. Vises ved hover og tastaturfokus efter 150 ms (aldrig over 300), skjules
 * straks ved Esc. role=tooltip, og elementet får aria-describedby, så teksten læses op.
 */
export function Tooltip({ text, children, placement = "top", className = "", open: forced }: { text: string; children: ReactNode; placement?: "top" | "bottom" | "right"; className?: string; /** Tvinger visning (statisk forhåndsvisning). */ open?: boolean }) {
  const id = useId();
  const tipId = `${id}-tip`;
  const [shown, setOpen] = useState(false);
  const open = forced ?? shown;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 150);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setOpen(false);
  };
  const bubble = useRef<HTMLSpanElement | null>(null);
  // E0: boblen holdes inden for viewporten; skubbes vandret, hvis den ellers stikker ud til højre eller venstre.
  useLayoutEffect(() => {
    const el = bubble.current;
    if (!el) return;
    el.style.translate = "";
    if (!open) return;
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const dx = r.right > vw - 8 ? vw - 8 - r.right : r.left < 8 ? 8 - r.left : 0;
    if (dx) el.style.translate = `${dx}px 0`;
  }, [open]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const child = isValidElement(children) ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, { "aria-describedby": tipId }) : <span aria-describedby={tipId} tabIndex={0}>{children}</span>;

  return (
    <span
      className={`lasso-tip lasso-tip--${placement} ${open ? "is-open" : ""} ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === "Escape") hide();
      }}
    >
      {child}
      <span role="tooltip" ref={bubble} id={tipId} className="lasso-tip__bubble">
        {text}
      </span>
    </span>
  );
}
