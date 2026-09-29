import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ActionRow, type ActionRowAction } from "./Button.js";
import { Icon } from "./Icon.js";
import type { MenuItem } from "./Menu.js";

/**
 * Sidehoved med titel og handlinger (katalog 04, node 495-0), fx en gemt liste eller søgning.
 * Fire tilstande:
 *   1 I ro ("Gemt, intet ændret"): titel + undertitel, kun "…" til højre. Ingen Gem-knap.
 *   2 Ændret ("Ændret, ikke gemt"): "Ændret, ikke gemt" som ren tekst under titlen; handlingsrækken
 *     får sekundær (fx "Gem som ny") og primær "Gem" yderst til højre.
 *   3 Menu åben: "…" åbner menuen; Omdøb står her, fordi det er sjældent.
 *   4 Omdøber: titlen bliver et felt på stedet (ikke en dialog). Enter eller klik udenfor gemmer,
 *     Esc fortryder. Tomt navn gemmes ikke.
 * Knapperne er 36 px (sidehoved, 05). Handlingsrækken følger 05.3: "…" til venstre, sekundær i
 * midten, primær yderst til højre.
 */
export interface PageHeaderProps {
  title: string;
  /** Fx "Gemt liste, 1.243 virksomheder". Tallet formateres af værten (formatNumber). */
  subtitle?: string;
  /** Noget er ændret siden sidste gem (tilstand 2). */
  dirty?: boolean;
  /** Gemmer lige nu: primær knap viser "Gemmer…". */
  saving?: boolean;
  onSave?: () => void;
  /** Sekundær ved ændringer, fx "Gem som ny". */
  secondary?: ActionRowAction;
  /** Omdøb på stedet. Udeladt = intet Omdøb i menuen. */
  onRename?: (name: string) => void;
  /** Øvrige punkter i "…"-menuen (Eksportér, Overvåg listen, Slet …). Omdøb står først. */
  menuItems?: readonly MenuItem[];
  /** Start i omdøbning (statisk forhåndsvisning og tests). */
  defaultRenaming?: boolean;
  /** Start med menuen åben (statisk forhåndsvisning og tests). */
  defaultMenuOpen?: boolean;
  className?: string;
}

export function PageHeader({ title, subtitle, dirty = false, saving = false, onSave, secondary, onRename, menuItems = [], defaultRenaming = false, defaultMenuOpen = false, className = "" }: PageHeaderProps) {
  const [renaming, setRenaming] = useState(defaultRenaming && Boolean(onRename));
  const [draft, setDraft] = useState(title);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) return;
    input.current?.focus();
    input.current?.select();
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
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={commit}
          />
        ) : (
          <h1 className="lasso-pagehead__title">{title}</h1>
        )}
        {renaming ? (
          <p className="lasso-pagehead__meta">Enter gemmer navnet, Esc fortryder</p>
        ) : dirty ? (
          <p className="lasso-pagehead__meta lasso-pagehead__state" role="status">
            Ændret, ikke gemt
          </p>
        ) : subtitle ? (
          <p className="lasso-pagehead__meta">{subtitle}</p>
        ) : null}
      </div>
      {renaming ? null : (
        <ActionRow
          className="lasso-pagehead__actions"
          size={36}
          more={more}
          moreContext={{ title, subtitle }}
          defaultMoreOpen={defaultMenuOpen}
          moreAlign="end"
          secondary={dirty && secondary ? [secondary] : []}
          primary={dirty && onSave ? { label: saving ? "Gemmer…" : "Gem", onClick: onSave, loading: saving } : undefined}
        />
      )}
    </header>
  );
}
