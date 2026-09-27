import { formatDate, formatNumber } from "@lasso/spec";
import { DataState } from "../primitives.js";

/** Ændringstyper, man kan slå til og fra pr. virksomhed (katalog 21), i samme rækkefølge som typefiltret i feedet. */
export const MONITOR_TYPES = ["status", "regnskab", "ledelse", "stamdata", "kredit"] as const;
export type MonitorType = (typeof MONITOR_TYPES)[number];

export const MONITOR_TYPE_LABELS: Record<MonitorType, string> = {
  status: "Status og konkurs",
  regnskab: "Nyt regnskab",
  ledelse: "Ledelse og ejere",
  stamdata: "Stamdata (adresse, navn, branche)",
  kredit: "Kreditscore ændrer sig ≥ 5 point",
};

function BellIcon({ filled = false, size = 18 }: { filled?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8.5a6 6 0 10-12 0c0 6.5-2.5 6.5-2.5 8.5h17c0-2-2.5-2-2.5-8.5" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" />
      {filled ? null : <path d="M10 20a2 2 0 004 0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />}
    </svg>
  );
}

export interface MonitorBellProps {
  /** Antal ulæste; 0 = ingen badge. */
  unread: number;
  /** Vigtig ændring (status/konkurs): rød badge med "!" i stedet for tallet. */
  important?: boolean;
  onClick?: () => void;
  /** Om panelet er åbent (aria-expanded). */
  open?: boolean;
}

/**
 * Klokken i topbjælken (katalog 21, node CDW-0): ingen ulæste = klokke alene, N ulæste = koral badge
 * med tallet, vigtig ændring (status/konkurs) = rød badge med "!". Badgen er den eneste tilladte badge
 * i kataloget; teksten til skærmlæsere bærer betydningen (regel 7).
 */
export function MonitorBell({ unread, important, onClick, open }: MonitorBellProps) {
  const label = important ? `Notifikationer, vigtig ændring, ${formatNumber(unread)} ulæste` : unread > 0 ? `Notifikationer, ${formatNumber(unread)} ulæste` : "Notifikationer, ingen ulæste";
  return (
    <button type="button" className={`lasso-bell ${unread > 0 ? "lasso-bell--unread" : ""}`} aria-label={label} aria-expanded={open} onClick={onClick}>
      <BellIcon />
      {important ? (
        <span className="lasso-bell__badge lasso-bell__badge--important" aria-hidden="true">
          !
        </span>
      ) : unread > 0 ? (
        <span className="lasso-bell__badge" aria-hidden="true">
          {unread > 99 ? "99+" : formatNumber(unread)}
        </span>
      ) : null}
    </button>
  );
}

function Toggle({ on, label, onChange, disabled }: { on: boolean; label: string; onChange?: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`lasso-toggle ${on ? "is-on" : ""}`} disabled={disabled} onClick={() => onChange?.(!on)}>
      <span className="lasso-toggle__knob" aria-hidden="true" />
    </button>
  );
}

export interface MonitorSettingsProps {
  companyName: string;
  /** Om virksomheden overvåges. false = kun "Overvåg"-knappen vises. */
  monitoring: boolean;
  /** Listen, virksomheden ligger i, fx "Kunder". */
  listName?: string;
  /** Overvåget siden (ÅÅÅÅ-MM-DD). */
  since?: string;
  /** Beskedfrekvens, fx "dagligt" eller "straks". */
  frequency?: string;
  /** Hvilke ændringstyper der giver besked. */
  settings: Readonly<Partial<Record<MonitorType, boolean>>>;
  onToggle?: (type: MonitorType, on: boolean) => void;
  onStart?: () => void;
  onStop?: () => void;
  /** Henter-tilstand mens indstillingerne læses. */
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

/**
 * "Overvåger"-tilstand pr. virksomhed (katalog 21, node CEG-0): "Overvåger"-knappen i koral-soft (08),
 * "<Navn> overvåges", "I listen 'Kunder', siden 03.03.2025, besked pr. e-mail dagligt", "Stop overvågning"
 * som tekstknap (aldrig rød), og én kontakt (toggle) pr. ændringstype i samme rækkefølge som typefiltret
 * i feedet. Toggle er koral, når den er til.
 */
export function MonitorSettings({ companyName, monitoring, listName, since, frequency, settings, onToggle, onStart, onStop, loading, error, onRetry }: MonitorSettingsProps) {
  if (loading || error) {
    return (
      <div className="lasso-monitor">
        <div className="lasso-monitor__state">{error ? <DataState state="error" reason={error} onRetry={onRetry} /> : <DataState state="loading" lines={5} height={276} />}</div>
      </div>
    );
  }
  const facts = [listName ? `I listen "${listName}"` : null, since ? `siden ${formatDate(since)}` : null, `besked pr. e-mail ${frequency ?? "dagligt"}`].filter(Boolean).join(", ");
  return (
    <div className={`lasso-monitor ${monitoring ? "lasso-monitor--on" : ""}`}>
      <div className="lasso-monitor__head">
        <button type="button" className={`lasso-monitor__btn ${monitoring ? "is-on" : ""}`} aria-pressed={monitoring} onClick={monitoring ? undefined : onStart}>
          <BellIcon filled={monitoring} size={15} />
          {monitoring ? "Overvåger" : "Overvåg"}
        </button>
        <div className="lasso-monitor__titles">
          <div className="lasso-monitor__title">{monitoring ? `${companyName} overvåges` : `${companyName} overvåges ikke`}</div>
          <div className="lasso-monitor__sub">{monitoring ? facts : "Få besked, når status, regnskab, ledelse eller stamdata ændrer sig."}</div>
        </div>
        {monitoring && onStop ? (
          <button type="button" className="lasso-link lasso-monitor__stop" onClick={onStop}>
            Stop overvågning
          </button>
        ) : null}
      </div>
      {monitoring ? (
        <ul className="lasso-monitor__rows">
          {MONITOR_TYPES.map((t) => (
            <li key={t} className="lasso-monitor__row">
              <span className="lasso-monitor__label" id={`lasso-monitor-${t}`}>
                {MONITOR_TYPE_LABELS[t]}
              </span>
              <Toggle on={Boolean(settings[t])} label={MONITOR_TYPE_LABELS[t]} onChange={onToggle ? (on) => onToggle(t, on) : undefined} disabled={!onToggle} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
