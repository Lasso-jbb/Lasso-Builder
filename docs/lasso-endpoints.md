# Lasso API-endpoints

Oversigt over de Lasso-endpoints, Lasso-Builder anvender. `{lassoId}` er et Lasso-ID for en
virksomhed (`CVR-1-…`), en produktionsenhed (`CVR-2-…`) eller en person (`CVR-3-…`). Base-URL er
`https://api.lassox.com` og hentes fra miljøvariablen `LASSO_API_BASE_URL`. Klienten ligger i
`apps/server/src/lasso/client.ts`.

Denne fil samler status for HELE integrationen. Fire områder er i dag bekræftet mod en rigtig
nøgle (27.09.2026, opstartsproben på Railway-staging, testvirksomhed NOVO NORDISK A/S,
`CVR-1-24256790`) og har hver deres egen, mere detaljerede fil, som denne fil henviser til i
stedet for at gentage alt:

- `docs/endpoints-ejerskab.md` — reelle ejere, legale ejere, ejergraf.
- `docs/endpoints-risiko-nyheder.md` — risikoobservationer (Firmaindsigt), Lasso News, Paqle.
- `docs/endpoints-enheder-kontakt-analyse.md` — produktionsenheder, CHR, live number, regnskabsanalyse.
- `docs/endpoints-creditsafe.md` — kreditvurdering (Creditsafe). IKKE kaldt mod API'et (koster en kredit); formen er kun fra dokumentationen.

## Autentificering og rate-grænser

API-nøglen sendes i headeren `lasso-api-key` (bekræftet mod api.lassox.com 24.09.2026 og igen
27.09.2026; Basic, Bearer og query-parametre giver 401). Nøglen ligger i `LASSO_API_TOKEN` på
Railway, aldrig i koden. Se `.env.example`.

Fejlsvar har formen `{ "errorMessage": string, "httpStatusCode": number, "errorCode": number }`.

- Generel grænse: **500 kald/min**.
- Risikoobservationer (`POST /modules/observations/{lassoId}`): **120 kald/min**, strammere end
  den generelle grænse.
- Ingen anden endpoint-specifik grænse er dokumenteret.
- Egne, længere timeouts (ikke rate-grænser): regnskabsanalyse 30 s (`REPORT_ANALYSIS_TIMEOUT_MS`),
  Creditsafe 50 s (Creditsafe kan beregne live, 5–45 s). Den globale `LASSO_API_TIMEOUT_MS`
  (standard 15 s) gælder for resten.

## Alle endpoints, klienten bruger

