import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, IconButton, LassoMark } from "@lasso/ui";
import { parseBlocks, type Inline } from "../../chat/markdown.js";
import { P2Icon } from "../icons.js";
import { answerText, isPureText, type Answer, type Notice } from "../thread.js";
import { AnswerCard, type AnswerCardProps, type ViewPart } from "./AnswerCard.js";
import { hhmm, moduleIcon, type ModuleTarget } from "./util.js";

/**
 * Samtalens byggesten (docs/design/CHAT.md, Paper-eksporten docs/design/chat/chat-designguide.html): brugerens boble,
 * meddelelsesrækken, Lassos svar (avatar + tekst, modul-links, tænker, længere opgave, fejl, kort og tidspunkt).
 * Rene komponenter; stilen er chat.css under .p3 (importeres efter portal2.css af værten: Portal2App og designguiden).
 */

export type { ViewPart } from "./AnswerCard.js";

/** Lasso-mærket i en rund koral-lys flade: 24 px ved hvert svar, 40 px i tom tilstand. */
export function Avatar({ big = false }: { big?: boolean }) {
  return (
    <span className={`chat-avatar${big ? " chat-avatar--big" : ""}`} aria-hidden="true">
      <LassoMark className="chat-avatar__mark" />
    </span>
  );
}

/** Brugerens besked: til højre i en grå boble. */
export function UserBubble({ text }: { text: string }) {
  return (
    <div className="chat-msg chat-msg--user">
      <div className="chat-bubble">
        <span className="chat-sr">Du: </span>
        {text}
      </div>
    </div>
  );
}

