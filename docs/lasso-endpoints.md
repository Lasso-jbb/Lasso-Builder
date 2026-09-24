# Lasso API-endpoints

Oversigt over de Lasso-endpoints, Lasso-Builder anvender. `{lassoId}` er et
Lasso-ID for en virksomhed eller person. Base-URL er `https://api.lassox.com`
og hentes fra miljøvariablen `LASSO_API_BASE_URL`.

Credentials ligger i miljøvariablerne `LASSO_API_USERNAME` og
`LASSO_API_PASSWORD` (sat på Railway, aldrig i koden). Se `.env.example`.

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
