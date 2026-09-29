import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ActionRow, type ActionRowAction } from "./Button.js";
import { Icon } from "./Icon.js";
import type { MenuItem } from "./Menu.js";

/**
 * Sidehoved med titel og handlinger (katalog 04, node 495-0), fx en gemt liste eller søgning.
 * Fire tilstande:
 *   1 I ro ("Gemt, intet ændret"): titel 18/600 + undertitel, til højre "…" og sekundær (fx
 *     "Gem som ny"). Ingen Gem-knap.
 *   2 Ændret ("Ændret, ikke gemt"): underlinjen skifter til koral tekst (fx "5 filtre, ændringer
 *     ikke gemt"); handlingsrækken får primær "Gem" yderst til højre.
 *   3 Menu åben: "…" åbner menuen; Omdøb står her, fordi det er sjældent.
 *   4 Omdøber: titlen bliver et 50 px felt på stedet (ikke en dialog) med "Annuller" og "Gem navn"
 *     på samme linje. Enter eller klik udenfor gemmer, Esc fortryder. Tomt navn gemmes ikke.
 * Knapperne er 36 px (sidehoved, 05). Handlingsrækken følger 05.3: "…" til venstre, sekundær i
 * midten, primær yderst til højre.
 */
export interface PageHeaderProps {
  title: string;
  /** Fx "Gemt liste, 1.243 virksomheder". Tallet formateres af værten (formatNumber). */
  subtitle?: string;
  /** Noget er ændret siden sidste gem (tilstand 2). */
  dirty?: boolean;
  /** Underlinjen i tilstand 2 (koral), fx "5 filtre, ændringer ikke gemt". Standard "Ændret, ikke gemt". */
  dirtyLabel?: string;
  /** Gemmer lige nu: primær knap viser "Gemmer…". */
  saving?: boolean;
  onSave?: () => void;
  /** Sekundær, fx "Gem som ny". Står i ro og ved ændringer (04.1/04.2). */
  secondary?: ActionRowAction;
  /** Omdøb på stedet. Udeladt = intet Omdøb i menuen. */
  onRename?: (name: string) => void;
  /** Øvrige punkter i "…"-menuen (Eksportér, Overvåg listen, Slet …). Omdøb står først. */
  menuItems?: readonly MenuItem[];
  /** Start i omdøbning (statisk forhåndsvisning og tests). */
  defaultRenaming?: boolean;
  /** Start med menuen åben (statisk forhåndsvisning og tests). */
  defaultMenuOpen?: boolean;
  /** Punkt i den åbne menu tegnet i hover-tilstand (statisk forhåndsvisning), fx "rename". */
  menuHighlight?: string;
  className?: string;
}

export function PageHeader({ title, subtitle, dirty = false, dirtyLabel = "Ændret, ikke gemt", saving = false, onSave, secondary, onRename, menuItems = [], defaultRenaming = false, defaultMenuOpen = false, menuHighlight, className = "" }: PageHeaderProps) {
  const [renaming, setRenaming] = useState(defaultRenaming && Boolean(onRename));
  const [draft, setDraft] = useState(title);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) return;
    const el = input.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [renaming]);

  const startRename = () => {
    setDraft(title);
    setRenaming(true);
  };
  const commit = () => {
    const name = draft.trim();
    setRenaming(false);
    if (name && name !== title) onRename?.(name);
  };
  const cancel = () => {
    setDraft(title);
    setRenaming(false);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  const more: MenuItem[] = [
    ...(onRename ? [{ id: "rename", label: "Omdøb", icon: <Icon name="edit" />, onSelect: startRename }] : []),
    ...menuItems,
  ];

  return (
    <header className={`lasso-pagehead ${dirty ? "is-dirty" : ""} ${renaming ? "is-renaming" : ""} ${className}`}>
      <div className="lasso-pagehead__titles">
        {renaming ? (
          <input
            ref={input}
            className="lasso-pagehead__input"
            value={draft}
            aria-label="Nyt navn"
            title="Enter gemmer navnet, Esc fortryder"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={commit}
          />
        ) : (
          <h1 className="lasso-pagehead__title">{title}</h1>
        )}
        {renaming ? null : dirty ? (
          <p className="lasso-pagehead__meta lasso-pagehead__state" role="status">
            {dirtyLabel}
          </p>
        ) : subtitle ? (
          <p className="lasso-pagehead__meta">{subtitle}</p>
        ) : null}
      </div>
      {renaming ? (
        <div className="lasso-actionrow lasso-actionrow--36 lasso-pagehead__actions">
          {/* mousedown forhindrer, at feltets blur gemmer, før Annuller når at fortryde. */}
          <button type="button" className="lasso-btn lasso-btn--text" onMouseDown={(e) => e.preventDefault()} onClick={cancel}>
            <span>Annuller</span>
          </button>
          <button type="button" className="lasso-btn lasso-btn--primary" onMouseDown={(e) => e.preventDefault()} onClick={commit}>
            <span>Gem navn</span>
          </button>
        </div>
      ) : (
        <ActionRow
          className="lasso-pagehead__actions"
          size={36}
          more={more}
          moreContext={{ title, subtitle }}
          defaultMoreOpen={defaultMenuOpen}
          moreHighlight={menuHighlight}
          moreAlign="end"
          secondary={secondary ? [secondary] : []}
          primary={dirty && onSave ? { label: saving ? "Gemmer…" : "Gem", onClick: onSave, loading: saving } : undefined}
        />
      )}
    </header>
  );
}
