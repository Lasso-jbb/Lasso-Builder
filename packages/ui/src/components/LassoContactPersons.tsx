import { useState } from "react";
import type { ContactPersonVM, ContactPersonsVM } from "@lasso/spec";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";

/** Store lister foldes sammen efter de første (regel 9: 3 + "Se N …"). */
const COLLAPSED_ROWS = 3;

function PhoneIcon({ muted }: { muted: boolean }) {
  return (
    <svg className={`lasso-contactpersons__icon ${muted ? "lasso-contactpersons__icon--muted" : ""}`} width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 4.5h3.2l1.4 4-2 1.6a11.5 11.5 0 006.3 6.3l1.6-2 4 1.4V19a1.5 1.5 0 01-1.6 1.5A15.5 15.5 0 013.5 6.1 1.5 1.5 0 015 4.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function MailIcon({ muted }: { muted: boolean }) {
  return (
    <svg className={`lasso-contactpersons__icon ${muted ? "lasso-contactpersons__icon--muted" : ""}`} width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 6.5l7.5 6 7.5-6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function PersonRow({ person }: { person: ContactPersonVM }) {
  return (
    <li className="lasso-row lasso-contactpersons__row">
      <div className="lasso-row__main">
        <div className="lasso-row__name">{person.name}</div>
        {person.role ? <div className="lasso-row__sub">{person.role}</div> : null}
      </div>
      <div className="lasso-contactpersons__actions">
        {person.phone ? (
          <a className="lasso-contactpersons__action" href={`tel:${person.phone.replace(/\s+/g, "")}`} aria-label={`Ring til ${person.name}`}>
            <PhoneIcon muted={false} />
          </a>
        ) : (
          <PhoneIcon muted />
        )}
        {person.email ? (
          <a className="lasso-contactpersons__action" href={`mailto:${person.email}`} aria-label={`Skriv til ${person.name}`}>
            <MailIcon muted={false} />
          </a>
        ) : (
          <MailIcon muted />
        )}
      </div>
    </li>
  );
}

/**
 * Kontaktpersoner (katalog 08, node I6B-0): navn, rolle/afdeling under navnet i muted,
 * telefon-/mailikon til højre (klikbart tel:/mailto:, i faint når kanalen mangler). 3 + "Se N
 * kontaktpersoner" (regel 9). Ingen initial-cirkler (regel 5).
 */
export function LassoContactPersons({ data, title, error }: { data?: ContactPersonsVM; title?: string; error?: string }) {
  const heading = title ?? "Kontaktpersoner";
  const [expanded, setExpanded] = useState(false);

  if (!data) {
    return (
      <Section title={heading} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={210} />}
      </Section>
    );
  }

  if (data.people.length === 0) {
    return (
      <Section title={heading} span="half">
        <DataState state="empty" reason="Der er ikke fundet kontaktpersoner for virksomheden." />
      </Section>
    );
  }

  const foldable = data.people.length > COLLAPSED_ROWS + 2;
  const visible = foldable && !expanded ? data.people.slice(0, COLLAPSED_ROWS) : data.people;

  return (
    <Section title={heading} span="half">
      <ul className="lasso-rows lasso-contactpersons__rows">
        {visible.map((p, i) => (
          <PersonRow key={`${p.name}-${i}`} person={p} />
        ))}
      </ul>
      {foldable ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis færre" : `Se ${data.people.length} kontaktpersoner`}
        </button>
      ) : null}
      {data.source ? <SourceLine source={data.source} updated={data.updated} /> : null}
    </Section>
  );
}
