import type { ReactNode } from "react";
import { MonitorBell } from "./MonitorSettings.js";
import { ShellIcon } from "./ShellIcons.js";

/**
 * Fanebjælken (katalog 06, node 9I4-0): 56 px på chrome-grå til højre for skinnen med de åbne
 * virksomheder og værktøjer som faner. Aktiv fane = hvid flade 44 px med radius 10 10 0 0, som
 * går i ét med sidens hvide flade under; ikon + navn 14/500 + luk-kryds. Inaktive faner = tekst på
 * grå. Derefter "+", og yderst til højre klokken (MonitorBell, katalog 21), feedback og konto.
 *
 * Kun navnet på fanen: aldrig tal, badge eller prik (regel 2). Klokkens badge er den eneste
 * tilladte. Tilstandsløs: værten åbner, lukker og skifter fane.
 */
export interface StripTab {
  id: string;
  label: string;
  /** Ikon 15 px; virksomheder får standardikonet, værktøjer deres eget. */
  icon?: ReactNode;
  active?: boolean;
}

export interface TabStripProps {
  tabs: readonly StripTab[];
  onSelect?: (id: string) => void;
  onClose?: (id: string) => void;
  onAdd?: () => void;
  /** Ulæste notifikationer til klokken. */
  unread?: number;
  /** Vigtig ændring (status/konkurs): rød "!" i klokken. */
  important?: boolean;
  bellOpen?: boolean;
  onBell?: () => void;
  onFeedback?: () => void;
  onAccount?: () => void;
  /** Eget kontoelement i stedet for kontoknappen, fx en <Menu> med brugerens navn og "Log ud" (portalen). */
  account?: ReactNode;
  className?: string;
}

export function TabStrip({ tabs, onSelect, onClose, onAdd, unread = 0, important, bellOpen, onBell, onFeedback, onAccount, account, className = "" }: TabStripProps) {
  return (
    <div className={`lasso-strip ${className}`}>
      <div className="lasso-strip__tabs" role="tablist" aria-label="Åbne sider">
        {tabs.map((t) => {
          const on = !!t.active;
          return (
            <div key={t.id} role="tab" aria-selected={on} className={`lasso-strip__tab ${on ? "is-on" : ""}`}>
              <button type="button" className="lasso-strip__select" tabIndex={on ? 0 : -1} title={t.label} onClick={() => onSelect?.(t.id)}>
                <span className="lasso-strip__icon">{t.icon ?? <ShellIcon name="company" />}</span>
                <span className="lasso-strip__label">{t.label}</span>
              </button>
              {onClose ? (
                <button type="button" className="lasso-strip__close" aria-label={`Luk ${t.label}`} onClick={() => onClose(t.id)}>
                  <ShellIcon name="close" size={13} />
                </button>
              ) : null}
            </div>
          );
        })}
        {onAdd ? (
          <button type="button" className="lasso-strip__add" aria-label="Åbn ny fane" onClick={onAdd}>
            <ShellIcon name="plus" size={15} />
          </button>
        ) : null}
      </div>
      <div className="lasso-strip__tools">
        {onBell ? <MonitorBell unread={unread} important={important} open={bellOpen} onClick={onBell} /> : null}
        {onFeedback ? (
          <button type="button" className="lasso-strip__tool" aria-label="Feedback" title="Feedback" onClick={onFeedback}>
            <ShellIcon name="feedback" size={18} />
          </button>
        ) : null}
        {account ??
          (onAccount ? (
            <button type="button" className="lasso-strip__tool" aria-label="Konto" title="Konto" onClick={onAccount}>
              <ShellIcon name="user" size={18} />
            </button>
          ) : null)}
      </div>
    </div>
  );
}
