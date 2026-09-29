// Teksterne i Papers instruktionsartboards (23 og 30.12), hentet med get_jsx fra
// "Lasso Portal - Designguide". Galleriet tegner dem med Lasso-komponenter og tokens.

/** 23.2: kolonnebredder ved 1440 px. [zone, med panel, uden panel, fremhævet] */
export const WIDTH_ROWS: readonly (readonly [string, string, string, boolean?])[] = [
  ["Skinne", "236", "236"],
  ["Panel", "336", "—"],
  ["Midte inkl. padding 28", "868", "1.204"],
  ["Indholdsbredde", "812", "1.148", true],
  ["1 kolonne (¼), gutter 24", "185", "269"],
  ["2 kolonner (½)", "394", "562"],
  ["3 kolonner (¾)", "603", "855"],
];
export const WIDTH_NOTE =
  "Brug kun ¼, ½, ¾ og fuld bredde. Nøgletalskort deler fuld bredde ligeligt (3–5 kort). Grafer er mindst ½. Tabeller er altid fuld bredde. Under 1200 px falder panelet ned under midten; under 960 px skjules skinnen bag en knap.";

/** 23.3: rækkefølge på en side. */
export const ORDER_STEPS: readonly (readonly [string, string, string])[] = [
  ["1", "Hvem — hoved", "Virksomhedshoved (08) eller personhoved (16) med status, nøglefakta og handlinger. Altid først, altid fuld bredde."],
  ["2", "Pas på — risiko", 'Sammenfatning af observationer (17) hvis der er noget på 50+. Ellers udelades blokken helt — ingen tom "alt er fint"-boks over folden.'],
  ["3", "Hvor stor — nøgletal", "3–5 nøgletalskort (09) med udvikling. Kreditscore (10) hører til her, ikke under risiko."],
  ["4", "Hvordan går det — udvikling", "Én graf (13) ved siden af nøgle-værdi-listen (09). Flere grafer = hver sin fane, aldrig stablet på overblikket."],
  ["5", "Hvem står bag — personer og ejere", "Rolleliste og ejerliste (11). Diagrammet (14) ligger i sin egen fane."],
  ["6", "Hvad er der sket — historik og nyheder", "Tidslinje og nyhedsliste (12) nederst. Det er langt og foldes til 4–5 poster."],
  ["P", "Panel — kontakt og genveje", 'Kontaktblok, genveje (08) og "Overvåger"-status (21). Panelet gentager aldrig tal fra midten.'],
];

