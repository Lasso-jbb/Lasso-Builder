import { Icon } from "./Icon.js";

/**
 * Designregel 12 (Jakob 30.09): to former for "mere".
 * - En liste eller folder, der folder sig ud på stedet: ExpandLink, koralt link "Vis alle N ›" og "Vis færre ˄".
 * - En ny prompt eller en anden visning (fane, fokus, spørgsmål til Claude): PromptLink, knap med kant og "→"
 *   som de opfølgende spørgsmål (LassoFollowUps).
 */
export function ExpandLink({ expanded, total, onToggle, className = "" }: { expanded: boolean; total?: number; onToggle: () => void; className?: string }) {
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
