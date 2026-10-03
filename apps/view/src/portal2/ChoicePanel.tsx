import { useEffect, useRef, useState } from "react";
import type { PendingChoice } from "./model.js";
import { choiceKey, choiceSend, defaultChoiceSelection, type ChoiceSelection } from "./model.js";
import type { ChoicePick } from "../chat/stream.js";

/**
 * Valgpanelet over spørgefeltet (docs/chat.md): spørgsmålet, punkter med titel, beskrivelse og nummer (det
 * anbefalede først), "Andet" med et tekstfelt i panelet, "Spring over" og "Send". Foreløbig uden styling (designet
 * laves i Paper); funktionen er det, der tæller: enkeltvalg, tal 1–9, Cmd/Ctrl+Enter sender, Esc springer over.
 */
export function ChoicePanel({ choice, disabled, onSend, onSkip }: { choice: PendingChoice; disabled: boolean; onSend: (message: string, pick: ChoicePick) => void; onSkip: () => void }) {
  const [selection, setSelection] = useState<ChoiceSelection>(() => defaultChoiceSelection(choice));
  const [other, setOther] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const otherInput = useRef<HTMLInputElement>(null);
  const state = useRef({ selection, other, disabled });
  state.current = { selection, other, disabled };

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

  useEffect(() => {
    // Genveje, når fokus står i panelet eller ingen steder (ikke i spørgefeltet, hvor tal og Esc er almindelig tekst).
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = (t?.tagName ?? "").toLowerCase();
      const inField = tag === "input" || tag === "textarea";
      const mine = root.current?.contains(t) ?? false;
      if (!mine && t && t !== document.body) return;
      const k = choiceKey(e, choice, inField);
      if (!k) return;
      e.preventDefault();
      if (k.kind === "send") send();
      else if (k.kind === "skip") onSkip();
      else {
        setSelection(k.selection);
        if (k.selection === "other") setTimeout(() => otherInput.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice.id]);

  const canSend = !disabled && choiceSend(choice, selection, other) !== null;
  return (
    <div className="choicepanel" ref={root} role="group" aria-label={choice.question}>
      <div className="choicepanel__head">
        <strong>{choice.question}</strong>
        <button type="button" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed} aria-label={collapsed ? "Fold ud" : "Fold sammen"}>
          {collapsed ? "▴" : "▾"}
        </button>
        <button type="button" onClick={onSkip} aria-label="Luk (spring over)">
          ×
        </button>
      </div>
      {collapsed ? null : (
        <>
          <ol className="choicepanel__list">
            {choice.options.map((o, i) => (
              <li key={i}>
                <button type="button" aria-pressed={selection === i} disabled={disabled} onClick={() => setSelection(i)}>
                  <span>{i + 1}.</span> <strong>{o.label}</strong>
                  {o.recommended ? <em> (anbefalet)</em> : null}
                  <div>{o.description}</div>
                </button>
              </li>
            ))}
            {choice.allowFreeText !== false ? (
              <li>
                <span>{choice.options.length + 1}.</span> Andet{" "}
                <input
                  ref={otherInput}
                  type="text"
                  value={other}
                  disabled={disabled}
                  placeholder="Skriv selv"
                  onFocus={() => setSelection("other")}
                  onChange={(e) => {
                    setOther(e.target.value);
                    setSelection("other");
                  }}
                />
              </li>
            ) : null}
          </ol>
          <div className="choicepanel__foot">
            <button type="button" onClick={onSkip}>
              Spring over
            </button>
            <button type="button" disabled={!canSend} onClick={send}>
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}
