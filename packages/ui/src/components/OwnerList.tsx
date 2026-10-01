import { useState } from "react";
import { shareText, type OwnershipVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";

/** "25–33,33 %" -> [25, 33.33]; "100 %" -> [100, 100]. */
export function parseShare(share: string | undefined): [number, number] | null {
  if (!share) return null;
  const nums = share.match(/\d+(?:,\d+)?/g)?.map((n) => Number(n.replace(",", ".")));
  if (!nums || nums.length === 0) return null;
  return [nums[0]!, nums[1] ?? nums[0]!];
}

/**
 * Ejerliste med interval-bjælke (katalog 11). CVR oplyser ejerandel i intervaller:
 * fuld koral = sikker minimumsandel, lys koral = intervallets spænd.
 * Navnet står alene uden ikonkasse eller initialer (Jakob 01.10: intet "Person" under navnet). Bjælken er
 * 120 × 6 i en fast kolonne (mobil: fuld bredde under navnet). Revisoren står i nøgle-værdi-listen.
 */
/** Mobil (26c.5): højst fire ejere før "Vis alle N ejere". */
const MOBILE_OWNERS = 4;

export function OwnerList({ ownership, error, onOpen }: { ownership?: OwnershipVM; error?: string; onOpen?: (a: ViewAction) => void }) {
  const title = "Ejere";
  const [all, setAll] = useState(false);
  if (!ownership) {
    return (
      <Section title={title} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={220} />}
      </Section>
    );
  }
  const { owners, hasOwnersUnderFivePercent } = ownership;
  if (owners.length === 0) {
    return (
      <Section title={title} span="half">
        <DataState state="empty" reason="Der er ingen registrerede legale ejere i CVR." />
      </Section>
    );
  }
  const open = (lassoId?: string, name?: string) =>
    onOpen && lassoId?.startsWith("CVR-1-") ? () => onOpen({ kind: "open-company", lassoId, name }) : undefined;
  return (
    <Section
      title={
        <>
          <span className="lasso-ownerlist__desk">{title}</span>
          <span className="lasso-ownerlist__mob">Legale ejere</span>
        </>
      }
      action={owners.length > 0 ? <span className="lasso-ownerlist__mob lasso-ownerlist__col">Ejerandel</span> : undefined}
      span="half"
      className="lasso-ownerlist"
    >
      {owners.length > 0 ? (
        <ul className={`lasso-rows lasso-rows--owners${all ? " is-all" : ""}`}>
          {owners.map((o, i) => {
            const click = open(o.lassoId, o.name);
            const range = parseShare(o.share);
            return (
              <li key={`${o.name}-${i}`} className={`lasso-row lasso-row--owner lasso-row--c${i % 4}${i >= MOBILE_OWNERS ? " is-extra" : ""}`}>
                <div className="lasso-row__main">
                  <div className="lasso-row__name lasso-row__name--regular">
                    {click ? <button type="button" className="lasso-link" onClick={click}>{o.name}</button> : o.name}
                  </div>
                  {o.votes ? <div className="lasso-row__sub">Stemmer {o.votes}</div> : null}
                </div>
                <div className="lasso-share" aria-hidden="true">
                  {range ? (
                    <>
                      <span className="lasso-share__min" style={{ width: `${Math.min(100, range[0])}%` }} />
                      <span className="lasso-share__span" style={{ left: `${Math.min(100, range[0])}%`, width: `${Math.max(0, Math.min(100, range[1]) - range[0])}%` }} />
                    </>
                  ) : null}
                </div>
                <div className="lasso-row__value">{shareText(o.share) ?? <span className="lasso-notreported">Ikke oplyst</span>}</div>
              </li>
            );
          })}
        </ul>
      ) : (
        <DataState state="empty" reason="Der er ingen registrerede legale ejere i CVR." />
      )}
      {owners.length > MOBILE_OWNERS && !all ? (
        <button type="button" className="lasso-link lasso-ownerlist__all" onClick={() => setAll(true)}>
          {`Vis alle ${owners.length} ejere`}
        </button>
      ) : null}
      {hasOwnersUnderFivePercent ? (
        <p className="lasso-kv-line lasso-muted">Der er ejere under 5 %, som ikke er registreret enkeltvis.</p>
      ) : null}
    </Section>
  );
}
