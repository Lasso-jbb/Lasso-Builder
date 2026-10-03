import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button, IconButton } from "@lasso/ui";
import type { PendingChoice } from "./model.js";
import { choiceKey, choiceSend, defaultChoiceSelection, type ChoiceSelection } from "./model.js";
import type { ChoicePick } from "../chat/stream.js";

/**
 * Afklaringen over spørgefeltet (docs/chat.md, Paper-eksporten afsnit 08): spørgsmålet med fold sammen og ×, rækker
 * med kun titel og beskrivelse (det anbefalede først med "(Anbefalet)"), "Andet" med "Skriv dit eget svar her", og
 * "Spring over" og "Vælg" nederst til højre. Enkeltvalg som radiogruppe: pil op/ned flytter, 1–9 er skjulte genveje,
 * Cmd/Ctrl+Enter vælger, Esc springer over. variant "sheet" er arket fra bunden på telefonen.
 */
export function ChoicePanel({
  choice,
  disabled,
  variant = "panel",
  onSend,
  onSkip,
}: {
  choice: PendingChoice;
  disabled: boolean;
  variant?: "panel" | "sheet";
  onSend: (message: string, pick: ChoicePick) => void;
  onSkip: () => void;
}) {
  const [selection, setSelection] = useState<ChoiceSelection>(() => defaultChoiceSelection(choice));
  const [other, setOther] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const otherInput = useRef<HTMLInputElement>(null);
  const state = useRef({ selection, other, disabled, collapsed });
  state.current = { selection, other, disabled, collapsed };
  const free = choice.allowFreeText !== false;
  const count = choice.options.length + (free ? 1 : 0);

  // Ny menu: forvalg og tom Andet.
  useEffect(() => {
    setSelection(defaultChoiceSelection(choice));
    setOther("");
    setCollapsed(false);
  }, [choice.id]);

  const send = () => {
    const s = state.current;
    if (s.disabled) return;
    const m = choiceSend(choice, s.selection, s.other);
    if (m) onSend(m.message, m.pick);
  };

  const pick = (sel: ChoiceSelection, focus = false) => {
    setSelection(sel);
    if (sel === "other") setTimeout(() => otherInput.current?.focus(), 0);
    else if (focus) setTimeout(() => root.current?.querySelector<HTMLElement>(`[data-choice="${sel}"]`)?.focus(), 0);
  };

  useEffect(() => {
    // Genveje: i panelet alle taster; uden for felter på siden kun tal. Foldet sammen reagerer panelet ikke (intet skjult sendes).
    const onKey = (e: KeyboardEvent) => {
      if (state.current.collapsed) return;
      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName ?? "").toLowerCase();
      const inField = tag === "input" || tag === "textarea";
      const mine = root.current?.contains(t) ?? false;
      if (!mine && t && t !== document.body) return;
      const k = choiceKey(e, choice, inField, mine ? "panel" : "body", mine && t === otherInput.current);
      if (!k) return;
      e.preventDefault();
      if (k.kind === "send") send();
      else if (k.kind === "skip") onSkip();
      else pick(k.selection, mine);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice.id]);

  /** Pil op/ned i radiogruppen flytter valget (og fokus) som i en almindelig radiogruppe. */
  const onRowKey = (e: ReactKeyboardEvent, index: number) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== " ") return;
    e.preventDefault();
    if (e.key === " ") return pick(index === choice.options.length ? "other" : index);
    const next = (index + (e.key === "ArrowDown" ? 1 : -1) + count) % count;
    pick(next === choice.options.length ? "other" : next, true);
  };

  const canSend = !disabled && choiceSend(choice, selection, other) !== null;
  return (
    <div className={`chat-choice${variant === "sheet" ? " chat-choice--sheet" : ""}`} ref={root} role="group" aria-labelledby={`choice-${choice.id}`}>
      <div className="chat-choice__h">
        <span className="chat-choice__t" id={`choice-${choice.id}`}>
          {choice.question}
        </span>
        <span className="chat-choice__icons">
          <IconButton icon={collapsed ? "chevron-up" : "chevron-down"} label={collapsed ? "Fold ud" : "Fold sammen"} size={32} variant="bare" expanded={!collapsed} onClick={() => setCollapsed((c) => !c)} />
          <IconButton icon="close" label="Luk (spring over)" size={32} variant="bare" onClick={onSkip} />
        </span>
      </div>
      {collapsed ? null : (
        <>
          <div className="chat-choice__rows" role="radiogroup" aria-labelledby={`choice-${choice.id}`}>
            {choice.options.map((o, i) => (
              <div
                key={i}
                className="chat-crow"
                role="radio"
                data-choice={i}
                aria-checked={selection === i}
                aria-disabled={disabled || undefined}
                tabIndex={selection === i ? 0 : -1}
                onClick={() => !disabled && pick(i)}
                onKeyDown={(e) => onRowKey(e, i)}
              >
                <div className="chat-crow__t">
                  {o.label}
                  {o.recommended ? <span className="chat-crow__rec"> (Anbefalet)</span> : null}
                </div>
                {o.description ? <div className="chat-crow__d">{o.description}</div> : null}
              </div>
            ))}
            {free ? (
              <div
                className="chat-crow"
                role="radio"
                data-choice="other"
                aria-checked={selection === "other"}
                tabIndex={selection === "other" ? 0 : -1}
                onClick={() => !disabled && pick("other")}
                onKeyDown={(e) => e.target === e.currentTarget && onRowKey(e, choice.options.length)}
              >
                <div className="chat-crow__t">Andet</div>
                <input
                  ref={otherInput}
                  className="chat-crow__field"
                  type="text"
                  value={other}
                  disabled={disabled}
                  placeholder="Skriv dit eget svar her"
                  aria-label="Andet: skriv dit eget svar"
                  onFocus={() => setSelection("other")}
                  onChange={(e) => {
                    setOther(e.target.value);
                    setSelection("other");
                  }}
                />
              </div>
            ) : null}
          </div>
          <div className="chat-choice__f">
            <Button onClick={onSkip}>Spring over</Button>
            <Button variant="primary" disabled={!canSend} onClick={send}>
              Vælg
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
