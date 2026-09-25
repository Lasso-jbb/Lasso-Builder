import { formatDate, type OwnershipVM } from "@lasso/spec";
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
 * Navnet står alene uden ikonkasse eller initialer. Revisor som sidste linje.
 */
export function Ownership({ ownership, error, onOpen }: { ownership?: OwnershipVM; error?: string; onOpen?: (a: ViewAction) => void }) {
  const title = "Ejere";
  if (!ownership) {
    return (
      <Section title={title} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={220} />}
      </Section>
    );
  }
  const { owners, auditor } = ownership;
  if (owners.length === 0 && !auditor) {
    return (
      <Section title={title} span="half">
        <DataState state="empty" reason="Der er ingen registrerede legale ejere eller revisor i CVR." />
      </Section>
    );
  }
  const open = (lassoId?: string, name?: string) =>
    onOpen && lassoId?.startsWith("CVR-1-") ? () => onOpen({ kind: "open-company", lassoId, name }) : undefined;
  return (
    <Section title={title} span="half">
      {owners.length > 0 ? (
        <ul className="lasso-rows">
          {owners.map((o, i) => {
            const click = open(o.lassoId, o.name);
            const range = parseShare(o.share);
            return (
              <li key={`${o.name}-${i}`} className="lasso-row lasso-row--owner">
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
                <div className="lasso-row__value">{o.share ?? <span className="lasso-notreported">Ikke oplyst</span>}</div>
              </li>
            );
          })}
        </ul>
      ) : (
        <DataState state="empty" reason="Der er ingen registrerede legale ejere i CVR." />
      )}
      {auditor ? (
        <p className="lasso-kv-line">
          <span className="lasso-kv-line__key">Revisor</span>
          <span>
            {open(auditor.lassoId, auditor.name) ? <button type="button" className="lasso-link" onClick={open(auditor.lassoId, auditor.name)}>{auditor.name}</button> : auditor.name}
            {auditor.from ? <span className="lasso-muted">, siden {formatDate(auditor.from)}</span> : null}
          </span>
        </p>
      ) : null}
    </Section>
  );
}
