import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon.js";
import { CloseIcon, focusables, useLayer } from "./Layer.js";

/**
 * Dialog (katalog 07, node 9L1-0): 520 bred, 28 padding, radius 14, mørk overlay. Titel 18/600 med
 * undertekst i muted, luk-kryds 32 px øverst til højre. Knapper nederst til højre adskilt af en tynd
 * streg: primær koral, sekundær hvid med kant, destruktiv som rød tekst yderst til venstre ("Kassér").
 *
 * Mobil (26a, < 560 px): bundark med greb 36×4 øverst, radius 14, primær knap i fuld bredde 48 px og
 * sekundær som tekstknap under. Destruktiv bekræftelse: primær i ink, "Slet" i rød tekst.
 *
 * Tilgængelighed: role=dialog, aria-modal, aria-labelledby/-describedby, fokusfælde (Tab cirkulerer),
 * Esc og klik på overlayet lukker, fokus lander på første felt eller knap og går tilbage ved luk.
 */
export interface DialogAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Primær: bekræfter en sletning (ink i stedet for koral). Destruktiv: altid rød tekst. */
  destructive?: boolean;
  /** Ikon før teksten, fx "plus" på "Tilføj" (07.7). */
  icon?: IconName;
  /** Sekundær som tekstknap uden kant (fx "Annuller" i 18.3). Standard: outline-knap. */
  text?: boolean;
}

export interface DialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  actions?: {
    primary?: DialogAction;
    secondary?: DialogAction;
    destructive?: DialogAction;
  };
  /** sm = 440 px, md = 520 px (--lasso-dialog-w), lg = 760 px (trævælger, 07.7). */
  size?: "sm" | "md" | "lg";
  /** Effekt-linje nederst til venstre i foden, fx "Reducerer resultatet med 1.782" (07.7). */
  footNote?: ReactNode;
  /** Skærmlæsertekst på luk-krydset. */
  closeLabel?: string;
  /** Uden luk-kryds (07.2: bekræftelsesdialogen lukkes med Annuller, Esc eller klik udenfor). */
  hideClose?: boolean;
  /** Hvor fokus lander ved åbning: "first" = første felt/knap (standard), "panel" = selve dialogen. */
  initialFocus?: "first" | "panel";
  className?: string;
}

export function Dialog({ open, title, description, onClose, children, actions, size = "md", footNote, closeLabel = "Luk", hideClose = false, initialFocus = "first", className = "" }: DialogProps) {
  const layer = useLayer();
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  // Fokusfælde: første felt/knap får fokus ved åbning, fokus går tilbage ved luk.
  useEffect(() => {
    if (!open || !layer.ready) return;
    const previous = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    const first = initialFocus === "panel" ? panel.current : (focusables(panel.current).find((el) => !el.classList.contains("lasso-dialog__close")) ?? panel.current);
    first?.focus();
    return () => previous?.focus?.();
  }, [open, layer.ready, initialFocus]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const els = focusables(panel.current);
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

  const { primary, secondary, destructive } = actions ?? {};
  const hasFoot = Boolean(primary || secondary || destructive || footNote);

  return layer.render(
    <div className="lasso-dialog-wrap">
      <div className="lasso-dialog__scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`lasso-dialog lasso-dialog--${size} ${className}`}
        onKeyDown={onKeyDown}
      >
        <span className="lasso-dialog__grip" aria-hidden="true" />
        <header className="lasso-dialog__head">
          <div className="lasso-dialog__titles">
            <h2 id={titleId} className="lasso-dialog__title">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="lasso-dialog__desc">
                {description}
              </p>
            ) : null}
          </div>
          {hideClose ? null : (
            <button type="button" className="lasso-dialog__close" onClick={onClose} aria-label={closeLabel}>
              <CloseIcon />
            </button>
          )}
        </header>
        {children ? <div className="lasso-dialog__body">{children}</div> : null}
        {hasFoot ? (
          <footer className={`lasso-dialog__foot ${children ? "lasso-dialog__foot--ruled" : ""}`}>
            {destructive ? (
              <button type="button" className="lasso-btn lasso-btn--text lasso-btn--danger lasso-dialog__destructive" onClick={destructive.onClick} disabled={destructive.disabled}>
                {destructive.label}
              </button>
            ) : null}
            {footNote ? <span className="lasso-dialog__note">{footNote}</span> : null}
            <span className="lasso-dialog__spacer" />
            {secondary ? (
              <button type="button" className={`lasso-btn${secondary.text ? " lasso-btn--text" : ""} lasso-dialog__secondary`} onClick={secondary.onClick} disabled={secondary.disabled}>
                {secondary.label}
              </button>
            ) : null}
            {primary ? (
              <button
                type="button"
                className={`lasso-btn ${primary.destructive ? "lasso-btn--ink" : "lasso-btn--primary"} lasso-dialog__primary`}
                onClick={primary.onClick}
                disabled={primary.disabled}
              >
                {primary.icon ? <Icon name={primary.icon} size={16} /> : null}
                {primary.label}
              </button>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>,
  );
}
