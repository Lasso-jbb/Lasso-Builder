import assert from "node:assert/strict";
import { test } from "node:test";
import { askFocus, askLabel, askPersonFocus, askPlan, companyAskTypes, foldText, parseAsk, personAskTypes, withRelated, type Ask } from "./ask.js";

/** Fast dato, så "i år" og "siden 2019" er deterministiske. */
const today = new Date("2026-09-28T12:00:00Z");
const company = (q: string, name?: string | string[]) => parseAsk(q, "company", { today, ...(name ? { name } : {}) });
const person = (q: string, name?: string) => parseAsk(q, "person", { today, ...(name ? { name } : {}) });
/** Kun de felter, testen gælder (resten har standardværdier). */
const pick = (a: Ask, ...keys: (keyof Ask)[]) => Object.fromEntries(keys.map((k) => [k, a[k]]));

/* ---------- Nøgletal: ordstammer, æøå, store bogstaver ---------- */

const METRIC_CASES: [string, Ask["metrics"]][] = [
  ["Hvad er soliditetsgraden i Eksempel Byg?", ["soliditetsgrad"]],
  ["HVAD ER SOLIDITETSGRADEN", ["soliditetsgrad"]],
  ["hvor stor er egenkapitalandelen", ["soliditetsgrad"]],
  ["Hvad er omsætningen?", ["omsaetning"]],
  ["hvad er omsaetningen", ["omsaetning"]],
  ["hvor meget har de i salg", ["omsaetning"]],
  ["hvad var årets resultat", ["resultat"]],
  ["hvad var aarets resultat", ["resultat"]],
  ["giver de overskud eller underskud?", ["resultat"]],
  ["hvor meget tjener de", ["resultat"]],
  ["hvor stor er egenkapitalen", ["egenkapital"]],
  ["hvor mange ansatte er der", ["ansatte"]],
  ["hvor mange medarbejdere har firmaet", ["ansatte"]],
  ["hvor mange årsværk", ["ansatte"]],
  ["hvad er EBITDA", ["ebitda"]],
  ["hvad er driftsresultatet", ["ebitda"]],
  ["hvad er balancesummen", ["balancesum"]],
  ["hvor meget gæld har de", ["gaeld"]],
  ["hvor meget gaeld har de", ["gaeld"]],
  ["hvad er overskudsgraden", ["overskudsgrad"]],
  ["hvad er deres margin", ["overskudsgrad"]],
  ["hvordan er likviditeten", ["likviditetsgrad"]],
  ["hvad er bruttofortjenesten", ["bruttofortjeneste"]],
  ["vis gæld og egenkapital", ["gaeld", "egenkapital"]],
  ["egenkapital og gæld", ["egenkapital", "gaeld"]],
  ["omsætning, resultat og ansatte", ["omsaetning", "resultat", "ansatte"]],
];

test("nøgletal i nævnt rækkefølge, uden forskel på store/små bogstaver og æøå/ae-oe-aa", () => {
  for (const [q, metrics] of METRIC_CASES) assert.deepEqual(company(q).metrics, metrics, q);
});

test("overskudsgrad, resultatopgørelse og driftsresultat er ikke også resultat", () => {
  assert.deepEqual(company("hvad er overskudsgraden").metrics, ["overskudsgrad"]);
  assert.deepEqual(company("vis resultatopgørelsen").metrics, []);
  assert.deepEqual(company("vis resultatopgørelsen").topics, ["resultatopgoerelse"]);
  assert.deepEqual(company("hvad er balancesummen").topics, []);
  assert.deepEqual(company("vis balancen").topics, ["balance"]);
});

test("modellens nøgletal lægges forrest, uden dubletter", () => {
  const a = parseAsk("hvad er egenkapitalandelen og resultatet", "company", { today, metrics: ["resultat", "egenkapital"] });
  assert.deepEqual(a.metrics, ["resultat", "egenkapital", "soliditetsgrad"]);
  assert.equal(a.generic, false);
});

/* ---------- Emner ---------- */

