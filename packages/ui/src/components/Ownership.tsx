import { formatDate, type OwnershipVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { Card, StateBox, initials, stateForError } from "../primitives.js";

export function Ownership({ ownership, error, onOpen }: { ownership?: OwnershipVM; error?: string; onOpen?: (a: ViewAction) => void }) {
  const title = "Ejerskab og revisor";
  if (!ownership) return <Card title={title}>{error ? <StateBox kind={stateForError(error)} message={error} /> : <StateBox kind="loading" />}</Card>;
  const { owners, auditor } = ownership;
  if (owners.length === 0 && !auditor) return <Card title={title}><StateBox kind="empty" message="Ingen registrerede ejere eller revisor." /></Card>;
  const open = (lassoId?: string, name?: string) =>
    onOpen && lassoId?.startsWith("CVR-1-") ? () => onOpen({ kind: "open-company", lassoId, name }) : undefined;
  return (
    <Card title={title}>
      <ul className="lasso-list">
        {owners.map((o, i) => {
          const click = open(o.lassoId, o.name);
          return (
            <li key={`${o.name}-${i}`} className="lasso-list__item">
              <span className={`lasso-avatar ${o.kind === "company" ? "lasso-avatar--company" : ""}`} aria-hidden="true">{initials(o.name)}</span>
              <div className="lasso-list__main">
                <div className="lasso-list__name">{click ? <button className="lasso-link" onClick={click}>{o.name}</button> : o.name}</div>
                <div className="lasso-list__sub">{o.kind === "company" ? "Selskab" : "Person"} · legal ejer</div>
              </div>
              <div className="lasso-list__side">{o.share ?? ""}</div>
            </li>
          );
        })}
        {auditor ? (
          <li className="lasso-list__item">
            <span className="lasso-avatar lasso-avatar--company" aria-hidden="true">{initials(auditor.name)}</span>
            <div className="lasso-list__main">
              <div className="lasso-list__name">
                {open(auditor.lassoId, auditor.name) ? <button className="lasso-link" onClick={open(auditor.lassoId, auditor.name)}>{auditor.name}</button> : auditor.name}
              </div>
              <div className="lasso-list__sub">Revisor</div>
            </div>
            <div className="lasso-list__side">{auditor.from ? `Siden ${formatDate(auditor.from)}` : ""}</div>
          </li>
        ) : null}
      </ul>
    </Card>
  );
}
