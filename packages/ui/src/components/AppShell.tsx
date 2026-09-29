import { useState, type ReactNode } from "react";
import { LassoMark } from "../LassoMark.js";
import { Menu, type MenuItem } from "./Menu.js";
import { MonitorBell } from "./MonitorSettings.js";
import { Rail, type RailProps } from "./Rail.js";
import { ShellIcon, type ShellIconName } from "./ShellIcons.js";
import { TabStrip, type TabStripProps } from "./TabStrip.js";
import type { TabItem } from "./Tabs.js";

/**
 * Portalens ramme (katalog 06, node 9I4-0; mobil 26a). Alle sider har samme ramme: hele siden
 * på chrome-grå, skinnen 236 px til venstre (Rail), fanebjælken 56 px øverst (TabStrip) og
 * siden som hvid flade med radius 10 i øverste venstre hjørne. Siden indeholder modulbjælken
 * (ModuleBar), evt. modulværktøjslinjen (ModuleToolbar) og kroppen (Columns). Intet særskilt
 * sidehoved: navnet står i fanen og øverst i første kolonne.
 *
 * Mobil (< 560 px i .lasso-root): skinne og fanebjælke skjules; i stedet en topbjælke 52 px
 * (burger, der åbner "Sektioner"-arket med modulerne som 44 px rækker; titel + undertitel; maks
 * 2 ikoner + "…") og en bundnavigation 56 px med fire punkter (Søg, Lister, Overvågning, Konto;
 * ikon + navn, aktiv i koral, aldrig badges). Bundnavigationen står altid i markup og skjules på
 * desktop med CSS.
 *
 * Brudpunkter (26, node DH5-0; guide 23 trin 7): ≥ 1200 skinne + midte + panel 336; 1024–1199
 * skinnen bliver 64 px med ikoner, og panelet falder ned under midten; 768–1023 tablet (26f.1):
 * topbjælke 56 px (Lasso-ikon, søgefelt 320 px, klokke) og en 64 px skinne med fire 44 px
 * ikonknapper (Søg, Lister, Overvågning, Værktøjer; aktiv i koral-soft), ingen fanebjælke og ingen
 * bundnavigation; < 768 mobil (topbjælke med "Sektioner", bundnavigation, padding 16).
 *
 * Tilstandsløs, bortset fra om sektionsarket er åbent (ren UI-tilstand; kan også styres udefra).
 */
export interface MobileNavItem {
  id: string;
  label: string;
  icon?: ReactNode;
  active?: boolean;
  /** Punktet findes, men kan ikke bruges endnu; tegnes dæmpet med grunden som tooltip. */
  disabled?: boolean;
  disabledReason?: string;
  onSelect?: () => void;
}

export interface MobileAction {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect?: () => void;
}

export interface AppShellMobile {
  /** Titel i topbjælken, fx virksomhedens navn. */
  title: string;
  /** Undertitel, fx det aktive modul ("Overblik"). */
  subtitle?: string;
  /** Modulerne, som burgeren åbner i "Sektioner"-arket. */
  sections?: readonly TabItem[];
  activeSection?: string;
  onSelectSection?: (id: string) => void;
  /** Maks 2 ikonhandlinger i topbjælken; flere samles bag "…" via onMore. */
  actions?: readonly MobileAction[];
  onMore?: () => void;
  /** "…" som handlingsark (07/26a) med titel og undertitel som kontekst. Vinder over onMore. */
  moreItems?: readonly MenuItem[];
  /** Ulæste til klokken i topbjælken (vises når onBell er sat). */
  unread?: number;
  important?: boolean;
  onBell?: () => void;
  /** Bundnavigationens fire punkter. Udeladt = Søg, Lister, Overvågning, Konto uden handlinger. */
  nav?: readonly MobileNavItem[];
  /** Styret åbning af sektionsarket (ellers intern tilstand). */
  sheetOpen?: boolean;
  onToggleSheet?: (open: boolean) => void;
}

/** Tablet 768–1023 (26f.1): topbjælke med søgefelt og 64 px ikonskinne. */
export interface AppShellTablet {
  /** Søgefeltet i topbjælken åbner søgningen. */
  onSearch?: () => void;
  searchPlaceholder?: string;
  /** Skinnens fire ikonknapper. Udeladt = Søg, Lister, Overvågning, Værktøjer (aktiv efter bundnavigationens aktive id). */
  nav?: readonly MobileNavItem[];
}

