import { entityRefOf, ownershipGraphKey, type Dataset } from "./models.js";
import { personCompanies, personFactOptions, personRisk, personRoleRows, riskTimeline, type PersonVM } from "./person.js";
import { componentWeight, FOCUSES, type Focus } from "./compose.js";
import { viewSpecSchema, type ViewComponent, type ViewSpec } from "./spec.js";

/**
 * Komponisten for personsiden (katalog 16), samme idé som composeCompany: modellen (eller portalens
 * faner) vælger kun fokus, data hentes først (composePersonProbe, kun det fokus viser), og
 * skærmbilledet vælges derefter ud fra datas form. Hovedet står på alle fokus.
 *
 * Layout 'columns' i bånd: komponenter uden kolonne står i fuld bredde; to halve side om side i ét
 * bånd (kolonne 1 og 2). En halv, der står alene, får fuld bredde, så der aldrig er et hul ved
 * siden af. Tomme sektioner udelades, undtagen på fokus, der handler om netop dem (fx "Personen
 * ejer ikke selskaber i CVR." på ejerskab), hvor den tomme tilstand er svaret.
 *
 * Ingen 1:1-gentagelser på samme side (docs/portal.md, "Personfokus og elementer"): hovedet ejer
 * antallet af roller, ejerskaber og første registrering, så stamoplysningerne udelader dem
 * (personFactOptions); tidsbåndene viser de ophørte roller, så rollefanen har ingen ophørt-liste
 * ved siden af; risikoens forløb viser selskabernes roller og status, så listen over ophørte
 * roller dér udelader de samme selskaber.
 */
export const PERSON_FOCUSES = ["overblik", "roller", "netvaerk", "ejerskab", "risiko", "historik"] as const;
export type PersonFocus = (typeof PERSON_FOCUSES)[number];

export const PERSON_FOCUS_LABELS: Record<PersonFocus, string> = {
  overblik: "Overblik",
  roller: "Roller",
  netvaerk: "Netværk",
  ejerskab: "Ejerskab",
  risiko: "Risiko",
  historik: "Historik",
};

export function isPersonFocus(value: unknown): value is PersonFocus {
  return typeof value === "string" && (PERSON_FOCUSES as readonly string[]).includes(value);
}

/**
 * Alle fokusnavne på tværs af virksomheds- og personsider (gemte sider, send til Lasso, /e/-links).
 * Hvilke der gælder, afhænger af siden: virksomheder FOCUSES, personer PERSON_FOCUSES (isFocusFor).
 */
export const PAGE_FOCUSES = [...FOCUSES, "roller", "netvaerk"] as const;
export type PageFocus = Focus | PersonFocus;

/** Er `value` et fokus for en virksomheds- eller personside? */
export function isFocusFor(kind: "company" | "person", value: unknown): value is PageFocus {
  return kind === "person" ? isPersonFocus(value) : typeof value === "string" && (FOCUSES as readonly string[]).includes(value);
}

/**
 * Personens ejerdiagram (overblik og ejerskab): personen øverst, de selskaber, personen ejer, og
 * deres datterselskaber. Ét lag ned ville kun gentage de ejede selskaber, som rollelisten allerede
 * viser med andel; andet lag viser det, der er nyt (strukturen under dem).
 */
export const PERSON_GRAPH_DEPTH = { ingoingDepth: 0, outgoingDepth: 2 } as const;

/** Regel 9 pr. fokus: overblikket viser få og "Se alle N"; fanen for emnet viser flere. */
const OVERVIEW_ROLES = 5;
const OVERVIEW_NETWORK = 3;
const OVERVIEW_EVENTS = 3;
const TAB_ROLES = 8;
const TAB_NETWORK = 8;
const NEWS = 5;