/** 23.4: datatype → element → artboard. */
export const DATATYPE_ROWS: readonly (readonly [string, string, string])[] = [
  ["Identitet (navn, CVR, status)", "Virksomhedshoved, kompakt hoved, personhoved", "08, 16"],
  ["Ét tal med udvikling", "Nøgletalskort (3–5 på række)", "09"],
  ["Mange felter, én enhed", "Nøgle-værdi-liste, med årsvælger til regnskab", "09"],
  ["Fuldt regnskab med poster", "Resultatopgørelse med subtotaler + analyse", "19"],
  ["Udvikling over år (1 serie)", "Søjlegraf, sparkline i tabeller", "13"],
  ["Udvikling, 2–3 serier / benchmark", "Grupperede søjler, linje + område mod branche", "13"],
  ["Dele af en helhed", "Stablede søjler (balance), donut + andelsbjælker, stablet bjælke (areal)", "13, 20"],
  ["Fra A til B (resultat)", "Vandfald", "13"],
  ["Placering blandt lignende", "Rangliste (vandrette søjler), sammenligning i kolonner", "13, 22"],
  ["Score / vurdering 0–100", "Scoremåler, nøgletalsmåler mod branche, score over tid", "10, 13, 18"],
  ["Risiko og observationer", "Alvorsskala + observationsliste, personrisiko", "17, 16"],
  ["Personer og roller", "Rolleliste, personliste, roller som tidsbånd, netværk", "11, 15, 16"],
  ["Ejerskab", "Ejerliste med interval-bjælke, reelle ejere, ejerdiagram", "11, 14"],
  ["Mange virksomheder / personer", "Tabel med værktøjslinje, paginering, massehandlinger, tilstande", "15"],
  ["Begivenheder over tid", "Tidslinje (CVR), ændringsfeed (overvågning), veterinære hændelser", "12, 21, 20"],
  ["Omtale og tekst", "Nyhedsliste med fremhævning, tekstsektioner, resumé", "12"],
  ["Adresser og steder", "Kontaktblok (+ live-verificering), kort, P-enheder, ejendomskort", "08, 13, 20"],
  ["Aktivitet pr. periode", "Heatmap", "13"],
  ["Data der koster / tager tid", 'Bekræft-dialog med pris, henter-tilstand med fremdrift, "ikke tilgængelig"', "18, 10"],
  ["Relationer der skal dokumenteres", "Relationstabel med vurdering + eksport", "22"],
  ["Balance og pengestrøm", "Balance med aktiver/passiver-subtotaler, pengestrømsopgørelse", "19"],
  ["Ejerskab, særlige tilfælde", "Dyb kæde foldet, cirkulært over flere led, udenlandsk, ukendt < 5 %, ingen ejere", "14"],
  ["Samme skærm på tablet / mobil", "Brudpunktsregler, tablet 768, mobil 390 (kortliste, ejerliste)", "26"],
  ["Noget der skal printes / sendes", "A4-rapport: forside, sidehoved/-fod, nøgletal, graf, ledelse, ejere", "27"],
];

/** 23.5: de fem tilstande. */
export const STATE_DEFS: readonly (readonly [string, string])[] = [
  ["Fyldt", "Det normale. Design det først."],
  ["Henter", "Skelet i samme højde som fyldt, spinner + tekst kun når det tager > 2 sek., fremdrift ved kendt ventetid (18)."],
  ["Tom", 'Sig hvorfor og hvad man kan gøre (15, 17). Stiplet ramme. Aldrig "0".'],
  ["Ikke oplyst", '"Ikke oplyst" eller "—" i text-faint, årsag under når den kendes (09).'],
  ["Fejl", 'Kun ved teknisk fejl, rød ikon, "Prøv igen", fejl-id, kriterier og input bevares (15).'],
];

/** 23.5: talformat (fra 09). */
export const NUMBER_DEFS: readonly (readonly [string, string])[] = [
  ["Beløb", "< 1 mio.: 842 t. kr., ≥ 1 mio.: 18,8 mio. kr., ≥ 1 mia.: 2,4 mia. kr., tabeller med mange år: én enhed i hovedet."],
  ["Tal", "Tusindtalspunktum 1.243.501, decimalkomma 17,3, mellemrum før %, én decimal i procent, ingen i antal."],
  ["Negativt", "Ægte minus −201, aldrig parentes, rød kun når negativt er dårligt (resultat), ikke ved gæld der falder."],
  ["Udvikling", "▲ grøn / ▼ rød + procent + sammenligningsår, kun pil når fortegn skifter."],
  ["Dato", '15.04.2026, perioder 01.01–31.12, relativ tid ("for 3 dage siden") kun i nyheder, feed og notifikationer.'],
  ["Intervaller", 'CVR-intervaller vises som tekst "25–33,32 %"; bjælken tegner minimum fuldt, spændet lyst (11).'],
];

