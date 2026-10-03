import { P2Icon } from "../icons.js";
import { Avatar } from "./Message.js";

export type EmptyKind = "company" | "person" | "global";

/** Den fjerde pille pr. fanetype (de tre første er fanens forslag). */
export const EMPTY_EXTRA: Record<EmptyKind, string> = {
  company: "Lav et fuldt KYC-overblik",
  person: "Vis netværket",
  global: "Sammenlign de største",
};

export const EMPTY_HELP: Record<EmptyKind, string> = {
  company: "Jeg kender regnskab, ejere, ledelse, risiko og historik. Spørg frit, eller start med et af forslagene.",
  person: "Jeg kender roller, ejerskab, netværk, risiko og historik. Spørg frit, eller start med et af forslagene.",
  global: "Jeg kan finde, sammenligne og analysere virksomheder og personer. Spørg frit, eller start med et af forslagene.",
};

/** Pillerne i tom tilstand: fanens tre forslag og den fjerde pr. fanetype. */
export function emptyPills(kind: EmptyKind, suggestions: readonly string[]): string[] {
  return [...suggestions.slice(0, 3), EMPTY_EXTRA[kind]];
}

/**
 * Tom tilstand: hilsen med fanens navn ("Spørg Lasso om LASSO X A/S"), hjælpelinjen og forslagene som piller med
 * pil (2 × 2, 720 px; én kolonne på mobil). Forslagene under feltet vises ikke samtidig.
 */
export function EmptyState({ name, kind, suggestions, disabled = false, onPick }: { name: string; kind: EmptyKind; suggestions: readonly string[]; disabled?: boolean; onPick?: (s: string) => void }) {
  return (
    <div className="chat-empty">
      <Avatar big />
      <h2 className="chat-empty__t">Spørg Lasso om {name}</h2>
      <p className="chat-empty__l">{EMPTY_HELP[kind]}</p>
      <div className="chat-empty__pills">
        {emptyPills(kind, suggestions).map((s) => (
          <button key={s} type="button" className="chat-spill" disabled={disabled} onClick={() => onPick?.(s)}>
            <span>{s}</span>
            <P2Icon name="arrow-right" />
          </button>
        ))}
      </div>
    </div>
  );
}
