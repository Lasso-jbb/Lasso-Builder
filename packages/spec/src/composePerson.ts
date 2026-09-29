import { entityRefOf, ownershipGraphKey, type Dataset } from "./models.js";
import { askLabel, askPersonFocus, askPlan, type Ask, type AskItem } from "./ask.js";
import { personCompanies, personFactOptions, personRisk, personRoleRows, personWithRole, riskTimeline, type PersonVM } from "./person.js";
import { askComponent, askProbe, componentWeight, contentMinWidthFn, FOCUSES, gridHeight, ITEM_PADDING, type Focus } from "./compose.js";
import { bandsToComponents, compactOf, measuredHeight, originOf, packBandsPaired, pageHeight, PAGE_HEIGHT_BUDGET, type PackedBand } from "./grid.js";
import { widthProfileOf } from "./catalog.js";
import { viewSpecSchema, type ViewComponent, type ViewSpec, type Width } from "./spec.js";

/**
 * Komponisten for personsiden (katalog 16), samme idé som composeCompany: modellen (eller portalens
 * faner) vælger kun fokus, data hentes først (composePersonProbe, kun det fokus viser), og
 * skærmbilledet vælges derefter ud fra datas form. Hovedet står på alle fokus.
 *
 * Layout 'columns' i bånd, pakket med gridmodellen (packPersonPage, Ø13/B10): hver komponents
 * bredde følger reglen (gridRuleOf), profilen (widthProfileOf) og indholdet (contentWidthOf), så
 * netværket med reelle data står i eget fuldbånd, en smal liste (aktive roller, stamoplysninger)
 * højst i ½ ved siden af andre, og intet bredt element står under sin mindstebredde. Et element,
 * der står alene i et bånd, får fuld bredde, så der aldrig er et hul ved siden af. Tomme sektioner
 * udelades, undtagen på fokus, der handler om netop dem (fx "Personen ejer ikke selskaber i CVR."
 * på ejerskab), hvor den tomme tilstand er svaret.
 *
 * Ingen 1:1-gentagelser på samme side (docs/portal.md, "Personfokus og elementer"): hovedet ejer
 * antallet af roller, ejerskaber og første registrering, så stamoplysningerne udelader dem
 * (personFactOptions); tidsbåndene viser de ophørte roller, så rollefanen har ingen ophørt-liste
 * ved siden af.
 *
 * Hvert modul ejer sit indhold (som på virksomhedssiden): rollerne står på roller, netværket på
 * netvaerk, historikken på historik. Overblikket viser smagsprøver med "Se alle … i <fane>", der
 * åbner fanen (more); de øvrige fokus låner ikke hinandens elementer (risiko har ingen liste over
 * ophørte roller; den hører til roller).
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

/** Personsidens højdebudget (px ved 1200), samme som virksomhedssiden (23.3). */
export const PERSON_PAGE_BUDGET = PAGE_HEIGHT_BUDGET;

/** Regel 9 pr. fokus: overblikket viser få og "Se alle N"; fanen for emnet viser flere. */
const OVERVIEW_ROLES = 5;
const OVERVIEW_NETWORK = 3;
const OVERVIEW_EVENTS = 3;
const TAB_ROLES = 8;
const TAB_NETWORK = 8;
const NEWS = 5;

/** Personens ejerdiagram får altid personsidens dybde (proben og komponisten henter samme graf). */
const withPersonDepth = (c: ViewComponent): ViewComponent => (c.type === "LassoOwnershipDiagram" ? { ...c, ...PERSON_GRAPH_DEPTH } : c);

/**
 * De komponenter, der skal hentes data til, før komponisten vælger form. Vises ikke. Kun det, fokus
 * viser; med et (ikke-generisk) spørgsmål alt i planen for spørgsmålet.
 */