| Formål | Metode | Sti | Klientmetode (`client.ts`) | Bruges af | Status |
|---|---|---|---|---|---|
| CVR (stamdata) | GET | `/{lassoId}` | `company` | `show_company`, stort set alle virksomhedskomponenter | bekræftet 24.09.2026 |
| Person (stamdata, roller) | GET | `/{lassoId}` (person-ID) | `person` | `show_person`, `LassoPersonHead/Roles/Risk` (16) | dokumenteret, ikke afprøvet mod API (ejerfelterne `owner`/`trueOwner` er dog bekræftet mod Lassos egen dokumentation, se `docs/endpoints-ejerskab.md`) |
| Produktionsenhed (detalje) | GET | `/{lassoId}` (`CVR-2-…`-ID) | `productionUnit` | `LassoProductionUnits` (20) | **bekræftet mod API 27.09.2026** |
| Regnskab | GET | `/{lassoId}/reports/advanced` | `reports` | Nøgletal, `LassoIncomeStatement/BalanceSheet/CashFlow` (13, 19) | bekræftet 24.09.2026 (hovedtal); XBRL-linjeposter ud over hovedtallene er ubekræftede gæt, se nedenfor |
| Regnskabsanalyse | POST | `/modules/reportanalysis/{lassoId}` (tom body) | `reportAnalysis` | Tekstsektion "Regnskabsanalyse" (12/19) | **bekræftet mod API 27.09.2026** (se nedenfor — adapteren rettes til den bekræftede form i et parallelt arbejde) |
| Person, historik | GET | `/{lassoId}/history` | `personHistory` | samme som person | dokumenteret, ikke afprøvet |
| Personnetværk | GET | `/modules/network/{lassoId}` | `personNetwork` | `LassoPersonNetwork` (16) | dokumenteret, ikke afprøvet |
| Tinglysning | GET | `/data/tinglysning/{lassoId}` | `tinglysning` | ingen komponent kalder den endnu | dokumenteret, ikke koblet på |
| Ejerfortegnelsen | GET | `/data/ejf/{lassoId}/ownerships/current` | `ejf` | `LassoProperties` (20) | dokumenteret, ikke afprøvet (svarformen ukendt) |
| BBR, én ejendom | GET | `/data/bbr/property/summary?bfeNumber=` | `bbrSummary` | `LassoProperties` (20), BFE-nummer fra ejf-svaret | sti/parameter bekræftet 26.09.2026; sammensat med ejf, hvis samlede flow er ubekræftet |
| Websites | GET | `/data/websites/{lassoId}` | `websites` | Kontaktudfyldning (`fillContactInfo`) | bekræftet |
| Valuations | GET | `/modules/valuations/{lassoId}` | `valuations` | ingen komponent; kun opstartsproben med `LOG_LEVEL=debug` | dokumenteret; `[]` for de testede virksomheder, formen er ukendt |
| Kontaktdata (hjemmeside) | GET | `/apps/contacts/{lassoId}/data` | `contacts` | `LassoContact`, `LassoContactPersons` (08) | dokumenteret, ikke afprøvet |
| Live number | GET | `/data/livenumber/{lassoId}` | `liveNumber` | `LassoContact`, verificerede numre (08) | **bekræftet mod API 27.09.2026** (svarformen er fra dokumentationen); **tilkøb (401 for nuværende nøgle)** |
| Legale ejere | GET | `/{lassoId}/owners/legal` | `ownersLegal` | `OwnerList`, ejerskabsafsnittet (11) | **bekræftet mod API 27.09.2026** |
| Legale ejere, historik | GET | `/{lassoId}/history/owners/legal` | ikke koblet på | — | dokumenteret, ikke afprøvet |
| Reelle ejere | GET | `/{lassoId}/owners/beneficial` | `ownersBeneficial` | `LassoBeneficialOwners` (11) | dokumenteret; **tilkøb (401 for nuværende nøgle)** |
| Ejergraf | POST | `/modules/relations/graph` | `relationsGraph` | `LassoOwnershipDiagram` (14) | **bekræftet mod API 27.09.2026** |
| Risikoobservationer | POST | `/modules/observations/{lassoId}` | `observations` | ingen (fjernet fra visningerne 27.09.2026; adapteren bliver) | **bekræftet mod API 27.09.2026** |
| Lasso News | POST | `/modules/news` | `lassoNews` | `LassoNews` (12) | **bekræftet mod API 27.09.2026** |
| Paqle-nyheder | GET | `/data/paqle/{lassoId}/news` | `news` | `LassoNews` (12) | **bekræftet mod API 27.09.2026**; tilkøb (Paqle findes på nuværende nøgle) |
| CHR (husdyr) | GET | `/data/CHR/livestock/{cvr}?onlyCurrent=true` | `chrLivestock` | `LassoLivestock` (20) | **bekræftet mod API 27.09.2026** (kræver Ejendomme-modulet; findes på nuværende nøgle) — adapteren rettes til den bekræftede form i et parallelt arbejde |
| CHR (gammelt gæt) | GET | `/modules/chr/{lassoId}` | `chr` | ingen — erstattet af `chrLivestock` | dødt, uafprøvet gæt, kaldes ikke længere |
| Kreditvurdering (Creditsafe) | GET | `/data/creditsafe/rating/{cvr}?skipCache=` | `creditsafeRating` | `LassoCreditRating` (17) | dokumenteret, **ikke afprøvet** (et kald koster en kredit; Lasso cacher svaret 24 timer pr. organisation) |
| Overvågningsjobs | GET | `/apps/monitoring/jobs` | `monitoringJobs` | `LassoChangeFeed` (21) | dokumenteret, ikke afprøvet |
| Overvågningsjob, elementer | GET | `/apps/monitoring/jobs/{JobId}/items` | `monitoringItems` | samme | dokumenteret, ikke afprøvet |
| Ændrede virksomheder | GET | `/data/cvr/companies/delta/history` | `companyUpdates` | samme | dokumenteret, ikke afprøvet |
| Søgning (fritekst) | GET | `/data/cvr/search` | `search` | `search_companies`, navneopslag i `show_company`/`show_person`/`save_page` | bekræftet |
| Søgeprompt → filtre | POST | `/apps/search/query/prompt` (dev3) | `searchPrompt` | `search_companies` | bekræftet 25.09.2026 |
| Søgning med filtre | POST | `/apps/search/lassoid` (dev3) | `searchByFilters` | `search_companies` | bekræftet 25.09.2026 |

`ownersBeneficial`/`liveNumber` er dokumenterede og klar til brug, men denne API-nøgle har ikke
tilkøbet (401); den faktiske 200-form er derfor ikke set i praksis, kun i Lassos dokumentation.
`tinglysning`, `valuations` og det gamle `chr`-gæt er definerede klientmetoder, som i dag ikke
indgår i nogen brugerflade.

## Virksomhedsdata og regnskab

`GET /{lassoId}`: `{ lassoId, cvr, name, status, lifeTime: { from, to }, address: { address1,
postalCode, postalDistrict, municipality: { name, code } }, form: { shortDescription }, industry:
{ text, code }, employees: { count, fullTimeEquivalentCount, interval }, accounting: { accountant
}, management: { ceo, members }, board: { chairman, members, alternates }, ownership: { owners:
[…] }, productionUnits: [{ lassoId: "CVR-2-…", pNumber }], otherParticipants, stakeholders, … }`.
Ejerandele under `ownership.owners` er brøker (0,25–0,3332 = 25–33,32 %). `productionUnits` er
bekræftet 27.09.2026: Novo Nordisk har 172 enheder, hver kun med `{ lassoId, pNumber }` — selve
detaljerne hentes pr. enhed, se `docs/endpoints-enheder-kontakt-analyse.md`.

