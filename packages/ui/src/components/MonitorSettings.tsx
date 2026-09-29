import type { CSSProperties } from "react";
import { formatNumber } from "@lasso/spec";
import { DataState } from "../primitives.js";
import { Icon } from "./Icon.js";
import { HIDDEN_CHANGE_TYPES } from "./ChangeFeed.js";

/**
 * Ændringstyper, man kan slå til og fra pr. virksomhed (katalog 21.4): Status og konkurs, Nyt regnskab,
 * Ledelse og ejere, Stamdata, Kreditscore; ledelse og ejerskab er én kontakt.
 */
export const MONITOR_TYPES = ["status", "regnskab", "ledelse", "stamdata", "kredit"] as const;
export type MonitorType = (typeof MONITOR_TYPES)[number];

export const MONITOR_TYPE_LABELS: Record<MonitorType, string> = {
  status: "Status og konkurs",
  regnskab: "Nyt regnskab",
  ledelse: "Ledelse og ejere",
  stamdata: "Stamdata (adresse, navn, branche)",
  kredit: "Kreditscore ændrer sig ≥ 5 point",
};

/** Mobil (26e.4): kort navn og undertekst pr. emne; stamdata indgår i "Status og adresse". */
const MOBILE: Partial<Record<MonitorType, { label: string; sub: string; order: number }>> = {
  regnskab: { label: "Regnskab", sub: "Nyt regnskab, revisorforbehold", order: 1 },
  ledelse: { label: "Ledelse og ejere", sub: "Til- og fratrædelser, ejerskifte", order: 2 },
  status: { label: "Status og adresse", sub: "Konkurs, likvidation, flytning", order: 3 },
  kredit: { label: "Kreditscore", sub: "Ændring på 5 point eller mere", order: 4 },
};

function BellIcon({ filled = false, size = 18 }: { filled?: boolean; size?: number }) {
  return <Icon name="bell" size={size} filled={filled} />;
}

export interface MonitorBellProps {
  /** Antal ulæste; står kun i skærmlæserteksten (klokken har aldrig badge). */
  unread: number;
  /** Vigtig ændring (status/konkurs): klokken står i mørk rød i stedet for koral. */
  important?: boolean;
  onClick?: () => void;
  /** Om panelet er åbent (aria-expanded). */
  open?: boolean;
}

/**
 * Klokken i topbjælken (katalog 21.3, node CDW-0): aldrig badge. Ingen ulæste = neutral klokke,
 * ulæste = koral klokke, vigtig ændring (status/konkurs) = mørk rød klokke. Antallet og betydningen
 * står i skærmlæserteksten og i panelets hoved ("Notifikationer (3)").
 */
