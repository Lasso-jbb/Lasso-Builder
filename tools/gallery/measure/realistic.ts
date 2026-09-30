// Realistisk målesæt (A13, Ø13): samme komponenter og datamodeller som entries.ts, men med data i den
// størrelse virkeligheden har: selskabsnavne på 30-45 tegn, personer med 3 fælles selskaber, 10 år på
// tidsakser, 5+ rækker i lister, 6 virksomheder i sammenligningen og tal i mia./mio.
// Demodataens form genbruges (DemoProvider + resolveSpec); dataene fyldes op bagefter i `realisticize`.
import type { Dataset } from "@lasso/spec";

const C = "CVR-1-99000001";
const P = "CVR-3-4000000002";
const c = (type: string, extra: Record<string, unknown> = {}) => ({ type, company: C, ...extra });
const p = (type: string, extra: Record<string, unknown> = {}) => ({ type, person: P, ...extra });

export interface RealisticEntry {
  /** Navn i GRID_RULES (evt. med variant i parentes). */
  name: string;
  /** Komponentspecen uden width (width sættes pr. måling). */
  comp: Record<string, unknown>;
  /** Indholdsdrivere, der ikke kan aflæses af data (rækker pr. post, tidsakse, serier). `bars`: tidsbånd, hvor tid før bjælkens start er tomt af design (tom-plads-målet må ikke straffe det). */
  drivers: { rowsPerItem?: number; timeAxis?: boolean; series?: number; bars?: boolean };
  /** Ret datasættet efter den generelle opfyldning. */
  mutate?: (ds: Dataset) => void;
  /** Målt via en anden type (alias), hvis typen ikke kan fodres direkte. */
  note?: string;
}

const six = ["CVR-1-99000001", "CVR-1-99000004", "CVR-1-99000008", "CVR-1-99000005", "CVR-1-99000003", "CVR-1-99000006"];

