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

Serveren bygger virksomhedssiden efter data; modellen vælger kun fokus. Ingen oplysning står
1:1 to gange på samme side. Samme oplysning i en anden sammenhæng er tilladt (se nederst).

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

Personsiden bygges på samme måde: modellen (`show_person` med `focus`) eller portalens faner vælger
fokus, `composePersonProbe(lassoId, focus)` henter kun det, fokus viser, og `composePerson` vælger
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

## Ikke i denne runde

Overvågning/notifikationer, brugerens egne lister (ud over gemte sider), dataudtræk, prospecting,
rapportering, ejendomme som selvstændigt værktøj og Lasso ID-login.
