import { Icon } from "./Icon.js";
import { usePrintMode } from "../print.js";

/**
 * Global regel for "Vis alle" (Jakob 01.10): en liste foldes først, når der er over 6; så står 5 og "Vis alle N".
 * Med 6 eller færre står alle. Generelt: der foldes kun, når mindst to er skjult (aldrig "Vis alle" for én mere).
 */
export const LIST_FOLD = 5;
export function foldedCount(total: number, limit: number = LIST_FOLD): number {
  return total > limit + 1 ? limit : total;
}

/**
 * Designregel 12 (Jakob 30.09): to former for "mere".
 * - En liste eller folder, der folder sig ud på stedet: ExpandLink, koralt link "Vis alle N ›" og "Vis færre ˄".
 * - En ny prompt eller en anden visning (fane, fokus, spørgsmål til Claude): PromptLink, knap med kant og "→"
 *   som de opfølgende spørgsmål (LassoFollowUps).
 */
export function ExpandLink({ expanded, total, onToggle, className = "" }: { expanded: boolean; total?: number; onToggle: () => void; className?: string }) {
  // Print (Jakob 01.10): alt er foldet ud, og der er ingen knapper.
  if (usePrintMode()) return null;
  return (
    <button type="button" className={`lasso-link lasso-expand ${className}`.trim()} aria-expanded={expanded} onClick={onToggle}>
      {expanded ? "Vis færre" : total !== undefined ? `Vis alle ${total}` : "Vis alle"}
      <Icon name={expanded ? "chevron-up" : "chevron-right"} size={14} />
    </button>
  );
}

/** Åbner en anden visning eller sender en ny prompt: knap med kant og "→" (samme form som LassoFollowUps). */
export function PromptLink({ label, onClick, className = "" }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" className={`lasso-btn lasso-btn--prompt lasso-promptlink ${className}`.trim()} onClick={onClick}>
      {label} →
    </button>
  );
}
