import { OPERATORS, type Criterion } from "./criteria.js";
import { FIELDS, FIELD_BY_KEY, OPERATORS_BY_TYPE } from "./fields.js";
import { METRICS, TABLE_COLUMNS, type ComponentType } from "./spec.js";

/**
 * Komponentkataloget, som modellen læser. ChatGPT læser ikke resources, så
 * kataloget skal stå i tool-beskrivelser og serverinstruktioner. Beskrivelserne
 * er vigtigere end koden: det er dem, modellen vælger ud fra.
 */
export interface CatalogEntry {
  type: ComponentType;
  title: string;
  description: string;
  props: string;
}

/**
 * Kompositionsregler fra designguidens trin 23. Står over kataloget i tool-
 * beskrivelserne, så modellen vælger antal og rækkefølge før den vælger komponent.
 */
export const COMPOSITION_RULES = `Komposition (guide 23):
- Én virksomhed: brug show_company med focus (overblik, oekonomi, ejerskab, ledelse, risiko, historik). Serveren henter data og vælger selv formen efter virksomhedens data. Byg IKKE selv en virksomhedsside med render_view; brug kun render_view til flere virksomheder, eller når brugeren beder om bestemte elementer, som focus ikke dækker.
- ÉN visning pr. svar. Kald højst ét af show_company, search_companies og render_view pr. brugerbesked, og kun én gang. Skal der mere med end show_company kan vise, så byg HELE svaret som én render_view-spec i stedet for at kalde flere værktøjer.
- Visningen er ét dashboard (layout 'dashboard', standard): 4 kolonner, hver komponent i sin bredde (width: quarter ¼, half ½, three-quarters ¾, full). Udelad width for standardbredden. Nøgletal, tabeller og hoved står i fuld bredde; to halve (fx graf + LassoKeyValueList, LassoPersonList + LassoOwnerList) står side om side, så læg dem efter hinanden. Efterlad aldrig en halv alene i en række: giv den width 'full' eller en makker. En ¼ (fx LassoRelations) står ved siden af en ¾.
- Virksomhedsside i denne rækkefølge: LassoCompanyHead; LassoRiskObservations kun hvis en observation er ≥50; LassoKeyFigureCards; ÉN graf ved siden af LassoKeyValueList (layout 'grid-2'); personer og ejere (LassoPersonList + LassoOwnerList, eller LassoRelations i smal kolonne); LassoTimeline og LassoNews.
- Højst én graf pr. overblik. Flere grafer stables aldrig; vælg den ene, spørgsmålet peger på.
- Bredt spørgsmål ("fortæl om X", "hvordan går det for X") → overblik med de centrale komponenter i rækkefølgen ovenfor.
- Snævert spørgsmål ("hvor mange ansatte har X", "hvem er revisor") → ét lille element (LassoKeyFigureCards med ét metric, LassoKeyValueList eller den ene liste), ikke et overblik.
- Flere virksomheder → LassoCompareTable (2–6 navngivne, flere nøgletal) eller LassoRanking (2–10 navngivne, ét nøgletal); mange fundet med kriterier → LassoCompanyTable. Aldrig én enkeltvisning pr. virksomhed.`;