/** 23.5: tjeklisten "Aflever aldrig uden". */
export const CHECKLIST: readonly string[] = [
  "Alle fem tilstande for hvert nyt element",
  "Kilde og tidsstempel på alt der ikke er CVR",
  "Genereret tekst har kildelinje med dato, ingen AI-mærke, ingen farvet boks",
  "Ikon + ord ved enhver farvekodning",
  "Fokus = 1 px koral kant, ingen ring",
  "Eksempeldata markeret, ingen opfundne fakta om rigtige personer",
  "Status som ren tekst, ingen piller, prikker eller farvede flader; bundlinjer med vægt og tynd streg, aldrig fyld",
  "Nøglefakta adskilt med komma; navne uden ikonkasser; nyhedskilder med favicon",
  "Faner, segmenter, sidepanel-sektioner og bundnavigation viser kun navnet, aldrig antal eller badge",
  'Flere værdier end formen kan vise (kontaktpersoner, telefonnumre, e-mails, P-enheder, bibrancher, ejere): vis 3 + "Se N …" og åbn "Se alle"-panelet fra højre (08), aldrig en lang liste på siden',
  "Hvid flade overalt, også tablet og mobil: opdel med tynde linjer og luft, ikke hvide kort på grå baggrund",
  'Én grå til al læsbar hjælpetekst, metatekst, kildelinjer og overlinjer: --color-text-muted (#5B6068, samme som overlinjen "EKSEMPLER"); #8A9099 kun til ikoner og dekoration',
  'Ingen midterprik nogen steder, heller ikke i katalogets egne noter, overlinjer, specifikationer ("13/18, 400") og kildelinjer: brug komma. Søg på midterprik-tegnet (find_nodes) før aflevering, resultatet skal være 0',
  "Intet mørkt fyld på aktive elementer: aktiv side = ink 600 + tynd understregning, aktive segmenter/chips/trin med vægt, tynd kant eller koral-soft",
  "Logo som klon af masterne i 01b, diskret: dæmpet navnelogo i bundlinjen (sideskinne på desktop, nederst på mobil) med kildelinje, aldrig i topbjælken ved entitetsnavnet; ikon kun i tabletskinne, som Lasso News-kilde og i PDF",
  "Nyheder: én kilde pr. nyhed, ingen billeder, tone-mærker, samlede historier eller favicon-stakke; virksomhedsnavn i uddraget i fed, ikke koral",
  "Kontaktblok og andre korte ikon + værdi-lister uden skillelinjer, adskilt med luft",
  "Risikoskala 0 = lav (grøn, venstre/nederst) til 100 = høj (rød, højre/øverst); markør, zoner, historik og ændringstal følger samme retning",
  "Ingen initial-cirkler foran personnavne (lister, hoveder, netværk, kontaktpersoner, ejere, diagram); fratrådt/ukendt som tekst",
  "Ingen grå flise, kasse eller cirkel bag ikoner; kun ægte ikonknapper har kant",
  "Hoved-handlinger som små ikonknapper øverst til højre (koral ikon = primær), aldrig store fyldte knapper i hovedet",
];

/** 23.7: mapping pr. element desktop → tablet → mobil. */
export const MAPPING_INTRO =
  'Brug tabellen når et skærmbillede skal virke på alle bredder. Kolonnen "Mobil" er den eneste tilladte mobilform for elementet; henvisningen peger på artboardet hvor den er tegnet. Brudpunkter: ≥ 1200 desktop (24–25), 1024–1199 desktop uden højre panel, 768–1023 tablet (26f), < 768 mobil (26a–26h). Tværgående tilstande (tom, indlæser, fejl, låst, på forespørgsel), kvalitetsflag, kilder og analyse på mobil: 26h.';
