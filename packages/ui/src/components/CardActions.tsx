import type { ReactNode } from "react";
import { LassoMark } from "../LassoMark.js";
import { IconButton } from "./Button.js";
import { Icon, type IconName } from "./Icon.js";

/**
 * Handlingerne i et korts hoved (Jakob 03.10): [download] [fuld skærm] [primær pille]. Samme komponent i portalens
 * chatkort ("Tilføj som fane") og i MCP-appen i Claude.ai ("Åben i Lasso"), så knapperne er ens begge steder.
 * Målene er Paper "Lasso - Marketplace" BW7-0 (Jakob 03.10): ikonknapper 40 × 40 og faneknappen (TabButton) 40 høj,
 * radius 10, ikoner 18 px med streg 1,5. compact (telefon): ingen download, og faneknappen bliver en ikonknap med det
 * koral ikon og navnet som aria-label.
 */
export interface CardPrimaryAction {
  label: string;
  /** Ikonet foran teksten; standard er faneknappens bogmærke med plus. "mark" = Lasso-mærket. */
  icon?: IconName | "mark";
  onClick: () => void;
  busy?: boolean;
}

/**
 * Faneknappen (Paper "Lasso - Marketplace" BW7-0, Jakob 03.10): ALLE knapper, der åbner en fane ("Tilføj som fane",
 * "Åben i Lasso"), er denne knap. 40 px høj, 1 px kant, radius 10, polstring 14/16, 8 px mellemrum; koral bogmærke
 * med plus (18 px, streg 1,5) og teksten 13/18, 600 i tekstfarven.
 */
export function TabButton({ label, icon = "bookmark-plus", onClick, busy, className = "" }: { label: string; icon?: CardPrimaryAction["icon"]; onClick: () => void; busy?: boolean; className?: string }) {
  return (
    <button type="button" className={`lasso-tabbtn${className ? ` ${className}` : ""}`} disabled={busy} aria-busy={busy || undefined} onClick={onClick}>
      <PrimaryIcon icon={icon} size={18} />
      <span>{label}</span>
    </button>
  );
}

export interface CardActionsProps {
  onDownload?: () => void;
  downloadLabel?: string;
  onFullscreen?: () => void;
  fullscreenLabel?: string;
  primary?: CardPrimaryAction;
  compact?: boolean;
  className?: string;
}

function PrimaryIcon({ icon = "bookmark-plus", size }: { icon?: CardPrimaryAction["icon"]; size: number }): ReactNode {
  return icon === "mark" ? (
    <span className="lasso-cardact__markwrap" aria-hidden="true">
      <LassoMark className="lasso-cardact__mark" />
    </span>
  ) : (
    <Icon name={icon} size={size} className="lasso-cardact__icon" />
  );
}

export function CardActions({ onDownload, downloadLabel = "Hent som PDF", onFullscreen, fullscreenLabel = "Vis i fuld skærm", primary, compact = false, className = "" }: CardActionsProps) {
  if (!onDownload && !onFullscreen && !primary) return null;
  return (
    <div className={`lasso-cardact${compact ? " lasso-cardact--compact" : ""}${className ? ` ${className}` : ""}`}>
      {primary && compact ? (
        <button type="button" className="lasso-iconbtn lasso-iconbtn--sq lasso-iconbtn--38 lasso-cardact__primarym" aria-label={primary.label} title={primary.label} disabled={primary.busy} onClick={primary.onClick}>
          <PrimaryIcon icon={primary.icon} size={18} />
        </button>
      ) : null}
      {!compact && onDownload ? <IconButton icon="download" label={downloadLabel} size={38} onClick={onDownload} /> : null}
      {onFullscreen ? <IconButton icon="fullscreen" label={fullscreenLabel} size={38} onClick={onFullscreen} /> : null}
      {primary && !compact ? (
        <TabButton label={primary.label} icon={primary.icon} onClick={primary.onClick} busy={primary.busy} />
      ) : null}
    </div>
  );
}
