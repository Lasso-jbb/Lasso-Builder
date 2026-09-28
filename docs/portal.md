# Portalen: Lasso i browseren med login

Dato: 27.09.2026. Portalen er samme render-app og samme komponenter som i Claude/ChatGPT, men
med login, skinne, fanebjælke og modulbjælke fra designkataloget (06), så den kan bruges som
portal.lassox.com bruges i dag. Den bor på `/portal` (roden `/` sender videre), og API'et under
`/api/portal/*` genbruger præcis den serverlogik, MCP-tools bruger.

## Login og session (apps/server/src/auth/session.ts)

- **Åben portal:** `PORTAL_PUBLIC=true` gør `/portal` og `/api/portal/*` tilgængelige uden login;
  besøgende uden session er demobrugeren (`portalUser`), `loginRequired` i boot er `false`, og
  appen skjuler kontomenuen og "Log ud". CSRF-headeren kræves stadig på ændrende kald, og `/mcp`
  er stadig beskyttet af nøglen. Lokalt uden nøgler er portalen åben på samme måde.

- Login = **bruger-id + adgangsnøgle**, samme nøgler som MCP-connectoren: `MCP_ACCESS_KEY` logger
  demobrugeren ind (bruger-id = `DEMO_USER_ID`, standard `demo`), `MCP_USER_KEYS` logger hver sin
  bruger ind. Lasso ID/OAuth kobles på i `loginWithKey`/`getCurrentUser` senere.
- Session = signeret, httpOnly cookie `lasso_session` (HMAC med `LINK_SECRET`, samme hemmelighed
  som links), 30 dage, `SameSite=Lax`, `Secure` på https. Ingen sessioner i databasen.
- CSRF: alle andre kald end GET/HEAD til `/api/portal/*` skal sende headeren `x-lasso-portal: 1`.
- Uden nøgler (lokal udvikling) er portalen åben som demobrugeren, ligesom `/mcp`.
- Login er bremset til 10 forsøg pr. IP pr. kvarter (429).

| Rute | Body | Svar |
|---|---|---|
| `POST /api/portal/login` | `{ user, key }` | `200 { user: { id, name, org, isDemo } }`, ellers `401 { error }` |
| `POST /api/portal/logout` | – | `200 { ok: true }` og cookien slettes |
| `GET /api/portal/me` | – | `200 { user }` eller `401` |
| `GET /portal` | – | Render-appen med `window.__LASSO_BOOT__ = { mode: "portal", user: {…} \| null, loginRequired, baseUrl }` |

## Portal-API (kræver session; alle svar er JSON)

Samme use-cases som MCP-tools (`apps/server/src/usecases/`), så resultatet i browseren er identisk
med det i Claude: `{ spec, dataset, note? }` som `structuredContent.spec` + `_meta`-datasættet.

| Rute | Gør | Svar |
|---|---|---|
| `GET /api/portal/search?query=&limit=&title=` | Som `search_companies` (Lassos fortolkning af friteksten, kriterier som chips) | `{ spec, dataset, note? }` |
| `GET /api/portal/company/:ref?focus=&years=&metric=` | Som `show_company` (navn, CVR eller Lasso-ID; `focus` = overblik, oekonomi, regnskab, ejerskab, ledelse, risiko, historik, kontakt) | `{ spec, dataset, note?, link }` (link = signeret `/e/`-side) |
| `GET /api/portal/person/:ref?focus=` | Som `show_person` (navn eller person-ID; `focus` = overblik, roller, netvaerk, ejerskab, risiko, historik) | `{ spec, dataset, note?, link }` (link = signeret `/e/`-side med samme fokus) |
| `POST /api/portal/resolve` `{ spec }` | Som `resolve_view` (drill-down, filterændring, opdatér) | `{ spec, dataset }` |
| `GET /api/portal/pages?kind=company\|person\|all&limit=` | Som `list_saved_pages` | `{ spec, dataset }` |
| `POST /api/portal/pages` `{ page, kind?, focus?, note? }` | Som `save_page` (`focus` er et virksomhedsfokus for en virksomhed og et personfokus for en person; et fokus, der ikke passer til siden, gemmes ikke) | `{ lassoId, kind, name, cvr?, savedAt, created, total, url }` |
| `DELETE /api/portal/pages/:lassoId` | Som `remove_saved_page` | `{ lassoId, removed, total }` |
| `POST /api/portal/views` `{ spec, name?, slug?, visibility? }` | Som `save_view` | `{ url, org, slug, version, name, visibility }` |

