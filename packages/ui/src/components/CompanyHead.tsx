import type { ReactNode } from "react";
import { formatDate, formatNumber, statusGroup, type CompanyVM, type HeadVariant, type ObservationsVM } from "@lasso/spec";
import { DataState, stateForError, statusTone } from "../primitives.js";
import { HeadActions, hasHeadActions, type HeadActionsProps } from "./HeadActions.js";

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
 * Status i hovedet (Jakob runde 6, Paper 08.1 MOR-0): Aktiv/Normal (gruppen "active") vises ikke; navnet
 * står alene. Alle andre statusser står efter navnet i deres farvegruppe (status.ts). En ukendt status
 * vises, medmindre virksomheden er i drift (statusKind "active").
 */
export function headStatusText(c: CompanyVM): string | undefined {
  if (!c.status) return undefined;
  const g = statusGroup(c.status);
  if (g === "active") return undefined;
  if (!g && (c.statusKind ?? "active") === "active") return undefined;
  return companyStatusText(c);
}

/**
 * Faktalinjen (08.1): CVR, form, stiftet, adresse, kurator, branche; adskilt med komma. Ansatte står
 * ikke i sidens hoved (Paper 08.1), men i nøgle-værdi-listen; kompakt og linje har dem.
 */
export function companyFactsLine(c: CompanyVM, variant: HeadVariant = "full"): string[] {
  const a = c.address;
  const curator = c.curator ? `${/likvidation/i.test(c.status ?? "") ? "likvidator" : "kurator"}: ${c.curator}` : null;
  // Kun et tal: null/undefined (ikke oplyst, fx en enkeltmandsvirksomhed) må ikke blive "- ansatte".
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
  /** Udgået (G9, kontrol r5): observationslinjen under navnet vises ikke længere. Beholdt for bagudkompatibilitet. */
  risk?: ObservationsVM;
  /** Klik på "Se risiko" (værten åbner risikosektionen). Uden: linjen står uden link. */
  onSeeRisk?: () => void;
  /** Ophørt: "Se historik" (værten åbner historikken). */
  onHistory?: () => void;
  /** Sektionsfaner (08.2) eller andet, der hører til hovedet og står under faktalinjen. */
  below?: ReactNode;
}

/**
 * Virksomhedshoved (katalog 08.1). Ingen kortramme og ingen skillestreg under (08.8). Navn 28/600;
 * ved Aktiv/Normal står navnet alene, ellers status som ren tekst 14/500 lige efter navnet i sin
 * farvegruppe (runde 6; konkurs/tvangsopløsning mørk rød, likvidation warning, ophørt muted). Ingen binavn (faktalinje-indhold, kontrol r5 08.8) og ingen faktalinje under navnet (G9). Handlinger som
 * 32 px ikonknapper øverst til højre, kun med funktion (G1). Ingen observationslinje (G9).
 */
export function CompanyHead({ company, error, variant = "full", actions, onHistory, below }: CompanyHeadProps) {
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
  // 02c.8/05.7: farven følger ordet (fire grupper), ikke kun livsforløbet.
  const tone = statusTone(company.status, kind);
  const ceased = isCeased(company);
  // Ophørt (08.8): kun handlingen "Se historik", ingen Overvåg og ingen ikonknapper.
  const acts: HeadActionsProps | undefined = ceased
    ? { context: actions?.context, history: onHistory ?? actions?.history, center: actions?.center, end: actions?.end }
    : actions;
  // Jakob runde 6: navnet alene ved Aktiv/Normal; ellers status efter navnet i farvegruppen.
  const status = headStatusText(company);
  // G9 (Jakob 29.09): navnet står alene i alle hovedvarianter; faktalinjen (CVR, form, stiftet,
  // adresse, ansatte, branche) tegnes ikke længere. companyFactsLine bruges stadig af tekstkort o.l.

  if (variant === "line") {
    return (
      <header className={`lasso-headline lasso-span-full lasso-company--${kind}${ceased ? " is-ceased" : ""}`}>
        <h2 className="lasso-headline__name">{company.name}</h2>
        {status ? <span className={`lasso-company__status lasso-company__status--${tone}`}>{status}</span> : null}
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
            {status ? <span className={`lasso-headcompact__status lasso-company__status--${tone}`}>{status}</span> : null}
          </div>
        </div>
        {hasHeadActions(compactActs) ? <HeadActions {...compactActs!} /> : null}
      </header>
    );
  }

  const showActions = hasHeadActions(acts);
  return (
    <header className={`lasso-company lasso-span-full lasso-company--${kind}${showActions ? " lasso-company--actions" : ""}${acts?.center ? " lasso-company--center" : ""}`}>
      <div className="lasso-company__title">
        <h2 className="lasso-company__name" title={company.name}>{company.name}</h2>
        {status ? <span className={`lasso-company__status lasso-company__status--${tone}`}>{status}</span> : null}
      </div>
      {acts?.center ? <div className="lasso-company__center">{acts.center}</div> : null}
      {showActions ? <HeadActions {...acts!} className="lasso-company__actions" /> : null}
      {/* G9 (kontrol r5, 30.3): ingen observationslinje under navnet; risiko står i risikosektionen (17). */}
      {below}
    </header>
  );
}
