import type { ShortcutTool } from "@lasso/spec";
import { Section } from "../primitives.js";
import { Menu } from "./Menu.js";
import { ShellIcon, type ShellIconName } from "./ShellIcons.js";

/** Katalog 08.4: navn og ikon pr. Lasso-værktøj (ikonerne som i Paper 9TL-0, Jakob 29.09). */
export const SHORTCUT_LABELS: Record<ShortcutTool, { label: string; icon: ShellIconName }> = {
  ejerdiagram: { label: "Ejerdiagram", icon: "tool-ownership" },
  regnskabsanalyse: { label: "Regnskabsanalyse", icon: "tool-analysis" },
  noegletal: { label: "Nøgletal", icon: "tool-keyfigures" },
  ejendomme: { label: "Ejendomme", icon: "tool-property" },
  tinglysning: { label: "Tinglysning", icon: "tool-registry" },
  firmaindsigt: { label: "Firmaindsigt", icon: "tool-insight" },
  ledelse: { label: "Ledelse", icon: "user" },
  kontakt: { label: "Kontakt", icon: "phone" },
  historik: { label: "Historik", icon: "clock" },
  risiko: { label: "Risiko", icon: "alert" },
  overblik: { label: "Overblik", icon: "overview" },
  stamoplysninger: { label: "Stamoplysninger", icon: "company" },
  nyheder: { label: "Nyheder", icon: "rss" },
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
export function Shortcuts({ items, title, bare = false }: { items: readonly ShortcutItem[]; title?: string; /** Uden sektionsoverskrift (står i en anden sektion). */ bare?: boolean }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, MAX_SHORTCUTS);
  const rest = items.slice(shown.length);
  const row = (
    <div className="lasso-shortcuts" role="group" aria-label={title ?? "Genveje"}>
      {shown.map((s) => (
        <button key={s.id} type="button" className="lasso-shortcut" onClick={s.onSelect}>
          <ShellIcon name={s.icon} size={16} className="lasso-shortcut__icon" />
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
    // 08.4: ingen sektionstitel over knapperne på desktop; på mobil overlinjen "GENVEJE" (26a.7).
    <Section title={title} span="half" className="lasso-shortcuts-section">
      {title ? null : <div className="lasso-contact__overline">Genveje</div>}
      {row}
    </Section>
  );
}
