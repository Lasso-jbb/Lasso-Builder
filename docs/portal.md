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
| `GET /api/portal/person/:ref` | Som `show_person` | `{ spec, dataset, note?, link }` |
| `POST /api/portal/resolve` `{ spec }` | Som `resolve_view` (drill-down, filterændring, opdatér) | `{ spec, dataset }` |
| `GET /api/portal/pages?kind=company\|person\|all&limit=` | Som `list_saved_pages` | `{ spec, dataset }` |
| `POST /api/portal/pages` `{ page, kind?, focus?, note? }` | Som `save_page` | `{ lassoId, kind, name, cvr?, savedAt, created, total, url }` |
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
  refine, drillDown, refresh, export, back: false }` og handlinger via fetch mod API'et.
- Hash-routing, så tilbage/frem og genindlæsning virker: `#/search?q=…`, `#/company/CVR-1-…?focus=`,
  `#/person/CVR-3-…`, `#/saved`.
- Mobil: `AppShell`s mobile-props (titel, sektioner = fokus, bundnavigation Søg, Lister, Konto).

## Fokus og elementer (packages/spec/src/compose.ts)

Serveren bygger virksomhedssiden efter data; modellen vælger kun fokus. Ingen oplysning står
1:1 to gange på samme side. Samme oplysning i en anden sammenhæng er tilladt (se nederst).

| Fokus | Fuld bredde øverst | Kolonner | Fuld bredde nederst |
|---|---|---|---|
| overblik | Hoved, nøgletal (4 kort) | 1: Relationer. 2: Virksomhedsprofil (formål, tegningsregler, analysens konklusion, resultat og likviditet). 3: Kontakt, Virksomhedsoplysninger, graf (under 3 år: Regnskab-listen uden kortenes tal). Nyheder (3) og Historik (3 + "Se alle") i den kolonne, der vejer mindst | Opfølgning |
| oekonomi | Hoved, nøgletal (5 kort) | 1: graf (hovednøgletal + resultat), vandfald. 2: Regnskab (årsvælger, uden kortenes nøgletal), fordeling af balancen | Regnskabsanalyse (hele, foldet efter konklusionen), flerårstabel (4+ år), opfølgning |
| regnskab | Hoved | – | Resultatopgørelse, balance, pengestrømsopgørelse, opfølgning |
| regnskab uden regnskab | Hoved, "Regnskab" (tom tilstand, der siger hvorfor) | Virksomhedsoplysninger (mindst 2 rækker), Ledelse, ellers Ejere (højst to) | Opfølgning |
| ejerskab | Hoved | 1: Ejere (med revisor). 2: Reelle ejere, ellers Ledelse | Ejerstruktur (når et selskab ejer), opfølgning |
| ledelse | Hoved | 1: Ledelse (alle). 2: Historik (3+ begivenheder). Ejere (med revisor) i den kolonne, der vejer mindst | Opfølgning |
| risiko | Hoved | 1: Virksomhedsoplysninger, Ledelse (alle). 2: Kreditvurdering, Historik (uden historik: Ejere) | Revisoruafhængighed, opfølgning |
| historik | Hoved | 1: Historik (5 + "Se alle"). 2: Nyheder (5), uden nyheder graf eller Regnskab-listen | Opfølgning |
| kontakt | Hoved | 1: Kontakt. 2: Kontaktpersoner, ellers Ledelse (CVR). 3: Virksomhedsoplysninger | Opfølgning |

Regler, der gælder på alle fokus:

- **Hovedet ejer identiteten**: CVR, form, stiftet, adresse, ansatte (CVR) og branche. Den
  viser `LassoCompanyHead`, og intet andet element gentager dem.
- **Virksomhedsoplysninger** (`LassoKeyValueList` variant company, rækker fra `companyFacts`):
  revisor, seneste revisorskift, regnskabsperiode, branchekode, kommune, region, og telefon,
  e-mail og web kun uden kontaktblok på siden. Revisoren udelades, når ejerlisten (som viser
  revisor og skiftedato) står på siden. Under 2 rækker med værdi udelades listen helt.
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
historik, på ledelse ejerne. Et holdingselskab med lang profil, 3 nyheder og 8 begivenheder
giver 41,5 / 41,9 / 35,0; med de gamle faste pladser (nyheder i kolonne 1, historik med 5
begivenheder under profilen) ville det være 23,5 / 67,4 / 35,0.

## Ikke i denne runde

Overvågning/notifikationer, brugerens egne lister (ud over gemte sider), dataudtræk, prospecting,
rapportering, ejendomme som selvstændigt værktøj og Lasso ID-login.
