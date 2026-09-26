import { personCounts, personRisk, type PersonVM } from "@lasso/spec";
import { DataState, SourceLine, stateForError } from "../primitives.js";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Personhoved (katalog 16). Samme form som virksomhedshovedet (08): navn 28/600, ordet
 * "Person" som ren tekst lige efter navnet (i stedet for status), og en faktalinje, der
 * tæller roller og selskaber adskilt med komma. Ingen initial-cirkel, aldrig CPR eller
 * fuld privatadresse; kun by.
 */
export function PersonHead({ person, error }: { person?: PersonVM; error?: string }) {
  if (!person) {
    if (!error) return <div className="lasso-span-full"><DataState state="loading" lines={2} height={92} /></div>;
    return (
      <div className="lasso-span-full">
        <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} />
      </div>
    );
  }
  const n = personCounts(person);
  const risk = personRisk(person);
  const owns = new Set(person.roles.filter((r) => r.active && r.kind === "owner").map((r) => r.companyId ?? r.companyName)).size;
  const facts = [
    person.city,
    n.activeRoles ? `${plural(n.activeRoles, "aktiv rolle", "aktive roller")} i ${plural(n.activeCompanies, "selskab", "selskaber")}` : "ingen aktive roller",
    owns ? `ejer af ${owns}` : null,
    n.endedRoles ? `${plural(n.endedRoles, "ophørt rolle", "ophørte roller")}` : null,
    risk.bankruptcies.length ? `${plural(risk.bankruptcies.length, "konkurs", "konkurser")} blandt selskaberne` : null,
    n.firstYear ? `første registrering ${n.firstYear}` : null,
  ].filter((f): f is string => Boolean(f));

  return (
    <header className="lasso-personhead lasso-span-full">
      <div className="lasso-personhead__title">
        <h2 className="lasso-personhead__name">{person.name}</h2>
        <span className="lasso-personhead__kind">Person</span>
      </div>
      <p className="lasso-personhead__facts">{facts.join(", ")}</p>
      <SourceLine source="CVR via Lasso" updated={person.updated} />
    </header>
  );
}