const TOPIC_CASES: [string, Ask["topics"]][] = [
  ["Hvem er direktør i Eksempel Byg?", ["direktion"]],
  ["hvem er direktoer", ["direktion"]],
  ["hvem er adm. dir.", ["direktion"]],
  ["hvem er CEO", ["direktion"]],
  ["hvem sidder i bestyrelsen", ["bestyrelse"]],
  ["hvem er formand", ["bestyrelse"]],
  ["hvem står bag firmaet", ["ledelse"]],
  ["hvem ejer virksomheden", ["ejere"]],
  ["hvem er aktionærerne", ["ejere"]],
  ["hvem er de reelle ejere", ["reelle-ejere"]],
  ["hvordan ser koncernen ud", ["koncern"]],
  ["hvem er moderselskabet", ["koncern"]],
  ["hvem er revisor", ["revisor"]],
  ["har de skiftet revisor", ["revisorskift"]],
  ["er revisor uafhængig", ["revisorskift"]],
  ["hvornår er de stiftet", ["stiftet"]],
  ["hvornår blev firmaet grundlagt", ["stiftet"]],
  ["hvad laver de", ["branche"]],
  ["hvad beskæftiger de sig med", ["branche"]],
  ["hvad er formålet", ["formaal"]],
  ["hvem kan tegne selskabet", ["formaal"]],
  ["hvor ligger de", ["adresse"]],
  ["hvad er telefonnummeret", ["telefon"]],
  ["hvad er deres mail", ["email"]],
  ["hvad er hjemmesiden", ["web"]],
  ["hvem er kontaktpersonerne", ["kontaktpersoner"]],
  ["har de været i nyhederne", ["nyheder"]],
  ["hvad er der sket", ["historik"]],
  ["er de gået konkurs", ["konkurs"]],
  ["er selskabet tvangsopløst", ["konkurs"]],
  ["kan vi handle med dem", ["kredit"]],
  ["er der røde flag", ["kredit"]],
  ["hvad er deres score", ["score"]],
  ["vis årsrapporten", ["regnskab"]],
  ["hvordan er pengestrømmen", ["pengestroem"]],
  ["hvor mange afdelinger har de", ["enheder"]],
  ["hvilke ejendomme ejer de", ["ejendomme"]],
  ["hvor mange dyr har landbruget", ["besaetning"]],
];

test("emner i nævnt rækkefølge (ordstammer)", () => {
  for (const [q, topics] of TOPIC_CASES) assert.deepEqual(company(q).topics, topics, q);
});

test("flere signaler står i nævnt rækkefølge", () => {
  assert.deepEqual(company("hvem ejer og hvem er revisor").topics, ["ejere", "revisor"]);
  assert.deepEqual(company("hvem er revisor, og hvem ejer dem").topics, ["revisor", "ejere"]);
  const a = company("hvad er omsætningen, og hvem er direktør");
  assert.deepEqual(pick(a, "metrics", "topics"), { metrics: ["omsaetning"], topics: ["direktion"] });
  assert.deepEqual(companyAskTypes(a), ["noegletal", "ledelse"]);
  assert.deepEqual(companyAskTypes(company("hvem er direktør, og hvad er omsætningen")), ["ledelse", "noegletal"]);
});

test("et præcist emne dækker det brede: bestyrelse frem for ledelse, konkurs frem for status, e-mail frem for adresse", () => {
  assert.deepEqual(company("hvem sidder i bestyrelsen").topics, ["bestyrelse"]);
  assert.deepEqual(company("er de ophørt eller gået konkurs").topics, ["konkurs"]);
  assert.deepEqual(company("hvad er mailadressen").topics, ["email"]);
  assert.deepEqual(company("hvem er de reelle ejere").topics, ["reelle-ejere"]);
});

test("virksomhedens navn er ikke et emne ('Eksempel Ejendomme', 'X Holding', 'Revision')", () => {
  assert.deepEqual(company("Hvem er direktør i Eksempel Ejendomme ApS?", ["Eksempel Ejendomme ApS", "Eksempel Ejendomme"]).topics, ["direktion"]);
  assert.deepEqual(company("hvem ejer Eksempel Holding", ["Eksempel Holding ApS", "Eksempel Holding"]).topics, ["ejere"]);
  assert.deepEqual(company("hvem er revisor for Eksempel Revision Midt", ["Eksempel Revision Midt ApS", "Eksempel Revision Midt"]).topics, ["revisor"]);
  // Uden navnet ville det blive to emner.
  assert.deepEqual(company("hvem ejer Eksempel Holding").topics, ["ejere", "koncern"]);
});

/* ---------- År, antal år, udvikling og tidligere ---------- */

test("årstal: 'i 2023' og 'regnskabet for 2022', aldrig et CVR-nummer eller et år efter i år", () => {
  assert.equal(company("hvad var omsætningen i 2023").year, 2023);
  assert.equal(company("vis regnskabet for 2022").year, 2022);
  assert.equal(company("hvad er omsætningen for CVR 20123456").year, undefined);
  assert.equal(company("hvad er omsætningen for 20 12 34 56").year, undefined);
  assert.equal(company("hvad er omsætningen i 2031").year, undefined);
  assert.equal(company("omsætning i 1985").year, undefined);
  // Et regnskabsår er et nøgletalsspørgsmål, også uden nøgletal.
  const r = company("vis regnskabet for 2022");
  assert.equal(r.generic, false);
  assert.deepEqual(companyAskTypes(r), ["noegletal"]);
});

