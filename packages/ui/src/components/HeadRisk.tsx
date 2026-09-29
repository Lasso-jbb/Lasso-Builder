import { type HeadRiskSummary, type Severity } from "@lasso/spec";
import { SeverityIcon } from "../primitives.js";

export { companyRiskSummary, personRiskSummary, type HeadRiskSummary } from "@lasso/spec";

export function HeadRiskLine({ summary, onSee }: { summary: HeadRiskSummary; onSee?: () => void }) {
  return (
    <div className="lasso-headrisk" role="note">
      <span className="lasso-headrisk__icon">
        <SeverityIcon severity={summary.severity as Severity} />
      </span>
      <span className="lasso-headrisk__text">{summary.text}</span>
      {onSee ? (
        <button type="button" className="lasso-headrisk__link" onClick={onSee}>
          Se risiko
        </button>
      ) : null}
    </div>
  );
}
