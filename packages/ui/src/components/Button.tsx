import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon.js";
import { Menu, type MenuItem } from "./Menu.js";

/**
 * Knapper, ikonknapper, handlingsrække og etiket (katalog 05, node 9EI-0).
 *
 * Én primær knap pr. område, altid yderst til højre. Sekundær er hvid med kant, tekstknapper til
 * Annuller og Ryd, farlig som rød tekst med kant, link som koral tekst med chevron. Tekst 14/500
 * (primær 600). Højde 42 i dialoger og paneler, 36 i sidehoveder, 32 i kompakte rækker.
 * Klasserne (.lasso-btn …) kan også bruges direkte; komponenterne samler dem.
 */
export type ButtonVariant = "primary" | "secondary" | "text" | "danger" | "link";
export type ButtonSize = 42 | 36 | 32;

export interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ikon før teksten (fx "plus" på "Tilføj"). Link-varianten får altid chevron efter. */
  icon?: IconName;
  /** Viser "Gemmer…"-tilstand: spinner, knappen er optaget og kan ikke trykkes igen. */
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
  className?: string;
  onClick?: () => void;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "lasso-btn--primary",
  secondary: "",
  text: "lasso-btn--text",
  danger: "lasso-btn--danger",
  link: "lasso-btn--link",
};

const SIZE_CLASS: Record<ButtonSize, string> = { 42: "lasso-btn--lg", 36: "", 32: "lasso-btn--sm" };

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = 36, extra = ""): string {
  return ["lasso-btn", VARIANT_CLASS[variant], SIZE_CLASS[size], extra].filter(Boolean).join(" ");
}

export function Button({ children, variant = "secondary", size = 36, icon, loading = false, disabled, type = "button", title, className = "", onClick }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      title={title}
      onClick={onClick}
    >
      {loading ? <span className="lasso-btn__spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={16} /> : null}
      <span>{children}</span>
      {variant === "link" ? <Icon name="chevron-right" size={14} /> : null}
    </button>
  );
}

/**
 * Ikonknap (05.2, "IKONKNAPPER, 38 / 32"): kvadratisk, ikonet alene på hvid flade.
 * - default: hvid med 1 px kant ("…", Gem, Eksportér)
 * - active: koral lys flade, koral kant og koral ikon (Overvåg slået til, åben menu)
 * - subtle: let grå flade uden kant (Redigér i en række)
 * - bare: ingen flade, ingen kant (Luk-kryds)
 * Mobil (< 560 px): 32 → 40 og 36/38 → 44 px touch-mål. Navnet står altid som aria-label og tooltip.
 */
export type IconButtonSize = 38 | 36 | 32;
export type IconButtonVariant = "default" | "active" | "subtle" | "bare";

export interface IconButtonProps {
  icon: IconName;
  /** Handlingens navn: aria-label og tooltip (regel 7). */
  label: string;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  /** Til/fra-knap (fx Overvåg): aria-pressed; tændt tegnes som "active". */
  pressed?: boolean;
  disabled?: boolean;
  /** Fyldt ikon (fx Gemt). */
  filled?: boolean;
  className?: string;
  onClick?: () => void;
}

export function iconButtonClass(size: IconButtonSize = 38, variant: IconButtonVariant = "default", extra = ""): string {
  return ["lasso-iconbtn", "lasso-iconbtn--sq", `lasso-iconbtn--${size}`, variant === "default" ? "" : `lasso-iconbtn--${variant}`, extra].filter(Boolean).join(" ");
}

export function IconButton({ icon, label, size = 38, variant = "default", pressed, disabled, filled, className = "", onClick }: IconButtonProps) {
  const v = pressed ? "active" : variant;
  return (
    <button type="button" className={iconButtonClass(size, v, className)} aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={size === 32 ? 16 : 18} filled={filled} />
    </button>
  );
}

/**
 * Handlingsrække (05.3, "HANDLINGSRÆKKE, FAST RÆKKEFØLGE"): "…" yderst til venstre, sekundær i
 * midten, primær yderst til højre. Rækkefølgen er fast, uanset hvilken rækkefølge værten angiver.
 * I en fuld bredde (fx en dialogfod) står der luft mellem "…" og resten.
 */
export interface ActionRowAction {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
}

export interface ActionRowProps {
  /** Punkterne bag "…" (fx Omdøb, Eksportér, Slet). Udeladt = ingen "…". */
  more?: readonly MenuItem[];
  moreLabel?: string;
  /** Kontekst øverst i handlingsarket på mobil. */
  moreContext?: { title: string; subtitle?: string };
  secondary?: readonly ActionRowAction[];
  primary?: ActionRowAction;
  /** Knaphøjde: 36 i sidehoveder (standard), 42 i dialoger og paneler, 32 i kompakte rækker. */
  size?: ButtonSize;
  /** Står rækken i fuld bredde, skubbes knapperne til højre og "…" bliver til venstre. */
  spread?: boolean;
  /** Hvilken kant af "…" menuen flugter med ("end", når rækken står yderst til højre). */
  moreAlign?: "start" | "end";
  /** "…"-menuen åben fra start (statisk forhåndsvisning og tests). */
  defaultMoreOpen?: boolean;
  className?: string;
}

export function ActionRow({ more, moreLabel = "Flere handlinger", moreContext, secondary = [], primary, size = 36, spread = false, defaultMoreOpen = false, moreAlign = "start", className = "" }: ActionRowProps) {
  const iconSize: IconButtonSize = size === 32 ? 32 : size === 42 ? 38 : 36;
  return (
    <div className={`lasso-actionrow lasso-actionrow--${size} ${spread ? "lasso-actionrow--spread" : ""} ${className}`}>
      {more && more.length > 0 ? (
        <Menu
          trigger={<Icon name="more" size={size === 32 ? 16 : 18} />}
          triggerClassName={iconButtonClass(iconSize, "default", "lasso-actionrow__more")}
          triggerLabel={moreLabel}
          label={moreLabel}
          items={more}
          context={moreContext}
          defaultOpen={defaultMoreOpen}
          align={moreAlign}
        />
      ) : null}
      {spread ? <span className="lasso-actionrow__spacer" /> : null}
      {secondary.map((a) => (
        <Button key={a.label} size={size} icon={a.icon} loading={a.loading} disabled={a.disabled} onClick={a.onClick}>
          {a.label}
        </Button>
      ))}
      {primary ? (
        <Button variant="primary" size={size} icon={primary.icon} loading={primary.loading} disabled={primary.disabled} onClick={primary.onClick}>
          {primary.label}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Etiket (05.6, "ETIKET, 28 PX — KUN VISNING"): 28 px, radius 6, grå flade, 13/400 tekst.
 * Kun visning (fx "Branchekode", "Antal ansatte" som kriterienavne); kan ikke klikkes eller fjernes.
 * Bruges aldrig til status (regel 1) eller som tæller.
 */
export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`lasso-label ${className}`}>{children}</span>;
}
