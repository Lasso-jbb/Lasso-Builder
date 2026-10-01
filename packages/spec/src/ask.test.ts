import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ASK_TOPICS,
  askFocus,
  askLabel,
  askPersonFocus,
  askPlan,
  changeDays,
  companyAskTypes,
  foldText,
  normalizeTopic,
  parseAsk,
  personAskTypes,
  SUMMARY_PENDING_TEXT,
  withRelated,
  type Ask,
} from "./ask.js";

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
  ["hvem kan tegne selskabet", ["registrering"]],
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
  ["er der røde flag", ["roede-flag"]],
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

/* ---------- B1-ordbogen (docs/plan-b1-ordbog.md): de manglende komponenter ---------- */

/** Svar-elementernes typer (og props) i planen. */
const leads = (a: Ask, kind: "company" | "person" = "company") => askPlan(a, kind).lead.map((i) => i.type);
const lead0 = (a: Ask, kind: "company" | "person" = "company") => askPlan(a, kind).lead[0];

test("B1 røde flag: træf, ikke-træf og forrang for kreditten", () => {
  assert.deepEqual(company("Er der røde flag ved Eksempel Byg?").topics, ["roede-flag"]);
  assert.deepEqual(company("hvilke advarsler og observationer er der").topics, ["roede-flag"]);
  assert.deepEqual(company("er der noget galt").topics, ["roede-flag"]);
  assert.deepEqual(leads(company("er der røde flag")), ["LassoRiskObservations"]);
  // Ikke-træf: kreditspørgsmålet er stadig kreditvurderingen.
  assert.deepEqual(company("kan vi handle med dem").topics, ["kredit"]);
  assert.equal(lead0(company("hvad er deres kreditvurdering"))!.type, "LassoCreditRating");
  // Forrang: "roede flag" hører ikke længere til kreditten; med kredit står kreditvurderingen som lead nr. 2.
  const both = company("kan vi handle med dem, er der røde flag");
  assert.deepEqual(both.topics, ["kredit", "roede-flag"]);
  assert.deepEqual(companyAskTypes(both), ["observationer", "kredit"]);
  assert.deepEqual(leads(both), ["LassoRiskObservations", "LassoCreditRating"]);
  assert.equal(askFocus(both), "risiko");
});

test("B1 fusion: træf, ikke-træf og forrang for historikken", () => {
  assert.deepEqual(company("har de været med i en fusion eller spaltning").topics, ["fusion"]);
  assert.deepEqual(company("er de blevet fusioneret med nogen eller delt op").topics, ["fusion"]);
  assert.deepEqual(company("hvem er de overtaget af").topics, ["fusion"]);
  assert.deepEqual(leads(company("har de været med i en fusion")), ["LassoMergers"]);
  // Ikke-træf: "hvad er der sket" er historikken.
  assert.deepEqual(company("hvad er der sket").topics, ["historik"]);
  // Forrang: fusionsordet bruges før historikken.
  assert.deepEqual(company("vis fusionshistorikken").topics, ["fusion"]);
});

test("B1 meddelelser: træf, ikke-træf og forrang for nyheder og historik", () => {
  assert.deepEqual(company("hvad har de offentliggjort for nylig").topics, ["meddelelser"]);
  assert.deepEqual(company("er der nye offentliggørelser i Statstidende").topics, ["meddelelser"]);
  assert.deepEqual(leads(company("er der bekendtgørelser om dem")), ["LassoAnnouncements"]);
  // Ikke-træf: nyhederne er stadig nyhederne.
  assert.deepEqual(company("har de været i nyhederne").topics, ["nyheder"]);
  // Forrang: "statstidende" og "meddelelser" er ikke nyheder; dokumenterne først, når de nævnes først.
  assert.deepEqual(company("nyheder og meddelelser").topics, ["nyheder", "meddelelser"]);
  const docs = company("hvilke dokumenter er der offentliggjort");
  assert.deepEqual(docs.topics, ["dokumenter", "meddelelser"]);
  assert.equal(lead0(docs)!.type, "LassoPublications");
});

test("B1 dokumenter: træf, ikke-træf og forrang for regnskabet", () => {
  assert.deepEqual(company("hvilke dokumenter og filer ligger der hos Erhvervsstyrelsen").topics, ["dokumenter"]);
  assert.deepEqual(company("hvilke bilag er indsendt").topics, ["dokumenter"]);
  assert.deepEqual(leads(company("vis publikationerne")), ["LassoPublications"]);
  // Ikke-træf: årsrapporten er regnskabet.
  assert.deepEqual(company("vis årsrapporten").topics, ["regnskab"]);
  // Forrang: dokumenterne før regnskabet, når de nævnes først.
  const a = company("vis dokumenterne med regnskabet");
  assert.deepEqual(companyAskTypes(a), ["dokumenter", "regnskab"]);
  assert.equal(lead0(a)!.type, "LassoPublications");
});

