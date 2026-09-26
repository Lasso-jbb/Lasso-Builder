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
 * beskrivelserne, så modellen vælger værktøj, antal og rækkefølge før den vælger komponent.
 */
export const COMPOSITION_RULES = `Komposition (guide 23):
- Én virksomhed: brug show_company med focus. Serveren henter data og bygger selv siden efter virksomhedens data. Byg IKKE selv en virksomhedsside med render_view. Routing efter spørgsmål: bredt ("fortæl om X") → overblik; økonomi, omsætning, resultat, nøgletal, soliditetsgrad, "hvordan går det" → oekonomi; fuldt regnskab, resultatopgørelse, balance, pengestrøm, "alle posterne" → regnskab; ejere, reelle ejere, koncern → ejerskab; direktion, bestyrelse, udskiftning → ledelse; røde flag, "kan vi handle med dem", revisors uafhængighed → risiko; "hvad er der sket", nyheder → historik; kontaktoplysninger, telefon, e-mail, web, kontaktpersoner → kontakt. Snævre stamdataspørgsmål ("hvem er revisor", "hvornår stiftet", "hvor mange ansatte") → overblik.
- Én person ("hvem er X", "hvor sidder X i bestyrelser", "har X været i konkurser") → show_person. Byg ikke personsider med render_view.
- Flere virksomheder → render_view: LassoCompareTable (2–6 navngivne, flere nøgletal), LassoRanking (2–10 navngivne, ét nøgletal) eller LassoLineChart (2 virksomheder, ét nøgletal over tid); mange fundet med kriterier → search_companies eller LassoCompanyTable. Aldrig én enkeltvisning pr. virksomhed.
- render_view til én virksomhed kun, når brugeren beder om elementer, ingen focus dækker (fx LassoStackedBarChart, LassoProductionUnits, LassoProperties, en egen vurdering i LassoSummary), eller om en kombination på tværs af focus (fx ejere + revisor, resultatopgørelse + ejere). Læg da ALT i én spec: LassoCompanyHead først, dernæst det bestilte, og LassoSummary som sidste sektion.
- ÉN visning pr. svar: kald højst ét af show_company, show_person, search_companies og render_view pr. brugerbesked, og kun én gang. Aldrig show_company og render_view efter hinanden.
- render_view er ét dashboard (layout 'dashboard', standard): 4 kolonner, hver komponent i sin bredde (width: quarter ¼, half ½, three-quarters ¾, full). Udelad width for standardbredden. Hoved, nøgletal, tabeller og fulde regnskaber står i fuld bredde; to halve (fx graf + LassoKeyValueList, LassoPersonList + LassoOwnerList) står side om side, så læg dem efter hinanden. Efterlad aldrig en halv alene i en række: giv den width 'full' eller en makker. En ¼ (fx LassoRelations) står ved siden af en ¾.
- Højst én graf pr. visning. Flere grafer stables aldrig; vælg den ene, spørgsmålet peger på (1 nøgletal → LassoBarChart, 2–3 → LassoGroupedBarChart, 4+ eller "tabel" → LassoMultiYearTable).`;

/** Kort note pr. komponent: hvilken show_company-focus viser den allerede. */
const F = (focus: string) => `Dækkes af show_company focus ${focus}; byg kun selv i render_view sammen med andet.`;