export const REALISTIC: RealisticEntry[] = [
  { name: "LassoCompanyHead", comp: c("LassoCompanyHead"), drivers: {} },
  { name: "LassoKeyFigureCards", comp: c("LassoKeyFigureCards"), drivers: {} },
  { name: "LassoKeyValueList", comp: c("LassoKeyValueList"), drivers: {} },
  { name: "LassoKeyValueList (financials)", comp: c("LassoKeyValueList", { variant: "financials" }), drivers: { timeAxis: false } },
  { name: "LassoContact", comp: c("LassoContact"), drivers: {} },
  { name: "LassoContactPersons", comp: c("LassoContactPersons"), drivers: { rowsPerItem: 3 } },
  { name: "LassoShortcuts", comp: c("LassoShortcuts"), drivers: {} },
  { name: "LassoTextSections", comp: c("LassoTextSections"), drivers: {} },
  { name: "LassoSummary", comp: { type: "LassoSummary", text: SUMMARY(), source: "Lasso", updated: "2026-09-29" }, drivers: {} },
  { name: "LassoTimeline", comp: c("LassoTimeline", { limit: 10 }), drivers: { rowsPerItem: 2 } /* lodret liste med årsoverskrifter, ingen tidsakse */ },
  { name: "LassoNews", comp: c("LassoNews"), drivers: { rowsPerItem: 3 } },
  { name: "LassoBarChart", comp: c("LassoBarChart"), drivers: { timeAxis: true } },
  { name: "LassoGroupedBarChart", comp: c("LassoGroupedBarChart"), drivers: { timeAxis: true, series: 3 } },
  { name: "LassoLineChart", comp: c("LassoLineChart"), drivers: { timeAxis: true, series: 2 } },
  { name: "LassoStackedBarChart", comp: c("LassoStackedBarChart"), drivers: { timeAxis: true, series: 4 } },
  { name: "LassoWaterfallChart", comp: c("LassoWaterfallChart"), drivers: { series: 8 } },
  { name: "LassoShareBars", comp: c("LassoShareBars"), drivers: { series: 4 } },
  { name: "LassoKeyFigureGauge", comp: c("LassoKeyFigureGauge"), drivers: { series: 3 } },
  { name: "LassoMultiYearTable", comp: c("LassoMultiYearTable"), drivers: { timeAxis: true, series: 10 } },
  { name: "LassoIncomeStatement", comp: c("LassoIncomeStatement"), drivers: { timeAxis: true, series: 5 } },
  { name: "LassoBalanceSheet", comp: c("LassoBalanceSheet"), drivers: { timeAxis: true, series: 5 } },
  { name: "LassoCashFlow", comp: c("LassoCashFlow"), drivers: { timeAxis: true, series: 5 } },
  { name: "LassoFinancialStatements", comp: c("LassoFinancialStatements"), drivers: { timeAxis: true, series: 5 } },
  { name: "LassoPersonList", comp: c("LassoPersonList"), drivers: { rowsPerItem: 2 } },
  { name: "LassoOwnerList", comp: c("LassoOwnerList"), drivers: { rowsPerItem: 2 } },
  { name: "LassoBeneficialOwners", comp: c("LassoBeneficialOwners"), drivers: { rowsPerItem: 2 } },
  { name: "LassoOwnershipDiagram", comp: c("LassoOwnershipDiagram"), drivers: {} },
  { name: "LassoRelations", comp: c("LassoRelations"), drivers: { rowsPerItem: 2 } },
  { name: "LassoRiskObservations", comp: c("LassoRiskObservations"), drivers: { rowsPerItem: 2 } },
  { name: "LassoScoreGauge", comp: c("LassoScoreGauge"), drivers: {} },
  { name: "LassoScoreHistory", comp: c("LassoScoreHistory"), drivers: { timeAxis: true } },
  { name: "LassoCreditRating", comp: c("LassoCreditRating"), drivers: {} },
  { name: "LassoAuditorIndependence", comp: c("LassoAuditorIndependence"), drivers: { series: 4 } },
  { name: "LassoProductionUnits", comp: c("LassoProductionUnits"), drivers: { series: 5 } },
  { name: "LassoProperties", comp: { type: "LassoProperties", company: "CVR-1-99000012" }, drivers: { rowsPerItem: 2 } },
  { name: "LassoMap", comp: c("LassoMap"), drivers: {} },
  { name: "LassoRegistration", comp: c("LassoRegistration"), drivers: { series: 4 } },
  { name: "LassoMergers", comp: c("LassoMergers"), drivers: { rowsPerItem: 3 } },
  { name: "LassoAnnouncements", comp: { type: "LassoAnnouncements", company: "CVR-1-99000011" }, drivers: { rowsPerItem: 3 } },
  { name: "LassoPublications", comp: c("LassoPublications"), drivers: { timeAxis: true, series: 4 } },
  { name: "LassoLivestock", comp: { type: "LassoLivestock", company: "CVR-1-99000013" }, drivers: { series: 3 } },
  { name: "LassoCompareTable", comp: { type: "LassoCompareTable", companies: six, metrics: ["omsaetning", "bruttofortjeneste", "resultat", "ansatte"] }, drivers: { series: 6 } },
  { name: "LassoRanking", comp: { type: "LassoRanking", companies: six }, drivers: { series: 6 } },
  { name: "LassoCompanyTable", comp: { type: "LassoCompanyTable", source: "search", search: { query: "", limit: 10 } }, drivers: { series: 8 } },
  { name: "LassoPersonTable", comp: { type: "LassoPersonTable", query: "Eksempel", limit: 10 }, drivers: { series: 6 } },
  { name: "LassoSavedPages", comp: { type: "LassoSavedPages", kind: "all", limit: 8 }, drivers: { series: 5 } },
  { name: "LassoFollowUps", comp: { type: "LassoFollowUps", prompts: [{ label: "Hvem sidder i bestyrelsen hos Nordjysk Entreprenørselskab?", prompt: "x" }, { label: "Vis regnskabet for de seneste ti år", prompt: "x" }, { label: "Sammenlign med tre konkurrenter i branchen", prompt: "x" }] }, drivers: {} },
  { name: "LassoPersonHead", comp: p("LassoPersonHead"), drivers: {} },
  { name: "LassoPersonStats", comp: p("LassoPersonStats"), drivers: {} },
  { name: "LassoPersonRoles", comp: p("LassoPersonRoles"), drivers: { rowsPerItem: 2, timeAxis: true, bars: true } },
  { name: "LassoPersonRoles (show: current)", comp: p("LassoPersonRoles", { show: "current", limit: 8 }), drivers: { rowsPerItem: 2 } },
  { name: "LassoPersonRoles (show: ended)", comp: p("LassoPersonRoles", { show: "ended", limit: 8 }), drivers: { rowsPerItem: 2 } },
  { name: "LassoPersonRoles (show: owner)", comp: p("LassoPersonRoles", { show: "owner", limit: 8 }), drivers: { rowsPerItem: 2 } },
  { name: "LassoPersonNetwork", comp: p("LassoPersonNetwork"), drivers: { rowsPerItem: 3, timeAxis: true, bars: true } },
  { name: "LassoPersonRisk", comp: p("LassoPersonRisk"), drivers: { rowsPerItem: 2 } },
  { name: "LassoPersonFacts", comp: p("LassoPersonFacts"), drivers: {} },
  { name: "LassoChangeFeed", comp: { type: "LassoChangeFeed" }, drivers: { rowsPerItem: 2 } },
  { name: "LassoHeatmap", comp: { type: "LassoHeatmap" }, drivers: { timeAxis: true, series: 12 } },
];