test("B1 branchesammenligning: træf, ikke-træf og forrang for branchen", () => {
  // "klarer … sig i forhold til" bruges af sammenligningen; "branchen" bliver tilbage til branchen (forrang afgør).
  assert.deepEqual(company("hvordan klarer de sig i forhold til branchen").topics, ["branchesammenligning", "branche"]);
  assert.deepEqual(company("hvordan klarer Eksempel Transport A/S sig i forhold til branchen", "Eksempel Transport A/S").topics, ["branchesammenligning"]);
  assert.deepEqual(company("hvad er branchegennemsnittet").topics, ["branchesammenligning"]);
  const gauge = lead0(company("hvordan klarer de sig i forhold til branchen"))!;
  assert.deepEqual([gauge.type, gauge.props], ["LassoKeyFigureGauge", { metrics: ["soliditetsgrad", "overskudsgrad", "likviditetsgrad"] }]);
  // Spurgte nøgletal, som måleren kender, afgrænser måleren (andre springes over); måleren før grafen.
  const m = company("er omsætningen og soliditeten bedre end branchen");
  assert.deepEqual(companyAskTypes(m), ["branchesammenligning", "noegletal"]);
  assert.deepEqual(lead0(m)!.props, { metrics: ["soliditetsgrad"] });
  // Ikke-træf: "hvilken branche" er stamdata.
  assert.deepEqual(company("hvilken branche er de i").topics, ["branche"]);
  // Forrang: branchesammenligningen før branchen ("bedre end gennemsnittet i sin branche").
  const b = company("er de bedre end gennemsnittet i sin branche");
  assert.equal(b.topics[0], "branchesammenligning");
  assert.equal(lead0(b)!.type, "LassoKeyFigureGauge");
});

test("B1 placering: træf, ikke-træf og forrang for adresse og enheder", () => {
  assert.deepEqual(company("hvor ligger deres afdelinger").topics, ["placering"]);
  assert.deepEqual(company("hvor har de sine adresser på et kort").topics, ["placering"]);
  assert.deepEqual(leads(company("vis dem på kortet")), ["LassoMap"]);
  // Ikke-træf: "hvor ligger de" er adressen, "hvor mange afdelinger" er enhederne.
  assert.deepEqual(company("hvor ligger de").topics, ["adresse"]);
  assert.deepEqual(company("hvor mange afdelinger har de").topics, ["enheder"]);
  assert.equal(lead0(company("hvor mange afdelinger har de"))!.type, "LassoProductionUnits");
  // Forrang: kortet først, enhederne som lead nr. 2, også når afdelingerne nævnes først.
  const both = company("hvilke afdelinger har de, vis dem på et kort");
  assert.deepEqual(both.topics, ["enheder", "placering"]);
  assert.deepEqual(leads(both), ["LassoMap", "LassoProductionUnits"]);
});

test("B1 hele regnskabet: træf, ikke-træf og forrang for regnskab og regnskabsår", () => {
  assert.deepEqual(company("vis hele regnskabet").topics, ["heleregnskab"]);
  assert.deepEqual(company("jeg vil se det komplette regnskab med alle poster og kunne skifte år").topics, ["heleregnskab"]);
  assert.deepEqual(leads(company("vis hele regnskabet")), ["LassoFinancialStatements"]);
  // Ikke-træf: "vis regnskabet" er resultatopgørelse og balance.
  assert.deepEqual(company("vis regnskabet").topics, ["regnskab"]);
  assert.equal(lead0(company("vis regnskabet"))!.type, "LassoIncomeStatement");
  // Forrang: vinder over regnskabstypen; et regnskabsår er en prop, ikke et nøgletalssvar.
  assert.deepEqual(companyAskTypes(company("vis hele regnskabet og balancen")), ["heleregnskab"]);
  const y = company("vis hele regnskabet for 2023");
  assert.deepEqual(companyAskTypes(y), ["heleregnskab"]);
  assert.deepEqual(lead0(y)!.props, { year: 2023 });
});

