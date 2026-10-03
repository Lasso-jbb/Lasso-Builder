import type { ReactNode } from "react";
import { LassoMark } from "../LassoMark.js";
import { buttonClass, IconButton } from "./Button.js";
import { Icon, type IconName } from "./Icon.js";

/**
 * Handlingerne i et korts hoved (Jakob 03.10): [download] [fuld skærm] [primær pille]. Samme komponent i portalens
 * chatkort ("Tilføj som fane") og i MCP-appen i Claude.ai ("Åben i Lasso"), så knapperne er ens begge steder.
 * Ikonknapperne er IconButton 32; pillen er en sekundær Button 36 (samme skrift: 14/18, 500, knapfarven) med
 * modul-linkets form (radius 12) og et koral ikon på 18 px eller Lasso-mærket. compact (telefon): ingen download, og
 * pillen bliver en ikonknap med det koral ikon og navnet som aria-label.
 */
export interface CardPrimaryAction {
  label: string;
  /** Ikonet foran teksten; "mark" = Lasso-mærket. */
  icon: IconName | "mark";
  onClick: () => void;
  busy?: boolean;
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

function PrimaryIcon({ icon, size }: { icon: CardPrimaryAction["icon"]; size: number }): ReactNode {
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
        <button type="button" className="lasso-iconbtn lasso-iconbtn--sq lasso-iconbtn--32 lasso-cardact__primarym" aria-label={primary.label} title={primary.label} disabled={primary.busy} onClick={primary.onClick}>
          <PrimaryIcon icon={primary.icon} size={16} />
        </button>
      ) : null}
      {!compact && onDownload ? <IconButton icon="download" label={downloadLabel} size={32} onClick={onDownload} /> : null}
      {onFullscreen ? <IconButton icon="fullscreen" label={fullscreenLabel} size={32} onClick={onFullscreen} /> : null}
      {primary && !compact ? (
        <button type="button" className={buttonClass("secondary", 36, "lasso-cardact__primary")} disabled={primary.busy} aria-busy={primary.busy || undefined} onClick={primary.onClick}>
          <PrimaryIcon icon={primary.icon} size={18} />
          <span>{primary.label}</span>
        </button>
      ) : null}
    </div>
  );
}
