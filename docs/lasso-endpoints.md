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

## Kontaktpersoner

```
GET /apps/contacts/{lassoId}/data?phonenumbers=BOOL&emails=BOOL&links=BOOL&contacts=BOOL
```

Henter de valgte oplysninger fra virksomhedens hjemmeside, hvis den er kendt.
Kun kontaktpersoner:

```
GET /apps/contacts/{lassoId}/data?contacts=true
```

## BBR

```
GET /data/bbr/property/summary?propertynumber={ejendomsnummer}&municipality={kommunekode}
```

Eksempel: `propertynumber=79972&municipality=157`.

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

