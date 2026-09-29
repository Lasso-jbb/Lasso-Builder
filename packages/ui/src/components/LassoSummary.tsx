import { useState } from "react";
import { Section, SourceLine } from "../primitives.js";

const FOLD_AT = 340;

/** "Første afsnit.\n\nAndet afsnit." -> to afsnit; enkelte linjeskift inden i et afsnit bliver mellemrum. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/**
 * Resumé (katalog 12, "Resumé"). Teksten kommer fra specen (modellen skriver
 * den); komponenten henter ikke selv data. Almindelig sektion med kildelinje,
 * uden "Skrevet af AI"-mærke (regel 4). Brødtekst 15/25 i læsebredde; lange resuméer foldes til
 * 5 linjer med hvid toning og "Vis mere" (12.2).
 */
export function LassoSummary({ text, title, source = "Lasso", updated }: { text: string; title?: string; source?: string; updated?: string }) {
  const [expanded, setExpanded] = useState(false);
  const foldable = text.length > FOLD_AT;
  return (
    <Section title={title ?? "Resumé"} span="full">
      <div className={`lasso-summary ${foldable && !expanded ? "lasso-summary--folded" : ""}`}>
        {/* Afsnit (tom linje i teksten) bevares som egne afsnit. */}
        {paragraphs(text).map((para, i) => (
          <p className="lasso-summary__body" key={i}>
            {para}
          </p>
        ))}
      </div>
      {foldable ? (
        <button type="button" className="lasso-link lasso-more" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis mindre" : "Vis mere"}
        </button>
      ) : null}
      <SourceLine source={source} updated={updated} />
    </Section>
  );
}
