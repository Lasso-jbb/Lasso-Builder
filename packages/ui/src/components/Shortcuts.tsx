import type { ShortcutTool } from "@lasso/spec";
import { Section } from "../primitives.js";
import { Menu } from "./Menu.js";
import { ShellIcon, type ShellIconName } from "./ShellIcons.js";

/** Katalog 08.4: navn og ikon pr. Lasso-værktøj. */
export const SHORTCUT_LABELS: Record<ShortcutTool, { label: string; icon: ShellIconName }> = {
  ejerdiagram: { label: "Ejerdiagram", icon: "network" },
  regnskabsanalyse: { label: "Regnskabsanalyse", icon: "document" },
  noegletal: { label: "Nøgletal", icon: "trend" },
  ejendomme: { label: "Ejendomme", icon: "home" },
  tinglysning: { label: "Tinglysning", icon: "book" },
  firmaindsigt: { label: "Firmaindsigt", icon: "sparkle" },
  ledelse: { label: "Ledelse", icon: "user" },
  kontakt: { label: "Kontakt", icon: "phone" },
  historik: { label: "Historik", icon: "clock" },
  risiko: { label: "Risiko", icon: "alert" },
};

/** Højst seks synlige genveje; resten under "Flere". */
export const MAX_SHORTCUTS = 6;

export interface ShortcutItem {
  id: string;
  label: string;
  icon: ShellIconName;
  onSelect: () => void;
}

/**
 * Genveje (katalog 08.4, node 9TL-0): sekundære knapper (hvid, 1 px kant, 36 px) med koral ikon,
 * det eneste sted koral bruges på et ikon i hvile, fordi det signalerer "åbner et Lasso-værktøj".
 * Maks seks; resten under "Flere". Mobil (26a): én vandret række, der ruller.
 */
export function Shortcuts({ items, title = "Genveje", bare = false }: { items: readonly ShortcutItem[]; title?: string; /** Uden sektionsoverskrift (står i en anden sektion). */ bare?: boolean }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, MAX_SHORTCUTS);
  const rest = items.slice(shown.length);
  const row = (
    <div className="lasso-shortcuts" role="group" aria-label={title}>
      {shown.map((s) => (
        <button key={s.id} type="button" className="lasso-shortcut" onClick={s.onSelect}>
          <ShellIcon name={s.icon} size={15} className="lasso-shortcut__icon" />
          <span>{s.label}</span>
        </button>
      ))}
      {rest.length > 0 ? (
        <Menu
          trigger={
            <>
              <span>Flere</span>
              <ShellIcon name="chevron-down" size={13} />
            </>
          }
          triggerClassName="lasso-shortcut lasso-shortcut--more"
          items={rest.map((s) => ({ id: s.id, label: s.label, icon: <ShellIcon name={s.icon} size={15} className="lasso-shortcut__icon" />, onSelect: s.onSelect }))}
          label="Flere genveje"
          align="end"
        />
      ) : null}
    </div>
  );
  if (bare) return row;
  return (
    <Section title={title} span="half" className="lasso-shortcuts-section">
      {row}
    </Section>
  );
}
