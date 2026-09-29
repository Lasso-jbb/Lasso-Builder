import { useState } from "react";
import { Section } from "../primitives.js";
import { usePrintMode } from "../print.js";

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
 * den); komponenten henter ikke selv data. Almindelig sektion uden kildevisning (G3) og
 * uden "Skrevet af AI"-mærke (regel 4). Brødtekst 15/25 i læsebredde; lange resuméer klippes rent
 * efter 5 linjer (ingen toning) med "Vis mere" under, som i 12.1 (12.2).
 * `source`/`updated` modtages stadig fra ældre specs, men vises ikke.
 */
export function LassoSummary({ text, title }: { text: string; title?: string; source?: string; updated?: string }) {
  const [expanded, setExpanded] = useState(usePrintMode());
  const foldable = text.length > FOLD_AT;
  const paras = paragraphs(text);
  return (
    <Section title={title ?? "Resumé"} span="full">
      <div className="lasso-summary">
        {foldable && !expanded ? (
          // Foldet: ét tekstløb klippet efter 5 hele linjer (line-clamp), så ingen linje skæres over.
          <p className="lasso-summary__body lasso-summary__body--clamp">{paras.join(" ")}</p>
        ) : (
          // Afsnit (tom linje i teksten) bevares som egne afsnit.
          paras.map((para, i) => (
            <p className="lasso-summary__body" key={i}>
              {para}
            </p>
          ))
        )}
      </div>
      {foldable ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis mindre" : "Vis mere"}
        </button>
      ) : null}
    </Section>
  );
}
