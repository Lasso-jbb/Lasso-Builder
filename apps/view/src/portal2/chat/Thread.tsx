import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { IconButton } from "@lasso/ui";
import type { Turn } from "../thread.js";
import { AssistantMessage, NoticeRow, UserBubble, type AssistantMessageProps } from "./Message.js";

/** Så mange ture tegnes ad gangen; ældre hentes ind, når man ruller op til toppen. */
export const TURN_PAGE = 20;

/** "Indlæser ældre beskeder…" øverst i en lang samtale. */
export function OlderLoader({ loaderRef }: { loaderRef?: (el: HTMLDivElement | null) => void }) {
  return (
    <div className="chat-older" ref={loaderRef} role="status">
      Indlæser ældre beskeder…
    </div>
  );
}

/**
 * Rullet op: rund knap med pil ned (uden tal), der ruller til det nyeste. Designguidens IconButton (36) med klassen
 * chat-jump, som gør den til eksportens svævende cirkel: 40 px, rund, skygge (chat.css).
 */
export function ScrollDown({ onClick }: { onClick?: () => void }) {
  return <IconButton icon="arrow-down" label="Rul til nyeste" size={36} className="chat-jump" onClick={onClick} />;
}

export interface ThreadProps extends Omit<AssistantMessageProps, "answer" | "onRetry"> {
  turns: readonly Turn[];
  /** Nu (ms): Fortryd står, til turens undoUntil er passeret. */
  now?: number;
  onUndo?: (turn: Turn) => void;
  onRetry?: (turn: Turn) => void;
  /** Ekstra efter en tur (fx "Tilføjet som modul på alle virksomheder" eller en fejl med "Prøv igen"). */
  afterTurn?: (turn: Turn) => ReactNode;
  /** Antal ture, der tegnes fra start (resten hentes ind ved rulning op). */
  pageSize?: number;
}

/**
 * Samtalen på en fane (role=log): ældste øverst, nyeste nederst. Hver tur er brugerens boble, evt. meddelelsesrækken
 * og Lassos svar; 20 px mellem beskeder og 28 px mellem ture. Lange samtaler tegnes fra enden; "Indlæser ældre
 * beskeder…" henter de forrige ind, når man ruller op, uden at det synlige flytter sig.
 */
export function Thread({ turns, now, onUndo, onRetry, afterTurn, pageSize = TURN_PAGE, ...msg }: ThreadProps) {
  const [shown, setShown] = useState(pageSize);
  const root = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const hidden = Math.max(0, turns.length - shown);
  const visible = hidden ? turns.slice(hidden) : turns;

  // Ny fane (andre ture): start fra enden igen.
  const firstId = turns[0]?.id;
  useEffect(() => setShown(pageSize), [firstId, pageSize]);

  // Når ældre ture kommer ind øverst, holdes det synlige på plads.
  useLayoutEffect(() => {
    const a = anchor.current;
    const sc = root.current?.closest<HTMLElement>(".scroll");
    if (!a || !sc) return;
    sc.scrollTop = a.top + (sc.scrollHeight - a.height);
    anchor.current = null;
  }, [shown]);

  const observer = useRef<IntersectionObserver | null>(null);
  const loaderRef = (el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!el || typeof IntersectionObserver === "undefined") return;
    observer.current = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      const sc = root.current?.closest<HTMLElement>(".scroll");
      setTimeout(() => {
        if (sc) anchor.current = { height: sc.scrollHeight, top: sc.scrollTop };
        setShown((n) => n + pageSize);
      }, 250);
    });
    observer.current.observe(el);
  };
  useEffect(() => () => observer.current?.disconnect(), []);

  return (
    <div className="chat-thread" ref={root} role="log" aria-live="polite" aria-label="Samtalen med Lasso">
      {hidden ? <OlderLoader loaderRef={loaderRef} /> : null}
      {visible.map((turn) => (
        <div className="chat-turn" key={turn.id}>
          <UserBubble text={turn.question} />
          {turn.notice ? <NoticeRow notice={turn.notice} now={now} onUndo={onUndo ? () => onUndo(turn) : undefined} /> : null}
          {turn.notice?.kind === "moved" ? null : <AssistantMessage answer={turn.answer} onRetry={onRetry ? () => onRetry(turn) : undefined} {...msg} />}
          {afterTurn?.(turn)}
        </div>
      ))}
    </div>
  );
}