export const MAPPING_ROWS: readonly (readonly [string, string, string, string, string])[] = [
  ["Navigation", "Sidepanel 240 px + topbar 56", "Skinne 64 px med 44 px ikoner, tooltip-etiketter", "Topbar 52 + bundnav 56 (Søg, Lister, Overvågning, Konto); sektioner via sektionsark", "26a, 26f"],
  ["Virksomhedshoved + faner", "Navn 28 px, meta i én linje, knapper til højre, 7 faner", "Navn 22 px, knapper 36 px, 5 faner + Mere", "Navn 22 px, meta i to linjer med komma, status som tekst, primær 44 px + ikonknapper; faner ruller vandret", "08, 26a"],
  ["Kontakt og genveje", "Blok i højre panel", "Under indholdet, to kolonner", "Kort med 44 px knapper (ring, mail, web) der åbner native apps", "08, 26a"],
  ["KPI-række", "4–5 kort i én række, 28 px tal", "4 kort (min. 140 px), ellers 2×2", "2×2 kort, 20 px tal, ændring under", "08, 26c"],
  ["Nøgle-værdi", "To kolonner, etiket venstre / værdi højre", "Som desktop", "Stakket: etiket over værdi; to korte felter kan dele række", "10, 26c"],
  ["Grafer (søjle, linje, område)", "Tooltip ved hover, 10 år, legende til højre", "Som desktop, 7 år", "Fuld bredde, maks 5 punkter synlige (swipe), fast valgfelt under grafen erstatter tooltip, legende under titel", "13, 26b"],
  ["Vandfald, fordeling, stablet", "Lodret vandfald, donut med legende ved siden", "Som desktop", "Vandfald som vandrette bjælker med tal til højre; donut 96 px; stablet balance som to vandrette bjælker", "13, 26b"],
  ["Målere, sparklines, heatmap, kort", "Scoremåler 120 px, heatmap 12 mdr., kort 320 px", "Som desktop, kort 240 px", "Scoremåler som kort med 36 px tal, heatmap 6 mdr. synlige, kort 160 px med markørkort, fuld skærm ved tap", "10/13, 26b"],
  ["Flerårstabel", "5 år × n nøgletal", "3 år synlige, resten ved rul", "A: fast første kolonne + vandret rul, B: kort pr. nøgletal med 5 år", "10, 26c"],
  ["Personliste / ejerliste", "Rækker 44 px, rolle i kolonne", "Rækker 48 px", 'Rækker 56 px med navn alene, rolle under navn, chevron; ejerandel som 6 px bjælke; "Vis alle" i stedet for paginering', "11, 26c"],
  ["Ejerdiagram", "Indlejret 480 px, noder 196×64, værktøjslinje", "Indlejret 340 px, noder 150 px, pan/knib + zoomknapper, liste-omskifter", 'Indrykket liste (én gren ad gangen) + "Åbn i fuld skærm" med pan og knib-zoom i landskab', "14, 26c, 26f"],
  ["Tabel med filtre", "Op til 10 kolonner, filterlinje, uendelig rul", "Maks 6 kolonner, CVR/by under navn, paginering 36 px", "Kortliste (navn, status som tekst, 3–4 nøgletal), aktive filtre som chips, filterark som bundark med tæller-knap", "15, 26c, 26f"],
  ["Nyheder og tidslinje", "Højre panel / kolonne", "Under indholdet", "Lodrette lister, 14 px titel, kilde og dato under; tidslinje 10 px prikker", "12, 26c"],
  ["Personside + tidsbånd", "Vandret tidsbånd med roller som spor", "Som desktop, færre etiketter", "Én 10 px bjælke pr. rolle på fælles akse, etiket over; roller som 60 px rækker; netværkstal som tre kort", "16, 26d, 26g"],
  ["Risikoobservationer", "Liste med alvorlighed som farvet tekst og udfold", "Som desktop", "Kort med 3 px farvekant, tæller-chips filtrerer, tap åbner detalje", "17, 26d"],
  ["Kreditvurdering over tid", "Linje 24 mdr. med zoner og tooltip", "Som desktop", "40 px tal + tolkning som tekst + kreditmaks, zonebjælke, linje med maks 6 punkter og fast valgfelt, ændringer som rækker", "18, 26d"],
  ["Regnskabsdetaljer", "Resultat, balance, pengestrøm i tre kolonner, 5 år", "Resultat + balance side om side, 3 år; pengestrøm via segment", "Segmentkontrol (Resultat, Balance, Pengestrøm), år i dropdown, 2 talkolonner (år + Δ)", "19, 26d, 26f"],
  ["P-enheder, BBR, CHR", "Tabel + kort side om side", "Kort over tabel", "P-enheder som rækker (ikon, navn, adresse, P-nr.), BBR som kort med 120 px kortudsnit, CHR med tom tilstand", "20, 26e"],
  ["Overvågning og notifikationer", "Indstillingspanel + notifikationsliste i højre panel", "Som desktop, panel under", "Statusrække med kontakt, emner som 48 px rækker med 44×26 kontakter, liste med ulæst-prik, push-banner", "21, 26e"],
  ["Sammenligning", "Op til 6 virksomheder i kolonner", "Fast nøgletalskolonne + 3 kolonner, rul fra 4", "Fast nøgletalskolonne 118 px + 2 kolonner, swipe mellem par, sideindikator", "22, 26e, 26f"],
  ["Revisoruafhængighed", "Tjekliste + relationsgraf", "Som desktop", "Revisorrække, 44 px tjeklinjer (grøn/gul), historik som proportional bjælke", "22, 26e"],
  ["Dialoger og menuer", "Centreret dialog 480 px, kontekstmenu", "Dialog 560 px centreret", "Dialog → bundark med greb, menu → handlingsark, 48 px rækker", "05/06, 26a"],
  ["Besked / toast", "Nederst til højre, stakkes", "Nederst centreret", "Fuld bredde over bundnav, én ad gangen, handling som tekstknap", "07, 26a"],
  ["Formularfelter", "Felter 36 px, egen dropdown og datovælger", "Felter 40 px", "Felter 48 px, native pickers for dato og enkeltvalg, multivalg som bundark med søgning; fokus = 1 px koral kant", "02, 26a"],
];
export const MAPPING_CARDS: readonly (readonly [string, string])[] = [
  [
    "Touch-mål og afstande",
    "Mobil: rækker og ikonknapper 44 px, felter og primære knapper 48 px, chips 32–36 px, mindst 8 px mellem mål, tablet: 36–40 px, desktop: 32–36 px. Sidemargen 16 (mobil), 24 (tablet), 32–48 (desktop). Ingen hover-afhængige funktioner på touch: alt der kan hoveres, kan også tappes eller står som tekst.",
  ],
  [
    "Sådan bygger du en mobilskærm",
    "1) Start med 26a: statusbar, topbar, bundnav. 2) Hent elementerne fra 26b–26e i samme rækkefølge som desktop (hoved → KPI → graf → lister → kontakt → nyheder). 3) Hold 16 px mellem kort, 12 px gitter inde i kort. 4) Markér folden på 844 px og sørg for at hoved + første KPI-række står over den. Se 26g for to færdige eksempler.",
  ],
];