`GET /{lassoId}/reports/advanced`: liste af regnskaber `{ lassoId, period: { from, to },
reportYear, publicationTime, data: { company?, group? } }`. `company`/`group` har `facts: {
incomeStatement, statementOfFinancialPosition, … }`, hvor hver sektion er et XBRL-træ: `{ facts: {
[begreb]: node }, abstract, label }` og bladene er `{ value, unit, xbrlType, balance, label,
source }`. Begreberne er camelCase (`revenue`, `grossProfit`, `profitLoss`, `equity`,
`averageNumberOfEmployees`) og disse er bekræftede. Gamle regnskaber (før XBRL) har tomme `facts`.

**Regnskabsanalyse** (`POST /modules/reportanalysis/{lassoId}`, tom body) er bekræftet mod API
27.09.2026: svarer på 2,7 s med `{ lassoId, sections: { sprgsml, konklusion, branchestatistik,
likviditet, balanceogkapitalforhold, resultat, revisoroplysninger } (hver et HTML-uddrag med
`<b>`/`<br>`), text (hele analysen, samlet), latestReport { … standardnøgletal som { unit, value,
sources, possibleError, error } … }, previousReport { … samme … } }`. Dette er en anden, rigere
form end den, `docs/endpoints-enheder-kontakt-analyse.md` og `unitAdapters.ts` i dag forudsætter
(rent HTML eller `{ text | analysis | html | content | result | summary }`); adapteren rettes til
`sections` i et parallelt arbejde. `latestReport`/`previousReport`s `possibleError`-flag er en
senere mulighed (kataloggens regel 8, kildelinje/forbeholdstekst pr. nøgletal).

**Valuations** (`GET /modules/valuations/{lassoId}`) gav `[]` for de testede virksomheder; formen
er stadig ukendt, og ingen komponent kalder endpointet.

## Ejerskab: reelle ejere, legale ejere, ejergraf

Se `docs/endpoints-ejerskab.md` for de fulde svarformer og adapterdetaljer
(`apps/server/src/lasso/ownershipAdapters.ts`, `adapters.ts`). Kort status:

- **Legale ejere** (`GET /{lassoId}/owners/legal`): bekræftet mod API 27.09.2026, formen er
  præcis som dokumenteret — `{ hasOwnersUnderFivePercent, owners: [{ ownership: { from, to },
  voteRights: { from, to }, address, name, type: "VIRKSOMHED", lassoId, unitNumber, cvr, role: {
  mainType: "REGISTER", type: "EJER", attributes }, from }] }`, andele som brøk-intervaller 0–1.
  `type`/`cvr`/`unitNumber` er bekræftet (store bogstaver, begge felter sat sammen med `lassoId`
  for en virksomhedsejer); en `PERSON`-type ejer er ikke set i eksemplet.
- **Reelle ejere** (`GET /{lassoId}/owners/beneficial`): giver **401** for denne nøgle (tilkøb
  eller ingen adgang) → vises som en låst tilstand i UI'en. Svarformen er derfor fortsat kun fra
  Lassos dokumentation, ikke bekræftet mod et rigtigt 200-svar.
- **Ejergraf** (`POST /modules/relations/graph`): bekræftet mod API 27.09.2026. `relations: [{
  id, type: "ownership", from, to, data: { ownershipPercentage: { label, from, to } }, metadata }
  ]`, `entities: [{ id, type: "company", data: { lassoId, name, cvr, companyType: {
  companyFormCode, shortDescription, longDescription, … }, status, employees, fte, industryCode,
  address } }]`. To ting er nu afklaret, som `docs/endpoints-ejerskab.md` tidligere bad om at
  verificere: `data.ownershipPercentage.from/to` ER brøker (0–1, ikke procent), og
  `relations[].type` for et almindeligt ejerskab ER strengen `"ownership"`. Nyt, ikke tidligere
  antaget: `companyType` er et OBJEKT (ikke en streng), `employees` er et tal, og `fte` er en
  TEKST med punktum som decimaltegn (fx `"26.308"`, ikke `26.308` som tal).

## Risiko og nyheder

Se `docs/endpoints-risiko-nyheder.md` for de fulde svarformer. Kort status:

- **Risikoobservationer** (`POST /modules/observations/{lassoId}`, body `{ observationTags:
  ["CompanyInsight"] }`): bekræftet mod API 27.09.2026 (Novo Nordisk, 22 direkte observationer,
  11,8 s svartid — et stort selskab; `LiveProvider.observations` venter derfor højst
  `OBSERVATIONS_BUDGET_MS`, 14 s, før den fejler pænt). Svaret har topfelterne `version` (set: "2024.02.28.1"),
  `relatedLassoId`, `relatedCompanyName`, `relatedPersonName`, `score`, `percentages`,
  `relatedName`, `observations: [{ title, type, tags, shortDescription, description, outcome:
  0|25|50|100, notAvailable, errors, relatedLassoId }]` og `relatedObservations` (nøgler i SMÅ
  bogstaver, både selskaber og personer, fx `"cvr-1-…"`/`"cvr-3-…"`). `score` læses ind
  (`ObservationsVM.score`), men vises IKKE i UI'en, fordi skalaen er ukendt.