export function MonitorBell({ unread, important, onClick, open }: MonitorBellProps) {
  const label = important ? `Notifikationer, vigtig ændring, ${formatNumber(unread)} ulæste` : unread > 0 ? `Notifikationer, ${formatNumber(unread)} ulæste` : "Notifikationer, ingen ulæste";
  return (
    <button type="button" className={`lasso-bell${unread > 0 ? " lasso-bell--unread" : ""}${important ? " lasso-bell--important" : ""}`} aria-label={label} aria-expanded={open} onClick={onClick}>
      <BellIcon filled={unread > 0 || Boolean(important)} />
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
  /** Listen, virksomheden ligger i, fx "Kunder". 21.4: vises ikke længere under titlen. */
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
  /** Levering (mobil 26e.4), fx "Push + e-mail dagligt". Standard: "E-mail " + frekvens. */
  delivery?: string;
  /** Tryk på "Levering"-rækken (mobil). */
  onDelivery?: () => void;
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
 * Mobil (26e.4): hoved "Overvågning" + navn, fremhævet 52 px række "Overvåger" + "siden 03.2026, 3 emner"
 * med kontakt, fire 48 px emnerækker med undertekst og en "Levering"-række nederst.
 */
export function MonitorSettings({ companyName, monitoring, frequency, settings, onToggle, onStart, onStop, delivery, onDelivery, loading, error, onRetry }: MonitorSettingsProps) {
  if (loading || error) {
    return (
      <div className="lasso-monitor">
        <div className="lasso-monitor__state">{error ? <DataState state="error" reason={error} onRetry={onRetry} /> : <DataState state="loading" lines={5} height={276} />}</div>
      </div>
    );
  }
  // 21.1/21.4 (Jakob 29.09): rækken "Kreditscore ændrer sig" udgår (afklaret 15:41).
  const types = MONITOR_TYPES.filter((t) => !(HIDDEN_CHANGE_TYPES as readonly string[]).includes(t));
  return (
    <div className={`lasso-monitor ${monitoring ? "lasso-monitor--on" : ""}`}>
      {/* 26e.4 mobil: hoved, overvågningsstatus som fremhævet 52 px række med kontakt. */}
      <div className="lasso-monitor__mhead">
        <span className="lasso-monitor__mhead-title">Overvågning</span>
        <span className="lasso-monitor__mhead-name">{companyName}</span>
      </div>
      <div className="lasso-monitor__mstatus">
        <span className="lasso-monitor__mstatus-label">
          <BellIcon filled={false} size={18} />
          <span className="lasso-monitor__mstatus-text">
            <span className="lasso-monitor__mstatus-title">{monitoring ? "Overvåger" : "Overvåg"}</span>
            {/* 21.4 (Jakob, kontrol r5): kun titlen, også på mobil (ingen "siden …, N emner") */}
          </span>
        </span>
        <Toggle
          on={monitoring}
          label={monitoring ? `Overvåger ${companyName}` : `Overvåg ${companyName}`}
          onChange={monitoring ? (onStop ? () => onStop() : undefined) : onStart ? () => onStart() : undefined}
          disabled={monitoring ? !onStop : !onStart}
        />
      </div>
      <div className="lasso-monitor__head">
        <button type="button" className={`lasso-monitor__btn ${monitoring ? "is-on" : ""}`} aria-pressed={monitoring} onClick={monitoring ? undefined : onStart}>
          <BellIcon filled={monitoring} size={15} />
          {monitoring ? "Overvåger" : "Overvåg"}
        </button>
        <div className="lasso-monitor__titles">
          <div className="lasso-monitor__title">{monitoring ? `${companyName} overvåges` : `${companyName} overvåges ikke`}</div>
          {/* 21.4 (Jakob): overvåget står kun titlen (ingen "I listen …, siden …, besked pr. e-mail …"). */}
          {monitoring ? null : <div className="lasso-monitor__sub">Få besked, når status, regnskab, ledelse eller stamdata ændrer sig.</div>}
        </div>
        {monitoring && onStop ? (
          <button type="button" className="lasso-link lasso-monitor__stop" onClick={onStop}>
            Stop overvågning
          </button>
        ) : null}
      </div>
      {monitoring ? (
        <ul className="lasso-monitor__rows">
          {types.map((t) => {
            const m = MOBILE[t];
            return (
              <li key={t} className={`lasso-monitor__row${m ? "" : " lasso-monitor__row--desktop"}`} style={m ? ({ "--lasso-monitor-order": m.order } as CSSProperties) : undefined}>
                <span className="lasso-monitor__label" id={`lasso-monitor-${t}`}>
                  <span className="lasso-monitor__label-d">{MONITOR_TYPE_LABELS[t]}</span>
                  {m ? (
                    <span className="lasso-monitor__label-m">
                      {m.label}
                      <span className="lasso-monitor__label-sub">{m.sub}</span>
                    </span>
                  ) : null}
                </span>
                <Toggle on={Boolean(settings[t])} label={MONITOR_TYPE_LABELS[t]} onChange={onToggle ? (on) => onToggle(t, on) : undefined} disabled={!onToggle} />
              </li>
            );
          })}
        </ul>
      ) : null}
      {/* G1 (kontrol r5): "Levering" kun, når værten kan åbne leveringsindstillingerne */}
      {monitoring && onDelivery ? (
        <button type="button" className="lasso-monitor__delivery" onClick={onDelivery}>
          <span>Levering</span>
          <span className="lasso-monitor__delivery-value">
            {delivery ?? `E-mail ${frequency ?? "dagligt"}`}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      ) : null}
    </div>
  );
}