export interface AppShellProps {
  rail: RailProps;
  tabs: TabStripProps;
  mobile?: AppShellMobile;
  tablet?: AppShellTablet;
  /** Sidens indhold: ModuleBar, evt. ModuleToolbar og Columns. */
  children?: ReactNode;
  /**
   * Højre panel 336 px (06/26, guide 23 trin 1): sammendrag og handlinger, aldrig primært indhold.
   * Under 1200 falder panelet ned under midten. Udeladt = skabelonen uden panel (lister og søgning, 15).
   */
  panel?: ReactNode;
  /** Tilgængeligt navn til panelet (standard "Sammendrag og handlinger"). */
  panelLabel?: string;
  className?: string;
}

const DEFAULT_NAV: readonly { id: string; label: string; icon: ShellIconName }[] = [
  { id: "soeg", label: "Søg", icon: "search" },
  { id: "lister", label: "Lister", icon: "list" },
  { id: "overvaagning", label: "Overvågning", icon: "bell" },
  { id: "konto", label: "Konto", icon: "user" },
];

const DEFAULT_TABLET_NAV: readonly { id: string; label: string; icon: ShellIconName }[] = [
  { id: "soeg", label: "Søg", icon: "search" },
  { id: "lister", label: "Lister", icon: "list" },
  { id: "overvaagning", label: "Overvågning", icon: "bell" },
  { id: "vaerktoejer", label: "Værktøjer", icon: "overview" },
];