/** 23.8: dækningstabel mod API. [datatype/endpoint, elementer, desktop, mobil/tablet] eller gruppeoverskrift. */
export const COVERAGE_INTRO =
  'Slå datatypen op her, før du tegner. Kolonnen "Element" er katalogets navn, "Desktop" og "Mobil" er artboardet. Alle 25 endpoints fra API-dokumentationen (companies, financials, people, production-units, ownership, contact, news, properties, risk, platform, other) plus webhook-hændelserne er dækket; ingen række står tom.';
export const COVERAGE_ROWS: readonly (string | readonly [string, string, string, string])[] = [
  "Companies",
  ["company-full (stamdata, kontakt, ledelse, ejere)", "Virksomhedshoved, kontaktblok, nøgle-værdi-liste, rolleliste, ejerliste, reelle ejere, felter med data", "08, 09, 11, 02c, 24", "26a, 26c, 26f, 26g"],
  ["company-details (formål, tegningsregel, kapital, bibrancher, regnskabsoplysninger, fusioner, Statstidende, reklamebeskyttelse, børsnotering, vedtægter)", "Nøgle-værdi-liste + regnskabsoplysninger med fravalg af revision, kapital og klasser, tegningsregel/formål foldet, bibrancher med kode, fusioner/spaltninger, Statstidende-liste", "09, 28 §06–08, 24", "26a, 26h, 28 (mobilpaneler)"],
  ["participants (ledelse, bestyrelse, stiftere, revisor, valgmåde)", "Rolleliste kompakt/udfoldet, personliste, revisor som reference, tidsbånd, historik via /history i tidslinjen", "11, 15, 16, 12", "26c, 26d, 26g"],
  ["company-updates + webhook-hændelser (name, address, industry, capital, status, board, management, ownership, employees, pUnit*, newReport, merger, newArticle …)", "Ændringsfeed grupperet pr. dag med typefilter, notifikationspanel, push-banner, CVR-tidslinje (fra → til)", "21, 12, 28 §03", "26e, 26c"],
  ["search (query, filtre city/postalcode/cvr/email/telephone, foundByName, status)", 'Søgefelt i topbjælken, virksomhedstabel med værktøjslinje og filtre, "Fundet via …" i resultatrækken, kriterier og filterfelter', "04, 15, 02a/02b, 28 §05", "26a, 26c, 26f"],
  ["enumerations (status, form, ansatte-interval, enhedstype)", "Værdilister med farveregel for status, form med kode, intervaller som tekst; brug i filtre og filterark", "28 §01, 05, 02c §08", "28 §01 (mobil), 26c"],
  "Financials",
  ["key-figures (rapportmetadata, 150+ poster, nøgletal, possibleError/error, PDF/XBRL)", "Nøgletalskort, flerårstabel, søjle/linje/vandfald/stablede grafer, resultat/balance/pengestrøm med subtotaler, kvalitetsflag med tooltip, revisor og påtegning, hent PDF", "09, 10, 13, 19, 02c §16", "26b, 26d, 26f, 26h"],
  ["report-delta (nye og korrigerede publiceringer)", 'Publiceringstabel med type ny/korrigeret, "før"-værdi under tallet, feed-række "Regnskab"', "28 §02, 21", "28 §02 (mobil), 26e"],
  ["financial-analysis (narrativ tekst, seneste to rapporter)", "Regnskabsanalyse som almindelig tekstsektion med forbehold og kildelinje, resumé foldet med toning", "19, 12", "26h"],
  "People",
  ["people (identitet, roller, ejerskab, reelt ejerskab, /history)", "Personhoved, roller som tidsbånd, rolleliste, personrisiko; aldrig CPR eller fuld privatadresse", "16, 25", "26d, 26g"],
  ["cvrnetwork (personer med overlap, roller, perioder)", 'Netværksliste sorteret efter overlap-år, "Vis som graf" i diagramkomponenten, revisoruafhængighed', "16, 14, 22", "26d, 26e"],
  ["people-updates", 'Feed-rækker med "Person, ledelse/ejerskab" og fra → til', "28 §03, 21", "28 §03 (mobil), 26e"],
  ["people search (query, company-filter, totalCompanyCount)", 'Personsøgning med typesegment, resultatrække med by, selskaber og "og N flere"', "28 §05, 04", "28 §05 (mobil), 26a"],
  "Production units, ownership, contact",
  ["production-unit-information (+ /history, /related/company)", "P-enhedstabel med hovedenhed først, kort med klynger, enhedens stamdata", "20, 13", "26e"],
  ["production-unit-updates", 'Feed-rækker "P-enhed tilføjet/opdateret/fjernet"', "28 §03, 21", "28 §03 (mobil)"],
  ["beneficial-owners (andel, stemmer, throughRole, fritagelse, fallback, couldNotIdentify)", "Reelle ejere med indirekte andel og kæde; tre tilstande uden registrering", "11, 28 §09", "26c, 28 §09 (mobil)"],
  ["legal-owners (intervaller for ejerandel og stemmer)", "Ejerliste med interval-bjælke, ejerandel-interval som felt", "11, 02c §14", "26c"],
  ["ownergraph (dybde, dato, ophørte, cirkulært, udenlandsk, ukendt)", "Ejerdiagram med værktøjslinje og detaljepanel, særlige tilstande, indlejret på tablet, liste + fuld skærm på mobil", "14, 14b", "26c, 26f"],
  ["livenumber (telefon/e-mail verificeret i realtid)", 'Kontaktblok med "verificeret nu", kopiér og ring', "08, 02c §12", "26a, 26h"],
  "News, properties, risk",
  ["lasso-news, paqle (kilde, tid, overskrift, uddrag, nævnelse)", "Nyhedsliste med favicon-kilde og nævnelse i fed; genereret nyhed med kildelinje", "12, 24", "26c, 26g, 26h"],
  ["bbr (ejendomme, bygninger, enheder, arealer, matrikel)", "Ejendomskort, bygningsliste, arealfordeling som andelsbjælker", "20, 13", "26e"],
  ["creditsafe (lokal/international score, kreditmaks, forrige, latestChange, PDF)", "Scoremåler, forrige vs. nu, scorehistorik, hent-tilstande med kredit, score som felt", "10, 18, 02c §15", "26b, 26d, 26h"],
  ["observations (49 typer, outcome 0/25/50/100, notAvailable)", 'Alvorsskala som ikon + ord, observationsliste, risikosammenfatning som tekstlinje, personrisiko, "ikke tilgængelig"', "17, 16, 24", "26d, 26g"],
  "Platform, other",
  ["lists (type, antal, ejer, rettigheder, deling, tilføj/fjern)", 'Gemt liste som tabel med markering og massehandlinger, "Tilføj til liste"-dialog, deling', "15, 07", "26c, 26a"],
  ["monitoring (tilføj/fjern, hændelser, indstillinger)", '"Overvåg"/"Overvåger"-knap, overvågningsindstillinger pr. type, feed og notifikationer', "08, 21", "26e, 26a"],
  ["reporting (batches, 4 rapporttyper, status, fremdrift, PDF/zip)", "Rapportbestilling, batchtabel med status som tekst og fremdriftsbjælke, A4-rapportens sider", "28 §04, 27", "28 §04 (mobil)"],
  ["accountant-independency (relationer revisor/kunde/personer, eksport)", "Uafhængighedstjek med vurderingskolonne og eksport til PDF/Excel", "22", "26e, 26f"],
  ["chr (besætninger, dyrearter, veterinære hændelser)", "CHR-blok med dyreart, antal og hændelser som tidslinje", "20", "26e"],
];
export const COVERAGE_SOURCE =
  "Kilde: docs.lassox.com/api (getting-started, companies, financials, people, production-units, ownership, contact-information, news, properties, risk, platform, other) og webhooks/events, gennemgået 25.09.2026. Ingen datatype mangler et element. Tallene i de nye eksempler er markeret eksempeldata, hvor de ikke er LASSO X' egne CVR-tal.";

