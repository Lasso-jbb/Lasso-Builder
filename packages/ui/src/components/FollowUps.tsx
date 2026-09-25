import type { ViewAction } from "../types.js";

/** Opfølgningsknapper: sender et spørgsmål til modellen som brugerens næste besked. */
export function FollowUps({ prompts, onAction, enabled }: { prompts: readonly { label: string; prompt: string }[]; onAction: (a: ViewAction) => void; enabled: boolean }) {
  if (!enabled) return null;
  return (
    <div className="lasso-span-2" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {prompts.map((p) => (
        <button key={p.label} className="lasso-btn lasso-btn--prompt" onClick={() => onAction({ kind: "prompt", prompt: p.prompt })}>
          {p.label} →
        </button>
      ))}
    </div>
  );
}