function SUMMARY(): string {
  return "Nordjysk Entreprenør- og Ejendomsselskab ApS er en mellemstor byggevirksomhed med hovedsæde i Aalborg og aktiviteter i hele Nordjylland. Omsætningen er vokset fra 1,2 mia. kr. i 2016 til 1,9 mia. kr. i 2025, mens resultatet før skat er steget fra 41,3 mio. kr. til 88,7 mio. kr. Soliditetsgraden er 38,4 procent, og selskabet har 214 fuldtidsansatte. Ejerkredsen er stabil, og revisor er uændret siden 2019. Der er ingen registrerede betalingsstandsninger, men selskabet har en enkelt tvist om et større byggeprojekt i Hjørring, som er omtalt i årsrapporten for 2025.";
}

/* ---------- navne ---------- */

export const COMPANY_NAMES = [
  "Nordjysk Entreprenør- og Ejendomsselskab ApS", // 44
  "Vestjysk Maskin- og Anlægsservice Holding ApS", // 45
  "Sønderjysk Fødevare- og Logistikgruppe A/S", // 42
  "Østerbro Ejendoms- og Administrations ApS", // 41
  "Midtjysk Tømrer- og Snedkerforretning I/S", // 41
  "Aarhus Erhvervsbyg og Totalentreprise A/S", // 41
  "Fynske Kølemontage og Industriservice ApS", // 41
  "Kristensen & Sønner Vognmandsforretning ApS", // 43
  "Danske Landbrugs- og Havebrugsmaskiner A/S", // 42
  "Hansen-Møller Rådgivende Ingeniørfirma ApS", // 42
  "Skagerrak Shipping og Havnelogistik A/S", // 39
  "Jyske Vind- og Energiprojekter Holding ApS", // 42
  "Københavns Byfornyelse og Boligadmin. A/S", // 41
  "Bornholms Fiskeindustri og Røgeri ApS", // 37
  "Limfjordens Restaurations- og Hotel A/S", // 39
  "Nielsen Petersen Revision og Rådgivning P/S", // 43
  "Thy Bioenergi og Biogas Driftsselskab ApS", // 41
  "Lolland-Falsters Sukker- og Roeforædling A/S", // 44
  "Esbjerg Offshore Service og Vedligehold ApS", // 43
  "Herning Tekstil- og Beklædningsimport A/S", // 41
  "Odense Robot- og Automationsteknik ApS", // 38
  "Randers Bilcenter og Autoværksted Holding ApS", // 45
  "Silkeborg Vand- og Afløbsteknik A/S", // 35
  "Vejle Fjord Marina og Havneejendomme ApS", // 40
];
export const PERSON_NAMES = [
  "Lars Østergaard Kristensen-Møller",
  "Mette Skov Hedegaard Andersen",
  "Jens Christian Bjerregaard Nielsen",
  "Anne-Marie Thorsen Vestergaard",
  "Søren Just Rasmussen Pedersen",
  "Charlotte Bruun Lauridsen",
  "Henrik Mølgaard Jespersen-Holm",
  "Pernille Ravn Sørensen Dahl",
  "Thomas Bak Frederiksen Lund",
  "Kirsten Vinther Poulsen Krogh",
  "Mads Ulrik Damgaard Hansen",
  "Louise Kjær Mikkelsen-Buch",
];
const COMPANY_RE = /\b(A\/S|ApS|I\/S|K\/S|IVS|P\/S|Holding|Fond)\b/;

/* ---------- hjælpere ---------- */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const NOT_SCALED = /^(year|employees|.*grad|.*Years?|.*Count|count|score|peers|total)$/;