/** De komponenter, der skal hentes data til, før komponisten vælger form. Vises ikke. Kun det, fokus viser. */
export function composePersonProbe(lassoId: string, focus: PersonFocus = "overblik"): ViewSpec {
  const person = lassoId;
  // Hovedet henter personen; roller, stamoplysninger, risiko og historik afledes af den (ingen ekstra opslag).
  const components: ViewComponent[] = [{ type: "LassoPersonHead", person }];
  if (focus === "overblik" || focus === "netvaerk") components.push({ type: "LassoPersonNetwork", person });
  if (focus === "overblik" || focus === "risiko" || focus === "historik") components.push({ type: "LassoTimeline", person });
  if (focus === "historik") components.push({ type: "LassoNews", person, limit: NEWS });
  if (focus === "overblik" || focus === "ejerskab") components.push({ type: "LassoOwnershipDiagram", person, ...PERSON_GRAPH_DEPTH });
  return viewSpecSchema.parse({ kind: "person", title: lassoId, layout: "stack", components });
}

export interface ComposePersonOptions {
  focus?: PersonFocus;
  name?: string;
  /** Opfølgningsknapper sender en besked til modellen; slå fra på websiden uden chat. */
  followUps?: boolean;
}

interface FollowUpRule {
  label: string;
  prompt: string;
  needs?: (d: { roles: boolean; network: boolean; owns: boolean }) => boolean;
}

/** Næste naturlige spørgsmål pr. fokus: peger videre til de andre personfokus (show_person). */
const ROLLER: FollowUpRule = { label: "Roller", prompt: "Hvilke roller har {navn} i selskaber?", needs: (d) => d.roles };
const NETVAERK: FollowUpRule = { label: "Netværk", prompt: "Hvem sidder {navn} sammen med i selskaber?", needs: (d) => d.network };
const EJERSKAB: FollowUpRule = { label: "Ejerskab", prompt: "Hvilke selskaber ejer {navn}?", needs: (d) => d.owns };
const RISIKO: FollowUpRule = { label: "Risiko", prompt: "Har {navn} været med i selskaber, der gik konkurs?", needs: (d) => d.roles };
const HISTORIK: FollowUpRule = { label: "Historik", prompt: "Hvad er der sket med {navn} for nylig, og er der nyheder?" };
const FOLLOW_UPS: Record<PersonFocus, FollowUpRule[]> = {
  overblik: [ROLLER, NETVAERK, RISIKO, EJERSKAB],
  roller: [NETVAERK, EJERSKAB, RISIKO],
  netvaerk: [ROLLER, RISIKO, HISTORIK],
  ejerskab: [ROLLER, NETVAERK, RISIKO],
  risiko: [ROLLER, HISTORIK, NETVAERK],
  historik: [ROLLER, RISIKO, NETVAERK],
};

/** Antal rækker i stamoplysningerne (PersonFacts), med eller uden hovedets tal. */
function factRows(p: PersonVM, hideCounts: boolean): number {
  const sameAsCity = Boolean(p.municipality && p.city?.toLowerCase().startsWith(p.municipality.toLowerCase()));
  return 3 + (!p.addressProtected && !sameAsCity ? 1 : 0) + (hideCounts ? 0 : 4);
}

/**
 * Anslået højde i "linjer" (som componentWeight for virksomhedssiden) af personsidens sektioner,
 * ud fra datas form. Bruges til at vælge, hvilke halve der står side om side, så båndene bliver
 * lige høje; det er forholdet mellem tallene, der tæller.
 */