Fejl: `400 { error }` ved ugyldigt input, `404 { error }` når virksomheden/personen ikke findes,
`401`/`403` fra sessionen, `409` ved optaget adresse i `views`.

## Render-appen i portal-tilstand (apps/view/src/portal/)

- `boot.mode === "portal"` → `PortalApp`. Uden `user` (og `loginRequired`) vises login-siden:
  bruger-id, adgangsnøgle, fejltekst, "Log ind". Med `user` vises rammen.
- Rammen er `AppShell` (katalog 06): `Rail` med grupperne Værktøjer (Søgning, Gemte sider),
  Firmaer (de nyeste gemte virksomheder, "Se alle") og Personer (gemte personer); `TabStrip` med
  de åbne sider (søgning, gemte, hver virksomhed/person) med luk og "+" (ny søgning), klokke
  udeladt (ingen overvågning endnu), konto = navn + "Log ud".
- En virksomhedsfane har `ModuleBar` med de otte fokus (Overblik … Kontakt) og handlingerne
  Gem/Gemt (accent), Del link og Eksportér; kroppen er `LassoView` med host `{ savePage, save,
  refine, drillDown, refresh, export, back: false, openFocus }` og handlinger via fetch mod API'et.
  `open-focus` (overblikkets "Se alle … i Historik") skifter fanens fokus som et klik i modulbjælken
  (`focusRoute` i `routes.ts`).
- En personfane har på samme måde `ModuleBar` med de seks personfokus (Overblik, Roller, Netværk,
  Ejerskab, Risiko, Historik) og samme handlinger. Gem gemmer siden med det viste fokus.
- Hash-routing, så tilbage/frem og genindlæsning virker: `#/search?q=…`, `#/company/CVR-1-…?focus=`,
  `#/person/CVR-3-…?focus=` (overblik udelades i adressen, så ældre links er de samme), `#/saved`.
- Mobil: `AppShell`s mobile-props (titel, sektioner = fokus for virksomheder og personer,
  bundnavigation Søg, Lister, Konto).

## Fokus og elementer (packages/spec/src/compose.ts)

Serveren bygger virksomhedssiden efter data; uden spørgsmål (portalens faner) eller med et
generelt spørgsmål vælger modellen kun fokus. Med et spørgsmål, der har et emne, bygger serveren en
hel side omkring svaret (se "Spørgsmålet styrer formen"). Ingen oplysning står 1:1 to gange på samme
side. Samme oplysning i en anden sammenhæng er tilladt (se nederst).

**Hvert modul ejer sit indhold.** En elementtype står på præcis ét fokus. Kun overblikket må vise
en kort smagsprøve af et andet fokus' element, og så med "Se alle … i <fane>", der åbner fanen
(specens `more`). Et fokus låner aldrig et andet fokus' element som fyld: har det kun lidt data, er
siden kort, og et element, der står alene, får fuld bredde (ingen tom halvdel ved siden af). Den
tomme tilstand står, hvor den er svaret på fanens spørgsmål (ingen ejere, ingen ledelse, ingen
begivenheder, ingen kontaktoplysninger, ingen kreditvurdering).

| Fokus | Fuld bredde øverst | Kolonner | Fuld bredde nederst | Henter (`composeProbe`) |
|---|---|---|---|---|
| overblik | Hoved, nøgletal (4 kort) | 1: Relationer. 2: Virksomhedsprofil (formål, tegningsregler, analysens konklusion, resultat og likviditet). 3: Kontakt, Virksomhedsoplysninger, graf (under 3 år: Regnskab-listen uden kortenes tal). Nyheder (3 + "Se alle N nyheder i Historik") og Historik (3 + "Se alle N begivenheder i Historik") i den kolonne, der vejer mindst | Opfølgning | stamdata, regnskabstal, ledelse, ejere, historik, nyheder (5), tekstsektioner, kontakt |
| oekonomi | Hoved, nøgletal (5 kort) | 1: graf (hovednøgletal + resultat), vandfald. 2: Regnskab (årsvælger, uden kortenes nøgletal), fordeling af balancen | Regnskabsanalyse (hele, foldet efter konklusionen), flerårstabel (4+ år), opfølgning | stamdata, regnskabstal, tekstsektioner |
| regnskab | Hoved | – | Resultatopgørelse, balance, pengestrømsopgørelse, opfølgning | stamdata, fulde regnskaber |
| regnskab uden regnskab | Hoved, "Regnskab" (tom tilstand, der siger hvorfor) | – | Opfølgning | stamdata, fulde regnskaber |
| ejerskab | Hoved | Med reelle ejere: 1: Ejere (med revisor). 2: Reelle ejere | Uden reelle ejere: Ejere (fuld, også som tom tilstand). Ejerstruktur (når et selskab ejer), opfølgning | stamdata, ejere, reelle ejere, ejergraf (3 op, 2 ned) |
| ledelse | Hoved | – | Ledelse (alle, også fratrådte; fuld, også som tom tilstand), opfølgning | stamdata, ledelse |
| risiko | Hoved | Med begge: 1: Kreditvurdering. 2: Revisoruafhængighed | Kun den ene: den i fuld bredde. Ingen af dem: Kreditvurderingens egen tilstand (låst, ikke beregnet, fejl). Opfølgning | stamdata, Creditsafe, revisoruafhængighed |
| historik | Hoved | Med nyheder: 1: Historik (5 + "Se alle N begivenheder", folder ud på stedet). 2: Nyheder (5) | Uden nyheder: Historik (fuld, også som tom tilstand). Opfølgning | stamdata, historik, nyheder (5) |
| kontakt | Hoved | Med kontaktpersoner: 1: Kontakt. 2: Kontaktpersoner | Uden kontaktpersoner: Kontakt (fuld, også som tom tilstand). Opfølgning | stamdata, kontakt, kontaktpersoner |

