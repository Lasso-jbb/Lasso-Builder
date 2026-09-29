import { shareText, type BeneficialOwnershipVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";
import { ShellIcon } from "./ShellIcons.js";

/**
 * Reelle ejere (katalog 11, "Reelle ejere"). Personerne bag virksomheden med
 * indirekte andel og kæden gennem mellemliggende selskaber. Navnet står alene
 * (ingen initial-cirkel), kæden i én grå linje, den beregnede andel til højre.
 * Tre særlige tilstande (28.9): ledelsen som reelle ejere (årsag + de indsatte personer med rolle),
 * fritaget (årsag + forbehold i muted) og kunne ikke identificeres (udråbstegn-ikon). "throughRole"
 * vises som ", via rolle" i muted efter navnet.
 */
export function LassoBeneficialOwners({
  ownership,
  error,
  onOpen,
  onDiagram,
}: {
  ownership?: BeneficialOwnershipVM;
  error?: string;
  onOpen?: (a: ViewAction) => void;
  /** 11.4: "Åbn ejerdiagram →" som koral link ved sektionstitlen. */
  onDiagram?: () => void;
}) {
  const title = "Reelle ejere";
  const diagram = onDiagram ? (
    <button type="button" className="lasso-link" onClick={onDiagram}>
      Åbn ejerdiagram →
    </button>
  ) : undefined;
  if (!ownership) {
    return (
      <Section title={title} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={220} />}
      </Section>
    );
  }
  const { owners, gaps, special } = ownership;
  if (owners.length === 0 && (!gaps || gaps.length === 0) && !special) {
    return (
      <Section title={title} span="half">
        <DataState state="empty" reason="Der er ikke registreret nogen reel ejer for virksomheden." />
      </Section>
    );
  }
  const open = (lassoId?: string, name?: string) =>
    onOpen && lassoId?.startsWith("CVR-1-") ? () => onOpen({ kind: "open-company", lassoId, name }) : undefined;
  if (special?.kind === "unidentified") {
    // 28.9 (3): en observation, derfor udråbstegn-ikonet; aldrig farvet boks.
    return (
      <Section title={title} span="half">
        <ul className="lasso-rows">
          <li className="lasso-row lasso-row--bo-special">
            <span className="lasso-bo__alert" aria-hidden="true">
              <ShellIcon name="alert" size={16} />
            </span>
            <div className="lasso-row__main">
              <div className="lasso-row__name lasso-row__name--regular">Virksomheden kunne ikke identificere sine reelle ejere</div>
              <div className="lasso-row__sub">{special.reason}</div>
            </div>
          </li>
        </ul>
      </Section>
    );
  }
  if (special?.kind === "exempt") {
    // 28.9 (2): fritaget, forbeholdet i muted.
    return (
      <Section title={title} span="half">
        <div className="lasso-bo__note">
          <p className="lasso-bo__reason">{special.reason}</p>
          {special.caveat ? <p className="lasso-bo__caveat">{special.caveat}</p> : null}
        </div>
      </Section>
    );
  }
  return (
    <Section title={title} span="half" action={diagram}>
      {special?.kind === "management" ? <p className="lasso-bo__reason lasso-bo__reason--lead">{special.reason}</p> : null}
      <ul className="lasso-rows">
        {owners.map((o, i) => {
          const click = open(o.lassoId, o.name);
          return (
            <li key={`${o.name}-${i}`} className="lasso-row lasso-row--owner">
              <div className="lasso-row__main">
                <div className="lasso-row__name lasso-row__name--regular">
                  {click ? <button type="button" className="lasso-link" onClick={click}>{o.name}</button> : o.name}
                  {o.throughRole ? <span className="lasso-bo__via">, via rolle</span> : null}
                </div>
                {o.chain ? <div className="lasso-row__sub">{shareText(o.chain)}</div> : null}
              </div>
              <div className="lasso-row__value lasso-row__value--share">
                {o.role ? <span className="lasso-bo__role">{o.role}</span> : o.share ? `Reelt ${shareText(o.share)}` : <span className="lasso-notreported">Ikke oplyst</span>}
              </div>
            </li>
          );
        })}
        {(special ? [] : gaps ?? []).map((g, i) => (
          <li key={`gap-${i}`} className="lasso-row">
            <div className="lasso-row__main">
              <div className="lasso-row__name lasso-row__name--regular">Ingen reel ejer for {shareText(g.share) ?? "en del af ejerskabet"}</div>
              {g.reason ? <div className="lasso-row__sub">{g.reason}</div> : null}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