export function personComponentWeight(c: ViewComponent, ds: Dataset, page: readonly ViewComponent[] = [], opts: { half?: boolean } = {}): number {
  const TITLE = 3;
  const SOURCE = 1.2;
  const more = (n: number, limit: number) => (n > limit ? 1.5 : 0);
  switch (c.type) {
    case "LassoPersonRoles": {
      const p = ds.persons[c.person];
      if (!p) return TITLE + 6;
      const show = c.show ?? "all";
      if (show === "all") {
        const n = personCompanies(p).length;
        const limit = c.limit ?? 3;
        return TITLE + 1 + 2.4 * Math.min(n, limit) + more(n, limit) + SOURCE;
      }
      const n = personRoleRows(p, show, { except: c.except }).length;
      const limit = c.limit ?? 5;
      return TITLE + 2.5 * Math.max(1, Math.min(n, limit)) + more(n, limit) + SOURCE;
    }
    case "LassoPersonFacts": {
      const p = ds.persons[c.person];
      return TITLE + 1.6 * (p ? factRows(p, personFactOptions(page, c.person).hideCounts) : 7) + SOURCE;
    }
    case "LassoPersonNetwork": {
      const n = ds.personNetworks[c.person]?.people.length ?? 0;
      const limit = c.limit ?? 3;
      return TITLE + 3 * Math.max(1, Math.min(n, limit)) + more(n, limit) + SOURCE;
    }
    case "LassoPersonRisk": {
      const p = ds.persons[c.person];
      const r = p ? personRisk(p) : undefined;
      return TITLE + 2 * 2.9 + 0.8 * ((r?.bankruptcies.length ?? 0) + (r?.dissolutions.length ?? 0)) + SOURCE;
    }
    case "LassoOwnershipDiagram": {
      // I en halv kolonne bliver diagrammet en indrykket liste (under 560 px): én række pr. selskab,
      // højst 3 pr. ejer + "+ N" (fire står alle), ca. 44 px pr. række.
      if (!opts.half && !c.column) return 18;
      const g = ds.ownershipGraphs[ownershipGraphKey(c)];
      if (!g) return TITLE + 1.8 * 3 + SOURCE;
      const children = (id: string) => g.edges.filter((e) => e.from === id && !e.until).map((e) => e.to);
      const rows = (id: string, level: number, seen: Set<string>): number => {
        if (level >= c.outgoingDepth) return 0;
        const kids = children(id).filter((k) => !seen.has(k));
        const shown = kids.length <= 4 ? kids : kids.slice(0, 3);
        return shown.reduce((sum, k) => sum + 1 + rows(k, level + 1, new Set([...seen, k])), kids.length > shown.length ? 1 : 0);
      };
      return TITLE + 1.8 * (1 + rows(g.rootId, 0, new Set([g.rootId]))) + SOURCE;
    }
    case "LassoTimeline": {
      const p = c.person ? ds.persons[c.person] : undefined;
      const t = ds.timeline[entityRefOf(c)];
      if (c.filter === "risiko" && p && t) {
        // Samme formel som componentWeight, men kun forløbet i selskaberne med konkurs/tvangsopløsning.
        const n = riskTimeline(t, p).events.length;
        const limit = c.limit ?? 5;
        return TITLE + 4.5 * Math.min(n, limit) + more(n, limit);
      }
      return componentWeight(c, ds, page);
    }
    default:
      return componentWeight(c, ds, page);
  }
}

/**
 * De halve i den rækkefølge, fokus foretrækker, sat sammen to og to, så båndene bliver så lige
 * høje som muligt (mindst samlet forskel; ved lige forskel den foretrukne rækkefølge). Ved et ulige
 * antal står den, der er tilovers, til sidst i fuld bredde. Hvert par står i den foretrukne
 * rækkefølge (lavest først i kolonne 1), og parrene i rækkefølge efter deres første element.
 */
export function pairByWeight(halves: readonly ViewComponent[], weigh: (c: ViewComponent) => number): ViewComponent[] {
  const n = halves.length;
  if (n <= 1) return halves.map((c) => ({ ...c }) as ViewComponent);
  const w = halves.map(weigh);
  // Alle måder at parre 2–4 elementer (fem og flere parres i rækkefølge).
  const options: { pairs: [number, number][]; rest: number[] }[] =
    n === 2
      ? [{ pairs: [[0, 1]], rest: [] }]
      : n === 3
        ? [
            { pairs: [[0, 1]], rest: [2] },
            { pairs: [[0, 2]], rest: [1] },
            { pairs: [[1, 2]], rest: [0] },
          ]
        : n === 4
          ? [
              { pairs: [[0, 1], [2, 3]], rest: [] },
              { pairs: [[0, 2], [1, 3]], rest: [] },
              { pairs: [[0, 3], [1, 2]], rest: [] },
            ]
          : [{ pairs: Array.from({ length: Math.floor(n / 2) }, (_, i) => [2 * i, 2 * i + 1] as [number, number]), rest: n % 2 ? [n - 1] : [] }];
  const cost = (o: (typeof options)[number]) => o.pairs.reduce((sum, [a, b]) => sum + Math.abs(w[a]! - w[b]!), 0);
  // Kun en tydeligt bedre parring (mindst 2 linjer) slår den foretrukne rækkefølge.
  let best = options[0]!;
  for (const o of options.slice(1)) if (cost(o) < cost(best) - 2) best = o;
  const out: ViewComponent[] = [];
  for (const [a, b] of [...best.pairs].sort((x, y) => x[0] - y[0])) {
    out.push({ ...halves[a]!, column: 1 } as ViewComponent, { ...halves[b]!, column: 2 } as ViewComponent);
  }
  for (const r of best.rest) out.push({ ...halves[r]! } as ViewComponent);
  return out;
}