test("antal år: 'de sidste 3 år', 'over 10 år', 'fem år', klemt til 2–10", () => {
  assert.deepEqual(pick(company("omsætningen de sidste 3 år"), "years", "trend"), { years: 3, trend: true });
  assert.equal(company("resultatet over 10 år").years, 10);
  assert.equal(company("egenkapitalen de seneste fem år").years, 5);
  assert.equal(company("omsætningen de sidste 25 år").years, 10);
  assert.equal(company("omsætningen det seneste 1 år").years, 2);
  // "siden 2019": udviklingen fra det år (i 2026: 8 år), ikke et enkelt regnskabsår.
  assert.deepEqual(pick(company("hvor mange ansatte har de haft siden 2019"), "years", "year", "trend"), { years: 8, year: undefined, trend: true });
});

test("udvikling (trend) og tidligere (past)", () => {
  for (const q of ["hvordan har gælden udviklet sig", "omsætningen over tid", "er egenkapitalen vokset", "er resultatet faldet", "er omsætningen steget", "hvad er tendensen i resultatet", "resultatet år for år"]) {
    assert.equal(company(q).trend, true, q);
  }
  assert.equal(company("hvad er omsætningen").trend, false);
  // "Hvad er der sket med omsætningen": udviklingen i tallet, ikke historikken.
  const sket = company("hvad er der sket med omsætningen");
  assert.deepEqual(pick(sket, "metrics", "topics", "trend"), { metrics: ["omsaetning"], topics: [], trend: true });
  for (const q of ["hvem var tidligere direktør", "har der været udskiftning i bestyrelsen", "hvem er forhenværende formand"]) assert.equal(company(q).past, true, q);
  assert.equal(company("hvem er direktør").past, false);
});

/* ---------- Generiske spørgsmål og fokus ---------- */

test("generelle spørgsmål er niveau C: fortæl om X, hvordan går det (fokus oekonomi)", () => {
  const tell = company("Fortæl om Lasso");
  assert.equal(tell.generic, true);
  assert.equal(askFocus(tell), undefined);
  assert.equal(askLabel(tell, "company"), undefined);
  const how = company("Hvordan går det med Novo?");
  assert.deepEqual(pick(how, "generic", "metrics", "topics"), { generic: true, metrics: [], topics: [] });
  assert.equal(askFocus(how), "oekonomi");
  const money = company("tjener de penge?");
  assert.equal(money.generic, true);
  assert.equal(askFocus(money), "oekonomi");
  assert.equal(company("").generic, true);
  assert.equal(parseAsk(undefined, "company").question, "");
  assert.equal(parseAsk(`  ${"x".repeat(400)}  `, "company").question.length, 300);
});

test("'Vis historik for X' (fanen fra 'Se alle … i Historik') er fanen, ikke et spørgsmål med et emne", () => {
  const tab = company("Vis historik for Eksempel Byg");
  assert.deepEqual(pick(tab, "generic", "topics", "metrics"), { generic: true, topics: [], metrics: [] });
  assert.equal(askFocus(tab), "historik");
  assert.equal(askFocus(company("Vis økonomi for Eksempel Byg")), "oekonomi");
  assert.equal(askPersonFocus(person("Vis netværk for Bo Eksempel")), "netvaerk");
  assert.equal(askPersonFocus(person("Vis roller for Bo Eksempel")), "roller");
  // Et regnskabsår er stadig et spørgsmål.
  assert.equal(company("vis regnskabet for 2022").generic, false);
});

test("fokus afledt af det første signal", () => {
  assert.equal(askFocus(company("hvad er soliditetsgraden")), "oekonomi");
  assert.equal(askFocus(company("hvem er direktør")), "ledelse");
  assert.equal(askFocus(company("hvem ejer og hvem er revisor")), "ejerskab");
  assert.equal(askFocus(company("hvem er revisor")), "overblik");
  assert.equal(askFocus(company("er revisor uafhængig")), "risiko");
  assert.equal(askFocus(company("hvad er telefonnummeret")), "kontakt");
  assert.equal(askFocus(company("kan vi handle med dem")), "risiko");
  assert.equal(askFocus(company("vis resultatopgørelsen")), "regnskab");
  assert.equal(askFocus(company("har de været i nyhederne")), "historik");
});

