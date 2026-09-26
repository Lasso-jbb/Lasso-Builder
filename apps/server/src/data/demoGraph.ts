import type { CompanyVM, OwnershipEdgeVM, OwnershipGraphVM, OwnershipNodeVM } from "@lasso/spec";
import type { OwnershipGraphOptions } from "./provider.js";

/**
 * Opdigtet koncern til ejerdiagrammet (katalog 14). Alle navne indeholder "Eksempel" eller
 * "Prøve", og CVR-numrene ligger uden for CVR's interval. Koncernen har:
 *  - en holding (Eksempel Holding ApS) ejet 100 % af en person,
 *  - flere lag og over 5 datterselskaber i ét lag (giver "+N flere datterselskaber"),
 *  - en lang kæde med én ejer pr. led under Eksempel Ejendomme ApS (foldes til "+N mellemled"),
 *  - cirkulært ejerskab: Eksempel Byg Invest ApS ejes 100 % af Eksempel Byg A/S og ejer 5–9,99 % af den,
 *  - en person med en mindre andel (Anne Eksempel i Eksempel Byg A/S),
 *  - et udenlandsk datterselskab og et ophørt ejerskab.
 */

type Extra = Omit<OwnershipNodeVM, "root">;

const person = (id: string, name: string): Extra => ({ id: `CVR-3-${id}`, name, kind: "person" });
const company = (cvr: string, name: string, form: string, extra: Partial<Extra> = {}): Extra => ({ id: `CVR-1-${cvr}`, name, kind: "company", cvr, form, status: "Aktiv", statusKind: "active", ...extra });

const EXTRA: Extra[] = [
  person("99100001", "Bo Eksempel"),
  person("99100002", "Anne Eksempel"),
  person("99100003", "Erik Prøve"),
  person("99100004", "Fie Eksempel"),
  person("99100005", "Gitte Prøve"),
  person("99100006", "Kim Prøve"),
  person("99100007", "Lene Eksempel"),
  person("99100008", "Mads Eksempel"),
  person("99100009", "Ole Eksempel"),
  person("99100010", "Tina Prøve"),
  person("99100011", "Uffe Prøve"),
  company("99000101", "Eksempel Byg Invest ApS", "ApS"),
  company("99000102", "Eksempel Service ApS", "ApS"),
  company("99000103", "Eksempel Udvikling ApS", "ApS", { status: "Ophørt", statusKind: "inactive" }),
  { id: "NO-999000104", name: "Eksempel Nordic AS", kind: "company", form: "AS", country: "NO", registrationNo: "999 000 104", status: "Aktiv", statusKind: "active" },
  company("99000105", "Eksempel Energi Invest ApS", "ApS"),
  company("99000106", "Eksempel Byg Drift ApS", "ApS"),
  company("99000107", "Eksempel Maskin Service ApS", "ApS"),
  company("99000110", "Eksempel Ejendom Drift ApS", "ApS"),
  company("99000111", "Eksempel Ejendom Projekt I ApS", "ApS"),
  company("99000112", "Eksempel Ejendom Projekt II ApS", "ApS"),
  company("99000113", "Eksempel Ejendom Projekt III ApS", "ApS"),
  company("99000114", "Eksempel Ejendom Projekt IV ApS", "ApS"),
  company("99000115", "Eksempel Ejendom Grund ApS", "ApS"),
];

const e = (from: string, to: string, lo: number, hi = lo, extra: Partial<OwnershipEdgeVM> = {}): OwnershipEdgeVM => ({ from, to, share: [lo, hi], since: "2012-05-14", ...extra });
const C = (cvr: string) => `CVR-1-${cvr}`;
const P = (id: string) => `CVR-3-${id}`;