Hvor elementtyperne bor: Relationer, Virksomhedsprofil og Virksomhedsoplysninger på overblik;
grafer, Regnskab-listen, fordeling af balancen, Regnskabsanalyse og flerårstabel på oekonomi;
resultatopgørelse, balance og pengestrøm på regnskab; Ejere, Reelle ejere og Ejerstruktur på
ejerskab; Ledelse på ledelse; Kreditvurdering og Revisoruafhængighed på risiko; Historik og
Nyheder på historik; Kontakt og Kontaktpersoner på kontakt. Overblikkets smagsprøver: Relationer
(ledelse og ejere, kompakt), Kontakt, grafen og Nyheder/Historik (3, med "Se alle … i Historik").

**Smagsprøvens "Se alle … i <fane>"** (`more` på `LassoTimeline`/`LassoNews` = `"historik"`, på
personens `LassoPersonRoles` = `"roller"` og `LassoPersonNetwork` = `"netvaerk"`; standard
`"expand"`). Har værten `openFocus`, affyrer knappen `{ kind: "open-focus", focus }`; ellers folder
"Se alle" ud på stedet som før. Værterne:

- **Portalen**: `openFocus: true`; skifter fanens fokus (ny adresse `#/company/…?focus=historik`,
  nye data), præcis som et klik på modulfanen.
- **MCP-appen** (Claude/ChatGPT): `openFocus`, når værten tager imod beskeder (`ui/message`);
  sender "Vis historik for <navn>" (personer: "Vis netværk for …", "Vis roller for …"), så modellen
  viser fanen med `show_company`/`show_person`. Uden beskeder folder "Se alle" ud på stedet.
- **Delte sider** (`/k/`, `/p/`, `/e/`, `/v/`): serveren lægger `focusLinks` i boot'en, ét signeret
  `/e/`-link pr. fane, smagsprøverne peger på, til sidens egen virksomhed eller person (signaturen
  dækker fokus, så siden ikke selv kan ændre `f=`). Med links er `openFocus` slået til.

Opfølgningerne (kun i chatten) peger stadig på de andre fokus. Data, fokus ikke har hentet (fx
ejerne på ledelse), tæller som "måske": opfølgningen vises, og fanen svarer selv; hentet og tomt
skjuler den.

Regler, der gælder på alle fokus:

- **Hovedet ejer identiteten**: CVR, form, stiftet, adresse, ansatte (CVR) og branche. Den
  viser `LassoCompanyHead`, og intet andet element gentager dem.
- **Virksomhedsoplysninger** (`LassoKeyValueList` variant company, rækker fra `companyFacts`, kun på
  overblik): revisor, seneste revisorskift, regnskabsperiode, branchekode, kommune, region, og
  telefon, e-mail og web kun uden kontaktblok på siden. Revisoren udelades, når ejerlisten (som
  viser revisor og skiftedato) står på siden. Under 2 rækker med værdi udelades listen helt.
- **Kontakt**: adressen kun, når den afviger fra hovedets; et CVR-nummer, der også er
  verificeret (live number), står én gang med verificeringen; én kildelinje.
- **Nøgletalskortene** kun på overblik og oekonomi. Regnskab-listen på samme side udelader
  kortenes nøgletal (`exclude` på `LassoKeyValueList` variant financials).