- **Lasso News** (`POST /modules/news`, body en liste af Lasso Id'er, `limit`/`orderBy=publishtime`):
  bekræftet mod API 27.09.2026, rent array som dokumenteret. `headline`/`content`/`tagLine` har
  indlejret entitets-markup `{Navn|LassoId}`, som kan stå inde i `<ul><li>`-HTML; `providerData`
  var `null` i det bekræftede svar.
- **Paqle** (`GET /data/paqle/{lassoId}/news`): bekræftet mod API 27.09.2026 (kræver
  Paqle-tilføjelsen, som findes på denne nøgle), formen som dokumenteret —
  `providerData.headline`/`.extract` er lister af `{ text, highlight }`.

## Produktionsenheder, CHR, live number og kontaktdata

Se `docs/endpoints-enheder-kontakt-analyse.md` for de fulde svarformer og adapterdetaljer
(`apps/server/src/lasso/unitAdapters.ts`). Kort status:

- **Produktionsenheder**: bekræftet mod API 27.09.2026. `company-full`'s `productionUnits`-felt
  giver referencerne (`{ lassoId: "CVR-2-…", pNumber }`, 172 stk. for Novo Nordisk); `GET
  /{CVR-2-…}` giver hver enheds fulde detaljer (`lassoId, pNumber, unitNumber, name, cvr, status,
  lifeTime, phone/email/fax/website, commerciallyProtected, creationDate, address, industry,
  altIndustry1…`).
- **CHR — Centrale Husdyrbrugsregister**: bekræftet mod API 27.09.2026 (kræver
  Ejendomme-modulet, som findes på denne nøgle). Rent array af ejendomme: `{ chrNumber, property {
  address, city, postalCode, postalDistrict, municipalityNumber, municipality, startDate,
  lastUpdated }, veterinaryAndFoodAdministration, stableCoordinates: { x, y }, livestockList: {
  livestock: [{ chrNumber, livestockNumber, animalTypeCode, animalType, usageTypeCode, usageType,
  tradeType, tradabilityCode, tradability, livestockSize: [{ text, value }], livestockSizeLastUpdated,
  owner { cvrNumber, name, address, … }, user { … }, startDate, endDate, lastUpdated,
  veterinarianInfo }], livestockCount }, veterinaryEventList: { events, problems } }`. Adapteren
  (`adaptChrLivestock`) rettes til denne form i et parallelt arbejde. Persondata (privatpersoners
  navne/adresser i `owner`/`user`) vises aldrig i UI'en.
- **Live number**: giver **401** for denne nøgle (tilkøb mangler). Svarformen (`{ lassoId,
  updated, isRobinson, isCommerciallyProtected, numbers: [{ phoneNumber, sources, score,
  explanation, callable, obfuscated }] }`) er derfor fortsat kun fra dokumentationen.
- **Kontaktdata og kontaktpersoner** (`GET /apps/contacts/{lassoId}/data`): ikke rørt i dette
  arbejde, fortsat kun antaget ud fra opskriftens korte omtale, se "Skal verificeres" nedenfor.

## Kreditvurdering (Creditsafe)

Se `docs/endpoints-creditsafe.md` for den fulde beskrivelse (`apps/server/src/lasso/creditAdapters.ts`,
komponent `LassoCreditRating`, katalog 17). `GET /data/creditsafe/rating/{cvr}?skipCache=false`
er **ikke kaldt mod API'et** i dette arbejde (et kald koster en kredit, om end Lasso cacher svaret
24 timer pr. organisation). Adapteren er skrevet defensivt efter dokumentationens form; kun
`focus: "risiko"` i `show_company` henter endpointet, og klienten bruger sin egen 50 sekunders
timeout, fordi Creditsafe kan beregne live.

## Kontaktpersoner

```
GET /apps/contacts/{lassoId}/data?phonenumbers=BOOL&emails=BOOL&links=BOOL&contacts=BOOL
```

Henter de valgte oplysninger fra virksomhedens hjemmeside, hvis den er kendt. Kun kontaktpersoner:
`GET /apps/contacts/{lassoId}/data?contacts=true`.

**Ikke afprøvet i dette arbejde.** Antagelser gjort til `LassoContact` og `LassoContactPersons`
(katalog 08):

- `GET …?emails=true&phonenumbers=true&links=true`: antaget som `{ phonenumbers: [...], emails:
  [...], links: [...] }`, hvor hvert element enten er en ren streng eller et objekt med et
  værdifelt. Adapteren (`fillContactInfo`/`adaptContact` i `apps/server/src/lasso/adapters.ts`)
  læser kun det første element af hver liste og er skrevet defensivt.
