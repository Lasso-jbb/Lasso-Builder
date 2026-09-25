import { formatDate, formatNumber, type CompanyVM } from "@lasso/spec";
import { Card, StateBox, StatusBadge, stateForError } from "../primitives.js";

export function CompanyHeader({ company, error }: { company?: CompanyVM; error?: string }) {
  if (!company) return error ? <StateBox kind={stateForError(error)} message={error} /> : <StateBox kind="loading" />;
  const a = company.address;
  const addressLine = [a?.street, [a?.zip, a?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return (
    <Card className="lasso-span-2">
      <div className="lasso-company">
        <h2 className="lasso-company__name">{company.name}</h2>
        <div className="lasso-company__row">
          <StatusBadge status={company.status} kind={company.statusKind} />
          {company.cvr ? <span>CVR {company.cvr}</span> : null}
          {company.form ? <span>{company.form}</span> : null}
          {addressLine ? <span>{addressLine}</span> : null}
        </div>
        <div className="lasso-company__facts">
          <Fact label="Branche" value={company.industryText ? `${company.industryText}${company.industryCode ? ` (${company.industryCode})` : ""}` : undefined} />
          <Fact label="Stiftet" value={company.founded ? formatDate(company.founded) : undefined} />
          <Fact label="Ansatte (CVR)" value={company.employees !== undefined ? formatNumber(company.employees) : undefined} />
          <Fact label="Kommune" value={a?.municipality ?? a?.region} />
          {company.website ? <Fact label="Website" value={company.website} /> : null}
        </div>
      </div>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="lasso-fact__label">{label}</div>
      <div className="lasso-fact__value">{value ?? "–"}</div>
    </div>
  );
}