export const COMPONENT_CATALOG: readonly CatalogEntry[] = [
  // (c) Virksomhedsfakta -------------------------------------------------------
  {
    type: "LassoCompanyHead",
    title: "Virksomhedshoved",
    description:
      "Brug til: identitet for én virksomhed (navn, CVR, status, form, branche, adresse); står altid øverst, når visningen handler om én virksomhed. Brug ikke når: kun ét stamdatafelt skal vises (LassoKeyValueList variant 'company') eller visningen handler om flere virksomheder (LassoCompareTable/LassoCompanyTable). Kræver: company; stamdata findes for alle CVR-virksomheder. Eksempel: 'Hvad er CVR-nummer og adresse på Lasso X?'",
    props: "company",
  },
  {
    type: "LassoKeyValueList",
    title: "Nøgle-værdi-liste",
    description:
      "Brug til: mange felter med én værdi hver. variant 'company': revisor, regnskabsperiode, stiftet, form, branche, kontakt – til stamdataspørgsmål ('hvornår er X stiftet', 'hvem er revisor', 'hvilken virksomhedsform'). variant 'financials': ALLE regnskabstal for ét valgt år med årsvælger – til 'vis regnskabet for 2024'. Brug ikke når: tallet skal have ændring mod året før (LassoKeyFigureCards), flere år skal ses ved siden af hinanden (LassoMultiYearTable), eller det gælder formål/tegningsregler som løbende tekst (LassoTextSections). Kræver: company, variant?; manglende felter udelades eller står som 'Ikke oplyst'. Eksempel: 'Hvornår er Lasso X stiftet, og hvornår slutter regnskabsåret?'",
    props: "company, variant? (company | financials), title?",
  },
  {
    type: "LassoTextSections",
    title: "Tekstsektioner",
    description:
      "Brug til: CVR-tekster som korte afsnit: branchebeskrivelse, formål (formålsparagraffen) og tegningsregler. Vælg ved 'hvad laver X', 'formål', 'tegningsregel', 'hvem kan tegne selskabet'. Brug ikke når: feltet er en kort værdi som stiftet, form eller revisor (LassoKeyValueList variant 'company'), eller du selv skal skrive en vurdering (LassoSummary). Kræver: company; manglende tekster udelades. Eksempel: 'Hvad er formålet med selskabet X, og hvem kan tegne det?'",
    props: "company, title?",
  },
  {
    type: "LassoSummary",
    title: "Resumé",
    description:
      "Brug til: din egen analyse eller vurdering i prosa, vist som almindelig sektion med kildelinje – 'vurdér', 'opsummér', 'hvad synes du om'. Du skriver hele teksten i 'text' ud fra data, du allerede har fået; komponenten henter intet. Brug ikke når: teksten findes i CVR (LassoTextSections), eller spørgsmålet kan besvares med tal alene (LassoKeyFigureCards). Kræver: text (1–4000 tegn), title?, source?, updated?. Eksempel: 'Giv mig en kort vurdering af X's økonomi' (sammen med LassoKeyFigureCards).",
    props: "text, title?, source?, updated?",
  },
  {
    type: "LassoTimeline",
    title: "Tidslinje",
    description:
      "Brug til: begivenheder over tid – stiftelse, ledelsesskift og offentliggjorte regnskaber, nyeste øverst. Vælg ved 'historik', 'hvad er der sket', 'hvornår skiftede de direktør'. Brug ikke når: det gælder tal over år (LassoBarChart), de nuværende personer (LassoPersonList) eller ekstern omtale i medier (LassoNews). Kræver: company; bygges af CVR- og regnskabsdata og er derfor sjældent tom. Eksempel: 'Hvad er der sket hos X gennem årene?'",
    props: "company, title?",
  },
  {
    type: "LassoNews",
    title: "Nyheder",
    description:
      "Brug til: ekstern omtale – nyhedsartikler om virksomheden med kilde, tidspunkt og uddrag. Vælg ved 'nyheder', 'omtale', 'i medierne', 'seneste nyt'. Brug ikke når: det gælder registrerede ændringer i CVR (LassoTimeline) eller Lassos egne risikosignaler (LassoRiskObservations). Kræver: company, limit? (standard 5); ingen artikler giver tom tilstand. Eksempel: 'Har X været i nyhederne på det seneste?'",
    props: "company, limit? (1–10, standard 5)",
  },

  // (a) Tal og grafer ------------------------------------------------------------
  {
    type: "LassoKeyFigureCards",
    title: "Nøgletalskort",
    description:
      "Brug til: 1–6 tal fra seneste regnskab, hvert med ændring mod året før ('ét tal med udvikling') – det hurtige økonomiske snapshot, eller ét enkelt tal med metrics på ét element. Brug ikke når: udviklingen over flere år efterspørges (LassoBarChart som graf, LassoMultiYearTable som tal), hele regnskabet for ét år (LassoKeyValueList variant 'financials'), eller stamdata uden tal (LassoKeyValueList variant 'company'). Kræver: company, metrics? (standard 4 kort); uden regnskab står kortene som 'Ikke oplyst'. Eksempel: 'Hvor mange ansatte har Danfoss?' → metrics ['ansatte'].",
    props: `company, metrics? (1–6 af ${METRICS.join(" | ")})`,
  },
  {
    type: "LassoBarChart",
    title: "Søjlegraf, ét nøgletal",
    description:
      "Brug til: udviklingen i ÉT nøgletal over 2–10 år som søjler ('udvikling over år'). Brug ikke når: 2–3 nøgletal skal ses i samme graf (LassoGroupedBarChart), én anden virksomhed skal med som benchmark (LassoLineChart), tallene ønskes aflæst som tabel eller 4+ nøgletal (LassoMultiYearTable), kun seneste år (LassoKeyFigureCards), eller egenkapital mod gæld (LassoStackedBarChart). Kræver: company, metric, years (standard 5); år uden regnskab udelades. Eksempel: 'Hvordan har omsætningen udviklet sig hos Carlsberg de sidste 10 år?'",
    props: `company, metric (${METRICS.join(" | ")}), years (2–10, standard 5)`,
  },
  {
    type: "LassoGroupedBarChart",
    title: "Grupperede søjler, 2–3 nøgletal",
    description:
      "Brug til: 2–3 nøgletal side om side pr. år for én virksomhed, når spørgsmålet nævner flere nøgletal sammen ('omsætning og resultat over tid'). Brug ikke når: kun ét nøgletal (LassoBarChart), 4+ nøgletal eller tallene skal aflæses præcist (LassoMultiYearTable), to virksomheder (LassoLineChart med benchmark), eller delene udgør en helhed som egenkapital + gæld (LassoStackedBarChart). Kræver: company, metrics (2–3), years. Eksempel: 'Vis omsætning og resultat for Vestas over de seneste 5 år.'",
    props: `company, metrics (2–3 af ${METRICS.join(" | ")}), years (2–10, standard 5)`,
  },
  {
    type: "LassoLineChart",
    title: "Linjegraf med benchmark",
    description:
      "Brug til: ét nøgletal som linje over år for én virksomhed med ÉN benchmark-virksomhed som stiplet linje – dvs. præcis to virksomheder, ét nøgletal, over tid. Brug ikke når: kun én virksomhed uden benchmark (LassoBarChart), 3+ virksomheder (LassoCompareTable for flere nøgletal, LassoRanking for ét nøgletal i seneste år), eller flere nøgletal for én virksomhed (LassoGroupedBarChart). Kræver: company, metric, years, benchmark. Eksempel: 'Sammenlign omsætningsudviklingen for Netto og Rema 1000 over 5 år.'",
    props: `company, metric (${METRICS.join(" | ")}), years (2–10, standard 5), benchmark? (virksomhed)`,
  },
  {
    type: "LassoStackedBarChart",
    title: "Stablede søjler, balance pr. år",
    description:
      "Brug til: egenkapital og gæld som dele af balancen pr. år ('dele af en helhed' over tid). Brug ikke når: kun seneste år (LassoShareBars), udvikling i ét nøgletal (LassoBarChart, fx metric 'egenkapital'), eller frit valgte nøgletal ved siden af hinanden (LassoGroupedBarChart). Kræver: company, years; gæld er endnu ikke bekræftet i live-regnskaber, så komponenten kan vise tom tilstand for rigtige virksomheder – er kun egenkapitalen relevant, så vælg LassoBarChart. Eksempel: 'Hvordan har forholdet mellem egenkapital og gæld udviklet sig hos X?'",
    props: "company, years (2–10, standard 5)",
  },
  {
    type: "LassoShareBars",
    title: "Andelsbjælker, balance seneste år",
    description:
      "Brug til: egenkapital og gæld som andele i procent af balancen for seneste regnskabsår – ét år, dele af en helhed. Brug ikke når: flere år (LassoStackedBarChart), eller egenkapitalen som tal med ændring (LassoKeyFigureCards metrics ['egenkapital']). Kræver: company; gæld er ubekræftet i live-data og kan give tom tilstand. Eksempel: 'Hvor stor en del af balancen er egenkapital hos X i dag?'",
    props: "company",
  },
  {
    type: "LassoWaterfallChart",
    title: "Vandfald, omsætning til resultat",
    description:
      "Brug til: 'fra A til B' – hvordan omsætning/bruttofortjeneste bliver til årets resultat i seneste regnskabsår. Brug ikke når: udvikling over år (LassoBarChart), enkelte tal med ændring (LassoKeyFigureCards), eller alle regnskabslinjer som tal (LassoKeyValueList variant 'financials'). Kræver: company; mangler resultat i seneste regnskab, vises tom tilstand. Eksempel: 'Hvor bliver pengene af mellem omsætning og resultat hos X?'",
    props: "company",
  },
  {
    type: "LassoMultiYearTable",
    title: "Flerårstabel",
    description:
      "Brug til: nøgletal × år som TAL i en tabel med ændring og tendens pr. række – når brugeren vil aflæse præcise tal for 1–6 nøgletal over 2–10 år, eller når 4+ nøgletal skal ses over tid (for mange til en graf). Brug ikke når: ét nøgletal som udvikling (LassoBarChart), 2–3 nøgletal som graf (LassoGroupedBarChart), eller kun ét år (LassoKeyValueList variant 'financials'). Kræver: company, metrics?, years. Eksempel: 'Giv mig omsætning, bruttofortjeneste, resultat og egenkapital for X for hvert af de sidste 5 år i en tabel.'",
    props: `company, metrics? (1–6 af ${METRICS.join(" | ")}), years (2–10, standard 5), title?`,
  },

  // (b) Personer og ejere ------------------------------------------------------
  {
    type: "LassoPersonList",
    title: "Ledelse og bestyrelse",
    description:
      "Brug til: personer og roller – direktion og bestyrelse med rolle og tiltrådt/fratrådt; show 'all' ved 'udskiftning', 'tidligere direktør', 'hvem er gået'. Brug ikke når: spørgsmålet gælder ejere (LassoOwnerList/LassoBeneficialOwners), pladsen er en smal kolonne med både personer og ejere (LassoRelations), eller det gælder datoer for skift som historik (LassoTimeline). Kræver: company, show? (standard 'current'). Eksempel: 'Hvem sidder i bestyrelsen hos Novo Nordisk?'",
    props: "company, show? (current | all), title?",
  },
  {
    type: "LassoOwnerList",
    title: "Legale ejere og revisor",
    description:
      "Brug til: 'hvem ejer X' – de legale (direkte) ejere med ejerandel-interval, samt revisor. Standardvalget for ejerspørgsmål. Brug ikke når: spørgsmålet siger 'reelle ejere', 'i sidste ende' eller 'personerne bag' gennem mellemled (LassoBeneficialOwners), eller 'koncern', 'moderselskab', 'datterselskaber', 'ejerstruktur' i flere lag (LassoOwnershipDiagram). Kræver: company; ejerandele fra CVR vises som intervaller. Eksempel: 'Hvem ejer Lasso X, og hvem er revisor?'",
    props: "company",
  },
  {
    type: "LassoBeneficialOwners",
    title: "Reelle ejere",
    description:
      "Brug til: reelle ejere – de fysiske personer, der i sidste ende ejer virksomheden, med samlet indirekte andel og ejerkæden gennem mellemliggende selskaber. Vælg kun, når spørgsmålet indeholder 'reelle ejere', 'i sidste ende', 'personerne bag' eller 'gennem holdingselskaber'. Brug ikke når: direkte/legale ejere (LassoOwnerList) eller hele koncernstrukturen som diagram med datterselskaber (LassoOwnershipDiagram). Kræver: company; Lassos svarform er endnu ubekræftet, så rækker kan stå som 'Ikke oplyst'. Eksempel: 'Hvem er de reelle ejere bag Lasso X?'",
    props: "company",
  },
  {
    type: "LassoOwnershipDiagram",
    title: "Ejerdiagram, koncern",
    description:
      "Brug til: koncernstruktur i flere lag som diagram: ejere over, datterselskaber under, virksomheden i midten. Vælg ved 'koncernen bag', 'moderselskab', 'datterselskaber', 'ejerstruktur', 'hvordan hænger selskaberne sammen'. Brug ikke når: kun én liste af direkte ejere med andele (LassoOwnerList), eller kun personerne i sidste ende med deres andel (LassoBeneficialOwners). Kræver: company, ingoingDepth? (lag op, standard 2), outgoingDepth? (lag ned, standard 1); svarer ejergrafen ikke, vises ét lag direkte ejere med en note. Eksempel: 'Hvordan ser koncernstrukturen ud omkring X, og hvilke datterselskaber har den?'",
    props: "company, ingoingDepth? (lag op, standard 2), outgoingDepth? (lag ned, standard 1), onDate? (ÅÅÅÅ-MM-DD), title?",
  },
  {
    type: "LassoRelations",
    title: "Rolleliste, kompakt",
    description:
      "Brug til: direktion, bestyrelse (formand i parentes) og de tre største legale ejere i ÉT kompakt element – kun i en smal kolonne (grid-2 ved siden af en større komponent) på et bredt overblik. Den erstatter LassoPersonList OG LassoOwnerList sammen, ikke den ene. Brug ikke når: spørgsmålet specifikt gælder ledelsen (LassoPersonList), ejerne (LassoOwnerList), eller listen står i fuld bredde. Kræver: company. Eksempel: 'Fortæl om X' i grid-2, hvor personer og ejere skal fylde ¼–½ bredde.",
    props: "company, title?",
  },

  // (d) Flere virksomheder -----------------------------------------------------
  {
    type: "LassoCompareTable",
    title: "Sammenligning, navngivne virksomheder",
    description:
      "Brug til: 2–6 NAVNGIVNE virksomheder side om side på 1–5 nøgletal fra seneste år – 'sammenlign A og B', 'A vs. B på omsætning og ansatte'. Brug ikke når: kun ét nøgletal og rækkefølgen er pointen (LassoRanking), udvikling over år for to virksomheder (LassoLineChart med benchmark), eller virksomhederne først skal findes med kriterier (LassoCompanyTable). Kræver: companies[] (2–6), metrics? (standard 4). Eksempel: 'Sammenlign Lasso X, Risika og Bisnode på omsætning, resultat og ansatte.'",
    props: `companies[] (2–6), metrics? (1–5 af ${METRICS.join(" | ")}), title?`,
  },
  {
    type: "LassoRanking",
    title: "Rangliste, ét nøgletal",
    description:
      "Brug til: placering blandt lignende – 2–10 navngivne virksomheder på ÉT nøgletal (seneste år) som vandrette søjler, den første fremhævet ('hvor ligger X i forhold til …'). Brug ikke når: flere nøgletal pr. virksomhed (LassoCompareTable), udvikling over tid (LassoLineChart med benchmark), eller listen skal findes med kriterier som 'de største i branchen' (LassoCompanyTable med sort). Kræver: companies[] (2–10, alle kendte på forhånd), metric. Eksempel: 'Hvor ligger Lasso X på ansatte i forhold til Bisnode, Experian og Risika?'",
    props: `companies[] (2–10, første fremhæves), metric (${METRICS.join(" | ")}), title?`,
  },
  {
    type: "LassoCompanyTable",
    title: "Virksomhedstabel, søgning",
    description:
      "Brug til: mange virksomheder fundet med kriterier – målgrupper, 'alle X i Y', 'top N efter Z' (sort). Brugeren kan sortere, fjerne kriterier og klikke ind på en virksomhed uden en ny model-tur. Brug ikke når: du allerede kender 2–6 navngivne virksomheder, der skal sammenlignes på flere nøgletal (LassoCompareTable), eller 2–10 navngivne på ét nøgletal (LassoRanking). Kræver: source 'search', search { query, criteria[], sort?, limit? }, columns?; ingen match giver tom tilstand med kriterierne synlige. Eksempel: 'Vis de 20 største revisionsfirmaer i Aarhus efter ansatte.'",
    props: `source='search', search { query, criteria[], sort?, limit? }, columns? (${TABLE_COLUMNS.join(" | ")}), title?`,
  },

  // (e) Risiko og revision -----------------------------------------------------
  {
    type: "LassoRiskObservations",
    title: "Risikoobservationer",
    description:
      "Brug til: risiko – Lassos observationer om virksomheden (negativ egenkapital, revisorskifte, ledelsesændringer, tvangsopløsning m.m.) sorteret efter alvor 0–100. Vælg ved 'risiko', 'røde flag', 'noget at være opmærksom på', 'kreditvurdering', 'kan vi handle med dem'. På en virksomhedsside kun med, når en observation er ≥50. Brug ikke når: spørgsmålet specifikt gælder revisorens uafhængighed (LassoAuditorIndependence), eller en samlet talscore ønskes (LassoScoreGauge har ingen live data – brug denne i stedet). Kræver: company; ingen observationer giver tom tilstand; Lassos svarform er endnu ubekræftet. Eksempel: 'Er der risikosignaler hos X?'",
    props: "company, title?",
  },
  {
    type: "LassoAuditorIndependence",
    title: "Revisoruafhængighed",
    description:
      "Brug til: relationer mellem revisionshuset og kundens ledelse/ejere, vurderet pr. relation på alvorsskalaen. Vælg kun, når spørgsmålet nævner revisor SAMMEN MED uafhængighed, habilitet eller relationer. Brug ikke når: brugeren blot vil vide, hvem revisor er (LassoOwnerList eller LassoKeyValueList variant 'company'), eller spørger bredt om risiko (LassoRiskObservations). Kræver: company; live-data dækker kun navnesammenfald mellem revisionshusets og kundens personer, og komponenten skriver selv den begrænsning. Eksempel: 'Er revisor for X uafhængig af ledelsen?'",
    props: "company, title?",
  },
  {
    type: "LassoScoreGauge",
    title: "Scoremåler (kun demo)",
    description:
      "Brug til: KUN demovisninger. Der findes ingen live datakilde for en 0–100 score; for rigtige virksomheder viser måleren altid 'Ikke oplyst'. Vælg den aldrig til en kunde, der spørger om risiko, score eller kreditvurdering – vælg LassoRiskObservations. Kræver: company. Eksempel: intet kundespørgsmål fører hertil.",
    props: "company, title?",
  },

  // (f) Fysiske enheder --------------------------------------------------------
  {
    type: "LassoProductionUnits",
    title: "Produktionsenheder, P-numre",
    description:
      "Brug til: P-numre/produktionsenheder – filialer, afdelinger, butikker og adresser ud over hovedadressen, med ansatte og status pr. enhed; hovedenheden står først. Vælg ved 'afdelinger', 'filialer', 'P-nummer', 'hvor har de adresser'. Brug ikke når: kun hovedadressen (LassoCompanyHead), ejendomme/bygninger (LassoProperties), eller datterselskaber med egne CVR-numre (LassoOwnershipDiagram). Kræver: company; feltnavnene i CVR-svaret er ubekræftede, så listen kan være tom for rigtige virksomheder. Eksempel: 'Hvor mange afdelinger har X, og hvor ligger de?'",
    props: "company",
  },
  {
    type: "LassoProperties",
    title: "Ejendomme, BBR",
    description:
      "Brug til: ejendomme, virksomheden ejer, med BBR-bygninger (anvendelse, opført, etager, areal) og arealfordeling. Vælg ved 'ejendomme', 'bygninger', 'BBR', 'matrikel', 'fast ejendom'. Brug ikke når: det gælder adresser for afdelinger (LassoProductionUnits) eller virksomhedens egen adresse (LassoCompanyHead). Kræver: company; kilden (ejerfortegnelsen + BBR) er ubekræftet i form, så tom tilstand er sandsynlig for rigtige virksomheder – sig det til brugeren. Eksempel: 'Hvilke ejendomme ejer X, og hvor store er bygningerne?'",
    props: "company, title?",
  },
  {
    type: "LassoLivestock",
    title: "CHR, husdyr (ingen live data)",
    description:
      "Brug til: CHR-besætninger pr. dyretype og veterinære hændelser – kun landbrug med CHR-nummer. Ingen live datakilde endnu: for rigtige virksomheder er komponenten altid tom. Vælg den ikke til kunder, medmindre de udtrykkeligt spørger til CHR/husdyr, og sig så, at data ikke er tilsluttet. Brug ikke når: det gælder ansatte eller økonomi i et landbrug (LassoKeyFigureCards). Kræver: company. Eksempel: 'Hvor mange svin har landbruget X?' (viser tom tilstand live).",
    props: "company",
  },

  // Interaktion ----------------------------------------------------------------
  {
    type: "LassoFollowUps",
    title: "Opfølgningsknapper",
    description:
      "Brug til: 1–4 knapper nederst i et overblik, som sender et opfølgende spørgsmål til dig (modellen) som brugerens næste besked, når der er oplagte næste analyser. Brug ikke når: spørgsmålet var snævert og er besvaret med ét element. Kræver: prompts[] { label, prompt }; henter ingen data. Eksempel: efter 'fortæl om X': 'Hvem er nye i bestyrelsen?', 'Sammenlign med konkurrenter'.",
    props: "prompts[] { label, prompt }",
  },
];