- **Tekstsektioner**: branche-afsnittet vises ikke (det står i hovedet). `variant: "profil"`
  (overblik) viser formål og tegningsregler plus analysens konklusion, resultat og likviditet,
  hver foldet med "Vis hele". `variant: "analyse"` (oekonomi) viser hele regnskabsanalysen:
  konklusionen og "Se hele regnskabsanalysen (N afsnit)", der folder resten ud på stedet.
  Analysens kildelinje står én gang pr. element. Navne med Lasso-ID er links med drill-down.
  Ældre gemte specs uden `variant` viser profilen.
- **Relationer** står aldrig ved siden af personlisten eller ejerlisten; de gentager navnene.

Tilladt, fordi sammenhængen er en anden: ejere som liste og som diagram; legale og reelle ejere;
et årsresultat i historikken, i grafen og i tabellerne; et ledelsesskift i historikken og i
ledelseslisten; seneste år i nøgletalskortene og udviklingen i flerårstabellen; revisoren i
oplysningerne og som emnet for revisoruafhængigheden; en nyhed om årsrapporten og historikkens
"Årsrapport offentliggjort".

### Balance mellem kolonnerne

`componentWeight` anslår hver sektions højde i linjer (ca. 24 px i en ⅓-kolonne ved 1280 px)
ud fra data: titel 3; relationer + 1,3 pr. gruppe + 1 pr. navn (højst 3 ejere); nyheder + 4,3 pr.
nyhed; historik + 4,5 pr. viste begivenhed + 1,5 for "Se alle"; tekstsektioner pr. afsnit
1,5 + ⌈min(tegn, 220) / 38⌉ + 1,3 ved "Vis hele" (+ 1,2 for kildelinjen; analysen tæller kun
konklusionen og linket); kontakt 1,4 pr. række + 2 pr. verificeret nummer; nøgle-værdi-lister
1,6 pr. række; grafer 14; personliste 2,5 pr. person; ejerliste 2,5 pr. ejer.

Faste pladser lægges først. Derefter lægger `placeByWeight` de flytbare sektioner én ad gangen i
den kolonne, der vejer mindst indtil nu (ved lige vægt den første): på overblik nyheder og så
historik (de andre fokus har højst to elementer side om side). Et holdingselskab med lang profil, 3 nyheder og 8 begivenheder
giver 41,5 / 41,9 / 35,0; med de gamle faste pladser (nyheder i kolonne 1, historik med 5
begivenheder under profilen) ville det være 23,5 / 67,4 / 35,0.

## Personfokus og elementer (packages/spec/src/composePerson.ts)

Personsiden bygges på samme måde: modellen (`show_person` med `focus`, eller med `question`, se
"Spørgsmålet styrer formen") eller portalens faner vælger fokus, `composePersonProbe(lassoId, focus)` henter kun det, fokus viser, og `composePerson` vælger
form efter data. Hovedet (`LassoPersonHead`) står på alle fokus. To halve står side om side i ét
bånd; en halv, der står alene, får fuld bredde. Tomme sektioner udelades, undtagen hvor den tomme
tilstand er svaret på fanens spørgsmål.

Samme regel som på virksomhedssiden: **hvert modul ejer sit indhold**. Rollerne bor på roller,
netværket på netvaerk, ejerskaberne på ejerskab, sagerne på risiko og historik og nyheder på
historik. Overblikket viser smagsprøver, hvis "Se alle" åbner fanen: "Se alle N selskaber i
Roller" (N = alle personens selskaber, som fanen viser; knappen står, når fanen har flere, end
listen viser), "Se alle N personer i Netværk" og "Se alle N begivenheder i Historik".

| Fokus | Elementer (bredde) | Henter |
|---|---|---|
| overblik | Aktive roller som kort liste, 5 + "Se alle N selskaber i Roller" (¾) + Stamoplysninger (¼); uden aktive roller de ophørte. Derefter Netværk (3 + "Se alle N personer i Netværk"), Risiko, Historik (3 + "Se alle N begivenheder i Historik") og Ejerskab (ejerdiagrammet, kun når de selskaber, personen ejer, selv ejer selskaber) to og to (½ + ½) efter vægt; alvorlig risiko (personen var med, da det skete) i fuld bredde lige under hovedet. Ingen nyheder. Uden `openFocus` folder "Se alle" ud på stedet | person, netværk, ejerdiagram (0 op, 2 ned) |
| roller | Alle roller som tidsbånd, 8 + "Se alle N selskaber" (¾) + Stamoplysninger (¼) | person |
| netvaerk | Netværket, 8 + "Se alle N" (fuld), også som tom tilstand | person, netværk |
| ejerskab | Ejerskaber: de ejede selskaber med andel og siden-dato (fuld; tom: "Personen ejer ikke selskaber i CVR."), Ejerstruktur (diagram, 0 op, 2 ned, fuld; når de ejede selskaber selv ejer selskaber, eller som fejltilstand, når grafen ikke kunne hentes) | person, ejerdiagram |
| risiko | Risiko med alle sager (fuld). Med sager: Forløb i selskaberne (historikken afgrænset til selskaberne med konkurs/tvangsopløsning, fuld). Ingen liste over øvrige ophørte roller (de står på roller). Uden sager kun "Ingen" med flueben | person, historik (afledt af personen) |
| historik | Historik, 5 + "Se alle N" (½) + Nyheder om personen, 5 (½); uden nyheder historikken i fuld bredde | person, nyheder |