- `GET …?contacts=true`: antaget som en liste (evt. pakket i `{ contacts | people | persons: [...]
  }`) af objekter med navn, rolle, telefon og e-mail (`adaptContactPersons`).
- `LiveProvider.company` kalder kun `websites()`/`contacts()`, når CVR-svaret ikke selv har
  telefon, e-mail og web. `LassoContact` henter altid begge kilder uafhængigt.

Antagelser gjort til `LassoKeyValueList` (09) og `LassoScoreGauge` (10):

- `accounting.accountant.from` (revisorens tiltrædelsesdato): feltet er ikke i den bekræftede form
  af `GET /{lassoId}`. Udelades helt, når det mangler, i stedet for at vise "—".
- Der findes ingen bekræftet Lasso-kilde til en 0–100 risiko-/kreditscore (Scoremåler, katalog 10).
  `LiveProvider.score` returnerer altid `{ score: null }`.

## Personer (katalog 16)

Læst i docs.lassox.com (`api/people/people`, `api/people/cvrnetwork`), **ikke afprøvet mod en
rigtig nøgle**. Klient: `person`, `personHistory`, `personNetwork`; adaptere i
`apps/server/src/lasso/personAdapters.ts` (alle felter læses defensivt).

Personendpointets ejerfelter (`owner`/`trueOwner`) er derimod bekræftet mod Lassos egen
dokumentationstekst (ikke et live-kald, se `docs/endpoints-ejerskab.md`): `owner` (legale
ejerskaber, personen ejer selv) er et brøk-INTERVAL, samme form som `/owners/legal`; `trueOwner`
(reelle ejerskaber) er et PRÆCIST tal, samme form som `/owners/beneficial`. Det bekræfter
antagelsen, `personAdapters.ts` allerede gjorde.

| Formål | Metode | Endpoint | Bruges af |
|---|---|---|---|
| Person, nuværende roller | GET | `/{lassoId}` (person-ID) | `LassoPersonHead`, `LassoPersonRoles`, `LassoPersonRisk` |
| Person, historik | GET | `/{lassoId}/history` | samme; fejler den, vises kun de nuværende roller |
| Netværk | GET | `/modules/network/{lassoId}` | `LassoPersonNetwork` |
| Navneopslag | GET | `/data/cvr/search?type=person&personStatus=all` | `show_person` med et navn |
| Nyheder om personen | POST | `/modules/news` med `[personens Lasso-ID]` | `LassoNews` med `person` (Paqle spørges ikke for personer) |
| Personens ejerskaber | POST | `/modules/relations/graph` med `ids: [personens Lasso-ID]`, `ingoingDepth: 0` | `LassoOwnershipDiagram` med `person`; afvises person-ID'et (400/404/405/501), bruges ejerrollerne (ét lag) |

Personsidens øvrige sektioner kræver ingen nye kald: stamoplysningerne (`LassoPersonFacts`) læser
`address.value.postalCode`/`postalDistrict`/`municipality.name`/`countryCode` (aldrig `address1`),
`address.secret` (-> "Adressebeskyttet") og `unitNumber` fra `GET /{lassoId}` og afleder resten af
rollerne; historikken (`LassoTimeline` med `person`) afledes af rollernes fra–til og selskabernes
konkurs/tvangsopløsning (`personTimeline` i `packages/spec/src/person.ts`). "År sammen" i netværket
er den længste sammenhængende periode på tværs af de fælles selskaber (`longestPeriodYears`), ikke
summen af overlappene. **Ubekræftet mod API'et:** at `/modules/news` og `/modules/relations/graph`
tager person-ID'er (kun virksomheds-ID'er er afprøvet), og adressefelterne for personer.

Antagne svarformer (uændrede siden 26.09.2026): `GET /{lassoId}` (person) har rollegrupper
(`management`, `board`, `founder`, `owner`, `trueOwner`, `stakeholder`, `otherRoles`) som lister af
selskaber; `/history` pakker hvert element i `{ value, from, to, current }`; `/modules/network/…`
giver `[{ name, unitNo, companyRelation: [...] }]`. Se den tidligere version af denne fil (git-
historikken) for den fulde beskrivelse, hvis adapteren skal genbesøges — den er uændret i dag.

Ikke dækket (findes i designet, artboard 16, men har ingen kendt kilde): PEP, stråmandsindikator
og sanktionslister.

## Revisoruafhængighed (katalog 22)

`LassoAuditorIndependence` har INGEN bekræftet, dedikeret kilde. `LiveProvider.auditorIndependence`
bygger derfor kun på bekræftede data: revisoren fra `accounting.accountant`, kundens egen
ledelse/bestyrelse og ejerkreds, og — hvis revisors eget Lasso-ID kendes — et opslag på
revisionshusets egne personer. En relation vises kun ved et navnesammenfald. Det dækker IKKE
relationer via andre selskaber, historiske tilknytninger eller partnerskabsniveau; det ville kræve
ejergrafen (nu bekræftet, se ovenfor), som denne komponent endnu ikke kalder.

## Ejendomme og BBR (katalog 20)

