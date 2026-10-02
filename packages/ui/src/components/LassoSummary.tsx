import { useState, type ReactNode } from "react";
import { isPersonId, parseEntityLinks, stripEntityLinks } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section } from "../primitives.js";
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
export function LassoSummary({ text, title, onOpen, loading = false }: { text: string; title?: string; source?: string; updated?: string; /** Links i teksten ({Navn|Lasso-ID}) åbner personen eller virksomheden. */ onOpen?: (a: ViewAction) => void; /** Lassos resumé hentes stadig. */ loading?: boolean }) {
  const print = usePrintMode();
  const [expanded, setExpanded] = useState(print);
  const plain = stripEntityLinks(text);
  const foldable = plain.length > FOLD_AT && !print;
  const paras = paragraphs(text);
  // Lassos metadata i teksten (Jakob 02.10): "{Annelise Jensen|CVR-3-…}" bliver et link, når værten kan åbne
  // personer og virksomheder; ellers (og i print) står navnet alene.
  const render = (para: string): ReactNode =>
    parseEntityLinks(para).map((part, i) =>
      typeof part === "string" ? (
        part
      ) : onOpen && !print && /^CVR-[13]-/.test(part.lassoId) ? (
        <button
          key={i}
          type="button"
          className="lasso-link lasso-summary__link"
          onClick={() => onOpen(isPersonId(part.lassoId) ? { kind: "open-person", lassoId: part.lassoId, name: part.name } : { kind: "open-company", lassoId: part.lassoId, name: part.name })}
        >
          {part.name}
        </button>
      ) : (
        part.name
      ),
    );
  if (loading) {
    return (
      <Section title={title ?? "Resumé"} span="full">
        <DataState state="loading" lines={4} height={140} />
      </Section>
    );
  }
  return (
    <Section title={title ?? "Resumé"} span="full">
      <div className="lasso-summary">
        {foldable && !expanded ? (
          // Foldet: ét tekstløb klippet efter 5 hele linjer (line-clamp), så ingen linje skæres over.
          <p className="lasso-summary__body lasso-summary__body--clamp">{render(paras.join(" "))}</p>
        ) : (
          // Afsnit (tom linje i teksten) bevares som egne afsnit.
          paras.map((para, i) => (
            <p className="lasso-summary__body" key={i}>
              {render(para)}
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
