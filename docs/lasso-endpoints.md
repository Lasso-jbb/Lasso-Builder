# Lasso API-endpoints

Oversigt over de Lasso-endpoints, Lasso-Builder anvender. `{lassoId}` er et
Lasso-ID for en virksomhed eller person. Base-URL er `https://api.lassox.com`
og hentes fra miljøvariablen `LASSO_API_BASE_URL`. Klienten ligger i `apps/server/src/lasso/client.ts`.

Autentificering: API-nøglen sendes i headeren `lasso-api-key` (bekræftet mod
api.lassox.com 24.09.2026; Basic, Bearer og query-parametre giver 401).
Nøglen ligger i `LASSO_API_TOKEN` på Railway, aldrig i koden. Se `.env.example`.

Fejlsvar har formen `{ "errorMessage": string, "httpStatusCode": number, "errorCode": number }`.

## Virksomhedsdata

| Formål            | Metode | Endpoint                                        |
|-------------------|--------|-------------------------------------------------|
| CVR (stamdata)    | GET    | `/{lassoId}`                                    |
| Regnskab          | GET    | `/{lassoId}/reports/advanced`                   |
| Tinglysning       | GET    | `/data/tinglysning/{lassoId}`                   |
| Ejerfortegnelsen  | GET    | `/data/ejf/{lassoId}/ownerships/current`        |
| Websites          | GET    | `/data/websites/{lassoId}`                      |
| Valuations        | GET    | `/modules/valuations/{lassoId}`                 |
| Observationer     | GET    | `/modules/observations/{lassoId}`               |
| Ejergraf          | POST   | `/modules/relations/graph` (se "Ubekræftet" nedenfor)            |

### Bekræftede svarformer (24.09.2026)

- `GET /{lassoId}`: `{ lassoId, cvr, name, status, lifeTime: { from, to }, address: { address1, postalCode,
  postalDistrict, municipality: { name, code } }, form: { shortDescription }, industry: { text, code },
  employees: { count, fullTimeEquivalentCount, interval }, accounting: { accountant }, management: { ceo, members },
  board: { chairman, members, alternates }, ownership: { owners: [{ name, lassoId, type, ownership: { from, to },
  voteRights: { from, to } }] }, otherParticipants, stakeholders, … }`. Ejerandele er brøker (0.25–0.3332 = 25–33,32 %).
- `GET /{lassoId}/reports/advanced`: liste af regnskaber `{ lassoId, period: { from, to }, reportYear, publicationTime,
  data: { company?, group? } }`. `company`/`group` har `facts: { incomeStatement, statementOfFinancialPosition, … }`,
  hvor hver sektion er et XBRL-træ: `{ facts: { [begreb]: node }, abstract, label }` og bladene er
  `{ value, unit, xbrlType, balance, label, source }`. Begreberne er camelCase (`revenue`, `grossProfit`, `profitLoss`,
  `equity`, `averageNumberOfEmployees`). Gamle regnskaber (før XBRL) har tomme `facts`.
- `GET /data/websites/{lassoId}`: `{ cvr, urls: [{ url, verifiedAt }] }`.
- `GET /modules/valuations/{lassoId}`: `[]` for de testede virksomheder; formen er endnu ukendt.

## Ubekræftet

Ingen API-nøgle var tilgængelig ved dette arbejde, og docs.lassox.com har (pr. 26.09.2026)
ingen offentlig side for `/modules/observations`; `module-apis/generalinfo` beskriver kun,
at moduler findes, og henviser til feedback@lassox.com for udokumenterede moduler.

- `GET /modules/observations/{lassoId}` (bruges af `LassoRiskObservations`, katalog 17):
  formen er ANTAGET som et array (evt. pakket i `{ observations | items | results: [...] }`)
  af objekter med et titelfelt (`title`/`headline`/`summary`/`text`/`message`/`name`/`description`),
  et alvorsfelt (`severity`/`score`/`riskScore`/`level`/`importance`/`category`, enten et tal
  0–100 eller en tekst som "high"/"vigtig"/"info"), et valgfrit beskrivelsesfelt og et datofelt
  (`date`/`observedAt`/`createdAt`/`eventDate`/`occurredAt`/`reportedAt`). Adapteren
  (`adaptObservations` i `apps/server/src/lasso/adapters.ts`) er skrevet defensivt: ukendte
  feltnavne giver blot 0 observationer i stedet for en fejl. Bekræft med en rigtig nøgle,
  og ret feltlisten i adapteren, hvis den rigtige form afviger.