```
GET /data/ejf/{lassoId}/ownerships/current       (ejerfortegnelsen)
GET /data/bbr/property/summary?bfeNumber={nummer}  (BBR, sti/parameter bekræftet 26.09.2026)
```

`LiveProvider.properties` kalder ejf, leder efter `property`/`ejendom` pr. post med
`matrikelNumber`, `bfeNumber` osv. (`adaptProperties`, `ejfBbrRefs`), og kalder BBR-summary for
hver ejendom, der har et BFE-nummer. **Ikke afprøvet i dette arbejde**: ejf's overordnede
svarform er slet ikke set; feltnavnene i begge svar er ubekræftede gæt.

## Søgning

```
GET /data/cvr/search?query=&type=all&pageSize=20&page=1&extended=false&lookupWeb=true&personStatus=all&companyStatus=active
```

Bekræftet. `lookupWeb`-parameteren var afkortet i den oprindelige note og bør bekræftes mod
dokumentationen.

### Søgning med filtre (Lasso-søgning)

Ligger på **dev3.api.lassox.com** med egen nøgle (`LASSO_SEARCH_API_BASE_URL`,
`LASSO_SEARCH_API_TOKEN`, samme header). Kortlagt 25.09.2026. Oversættelsen til og fra
filterpanelets kriterier: `apps/server/src/lasso/searchFilters.ts`.

```
POST /apps/search/query/prompt  { "Prompt": "Revisorer i Region Midtjylland med mindst 10 ansatte" }   (4–20 s)
-> [ { "filterName": "basic-industry", "fieldName": "industrycode", "operator": "Equal", "values": ["692000"] }, … ]

POST /apps/search/lassoid  { "filters": [ … ], "OrderBy": "employees", "limit": 20 }
-> { "results": ["CVR-1-…", …], "page", "pageSize", "totalPages", "resultsFound", "resultsReturned" }
```

| Felt | filterName / fieldName | Værdier |
|---|---|---|
| Region | geography-region / `BasicInfo.region` | 1 Hovedstaden, 2 Sjælland, 3 Syddanmark, 4 Midtjylland, 5 Nordjylland |
| Kommune | geography-municipality / `BasicInfo.municipalityCode` | Kommunekode, fx 751 Aarhus, 461 Odense |
| Postnummer | geography-postal-code / `BasicInfo.PostalCode` | "8000" |
| Branche | basic-industry / `industrycode` | 6-cifret DB07. Grupper udfoldes til alle koder (+ `fieldNames` med bibrancher) |
| Virksomhedsform | basic-company-type / `BasicInfo.formCode` | A/S 60, ApS 80, IVS 81, I/S 30, K/S 40, P/S 70, enkeltmand 10, fond 90/100, forening 110/115/130/140/150/152 |
| Status | basic-company-status / `BasicInfo.CompanyStatus` | Aktiv, Ophørt, UNDERKONKURS, UNDERFRIVILLIGLIKVIDATION, UNDERTVANGSOPLØSNING |
| Ansatte | basic-employees-value / `employees` | tal |
| Bruttofortjeneste | economy-gross-profit-value / `Financial.Reports[0].GrossProfitLoss.Value` | kroner |
| Årets resultat | economy-net-profit-value / `Financial.Reports[0].ProfitLoss.Value` | kroner |
| Egenkapital | economy-equity-value / `Financial.Reports[0].Equity.Value` | kroner |
| Stiftet | basic-creation-date / `BasicInfo.CreationDate` | ÅÅÅÅ-MM-DD |

- Operatorer: `Equal` (flere værdier = en af), `NotEqual`, `GreaterThan`, `LessThan`, `Between`, `Before`, `After`. Kun strenge sammenligninger.
- `OrderBy`: `employees`, `BasicInfo.name`, `BasicInfo.CreationDate`, `BasicInfo.PostalCode`. Altid stigende. Økonomiske felter giver 500, ukendte felter 400.
- `limit` begrænser antallet. Uden limit: op til 20.000 pr. side med filtre, 100.000 uden.
- Ingen filter for omsætning; firmanavne giver 500 i prompten — dem søger vi med `/data/cvr/search`.
- Filtre i et ukendt format ignoreres uden fejl.

## Overvågningsfeed (katalog 21)

Læst i docs.lassox.com (`api/platform/monitoring`, `api/companies/company-updates`), **ikke
afprøvet mod en rigtig nøgle**. Lasso har intet endpoint, der giver "ændringer i mine overvågede
virksomheder" som ét feed; `LiveProvider.changeFeed` sætter det sammen af tre kald. Klient:
`monitoringJobs`, `monitoringItems`, `companyUpdates`; adaptere `adaptMonitoringJobs`,
`adaptMonitoringItems`, `adaptChangeFeed` i `apps/server/src/lasso/adapters.ts`.

