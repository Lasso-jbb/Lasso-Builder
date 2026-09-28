import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { DataState } from "../primitives.js";
import { Menu } from "./Menu.js";
import { usePrintMode } from "../print.js";

/**
 * Fanebjælke, tre niveauer (Paper 29, node IWE-0).
 *
 * Én komponent, tre niveauer, der skelnes på højde, skrift og vægt, aldrig på farve:
 * - level 1, sideniveau (48 px, 14/600, 2 px koral streg): under virksomheds-/personhovedet
 *   og i portalens modulbjælke (06). Skifter sidens midte.
 * - level 2, sektionsniveau (36 px, 13/600, 1 px ink-streg): inde i en sektion, altid under en
 *   sektionsoverskrift. Skifter sektionens indhold.
 * - level 3, i et element (segmentkontrol 32 px, 13, valgt = 1 px ink-kant + 600): i elementets
 *   hoved, skifter kun elementets egen visning (år, Nuværende/Alle, selskab/koncern).
 *
 * Regler: kun navnet på fanen, aldrig tal, badge eller prik (regel 2). Valgt fane har aldrig mørkt
 * fyld. Styret udefra (value + onChange), så indholdet kan hentes ved skift; panelet viser skelet
 * via <TabPanel loading>. Højst tre niveauer over hinanden, og to bjælker på samme niveau står
 * aldrig direkte over hinanden.
 *
 * Tilgængelighed: role=tablist/tab/tabpanel, aria-selected, aria-controls/labelledby. Kun den
 * valgte fane er i tab-rækkefølgen; piletaster flytter og vælger, Home/End går til første/sidste,
 * deaktiverede faner springes over.
 */
export type TabLevel = 1 | 2 | 3;

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
  /** Vises som tooltip (title) på en deaktiveret fane, fx "Kun årsregnskab indberettet". */
  disabledReason?: string;
}

export interface TabsProps {
  level: TabLevel;
  items: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Kort beskrivelse til skærmlæsere, fx "Vælg regnskabsår". */
  ariaLabel: string;
  /** Sættes samme id på <TabPanel>, så aria-controls/aria-labelledby hænger sammen. */
  id?: string;
  className?: string;
  /** Niveau 1: mere end 8 faner samles bag "Flere" (kataloget). Sæt for at slå sammenfoldningen fra. */
  maxVisible?: number;
}

/** Stabilt id-par for fane og panel, så Tabs og TabPanel kan bindes sammen. */
export function tabId(base: string, item: string): string {
  return `${base}-tab-${item}`;
}
export function panelId(base: string, item: string): string {
  return `${base}-panel-${item}`;
}

export function Tabs({ level, items, value, onChange, ariaLabel, id, className = "", maxVisible }: TabsProps) {
  const autoId = useId();
  const base = id ?? autoId;
  const listRef = useRef<HTMLDivElement>(null);
  const print = usePrintMode();

  // Mobil (29): den valgte fane rulles ind i syne ved skift.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [value]);

  const enabled = items.filter((t) => !t.disabled);
  const move = (from: string, step: 1 | -1 | "first" | "last") => {
    if (enabled.length === 0) return;
    const i = enabled.findIndex((t) => t.id === from);
    const next = step === "first" ? enabled[0] : step === "last" ? enabled[enabled.length - 1] : enabled[(i + step + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.id);
    listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(tabId(base, next.id))}`)?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, current: string) => {
    const key = e.key;
    if (key === "ArrowRight" || key === "ArrowDown") move(current, 1);
    else if (key === "ArrowLeft" || key === "ArrowUp") move(current, -1);
    else if (key === "Home") move(current, "first");
    else if (key === "End") move(current, "last");
    else return;
    e.preventDefault();
  };

  // Print (PDF): ingen fanebjælke, men den viste fanes navn som overskrift over indholdet.
  if (print) {
    const label = items.find((t) => t.id === value)?.label;
    return label ? (
      <div className={`lasso-tabs-print lasso-tabs-print--l${level} ${className}`} role="heading" aria-level={level + 2}>
        {label}
      </div>
    ) : null;
  }

  const limit = maxVisible ?? (level === 1 ? 8 : Infinity);
  const overflow = items.length > limit;
  const selectedIndex = items.findIndex((t) => t.id === value);
  // "Flere" (niveau 1): den valgte fane trækkes altid frem i den synlige række.
  let visible = overflow ? items.slice(0, limit - 1) : items;
  if (overflow && selectedIndex >= limit - 1) visible = [...items.slice(0, limit - 2), items[selectedIndex]!];
  const hidden = overflow ? items.filter((t) => !visible.includes(t)) : [];

  // Niveau 3 med mere end 3 segmenter bliver en 44 px dropdown på mobil (29). Begge tegnes; CSS vælger.
  const mobileSelect =
    level === 3 && items.length > 3 ? (
      <select className="lasso-tabs__select" aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
        {items.map((t) => (
          <option key={t.id} value={t.id} disabled={t.disabled}>
            {t.label}
          </option>
        ))}
      </select>
    ) : null;

  return (
    <div className={`lasso-tabs-wrap lasso-tabs-wrap--l${level} ${mobileSelect ? "lasso-tabs-wrap--many" : ""} ${className}`}>
    {mobileSelect}
    <div ref={listRef} role="tablist" aria-label={ariaLabel} className={`lasso-tabs lasso-tabs--l${level}`}>
      {visible.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={tabId(base, t.id)}
            aria-selected={on}
            aria-controls={panelId(base, t.id)}
            aria-disabled={t.disabled || undefined}
            disabled={t.disabled}
            title={t.disabled ? t.disabledReason : undefined}
            tabIndex={on ? 0 : -1}
            className={`lasso-tab ${on ? "is-on" : ""}`}
            onClick={() => !t.disabled && onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, t.id)}
          >
            {t.label}
          </button>
        );
      })}
      {hidden.length > 0 ? (
        <Menu
          trigger="Flere"
          triggerClassName="lasso-tab lasso-tab--more"
          label="Flere faner"
          align="end"
          items={hidden.map((t) => ({ id: t.id, label: t.label, disabled: t.disabled, onSelect: () => onChange(t.id) }))}
        />
      ) : null}
    </div>
    </div>
  );
}

export interface TabPanelProps {
  /** Samme id som givet til <Tabs id>. */
  id: string;
  /** Fanens id (items[].id), som panelet hører til. */
  tab: string;
  /** Skelet i samme højde som det fyldte indhold, mens fanens data hentes (29, "Henter"). */
  loading?: boolean;
  loadingHeight?: number;
  loadingLines?: number;
  /** Etiket der står under skelettet, fx fanens navn: "Henter Økonomi …". */
  loadingLabel?: string;
  children?: ReactNode;
  className?: string;
}

/** Panelet under en fanebjælke. Fanen skifter straks; kun panelet viser henter-tilstanden. */
export function TabPanel({ id, tab, loading, loadingHeight, loadingLines, loadingLabel, children, className = "" }: TabPanelProps) {
  return (
    <div role="tabpanel" id={panelId(id, tab)} aria-labelledby={tabId(id, tab)} aria-busy={loading || undefined} className={`lasso-tabpanel ${className}`}>
      {loading ? (
        <>
          <DataState state="loading" height={loadingHeight} lines={loadingLines ?? 4} />
          {loadingLabel ? <p className="lasso-tabpanel__loading">Henter {loadingLabel} …</p> : null}
        </>
      ) : (
        children
      )}
    </div>
  );
}