Opfølgning (kun i chatten) peger på de andre personfokus: Roller, Netværk, Ejerskab, Risiko og
Historik, med spørgsmål, `show_person` kan svare på ("Hvem sidder X sammen med i selskaber?").
Undertitlen er fokusnavnet (på overblik "Roller i N selskaber"); gem-knappen gemmer fokus ud fra den.

Ingen 1:1-gentagelser:

- **Hovedet ejer tallene**: antal aktive og ophørte roller, ejerskaber og første registrering.
  Stamoplysningerne viser derfor kun bopæl (postnummer og by), kommune (når den ikke gentager
  byen), enhedsnummer og seneste ændring, når hovedet står på siden (`personFactOptions`).
- **Rollefanen** har ingen liste over ophørte roller: tidsbåndene viser dem (stiplede).
- **Risiko**: forløbet er ikke kun statushændelserne (de ville gentage sagerne 1:1), men også
  personens ind- og udtræden i de samme selskaber. De øvrige ophørte roller hører til roller.
- **Ejerdiagrammet** viser to lag ned og står kun, når de ejede selskaber selv ejer selskaber: ét
  lag ville kun gentage "ejer X %" fra rollelisten (overblik) og ejerskaberne (ejerskab) 1:1. Som
  på virksomhedssiden, hvor diagrammet kun står, når et selskab ejer.

Tilladt, fordi sammenhængen er en anden: en konkurs i historikken og i risikoen; et ejet selskab i
rollelisten, i ejerskaberne og i diagrammet; en rolle i rollelisten og som rolleskift i historikken.

Balancen: `personComponentWeight` anslår højden som `componentWeight` (titel 3; rolleliste 2,5 pr.
række; tidsbånd 2,4 pr. selskab; stamoplysninger 1,6 pr. række; netværk 3 pr. person; risiko 5,8 +
0,8 pr. sag; ejerdiagram i en halv kolonne 1,8 pr. række i den indrykkede liste). `pairByWeight`
vælger blandt de mulige par den parring, der giver de mest lige bånd (ved under 2 linjers forskel
den foretrukne rækkefølge). Bo Eksempel (demo) ved 1280 px: aktive roller 299 px | stamoplysninger
251 px, netværk 365 | risiko 299, historik 412 | ejerskab 385.

## Spørgsmålet styrer formen (packages/spec/src/ask.ts)

`show_company` og `show_person` tager `question`: brugerens spørgsmål ordret (højst 300 tegn).
`show_company` tager desuden `metrics` (højst 5), de nøgletal, modellen har genkendt, når de ikke står
med deres navn i spørgsmålet ("egenkapitalandel" = soliditetsgrad). `focus` bliver, men bruges kun ved
et generelt spørgsmål; ellers bestemmer spørgsmålet. Serverens instruktioner: "Send altid brugerens
spørgsmål ordret i question." Portalens faner sender intet spørgsmål og er uændrede.

**Fra spørgsmål til side.** `parseAsk(question, kind, { metrics, name })` giver en deterministisk
spørgsmålsprofil (`Ask`): nøgletal og emner i nævnt rækkefølge, årstal (`year`), antal år (`years`),
udvikling (`trend`) og tidligere (`past`). Store/små bogstaver og æøå/ae-oe-aa er ligegyldige, og
ordstammer fanger bøjningerne ("gælden", "gaeld", "egenkapitalandelen"). Virksomhedens eller personens
navn fjernes først, så "Eksempel Ejendomme ApS" og "X Holding" ikke bliver emnerne ejendomme og
koncern, og et 8-cifret CVR-nummer er aldrig et årstal. `askPlan(ask, kind)` giver planen
`{ top, lead, context }`: kortrækken, svar-elementerne i nævnt rækkefølge og kontekstmodulerne i
rangorden. Proben (`composeProbe`/`composePersonProbe` med `ask`) henter alt i planen, hver
datakilde én gang; komponisten (`composeCompany`/`composePerson` med `ask`) tilpasser planen til data.
`askFocus`/`askPersonFocus` giver spørgsmålets fokus (opfølgningerne og rammen for et generelt
spørgsmål), og `askLabel` sidens undertitel ("Soliditetsgrad", "Gæld og egenkapital", "Direktion",
"Revisor", "Bestyrelsesposter"). Samme spørgsmål giver altid samme side for samme data.

