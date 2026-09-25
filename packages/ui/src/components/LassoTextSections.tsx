import { useState } from "react";
import type { TextSectionsVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";

const TRUNCATE_AT = 220;

function TextBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (text.length <= TRUNCATE_AT) return <p className="lasso-textsection__body">{text}</p>;
  return (
    <>
      <p className="lasso-textsection__body">{expanded ? text : `${text.slice(0, TRUNCATE_AT).trimEnd()} …`}</p>
      <button type="button" className="lasso-link lasso-more" onClick={() => setExpanded(!expanded)}>
        {expanded ? "Vis mindre" : "Vis hele"}
      </button>
    </>
  );
}

/**
 * Tekstsektioner fra CVR-stamdata (katalog 12, "Tekstsektioner"). Overskrift +
 * afsnit pr. emne (branche, formål, tegningsregler); lange afsnit foldes med
 * "Vis hele". Kun de sektioner, CVR har oplyst, vises.
 */
export function LassoTextSections({ sections, title, error }: { sections?: TextSectionsVM; title?: string; error?: string }) {
  const heading = title ?? sections?.title ?? "Virksomhedsprofil";
  if (!sections) {
    return (
      <Section title={heading} span="quarter">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={5} height={260} />}
      </Section>
    );
  }
  if (sections.sections.length === 0) {
    return (
      <Section title={heading} span="quarter">
        <DataState state="empty" reason="CVR har ikke oplyst formål eller tegningsregler for virksomheden." />
      </Section>
    );
  }
  return (
    <Section title={heading} span="quarter" className="lasso-textsections">
      {sections.sections.map((s, i) => (
        <div key={i} className="lasso-textsection">
          <div className="lasso-textsection__heading">{s.heading}</div>
          <TextBody text={s.body} />
          {s.note ? <div className="lasso-textsection__note">{s.note}</div> : null}
        </div>
      ))}
    </Section>
  );
}