test("etiketten til undertitlen", () => {
  assert.equal(askLabel(company("hvad er soliditetsgraden"), "company"), "Soliditetsgrad");
  assert.equal(askLabel(company("vis gæld og egenkapital"), "company"), "Gæld og egenkapital");
  assert.equal(askLabel(company("hvem er direktør"), "company"), "Direktion");
  assert.equal(askLabel(company("hvem er revisor"), "company"), "Revisor");
  assert.equal(askLabel(company("hvem er direktør og formand"), "company"), "Ledelse");
  assert.equal(askLabel(company("hvem ejer og hvem er revisor"), "company"), "Ejere og revisor");
  assert.equal(askLabel(company("hvad var omsætningen i 2023"), "company"), "Omsætning 2023");
  assert.equal(askLabel(company("vis regnskabet for 2022"), "company"), "Regnskab 2022");
  assert.equal(askLabel(company("hvad er der sket i ledelsen"), "company"), "Ledelsesændringer");
  assert.equal(askLabel(person("sidder Bo Eksempel i bestyrelser?", "Bo Eksempel"), "person"), "Bestyrelsesposter");
});

/* ---------- Person ---------- */

test("person: roller, netværk, bopæl, konkurser, nyheder og fokus", () => {
  const cases: [string, Ask["topics"], string][] = [
    ["sidder Bo Eksempel i bestyrelser?", ["bestyrelse"], "roller"],
    ["hvilke selskaber er Bo direktør i", ["direktion"], "roller"],
    ["hvilke selskaber ejer Bo", ["ejere"], "roller"],
    ["hvilke roller har Bo", ["roller"], "roller"],
    ["hvem sidder Bo sammen med", ["netvaerk"], "netvaerk"],
    ["hvor bor Bo", ["bopael"], "overblik"],
    ["har Bo været involveret i konkurser", ["konkurs"], "risiko"],
    ["er der nyheder om Bo", ["nyheder"], "historik"],
    ["hvordan ser Bos ejerstruktur ud", ["koncern"], "ejerskab"],
  ];
  for (const [q, topics, focus] of cases) {
    const a = person(q, "Bo Eksempel");
    assert.deepEqual(a.topics, topics, q);
    assert.equal(askPersonFocus(a), focus, q);
    assert.deepEqual(a.metrics, [], q);
  }
  // Virksomhedsemner hører ikke til en person; "hvem er X" er generelt.
  assert.equal(person("hvem er Bo Eksempel", "Bo Eksempel").generic, true);
  assert.deepEqual(personAskTypes(person("sidder Bo i bestyrelser og har han været i konkurser", "Bo")), ["roller", "konkurs"]);
  // Personens navn er ikke et emne ("Ejersen" er ikke "ejer").
  assert.deepEqual(person("hvor bor Mette Ejersen", "Mette Ejersen").topics, ["bopael"]);
});

/* ---------- Planen ---------- */

test("planen: nøgletal giver kort med de spurgte først, grafen som svar og kontekst i rangorden", () => {
  const plan = askPlan(company("hvad er soliditetsgraden"), "company");
  assert.deepEqual(plan.top.map((i) => i.type), ["LassoKeyFigureCards"]);
  assert.deepEqual((plan.top[0]!.props as { metrics: string[] }).metrics, ["soliditetsgrad", "egenkapital", "gaeld"]);
  assert.deepEqual(plan.lead.map((i) => [i.type, i.props?.metric]), [["LassoLineChart", "soliditetsgrad"]]);
  assert.deepEqual(plan.context.slice(0, 3).map((i) => i.type), ["LassoKeyValueList", "LassoShareBars", "LassoTextSections"]);
  // Gæld: stablede søjler; 2–3 nøgletal: grupperede søjler; et regnskabsår: listen med året er svaret, ingen kort.
  assert.equal(askPlan(company("hvordan har gælden udviklet sig de sidste 5 år"), "company").lead[0]!.type, "LassoStackedBarChart");
  assert.equal(askPlan(company("omsætning og resultat over tid"), "company").lead[0]!.type, "LassoGroupedBarChart");
  const year = askPlan(company("hvad var omsætningen i 2023"), "company");
  assert.deepEqual(year.top, []);
  assert.deepEqual(year.lead[0]!.props, { variant: "financials", title: "Regnskab", only: ["omsaetning", "bruttofortjeneste", "resultat"], year: 2023 });
  // Generelt: tom plan (fokus-siden).
  assert.deepEqual(askPlan(company("fortæl om Lasso"), "company"), { top: [], lead: [], context: [] });
});

test("beslægtede nøgletal: spurgt først, så de nærmeste, uden dubletter", () => {
  assert.deepEqual(withRelated(["gaeld"]), ["gaeld", "egenkapital", "soliditetsgrad", "balancesum"]);
  assert.deepEqual(withRelated(["soliditetsgrad", "egenkapital"]), ["soliditetsgrad", "egenkapital", "gaeld", "balancesum"]);
  assert.deepEqual(withRelated(["ansatte"]), ["ansatte"]);
});

test("foldText: æøå som ae/oe/aa, små bogstaver og uden accenter", () => {
  assert.equal(foldText("Årsværk ØKONOMI Café"), "aarsvaerk oekonomi cafe");
});