- Revisoruafhængighed (`LassoAuditorIndependence`, katalog 22) har INGEN bekræftet, dedikeret
  kilde. `LiveProvider.auditorIndependence` bygger derfor kun på bekræftede data: revisoren fra
  `accounting.accountant` (se `GET /{lassoId}` ovenfor), kundens egen ledelse/bestyrelse og
  ejerkreds, og — hvis revisors eget Lasso-ID kendes — et opslag på revisionshusets egne
  personer (samme `GET /{lassoId}`-endpoint kaldt med revisors ID). En relation vises kun ved
  et navnesammenfald mellem de to. Det dækker IKKE relationer via andre selskaber, historiske
  tilknytninger eller partnerskabsniveau; det ville kræve Lassos ejer-/relationsgraf
  (`POST /modules/relations/graph`, se ovenfor), som denne komponent endnu ikke kalder, fordi
  dens svarform heller ikke er bekræftet. `unavailableReason` i `AuditorIndependenceVM`
  beskriver altid denne begrænsning til brugeren.

## Søgning

```
GET /data/cvr/search
  ?query=SØGEORD
  &type=all
  &pageSize=20
  &page=1
  &extended=false
  &lookupWeb=true
  &personStatus=all
  &companyStatus=active
```

Bemærk: `lookupWeb`-parameteren var afkortet i den oprindelige note og skal
bekræftes mod dokumentationen.

## Søgning med filtre (Lasso-søgning)

Ligger på **dev3.api.lassox.com** med egen nøgle (`LASSO_SEARCH_API_BASE_URL`, `LASSO_SEARCH_API_TOKEN`, samme header).
Kortlagt 25.09.2026. Oversættelsen til og fra filterpanelets kriterier: `apps/server/src/lasso/searchFilters.ts`.