test("B1 registrering: træf, ikke-træf, forrang for formålet og variant", () => {
  assert.deepEqual(company("hvilken selskabskapital og hvilke vedtægter har de").topics, ["registrering"]);
  assert.deepEqual(company("hvad er de registreret med af kapital og tegningsregel").topics, ["registrering"]);
  assert.deepEqual(company("hvem kan tegne selskabet").topics, ["registrering"]);
  const full = lead0(company("hvad er selskabskapitalen"))!;
  assert.deepEqual([full.type, full.props], ["LassoRegistration", { variant: "full" }]);
  // Ikke-træf: formålet alene er stadig profilen; "kapitalandel" er ikke kapitalen.
  assert.deepEqual(company("hvad er formålet").topics, ["formaal"]);
  assert.deepEqual(company("hvad er deres kapitalandel").topics, []);
  // Forrang: tegningsreglen er flyttet fra formålet; formålet ved registreringen er profil-varianten.
  const both = company("vedtægter og formål");
  assert.deepEqual(both.topics, ["registrering", "formaal"]);
  assert.equal(lead0(both)!.type, "LassoRegistration");
  const purpose = askPlan(company("hvad er formålet ifølge registreringen"), "company").lead;
  assert.deepEqual(purpose.map((i) => i.type), ["LassoTextSections", "LassoRegistration"]);
  assert.deepEqual(purpose[1]!.props, { variant: "profile" });
});

test("B1 opsummering: træf, ikke-træf og forrang for de brede emner", () => {
  assert.deepEqual(company("giv mig en kort opsummering").topics, ["opsummering"]);
  assert.deepEqual(company("giv mig en tl;dr").topics, ["opsummering"]);
  assert.deepEqual(company("kort fortalt, hvad er det").topics, ["opsummering"]);
  const s = lead0(company("giv mig et resumé"))!;
  assert.deepEqual([s.type, s.props], ["LassoSummary", { text: SUMMARY_PENDING_TEXT }]);
  // Ikke-træf: "fortæl om" er stadig generelt (fokus-siden).
  assert.equal(company("fortæl om Eksempel Byg", "Eksempel Byg").generic, true);
  // Forrang: opsummeringen først, når den nævnes først.
  const a = company("opsummer regnskabet");
  assert.deepEqual(companyAskTypes(a), ["opsummering", "regnskab"]);
  assert.equal(lead0(a)!.type, "LassoSummary");
});

test("B1 ændringer: træf, ikke-træf, forrang for historikken og perioden", () => {
  assert.deepEqual(company("hvad er der ændret de sidste 90 dage").topics, ["aendringer"]);
  assert.deepEqual(company("vis ændringsfeedet").topics, ["aendringer"]);
  assert.deepEqual(lead0(company("hvad er sket de seneste 2 uger"))!.props, { days: 14 });
  assert.deepEqual(lead0(company("vis ændringsfeedet"))!, { type: "LassoChangeFeed", props: { days: 30 }, full: true });
  // Ikke-træf: ændringer uden periode er historikken.
  assert.deepEqual(company("hvad er der ændret").topics, ["historik"]);
  assert.equal(lead0(company("hvad er der ændret"))!.type, "LassoTimeline");
  // Forrang: perioden gør det til ændringsfeedet, ikke historikken.
  assert.deepEqual(company("hvad er der sket de sidste 3 måneder").topics, ["aendringer"]);
  assert.equal(changeDays("de sidste 3 måneder"), 90);
  assert.equal(changeDays("de sidste 6 måneder"), 90);
  assert.equal(changeDays("de sidste 14 dage"), 14);
  assert.equal(changeDays("hvad er nyt"), 30);
});

test("B1 score: kreditscoren er scoren; måleren svarer (scorehistorikken er slettet, Jakob 01.10)", () => {
  assert.deepEqual(company("hvordan har kreditscoren udviklet sig over tid").topics, ["score"]);
  assert.deepEqual(leads(company("hvordan har kreditscoren udviklet sig over tid")), ["LassoScoreGauge"]);
  assert.deepEqual(leads(company("gik scoren op eller ned det seneste år")), ["LassoScoreGauge"]);
  // Ikke-træf: uden udvikling som i dag.
  assert.deepEqual(leads(company("hvad er deres score")), ["LassoScoreGauge"]);
  // Forrang: kreditvurdering og score er stadig to emner.
  assert.deepEqual(company("kreditvurdering og score").topics, ["kredit", "score"]);
});

test("B1 persontal: træf, ikke-træf og forrang for roller (kun person)", () => {
  assert.deepEqual(person("hvor mange roller og ejerskaber har hun haft i alt").topics, ["persontal", "ejere"]);
  assert.deepEqual(person("hvor mange selskaber har hun siddet i, og hvor mange er ophørt").topics, ["persontal"]);
  assert.deepEqual(leads(person("hvor mange roller har hun"), "person"), ["LassoPersonStats"]);
  assert.equal(askPersonFocus(person("hvor mange roller har hun")), "roller");
  // Ikke-træf: "hvilke roller" er rollelisten; en virksomhedsside kender ikke persontal.
  assert.deepEqual(person("hvilke roller har hun").topics, ["roller"]);
  assert.equal(company("hvor mange ansatte er der i alt").topics.includes("persontal"), false);
  // Forrang: "hvor mange bestyrelser" er tallene, ikke bestyrelsesposterne.
  assert.deepEqual(person("hvor mange bestyrelser sidder hun i").topics, ["persontal"]);
  assert.deepEqual(personAskTypes(person("hvor mange roller og ejerskaber har hun")), ["persontal", "roller"]);
});

