import { ownershipGraphKey, type Dataset } from "./models.js";
import { personCompanies, personRisk } from "./person.js";
import { shortCompanyName } from "./compose.js";
import { viewSpecSchema, type ViewComponent, type ViewSpec } from "./spec.js";

/**
 * Komponisten for personsiden (katalog 16), samme idé som composeCompany: data hentes først
 * (composePersonProbe), og skærmbilledet vælges derefter ud fra datas form.
 *
 * Layout 'columns' i bånd: hoved i fuld bredde; roller over tid (¾) + stamoplysninger (¼);
 * netværk (½) + risiko (½); historik (½) + nyheder (½); ejerdiagrammet i fuld bredde, når
 * personen ejer selskaber. Tomme sektioner udelades (ingen nyheder = ingen nyhedssektion), og
 * de halve rykker sammen to og to, så der aldrig står en halv alene med et hul ved siden af;
 * går de ikke op, står den sidste i fuld bredde. Har personen højst to selskaber, er rollebåndet
 * lavt, og risikoen (ellers netværket) står under rollerne i ¾-kolonnen i stedet.
 */

/** Personsidens ejerdiagram: personen øverst, de selskaber, personen ejer, og deres datterselskaber. */
export const PERSON_GRAPH_DEPTH = { ingoingDepth: 0, outgoingDepth: 2 } as const;
/** Nyheder: 5 hentes, 3 vises + "Se alle N" (regel 9). */
const NEWS_FETCHED = 5;
const NEWS_SHOWN = 3;

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
      { type: "LassoTimeline", person: p },
      { type: "LassoNews", person: p, limit: NEWS_FETCHED },
      { type: "LassoOwnershipDiagram", person: p, ...PERSON_GRAPH_DEPTH },
    ],
  });
}

export interface ComposePersonOptions {
  name?: string;
  /** Opfølgningsknapper sender en besked til modellen; slå fra på websiden uden chat. */
  followUps?: boolean;
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

  // To halve side om side i ét bånd (kolonne 1 og 2); står den ene alene, får den fuld bredde.
  const pair = (a: ViewComponent, b: ViewComponent | null) => {
    if (b) components.push({ ...a, column: 1 } as ViewComponent, { ...b, column: 2 } as ViewComponent);
    else components.push(a);
  };

  const hasRoles = person.roles.length > 0;
  const risk = personRisk(person);
  // Alvorlig risiko (personen var med, da det skete) rykker risikoen op lige under hovedet.
  const serious = [...risk.bankruptcies, ...risk.dissolutions].some((c) => c.involved);
  if (hasRoles && serious) components.push({ type: "LassoPersonRisk", person: id });

  // Få selskaber giver et lavt rollebånd ved siden af stamoplysningerne; så står risikoen (kort, og
  // den handler om de samme selskaber) under rollerne i ¾-kolonnen, så båndet ikke får et hul. Er
  // risikoen rykket op, tager netværket pladsen.
  const list = personCompanies(person);
  const short = hasRoles && list.length <= 2;
  const underRoles = !short ? null : !serious ? "LassoPersonRisk" : network.length > 0 ? "LassoPersonNetwork" : null;
  if (hasRoles) {
    components.push({ type: "LassoPersonRoles", person: id, column: 1, width: "three-quarters" });
    if (underRoles) components.push({ type: underRoles, person: id, column: 1, width: "three-quarters" });
    components.push({ type: "LassoPersonFacts", person: id, column: 2, width: "quarter" });
  } else components.push({ type: "LassoPersonFacts", person: id });

  const events = ds.timeline[id]?.events ?? [];
  const news = ds.news[id]?.items ?? [];
  const halves: ViewComponent[] = [];
  if (network.length > 0 && underRoles !== "LassoPersonNetwork") halves.push({ type: "LassoPersonNetwork", person: id });
  // Risiko står altid, når personen har roller: "ingen konkurser" er også et svar.
  if (hasRoles && !serious && underRoles !== "LassoPersonRisk") halves.push({ type: "LassoPersonRisk", person: id });
  if (events.length > 0) halves.push({ type: "LassoTimeline", person: id });
  if (news.length > 0) halves.push({ type: "LassoNews", person: id, limit: NEWS_SHOWN });
  for (let i = 0; i < halves.length; i += 2) pair(halves[i]!, halves[i + 1] ?? null);

  // Ejerdiagrammet kun, når personen ejer mindst ét selskab nu (en kant fra personen uden slutdato;
  // et ophørt ejerskab alene ville give et tomt diagram). Kunne grafen ikke hentes, men ejer
  // personen selskaber ifølge rollerne, vises diagrammets fejltilstand.
  const graphKey = ownershipGraphKey({ person: id, ...PERSON_GRAPH_DEPTH });
  const graph = ds.ownershipGraphs[graphKey];
  const ownsByRoles = person.roles.some((r) => r.active && r.kind === "owner" && !/reel/i.test(r.role));
  if (graph ? graph.edges.some((e) => e.from === id && !e.until) : Boolean(ds.errors[`graph:${graphKey}`]) && ownsByRoles) {
    components.push({ type: "LassoOwnershipDiagram", person: id, ...PERSON_GRAPH_DEPTH, title: "Ejerskab" });
  }

  // Næste naturlige spørgsmål (review P2-5): personens vigtigste aktive selskab, netværk og konkurser.
  const first = person.name.split(/\s+/)[0] ?? person.name;
  const main = list.find((c) => c.active) ?? list[0];
  const prompts = [
    main && { label: `Vis ${shortCompanyName(main.companyName)}`, prompt: `Fortæl om ${shortCompanyName(main.companyName)}${main.companyId ? ` (${main.companyId})` : ""}.` },
    network.length > 0 && { label: "Netværk", prompt: `Hvem sidder ${person.name} sammen med i selskaber?` },
    hasRoles && { label: "Konkurser", prompt: `Har ${first} været med i selskaber, der gik konkurs, og hvad skete der?` },
  ].filter((x): x is { label: string; prompt: string } => !!x);
  if (options.followUps !== false && prompts.length > 0) components.push({ type: "LassoFollowUps", prompts: prompts.slice(0, 3) });

  const companies = list.length;
  return viewSpecSchema.parse({
    kind: "person",
    title: options.name ?? person.name,
    subtitle: companies ? `Roller i ${companies} ${companies === 1 ? "selskab" : "selskaber"}` : undefined,
    layout: "columns",
    columns: 2,
    components,
  });
}