**Altid en hel side.** Et spørgsmål med et emne giver aldrig et tyndt svar, men en hel side i
overbliksrammen: hovedet, evt. kortrækken, tre kolonner og fuldbredde-elementer nederst (personsiden:
to kolonner som i dag). Svar-elementet står først: øverst i kolonne 1 (flere svar: øverst i kolonne 1,
2 og 3 i nævnt rækkefølge, aldrig under hinanden), eller i fuld bredde over kolonnerne, når det er en
tabel, et regnskab, et diagram eller en liste over enheder. Svar-elementet står også tomt (den tomme
tilstand er svaret). Kontekstmodulerne lægges ét ad gangen i den kolonne, der vejer mindst
(`componentWeight`), til hver kolonne vejer mindst 25 "linjer" (`ASK_COLUMN_TARGET`) eller puljen er
brugt; tomme kontekstmoduler udelades, og fuldbredde-moduler står under kolonnerne. Efter
ranglisten kommer en fælles hale (graf over hovednøgletallet, historik, relationer,
virksomhedsoplysninger, nyheder, profil, kontakt; for personer aktive roller, netværk, historik,
risiko og nyheder), så en virksomhed med lidt data stadig får en fuld side. Falder en kolonne ud,
bruges 2 kolonner; står kun én, får dens elementer fuld bredde. Uden spørgsmål, med et generelt
spørgsmål ("fortæl om X", "hvordan går det", "tjener de penge") eller med en fane-besked ("Vis
historik for X", fra "Se alle … i Historik") er det fokus-siderne som hidtil (fokus fra modellen,
ellers spørgsmålets, ellers overblik).

**Data pr. element følger spørgsmålet** (parametre på de eksisterende elementer, ingen nye former):

| Element | Parameter | Eksempel |
|---|---|---|
| `LassoKeyFigureCards` | `metrics`: 4–5, de spurgte først, så de beslægtede, fyldt op med standardkortene | "soliditetsgraden" → soliditetsgrad, egenkapital, gæld, omsætning |
| `LassoKeyValueList` financials | `only` (kun de nøgletal, minus kortenes), `year` (årsvælgeren starter på året; findes det ikke, seneste år og en note i kildelinjen) | "omsætningen i 2023" → omsætning, bruttofortjeneste, resultat for 2023 |
| `LassoKeyValueList` company | `rows` (`COMPANY_FACT_KEYS`) | "hvem er revisor" → revisor, seneste revisorskift, regnskabsperiode |
| `LassoPersonList` | `roles`: `direktion` (`/direkt/`) eller `bestyrelse` (`/bestyrelse\|formand/`, suppleanter med); titel efter filteret | "hvem er direktør" → kun direktionen |
| `LassoTimeline` (virksomhed) | `kinds` (`TIMELINE_KINDS`: stamdata, ledelse, regnskab, status, ejerskab = begivenhedens kategori); titel og tom tilstand efter filteret ("Ingen statusændringer registreret.") | "hvad er der sket i ledelsen" → kun ledelsesændringer |
| `LassoPersonRoles` | `role`: `bestyrelse`, `direktion` eller `ejer`; titel "Bestyrelsesposter", "Direktørposter", "Ejerskaber" | "sidder X i bestyrelser" → kun bestyrelsesposterne |
| grafer | nøgletal og år: 1 nøgletal → søjler, procent → linje, gæld/egenkapital → stablede søjler, 2–3 → grupperede; `years` = spurgte år, ellers 10 ved udvikling, ellers 5 | "gælden de sidste 5 år" → stablede søjler over 5 år |

Beslægtede nøgletal (spurgt først, højst 4–5 på kort, højst 5 i listen): omsætning → bruttofortjeneste,
resultat; bruttofortjeneste → resultat, ansatte; resultat → overskudsgrad, omsætning (bruttofortjeneste,
når omsætning ikke er oplyst); egenkapital → soliditetsgrad, balancesum; gæld → egenkapital,
soliditetsgrad, balancesum; soliditetsgrad → egenkapital, gæld; likviditetsgrad → gæld; balancesum →
egenkapital, gæld; overskudsgrad → resultat, omsætning; EBITDA → resultat, omsætning; ansatte → ingen.

