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

```
POST /apps/search/prompt     { "Prompt": "revisorer i Region Midt med over 10 ansatte" }  -> liste af filtre
POST /apps/search/lassoid    { "filters": [ …filtrene fra prompt… ], "OrderBy": "<FieldName>" }
```

Afprøvet mod api.lassox.com 25.09.2026:

- `/apps/search/lassoid` virker. Svar: `{ results: ["CVR-1-10000009", …], page, pageSize, totalPages, resultsFound, resultsReturned }`.
  Med tomme filtre: alle 2.194.337 virksomheder, 100.000 pr. side (tager et par sekunder).
- Filtre i et ukendt format ignoreres uden fejl, og det samme gør et ukendt `OrderBy`. `filters` skal være en liste (et objekt giver 500).
- `/apps/search/prompt` giver 404 på api.lassox.com, uanset sti og metode. Den ligger på **dev3.api.lassox.com** og kræver
  en anden nøgle. Begge søge-endpoints kaldes derfor mod `LASSO_SEARCH_API_BASE_URL` (standard `https://dev3.api.lassox.com`)
  med `LASSO_SEARCH_API_TOKEN` i samme header. Når nøglen er sat, logger opstarten svarets form (`[lasso-probe] search/prompt`).
- Parameteren til sidestørrelse er ukendt.

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
