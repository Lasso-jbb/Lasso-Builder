import type { ReactNode } from "react";
import { LassoWordmark } from "../LassoMark.js";
import { ShellIcon } from "./ShellIcons.js";

/**
 * Skinnen (katalog 06, node 9I4-0): 236 px til venstre på chrome-grå med navnelogoet øverst og
 * tre hvide grupper (radius 10, let skygge): Værktøjer, Firmaer (gemte lister) og Personer.
 * Det er navigationens eneste undtagelse fra reglen om hvide kort på grå.
 *
 * Gruppeoverskrift = overline 11/600 med koral pil, der folder gruppen. Rækker er 40 px med
 * 15 px ikon og navn 14. En gemt liste har et 20 px bogstav-ikon i tynd kant (icon: "letter").
 * Gruppens fod ("Opret ny liste", plus-ikon) står nederst adskilt af en tynd linje; en fod uden ikon
 * (fx "Se alle gemte") får icon: "none".
 *
 * Tablet (560–1199): skinnen bliver 64 px med 44 px ikoner; navnet står som tooltip (title).
 * Mobil (< 560): skinnen skjules, og bundnavigationen i AppShell tager over (26a).
 * Tilstandsløs: aktivt punkt og foldning styres udefra.
 */
export interface RailItem {
  id: string;
  label: string;
  /** Ikon 15 px, eller "letter" for et 20 px bogstav-ikon (gemte lister). */
  icon?: ReactNode | "letter";
  active?: boolean;
  onSelect?: () => void;
}

export interface RailGroup {
  id: string;
  label: string;
  collapsed?: boolean;
  items: readonly RailItem[];
  /**
   * Nederste række adskilt af en tynd linje, fx "Opret ny liste" (plus-ikon, standard). "none" til en
   * fod, der ikke opretter noget, fx portalens "Se alle gemte"; den skjules i den smalle ikonskinne.
   */
  footer?: { label: string; icon?: "plus" | "none"; onSelect?: () => void };
}

export interface RailProps {
  groups: readonly RailGroup[];
  /** Id på det aktive punkt (alternativ til items[].active). */
  activeItem?: string;
  onToggleGroup?: (id: string) => void;
  /** Klik på logoet, fx "gå til forsiden". */
  onLogo?: () => void;
  /** Logoet øverst i skinnen (standard). false, når logoet står i bundlinjen (fx personsiden, 25.2). */
  logo?: boolean;
  /**
   * Bundlinje nederst i skinnen (25.2): dæmpet navnelogo + kildelinje, fx "Data fra CVR, Erhvervsstyrelsen
   * og Creditsafe" (regel 15: logoet i bundlinjen med kildelinje). Skjules i den smalle ikonskinne.
   */
  /** Bundlinjen med navnelogoet. source udgår (G3: ingen kildelinje) og vises kun, hvis den gives. */
  bottom?: { source?: string };
  className?: string;
}

function itemIcon(item: RailItem): ReactNode {
  if (item.icon === "letter") {
    return (
      <span className="lasso-rail__letter" aria-hidden="true">
        {item.label.trim().charAt(0).toUpperCase()}
      </span>
    );
  }
  if (item.icon) return <span className="lasso-rail__icon">{item.icon}</span>;
  return <span className="lasso-rail__icon lasso-rail__icon--empty" aria-hidden="true" />;
}

export function Rail({ groups, activeItem, onToggleGroup, onLogo, logo = true, bottom, className = "" }: RailProps) {
  return (
    <nav className={`lasso-rail ${className}`} aria-label="Navigation">
      {logo ? <div className="lasso-rail__logo">
        {onLogo ? (
          <button type="button" className="lasso-rail__logo-btn" onClick={onLogo} aria-label="Lasso, forside">
            <LassoWordmark className="lasso-rail__wordmark" />
          </button>
        ) : (
          <LassoWordmark className="lasso-rail__wordmark" />
        )}
      </div> : null}
      {groups.map((g) => {
        const open = !g.collapsed;
        const listId = `lasso-rail-${g.id}`;
        return (
          <section key={g.id} className={`lasso-rail__group ${open ? "is-open" : "is-collapsed"}`} aria-label={g.label}>
            <button type="button" className="lasso-rail__head" aria-expanded={open} aria-controls={listId} title={g.label} onClick={() => onToggleGroup?.(g.id)}>
              <span className="lasso-rail__head-label">{g.label}</span>
              <ShellIcon name={open ? "chevron-up" : "chevron-down"} size={14} className="lasso-rail__chevron" />
            </button>
            {open ? (
              <>
                <ul id={listId} className="lasso-rail__list">
                  {g.items.map((it) => {
                    const on = it.active || it.id === activeItem;
                    return (
                      <li key={it.id}>
                        <button type="button" className={`lasso-rail__item ${on ? "is-on" : ""}`} aria-current={on ? "page" : undefined} title={it.label} onClick={it.onSelect}>
                          {itemIcon(it)}
                          <span className="lasso-rail__label">{it.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {g.footer ? (
                  <button
                    type="button"
                    className={`lasso-rail__item lasso-rail__footer ${g.footer.icon === "none" ? "lasso-rail__footer--plain" : ""}`}
                    title={g.footer.label}
                    onClick={g.footer.onSelect}
                  >
                    {g.footer.icon === "none" ? (
                      <span className="lasso-rail__icon lasso-rail__icon--empty" aria-hidden="true" />
                    ) : (
                      <span className="lasso-rail__icon">
                        <ShellIcon name="plus" />
                      </span>
                    )}
                    <span className="lasso-rail__label">{g.footer.label}</span>
                  </button>
                ) : null}
              </>
            ) : null}
          </section>
        );
      })}
      {bottom ? (
        <div className="lasso-rail__bottom">
          <LassoWordmark className="lasso-rail__bottom-mark" />
          {bottom.source ? <span className="lasso-rail__bottom-source">{bottom.source}</span> : null}
        </div>
      ) : null}
    </nav>
  );
}