```
POST /apps/search/query/prompt  { "Prompt": "Revisorer i Region Midtjylland med mindst 10 ansatte" }   (4–20 s)
-> [ { "filterName": "basic-industry", "fieldName": "industrycode", "operator": "Equal", "values": ["692000"] },
     { "filterName": "geography-region", "fieldName": "BasicInfo.region", "operator": "Equal", "values": ["4"] },
     { "filterName": "basic-employees-value", "fieldName": "employees", "operator": "GreaterThan", "values": ["9"] },
     { "filterName": "ContactConfiguration", "fieldName": "ContactRoles", "operator": "ContactConfiguration", "values": [], "config": {…} } ]

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
- `OrderBy`: `employees`, `BasicInfo.name`, `BasicInfo.CreationDate`, `BasicInfo.PostalCode`. Altid stigende; ingen retningsparameter fundet.
  Økonomiske felter giver 500, ukendte felter 400 ("Cannot order by …, as the field does not exist").
- `limit` begrænser antallet (sætter også `resultsFound` til limit). Uden limit: op til 20.000 pr. side med filtre, 100.000 uden.
- Ingen filter for omsætning (prompten "nettoomsætning over 100 mio." giver 500 og "omsætning" oversættes til bruttofortjeneste).
  Firmanavne giver også 500 i prompten; dem søger vi med `/data/cvr/search`.
- Filtre i et ukendt format ignoreres uden fejl.

## Ubekræftet

- **Samlet gæld** (`FinancialYear.liabilities`, brugt af `LassoStackedBarChart` og `LassoShareBars`, katalog 13):
  regnskabsformen bekræfter kun `revenue`, `grossProfit`, `profitLoss`, `equity` og
  `averageNumberOfEmployees` (se ovenfor). For gæld er der endnu ikke set et regnskab med
  et ikke-tomt gældsbegreb, så adapteren (`apps/server/src/lasso/adapters.ts`, `adaptFinancials`)
  forsøger, i rækkefølge: ét samlet begreb (`liabilities`, `liabilitiesAndProvisions`,
  `totalLiabilities`), ellers kort- og langfristet gæld lagt sammen
  (`currentLiabilities`/`shortTermLiabilities` + `nonCurrentLiabilities`/`longTermLiabilities`).
  Findes ingen af delene, er `liabilities` `undefined`, og de to komponenter viser deres
  tomme tilstand. Bekræft mod et rigtigt regnskab med disse begreber, når adgang er der.
- **Fuldt regnskab** (`FinancialStatementsVM`, brugt af `LassoIncomeStatement`, `LassoBalanceSheet`
  og `LassoCashFlow`, katalog 19): samme bekræftede endpoint (`GET /{lassoId}/reports/advanced`),
  genbrugt af `LiveProvider.financialStatements` (klientens cache undgår et dobbeltkald til
  `financials`). Hovedtallene (omsætning/bruttofortjeneste, resultat, egenkapital, balancesum
  som egenkapital+gæld) er de samme bekræftede/afledte tal som `FinancialYear`. Alle øvrige
  linjeposter (`staffCosts`, `otherOperatingCosts`, `ebitda`, `depreciation`, `financialItemsNet`,
  `profitBeforeTax`, `tax`; balancens `intangibleAssets`, `tangibleAssets`, `fixedAssetsTotal`,
  `tradeReceivables`, `otherReceivables`, `cash`, `currentAssetsTotal`, `shareCapital`,
  `retainedEarnings`, `longTermLiabilities`, `shortTermLiabilities`; hele pengestrømsopgørelsen)
  er UBEKRÆFTEDE XBRL-begreb-gæt i `adaptFinancialStatements` (`apps/server/src/lasso/adapters.ts`).
  De forsøger flere kendte XBRL-navne (fx `EmployeeBenefitsExpense`, `DepreciationAmortisationAndImpairment…`,
  `ProfitLossFromOrdinaryActivitiesBeforeTax`, `CashFlowsFromUsedInOperatingActivities`) og falder
  til `null` ("—" i UI'en), når begrebet ikke findes, i stedet for at fejle. EBITDA og balancesum
  har en regnet reserve, når intet direkte begreb findes (bruttofortjeneste − personale − andre
  drift; egenkapital + gæld). Pengestrømsopgørelsen medtages kun, når mindst ét
  pengestrøms-specifikt begreb er fundet (klasse B skal ikke aflægge den); ellers viser
  `LassoCashFlow` "Pengestrømsopgørelse er ikke indberettet." Bekræft alle disse feltnavne mod
  rigtige regnskaber, når adgang er der.

## Nyheder

```
GET /data/paqle/{lassoId}/news?cToken=…
```

Kilde: https://docs.lassox.com/data-apis/paqle/ (læst med WebFetch 26.09.2026, ikke afprøvet mod en rigtig nøgle). Svaret er en
pakket liste, ikke et array: `{ news: [ { headline, content, url, time, storyId, type: "Paqle", provider, providerData:
{ sourceName, published, headline: [{ text, highlight }], extract: [{ text, highlight }] }, uniqueId } ], continuationToken }`.
`cToken` sat til `continuationToken` fra forrige svar giver næste side (op til 100 pr. side). Adapteren (`adaptNews`) læser
`headline`, `content`, `url`, `time`, `provider(Data.sourceName)` og falder tilbage til andre feltnavne, hvis formen afviger.

## Reelle ejere (beneficial owners) — Ubekræftet

Opskriften angiver endpointet `GET /{lassoId}/owners/beneficial`, som IKKE er bekræftet mod en rigtig nøgle. Lassos egen
dokumentation (https://docs.lassox.com/module-apis/ultimateowner/, læst med WebFetch 26.09.2026) beskriver i stedet en
funktion "Ultimate Owners" på `GET /modules/ultimateowners/{lassoId}`, der returnerer en liste af reelle ejere med:

- `name`, `identifier`, `type` ("PERSON" eller "VIRKSOMHED")
- `totalOwnerPercentageMin`/`totalOwnerPercentageMax` og tilsvarende for stemmer, som samlet indirekte andel i procent
  (ikke brøk, modsat `ownership.owners` i det almindelige virksomhedssvar)
- `paths[]`: én eller flere kæder af mellemliggende selskaber med deres direkte ejerandel
- et element med `type: "UNKNOWN"`, når CVR ikke kan følge hele ejerskabet til en person

Klienten kalder den sti, opskriften angiver (`{lassoId}/owners/beneficial`), men adapteren (`adaptBeneficialOwnership` i
`apps/server/src/lasso/adapters.ts`) er bygget defensivt ud fra denne dokumenterede form: alle felter læses med `at()`/`pick()`
og en lang liste af kandidatnavne, og komponenten viser "Ikke oplyst"/tom tilstand, hvis noget mangler. Kæde-teksten
("via X ApS, 100 %" / "via 2 led, X ApS") er et bedste bud ud fra `paths[0]` og bør efterses, når et rigtigt svar er set.

## Kontaktpersoner

```
GET /apps/contacts/{lassoId}/data?phonenumbers=BOOL&emails=BOOL&links=BOOL&contacts=BOOL
```

Henter de valgte oplysninger fra virksomhedens hjemmeside, hvis den er kendt.
Kun kontaktpersoner:

```
GET /apps/contacts/{lassoId}/data?contacts=true
```

## Ubekræftet

Antagelser gjort til `LassoContact` og `LassoContactPersons` (katalog 08, node 9SX-0/I6B-0):

- `GET /apps/contacts/{lassoId}/data?emails=true&phonenumbers=true&links=true`: svarformen er IKKE
  bekræftet ud over det, opskriften nævner. Antaget som `{ phonenumbers: [...], emails: [...], links: [...] }`,
  hvor hvert element enten er en ren streng eller et objekt med et værdifelt (`number`/`value`/`phone`
  for telefon, `email`/`value`/`address` for e-mail). Adapteren (`fillContactInfo`/`adaptContact` i
  `apps/server/src/lasso/adapters.ts`) læser kun det første element af hver liste og er skrevet
  defensivt: en anden form giver blot ingen ekstra kontaktoplysning, ikke en fejl.
- `GET /apps/contacts/{lassoId}/data?contacts=true` (kontaktpersoner): svarformen er IKKE bekræftet.
  Antaget som en liste (evt. pakket i `{ contacts | people | persons: [...] }`) af objekter med
  `name`/`fullName`/`navn`, `role`/`title`/`jobTitle`/`position`/`department`/`rolle`,
  `phone`/`phoneNumber`/`telephone`/`telefon` og `email`/`emailAddress` (`adaptContactPersons`).
  Personer uden navn springes over; en anden form giver en tom liste.
- `LiveProvider.company` kalder kun `websites()`/`contacts()`, når CVR-svaret (`GET /{lassoId}`)
  ikke selv har telefon, e-mail og web (se `fillContactInfo`), så `LassoCompanyHead` og
  `LassoKeyValueList` (variant "company") ikke viser "—" unødigt. `LassoContact` henter altid
  begge kilder, uafhængigt af de øvrige komponenter, og sætter kildelinjen til "CVR", når
  CVR-svaret selv havde telefon eller e-mail, ellers "Virksomhedens hjemmeside".

Antagelser gjort til `LassoKeyValueList` (katalog 09) og `LassoScoreGauge` (katalog 10):

- `accounting.accountant.from` (revisorens tiltrædelsesdato, brugt som "Seneste revisorskift"): feltet er ikke i den
  bekræftede form af `GET /{lassoId}` ovenfor. Antagelsen fandtes allerede i `adaptOwnership` (`OwnershipVM.auditor.from`);
  `LassoKeyValueList` genbruger den og udelader rækken helt, når feltet mangler, i stedet for at vise "—".
- Der findes ingen bekræftet Lasso-kilde til en 0–100 risiko-/kreditscore (katalog 10, "Scoremåler"). `LiveProvider.score`
  returnerer altid `{ score: null }` ("ikke oplyst"); `DemoProvider.score` giver eksempeldata. Skiftes til en rigtig
  kilde (fx et Creditsafe-modul), når en sådan bekræftes.
- `period.from` og `publicationTime` i `GET /{lassoId}/reports/advanced` er derimod bekræftede felter (se ovenfor) og
  bruges direkte til "Regnskabsperiode" og "Regnskab udgivet".

## BBR

```
GET /data/bbr/property/summary?propertynumber={ejendomsnummer}&municipality={kommunekode}
```

Eksempel: `propertynumber=79972&municipality=157`.

## Ubekræftet (katalog 20: P-enheder, ejendomme/BBR, CHR)

Ingen af de tre nedenstående er slået op mod api.lassox.com eller docs.lassox.com
under dette arbejde (netadgang til docs.lassox.com var ikke tilgængelig i denne
session). Alle adaptere er skrevet defensivt (`at()`/`str()`/`num()`, ingen
feltnavn kastes en fejl, hvis de mangler), så et forkert gæt giver "Ikke
oplyst"/tom-tilstand i UI'en frem for en fejl. Næste session med adgang til
docs.lassox.com bør bekræfte eller rette disse, og fjerne denne note, når de er
bekræftet.

- **Produktionsenheder**: ingen ny endpoint tilføjet. `LiveProvider.productionUnits`
  genbruger `GET /{lassoId}` og leder i svaret efter `mainUnit`/`productionUnit`/
  `hovedenhed` (hovedenheden) og `productionUnits`/`produktionsenheder`/`units`/
  `secondaryUnits`/`establishments` (øvrige enheder), se `adaptProductionUnits` i
  `apps/server/src/lasso/adapters.ts`. Ingen bekræftet testvirksomhed med flere
  P-numre er set; hvis feltet ikke findes i det rigtige svar, bliver listen tom
  og komponenten viser sin tom-tilstand.
- **Ejendomme, BBR**: `LiveProvider.properties` kalder den allerede bekræftede
  `GET /data/ejf/{lassoId}/ownerships/current` (ejerfortegnelsen) og leder efter
  `property`/`ejendom` pr. post med `matrikelNumber`, `bfeNumber`,
  `propertyNumber`/`municipalityCode` osv. (`adaptProperties`, `ejfBbrRefs` i
  `adapters.ts`). Findes `propertyNumber` og `municipalityCode`, kaldes den
  allerede bekræftede BBR-endpoint (`bbrSummary`) for bygninger og arealer
  (`mergeBbr`). Feltnavnene i begge svar (ejf og BBR-summary) er UBEKRÆFTEDE
  gæt; ejf's overordnede form er slet ikke set endnu.
- **CHR (husdyr)**: intet endpoint fundet. `LassoClient.chr(lassoId)` peger
  gættet på `GET /modules/chr/{lassoId}` (samme mønster som `modules/valuations`
  og `modules/observations`), men `LiveProvider.livestock` kalder den IKKE — den
  returnerer altid en tom `LivestockVM` (ingen besætninger, ingen hændelser), så
  `LassoLivestock` viser sin tom-tilstand for alle rigtige virksomheder, indtil
  endpointet er bekræftet og koblet på i `adaptLivestock`. `DemoProvider` giver
  fuldt eksempel (landbrugsvirksomheden "Eksempel Landbrug I/S", CVR 99000013).
## Ubekræftet

### Ejergraf: `POST /modules/relations/graph` (ejerdiagrammet, katalog 14)

Klient: `LassoClient.relationsGraph`, adapter: `adaptOwnershipGraph` i `apps/server/src/lasso/adapters.ts`.
Svarformen er IKKE bekræftet: der var ingen API-nøgle under udviklingen, og docs.lassox.com
(module-apis/ownergraph) kunne ikke hentes (26.09.2026). Adapteren er derfor bygget defensivt.

Body (fra kendt brug):

```
{ "ids": ["CVR-1-12345678"], "relationTypes": ["ownership"], "enrichments": ["companyinfo"],
  "ingoingDepth": 2, "outgoingDepth": 1, "onDate": "2026-09-25" }      (onDate udelades for i dag)