export function composePersonProbe(lassoId: string, focus?: PersonFocus, ask?: Ask): ViewSpec {
  const plan = ask && !ask.generic ? askPlan(ask, "person") : undefined;
  if (plan?.lead.length) return askProbe(lassoId, "person", [...plan.top, ...plan.lead, ...plan.context], withPersonDepth);
  focus = focus ?? (ask ? askPersonFocus(ask) : undefined) ?? "overblik";
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
  /**
   * Spørgsmålsprofilen (parseAsk). Ikke generisk: en hel side i spørgsmålets kontekst (askPlan), hvor
   * svar-elementet står først; generisk: fokus-siden (focus, ellers askPersonFocus, ellers overblik).
   */
  ask?: Ask;
  /** "Vis alt om X" (brugervalg): alle elementer i fuld form, også ud over højdebudgettet. */
  showAll?: boolean;
  /** Højdebudget i px ved 1200 (standard PAGE_HEIGHT_BUDGET, som virksomhedssiden). Ignoreres med showAll. */
  heightBudget?: number;
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
    case "LassoPersonStats":
      // Tre små tal-kort i én række (målt 90 px i alle bredder).
      return TITLE + 1.25;
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
 * Papers "to og to" (katalog 16/26g), som højdebudgettet regner med (B10: kun til budgettet; selve
 * siden pakkes efter bredderne med packPersonPage). De halve i den rækkefølge, fokus foretrækker, sat
 * sammen to og to, så båndene bliver så lige høje som muligt (mindst samlet forskel; ved lige forskel den foretrukne rækkefølge). Ved et ulige
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

/** Linjer -> px for personsidens egne sektioner (titel 60 px + ca. 24 px pr. linje i personComponentWeight). */
const PERSON_TITLE_PX = 60;
const PERSON_LINE_PX = 24;

/**
 * Højde (px, som packPage: elementet + 48 px luft) af én sektion i bredden. Personsidens egne typer
 * (roller, stamoplysninger, netværk, risiko, personens ejerdiagram) regnes ud fra personComponentWeight,
 * så en kortere liste (kompakt form) også giver en lavere side; resten som på virksomhedssiden (gridHeight).
 */
export function personItemHeight(c: ViewComponent, width: Width, ds: Dataset, page: readonly ViewComponent[]): number {
  const own = c.type.startsWith("LassoPerson") && c.type !== "LassoPersonHead";
  if (own || (c.type === "LassoOwnershipDiagram" && "person" in c && c.person)) {
    const half = width !== "full";
    const w = personComponentWeight(c, ds, page, { half });
    const lines = PERSON_TITLE_PX + Math.max(0, w - 3) * PERSON_LINE_PX;
    return Math.round(c.type === "LassoOwnershipDiagram" && !half ? Math.max(lines, measuredHeight(c, width)) : lines) + ITEM_PADDING;
  }
  return gridHeight(c, width, ds, page) + ITEM_PADDING;
}

/**
 * Personsidens højde (px) i layout 'columns', læst som LassoView.columnBands: komponenter uden kolonne
 * står i eget fuldbånd; komponenter med kolonne samles i ét bånd (et lavere kolonnenummer starter et nyt),
 * og båndet er så højt som den højeste stak. Samme enhed som packPage (gap 0).
 */
export function personPageHeight(components: readonly ViewComponent[], ds: Dataset): number {
  let total = 0;
  let band: number[] = [];
  let last = 0;
  const flush = () => {
    if (band.length) total += Math.max(...band);
    band = [];
  };
  for (const c of components) {
    if (!c.column) {
      flush();
      total += personItemHeight(c, c.width ?? "full", ds, components);
      last = 0;
      continue;
    }
    if (last === 0 || c.column < last) flush();
    while (band.length < c.column) band.push(0);
    band[c.column - 1]! += personItemHeight(c, c.width ?? "half", ds, components);
    last = c.column;
  }
  flush();
  return total;
}

/**
 * Personsidens pakning (Ø13, B10): grupperne pakkes i rækkefølge, hver for sig, med gridmodellen
 * (packBands) og den indholdsstyrede mindstebredde (contentMinWidthFn), så Papers rækkefølge holder
 * (hoved, persontal, svar-elementet med stamoplysningerne, derefter resten). Højderne er personsidens
 * (personItemHeight). Deterministisk.
 *
 * To elementer, der ellers ville stå i hvert sit fuldbånd, sættes side om side, når det kan lade sig gøre
 * (packBandsPaired, som personsidens "to og to" hidtil). En gruppe med to elementer (svaret og
 * stamoplysningerne), der stadig ikke kan dele bånd (svaret kræver fuld bredde, fx netværket), sender det
 * andet videre til næste gruppe, så stamoplysningerne står ved siden af noget i stedet for alene.
 */
export function packPersonPage(groups: readonly (readonly ViewComponent[])[], ds: Dataset): { bands: PackedBand[]; components: ViewComponent[]; height: number } {
  const page = groups.flat();
  const h = (c: ViewComponent, width: Width) => personItemHeight(c, width, ds, page);
  const options = { gap: 0, minWidth: contentMinWidthFn(ds) };
  // Resten (3–5 elementer) pakkes i den rækkefølge, der giver den laveste side (som Papers "to og to" valgte
  // de mest lige bånd). En smal komponent alene i fuld bredde (lovlig, men med tom plads, Ø13) tæller med
  // halvdelen af sin højde oveni. Ved lige værdi den rækkefølge, der ligger tættest på prioriteten. Deterministisk.
  const pack = (list: readonly ViewComponent[]): PackedBand[] => {
    if (list.length < 3 || list.length > 5) return packBandsPaired(list, h, options);
    let best: { bands: PackedBand[]; height: number; inversions: number } | null = null;
    for (const order of permutations(list.length)) {
      const bands = packBandsPaired(order.map((i) => list[i]!), h, options);
      const stretched = bands.reduce((sum, b) => {
        const only = b.stacks.length === 1 && b.stacks[0]!.items.length === 1 ? b.stacks[0]!.items[0]! : undefined;
        return sum + (only && widthProfileOf(only).profil === "smal" ? b.height / 2 : 0);
      }, 0);
      const height = pageHeight(bands, 0) + stretched;
      const read = bands.flatMap((b) => b.stacks.flatMap((st) => st.items.map((c) => list.indexOf(originOf(c)))));
      let inversions = 0;
      for (let a = 0; a < read.length; a++) for (let b = a + 1; b < read.length; b++) if (read[a]! > read[b]!) inversions++;
      if (!best || height < best.height || (height === best.height && inversions < best.inversions)) best = { bands, height, inversions };
    }
    return best!.bands;
  };
  const bands: PackedBand[] = [];
  let carry: ViewComponent[] = [];
  groups.forEach((group, i) => {
    const list = [...carry, ...group];
    carry = [];
    if (list.length === 0) return;
    let packed = pack(list);
    if (list.length === 2 && packed.length === 2 && i < groups.length - 1) {
      carry = [list[1]!];
      packed = packed.slice(0, 1);
    }
    bands.push(...packed);
  });
  if (carry.length) bands.push(...pack(carry));
  return { bands, components: bandsToComponents(bands), height: pageHeight(bands, 0) };
}

/** Alle ombytninger af 0..n-1 i leksikografisk rækkefølge (identiteten først). */
function permutations(n: number): number[][] {
  const out: number[][] = [];
  const walk = (prefix: number[], rest: number[]) => {
    if (rest.length === 0) return void out.push(prefix);
    rest.forEach((x, i) => walk([...prefix, x], [...rest.slice(0, i), ...rest.slice(i + 1)]));
  };
  walk([], Array.from({ length: n }, (_, i) => i));
  return out;
}

/**
 * Kompakt form på personsiden (højdebudgettet): kortere lister med "Se alle N" (regel 9). Roller 3,
 * netværk 2, historik og nyheder 3 (compactOf). Null = ingen kompakt form.
 */
export function compactPersonItem(c: ViewComponent): ViewComponent | null {
  if (c.type === "LassoPersonRoles" && (c.show ?? "all") !== "owner" && (c.limit ?? 5) > 3) return { ...c, limit: 3 };
  if (c.type === "LassoPersonNetwork" && (c.limit ?? 3) > 2) return { ...c, limit: 2 };
  return compactOf(c);
}

export function composePerson(lassoId: string, ds: Dataset, options: ComposePersonOptions = {}): ViewSpec {
  // Et spørgsmål med et emne: en hel side i spørgsmålets kontekst; ellers fokus-siden som hidtil.
  if (options.ask && !options.ask.generic && askPlan(options.ask, "person").lead.length) return composeAskPerson(lassoId, ds, options.ask, options);
  const focus = options.focus ?? (options.ask ? askPersonFocus(options.ask) : undefined) ?? "overblik";
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
  // Resten af siden (efter hovedet og svar-elementet) pakkes som én gruppe (packPersonPage). Pakningen
  // sker efter højdebudgettet (nedenfor), så udeladte og kompakte elementer pakkes, som de faktisk står.
  let halves: ViewComponent[] = [];
  let droppable = false;
  const pair = (list: ViewComponent[]) => {
    halves = list;
  };
  const facts: ViewComponent = { type: "LassoPersonFacts", person: id };
  const stats: ViewComponent = { type: "LassoPersonStats", person: id };
  // Hovedelementet og stamoplysningerne pakkes sammen (én gruppe): bredderne følger reglerne (Ø13), fx
  // aktive roller ½ + stamoplysninger ½; uden hovedelement står stamoplysningerne alene.
  let withFactsMain: ViewComponent | null = null;
  const withFacts = (main: ViewComponent | null) => {
    if (main) {
      withFactsMain = main;
      components.push(main);
    }
    components.push(facts);
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
      // Forløbet i de berørte selskaber (ind, ud og status), ikke kun statushændelserne, som sagerne
      // allerede viser, i fuld bredde. De øvrige ophørte roller står på roller (tidsbåndene).
      components.push({ type: "LassoTimeline", person: id, filter: "risiko", title: "Forløb i selskaberne" });
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
      // Overblik. B4: persontallene (netværk, konkurser, tvangsopløsninger) lige under hovedet i fuld bredde,
      // når budgettet giver plads (se nedenfor). Alvorlig risiko (personen var med, da det skete) står derunder.
      if (hasRoles) components.push(stats);
      const serious = hasRoles && cases.some((c) => c.involved);
      if (serious) components.push({ type: "LassoPersonRisk", person: id });
      // De aktive roller som kort liste + stamoplysninger (½ + ½, smal højst ½); uden aktive roller de ophørte.
      const current = personRoleRows(person, "current").length > 0;
      const ended = personRoleRows(person, "ended").length > 0;
      // Smagsprøverne på fanerne: "Se alle … i Roller/Netværk/Historik" åbner fanen (more).
      withFacts(
        current
          ? { type: "LassoPersonRoles", person: id, show: "current", limit: OVERVIEW_ROLES, more: "roller" }
          : ended
            ? { type: "LassoPersonRoles", person: id, show: "ended", limit: OVERVIEW_ROLES, more: "roller" }
            : null,
      );
      // Netværk (fuld bredde), risiko, historik og ejerskab pakket efter bredderne; ingen nyheder på overblikket (de står på historik).
      const halves: ViewComponent[] = [];
      if (network.length > 0) halves.push({ type: "LassoPersonNetwork", person: id, limit: OVERVIEW_NETWORK, more: "netvaerk" });
      // Risiko står altid, når personen har roller: "ingen konkurser" er også et svar.
      if (hasRoles && !serious) halves.push({ type: "LassoPersonRisk", person: id });
      if (events.length > 0) halves.push({ type: "LassoTimeline", person: id, limit: OVERVIEW_EVENTS, more: "historik" });
      const d = diagram({ title: "Ejerskab", showError: false });
      if (d) halves.push(d);
      pair(halves);
      // Overblikket har intet svar-element ud over hovedet og hovedelementet: de halve kan udelades.
      droppable = true;
    }
  }

  // Højdebudget (23.3, som composeCompany/packWithinBudget): hoved, svar-elementet (det første efter
  // hovedet) og opfølgning er altid med. Er siden over budgettet, vises først alt med en kompakt form
  // kompakt; er den stadig for lang (kun overblikket), udelades de mindst relevante halve bagfra
  // (ejerskab, historik, risiko, netværk). Til sidst får kompakte elementer den fulde form tilbage i
  // prioriteret rækkefølge, når siden stadig holder budgettet. "Vis alt" (showAll) slår budgettet fra.
  const budget = options.showAll ? Number.POSITIVE_INFINITY : (options.heightBudget ?? PERSON_PAGE_BUDGET);
  // Opfølgningen står altid nederst (fuldbånd); den tæller med i højden.
  const foot = options.followUps !== false ? personItemHeight({ type: "LassoFollowUps", prompts: [{ label: "-", prompt: "-" }] } as ViewComponent, "full", ds, []) : 0;
  // B10: budgettet (hvilke elementer der står, og i hvilken form) regnes som Papers personside (26g):
  // hovedelementet ¾ + stamoplysninger ¼ og de halve to og to (pairByWeight). Selve siden pakkes bagefter
  // efter bredderne (packPersonPage, Ø13), så den nye pakning kun ombryder siden og aldrig koster et
  // element (eller en linje i tekstkortet, Ø4). Den ombrudte side kan derfor være højere end budgettet.
  const fits = (list: readonly ViewComponent[]) => personPageHeight(list, ds) + foot <= budget;
  const fit = (mains: readonly ViewComponent[]) => {
    const layout = (hs: readonly ViewComponent[], compacted: ReadonlySet<ViewComponent>) => {
      const form = (c: ViewComponent) => (compacted.has(c) ? (compactPersonItem(c) ?? c) : c);
      const m = mains.map((c, i) =>
        c === withFactsMain && mains[i + 1] === facts
          ? ({ ...form(c), column: 1, width: "three-quarters" } as ViewComponent)
          : c === facts && mains[i - 1] === withFactsMain
            ? ({ ...form(c), column: 2, width: "quarter" } as ViewComponent)
            : form(c),
      );
      const h = hs.map(form);
      const page = [...m, ...h];
      return [...m, ...pairByWeight(h, (c) => personComponentWeight(c, ds, page, { half: true }))];
    };
    // Siden, som den tegnes: hvert af de første elementer i eget bånd, hovedelementet med stamoplysningerne.
    const pack = (hs: readonly ViewComponent[], compacted: ReadonlySet<ViewComponent>) => {
      const form = (c: ViewComponent) => (compacted.has(c) ? (compactPersonItem(c) ?? c) : c);
      const groups: ViewComponent[][] = [];
      mains.forEach((c, i) => {
        if (c === facts && mains[i - 1] === withFactsMain) groups.at(-1)!.push(form(c));
        else groups.push([form(c)]);
      });
      groups.push(hs.map(form));
      return packPersonPage(groups, ds).components;
    };
    let kept = halves;
    let compacted = new Set<ViewComponent>();
    let chosen = layout(kept, compacted);
    if (!fits(chosen)) {
      // Svar-elementet (første element efter hovedet og persontallene) står altid i fuld form.
      const answer = mains.find((c, i) => i > 0 && c !== stats);
      compacted = new Set([...mains, ...halves].filter((c) => c !== answer && compactPersonItem(c) !== null));
      chosen = layout(kept, compacted);
      while (!fits(chosen) && droppable && kept.length > 0) {
        kept = kept.slice(0, -1);
        chosen = layout(kept, compacted);
      }
      for (const c of [...mains, ...kept]) {
        if (!compacted.has(c)) continue;
        const without = new Set(compacted);
        without.delete(c);
        const trial = layout(kept, without);
        if (fits(trial)) {
          compacted = without;
          chosen = trial;
        }
      }
    }
    return { chosen: pack(kept, compacted), kept: kept.length, compacted: compacted.size };
  };
  // B4: persontallene kommer kun med, når de ikke koster et af overblikkets halve eller en kompakt form
  // (Papers side står som før); "vis alt" viser dem altid.
  let result = fit(components);
  if (components.includes(stats)) {
    const without = fit(components.filter((c) => c !== stats));
    if (!(result.kept === without.kept && result.compacted <= without.compacted)) result = without;
  }
  components.length = 0;
  components.push(...result.chosen);

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

/**
 * Viser personens ejerdiagram noget, rollelisten ikke gør (de ejede selskaber ejer selv selskaber)?
 * Samme regel som på overblikket og ejerskab.
 */
function diagramShowsStructure(ds: Dataset, id: string): boolean {
  const graph = ds.ownershipGraphs[ownershipGraphKey({ person: id, ...PERSON_GRAPH_DEPTH })];
  if (!graph) return false;
  const owned = new Set(graph.edges.filter((e) => e.from === id && !e.until).map((e) => e.to));
  return graph.edges.some((e) => owned.has(e.from) && !e.until);
}

/** Højst 12 komponenter i en spec; én plads er til opfølgningen. */
const ASK_MAX_PERSON = 11;

/**
 * Personsiden for et spørgsmål (askPlan): hovedet, svar-elementet først (med stamoplysningerne ved
 * siden af, eller i fuld bredde: bopæl og ejerstruktur), derefter de øvrige svar og kontekstmodulerne
 * i rangorden. Bredderne følger gridmodellen (packPersonPage, Ø13/B10): et svar, der kræver fuld
 * bredde (netværket), står i eget bånd, og stamoplysningerne går så med konteksten; en smal liste står
 * højst i ½ ved siden af andre. Tomme kontekstmoduler udelades.
 */
function composeAskPerson(lassoId: string, ds: Dataset, ask: Ask, options: ComposePersonOptions): ViewSpec {
  const id = lassoId;
  const person = ds.persons[id];
  const components: ViewComponent[] = [{ type: "LassoPersonHead", person: id }];
  const subtitle = askLabel(ask, "person");
  if (!person) return viewSpecSchema.parse({ kind: "person", title: options.name ?? lassoId, subtitle, layout: "columns", columns: 2, components });

  const plan = askPlan(ask, "person");
  const network = ds.personNetworks[id]?.people ?? [];
  const news = ds.news[id]?.items ?? [];
  const hasRoles = person.roles.length > 0;
  const adapt = (i: AskItem, lead: boolean): ViewComponent | null => {
    const c = withPersonDepth(askComponent(i, "person", id));
    if (lead) return c;
    switch (c.type) {
      case "LassoPersonRoles": {
        const p = personWithRole(person, c.role);
        const show = c.show ?? "all";
        return (show === "all" ? personCompanies(p).length : personRoleRows(p, show, { except: c.except }).length) > 0 ? c : null;
      }
      case "LassoPersonNetwork":
        return network.length > 0 ? c : null;
      case "LassoTimeline": {
        const t = ds.timeline[id];
        if (!t) return null;
        return (c.filter === "risiko" ? riskTimeline(t, person).events : t.events).length > 0 ? c : null;
      }
      case "LassoPersonRisk":
        // "Ingen konkurser" er også et svar, når personen har roller (som på overblikket).
        return hasRoles ? c : null;
      case "LassoOwnershipDiagram":
        return diagramShowsStructure(ds, id) ? c : null;
      case "LassoNews":
        return news.length > 0 ? c : null;
      default:
        return c;
    }
  };

  const seen = new Set<string>(["LassoPersonHead"]);
  const take = (c: ViewComponent | null): c is ViewComponent => {
    if (!c || seen.has(c.type)) return false;
    seen.add(c.type);
    return true;
  };
  const leads = plan.lead.map((i) => adapt(i, true)).filter(take);
  const halves: ViewComponent[] = [];
  const [first, ...rest] = leads;
  // Svaret og stamoplysningerne pakkes sammen (som på roller-fanen); bopæl og ejerstruktur står alene.
  const answer: ViewComponent[] = [];
  if (first && (first.type === "LassoPersonFacts" || first.type === "LassoOwnershipDiagram")) answer.push(first);
  else if (first) {
    seen.add("LassoPersonFacts");
    answer.push(first, { type: "LassoPersonFacts", person: id });
  }
  halves.push(...rest);
  for (const i of plan.context) {
    if (components.length + answer.length + halves.length >= ASK_MAX_PERSON) break;
    const c = adapt(i, false);
    if (take(c)) halves.push(c);
  }
  const packed = packPersonPage([components.slice(), answer, halves], ds);
  components.length = 0;
  components.push(...packed.components);

  const focus = askPersonFocus(ask) ?? "overblik";
  const name = options.name ?? person.name;
  const data = { roles: hasRoles, network: network.length > 0, owns: person.roles.some((r) => r.active && r.kind === "owner") };
  // Altid en vej til hele personsiden (niveau C), dernæst fokusets naturlige næste spørgsmål.
  const whole: FollowUpRule = { label: "Hele overblikket", prompt: "Hvem er {navn}?" };
  const prompts = [whole, ...FOLLOW_UPS[focus]]
    .filter((f) => f.needs === undefined || f.needs(data))
    .slice(0, 3)
    .map((f) => ({ label: f.label, prompt: f.prompt.replace("{navn}", name) }));
  if (options.followUps !== false && prompts.length > 0) components.push({ type: "LassoFollowUps", prompts });

  return viewSpecSchema.parse({ kind: "person", title: name, subtitle, layout: "columns", columns: 2, components });
}