function stable<T>(map: Map<string, T>, key: string, pool: readonly T[]): T {
  let v = map.get(key);
  if (v === undefined) {
    v = pool[map.size % pool.length]!;
    map.set(key, v);
  }
  return v;
}

/** Klon post nr. i, så listen når n poster; `tweak` giver hver klon sit eget indhold. */
function pad<T>(arr: T[] | undefined, n: number, tweak: (clone: T, i: number) => void): void {
  if (!arr || arr.length === 0) return;
  const base = arr.length;
  while (arr.length < n) {
    const i = arr.length;
    const clone = structuredClone(arr[i % base]!);
    tweak(clone, i);
    arr.push(clone);
  }
}

function shiftYear(s: unknown, from: number, to: number): unknown {
  return typeof s === "string" ? s.split(String(from)).join(String(to)) : s;
}

/** Forlæng en tidsserie (stigende år) bagud til n år; tallene skaleres ned (8 % pr. år tilbage). */
function extendYears(rows: Obj[] | undefined, n: number): void {
  if (!rows || rows.length === 0) return;
  while (rows.length < n) {
    const first = rows[0]!;
    const y = Number(first.year);
    const c: Obj = {};
    for (const [k, v] of Object.entries(first)) {
      if (k === "year") c[k] = y - 1;
      else if (typeof v === "number") c[k] = NOT_SCALED.test(k) ? v : Math.round(v * 0.92);
      else c[k] = shiftYear(v, y, y - 1);
    }
    rows.unshift(c);
  }
}

/** Skaler beløb (kr.) så tallene ligger i mia./mio., som hos en mellemstor virksomhed. */
function scaleMoney(row: Obj, factor: number, keys?: string[]): void {
  for (const [k, v] of Object.entries(row)) {
    if (typeof v !== "number" || NOT_SCALED.test(k)) continue;
    if (keys && !keys.includes(k)) continue;
    row[k] = Math.round(v * factor);
  }
}

/* ---------- opfyldning ---------- */

/** Antal regnskabsår i flerårstabeller og regnskaber (10 som standard; REAL_YEARS=6 giver følsomhedsmålingen). */
const YEARS = Number(process.env.REAL_YEARS ?? 10);

