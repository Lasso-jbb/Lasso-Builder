import { Menu, type MenuItem } from "./Menu.js";
import { ShellIcon } from "./ShellIcons.js";

/**
 * Hovedets handlinger (katalog 08.1 og 16.1): små 32 px ikonknapper øverst til højre, aldrig store
 * fyldte knapper. Rækkefølge: Overvåg, Gem, Eksportér, Flere.
 *
 * - Overvåg: koral ikon og koral kant. "Overvåger" er samme knap i valgt tilstand: hvid flade, 1 px
 *   koral kant og udfyldt ikon; klik åbner overvågningsindstillingerne (værten), aldrig af/på.
 * - Gem/Gemt: bogmærke, udfyldt når gemt (aria-pressed), aldrig farvet fyld.
 * - Eksportér: ét punkt = direkte knap, flere punkter = menu (PDF-rapport, CSV …).
 * - Flere ("…"): menu; skjules, når den er tom.
 * - Ophørt virksomhed: ingen Overvåg; handlingen er tekstlinket "Se historik".
 *
 * `labels` giver varianten med ord ved ikonerne (hovedvarianten i 08, "Eksportér, Gem, Overvåger"),
 * hvor den vigtigste handling står yderst til højre. Mobil (< 560 px): 40 px knapper under faktalinjen.
 */
export interface HeadActionsProps {
  monitor?: { monitoring: boolean; busy?: boolean; onClick: () => void };
  save?: { saved: boolean; busy?: boolean; onClick: () => void };
  exportItems?: readonly MenuItem[];
  more?: readonly MenuItem[];
  /** 26d.1: netværksknap (personens netværk); vises kun på mobil i personhovedet. */
  network?: () => void;
  /** Ophørt: "Se historik" som tekstlink i stedet for Overvåg. */
  history?: () => void;
  /** Ord ved ikonerne (variant med ord), ellers kun ikoner med aria-label og title. */
  labels?: boolean;
  /** Mobil: kontekst øverst i handlingsarket ("…"), fx virksomhedens navn. */
  context?: { title: string; subtitle?: string };
  className?: string;
}

export function hasHeadActions(p: HeadActionsProps | undefined): boolean {
  if (!p) return false;
  return Boolean(p.monitor || p.save || p.exportItems?.length || p.more?.length || p.history);
}

function MonitorButton({ monitor, labels }: { monitor: NonNullable<HeadActionsProps["monitor"]>; labels: boolean }) {
  const label = monitor.monitoring ? "Overvåger" : "Overvåg";
  return (
    <button
      type="button"
      className={`lasso-headbtn lasso-headbtn--monitor${monitor.monitoring ? " is-on" : ""}${labels ? " lasso-headbtn--label" : ""}`}
      aria-pressed={monitor.monitoring}
      aria-busy={monitor.busy || undefined}
      aria-label={labels ? undefined : monitor.monitoring ? "Overvåger, åbn overvågningsindstillinger" : "Overvåg"}
      title={monitor.monitoring ? "Overvåger: åbn indstillinger" : "Overvåg"}
      onClick={() => {
        if (!monitor.busy) monitor.onClick();
      }}
    >
      <ShellIcon name="bell" size={16} filled={monitor.monitoring} />
      {labels ? <span>{label}</span> : null}
    </button>
  );
}

function SaveButton({ save, labels }: { save: NonNullable<HeadActionsProps["save"]>; labels: boolean }) {
  return (
    <button
      type="button"
      className={`lasso-headbtn lasso-headbtn--save${labels ? " lasso-headbtn--label" : ""}`}
      aria-pressed={save.saved}
      aria-busy={save.busy || undefined}
      aria-label={labels ? undefined : save.saved ? "Gemt, fjern fra din liste" : "Gem på din liste"}
      title={save.saved ? "Fjern fra din liste" : "Gem på din liste"}
      onClick={() => {
        if (!save.busy) save.onClick();
      }}
    >
      <ShellIcon name="bookmark" size={16} filled={save.saved} />
      {labels ? <span>{save.saved ? "Gemt" : "Gem"}</span> : null}
    </button>
  );
}

function ExportButton({ items, labels, context }: { items: readonly MenuItem[]; labels: boolean; context?: HeadActionsProps["context"] }) {
  const cls = `lasso-headbtn lasso-headbtn--export${labels ? " lasso-headbtn--label" : ""}`;
  const face = (
    <>
      <ShellIcon name="download" size={16} />
      {labels ? <span>Eksportér</span> : null}
    </>
  );
  if (items.length === 1) {
    const only = items[0]!;
    return (
      <button type="button" className={cls} aria-label={labels ? undefined : only.label} title={only.label} onClick={only.onSelect} disabled={only.disabled}>
        {face}
      </button>
    );
  }
  return <Menu trigger={face} triggerClassName={cls} triggerLabel={labels ? undefined : "Eksportér"} items={items} align="end" context={context} label="Eksportér" />;
}

export function HeadActions({ monitor, save, exportItems, more, history, network, labels = false, context, className = "" }: HeadActionsProps) {
  if (!hasHeadActions({ monitor, save, exportItems, more, history })) return null;
  const moreMenu = more?.length ? (
    <Menu trigger={<ShellIcon name="more" size={18} />} triggerClassName="lasso-headbtn lasso-headbtn--more" triggerLabel="Flere handlinger" items={more} align="end" context={context} label="Flere handlinger" />
  ) : null;
  const historyLink = history ? (
    <button type="button" className="lasso-link lasso-headactions__history" onClick={history}>
      Se historik
    </button>
  ) : null;
  const mon = monitor && !history ? <MonitorButton monitor={monitor} labels={labels} /> : null;
  const sv = save ? <SaveButton save={save} labels={labels} /> : null;
  const ex = exportItems?.length ? <ExportButton items={exportItems} labels={labels} context={context} /> : null;
  const net = network ? (
    <button type="button" className="lasso-headbtn lasso-headbtn--network" aria-label="Netværk" title="Netværk" onClick={network}>
      <ShellIcon name="network" size={16} />
    </button>
  ) : null;
  return (
    <div className={`lasso-headactions${labels ? " lasso-headactions--labels" : ""} ${className}`} role="group" aria-label="Handlinger">
      {labels ? (
        <>
          {historyLink}
          {ex}
          {sv}
          {mon}
          {moreMenu}
        </>
      ) : (
        <>
          {historyLink}
          {mon}
          {net}
          {sv}
          {ex}
          {moreMenu}
        </>
      )}
    </div>
  );
}
