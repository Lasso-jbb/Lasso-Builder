import { formatDate, formatNumber, type CompanyVM } from "@lasso/spec";
import { DataState, stateForError } from "../primitives.js";

/**
 * Virksomhedshoved (katalog 08). Ingen kortramme, kun linjen under.
 * Navn 28/600, status som ren tekst 14/500 lige efter navnet, nøglefakta
 * som én linje adskilt med komma. Konkurs/likvidation: status i mørk rød.
 * Ophørt: navnet i text-secondary.
 */
export function CompanyHead({ company, error }: { company?: CompanyVM; error?: string }) {
  if (!company) {
    if (!error) return <div className="lasso-span-full"><DataState state="loading" lines={2} height={92} /></div>;
    return (
      <div className="lasso-span-full">
        <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} />
      </div>
    );
  }

  const a = company.address;
  const facts = [
    company.cvr ? `CVR ${company.cvr}` : null,
    company.form,
    company.founded ? `stiftet ${formatDate(company.founded)}` : null,
    a?.street,
    [a?.zip, a?.city].filter(Boolean).join(" ") || null,
    company.employees !== undefined ? `${formatNumber(company.employees)} ansatte (CVR)` : null,
    company.industryText,
  ].filter((f): f is string => Boolean(f));

  const kind = company.statusKind ?? "active";
  return (
    <header className={`lasso-company lasso-span-full lasso-company--${kind}`}>
      <div className="lasso-company__title">
        <h2 className="lasso-company__name">{company.name}</h2>
        {company.status ? <span className={`lasso-company__status lasso-company__status--${kind}`}>{company.status}</span> : null}
      </div>
      {facts.length > 0 ? <p className="lasso-company__facts">{facts.join(", ")}</p> : null}
    </header>
  );
}