/** 23.1: zonernes note. */
export const ZONE_NOTE =
  "Midten er det eneste der skifter indhold. Skinnen er navigation eller kriterier — aldrig data. Panelet er sammendrag og handlinger — aldrig primært indhold. Lister og søgeresultater (15) bruger skabelonen uden panel.";

/** 23.6: to kort. */
export const WIDTH_PAPER_CARDS: readonly (readonly [string, string])[] = [
  [
    "Responsiv (26)",
    "Tegn 1440 først, men kontrollér mod brudpunkterne i 26 før aflevering: 1024–1199 mister højre panel, 768–1023 får skinne-navigation og to kolonner (26f), under 768 stables alt i én kolonne med topbar + bundnav (26a). Hvert element har én mobilform — den står i mappingtabellen i trin 7 og er tegnet i 26a–26e. Touch-mål: 44 px for rækker og ikonknapper, 48 px for felter og primære knapper på mobil; 36 px på tablet.",
  ],
  [
    "Eksport og print (27)",
    "Alt der kan eksporteres skal kunne stå på A4 uden interaktion: værdier der kun findes i hover eller tooltip skal have en tekstform. Sidehoved med virksomhed, sidefod med kilde, datastempel og sidetal på hver side. Ingen farveflader større end 24 px, grafer som vektor med tal i tekst.",
  ],
];