/** Tekstlink i koral mørk (14/500): "Prøv igen", "Fortryd", "Se alle". */
export function TextLink({ children, onClick, className = "" }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button type="button" className={`chat-tlink${className ? ` ${className}` : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * Meddelelsesrækken i samtalen (centreret pille), kun når svaret flyttede: "Åbner X i en ny fane. Fortryd" (Fortryd i 10
 * sekunder; bagefter "Åbnede X i en ny fane"), "Svarer i fanen X" (en fane, der var åben), eller en fri tekst. Et svar,
 * der bliver på fanen, har ingen række (Jakob 03.10: ingen "Svarer her"-række).
 */
export function NoticeRow({ notice, text, now = Date.now(), onUndo }: { notice?: Notice; text?: string; now?: number; onUndo?: () => void }) {
  let body: ReactNode = text ?? "";
  if (notice?.kind === "moved") {
    const live = now < notice.undoUntil && onUndo;
    const where = notice.createdTab ? `${live ? "Åbner" : "Åbnede"} ${notice.name} i en ny fane` : `Svarer i fanen ${notice.name}`;
    body = live ? (
      <>
        {where}.{" "}
        <TextLink onClick={onUndo}>Fortryd</TextLink>
      </>
    ) : (
      where
    );
  }
  return (
    <div className="chat-notice" role="status">
      <span className="chat-notice__pill">
        <LassoMark className="chat-notice__mark" />
        <span>{body}</span>
      </span>
    </div>
  );
}

/** Tre orange prikker, der pulserer. */
function Dots() {
  return (
    <span className="chat-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/** Lasso tænker (før der er tekst eller et værktøj i gang). */
export function Thinking() {
  return (
    <div className="chat-think" role="status">
      <Dots />
      Tænker…
    </div>
  );
}

/** En længere opgave: hvad Lasso gør (værktøjets titel) og Stop. */
export function LongTask({ status, onStop }: { status: string; onStop?: () => void }) {
  return (
    <div className="chat-think" role="status">
      <Dots />
      {/* Statussen står som "Læser regnskab…" (eksporten): én ellipse direkte efter teksten. */}
      <span>{`${status.replace(/[\s.…]+$/, "")}…`}</span>
      {onStop ? (
        <Button size={32} className="chat-think__stop" onClick={onStop}>
          Stop
        </Button>
      ) : null}
    </div>
  );
}

/** Skelet af det kort, der er på vej (shimmer; stille ved prefers-reduced-motion). */
export function SkeletonCard() {
  return (
    <div className="chat-card chat-card--sk" aria-hidden="true">
      <div className="chat-card__h">
        <div className="chat-card__ht">
          <span className="lasso-skeleton chat-sk" style={{ width: 180 }} />
          <span className="lasso-skeleton chat-sk chat-sk--sub" style={{ width: 260 }} />
        </div>
      </div>
      <div className="chat-card__b">
        {["100%", "92%", "96%", "60%"].map((w) => (
          <span key={w} className="lasso-skeleton chat-sk" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}

/** Tidspunktet under et svar ("Lasso 09:41", ingen midterprik) og kopiér-ikonet, kun under rene tekstsvar. */
export function Meta({ at, copyText }: { at: number; copyText?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText ?? "");
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Uden udklipsholder (http, rettigheder) sker der intet.
    }
  };
  return (
    <div className="chat-meta">
      <span>
        <span>Lasso</span> <span>{hhmm(at)}</span>
      </span>
      {copyText !== undefined ? (
        <IconButton icon={copied ? "check" : "copy"} label={copied ? "Kopieret" : "Kopiér svaret"} size={32} variant="bare" className="chat-meta__copy" onClick={() => void copy()} />
      ) : null}
    </div>
  );
}

type ModuleItem = Extract<Inline, { kind: "module" }>;

/**
 * Modul-links under teksten: 46 px, radius 12, 1 px kant, koral ikon. Et link til et andet firma eller en anden person
 * får noten "Åbner X i ny fane" ved siden af.
 */
export function ModuleLinks({ items, currentId, onOpen }: { items: readonly ModuleItem[]; currentId?: string; onOpen?: (target: ModuleTarget, text: string) => void }) {
  return (
    <div className="chat-links">
      {items.map((m, i) => {
        const other = m.target.kind !== "modul" && m.target.id !== currentId;
        return (
          <span className="chat-links__wrap" key={i}>
            <button type="button" className="chat-link" onClick={() => onOpen?.(m.target, m.text)}>
              <P2Icon name={moduleIcon(m.target)} />
              {m.text}
            </button>
            {other ? <span className="chat-links__note">Åbner {m.text} i ny fane</span> : null}
          </span>
        );
      })}
    </div>
  );
}

function InlineParts({ parts, onOpen }: { parts: Inline[]; onOpen?: (target: ModuleTarget, text: string) => void }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "bold" ? (
          <b key={i}>{p.text}</b>
        ) : p.kind === "link" ? (
          <a key={i} className="chat-a" href={p.href} target="_blank" rel="noopener noreferrer">
            {p.text}
          </a>
        ) : p.kind === "module" ? (
          // Et link i teksten har tekstens farve og kun en understregning (Jakob 03.10); pillerne står for sig.
          <button key={i} type="button" className="chat-ilink" onClick={() => onOpen?.(p.target, p.text)}>
            {p.text}
          </button>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Svarets tekst: afsnit (8 px imellem), punkter med 6 px prik, **fed** i 500 og modul-links som række nederst. */
export function AnswerText({ text, currentId, onOpen, after }: { text: string; currentId?: string; onOpen?: (target: ModuleTarget, text: string) => void; after?: ReactNode }) {
  return (
    <div className="chat-body">
      {parseBlocks(text).map((b, i) =>
        b.kind === "links" ? (
          <ModuleLinks key={i} items={b.items} currentId={currentId} onOpen={onOpen} />
        ) : b.kind === "ul" ? (
          <Fragment key={i}>
            {b.items.map((item, k) => (
              <div className="chat-brow" key={k}>
                <span>
                  <InlineParts parts={item} onOpen={onOpen} />
                </span>
              </div>
            ))}
          </Fragment>
        ) : (
          <p key={i}>
            {b.lines.map((line, k) => (
              <Fragment key={k}>
                {k > 0 ? <br /> : null}
                <InlineParts parts={line} onOpen={onOpen} />
              </Fragment>
            ))}
          </p>
        ),
      )}
      {after}
    </div>
  );
}

/** Kopiér står kun under rene tekstsvar: ingen visning, menu eller fejl, og heller ingen modul-links (eksporten, afsnit 02). */
function copyable(a: Answer): boolean {
  return isPureText(a) && a.parts.every((p) => p.kind !== "text" || !/\]\(lasso:/.test(p.text));
}

/** Teksten til udklipsholderen uden markdown: **fed** og links som deres tekst. */
function plainText(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export interface AssistantMessageProps {
  answer: Answer;
  mobile?: boolean;
  /** Fanens firma eller person: et link dertil får ingen "ny fane"-note. */
  currentId?: string;
  onModule?: (target: ModuleTarget, text: string) => void;
  onRetry?: () => void;
  onStop?: () => void;
  /** Handlingerne på et kort (hent, fuld skærm, tilføj som fane, visningens egne handlinger). */
  cardProps?: (part: ViewPart, index: number) => Partial<AnswerCardProps>;
}

/**
 * Lassos svar: avatar og den første tekst (eller tænker/længere opgave), derefter kortene i fuld trådbredde og
 * evt. tekst efter dem, fejl med "Prøv igen", og til sidst tidspunktet (kopiér kun under rene tekstsvar).
 */
export function AssistantMessage({ answer, mobile = false, currentId, onModule, onRetry, onStop, cardProps }: AssistantMessageProps) {
  const parts = answer.parts;
  const first = parts[0]?.kind === "text" ? parts[0].text : null;
  const rest = first !== null ? parts.slice(1) : parts;
  const hasView = parts.some((p) => p.kind === "view");
  // Stop: en stille linje uden "Prøv igen" (brugeren valgte selv at stoppe).
  const errorEl = answer.stopped && !answer.error ? (
    <p className="chat-stopped">Stoppet.</p>
  ) : answer.error ? (
    <p className="chat-error">
      {answer.error}
      {onRetry ? (
        <>
          {" "}
          <TextLink onClick={onRetry}>Prøv igen</TextLink>
        </>
      ) : null}
    </p>
  ) : null;
  const working = answer.pending ? answer.status ? <LongTask status={answer.status} onStop={onStop} /> : first === null ? <Thinking /> : null : null;
  const textAt = (text: string, after?: ReactNode) => <AnswerText text={text} currentId={currentId} onOpen={onModule} after={after} />;
  // Fejl og arbejde står i avatar-rækken, når der ikke er kommet andet endnu; ellers efter det sidste.
  const tailInRow = rest.length === 0;
  // Uden tekst først (en visning kom før teksten) står kortet uden en tom avatar-række.
  const rowEmpty = first === null && !(tailInRow && (errorEl || working));
  return (
    <>
      {rowEmpty ? (
        <span className="chat-sr">Lasso: </span>
      ) : (
        <div className="chat-msg chat-msg--ai">
          <Avatar />
          <div className="chat-ai">
            <span className="chat-sr">Lasso: </span>
            {first !== null ? textAt(first, tailInRow ? errorEl : null) : tailInRow && errorEl ? <div className="chat-body">{errorEl}</div> : null}
            {tailInRow ? working : null}
          </div>
        </div>
      )}
      {rest.map((p, i) =>
        p.kind === "view" ? (
          <AnswerCard key={`v${i}`} part={p} mobile={mobile} {...cardProps?.(p, i)} />
        ) : (
          <div className="chat-after" key={`t${i}`}>
            {textAt(p.text)}
          </div>
        ),
      )}
      {!tailInRow && (errorEl || working) ? (
        <div className="chat-after">
          {errorEl ? <div className="chat-body">{errorEl}</div> : null}
          {working}
        </div>
      ) : null}
      {answer.pending && answer.status && !hasView ? <SkeletonCard /> : null}
      {!answer.pending && !answer.choice && answer.at && (parts.length || answer.error) ? <Meta at={answer.at} copyText={copyable(answer) ? plainText(answerText(answer)) : undefined} /> : null}
    </>
  );
}
