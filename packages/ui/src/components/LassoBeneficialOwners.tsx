import type { BeneficialOwnershipVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";

/**
 * Reelle ejere (katalog 11, "Reelle ejere"). Personerne bag virksomheden med
 * indirekte andel og kæden gennem mellemliggende selskaber. Navnet står alene
 * (ingen initial-cirkel), kæden i én grå linje, den beregnede andel til højre.
 */
export function LassoBeneficialOwners({ ownership, error, onOpen }: { ownership?: BeneficialOwnershipVM; error?: string; onOpen?: (a: ViewAction) => void }) {
  const title = "Reelle ejere";
  if (!ownership) {
    return (
      <Section title={title} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={220} />}
      </Section>
    );
  }
  const { owners, gaps } = ownership;
  if (owners.length === 0 && (!gaps || gaps.length === 0)) {
    return (
      <Section title={title} span="half">
        <DataState state="empty" reason="Der er ikke registreret nogen reel ejer for virksomheden." />
      </Section>
    );
  }
  const open = (lassoId?: string, name?: string) =>
    onOpen && lassoId?.startsWith("CVR-1-") ? () => onOpen({ kind: "open-company", lassoId, name }) : undefined;
  return (
    <Section title={title} span="half">
      <ul className="lasso-rows">
        {owners.map((o, i) => {
          const click = open(o.lassoId, o.name);
          return (
            <li key={`${o.name}-${i}`} className="lasso-row lasso-row--owner">
              <div className="lasso-row__main">
                <div className="lasso-row__name lasso-row__name--regular">
                  {click ? <button type="button" className="lasso-link" onClick={click}>{o.name}</button> : o.name}
                </div>
                {o.chain ? <div className="lasso-row__sub">{o.chain}</div> : null}
              </div>
              <div className="lasso-row__value">{o.share ? `Reelt ${o.share}` : <span className="lasso-notreported">Ikke oplyst</span>}</div>
            </li>
          );
        })}
        {(gaps ?? []).map((g, i) => (
          <li key={`gap-${i}`} className="lasso-row">
            <div className="lasso-row__main">
              <div className="lasso-row__name lasso-row__name--regular">Ingen reel ejer for {g.share ?? "en del af ejerskabet"}</div>
              {g.reason ? <div className="lasso-row__sub">{g.reason}</div> : null}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