const EDGES: OwnershipEdgeVM[] = [
  // Holdingen og dens ejer
  e(P("99100001"), C("99000010"), 100),
  // Holdingens datterselskaber (8 i ét lag)
  e(C("99000010"), C("99000001"), 66.67, 89.99),
  e(C("99000010"), C("99000004"), 100),
  e(C("99000010"), C("99000008"), 50, 66.66),
  e(C("99000010"), C("99000012"), 100),
  e(C("99000010"), C("99000102"), 100),
  e(C("99000010"), C("99000103"), 100, 100, { until: "2023-06-30" }),
  e(C("99000010"), "NO-999000104", 50, 66.66),
  e(C("99000010"), C("99000105"), 10, 14.99, { votes: [15, 19.99] }),
  // Eksempel Byg A/S: en person med andel og cirkulært ejerskab via datterselskabet
  e(P("99100002"), C("99000001"), 10, 14.99),
  e(C("99000001"), C("99000101"), 100),
  e(C("99000101"), C("99000001"), 5, 9.99),
  e(C("99000001"), C("99000106"), 100),
  // Maskinfabrikken
  e(C("99000008"), C("99000107"), 100),
  // Lang kæde under Eksempel Ejendomme ApS
  e(C("99000012"), C("99000110"), 100),
  e(C("99000110"), C("99000111"), 100),
  e(C("99000111"), C("99000112"), 100),
  e(C("99000112"), C("99000113"), 100),
  e(C("99000113"), C("99000114"), 100),
  e(C("99000114"), C("99000115"), 100),
  // De øvrige demovirksomheder ejes af personer
  e(P("99100003"), C("99000002"), 50, 66.66),
  e(P("99100004"), C("99000002"), 33.34, 49.99),
  e(P("99100005"), C("99000003"), 100),
  e(P("99100006"), C("99000005"), 50, 66.66),
  e(P("99100007"), C("99000005"), 20, 24.99),
  e(P("99100008"), C("99000006"), 100),
  e(P("99100009"), C("99000007"), 90, 100),
  e(P("99100010"), C("99000009"), 50, 66.66),
  e(P("99100011"), C("99000011"), 100),
];

/** Udsnit af demokoncernen omkring én virksomhed, som ejergrafen ville levere det. */
export function demoOwnershipGraph(rootId: string, opts: OwnershipGraphOptions, lookup: (id: string) => CompanyVM | undefined): OwnershipGraphVM {
  const extra = new Map(EXTRA.map((n) => [n.id, n]));
  const node = (id: string): OwnershipNodeVM | undefined => {
    const c = lookup(id);
    if (c) return { id, name: c.name, kind: "company", cvr: c.cvr, form: c.form, status: c.status, statusKind: c.statusKind };
    const x = extra.get(id);
    return x ? { ...x } : undefined;
  };
  const ref = opts.onDate ?? new Date().toISOString().slice(0, 10);
  // Et øjebliksbillede pr. dato: ejerskaber, der først starter senere, er ikke med.
  const edges = EDGES.filter((x) => !x.since || x.since <= ref);
  const seen = new Set([rootId]);
  const walk = (upward: boolean, depth: number) => {
    let frontier = [rootId];
    for (let d = 0; d < depth && frontier.length; d++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const x of edges) {
          const other = upward ? (x.to === id ? x.from : null) : x.from === id ? x.to : null;
          if (!other || seen.has(other)) continue;
          seen.add(other);
          next.push(other);
        }
      }
      frontier = next;
    }
  };
  walk(true, opts.ingoingDepth);
  walk(false, opts.outgoingDepth);
  const nodes = [...seen].map(node).filter((n): n is OwnershipNodeVM => Boolean(n));
  const root = nodes.find((n) => n.id === rootId);
  if (root) root.root = true;
  return {
    rootId,
    nodes,
    edges: edges.filter((x) => seen.has(x.from) && seen.has(x.to)).map((x) => ({ ...x })),
    ingoingDepth: opts.ingoingDepth,
    outgoingDepth: opts.outgoingDepth,
    onDate: opts.onDate,
    fetchedAt: new Date().toISOString(),
  };
}