| Formål | Metode | Endpoint | Bruges af |
|---|---|---|---|
| Overvågningsjobs (lister) | GET | `/apps/monitoring/jobs` | `LassoChangeFeed`: finder jobbet med `name` = specens `list` |
| Virksomheder i ét job | GET | `/apps/monitoring/jobs/{JobId}/items?take=500&continuationToken=` | samme; sider gennem `continuationToken` |
| Ændrede virksomheder med historik | GET | `/data/cvr/companies/delta/history?since=&max=&pageSize=100&cToken=` | samme; kun de overvågede ID'er tages med |

**P-enheder, ændringer** (`GET /data/cvr/place/delta?since=…`): en ændringsliste over P-enheder i
et tidsrum, ikke et opslag pr. virksomhed. Egner sig til overvågning, men er ikke koblet på nogen
klientmetode endnu.

Ikke dækket (findes i designet, artboard 21, men har ingen kendt kilde): notifikationspanelet
(kredit, eksport, konto) og indstillinger pr. virksomhed. `NotificationPanel` og `MonitorSettings`
i `packages/ui` er rene UI-komponenter med props; de kalder ingen endpoints. Monitoring-API'et kan
tilføje/fjerne virksomheder (`POST/DELETE /apps/monitoring/jobs/thirdparty/{Provider}/items`), men
det er ikke koblet til "Overvåg"/"Stop overvågning" endnu.

## Skal verificeres

**Fra opstartsproben 27.09.2026 (tilkøb):**

- **Reelle ejere** (`GET /{lassoId}/owners/beneficial`) og **live number**
  (`GET /data/livenumber/{lassoId}`) kræver begge et tilkøb, som denne nøgle ikke har (401 for
  begge i dag). Svarformerne er derfor fortsat kun fra Lassos egen dokumentation, ikke bekræftet
  mod et rigtigt 200-svar; bekræft, når en nøgle med de rette tilkøb er tilgængelig.
- **Skalaen for `observations.score`** (Firmaindsigt, `POST /modules/observations/{lassoId}`):
  feltet læses ind (`ObservationsVM.score`), men 0–100? kredit-lignende? højere er bedre eller
  værre? er ikke dokumenteret. Vises ikke i UI'en, før skalaen kendes.
- **Creditsafe** (`GET /data/creditsafe/rating/{cvr}`) er slet ikke kaldt mod API'et (koster en
  kredit). Specifikt åbent: (1) feltnavne/typer i `current`/`previous` (er `creditMax` et tal
  eller en tekst; er `internationalScore` et bogstav eller et objekt); (2) hvilken statuskode et
  manglende tilkøb giver (401, 403, 402 — kun 401/403 vises som låst i dag); (3) hvilken statuskode
  en virksomhed uden vurdering giver (404, tomt 200 eller andet); (4) om `pdfUrl` kan åbnes direkte
  i browseren, eller kræver `lasso-api-key`-headeren (i så fald skal PDF'en proxies gennem
  serveren); (5) om der sendes et tidsstempel for, hvornår vurderingen blev beregnet; (6) om
  beregningen fortsætter hos Creditsafe, når vi afbryder efter 50 s; (7) `creditCurrency` som
  ISO-kode eller tekst. Se `docs/endpoints-creditsafe.md` for den fulde liste.

**Fra `docs/endpoints-ejerskab.md`:**

- Den præcise rækkefølge/prioritet mellem de fire årsager til en tom `owners`-liste ved reelle
  ejere (`fallbackDescription`, `couldNotIdentify`, `exemptionStatus`, `fallbackType`) er ikke
  selv dokumenteret et sted i kilden.
- Om `"{lassoId}_UNKNOWN"`-knuden i ejergrafen nogensinde selv optræder i `entities`, eller kun
  findes implicit som endepunkt på en `unknownOwnership`-kant.
- `trueOwners`/`trueOwnerships`/`ultimateOwners`/`report` (ejergrafens berigelsesfelter) læses
  endnu ikke af adapteren — kun de felter, der er nødvendige for noder og kanter.

**Fra `docs/endpoints-risiko-nyheder.md`:**

- Om `notAvailable: true`-rækker altid har `outcome: 0`, som i det bekræftede eksempel.
- Hvor mange entiteter der typisk optræder i `relatedObservations` for mindre selskaber end Novo
  Nordisk, så loftet på 12 navneopslag i `LiveProvider.withRelatedNames` er rigeligt.
- Om `relatedPersonName`/`relatedName`/`percentages` (observationer) bruges til noget i praksis.
- Om 14 sekunder (`OBSERVATIONS_BUDGET_MS`) er det rigtige afvejningspunkt for observationskaldet (målt 11,8 s for det største selskab).
- Om der findes flere `provider`-værdier for Lasso News end de tre dokumenterede (VIRK, Ritzau,
  Statstidende), og flere `type`-værdier end de 12 dokumenterede.
- Om `time`/`promotedUntil` på tværs af Lasso News og Paqle altid er sammenlignelige ISO-tidsstempler.

**Fra `docs/endpoints-enheder-kontakt-analyse.md`:**

- Produktionsenhedens `employees`-felt ved kvartalstal (`interval` vs. `count` vs.
  `fullTimeEquivalentCount`) — adapteren prøver `count`, så `fullTimeEquivalentCount`.