export function catalogAsText(): string {
  return COMPONENT_CATALOG.map((c) => `- ${c.type} (${c.title}): ${c.description} Props: ${c.props}.`).join("\n");
}

export function fieldsAsText(): string {
  return FIELDS.map((f) => {
    const ops = OPERATORS_BY_TYPE[f.type].join(", ");
    const opts = f.options ? ` Værdier: ${f.options.join(", ")}.` : "";
    const unit = f.type === "amount" ? " Hele kroner." : "";
    return `- ${f.key} (${f.label}, ${f.type}): ${f.description}${unit}${opts} Operatorer: ${ops}.`;
  }).join("\n");
}

export const OPERATORS_TEXT = `Operatorer: ${OPERATORS.join(", ")}. gt betyder > og gte betyder ≥.`;

export interface CriterionIssue {
  index: number;
  message: string;
}

/** Tjekker kriterier mod feltkataloget. Returnerer forståelige fejl til modellen. */
export function validateCriteria(criteria: readonly Criterion[]): CriterionIssue[] {
  const issues: CriterionIssue[] = [];
  criteria.forEach((c, index) => {
    const field = FIELD_BY_KEY.get(c.field);
    if (!field) {
      issues.push({ index, message: `Ukendt felt '${c.field}'. Brug et af: ${FIELDS.map((f) => f.key).join(", ")}.` });
      return;
    }
    const allowed = OPERATORS_BY_TYPE[field.type];
    if (!allowed.includes(c.operator)) {
      issues.push({ index, message: `Operator '${c.operator}' passer ikke til '${c.field}'. Tilladte: ${allowed.join(", ")}.` });
      return;
    }
    if (c.operator === "between" && !(Array.isArray(c.value) && c.value.length === 2)) {
      issues.push({ index, message: `'between' på '${c.field}' kræver value: [fra, til].` });
    }
    if ((c.operator === "in" || c.operator === "not_in") && !Array.isArray(c.value)) {
      issues.push({ index, message: `'${c.operator}' på '${c.field}' kræver en liste som value.` });
    }
    if (field.options && c.operator !== "between") {
      const values = Array.isArray(c.value) ? c.value : [c.value];
      const bad = values.filter((v) => !field.options!.some((o) => o.toLowerCase() === String(v).toLowerCase()));
      if (bad.length > 0) {
        issues.push({ index, message: `Ukendt værdi for '${c.field}': ${bad.join(", ")}. Brug: ${field.options.join(", ")}.` });
      }
    }
  });
  return issues;
}
