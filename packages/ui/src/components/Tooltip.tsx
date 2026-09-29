import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";

/**
 * Tooltip (katalog 07, node 9L1-0): maks 280 bred, mørk flade (--lasso-tooltip) med lys tekst 13,
 * over elementet, centreret. Vises ved hover og tastaturfokus efter 150 ms (aldrig over 300), skjules
 * straks ved Esc. role=tooltip, og elementet får aria-describedby, så teksten læses op.
 */
export function Tooltip({ text, children, placement = "top", className = "", open: forced }: { text: string; children: ReactNode; /** "right": til højre for elementet på samme linje med pil mod det (02b.5 info-ikon). */ placement?: "top" | "bottom" | "right"; className?: string; /** Tvinger visning (statisk forhåndsvisning). */ open?: boolean }) {
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
      <span role="tooltip" id={tipId} className="lasso-tip__bubble">
        {text}
      </span>
    </span>
  );
}