export function composePerson(lassoId: string, ds: Dataset, options: ComposePersonOptions = {}): ViewSpec {
  const focus = options.focus ?? "overblik";
  const id = lassoId;
  const person = ds.persons[id];
  const network = ds.personNetworks[id]?.people ?? [];
  const components: ViewComponent[] = [{ type: "LassoPersonHead", person: id }];
  const subtitle = focus === "overblik" ? undefined : PERSON_FOCUS_LABELS[focus];

  // Uden persondata (fejl eller ukendt ID) viser hovedet selv fejlen; resten ville kun gentage den.
  if (!person) {
    return viewSpecSchema.parse({ kind: "person", title: options.name ?? lassoId, subtitle, layout: "columns", columns: 2, components });
  }

  const list = personCompanies(person);
  const hasRoles = person.roles.length > 0;
  const risk = personRisk(person);
  const cases = [...risk.bankruptcies, ...risk.dissolutions];
  const events = ds.timeline[id]?.events ?? [];
  const news = ds.news[id]?.items ?? [];
  const ownsByRoles = person.roles.some((r) => r.active && r.kind === "owner" && !/reel/i.test(r.role));
  // Ejerdiagrammet kun, når det viser noget, rollelisten ikke gør: at de selskaber, personen ejer nu,
  // selv ejer selskaber (som virksomhedssiden, der kun viser diagrammet, når et selskab ejer). Ejer de
  // ingenting, ville diagrammet kun gentage "ejer X %" fra listen 1:1. Kunne grafen ikke hentes, men
  // ejer personen selskaber ifølge rollerne, viser fokus ejerskab diagrammets fejltilstand; overblikket
  // udelader det, som det udelader andre sektioner uden data.
  const diagram = (opts: { title?: string; showError: boolean }): ViewComponent | null => {
    const key = ownershipGraphKey({ person: id, ...PERSON_GRAPH_DEPTH });
    const graph = ds.ownershipGraphs[key];
    const owned = new Set(graph?.edges.filter((e) => e.from === id && !e.until).map((e) => e.to) ?? []);
    const structure = graph ? graph.edges.some((e) => owned.has(e.from) && !e.until) : opts.showError && Boolean(ds.errors[`graph:${key}`]) && ownsByRoles;
    return structure ? { type: "LassoOwnershipDiagram", person: id, ...PERSON_GRAPH_DEPTH, ...(opts.title ? { title: opts.title } : {}) } : null;
  };
  // To halve side om side i ét bånd; står den ene alene, får den fuld bredde.
  const pair = (halves: ViewComponent[]) => {
    const page = [...components, ...halves];
    components.push(...pairByWeight(halves, (c) => personComponentWeight(c, ds, page, { half: true })));
  };
  const facts: ViewComponent = { type: "LassoPersonFacts", person: id };
  // ¾ + ¼ i ét bånd (hovedelementet og stamoplysningerne); uden hovedelement står stamoplysningerne alene.
  const withFacts = (main: ViewComponent | null) => {
    if (!main) return void components.push(facts);
    components.push({ ...main, column: 1, width: "three-quarters" } as ViewComponent, { ...facts, column: 2, width: "quarter" } as ViewComponent);
  };

  switch (focus) {
    case "roller":
      // Alle roller som tidsbånd (de ophørte stiplede), flere selskaber end på overblikket.
      withFacts({ type: "LassoPersonRoles", person: id, limit: TAB_ROLES });
      break;
    case "netvaerk":
      // Hele netværket; tom tilstand, når personen ikke sidder sammen med nogen (det er svaret).
      components.push({ type: "LassoPersonNetwork", person: id, limit: TAB_NETWORK });
      break;
    case "ejerskab": {
      // De ejede selskaber med andel og siden-dato (tom tilstand: "Personen ejer ikke selskaber i CVR."),
      // og strukturen under dem som diagram, når de selv ejer selskaber.
      components.push({ type: "LassoPersonRoles", person: id, show: "owner" });
      const d = diagram({ showError: true });
      if (d) components.push(d);
      break;
    }
    case "risiko": {
      // Alle sager med detaljer; uden sager kun den positive tomme tilstand.
      components.push({ type: "LassoPersonRisk", person: id });
      if (cases.length === 0) break;
      const halves: ViewComponent[] = [];
      // Forløbet i de berørte selskaber (ind, ud og status), ikke kun statushændelserne, som sagerne allerede viser.
      halves.push({ type: "LassoTimeline", person: id, filter: "risiko", title: "Forløb i selskaberne" });
      if (personRoleRows(person, "ended", { except: "risiko" }).length > 0) {
        halves.push({ type: "LassoPersonRoles", person: id, show: "ended", except: "risiko", title: "Øvrige ophørte roller" });
      }
      pair(halves);
      break;
    }
    case "historik": {
      const halves: ViewComponent[] = [];
      if (events.length > 0) halves.push({ type: "LassoTimeline", person: id });
      if (news.length > 0 || ds.errors[`news:${id}`]) halves.push({ type: "LassoNews", person: id, limit: NEWS });
      // Hverken rolleskift eller nyheder: historikkens tomme tilstand siger det.
      if (halves.length === 0) halves.push({ type: "LassoTimeline", person: id });
      pair(halves);
      break;
    }
    default: {
      // Overblik. Alvorlig risiko (personen var med, da det skete) står lige under hovedet.
      const serious = hasRoles && cases.some((c) => c.involved);
      if (serious) components.push({ type: "LassoPersonRisk", person: id });
      // De aktive roller som kort liste (¾) + stamoplysninger (¼); uden aktive roller de ophørte.
      const current = personRoleRows(person, "current").length > 0;
      const ended = personRoleRows(person, "ended").length > 0;
      withFacts(
        current
          ? { type: "LassoPersonRoles", person: id, show: "current", limit: OVERVIEW_ROLES }
          : ended
            ? { type: "LassoPersonRoles", person: id, show: "ended", limit: OVERVIEW_ROLES }
            : null,
      );
      // Netværk, risiko, historik og ejerskab to og to; ingen nyheder på overblikket (de står på historik).
      const halves: ViewComponent[] = [];
      if (network.length > 0) halves.push({ type: "LassoPersonNetwork", person: id, limit: OVERVIEW_NETWORK });
      // Risiko står altid, når personen har roller: "ingen konkurser" er også et svar.
      if (hasRoles && !serious) halves.push({ type: "LassoPersonRisk", person: id });
      if (events.length > 0) halves.push({ type: "LassoTimeline", person: id, limit: OVERVIEW_EVENTS });
      const d = diagram({ title: "Ejerskab", showError: false });
      if (d) halves.push(d);
      pair(halves);
    }
  }

  const name = options.name ?? person.name;
  const data = { roles: hasRoles, network: network.length > 0, owns: person.roles.some((r) => r.active && r.kind === "owner") };
  const prompts = FOLLOW_UPS[focus]
    .filter((f) => f.needs === undefined || f.needs(data))
    .slice(0, 3)
    .map((f) => ({ label: f.label, prompt: f.prompt.replace("{navn}", name) }));
  if (options.followUps !== false && prompts.length > 0) components.push({ type: "LassoFollowUps", prompts });

  const companies = list.length;
  return viewSpecSchema.parse({
    kind: "person",
    title: name,
    subtitle: subtitle ?? (companies ? `Roller i ${companies} ${companies === 1 ? "selskab" : "selskaber"}` : undefined),
    layout: "columns",
    columns: 2,
    components,
  });
}
