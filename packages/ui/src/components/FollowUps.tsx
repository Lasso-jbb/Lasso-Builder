import type { ViewAction } from "../types.js";

/**
 * Opfølgningsknapper / genveje: sender et spørgsmål til modellen som brugerens næste besked.
 * Sekundære knapper i én række, der ombrydes på desktop. Mobil (26a, "Genveje"): én vandret række,
 * der ruller med fade i højre kant i stedet for at ombryde.
 */
export function FollowUps({ prompts, onAction, enabled }: { prompts: readonly { label: string; prompt: string }[]; onAction: (a: ViewAction) => void; enabled: boolean }) {
  if (!enabled) return null;
  return (
    <div className="lasso-span-2 lasso-followups" role="group" aria-label="Genveje">
      {prompts.map((p) => (
        <button key={p.label} type="button" className="lasso-btn lasso-btn--prompt" onClick={() => onAction({ kind: "prompt", prompt: p.prompt })}>
          {p.label} →
        </button>
      ))}
    </div>
  );
}
