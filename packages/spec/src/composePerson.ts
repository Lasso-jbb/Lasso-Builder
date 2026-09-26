import type { Dataset } from "./models.js";
import { personCompanies, personRisk } from "./person.js";
import { viewSpecSchema, type ViewComponent, type ViewSpec } from "./spec.js";

/**
 * Komponisten for personsiden (katalog 16), samme idé som composeCompany: data hentes først
 * (composePersonProbe), og skærmbilledet vælges derefter ud fra datas form.
 *
 * Layout 'columns' som virksomhedssiden: hoved og roller over tid i fuld bredde, derunder
 * netværk | risiko i to kolonner. Er der kun den ene af de to, står den i fuld bredde, så
 * der aldrig er et hul.
 */

/** De komponenter, der skal hentes data til, før komponisten vælger form. Vises ikke. */
export function composePersonProbe(lassoId: string): ViewSpec {
  const p = lassoId;
  return viewSpecSchema.parse({
    kind: "person",
    title: lassoId,
    layout: "stack",
    components: [
      { type: "LassoPersonHead", person: p },
      { type: "LassoPersonNetwork", person: p },
    ],
  });
}

export interface ComposePersonOptions {
  name?: string;
}

export function composePerson(lassoId: string, ds: Dataset, options: ComposePersonOptions = {}): ViewSpec {
  const id = lassoId;
  const person = ds.persons[id];
  const network = ds.personNetworks[id]?.people ?? [];
  const components: ViewComponent[] = [{ type: "LassoPersonHead", person: id }];

  // Uden persondata (fejl eller ukendt ID) viser hovedet selv fejlen; resten ville kun gentage den.
  if (!person) {
    return viewSpecSchema.parse({ kind: "person", title: options.name ?? lassoId, layout: "columns", columns: 2, components });
  }

  const hasRoles = person.roles.length > 0;
  if (hasRoles) components.push({ type: "LassoPersonRoles", person: id });

  const risk = personRisk(person);
  const riskCases = risk.bankruptcies.length + risk.dissolutions.length;
  const side: ViewComponent[] = [];
  if (network.length > 0) side.push({ type: "LassoPersonNetwork", person: id });
  // Risiko står altid, når personen har roller: "ingen konkurser" er også et svar.
  if (hasRoles) side.push({ type: "LassoPersonRisk", person: id });

  // Alvorlig risiko (personen var med, da det skete) rykker risikoen op over rollerne.
  const serious = [...risk.bankruptcies, ...risk.dissolutions].some((c) => c.involved);
  if (serious && riskCases > 0) {
    const riskIdx = side.findIndex((c) => c.type === "LassoPersonRisk");
    const [riskComp] = side.splice(riskIdx, 1);
    components.splice(1, 0, riskComp!);
  }

  if (side.length === 2) side.forEach((c, i) => components.push({ ...c, column: i + 1 } as ViewComponent));
  else components.push(...side);

  const companies = personCompanies(person).length;
  return viewSpecSchema.parse({
    kind: "person",
    title: options.name ?? person.name,
    subtitle: companies ? `Roller i ${companies} ${companies === 1 ? "selskab" : "selskaber"}` : undefined,
    layout: "columns",
    columns: 2,
    components,
  });
}