export const COMPONENT_CATALOG: readonly CatalogEntry[] = [
  // (c) Virksomhedsfakta -------------------------------------------------------
  {
    type: "LassoCompanyHead",
    title: "Virksomhedshoved",
    description: `Brug til: identitet for én virksomhed (navn, CVR, status, form, branche, adresse) øverst i enhver visning om én virksomhed. Brug ikke når: kun ét stamdatafelt skal vises (LassoKeyValueList variant 'company') eller det gælder flere virksomheder (LassoCompareTable/LassoCompanyTable). Kræver: company; findes for alle CVR-virksomheder. ${F("overblik (og alle andre focus)")} Eksempel: øverst i en render_view-spec om én virksomhed.`,
    props: "company",
  },
  {
    type: "LassoKeyValueList",
    title: "Nøgle-værdi-liste",
    description: `Brug til: variant 'company' (standard): revisor, seneste revisorskift, regnskabsperiode, stiftet, virksomhedsform, branche, ansatte, adresse, telefon, e-mail, web som én liste – stamdataspørgsmål ('hvem er revisor', 'hvornår stiftet', 'hvilken form'). variant 'financials': de 11 nøgletal (omsætning/bruttofortjeneste, resultat, egenkapital, ansatte, EBITDA, soliditetsgrad, overskudsgrad, likviditetsgrad, balancesum, gæld) plus regnskabsperiode og udgivelsesdato for ÉT år, med årsvælger for de seneste 5 år. Brug ikke når: tallet skal have ændring mod året før (LassoKeyFigureCards), flere år side om side (LassoMultiYearTable), alle regnskabslinjer (LassoIncomeStatement/LassoBalanceSheet), eller det gælder formål/tegningsregler (LassoTextSections). Kræver: company, variant?; manglende felter står som '—'. ${F("overblik, risiko og kontakt (company) samt oekonomi (financials)")} Eksempel: 'Hvem er revisor for Lasso X?' → variant 'company' (eller show_company focus overblik).`,
    props: "company, variant? (company | financials), title?",
  },
  {
    type: "LassoContact",
    title: "Kontaktblok",
    description: `Brug til: telefon, e-mail, web og adresse som klikbare kontaktoplysninger – 'telefonnummer på X', 'hvordan kontakter jeg X'. Brug ikke når: det gælder stamdata som stiftet/form/revisor (LassoKeyValueList variant 'company', som også har kontaktfelterne), eller navngivne personer (LassoContactPersons). Kræver: company; kilden er CVR eller virksomhedens hjemmeside, og komponenten viser tom tilstand, når intet er oplyst. ${F("kontakt (og overblik)")} Eksempel: 'Hvad er telefonnummer og e-mail på Lasso X?' → show_company focus kontakt.`,
    props: "company, title?",
  },
  {
    type: "LassoContactPersons",
    title: "Kontaktpersoner",
    description: `Brug til: navngivne kontaktpersoner fra virksomhedens hjemmeside med rolle/afdeling, telefon og e-mail – 'hvem kan jeg kontakte hos X', 'kontaktpersoner'. Brug ikke når: det gælder direktion/bestyrelse i CVR (LassoPersonList) eller virksomhedens hovednumre (LassoContact). Kræver: company; listen er tom, når hjemmesiden er ukendt eller ingen personer er fundet. ${F("kontakt")} Eksempel: 'Hvem er kontaktpersonerne hos Lasso X?' → show_company focus kontakt.`,
    props: "company, title?",
  },
  {
    type: "LassoTextSections",
    title: "Tekstsektioner",
    description: `Brug til: CVR-tekster som korte afsnit: branchebeskrivelse, formål og tegningsregler – 'hvad laver X', 'formål', 'hvem kan tegne selskabet'. Brug ikke når: feltet er en kort værdi som stiftet/form/revisor (LassoKeyValueList variant 'company'), eller du selv skriver en vurdering (LassoSummary). Kræver: company; manglende tekster udelades. ${F("overblik")} Eksempel: 'Hvad er formålet med selskabet X, og hvem kan tegne det?'`,
    props: "company, title?",
  },
  {
    type: "LassoSummary",
    title: "Resumé",
    description:
      "Brug til: din egen analyse eller vurdering i prosa med kildelinje – 'vurdér', 'opsummér', 'hvad synes du'. Indgår altid som sidste komponent i en render_view-spec sammen med de datakomponenter, vurderingen bygger på (fx LassoCompanyHead + LassoKeyFigureCards + LassoSummary); aldrig som eneste komponent og aldrig som et ekstra kald efter show_company. Du skriver hele 'text' ud fra tal, du allerede kender; komponenten henter intet. Brug ikke når: teksten findes i CVR (LassoTextSections), eller tal alene svarer (LassoKeyFigureCards). Kræver: text (1–4000 tegn), title?, source?, updated?. Dækkes ikke af show_company. Eksempel: 'Giv mig en kort vurdering af X's økonomi' → render_view med LassoCompanyHead, LassoKeyFigureCards, LassoBarChart + LassoKeyValueList, LassoSummary.",
    props: "text, title?, source?, updated?",
  },
  {
    type: "LassoTimeline",
    title: "Tidslinje",
    description: `Brug til: begivenheder over tid – stiftelse, ledelsesskift og offentliggjorte regnskaber, nyeste øverst – 'historik', 'hvad er der sket', 'hvornår skiftede de direktør'. Brug ikke når: det gælder tal over år (LassoBarChart), de nuværende personer (LassoPersonList) eller medieomtale (LassoNews). Kræver: company; bygges af CVR- og regnskabsdata og er sjældent tom. ${F("historik (og overblik, ledelse, risiko)")} Eksempel: 'Hvad er der sket hos X gennem årene?' → show_company focus historik.`,
    props: "company, title?",
  },
  {
    type: "LassoNews",
    title: "Nyheder",
    description: `Brug til: medieomtale – nyhedsartikler om virksomheden med kilde, tidspunkt og uddrag – 'nyheder', 'omtale', 'seneste nyt'. Brug ikke når: det gælder registrerede ændringer i CVR (LassoTimeline) eller Lassos risikosignaler (LassoRiskObservations). Kræver: company, limit? (standard 5); ingen artikler giver tom tilstand. ${F("historik (og overblik)")} Eksempel: 'Har X været i nyhederne?' → show_company focus historik.`,
    props: "company, limit? (1–10, standard 5)",
  },

  // (a) Tal og grafer ------------------------------------------------------------
  {
    type: "LassoKeyFigureCards",
    title: "Nøgletalskort",
    description: `Brug til: 1–6 nøgletal fra seneste regnskab, hvert med ændring mod året før – det hurtige økonomiske snapshot, eller ét enkelt tal ('hvor mange ansatte', 'hvad er soliditetsgraden') med ét metric. Brug ikke når: udvikling over flere år (LassoBarChart som graf, LassoMultiYearTable som tal), alle nøgletal for ét år med årsvælger (LassoKeyValueList variant 'financials'), eller stamdata uden tal (LassoKeyValueList variant 'company'). Kræver: company, metrics? (standard 4 kort); uden regnskab står kortene som 'Ikke oplyst'. ${F("oekonomi (og overblik)")} Eksempel: 'Hvor mange ansatte har Danfoss?' → show_company focus overblik, eller metrics ['ansatte'] i en render_view-spec.`,
    props: `company, metrics? (1–6 af ${METRICS.join(" | ")})`,
  },
  {
    type: "LassoBarChart",
    title: "Søjlegraf, ét nøgletal",
    description: `Brug til: udviklingen i ÉT nøgletal over 2–10 år som søjler. Brug ikke når: 2–3 nøgletal i samme graf (LassoGroupedBarChart), en anden virksomhed som benchmark (LassoLineChart), tabel eller 4+ nøgletal (LassoMultiYearTable), kun seneste år (LassoKeyFigureCards), eller egenkapital mod gæld (LassoStackedBarChart). Kræver: company, metric, years (standard 5); år uden regnskab udelades. ${F("oekonomi (og overblik)")} Eksempel: 'Hvordan har omsætningen udviklet sig hos Carlsberg de sidste 10 år?' → show_company focus oekonomi (chart_metric 'omsaetning', years 10).`,
    props: `company, metric (${METRICS.join(" | ")}), years (2–10, standard 5)`,
  },
  {
    type: "LassoGroupedBarChart",
    title: "Grupperede søjler, 2–3 nøgletal",
    description: `Brug til: 2–3 nøgletal side om side pr. år for én virksomhed ('omsætning og resultat over tid'). Brug ikke når: ét nøgletal (LassoBarChart), 4+ nøgletal eller præcise tal (LassoMultiYearTable), to virksomheder (LassoLineChart), eller egenkapital + gæld som helhed (LassoStackedBarChart). Kræver: company, metrics (2–3), years. ${F("oekonomi")} Eksempel: 'Vis omsætning og resultat for Vestas de seneste 5 år.' → show_company focus oekonomi.`,
    props: `company, metrics (2–3 af ${METRICS.join(" | ")}), years (2–10, standard 5)`,
  },
  {
    type: "LassoLineChart",
    title: "Linjegraf med benchmark",
    description:
      "Brug til: ét nøgletal som linje over år for én virksomhed med ÉN benchmark-virksomhed som stiplet linje – præcis to virksomheder, ét nøgletal, over tid. Brug ikke når: én virksomhed uden benchmark (LassoBarChart), 3+ virksomheder (LassoCompareTable for flere nøgletal, LassoRanking for ét), eller flere nøgletal for én virksomhed (LassoGroupedBarChart). Kræver: company, metric, years, benchmark. Dækkes ikke af show_company. Eksempel: 'Sammenlign omsætningsudviklingen for Netto og Rema 1000 over 5 år.'",
    props: `company, metric (${METRICS.join(" | ")}), years (2–10, standard 5), benchmark? (virksomhed)`,
  },
  {
    type: "LassoStackedBarChart",
    title: "Stablede søjler, balance pr. år",
    description:
      "Brug til: egenkapital og gæld som dele af balancen pr. år over 2–10 år. Brug ikke når: kun seneste år (LassoShareBars), udvikling i ét nøgletal (LassoBarChart med metric 'egenkapital', 'gaeld' eller 'soliditetsgrad'), eller frit valgte nøgletal (LassoGroupedBarChart). Kræver: company, years; mangler gæld i regnskaberne, vises tom tilstand. Dækkes ikke af show_company. Eksempel: 'Hvordan har forholdet mellem egenkapital og gæld udviklet sig hos X?'",
    props: "company, years (2–10, standard 5)",
  },
  {
    type: "LassoShareBars",
    title: "Andelsbjælker, balance seneste år",
    description: `Brug til: egenkapital og gæld som andele i procent af balancen for seneste regnskabsår. Brug ikke når: flere år (LassoStackedBarChart), eller soliditetsgraden som tal med ændring (LassoKeyFigureCards metrics ['soliditetsgrad']). Kræver: company; mangler gæld i regnskabet, vises tom tilstand. ${F("oekonomi")} Eksempel: 'Hvor stor en del af balancen er egenkapital hos X?' → show_company focus oekonomi.`,
    props: "company",
  },
  {
    type: "LassoWaterfallChart",
    title: "Vandfald, omsætning til resultat",
    description: `Brug til: hvordan omsætning/bruttofortjeneste bliver til årets resultat i seneste regnskabsår. Brug ikke når: udvikling over år (LassoBarChart), enkelte tal med ændring (LassoKeyFigureCards), eller alle linjer i resultatopgørelsen (LassoIncomeStatement). Kræver: company; mangler resultat i seneste regnskab, vises tom tilstand. ${F("oekonomi")} Eksempel: 'Hvor bliver pengene af mellem omsætning og resultat hos X?' → show_company focus oekonomi.`,
    props: "company",
  },
  {
    type: "LassoMultiYearTable",
    title: "Flerårstabel",
    description: `Brug til: nøgletal × år som TAL med ændring og tendens pr. række – præcise tal for 1–6 nøgletal over 2–10 år, eller 4+ nøgletal over tid. Brug ikke når: ét nøgletal som graf (LassoBarChart), 2–3 nøgletal som graf (LassoGroupedBarChart), kun ét år (LassoKeyValueList variant 'financials'), eller alle regnskabslinjer (LassoIncomeStatement). Kræver: company, metrics?, years. ${F("oekonomi")} Eksempel: 'Giv mig omsætning, bruttofortjeneste, resultat og egenkapital for X for hvert af de sidste 5 år i en tabel.'`,
    props: `company, metrics? (1–6 af ${METRICS.join(" | ")}), years (2–10, standard 5), title?`,
  },
  {
    type: "LassoIncomeStatement",
    title: "Resultatopgørelse, fuld",
    description: `Brug til: HELE resultatopgørelsen med alle linjer og subtotaler (omsætning/bruttofortjeneste, personaleomkostninger, andre driftsomkostninger, EBITDA, af- og nedskrivninger, finansielle poster, resultat før skat, skat, årets resultat), 2–3 år side om side – 'resultatopgørelsen', 'hele regnskabet', 'alle posterne'. Brug ikke når: kun nøgletal (LassoKeyFigureCards, LassoMultiYearTable) eller balancen (LassoBalanceSheet). Kræver: company, years? (2–3, standard 2); linjer, regnskabet ikke indeholder, står som '—'. ${F("regnskab")} Eksempel: 'Vis hele resultatopgørelsen for X.' → show_company focus regnskab.`,
    props: "company, years? (2–3, standard 2), title?",
  },
  {
    type: "LassoBalanceSheet",
    title: "Balance, fuld",
    description: `Brug til: HELE balancen (aktiver og passiver) med linjer og subtotaler (anlægs- og omsætningsaktiver, balancesum, egenkapital, lang- og kortfristet gæld), 2–3 år side om side – 'balancen', 'aktiver og passiver'. Brug ikke når: kun egenkapital/gæld som andele (LassoShareBars/LassoStackedBarChart) eller ét nøgletal (LassoKeyFigureCards). Kræver: company, years? (2–3, standard 2); linjer, regnskabet ikke indeholder, står som '—'. ${F("regnskab")} Eksempel: 'Vis balancen for X for de sidste to år.' → show_company focus regnskab.`,
    props: "company, years? (2–3, standard 2), title?",
  },
  {
    type: "LassoCashFlow",
    title: "Pengestrømsopgørelse",
    description: `Brug til: pengestrøm fra drift, investering og finansiering til årets pengestrøm og likvider ultimo, 2–3 år side om side – 'pengestrøm', 'cash flow'. Brug ikke når: det gælder resultat (LassoIncomeStatement) eller balance (LassoBalanceSheet). Kræver: company, years? (2–3, standard 2); selskaber i regnskabsklasse B aflægger den ikke, og komponenten viser da 'Pengestrømsopgørelse er ikke indberettet'. ${F("regnskab")} Eksempel: 'Hvordan er pengestrømmen hos X?' → show_company focus regnskab.`,
    props: "company, years? (2–3, standard 2), title?",
  },

  // (b) Personer og ejere ------------------------------------------------------
  {
    type: "LassoPersonList",
    title: "Ledelse og bestyrelse",
    description: `Brug til: direktion og bestyrelse med rolle og tiltrådt/fratrådt; show 'all' ved 'udskiftning', 'tidligere direktør'. Brug ikke når: det gælder ejere (LassoOwnerList/LassoBeneficialOwners), en smal kolonne med både personer og ejere (LassoRelations), eller én bestemt person (show_person). Kræver: company, show? (standard 'current'). ${F("ledelse (og risiko)")} Eksempel: 'Hvem sidder i bestyrelsen hos Novo Nordisk?' → show_company focus ledelse.`,
    props: "company, show? (current | all), title?",
  },
  {
    type: "LassoOwnerList",
    title: "Legale ejere",
    description: `Brug til: 'hvem ejer X' – de legale (direkte) ejere med ejerandel som interval; standardvalget for ejerspørgsmål. Brug ikke når: 'reelle ejere', 'i sidste ende', 'personerne bag' (LassoBeneficialOwners), 'koncern', 'moderselskab', 'datterselskaber', 'ejerstruktur' (LassoOwnershipDiagram), eller 'hvem er revisor' (LassoKeyValueList variant 'company'). Kræver: company; ejerandele fra CVR vises som intervaller. ${F("ejerskab (og ledelse)")} Eksempel: 'Hvem ejer Lasso X?' → show_company focus ejerskab.`,
    props: "company",
  },
  {
    type: "LassoBeneficialOwners",
    title: "Reelle ejere",
    description: `Brug til: de fysiske personer, der i sidste ende ejer virksomheden, med samlet indirekte andel og ejerkæden gennem mellemliggende selskaber – kun ved 'reelle ejere', 'i sidste ende', 'personerne bag', 'gennem holdingselskaber'. Brug ikke når: direkte ejere (LassoOwnerList) eller koncernstruktur som diagram (LassoOwnershipDiagram). Kræver: company; ingen registrerede reelle ejere giver tom tilstand. ${F("ejerskab")} Eksempel: 'Hvem er de reelle ejere bag Lasso X?' → show_company focus ejerskab.`,
    props: "company",
  },
  {
    type: "LassoOwnershipDiagram",
    title: "Ejerdiagram, koncern",
    description: `Brug til: koncernstruktur i flere lag som diagram: ejere over, datterselskaber under – 'koncernen bag', 'moderselskab', 'datterselskaber', 'ejerstruktur', 'hvordan hænger selskaberne sammen'. Brug ikke når: én liste af direkte ejere (LassoOwnerList) eller personerne i sidste ende (LassoBeneficialOwners). Kræver: company, ingoingDepth? (lag op, standard 2), outgoingDepth? (lag ned, standard 1), onDate?. ${F("ejerskab (vises, når der er selskabsejere)")} Eksempel: 'Hvilke datterselskaber har X, og hvem er moderselskabet?' → show_company focus ejerskab.`,
    props: "company, ingoingDepth? (lag op, standard 2), outgoingDepth? (lag ned, standard 1), onDate? (ÅÅÅÅ-MM-DD), title?",
  },
  {
    type: "LassoRelations",
    title: "Rolleliste, kompakt",
    description: `Brug til: direktion, bestyrelse (formand i parentes) og de tre største legale ejere i ÉT kompakt element til en smal kolonne (¼ ved siden af en ¾) i et bredt overblik. Erstatter LassoPersonList OG LassoOwnerList sammen. Brug ikke når: spørgsmålet gælder ledelsen (LassoPersonList) eller ejerne (LassoOwnerList), eller listen står i fuld bredde. Kræver: company. ${F("overblik")} Eksempel: smal kolonne i en render_view-spec, der i øvrigt handler om andet.`,
    props: "company, title?",
  },

  // (d) Flere virksomheder -----------------------------------------------------
  {
    type: "LassoCompareTable",
    title: "Sammenligning, navngivne virksomheder",
    description:
      "Brug til: 2–6 NAVNGIVNE virksomheder side om side på 1–5 nøgletal fra seneste år – 'sammenlign A og B', 'A vs. B på omsætning og ansatte'. Brug ikke når: ét nøgletal og rækkefølgen er pointen (LassoRanking), udvikling over år for to virksomheder (LassoLineChart), eller virksomhederne først skal findes med kriterier (search_companies/LassoCompanyTable). Kræver: companies[] (2–6), metrics? (standard 4). Dækkes ikke af show_company. Eksempel: 'Sammenlign Lasso X, Risika og Bisnode på omsætning, resultat og ansatte.'",
    props: `companies[] (2–6), metrics? (1–5 af ${METRICS.join(" | ")}), title?`,
  },
  {
    type: "LassoRanking",
    title: "Rangliste, ét nøgletal",
    description:
      "Brug til: 2–10 navngivne virksomheder på ÉT nøgletal (seneste år) som vandrette søjler, den første fremhævet – 'hvor ligger X i forhold til …'. Brug ikke når: flere nøgletal pr. virksomhed (LassoCompareTable), udvikling over tid (LassoLineChart), eller listen skal findes med kriterier ('de største i branchen' → search_companies/LassoCompanyTable med sort). Kræver: companies[] (2–10, kendte på forhånd), metric. Dækkes ikke af show_company. Eksempel: 'Hvor ligger Lasso X på ansatte i forhold til Bisnode, Experian og Risika?'",
    props: `companies[] (2–10, første fremhæves), metric (${METRICS.join(" | ")}), title?`,
  },
  {
    type: "LassoCompanyTable",
    title: "Virksomhedstabel, søgning",
    description:
      "Brug til: mange virksomheder fundet med kriterier – målgrupper, 'alle X i Y', 'top N efter Z' (sort) – som del af en render_view-spec med andet; står søgningen alene, så brug search_companies. Brugeren kan sortere, fjerne kriterier og klikke ind på en virksomhed. Brug ikke når: du kender 2–6 navngivne virksomheder til sammenligning (LassoCompareTable) eller 2–10 navngivne på ét nøgletal (LassoRanking). Kræver: source 'search', search { query, criteria[], sort?, limit? }, columns?; ingen match giver tom tilstand med kriterierne synlige. Eksempel: 'Vis de 20 største revisionsfirmaer i Aarhus efter ansatte.' → search_companies.",
    props: `source='search', search { query, criteria[], sort?, limit? }, columns? (${TABLE_COLUMNS.join(" | ")}), title?`,
  },

  // (e) Risiko og revision -----------------------------------------------------
  {
    type: "LassoRiskObservations",
    title: "Risikoobservationer",
    description: `Brug til: Lassos observationer om virksomheden (negativ egenkapital, revisorskifte, ledelsesændringer, tvangsopløsning m.m.) sorteret efter alvor 0–100 – 'risiko', 'røde flag', 'kreditvurdering', 'kan vi handle med dem'. Brug ikke når: det specifikt gælder revisorens uafhængighed (LassoAuditorIndependence), eller en talscore ønskes (LassoScoreGauge har ingen live data; brug denne). Kræver: company; ingen observationer giver tom tilstand. ${F("risiko (og på alle sider, når en observation er ≥50)")} Eksempel: 'Er der risikosignaler hos X?' → show_company focus risiko.`,
    props: "company, title?",
  },
  {
    type: "LassoAuditorIndependence",
    title: "Revisoruafhængighed",
    description: `Brug til: relationer mellem revisionshuset og kundens ledelse/ejere, vurderet pr. relation – kun når spørgsmålet nævner revisor SAMMEN MED uafhængighed, habilitet eller relationer. Brug ikke når: brugeren blot vil vide, hvem revisor er (LassoKeyValueList variant 'company'), eller spørger bredt om risiko (LassoRiskObservations). Kræver: company; dækker kun navnesammenfald mellem revisionshusets og kundens personer, og komponenten skriver selv den begrænsning. ${F("risiko")} Eksempel: 'Er revisor for X uafhængig af ledelsen?' → show_company focus risiko.`,
    props: "company, title?",
  },
  {
    type: "LassoScoreGauge",
    title: "Scoremåler (kun demo)",
    description:
      "Brug til: KUN demovisninger. Der er ingen live datakilde for en 0–100 score; for rigtige virksomheder viser måleren 'Ikke oplyst'. Vælg den aldrig til en kunde, der spørger om risiko, score eller kreditvurdering (LassoRiskObservations eller show_company focus risiko). Kræver: company. Eksempel: intet kundespørgsmål fører hertil.",
    props: "company, title?",
  },

  // (f) Fysiske enheder --------------------------------------------------------
  {
    type: "LassoProductionUnits",
    title: "Produktionsenheder, P-numre",
    description:
      "Brug til: P-numre – filialer, afdelinger, butikker og adresser ud over hovedadressen, med ansatte og status pr. enhed – 'afdelinger', 'filialer', 'P-nummer'. Brug ikke når: kun hovedadressen (LassoCompanyHead), ejendomme/bygninger (LassoProperties), eller datterselskaber med egne CVR-numre (LassoOwnershipDiagram). Kræver: company; kilden er CVR-svaret, og listen kan være tom for virksomheder med kun hovedenheden. Dækkes ikke af show_company. Eksempel: 'Hvor mange afdelinger har X, og hvor ligger de?'",
    props: "company",
  },
  {
    type: "LassoProperties",
    title: "Ejendomme, BBR",
    description:
      "Brug til: ejendomme, virksomheden ejer (ejerfortegnelsen), med BBR-bygninger (anvendelse, opført, etager, areal) og arealfordeling – 'ejendomme', 'bygninger', 'BBR', 'matrikel'. Brug ikke når: adresser for afdelinger (LassoProductionUnits) eller virksomhedens egen adresse (LassoCompanyHead). Kræver: company; ejer virksomheden ingen ejendomme, vises tom tilstand. Dækkes ikke af show_company. Eksempel: 'Hvilke ejendomme ejer X, og hvor store er bygningerne?'",
    props: "company, title?",
  },
  {
    type: "LassoLivestock",
    title: "CHR, husdyr (ingen live data)",
    description:
      "Brug til: CHR-besætninger pr. dyretype og veterinære hændelser – kun landbrug. Ingen live datakilde endnu: for rigtige virksomheder er komponenten altid tom. Vælg den kun, når kunden udtrykkeligt spørger til CHR/husdyr, og sig, at data ikke er tilsluttet. Brug ikke når: det gælder ansatte eller økonomi i et landbrug (LassoKeyFigureCards). Kræver: company. Eksempel: 'Hvor mange svin har landbruget X?' (tom tilstand live).",
    props: "company",
  },

  // (16) Personside ----------------------------------------------------------------
  {
    type: "LassoPersonHead",
    title: "Personhoved",
    description:
      "Brug til: identitet for én person (navn, by, antal aktive og ophørte roller) øverst på en personside. Brug ikke når: det gælder en virksomheds ledelse (LassoPersonList). Kræver: person (Lasso-ID 'CVR-3-…'). Dækkes af show_person, som bygger hele personsiden; brug den. Eksempel: 'Hvem er Mette Holm?' → show_person.",
    props: "person",
  },
  {
    type: "LassoPersonRoles",
    title: "Roller over tid",
    description:
      "Brug til: en persons roller i selskaber som tidsbånd fra–til, aktive først – 'hvor sidder X i bestyrelsen', 'hvilke selskaber er X direktør i'. Brug ikke når: det gælder ét selskabs ledelse (LassoPersonList) eller personens medspillere (LassoPersonNetwork). Kræver: person. Dækkes af show_person. Eksempel: 'Hvilke bestyrelser sidder X i?' → show_person.",
    props: "person, title?",
  },
  {
    type: "LassoPersonNetwork",
    title: "Personnetværk",
    description:
      "Brug til: hvem personen sidder sammen med i selskaber, sorteret efter år i fælles selskaber – 'hvem arbejder X sammen med', 'X's netværk'. Brug ikke når: det gælder personens egne roller (LassoPersonRoles) eller konkurser (LassoPersonRisk). Kræver: person. Dækkes af show_person. Eksempel: 'Hvem er X i bestyrelse med?' → show_person.",
    props: "person, title?",
  },
  {
    type: "LassoPersonRisk",
    title: "Personrisiko",
    description:
      "Brug til: konkurser og tvangsopløsninger blandt selskaber, personen har eller har haft roller i – 'har X været involveret i konkurser'. Brug ikke når: det gælder en virksomheds risiko (LassoRiskObservations). Kræver: person; ingen roller giver tom tilstand. Dækkes af show_person. Eksempel: 'Har X været med i konkurser?' → show_person.",
    props: "person, title?",
  },

  // Interaktion ----------------------------------------------------------------
  {
    type: "LassoFollowUps",
    title: "Opfølgningsknapper",
    description:
      "Brug til: 1–4 knapper nederst i en render_view-visning, som sender et opfølgende spørgsmål til dig som brugerens næste besked, når der er oplagte næste analyser. Brug ikke når: spørgsmålet var snævert og besvaret med ét element, eller visningen kommer fra show_company (kan ikke tilføjes der). Kræver: prompts[] { label, prompt }; henter ingen data. Eksempel: efter en sammenligning: 'Vis udviklingen over 10 år', 'Tilføj Experian'.",
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