### Virksomhed: svar-element og kontekst pr. spørgsmålstype

Notation: `Graf(m)` = søjler, linje (procent), stablede søjler (gæld/egenkapital) eller grupperede
søjler (2–3 nøgletal); `Liste[only]` = regnskabslisten; `Rækker[…]` = virksomhedsoplysninger med `rows`.

| Spørgsmålstype (signal) | Øverst (fuld bredde) | Svar-element (lead) | Kontekst i rangorden |
|---|---|---|---|
| Nøgletal 1–3, evt. udvikling, antal år eller år | Hoved; kort (spurgte + beslægtede, 4–5; ingen ved et år) | Graf(m) (under 3 år med tal: Liste[only]); med år: Liste[only, year] og grafen, der dækker året, som første kontekst | Liste[only minus kortenes], andelsbjælker (balancenøgletal), vandfald (resultatnøgletal med omsætning), regnskabsanalyse, flerårstabel (fuld), historik (regnskab), resultatopgørelse eller balance (fuld, den nøgletallet hører til), relationer |
| 4+ nøgletal, "tabel", "år for år" | Hoved; kort (spurgte) | Flerårstabel (fuld) | Graf(første), regnskabslisten, regnskabsanalyse, historik (regnskab) |
| Direktion, bestyrelse, ledelse | Hoved | Personlisten med `roles` (alle ved "tidligere"/"udskiftning"); "hvad er der sket i ledelsen": historik (ledelse) først | Historik (ledelse), ejerliste, profil, kontaktpersoner, nyheder (3), reelle ejere |
| Ejere, reelle ejere, koncern | Hoved | Ejerlisten (reelle → reelle ejere først; koncern → ejerdiagrammet i fuld bredde under hovedet) | De andre ejer-elementer, personlisten (nuværende), historik (ejerskab, ellers alle), nyheder (3), profil |
| Revisor, revisorskift | Hoved; standardkort | Rækker[revisor, revisorskift, regnskabsperiode] (revisorskift: + revisoruafhængighed) | Revisoruafhængighed, graf (hovednøgletal), regnskabsanalyse, historik (regnskab), ejerliste |
| Stiftet, status, branche, formål, adresse | Hoved (svarer); standardkort | Profil (formål/branche), historik (stamdata og status) eller kontakt (adresse) | Relationer, historik, Rækker[kommune, region, branchekode], graf, nyheder (3), produktionsenheder |
| Telefon, e-mail, web, kontaktpersoner | Hoved | Kontakt (kontaktpersoner først, når de nævnes) | Den anden kontaktblok, produktionsenheder, personlisten (direktion), Rækker[kommune, region], profil, nyheder (3) |
| Nyheder, historik | Hoved (standardkort ved historik) | Nyheder (5); historik → historikken (8) først ("sket med regnskabet": kun regnskaber) | Den anden af de to, relationer, profil |
| Konkurs (status med konkursord) | Hoved; kort: egenkapital, resultat, soliditetsgrad, likviditetsgrad | "Status og historik": historikken med statusændringerne (8); uden statusbegivenheder hele historikken (hovedet viser status), aldrig en tom tilstand, når der er historik | Liste[gæld, balancesum], andelsbjælker, regnskabsanalyse, relationer, revisoruafhængighed |
| Kredit, røde flag, "kan vi handle med dem" | Hoved; kort som ved konkurs | Kreditvurdering (hentes kun her og på fokus risiko) | Revisoruafhængighed, historik (status), andelsbjælker, regnskabsanalyse, relationer |
| Score | Hoved; standardkort | Scoremåler | Graf, regnskabslisten, regnskabsanalyse, relationer |
| Resultatopgørelse, balance, pengestrøm, regnskab | Hoved; standardkort | Det regnskab, der spørges om (fuld; "regnskabet": resultatopgørelse og balance); uden regnskab én tom tilstand, der siger hvorfor | Vandfald / andelsbjælker, regnskabsanalyse, Liste[de relevante nøgletal], historik (regnskab) |
| P-enheder, ejendomme, besætning | Hoved | Produktionsenheder / ejendomme / besætning (fuld) | Kontakt, Rækker[kommune, region, branchekode], personlisten, profil, nyheder (3) |
| Flere typer ("hvem ejer og hvem er revisor", "omsætning og direktør") | Hoved; kortene fra den første type, der har kort | Svarene i nævnt rækkefølge, hvert øverst i sin kolonne | Ranglisterne flettet efter rang, uden dubletter |
| Fælles hale (efter hver rangliste) | | | Graf (hovednøgletal), historik (5), relationer, Rækker[kommune, region, branchekode], nyheder (3), profil, kontakt; bruges kun, til siden er fuld |

