import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconButton } from "@lasso/ui";
import type { Turn } from "../thread.js";
import { AssistantMessage, NoticeRow, UserBubble, type AssistantMessageProps } from "./Message.js";
import type { ViewPart } from "./AnswerCard.js";

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
  /** Ekstra efter en tur (fx en fejl fra "Tilføj som fane" med "Prøv igen"). */
  afterTurn?: (turn: Turn) => ReactNode;
  /** Antal ture, der tegnes fra start (resten hentes ind ved rulning op). */
  pageSize?: number;
  /**
   * Det uden for turen, en række afhænger af (tema, fanen, "Tilføj som fane" i gang, en note efter turen …), som en
   * streng. Rækkerne er memoiserede: de tegnes kun igen, når turen, denne streng eller mobil/fanen skifter, så et nyt
   * tekststykke i den nyeste tur ikke tegner hele samtalen igen.
   */
  rowKey?: (turn: Turn) => string;
}

/** Handlerne til rækkerne: stabile (de læser de nyeste fra Thread via en ref), så memo-rækkerne ikke tegnes igen for nye closures. */
interface RowHandlers {
  onUndo?: (turn: Turn) => void;
  onRetry?: (turn: Turn) => void;
  afterTurn?: (turn: Turn) => ReactNode;
  onModule?: AssistantMessageProps["onModule"];
  cardProps?: (part: ViewPart, index: number) => ReturnType<NonNullable<AssistantMessageProps["cardProps"]>>;
}

interface TurnRowProps {
  turn: Turn;
  /** Kun sat, mens turens Fortryd tæller (og lige efter): ellers tegner urets tik ikke rækken igen. */
  now?: number;
  mobile?: boolean;
  currentId?: string;
  deps: string;
  handlers: Required<RowHandlers>;
  has: { undo: boolean; retry: boolean; after: boolean; module: boolean; card: boolean };
}

/** Én tur: brugerens boble, evt. meddelelsesrækken, Lassos svar og det, der står efter turen. */
const TurnRow = memo(function TurnRow({ turn, now, mobile, currentId, handlers, has }: TurnRowProps) {
  return (
    <div className="chat-turn">
      <UserBubble text={turn.question} />
      {turn.notice ? <NoticeRow notice={turn.notice} now={now} onUndo={has.undo ? () => handlers.onUndo(turn) : undefined} /> : null}
      {turn.notice?.kind === "moved" ? null : (
        <AssistantMessage
          answer={turn.answer}
          mobile={mobile}
          currentId={currentId}
          onModule={has.module ? handlers.onModule : undefined}
          onRetry={has.retry ? () => handlers.onRetry(turn) : undefined}
          cardProps={has.card ? handlers.cardProps : undefined}
        />
      )}
      {has.after ? handlers.afterTurn(turn) : null}
    </div>
  );
});

/** Fortryd-uret er kun relevant for en flyttet tur, mens vinduet er åbent (og et par sekunder efter, så den sidste tilstand tegnes). */
const nowFor = (turn: Turn, now: number | undefined): number | undefined =>
  now !== undefined && turn.notice?.kind === "moved" && turn.notice.undoUntil + 2000 > now ? now : undefined;

/**
 * Samtalen på en fane (role=log): ældste øverst, nyeste nederst. Hver tur er brugerens boble, evt. meddelelsesrækken
 * og Lassos svar; 20 px mellem beskeder og 28 px mellem ture. Lange samtaler tegnes fra enden; "Indlæser ældre
 * beskeder…" henter de forrige ind, når man ruller op, uden at det synlige flytter sig.
 */
export function Thread({ turns, now, onUndo, onRetry, afterTurn, pageSize = TURN_PAGE, rowKey, mobile, currentId, onModule, cardProps }: ThreadProps) {
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

  // De nyeste handlere; rækkerne får stabile funktioner, der kalder dem.
  const latest = useRef<RowHandlers>({});
  latest.current = { onUndo, onRetry, afterTurn, onModule, cardProps };
  const handlers = useMemo<Required<RowHandlers>>(
    () => ({
      onUndo: (turn) => latest.current.onUndo?.(turn),
      onRetry: (turn) => latest.current.onRetry?.(turn),
      afterTurn: (turn) => latest.current.afterTurn?.(turn) ?? null,
      onModule: (target, text) => latest.current.onModule?.(target, text),
      cardProps: (part, index) => latest.current.cardProps?.(part, index) ?? {},
    }),
    [],
  );
  const hasUndo = Boolean(onUndo);
  const hasRetry = Boolean(onRetry);
  const hasAfter = Boolean(afterTurn);
  const hasModule = Boolean(onModule);
  const hasCard = Boolean(cardProps);
  const has = useMemo(() => ({ undo: hasUndo, retry: hasRetry, after: hasAfter, module: hasModule, card: hasCard }), [hasUndo, hasRetry, hasAfter, hasModule, hasCard]);

  const observer = useRef<IntersectionObserver | null>(null);
  // Stabil (useCallback): ellers bygges IntersectionObserver om ved hver tegning.
  const loaderRef = useCallback((el: HTMLDivElement | null) => {
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
  }, [pageSize]);
  useEffect(() => () => observer.current?.disconnect(), []);

  return (
    <div className="chat-thread" ref={root} role="log" aria-live="polite" aria-label="Samtalen med Lasso">
      {hidden ? <OlderLoader loaderRef={loaderRef} /> : null}
      {visible.map((turn) => (
        <TurnRow key={turn.id} turn={turn} now={nowFor(turn, now)} mobile={mobile} currentId={currentId} deps={rowKey?.(turn) ?? ""} handlers={handlers} has={has} />
      ))}
    </div>
  );
}