/** 30.12: fra spørgsmål til layout. [spørgsmål, niveau, mønster, elementer, link videre] */
export const LOOKUP_ROWS: readonly (readonly [string, string, string, string, string])[] = [
  ['"Hvad er omsætningen hos X?", ét tal', "A", "Ét element", "Nøgletalskort 1–3 med udvikling (09)", "Se hele økonomien"],
  ['"Hvordan har omsætningen udviklet sig?"', "A", "Ét element", "Søjlegraf 5 år med valgt år (13)", "Se regnskab"],
  ['"Hvem sidder i ledelsen / bestyrelsen?", "Hvem er revisor?"', "A", "Ét element", "Rolleliste med Nuværende/Alle (11), revisor som nøgle-værdi-linje (09)", "Se ledelse og ejere"],
  ['"Hvordan går det med X?", "Er X sund?"', "B", "1, Overblik", "Nøgletalskort 4 (09), søjlegraf ½ (13) + nøgle-værdi-liste ½ (09), analyse 3 linjer (19)", "Åbn X i Lasso"],
  ['"Vis regnskabet", "Hvad er egenkapitalen og gælden?"', "B", "3, Ligeværdige", "Faner niveau 2 (29): Resultatopgørelse, Balance, Pengestrøm (19); i hver fane opgørelse ½ + graf ½", "Se flerårstabel"],
  ['"Hvem ejer X?", "Hvad ejer X?"', "B", "2, Fokus", "Ejerdiagram ¾ (14, på mobil liste 26c) + ejerliste med intervaller ¼ (11), reelle ejere som tekstlinje", "Åbn ejerdiagram"],
  ['"Kan vi handle med X?", "Er der røde flag?"', "B", "7, Fortælling", "Analyse ¾ + 3 tal ¼ (17), alvorsskala 0–100 fuld med observationsliste (17), kreditscore (10) hvis den findes", "Se alle observationer"],
  ['"Hvad er der sket hos X?", "Nyheder om X"', "B", "6, Tidslinje", 'Filter-chips + tidslinje (12), nyheder som liste 3 + "Alle nyheder" (28)', "Se historik"],
  ['"Fortæl om X", "Giv mig et overblik over X"', "C", "Side, 1 pr. fane", "Fuldt hoved (08), faner niveau 1 (29), Overblik-fanen i mønster 1 efter rækkefølgen i 23, øvrige faner som B-sektioner", "Faner"],
  ['"Hvem er Y?", "Hvor sidder Y i bestyrelser?"', "C (A ved ét spørgsmål)", "2, Fokus", "Personhoved (16), tidsbånd ¾ + netværkstal ¼ (16), rolleliste fuld (16), risiko (17)", "Åbn Y i Lasso"],
  ['"Sammenlign X og Y", "Hvem er størst af …"', "C", "5, Sammenligning", "Kompakte hoveder på række (08), sammenligning i kolonner (22), grupperede søjler fuld (13)", "Åbn hver virksomhed"],
  ['"Find revisorer i Region Midt med over 10 ansatte", målgrupper', "C", "4, Liste først", "Værktøjslinje med kriterie-chips (02/03), tabel med paginering (15), panel fra højre med kompakt overblik (08)", "Gem liste, Eksportér"],
];
export const LOOKUP_RULES =
  "Fire regler der giver produktfølelse: (1) Start altid med identiteten, hovedet i den størrelse niveauet kræver. (2) Det vigtigste står øverst til venstre; en AI må omordne elementer inden for et mønster efter hvad spørgsmålet handler om, og et modul må kombinere to mønstre over hinanden (fx graf fuld + tabel fuld), men aldrig blande dem i én række. (3) Hvert svar slutter med kildelinje og ét link, der fører til næste niveau; svaret vokser ved klik, det gentages ikke. (4) Variationen ligger i valget af mønster, værktøjslinje og elementer, ikke i nye former: to moduler må gerne se forskellige ud, men de er bygget af de samme dele efter de samme regler.";
