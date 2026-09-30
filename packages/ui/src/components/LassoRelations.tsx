import { useState } from "react";
import { ExpandLink } from "./ExpandLink.js";
import { isPersonId, type OwnershipVM, type PersonRowVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";
import { Icon } from "./Icon.js";
import { LockedValue } from "./Values.js";

const MAX_OWNERS = 3;

/** "Bestyrelsesformand" -> { role: "Bestyrelse", chair: true }. Samme regel som PersonList. */
function splitChair(role: string): { role: string; chair: boolean } {
  if (/formand/i.test(role) && !/næstformand/i.test(role)) return { role: role.replace(/sformand|formand/i, "").trim() || "Bestyrelse", chair: true };
  return { role, chair: false };
}

/** Navn som koral link, når vi kan åbne det (virksomheder og personer har en profil at åbne til); ellers ren koral tekst. */
function Name({ name, lassoId, onOpen }: { name: string; lassoId?: string; onOpen?: (a: ViewAction) => void }) {
  if (onOpen && lassoId?.startsWith("CVR-1-")) {
    return (
      <button type="button" className="lasso-link lasso-relations__name" onClick={() => onOpen({ kind: "open-company", lassoId, name })}>
        {name}
      </button>
    );
  }
  if (onOpen && isPersonId(lassoId)) {
    return (
      <button type="button" className="lasso-link lasso-relations__name" onClick={() => onOpen({ kind: "open-person", lassoId, name })}>
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
  beneficialLocked = false,
  onBeneficialInfo,
  productionUnits,
  onProductionUnits,
}: {
  people?: PersonRowVM[];
  ownership?: OwnershipVM;
  title?: string;
  peopleError?: string;
  ownershipError?: string;
  onOpen?: (a: ViewAction) => void;
  /** 11.1: reelle ejere kræver adgang; vises som låst værdi (02c.18: låseikon + "Kræver Lasso Pro"). */
  beneficialLocked?: boolean;
  /** "Læs mere" i den låste række. */
  onBeneficialInfo?: () => void;
  /** 11.1: antal produktionsenheder som tællerrække under en 1 px linje ("Produktionsenheder  1 ›"). */
  productionUnits?: number;
  /** Åbner produktionsenhederne (sektionen). */
  onProductionUnits?: () => void;
}) {
  const heading = title ?? "Relationer";
  // "og N flere" folder resten af ejerne ud på stedet (Jakob 30.09: skal kunne klikkes).
  const [allOwners, setAllOwners] = useState(false);
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
  // Uden direktion og bestyrelse (fx en enkeltmandsvirksomheds fuldt ansvarlige deltager) står rollerne, som CVR har dem.
  const others = direction.length === 0 && board.length === 0 ? current : [];
  const othersLabel = others.length > 0 && others.every((p) => p.role === others[0]!.role) ? others[0]!.role : "Ledelse";
  const owners = ownership.owners;

  if (direction.length === 0 && board.length === 0 && others.length === 0 && owners.length === 0) {
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
      {others.length > 0 ? (
        <div className="lasso-relations__group">
          <div className="lasso-relations__label">{othersLabel}</div>
          {others.map((p, i) => (
            <div key={`${p.name}-${i}`}>
              <Name name={p.name} lassoId={p.lassoId} onOpen={onOpen} />
              {othersLabel === "Ledelse" ? <span className="lasso-row__note">({p.role.toLowerCase()})</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      {owners.length > 0 ? (
        <div className="lasso-relations__group">
          <div className="lasso-relations__label">Legale ejere</div>
          {(allOwners ? owners : owners.slice(0, MAX_OWNERS)).map((o, i) => (
            <div key={`${o.name}-${i}`}>
              <Name name={o.name} lassoId={o.lassoId} onOpen={onOpen} />
            </div>
          ))}
          {owners.length > MAX_OWNERS ? (
            <ExpandLink expanded={allOwners} total={owners.length} onToggle={() => setAllOwners(!allOwners)} />
          ) : null}
        </div>
      ) : null}
      {beneficialLocked ? (
        <div className="lasso-relations__group">
          <div className="lasso-relations__label">Reelle ejere</div>
          {/* 02c.18 Låst værdi (Paper GWO-0): låseikon i muted og et kort link, ingen boks. */}
          <div>
            <LockedValue onUpgrade={onBeneficialInfo} />
          </div>
        </div>
      ) : null}
      {typeof productionUnits === "number" && productionUnits > 0 ? (
        onProductionUnits ? (
          <button type="button" className="lasso-relations__count" onClick={onProductionUnits}>
            <span>Produktionsenheder</span>
            <span className="lasso-relations__countn">{productionUnits}</span>
            <Icon name="chevron-right" size={14} />
          </button>
        ) : (
          <div className="lasso-relations__count">
            <span>Produktionsenheder</span>
            <span className="lasso-relations__countn">{productionUnits}</span>
          </div>
        )
      ) : null}
    </Section>
  );
}