- Om der findes flere HTML-tags i regnskabsanalysens `sections`/`text` end `<br/>`, `<p>`, `<ul>`,
  `<li>`, `<b>` (fx overskrifter, tabeller) — `htmlToText` fjerner ukendte tags uden linjeskift.

**Uændret siden tidligere (ingen ny nøgle brugt i dette arbejde):**

- **Fuldt regnskab** (`FinancialStatementsVM`, `LassoIncomeStatement`/`LassoBalanceSheet`/
  `LassoCashFlow`, katalog 19): kun hovedtallene (omsætning, resultat, egenkapital) er bekræftede.
  Alle øvrige linjeposter (`staffCosts`, `otherOperatingCosts`, `ebitda`, `depreciation`,
  `financialItemsNet`, `profitBeforeTax`, `tax`; balancens `intangibleAssets`,
  `tangibleAssets`, `fixedAssetsTotal`, `tradeReceivables`, `otherReceivables`, `cash`,
  `currentAssetsTotal`, `shareCapital`, `retainedEarnings`, `longTermLiabilities`,
  `shortTermLiabilities`; hele pengestrømsopgørelsen) er UBEKRÆFTEDE XBRL-begreb-gæt i
  `adaptFinancialStatements` (`apps/server/src/lasso/adapters.ts`). EBITDA og balancesum har en
  regnet reserve, når intet direkte begreb findes.
- **Samlet gæld** (`FinancialYear.liabilities`, katalog 13): intet regnskab med et ikke-tomt
  gældsbegreb er set endnu; adapteren prøver flere kandidatnavne og summerer kort-/langfristet
  gæld som reserve.
- **Valuations** (`GET /modules/valuations/{lassoId}`): `[]` for de testede virksomheder, formen
  er ukendt, og ingen komponent kalder endpointet.
- **Personer** (katalog 16): hele person-endpointet (roller, historik, netværk) er ikke afprøvet
  mod en rigtig nøgle — kun ejerfelterne (`owner`/`trueOwner`) er bekræftet via Lassos egen
  dokumentationstekst, se ovenfor.
- **Overvågningsfeed** (katalog 21): intet af `monitoringJobs`/`monitoringItems`/`companyUpdates`
  er afprøvet mod en rigtig nøgle.
- **Kontaktdata og kontaktpersoner** (`GET /apps/contacts/{lassoId}/data`, katalog 08): ikke
  afprøvet; svarformen er kun et gæt ud fra opskriftens korte omtale.
- **Ejendomme/BBR** (`GET /data/ejf/{lassoId}/ownerships/current`, katalog 20): ejf's overordnede
  svarform er slet ikke set; kun BBR-summary-endpointets sti/parameter er bekræftet.
- **Tinglysning** (`GET /data/tinglysning/{lassoId}`): dokumenteret, men ingen komponent kalder den.

## Ubekræftet: regnskabets værktøjslinje (katalog 19.1)

`adaptFinancialStatements` (`GET /{lassoId}/reports/advanced`) sætter nu også `scope` (koncern/selskab, samme
valg som nøgletallene), og læser defensivt fra den nyeste rapport:

- revisorpåtegning: `auditorOpinion`, `auditorsReport.type`, `auditorReport.opinion` eller `audit.opinion` (tekst)
- PDF-link: `pdfUrl`, `documentUrl`, `pdf`, `links.pdf` eller `reportUrl` (kun http/https)

Ingen af felterne er set i et rigtigt svar. Mangler de, viser værktøjslinjen hverken påtegning eller "Hent PDF".
Det andet scope (`alternate`, fx koncernregnskabet ved siden af selskabets) og periodetyperne (`periods`: halvår,
kvartal) findes kun i demodata; i live er "Koncern"/"Selskab" dæmpet med forklaring, og halvår/kvartal er dæmpet
med "Kun årsregnskab indberettet".

## Ubekræftet: matrikelgeometri og revisorhistorik (katalog 20.2, 22/26e.8)

`PropertyVM.geometry` (matrikelpolygon og bygningsomrids i lokale meter) og `AuditorIndependenceVM.history`
(revisorer over tid) findes kun i demodata. En live-kilde (Datafordeleren MAT/BBR for geometri, CVR-historik
for revisorskift) er ikke bekræftet; uden data viser ejendomskortet "Intet matrikelkort tilgængeligt", og
revisorhistorikken udelades.

## Ubekræftet: bibrancher, fravalgt revision og kapital (katalog 28.7)

`companyDetailsExtras` i `adapters.ts` (kaldt fra `adaptCompany`) læser defensivt `altIndustry1`–`altIndustry3`
(eller `altIndustries`) som `{ code, text }` eller tekst, `accounting.auditExempt`/`auditExemption` (true, "ja",
"fravalgt") og `contributedCapital.amount`/`contributedCapital`/`capital.amount` med valuta og `capitalClasses`.
Felterne kommer efter Paper-overlinjen "companies/company-details" og er ikke set i et rigtigt svar; mangler de,
udelades rækkerne (ingen "Ingen registreret" uden grundlag).