test("B1 topic-hint: forrest i emnerne, ikke generelt, ukendte og forkerte slags ignoreres", () => {
  const hinted = parseAsk("hvad med dem", "company", { today, topic: "risiko" });
  assert.deepEqual(hinted.topics, ["roede-flag"]);
  assert.equal(hinted.generic, false);
  assert.equal(lead0(hinted)!.type, "LassoRiskObservations");
  // Hintet rangerer før nøgletal og emner i teksten; ingen dubletter.
  const first = parseAsk("hvad er omsætningen og revisor", "company", { today, topic: "opsummering" });
  assert.deepEqual(first.topics, ["opsummering", "revisor"]);
  assert.equal(companyAskTypes(first)[0], "opsummering");
  assert.deepEqual(parseAsk("vis hele regnskabet", "company", { today, topic: "heleregnskab" }).topics, ["heleregnskab"]);
  // "regnskab" som hint ved hele regnskabet: hele regnskabet vinder stadig.
  assert.equal(lead0(parseAsk("Vis hele regnskabet", "company", { today, topic: "regnskab" }))!.type, "LassoFinancialStatements");
  // Ukendt værdi og emne for den anden slags side: ignoreres.
  assert.equal(parseAsk("fortæl om dem", "company", { today, topic: "vejret" }).generic, true);
  assert.equal(parseAsk("fortæl om dem", "company", { today, topic: "persontal" }).generic, true);
  assert.deepEqual(parseAsk("hvem er hun", "person", { today, topic: "stats" }).topics, ["persontal"]);
});

test("B1 normalizeTopic: kanoniske værdier og aliaserne fra ordbogens afsnit 4", () => {
  for (const t of ASK_TOPICS) assert.equal(normalizeTopic(t), t, t);
  const aliases: [string, string][] = [
    ["risiko", "roede-flag"], ["roede_flag", "roede-flag"], ["red_flags", "roede-flag"], ["advarsler", "roede-flag"],
    ["fusioner", "fusion"], ["spaltning", "fusion"], ["mergers", "fusion"],
    ["offentliggoerelser", "meddelelser"], ["statstidende", "meddelelser"], ["announcements", "meddelelser"],
    ["publikationer", "dokumenter"], ["filer", "dokumenter"], ["documents", "dokumenter"],
    ["branche_sammenligning", "branchesammenligning"], ["benchmark", "branchesammenligning"], ["branchetal", "branchesammenligning"],
    ["kort", "placering"], ["map", "placering"], ["adresser", "placering"], ["afdelinger", "placering"],
    ["hele_regnskabet", "heleregnskab"], ["fuldt_regnskab", "heleregnskab"], ["statements", "heleregnskab"],
    ["kapital", "registrering"], ["vedtaegter", "registrering"], ["registration", "registrering"],
    ["resume", "opsummering"], ["summary", "opsummering"], ["tldr", "opsummering"],
    ["changes", "aendringer"], ["aendringsfeed", "aendringer"], ["seneste_aendringer", "aendringer"],
    ["kreditscore", "score"], ["rating_history", "score"],
    ["antal_roller", "persontal"], ["stats", "persontal"],
    ["kredit", "kredit"], ["kreditvurdering", "kredit"], ["creditsafe", "kredit"],
  ];
  for (const [alias, t] of aliases) assert.equal(normalizeTopic(alias), t, alias);
  // Store bogstaver, æøå, mellemrum og bindestreger er ligegyldige.
  assert.equal(normalizeTopic("Røde flag"), "roede-flag");
  assert.equal(normalizeTopic("Red Flags"), "roede-flag");
  assert.equal(normalizeTopic(" Vedtægter "), "registrering");
  assert.equal(normalizeTopic("reelle_ejere"), "reelle-ejere");
  // Ukendt: undefined.
  assert.equal(normalizeTopic("vejret"), undefined);
  assert.equal(normalizeTopic(""), undefined);
  assert.equal(normalizeTopic("toString"), undefined);
});

test("B1 etiketter og fokus for de nye emner", () => {
  assert.equal(askLabel(company("er der røde flag"), "company"), "Røde flag");
  assert.equal(askLabel(company("hvor mange roller har hun"), "company"), undefined);
  assert.equal(askLabel(person("hvor mange roller har hun"), "person"), "Antal roller og selskaber");
  assert.equal(askFocus(company("har de været med i en fusion")), "historik");
  assert.equal(askFocus(company("vis hele regnskabet")), "regnskab");
});
