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
| Ejerstruktur      | GET    | Se dokumentation: https://docs.lassox.com/module-apis/ownergraph/ |

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