### Person: svar-element og kontekst

| Spørgsmålstype | Svar-element | Kontekst i rangorden |
|---|---|---|
| Bestyrelse, direktion, ejer, roller | Rollerne med `role` (nu; "tidligere" → ophørte; udvikling → tidsbånd; "roller" → alle som tidsbånd), 8, ¾ + stamoplysninger ¼ | Netværk (5), historik (5), risiko, ejerdiagram (ejer), nyheder (3) |
| Konkurs | Risiko ¾ + stamoplysninger ¼ | Forløbet i selskaberne (historik, risiko), ophørte roller uden konkursselskaberne, netværk (3) |
| Netværk | Netværket (8) ¾ + stamoplysninger ¼ | Aktive roller (5), historik (5), risiko |
| Nyheder, historik | Nyheder (5) / historik (8) ¾ + stamoplysninger ¼ | Den anden, aktive roller, risiko |
| Bopæl | Stamoplysninger (fuld) | Aktive roller, netværk, historik |
| Ejerstruktur, koncern | Ejerdiagrammet (fuld) | Ejerskaber (show owner), netværk, risiko |
| Fælles hale (efter hver rangliste) | | Aktive roller (5), netværk (3), historik (5), risiko, nyheder (3); bruges kun, til siden er fuld |

### Regler og eksempler

Reglerne ovenfor gælder også her: hovedet ejer identiteten; kort og regnskabsliste deler ikke
nøgletal (listen får `only` uden kortenes, ellers `exclude`); ejerlisten viser revisoren, så
spørges der om både ejere og revisor, svarer ejerlisten på begge, og revisor-rækkerne udelades (og
omvendt står ejerlisten ikke som kontekst, når revisor-rækkerne er svaret); relationerne står aldrig
ved siden af person- eller ejerlisten; højst én graf pr. side (søjler, linje, stablede eller
grupperede; vandfald og andelsbjælker tæller ikke med, men står højst én gang hver); hvert element
højst én gang; højst 12 elementer (viewSpecSchema). Opfølgningerne peger altid tilbage til hele siden
("Hele økonomien" / "Hele overblikket") og derefter på fokusets naturlige næste spørgsmål.

- "Hvad er soliditetsgraden i Eksempel Byg?" → kort (soliditetsgrad, egenkapital, gæld, omsætning),
  linjegraf over soliditetsgraden (kolonne 1), andelsbjælker, regnskabsanalyse, historik (regnskaber),
  virksomhedsoplysninger, nyheder; flerårstabel og balance nederst.
- "Hvordan har gælden udviklet sig de sidste 5 år?" → kort med gæld først, stablede søjler over 5 år.
- "Hvem er direktør i Eksempel Byg?" → personlisten med kun direktionen, ledelsesændringer, ejerliste,
  profil, kontaktpersoner, nyheder.
- "Hvem ejer, og hvem er revisor?" → standardkort, ejerlisten (med revisor) i kolonne 1, reelle ejere,
  revisoruafhængighed, graf, regnskabsanalyse …; ejerdiagrammet nederst.
- "Sidder Bo Eksempel i bestyrelser?" → bestyrelsesposterne ¾ + stamoplysninger ¼, netværk, historik,
  risiko og nyheder to og to.

**Links, resumé og tekstkort.** Det signerede `/k/`-link bærer spørgsmålet (`q=`, og modellens
nøgletal som `qm=`), `/p/`-linket ligeså (`q=`), begge i den signerede payload; uden `q` er payloaden
som før, så ældre links stadig verificeres, og et `q` over 300 tegn afvises. `/k/` og `/p/` læser
spørgsmålet igen (uden navnet) og viser samme side som i chatten. `/e/`-links (portalen) er uændrede.
Resuméet til modellen har "Svar: …" lige efter hovedlinjen (fx "Svar: Soliditetsgrad 2025: 54,1 %
(2024: 55,6 %).", "Svar: Direktion: Anne Eksempel (direktør)." eller ved konkurs "Svar: Status: Under
konkurs siden 02.02.2026." med status fra hovedet og datoen for den seneste statusændring, når den findes), og tekstkortet har en SVAR-sektion
lige under navnet; begge følger elementernes filtre.

## Ikke i denne runde

Overvågning/notifikationer, brugerens egne lister (ud over gemte sider), dataudtræk, prospecting,
rapportering, ejendomme som selvstændigt værktøj og Lasso ID-login.