```

Antaget svar (alle felter valgfrie, navne slås op uden hensyn til store/små bogstaver):

- Beholder: selve svaret, `graph` eller `data`.
- Noder: `nodes` | `entities` | `vertices` | `participants` | `items`, som liste eller som map `{ [lassoId]: node }`.
  Pr. node: `lassoId` | `id`, `name`, `type` | `entityType` (indeholder "person" for personer; ellers selskab;
  `CVR-3-`/`CVR-4-`-id'er uden type regnes som personer). Berigelsen `companyinfo` læses direkte på noden eller
  under `companyInfo` | `enrichments.companyinfo` | `data` | `entity` | `properties`: `cvr`, `form.shortDescription`,
  `status`, `country`/`countryCode`, `registrationNumber`, `equity`.
- Kanter: `edges` | `relations` | `links` | `relationships` | `ownerships` (eller svaret er selv en liste).
  Retning ejer -> ejet: `from` | `source` | `owner` | `parent` -> `to` | `target` | `owned` | `company` | `child`,
  som id eller indlejret objekt (`{ lassoId, name, type }`). Relationer med en type, der ikke handler om ejerskab
  (`relationType`/`type`), springes over.
- Andel: `ownership` | `share` | `ownershipShare` | `percentage` | `interval` på kanten eller under `properties`,
  som brøk-interval `{ from: 0.25, to: 0.3332 }` (samme form som `GET /{lassoId}`), tal (brøk eller procent) eller
  tekst "25–33,32 %". Stemmer: `voteRights` | `votingRights`. Datoer: `validFrom`/`since`/`startDate` og
  `validTo`/`until`/`endDate` (et ejerskab med slutdato vises som historisk).

Normaliseret til `OwnershipGraphVM` (`packages/spec/src/models.ts`): `nodes { id, name, kind person|company, cvr?, form?,
status?, country?, registrationNo?, equity?, root? }`, `edges { from, to, share? [min, max] i procent, votes?, classes?,
since?, until? }`. Svarer endpointet 400/404/405/501, falder `LiveProvider` tilbage til de direkte ejere fra
`GET /{lassoId}` (ét lag, med en note i visningen). `/api/debug/lasso/...` kan kun GET; formen tjekkes med
`client.tryRequest("POST", "modules/relations/graph", body)`, når der er en nøgle, og adapteren rettes til.

## Bekræftet af Lasso 26.09.2026 (metode og sti; svarformerne er endnu ikke set)

| Formål | Metode | Endpoint | Bruges af |
|---|---|---|---|
| Ejergraf | POST | `/modules/relations/graph` med `{ ids, relationTypes: ["ownership"], enrichments: ["companyinfo"], ingoingDepth, outgoingDepth, onDate? }` | `LassoOwnershipDiagram` (14) |
| Reelle ejere | GET | `/{lassoId}/owners/beneficial` | `LassoBeneficialOwners` (11) |
| Risikoobservationer | **POST** | `/modules/observations/{lassoId}` (klienten sender en tom body `{}`) | `LassoRiskObservations` (17) |
| BBR for én ejendom | GET | `/data/bbr/property/summary?bfeNumber=12345` | `LassoProperties` (20). BFE-nummeret læses fra ejerfortegnelsen (`ejfBbrRefs`). |
| P-enheder, ændringer | GET | `/data/cvr/place/delta?since=2021-02-01&max=2021-02-02&pageSize=50` | Ikke brugt endnu, se nedenfor |

**P-enheder:** `place/delta` er en ændringsliste over P-enheder i et tidsrum, ikke et opslag pr. virksomhed. Den egner sig til overvågning (21), men ikke til at vise én virksomheds P-enheder. `LassoProductionUnits` læser derfor stadig P-enhederne fra CVR-svaret `GET /{lassoId}` (ubekræftede feltnavne, se "Ubekræftet"). Findes der et opslag pr. virksomhed eller pr. P-nummer, skal det bruges i stedet.

Når der er en API-nøgle, skal svarformerne tjekkes. POST-endpoints kan ikke tjekkes via `/api/debug/lasso/...` (kun GET), så brug `client.tryRequest("POST", …)`.

## Ubekræftet: personer (katalog 16, personsiden)

Læst i docs.lassox.com med WebFetch 26.09.2026 (`api/people/people` og `api/people/cvrnetwork`), IKKE afprøvet mod en
rigtig nøgle. Klient: `LassoClient.person`, `.personHistory`, `.personNetwork`; adaptere i
`apps/server/src/lasso/personAdapters.ts` (alle felter læses defensivt med `at()`/`str()`; ukendte former giver tomme lister).

| Formål | Metode | Endpoint | Bruges af |
|---|---|---|---|
| Person, nuværende roller | GET | `/{lassoId}` med et person-ID (`CVR-3-…`) | `LassoPersonHead`, `LassoPersonRoles`, `LassoPersonRisk` |
| Person, historik (fra–til) | GET | `/{lassoId}/history` | samme; fejler den, vises kun de nuværende roller |
| Netværk | GET | `/modules/network/{lassoId}` | `LassoPersonNetwork` |
| Navneopslag | GET | `/data/cvr/search?type=person&personStatus=all` | `show_person` med et navn |

Antagne svarformer:

- `GET /{lassoId}` (person): `{ lassoId, unitNumber, name, type: "PERSON", address: { secret, value: { address1, postalCode,
  postalDistrict, municipality: { name, code } } }, management, board, founder, owner, trueOwner, stakeholder, otherRoles,
  lastUpdated }`. Hver rollegruppe antages at være en LISTE af selskaber (dokumentationen viser kun ét element pr. gruppe;
  adapteren tager også ét objekt eller et objekt med lister). Et selskab: `{ lassoId, cvr, name, status, form: { code,
  shortDescription }, lifeTime: { from, to }, type: "VIRKSOMHED", role: { mainType, type, originalType, attributes } }`;
  ejere har desuden `ownership: { from, to }` (brøk) og `voterights`. Hemmelig adresse (`address.secret`) giver ingen by.
- `GET /{lassoId}/history`: samme grupper, men hvert element er pakket: `{ value: { …selskab… }, from, to, current }`.
  `from`/`to` på indpakningen er rollens periode; `lifeTime.to` på selskabet bruges som dato for ophør/konkurs
  (markøren i tidsbåndet). Historik og nuværende flettes: historikken vinder, nuværende roller den mangler lægges til.
- Rolletype udledes af gruppen, `role.mainType`/`originalType` og rolleteksten (`roleKind` i `packages/spec/src/person.ts`):
  DIREKTION -> direktion, BESTYRELSE -> bestyrelse, REGISTER/EJER og `trueOwner` -> ejer (sidstnævnte som "Reel ejer").
- Selskabsstatus: `NORMAL` vises som "Aktiv"; tekster med "konkurs" tælles som konkurs og "tvangs" som tvangsopløsning
  (`personRisk`). Der er ingen dato for, hvornår et selskab kom UNDER konkurs; kun `lifeTime.to`, når det er ophørt.
- `GET /modules/network/{lassoId}`: `[{ name, unitNo, companyRelation: [{ companyName, cvr, status, currentRoles: [],
  overlaps: [{ from, to, theirRoles: [], ownRoles: [] }] }] }]`. Personens Lasso-ID antages at være `CVR-3-{unitNo}` og
  selskabets `CVR-1-{cvr}`. Overlap i år = summen af `overlaps` (til i dag, når `to` er null). En relation regnes for aktiv,
  når `currentRoles` ikke er tom, eller et overlap ikke har `to`.
- Søgning: personerne antages at ligge under `people.results[]` med `lassoId` (`CVR-3-…`) og `name`, samme form som
  `companies.results[]`.

Ikke dækket (findes i designet, artboard 16, men har ingen kendt kilde): PEP, stråmandsindikator og sanktionslister.
