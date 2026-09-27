import type { ReactNode } from "react";

/**
 * Modulværktøjslinjen (katalog 06 og 30): valgfri 56 px linje under modulbjælken med tynd linje
 * under. Primær handling som sekundær knap (hvid, tynd kant) yderst til venstre, evt. flere
 * handlinger som tekstknapper efter den, og visningsvalg (Tabs niveau 3 / segment) yderst til
 * højre. Udelades helt, når modulet ingen handlinger har: tegn den ikke i stedet for at vise
 * den tom.
 */
export interface ToolbarAction {
  id?: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export interface ModuleToolbarProps {
  /** Et felt yderst til venstre før den primære handling, fx portalens søgefelt. Fylder resten af linjen. */
  field?: ReactNode;
  /** Modulets primære handling, fx "Tilføj kriterium" eller "Ny liste". */
  primary?: ToolbarAction;
  /** Flere handlinger som tekstknapper efter den primære. */
  secondary?: readonly ToolbarAction[];
  /** Visningsvalg yderst til højre, typisk <Tabs level={3}>. */
  controls?: ReactNode;
  className?: string;
}

export function ModuleToolbar({ field, primary, secondary = [], controls, className = "" }: ModuleToolbarProps) {
  if (!field && !primary && secondary.length === 0 && !controls) return null;
  return (
    <div className={`lasso-toolbar ${field ? "lasso-toolbar--field" : ""} ${className}`}>
      <div className="lasso-toolbar__actions">
        {field ? <div className="lasso-toolbar__field">{field}</div> : null}
        {primary ? (
          <button type="button" className="lasso-btn lasso-toolbar__primary" onClick={primary.onClick} disabled={primary.disabled}>
            {primary.icon}
            {primary.label}
          </button>
        ) : null}
        {secondary.map((a, i) => (
          <button key={a.id ?? i} type="button" className="lasso-btn lasso-btn--ghost" onClick={a.onClick} disabled={a.disabled}>
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
      {controls ? <div className="lasso-toolbar__controls">{controls}</div> : null}
    </div>
  );
}
