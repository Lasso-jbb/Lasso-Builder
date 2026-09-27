import { useState } from "react";
import { formatDate, formatNumber } from "@lasso/spec";
import { DataState } from "../primitives.js";
import { Tabs } from "./Tabs.js";
import { clockText } from "./ChangeFeed.js";

/** Hvor notifikationen kommer fra; står altid i anden linje (katalog 21). */
export type NotificationKind = "overvaagning" | "kredit" | "eksport" | "konto";

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  overvaagning: "Overvågning",
  kredit: "Kredit",
  eksport: "Eksport",
  konto: "Konto",
};

export interface NotificationVM {
  id: string;
  kind: NotificationKind;
  text: string;
  /** Kilde i anden linje, fx 'Overvågning "Kunder"'. Udeladt = kind-etiketten. */
  source?: string;
  /** ISO-tidsstempel. */
  at: string;
  read: boolean;
  /** Handling til højre, fx "Hent" for en færdig eksport. */
  action?: { label: string; href?: string };
}

export interface NotificationPanelProps {
  items: readonly NotificationVM[];
  /** Ren UI-komponent: værten (portalen) markerer, henter og navigerer. */
  onMarkAllRead?: () => void;
  onAction?: (item: NotificationVM) => void;
  onSeeAll?: () => void;
  onOpen?: (item: NotificationVM) => void;
  /** Lukker panelet (på mobil fylder det skærmen, så der skal være en "Luk"-knap). */
  onClose?: () => void;
  /** Til tests og deterministisk relativ tid. */
  now?: Date;
  /** Henter-tilstand: skelet i panelets højde. */
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

type PanelTab = "ulaeste" | "alle" | "overvaagning";

/** "for 2 timer siden" under 24 timer, "i går kl. 16.20", ellers "22.09.2026". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const diffMin = Math.max(0, Math.round((now.getTime() - then.getTime()) / 60_000));
  const sameDay = then.toDateString() === now.toDateString();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString() === then.toDateString();
  if (sameDay && diffMin < 60) return diffMin <= 1 ? "lige nu" : `for ${diffMin} minutter siden`;
  if (sameDay) {
    const h = Math.round(diffMin / 60);
    return `for ${h} ${h === 1 ? "time" : "timer"} siden`;
  }
  if (yesterday) return `i går ${clockText(iso)}`;
  return formatDate(iso.slice(0, 10));
}

/**
 * Notifikationspanel (katalog 21, node CB0-0): 380 px, åbnes fra klokken i topbjælken. Overskrift
 * "Notifikationer (N ulæste)" + "Markér alle som læst", faner niveau 2 (Ulæste, Alle, Overvågning),
 * rækker med koral prik for ulæst, tekst, kilde + tid i anden linje og evt. handling til højre,
 * "Se alle notifikationer" nederst. Blander overvågning, kredit, eksport og konto; kilden står altid
 * i anden linje. På mobil fylder panelet skærmen.
 */
export function NotificationPanel({ items, onMarkAllRead, onAction, onSeeAll, onOpen, onClose, now, loading, error, onRetry }: NotificationPanelProps) {
  const [tab, setTab] = useState<PanelTab>("ulaeste");
  const clock = now ?? new Date();
  const unread = items.filter((n) => !n.read).length;
  const sorted = [...items].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const rows = tab === "ulaeste" ? sorted.filter((n) => !n.read) : tab === "overvaagning" ? sorted.filter((n) => n.kind === "overvaagning") : sorted;
  const emptyReason = tab === "ulaeste" ? "Alt er læst." : tab === "overvaagning" ? "Ingen notifikationer fra overvågningen endnu." : "Ingen notifikationer endnu.";

  return (
    <div className="lasso-notif" role="dialog" aria-label="Notifikationer">
      <div className="lasso-notif__head">
        <h2 className="lasso-notif__title">Notifikationer{unread ? ` (${formatNumber(unread)})` : ""}</h2>
        <div className="lasso-notif__headactions">
          {unread > 0 && onMarkAllRead ? (
            <button type="button" className="lasso-link lasso-notif__markall" onClick={onMarkAllRead}>
              Markér alle som læst
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className="lasso-link lasso-notif__close" onClick={onClose} aria-label="Luk notifikationer">
              Luk
            </button>
          ) : null}
        </div>
      </div>
      <Tabs
        level={2}
        id="lasso-notif"
        ariaLabel="Vis notifikationer"
        className="lasso-notif__tabs"
        items={[
          { id: "ulaeste", label: "Ulæste" },
          { id: "alle", label: "Alle" },
          { id: "overvaagning", label: "Overvågning" },
        ]}
        value={tab}
        onChange={(id) => setTab(id as PanelTab)}
      />
      <div className="lasso-notif__body">
        {loading ? (
          <div className="lasso-notif__state">
            <DataState state="loading" lines={5} height={220} />
          </div>
        ) : error ? (
          <div className="lasso-notif__state">
            <DataState state="error" reason={error} onRetry={onRetry} />
          </div>
        ) : rows.length === 0 ? (
          <div className="lasso-notif__state">
            <DataState state="empty" reason={emptyReason} />
          </div>
        ) : (
          <ul className="lasso-notif__list">
            {rows.map((n) => (
              <li key={n.id} className={`lasso-notif__row ${n.read ? "" : "lasso-notif__row--unread"}`}>
                {n.read ? <span className="lasso-notif__dotspace" aria-hidden="true" /> : <span className="lasso-notif__dot" role="img" aria-label="Ulæst" />}
                <div className="lasso-notif__main">
                  {onOpen ? (
                    <button type="button" className="lasso-link lasso-notif__text" onClick={() => onOpen(n)}>
                      {n.text}
                    </button>
                  ) : (
                    <div className="lasso-notif__text">{n.text}</div>
                  )}
                  <div className="lasso-notif__meta">
                    {n.source ?? NOTIFICATION_KIND_LABELS[n.kind]}, {relativeTime(n.at, clock)}
                  </div>
                </div>
                {n.action ? (
                  n.action.href ? (
                    <a className="lasso-notif__action" href={n.action.href} onClick={onAction ? () => onAction(n) : undefined}>
                      {n.action.label}
                    </a>
                  ) : (
                    <button type="button" className="lasso-link lasso-notif__action" onClick={onAction ? () => onAction(n) : undefined}>
                      {n.action.label}
                    </button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      {onSeeAll ? (
        <button type="button" className="lasso-link lasso-notif__all" onClick={onSeeAll}>
          Se alle notifikationer
        </button>
      ) : null}
    </div>
  );
}
