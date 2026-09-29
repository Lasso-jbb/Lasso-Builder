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
  /** Vigtig (26e.5), fx en statusændring som konkurs: rød ulæst-prik og med under filteret "Vigtige". */
  important?: boolean;
  /** Mobil (26e.5): kort titel 14 ink, fx "Nyt regnskab 2025"; `text` står da som kildetekst 13 muted under. */
  title?: string;
  /** Mobil (26e.5): kategori 12 muted under teksten, fx "Regnskab" eller "Status" (rød, når vigtig). */
  category?: string;
}

export interface NotificationPanelProps {
  items: readonly NotificationVM[];
  /** Ren UI-komponent: værten (portalen) markerer, henter og navigerer. */
  onMarkAllRead?: () => void;
  onAction?: (item: NotificationVM) => void;
  onSeeAll?: () => void;
  onOpen?: (item: NotificationVM) => void;
  /** Lukker panelet (kun på mobil, hvor det fylder skærmen; desktop lukker ved klik udenfor). */
  onClose?: () => void;
  /** Mobil: vis listen på siden (26e.5) i stedet for som ark i fuld skærm. */
  inline?: boolean;
  /** Til tests og deterministisk relativ tid. */
  now?: Date;
  /** Henter-tilstand: skelet i panelets højde. */
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

type PanelTab = "ulaeste" | "alle" | "overvaagning" | "vigtige";

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

/** Mobilens korte tid (26e.5): "i dag", "i går" eller "11.03". */
export function shortTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  if (then.toDateString() === now.toDateString()) return "i dag";
  if (new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString() === then.toDateString()) return "i går";
  return formatDate(iso.slice(0, 10)).slice(0, 5);
}

/**
 * Notifikationspanel (katalog 21, node CB0-0): 380 px, åbnes fra klokken i topbjælken. Overskrift
 * "Notifikationer (N ulæste)" + "Markér alle som læst", faner niveau 2 (Ulæste, Alle, Overvågning),
 * rækker med koral prik for ulæst, tekst, kilde + tid i anden linje og evt. handling til højre,
 * "Se alle notifikationer" nederst. Blander overvågning, kredit, eksport og konto; kilden står altid
 * i anden linje. "Luk" står kun på mobil, hvor panelet fylder skærmen (eller står på siden med `inline`).
 * Mobil (26e.5): chips Alle (valgt fra start), Ulæste, Vigtige; rækker med 8 px prik (koral, rød ved
 * vigtig), titel 14 ink med kort tid til højre, kildetekst 13 muted og kategori 12 muted.
 */
export function NotificationPanel({ items, onMarkAllRead, onAction, onSeeAll, onOpen, onClose, inline, now, loading, error, onRetry }: NotificationPanelProps) {
  const [tab, setTab] = useState<PanelTab>("ulaeste");
  const [chip, setChip] = useState<PanelTab>("alle");
  const clock = now ?? new Date();
  const unread = items.filter((n) => !n.read).length;
  const sorted = [...items].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const filter = (t: PanelTab) =>
    t === "ulaeste" ? sorted.filter((n) => !n.read) : t === "overvaagning" ? sorted.filter((n) => n.kind === "overvaagning") : t === "vigtige" ? sorted.filter((n) => n.important) : sorted;
  const emptyFor = (t: PanelTab) =>
    t === "ulaeste" ? "Alt er læst." : t === "overvaagning" ? "Ingen notifikationer fra overvågningen endnu." : t === "vigtige" ? "Ingen vigtige notifikationer." : "Ingen notifikationer endnu.";

  const dot = (n: NotificationVM) =>
    n.read ? <span className="lasso-notif__dotspace" aria-hidden="true" /> : <span className={`lasso-notif__dot${n.important ? " lasso-notif__dot--important" : ""}`} role="img" aria-label={n.important ? "Ulæst, vigtig" : "Ulæst"} />;
  const action = (n: NotificationVM) =>
    n.action ? (
      n.action.href ? (
        <a className="lasso-notif__action" href={n.action.href} onClick={onAction ? () => onAction(n) : undefined}>
          {n.action.label}
        </a>
      ) : (
        <button type="button" className="lasso-link lasso-notif__action" onClick={onAction ? () => onAction(n) : undefined}>
          {n.action.label}
        </button>
      )
    ) : null;
  const titleEl = (n: NotificationVM, text: string) =>
    onOpen ? (
      <button type="button" className="lasso-link lasso-notif__text" onClick={() => onOpen(n)}>
        {text}
      </button>
    ) : (
      <div className="lasso-notif__text">{text}</div>
    );
  const body = (t: PanelTab, mobile: boolean) => {
    if (loading) return <div className="lasso-notif__state"><DataState state="loading" lines={5} height={220} /></div>;
    if (error) return <div className="lasso-notif__state"><DataState state="error" reason={error} onRetry={onRetry} /></div>;
    const rows = filter(t);
    if (rows.length === 0) return <div className="lasso-notif__state"><DataState state="empty" reason={emptyFor(t)} /></div>;
    return (
      <ul className="lasso-notif__list">
        {rows.map((n) => (
          <li key={n.id} className={`lasso-notif__row ${n.read ? "" : "lasso-notif__row--unread"}`}>
            {dot(n)}
            {mobile ? (
              <div className="lasso-notif__main">
                <div className="lasso-notif__titlerow">
                  {titleEl(n, n.title ?? n.text)}
                  <span className="lasso-notif__time">{shortTime(n.at, clock)}</span>
                </div>
                <div className="lasso-notif__src">{n.title ? n.text : (n.source ?? NOTIFICATION_KIND_LABELS[n.kind])}</div>
                <div className={`lasso-notif__cat${n.important ? " lasso-notif__cat--important" : ""}`}>{n.category ?? NOTIFICATION_KIND_LABELS[n.kind]}</div>
              </div>
            ) : (
              <div className="lasso-notif__main">
                {titleEl(n, n.text)}
                <div className="lasso-notif__meta">
                  {n.source ?? NOTIFICATION_KIND_LABELS[n.kind]}, {relativeTime(n.at, clock)}
                </div>
              </div>
            )}
            {action(n)}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className={`lasso-notif${inline ? " lasso-notif--inline" : ""}`} role="dialog" aria-label="Notifikationer">
      <div className="lasso-notif__head">
        <h2 className="lasso-notif__title">
          Notifikationer<span className="lasso-notif__count">{unread ? ` (${formatNumber(unread)})` : ""}</span>
        </h2>
        <div className="lasso-notif__headactions">
          {unread > 0 && onMarkAllRead ? (
            <button type="button" className="lasso-link lasso-notif__markall" onClick={onMarkAllRead}>
              Markér alle som læst
            </button>
          ) : null}
          {onClose && !inline ? (
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
      {/* Mobil (26e.5): valgbare filterchips Alle, Ulæste, Vigtige i stedet for faner. Valgt = ink-kant, aldrig fyld. */}
      <div className="lasso-notif__chips" role="group" aria-label="Filtrér notifikationer">
        {(
          [
            ["alle", "Alle"],
            ["ulaeste", "Ulæste"],
            ["vigtige", "Vigtige"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={`lasso-notif__chip${chip === id ? " is-selected" : ""}`} aria-pressed={chip === id} onClick={() => setChip(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="lasso-notif__body lasso-notif__body--d">{body(tab, false)}</div>
      <div className="lasso-notif__body lasso-notif__body--m">{body(chip, true)}</div>
      {onSeeAll ? (
        <button type="button" className="lasso-link lasso-notif__all" onClick={onSeeAll}>
          Se alle notifikationer
        </button>
      ) : null}
    </div>
  );
}
