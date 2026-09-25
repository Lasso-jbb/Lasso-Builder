import { useState } from "react";
import { Section, SourceLine } from "../primitives.js";

const FOLD_AT = 340;

/**
 * Resumé (katalog 12, "Resumé"). Teksten kommer fra specen (modellen skriver
 * den); komponenten henter ikke selv data. Almindelig sektion med kildelinje,
 * uden "Skrevet af AI"-mærke (regel 4). Lange resuméer foldes med hvid toning.
 */
export function LassoSummary({ text, title, source = "Lasso", updated }: { text: string; title?: string; source?: string; updated?: string }) {
  const [expanded, setExpanded] = useState(false);
  const foldable = text.length > FOLD_AT;
  return (
    <Section title={title ?? "Resumé"} span="full">
      <div className={`lasso-summary ${foldable && !expanded ? "lasso-summary--folded" : ""}`}>
        <p className="lasso-summary__body">{text}</p>
      </div>
      {foldable ? (
        <button type="button" className="lasso-link lasso-more" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis mindre" : "Læs mere"}
        </button>
      ) : null}
      <SourceLine source={source} updated={updated} />
    </Section>
  );
}
