import type { OwnershipVM, PersonRowVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";

const MAX_OWNERS = 3;

/** "Bestyrelsesformand" -> { role: "Bestyrelse", chair: true }. Samme regel som PersonList. */
function splitChair(role: string): { role: string; chair: boolean } {
  if (/formand/i.test(role) && !/næstformand/i.test(role)) return { role: role.replace(/sformand|formand/i, "").trim() || "Bestyrelse", chair: true };
  return { role, chair: false };
}

/** Navn som koral link, når vi kan åbne det (kun virksomheder har en profil at åbne til); ellers ren koral tekst. */
function Name({ name, lassoId, onOpen }: { name: string; lassoId?: string; onOpen?: (a: ViewAction) => void }) {
  if (onOpen && lassoId?.startsWith("CVR-1-")) {
    return (
      <button type="button" className="lasso-link lasso-relations__name" onClick={() => onOpen({ kind: "open-company", lassoId, name })}>
        {name}
      </button>
    );
  }
  return <span className="lasso-relations__name">{name}</span>;
}

/**
 * Kompakt rolleliste til skinnen (katalog 11, "Rolleliste, kompakt"). Direktion,
 * bestyrelse (formand i parentes) og de tre største legale ejere, alle som
 * koral tekst. Reelle ejere kræver Reelle ejere-modulet (LassoBeneficialOwners)
 * og vises her som en tom tilstand med henvisning dertil.
 */
export function LassoRelations({
  people,
  ownership,
  title,
  peopleError,
  ownershipError,
  onOpen,
}: {
  people?: PersonRowVM[];
  ownership?: OwnershipVM;
  title?: string;
  peopleError?: string;
  ownershipError?: string;
  onOpen?: (a: ViewAction) => void;
}) {
  const heading = title ?? "Relationer";
  if (!people || !ownership) {
    const error = peopleError ?? ownershipError;
    return (
      <Section title={heading} span="quarter">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={6} height={320} />}
      </Section>
    );
  }
  const current = people.filter((p) => !p.to);
  const direction = current.filter((p) => /direkt/i.test(p.role));
  const board = current.filter((p) => /bestyrelse/i.test(p.role) && !/suppleant/i.test(p.role));
  const owners = ownership.owners;

  if (direction.length === 0 && board.length === 0 && owners.length === 0) {
    return (
      <Section title={heading} span="quarter">
        <DataState state="empty" reason="Der er ingen registrerede relationer i CVR." />
      </Section>
    );
  }

  return (
    <Section title={heading} span="quarter" className="lasso-relations">
      {direction.length > 0 ? (
        <div className="lasso-relations__group">
          <div className="lasso-relations__label">Direktion</div>
          {direction.map((p, i) => (
            <div key={`${p.name}-${i}`}>
              <Name name={p.name} lassoId={p.lassoId} onOpen={onOpen} />
            </div>
          ))}
        </div>
      ) : null}
      {board.length > 0 ? (
        <div className="lasso-relations__group">
          <div className="lasso-relations__label">Bestyrelse</div>
          {board.map((p, i) => {
            const { chair } = splitChair(p.role);
            return (
              <div key={`${p.name}-${i}`}>
                <Name name={p.name} lassoId={p.lassoId} onOpen={onOpen} />
                {chair ? <span className="lasso-row__note">(formand)</span> : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {owners.length > 0 ? (
        <div className="lasso-relations__group">
          <div className="lasso-relations__label">Legale ejere</div>
          {owners.slice(0, MAX_OWNERS).map((o, i) => (
            <div key={`${o.name}-${i}`}>
              <Name name={o.name} lassoId={o.lassoId} onOpen={onOpen} />
            </div>
          ))}
          {owners.length > MAX_OWNERS ? <div className="lasso-relations__more">og {owners.length - MAX_OWNERS} flere</div> : null}
        </div>
      ) : null}
    </Section>
  );
}