export function AppShell({ rail, tabs, mobile, tablet, children, panel, panelLabel, className = "" }: AppShellProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const sheetOpen = mobile?.sheetOpen ?? internalOpen;
  const setSheet = (open: boolean) => {
    setInternalOpen(open);
    mobile?.onToggleSheet?.(open);
  };
  const activeTab = tabs.tabs.find((t) => t.active);
  const title = mobile?.title ?? activeTab?.label ?? "Lasso";
  const nav: readonly MobileNavItem[] = mobile?.nav ?? DEFAULT_NAV.map((n) => ({ id: n.id, label: n.label, icon: <ShellIcon name={n.icon} size={20} /> }));
  const hasSections = !!mobile?.sections?.length;
  const activeNav = nav.find((n) => n.active)?.id;
  const tabletNav: readonly MobileNavItem[] = tablet?.nav ?? DEFAULT_TABLET_NAV.map((n) => ({ id: n.id, label: n.label, icon: <ShellIcon name={n.icon} size={20} />, active: n.id === activeNav, onSelect: nav.find((m) => m.id === n.id)?.onSelect }));

  return (
    <div className={`lasso-shell ${hasSections ? "lasso-shell--sections" : ""} ${panel ? "lasso-shell--panel" : ""} ${className}`}>
      <Rail {...rail} />
      <TabStrip {...tabs} />

      <header className="lasso-tabletbar">
        <span className="lasso-tabletbar__logo" aria-label="Lasso" role="img">
          <LassoMark className="lasso-tabletbar__mark" />
        </span>
        <button type="button" className="lasso-tabletbar__search" onClick={tablet?.onSearch}>
          <ShellIcon name="search" size={16} />
          <span>{tablet?.searchPlaceholder ?? "Søg virksomhed, person eller CVR"}</span>
        </button>
        <span className="lasso-tabletbar__spacer" />
        {tabs.onBell ? <MonitorBell unread={tabs.unread ?? 0} important={tabs.important} onClick={tabs.onBell} /> : null}
      </header>
      <nav className="lasso-tabletrail" aria-label="Hovednavigation, tablet">
        {tabletNav.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`lasso-tabletrail__item ${n.active ? "is-on" : ""}`}
            aria-label={n.label}
            title={n.label}
            aria-current={n.active ? "page" : undefined}
            disabled={n.disabled}
            onClick={n.onSelect}
          >
            {n.icon}
          </button>
        ))}
      </nav>

      <MobileBar mobile={mobile} title={title} hasSections={hasSections} sheetOpen={sheetOpen} onToggleSheet={setSheet} />

      {panel ? (
        <div className="lasso-page lasso-page--panel">
          <main className="lasso-page__main">{children}</main>
          <aside className="lasso-page__panel" aria-label={panelLabel ?? "Sammendrag og handlinger"}>
            {panel}
          </aside>
        </div>
      ) : (
        <main className="lasso-page">{children}</main>
      )}

      {hasSections && sheetOpen ? (
        <div className="lasso-sheet-backdrop" onClick={() => setSheet(false)}>
          <div id="lasso-sheet-sections" className="lasso-sheet" role="dialog" aria-label="Sektioner" onClick={(e) => e.stopPropagation()}>
            <span className="lasso-sheet__grip" aria-hidden="true" />
            <div className="lasso-sheet__overline">Sektioner, {title}</div>
            <ul className="lasso-sheet__list">
              {mobile!.sections!.map((s) => {
                const on = s.id === mobile!.activeSection;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`lasso-sheet__row ${on ? "is-on" : ""}`}
                      aria-current={on ? "true" : undefined}
                      disabled={s.disabled}
                      onClick={() => {
                        mobile!.onSelectSection?.(s.id);
                        setSheet(false);
                      }}
                    >
                      {s.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}

      <nav className="lasso-bottomnav" aria-label="Hovednavigation">
        {nav.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`lasso-bottomnav__item ${n.active ? "is-on" : ""}`}
            aria-current={n.active ? "page" : undefined}
            disabled={n.disabled}
            title={n.disabled ? n.disabledReason : undefined}
            onClick={n.onSelect}
          >
            <span className="lasso-bottomnav__icon">{n.icon}</span>
            <span className="lasso-bottomnav__label">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}


/**
 * Mobilens topbjælke (26a.1, 52 px): burger (når siden har sektioner), titel 14/600 + undertitel 11,
 * klokke og "…". AppShell tegner den under 768 px; står også alene i `TopBar`.
 */
export function MobileBar({ mobile, title, hasSections, sheetOpen = false, onToggleSheet }: { mobile?: AppShellMobile; title: string; hasSections?: boolean; sheetOpen?: boolean; onToggleSheet?: (open: boolean) => void }) {
  const actions = (mobile?.actions ?? []).slice(0, 2);
  const setSheet = (open: boolean) => onToggleSheet?.(open);
  return (
    <header className="lasso-mobilebar">
      {hasSections ? (
        <button type="button" className="lasso-mobilebar__btn" aria-label="Sektioner" aria-expanded={sheetOpen} aria-controls="lasso-sheet-sections" onClick={() => setSheet(!sheetOpen)}>
          <ShellIcon name="menu" size={20} />
        </button>
      ) : (
        <span className="lasso-mobilebar__btn lasso-mobilebar__btn--empty" aria-hidden="true" />
      )}
      <div className="lasso-mobilebar__titles">
        <div className="lasso-mobilebar__title">{title}</div>
        {mobile?.subtitle ? <div className="lasso-mobilebar__subtitle">{mobile.subtitle}</div> : null}
      </div>
      <div className="lasso-mobilebar__tools">
        {mobile?.onBell ? <MonitorBell unread={mobile.unread ?? 0} important={mobile.important} onClick={mobile.onBell} /> : null}
        {actions.map((a) => (
          <button key={a.id} type="button" className="lasso-mobilebar__btn" aria-label={a.label} title={a.label} onClick={a.onSelect}>
            {a.icon}
          </button>
        ))}
        {mobile?.moreItems?.length ? (
          <Menu
            trigger={<ShellIcon name="more" size={20} />}
            triggerClassName="lasso-mobilebar__btn"
            triggerLabel="Flere handlinger"
            label="Flere handlinger"
            align="end"
            items={mobile.moreItems}
            context={{ title, subtitle: mobile.subtitle }}
          />
        ) : mobile?.onMore ? (
          <button type="button" className="lasso-mobilebar__btn" aria-label="Flere handlinger" onClick={mobile.onMore}>
            <ShellIcon name="more" size={20} />
          </button>
        ) : null}
      </div>
    </header>
  );
}

/**
 * Sidens topbjælke uden resten af skabelonen (06.3): fanebjælken på desktop og mobilens topbjælke
 * (26a.1) under 768 px, med samme brudpunkt som AppShell.
 */
export function TopBar({ tabs, mobile }: { tabs: TabStripProps; mobile?: AppShellMobile }) {
  const title = mobile?.title ?? tabs.tabs.find((t) => t.active)?.label ?? "Lasso";
  return (
    <div className="lasso-topbar">
      <TabStrip {...tabs} />
      <MobileBar mobile={mobile} title={title} hasSections={!!mobile?.sections?.length} />
    </div>
  );
}

/**
 * Kroppen (katalog 06): tre lige brede kolonner adskilt af 1 px linjer, padding 40/24; hver
 * kolonne stabler sektioner med overskrift 22/600. Et modul kan også bruge én eller to kolonner
 * efter mønstrene i 30. Tablet: tre kolonner bliver to (den tredje i fuld bredde under); mobil: én
 * kolonne med padding 16.
 */
export function Columns({ count, children, className = "" }: { count?: 1 | 2 | 3; children?: ReactNode; className?: string }) {
  const n = count ?? 3;
  return <div className={`lasso-page-columns lasso-page-columns--${n} ${className}`}>{children}</div>;
}

export function Column({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <div className={`lasso-page-column ${className}`}>{children}</div>;
}