export function realisticize(ds: Dataset): void {
  const companyNames = new Map<string, string>();
  const personNames = new Map<string, string>();
  const nameOf = (old: string, kind: "company" | "person") => (kind === "company" ? stable(companyNames, old, COMPANY_NAMES) : stable(personNames, old, PERSON_NAMES));

  // 1) Navne i hele datasættet (kun personer/selskaber; etiketter og tekster røres ikke).
  const walk = (v: unknown, parentKey = ""): void => {
    if (Array.isArray(v)) return void v.forEach((x) => walk(x, parentKey));
    if (!isObj(v)) return;
    if (typeof v.companyName === "string") v.companyName = nameOf(v.companyName, "company");
    if (typeof v.name === "string") {
      const isCo = COMPANY_RE.test(v.name) || typeof v.cvr === "string" || (typeof v.lassoId === "string" && v.lassoId.startsWith("CVR-1"));
      const isPerson = (typeof v.lassoId === "string" && v.lassoId.startsWith("CVR-3")) || (!isCo && typeof v.role === "string");
      if (isCo && parentKey !== "units") v.name = nameOf(v.name, "company");
      else if (isPerson) v.name = nameOf(v.name, "person");
    }
    for (const [k, x] of Object.entries(v)) walk(x, k);
  };

  // 2) Op-fyldning pr. datatype (før navne, så klonerne også får lange navne).
  for (const f of Object.values(ds.financials)) {
    extendYears(f.years as unknown as Obj[], YEARS);
    for (const y of f.years as unknown as Obj[]) scaleMoney(y, 15, ["revenue", "grossProfit", "profit", "equity", "liabilities", "assetsTotal", "ebitda"]);
  }
  for (const s of Object.values(ds.financialStatements)) {
    const fix = (st: Obj) => {
      for (const key of ["incomeStatement", "balanceSheet", "cashFlow"]) {
        const rows = st[key] as Obj[] | undefined;
        extendYears(rows, YEARS);
        rows?.forEach((r) => scaleMoney(r, 15));
      }
      (st.periods as string[] | undefined)?.splice(0, 1, "year");
    };
    fix(s as unknown as Obj);
    if (s.alternate) fix(s.alternate as unknown as Obj);
  }
  for (const b of Object.values(ds.industryBenchmarks)) extendYears(b.years as unknown as Obj[] | undefined, YEARS);
  for (const h of Object.values(ds.scoreHistories)) {
    const pts = h.points as unknown as Obj[];
    pad(pts, 10, (pt, i) => void (pt.date = `${2016 + (i % 10)}-06-30`));
  }
  for (const rows of Object.values(ds.people)) {
    pad(rows, 8, (r, i) => {
      r.role = ["Direktør", "Bestyrelsesmedlem", "Bestyrelsesformand", "Næstformand", "Direktør", "Suppleant", "Bestyrelsesmedlem", "Revisor"][i % 8]!;
      r.name = `${i}`; // omdøbes af walk()
      r.from = `${2010 + (i % 12)}-03-01`;
      delete r.lassoId;
    });
    rows.forEach((r, i) => void (r.name = PERSON_NAMES[i % PERSON_NAMES.length]!));
  }
  for (const o of Object.values(ds.ownership)) {
    pad(o.owners, 6, (ow, i) => void (ow.name = i % 2 ? `Ejer ${i} Holding ApS` : `Ejer ${i}`));
    o.owners.forEach((ow, i) => {
      if (i >= 2) {
        ow.kind = i % 2 ? "company" : "person";
        ow.name = i % 2 ? COMPANY_NAMES[(i + 6) % COMPANY_NAMES.length]! : PERSON_NAMES[(i + 5) % PERSON_NAMES.length]!;
        ow.share = ["5–9,99 %", "10–14,99 %", "5–9,99 %", "15–19,99 %"][i % 4]!;
      }
    });
  }
  for (const o of Object.values(ds.beneficialOwnership)) {
    pad(o.owners, 5, (ow, i) => {
      ow.name = PERSON_NAMES[(i + 3) % PERSON_NAMES.length]!;
      ow.chain = `via ${COMPANY_NAMES[(i + 7) % COMPANY_NAMES.length]}, 100 % → 25–49,99 %`;
      ow.share = "25–49,99 %";
    });
  }
  for (const cp of Object.values(ds.contactPersons)) {
    pad(cp.people, 7, (x, i) => {
      x.name = PERSON_NAMES[(i + 2) % PERSON_NAMES.length]!;
      x.role = ["Økonomi- og administrationschef", "Salgs- og marketingdirektør", "Teknisk direktør", "Kvalitets- og miljøchef"][i % 4]!;
    });
    cp.people.forEach((x, i) => {
      x.role = ["Administrerende direktør", "Bestyrelsesformand i selskabet", "Økonomi- og administrationschef", "Salgs- og marketingdirektør", "Teknisk direktør", "Kvalitets- og miljøchef", "HR- og personalechef"][i % 7]!;
    });
  }
  for (const o of Object.values(ds.observations)) {
    pad(o.observations, 6, (ob, i) => {
      ob.id = `x${i}`;
      ob.title = `Adressen Prøvevej 1 deles med ${10 + i} andre selskaber, hvoraf flere er under konkurs`;
      ob.detail = "Flere af selskaberne på adressen har samme reelle ejer og er registreret inden for de seneste tolv måneder.";
    });
  }
  for (const t of Object.values(ds.timeline)) {
    pad(t.events, 12, (e, i) => {
      e.date = `${2025 - Math.floor(i / 2)}-${i % 2 ? "09" : "04"}-15`;
      e.title = i % 2 ? `${PERSON_NAMES[i % PERSON_NAMES.length]} er indtrådt som bestyrelsesmedlem` : `Årsrapport ${2025 - Math.floor(i / 2)} offentliggjort`;
      e.detail = "Bruttofortjeneste 452,2 mio. kr., resultat 88,7 mio. kr., egenkapital 1,1 mia. kr.";
      e.category = i % 2 ? "Ledelse" : "Regnskab";
    });
  }
  for (const n of Object.values(ds.news)) {
    pad(n.items, 6, (it, i) => void (it.time = `2025-0${(i % 9) + 1}-10`));
    n.items.forEach((it, i) => {
      it.headline = `${COMPANY_NAMES[i % COMPANY_NAMES.length]} henter 250 mio. kr. til udvidelse af produktionen i Aalborg`;
      it.excerpt = "Selskabet har i dag offentliggjort en aftale med en gruppe danske pensionskasser om finansiering af nye produktionsfaciliteter, og samlet regner ledelsen med at ansætte yderligere 60 medarbejdere inden udgangen af 2027.";
      delete it.headlineSegments;
      delete it.extractSegments;
    });
  }
  for (const t of Object.values(ds.textSections)) {
    pad(t.sections, 10, (s, i) => void (s.heading = `Afsnit ${i}`));
    t.sections.forEach((s) => {
      s.body = "Opførelse af bygninger, herunder totalentreprise, hovedentreprise og fagentreprise for private og offentlige bygherrer i Region Nordjylland.";
    });
  }
  for (const pv of Object.values(ds.persons)) {
    pad(pv.roles, 8, (r, i) => {
      r.companyId = `CVR-1-9900${String(i).padStart(4, "0")}`;
      r.role = ["Bestyrelsesformand", "Direktør", "Bestyrelsesmedlem", "Ejer", "Næstformand", "Direktør", "Bestyrelsesmedlem", "Suppleant"][i % 8]!;
      r.from = `${2004 + i * 2}-02-01`;
      if (i % 3 === 2) {
        r.to = `${2012 + i}-06-30`;
        r.active = false;
      }
    });
  }
  for (const nw of Object.values(ds.personNetworks)) {
    // Ejerens eksempel: 6 personer, hver med 3 fælles selskaber (3 rækker pr. person), tidsakse 2011–2026.
    pad(nw.people, 6, (x, i) => void (x.name = `${i}`));
    nw.people.forEach((person, pi) => {
      person.name = PERSON_NAMES[(pi + 1) % PERSON_NAMES.length]!;
      const base = person.companies[0]!;
      person.companies = [0, 1, 2].map((k) => {
        const from = `${2011 + ((pi * 2 + k * 3) % 9)}-0${(k % 9) + 1}-01`;
        const ended = (pi + k) % 3 === 2;
        return {
          ...base,
          companyId: `CVR-1-9900${String(pi * 3 + k).padStart(4, "0")}`,
          companyName: `${k}`,
          role: ["direktør", "bestyrelsesmedlem", "bestyrelsesformand"][(pi + k) % 3]!,
          from,
          ...(ended ? { to: `${2019 + ((pi + k) % 6)}-11-30` } : { to: undefined }),
        };
      });
      person.since = person.companies[0]!.from;
      person.overlapYears = 2026 - Number(String(person.since).slice(0, 4));
      person.active = person.companies.some((x) => !x.to);
      if (person.active) delete person.until;
      else person.until = person.companies.map((x) => x.to!).sort().at(-1)!;
    });
  }
  for (const u of Object.values(ds.productionUnits)) {
    pad(u.units, 6, (x, i) => {
      x.pNumber = `10000000${30 + i}`;
      x.name = `${i}`;
      x.address = { ...x.address, street: `Industrivej ${10 + i}`, city: ["Aalborg", "Hjørring", "Frederikshavn", "Thisted"][i % 4]! } as typeof x.address;
    });
    u.units.forEach((x, i) => void (x.name = COMPANY_NAMES[(i + 3) % COMPANY_NAMES.length]! + " – afdeling"));
  }
  for (const pr of Object.values(ds.properties)) {
    pad(pr.properties, 3, (x, i) => {
      x.matrikel = `Matr. ${7 + i}b, Horsens Markjorder`;
      x.address = { ...x.address, street: `Murervej ${5 + i}` } as typeof x.address;
    });
  }
  for (const l of Object.values(ds.livestock)) {
    pad(l.herds, 6, (h, i) => void (h.category = ["slagtesvin", "søer", "smågrise", "malkekøer", "kalve", "ungdyr"][i % 6]!));
  }
  for (const e of Object.values(ds.companyEvents)) {
    pad(e.publications, 10, (pb, i) => {
      pb.year = 2016 + (i % 10);
      pb.published = `${2017 + (i % 10)}-05-28`;
      pb.periodStart = `${2016 + (i % 10)}-01-01`;
      pb.periodEnd = `${2016 + (i % 10)}-12-31`;
    });
    for (const pb of e.publications) {
      if (pb.figure) pb.figure.value = (pb.figure.value ?? 0) * 15;
      if (pb.profit) pb.profit.value = (pb.profit.value ?? 0) * 15;
    }
    pad(e.mergers, 3, (m, i) => void (m.date = `${2012 + i}-01-01`));
    for (const m of e.mergers) for (const party of [...m.from, ...m.to]) party.name = party.name; // navne sættes af walk()
    // Statstidende til Announcements: flere bekendtgørelser med lang tekst.
    pad(e.announcements, 5, (a, i) => void (a.date = `2025-0${(i % 9) + 1}-02`));
  }
  for (const s of Object.values(ds.searches)) {
    pad(s.rows, 10, (r, i) => void (r.lassoId = `CVR-1-9900${String(60 + i).padStart(4, "0")}`));
    s.rows.forEach((r, i) => {
      r.industryText = ["Opførelse af bygninger og fagentreprise", "Fremstilling af maskiner til landbruget", "Engroshandel med fødevarer"][i % 3]!;
      r.revenue = (r.revenue ?? 0) * 12;
      r.grossProfit = (r.grossProfit ?? 0) * 12;
      r.profit = (r.profit ?? 0) * 12;
    });
  }
  for (const s of Object.values(ds.personSearches ?? {})) {
    pad(s.rows as unknown as Obj[], 10, () => undefined);
  }
  for (const g of Object.values(ds.ownershipGraphs)) {
    pad(g.nodes, 10, (nd, i) => {
      nd.id = `CVR-1-9900${String(80 + i).padStart(4, "0")}`;
      delete (nd as unknown as Obj).root;
      nd.name = `${i}`;
    });
    // Tilføj kanter fra de nye noder ind i grafen, så de ikke svæver løse.
    for (const nd of g.nodes.slice(6)) g.edges.push({ from: nd.id, to: g.nodes[1]!.id, share: [25, 49.99], since: "2015-01-01" } as (typeof g.edges)[number]);
  }
  for (const f of Object.values(ds.changeFeeds)) {
    pad(f.entries, 12, (e, i) => void (e.lassoId = `CVR-1-9900${String(90 + i).padStart(4, "0")}`));
  }
  for (const sp of Object.values(ds.savedPages)) sp.pages.forEach((x) => void (x.name = COMPANY_NAMES[0]!));

  walk(ds.companies);
  walk(ds.people);
  walk(ds.ownership);
  walk(ds.beneficialOwnership);
  walk(ds.contactPersons);
  walk(ds.timeline);
  walk(ds.observations);
  walk(ds.persons);
  walk(ds.personNetworks);
  walk(ds.productionUnits);
  walk(ds.companyEvents);
  walk(ds.searches);
  walk(ds.personSearches ?? {});
  walk(ds.ownershipGraphs);
  walk(ds.changeFeeds);
  walk(ds.savedPages);
  walk(ds.livestock);
  walk(ds.maps);
  walk(ds.creditRatings);
  walk(ds.auditorIndependence);
  // Netværkets selskabsnavne får de lange navne i rækkefølge (walk kender ikke "companyName: '<i>'"-pladsholderne).
  for (const nw of Object.values(ds.personNetworks)) {
    let k = 0;
    for (const person of nw.people) for (const co of person.companies) co.companyName = COMPANY_NAMES[k++ % COMPANY_NAMES.length]!;
  }
  for (const g of Object.values(ds.ownershipGraphs)) g.nodes.forEach((nd, i) => void (nd.name = COMPANY_NAMES[(i + 1) % COMPANY_NAMES.length]!));
  for (const s of Object.values(ds.savedPages)) s.pages.forEach((x, i) => void (x.name = COMPANY_NAMES[i % COMPANY_NAMES.length]!));

  // Sammenligning og ranking: navne på de seks virksomheder.
  six.forEach((id, i) => {
    const co = ds.companies[id];
    if (co) co.name = COMPANY_NAMES[i % COMPANY_NAMES.length]!;
  });
  // Gemte sider (kræver bruger i live; her udfyldt direkte).
  for (const key of Object.keys(ds.savedPages)) {
    const sp = ds.savedPages[key]!;
    if (sp.pages.length === 0) {
      sp.pages = COMPANY_NAMES.slice(0, 8).map((n, i) => ({ lassoId: `CVR-1-9900${String(i + 1).padStart(4, "0")}`, kind: "company" as const, name: n, cvr: `9900${String(i + 1).padStart(4, "0")}`, origin: "manual" as const, savedAt: `2026-09-${String(20 + (i % 9)).padStart(2, "0")}T10:00:00Z` }));
      sp.total = 8;
    }
  }
}
