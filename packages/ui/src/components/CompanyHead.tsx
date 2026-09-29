import type { ReactNode } from "react";
import { formatDate, formatNumber, type CompanyVM, type HeadVariant, type ObservationsVM } from "@lasso/spec";
import { DataState, stateForError } from "../primitives.js";
import { HeadActions, hasHeadActions, type HeadActionsProps } from "./HeadActions.js";
import { companyRiskSummary, HeadRiskLine } from "./HeadRisk.js";

/** Ophørt (ikke konkurs/likvidation): navnet dæmpes, ingen Overvåg, handlingen er "Se historik" (08.1). */
function isCeased(c: CompanyVM): boolean {
  return c.statusKind === "inactive" || /ophørt|opløst|slettet/i.test(c.status ?? "");
}

/** "Under konkurs" + dato -> "Under konkurs, siden 03.06.2026"; "Ophørt" + dato -> "Ophørt 30.09.2024". */
export function companyStatusText(c: CompanyVM): string | undefined {
  if (!c.status) return undefined;
  if (!c.statusDate) return c.status;
  return c.statusKind === "warning" ? `${c.status}, siden ${formatDate(c.statusDate)}` : `${c.status} ${formatDate(c.statusDate)}`;
}

/**
 * Faktalinjen (08.1): CVR, form, stiftet, adresse, kurator, branche; adskilt med komma. Ansatte står
 * ikke i sidens hoved (Paper 08.1), men i nøgle-værdi-listen; kompakt og linje har dem.
 */
export function companyFactsLine(c: CompanyVM, variant: HeadVariant = "full"): string[] {
  const a = c.address;
  const curator = c.curator ? `${/likvidation/i.test(c.status ?? "") ? "likvidator" : "kurator"}: ${c.curator}` : null;
  // Kun et tal: null/undefined (ikke oplyst, fx en enkeltmandsvirksomhed) må ikke blive "— ansatte".
  const employees = typeof c.employees === "number" ? `${formatNumber(c.employees)} ansatte` : null;
  if (variant !== "full") {
    // Kompakt og linje: CVR, by, ansatte (Paper 08.1 "CVR 34580820, København K, 17 ansatte").
    return [c.cvr ? `CVR ${c.cvr}` : null, a?.city ?? null, curator, c.statusKind === "inactive" ? null : employees].filter((f): f is string => Boolean(f));
  }
  return [
    c.cvr ? `CVR ${c.cvr}` : null,
    c.form ?? null,
    c.founded ? `stiftet ${formatDate(c.founded)}` : null,
    a?.street ?? null,
    [a?.zip, a?.city].filter(Boolean).join(" ") || null,
    curator,
    c.industryText ?? null,
  ].filter((f): f is string => Boolean(f));
}

export interface CompanyHeadProps {
  company?: CompanyVM;
  error?: string;
  /** 'full' (standard) sidens hoved; 'compact' 56 px (sidepanel, sammenligning); 'line' 40 px (svarniveau A/B). */
  variant?: HeadVariant;
  /** Ikonknapperne øverst til højre (Overvåg, Gem, Eksportér, Flere). Ophørt: kun "Se historik". */
  actions?: HeadActionsProps;
  /** Observationer: "Se risiko"-linjen vises under faktalinjen ved mindst én på 50+. */
  risk?: ObservationsVM;
  /** Klik på "Se risiko" (værten åbner risikosektionen). Uden: linjen står uden link. */
  onSeeRisk?: () => void;
  /** Ophørt: "Se historik" (værten åbner historikken). */
  onHistory?: () => void;
  /** Sektionsfaner (08.2) eller andet, der hører til hovedet og står under faktalinjen. */
  below?: ReactNode;
}

/**
 * Virksomhedshoved (katalog 08.1). Ingen kortramme, kun linjen under. Navn 28/600, status som ren
 * tekst 14/500 lige efter navnet (konkurs/likvidation i mørk rød med dato, ophørt navn i
 * text-secondary), binavn i muted efter status, nøglefakta som én linje adskilt med komma (kurator
 * ved konkurs). Handlinger som 32 px ikonknapper øverst til højre. "Se risiko"-linjen ved 50+.
 */
export function CompanyHead({ company, error, variant = "full", actions, risk, onSeeRisk, onHistory, below }: CompanyHeadProps) {
  if (!company) {
    const height = variant === "line" ? 40 : variant === "compact" ? 56 : 92;
    if (!error) return <div className="lasso-span-full"><DataState state="loading" lines={variant === "full" ? 2 : 1} height={height} /></div>;
    return (
      <div className="lasso-span-full">
        <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} />
      </div>
    );
  }

  const kind = company.statusKind ?? "active";
  const ceased = isCeased(company);
  // Ophørt (08.8): kun handlingen "Se historik", ingen Overvåg og ingen ikonknapper.
  const acts: HeadActionsProps | undefined = ceased
    ? { context: actions?.context, history: onHistory ?? actions?.history }
    : actions;
  const status = companyStatusText(company);
  const alias = company.secondaryNames?.find((n) => n && n !== company.name);
  const facts = companyFactsLine(company, variant);

  if (variant === "line") {
    return (
      <header className={`lasso-headline lasso-span-full lasso-company--${kind}${ceased ? " is-ceased" : ""}`}>
        <h2 className="lasso-headline__name">{company.name}</h2>
        {status ? <span className={`lasso-company__status lasso-company__status--${kind}`}>{status}</span> : null}
        {facts.length > 0 ? <span className="lasso-headline__facts">{facts.join(", ")}</span> : null}
      </header>
    );
  }

  if (variant === "compact") {
    const compactActs: HeadActionsProps | undefined = acts ? { monitor: acts.monitor, history: acts.history, context: acts.context } : undefined;
    return (
      <header className={`lasso-headcompact lasso-span-full lasso-company--${kind}${ceased ? " is-ceased" : ""}`}>
        <div className="lasso-headcompact__main">
          <div className="lasso-headcompact__title">
            <h2 className="lasso-headcompact__name">{company.name}</h2>
            {status && kind !== "active" ? <span className={`lasso-headcompact__status lasso-company__status--${kind}`}>{status}</span> : null}
          </div>
          {facts.length > 0 ? <p className="lasso-headcompact__facts">{facts.join(", ")}</p> : null}
        </div>
        {hasHeadActions(compactActs) ? <HeadActions {...compactActs!} /> : null}
      </header>
    );
  }

  const summary = companyRiskSummary(risk);
  const showActions = hasHeadActions(acts);
  return (
    <header className={`lasso-company lasso-span-full lasso-company--${kind}${showActions ? " lasso-company--actions" : ""}`}>
      <div className="lasso-company__title">
        <h2 className="lasso-company__name">{company.name}</h2>
        {status ? <span className={`lasso-company__status lasso-company__status--${kind}`}>{status}</span> : null}
        {alias ? <span className="lasso-company__alias">Binavn: {alias}</span> : null}
      </div>
      {showActions ? <HeadActions {...acts!} className="lasso-company__actions" /> : null}
      {facts.length > 0 ? <p className="lasso-company__facts">{facts.join(", ")}</p> : null}
      {summary ? <HeadRiskLine summary={summary} onSee={onSeeRisk} /> : null}
      {below}
    </header>
  );
}
