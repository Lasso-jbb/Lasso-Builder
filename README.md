# Lasso-Builder

MVP af Lasso MCP: Lassos data om danske virksomheder som MCP-server, hvor svarene tegnes i Lassos designsprog direkte i Claude og ChatGPT (MCP Apps) og kan gemmes som delte Lasso-sider.

## Arkitektur

```
packages/spec   Den deklarative visnings-spec, kriterier (én fælles operatorliste),
                komponentkatalog og datamodeller. Ren TypeScript, delt af alle.
packages/ui     Komponentkataloget i React. Kender kun spec + data og kalder aldrig API'er.
apps/view       Render-appen: én HTML-fil (Vite + singlefile). Kører som MCP App (ui://)
                og som delt side (/v/:org/:slug).
apps/server     Tyndt serverlag: MCP-server (Streamable HTTP), Lasso-datalag,
                gemte visninger i Postgres. Det er kun dette lag, der skiftes ved Azure.
docs/           Endpoints, designsprog og skærmbilleder.
```

Modellen skriver aldrig HTML. Den sender en JSON-spec, og Lassos kode henter data og tegner. Data går uden om modellen: tool-resultatet giver modellen en kort tekst, mens datasættet ligger i `_meta` til appen.

### MCP-tools

| Tool | Bruges til |
|---|---|
| `search_companies` | Målgrupper og lister med kriterier. Vises som tabel med redigerbart filterpanel. |
| `show_company` | Én virksomhed (CVR, Lasso-ID eller navn). `question` (brugerens spørgsmål ordret, højst 300 tegn): serveren bygger en hel side omkring svaret, med svar-elementet først og data afgrænset til spørgsmålet (nøgletal, roller, år) og kontekst fra hele kataloget (`docs/portal.md`, "Spørgsmålet styrer formen"). `metrics` (højst 5): nøgletal, modellen har genkendt i spørgsmålet. `focus` (overblik, oekonomi, regnskab, ejerskab, ledelse, risiko, historik, kontakt) kun ved et generelt spørgsmål. `chart_metric`, `years` til fokus-siderne; `sections` er forældet. Linket (`/k/`) åbner samme side. |
| `show_person` | Én person fra CVR (navn eller `CVR-3-…`). `question` som ved `show_company` (fx "sidder X i bestyrelser" → kun bestyrelsesposterne). Ved et generelt spørgsmål `focus`: `overblik` (standard: aktive roller, stamoplysninger, netværk, risiko, seneste historik, ejede selskaber), `roller` (alle roller som tidsbånd), `netvaerk` (hvem personen sidder sammen med), `ejerskab` (ejede selskaber med andel og ejerdiagram), `risiko` (konkurser og tvangsopløsninger med forløbet), `historik` (rolleskift og nyheder). Serveren henter kun det, siden viser; linket (`/p/`) åbner samme fokus og spørgsmål. |
| `render_view` | Fri komposition til sammenligninger og oversigter. |
| `save_view` | Gemmer specen og giver et link. Samme adresse opdateres, versioner bevares. |
| `save_page` | Gemmer én virksomhed eller person (CVR, Lasso-ID eller navn) på brugerens egen liste, med valgfri note og focus. Gemmes den igen, flyttes den øverst. |
| `list_saved_pages` | Viser brugerens gemte sider (nyeste først) som Lasso-visning med åbn og fjern; tekstkortet har et signeret link pr. side. |
| `remove_saved_page` | Fjerner en side fra listen (Lasso-ID, CVR eller navnet på en gemt side). |
| `resolve_view` | Kun for appen: henter data ved drill-down, filterændring og opdatering. |

### Ruter

| Rute | |
|---|---|
| `/mcp` | MCP-endpoint. Kræver `MCP_ACCESS_KEY` (eller en brugernøgle fra `MCP_USER_KEYS`) som `?key=`, `/mcp/<key>`, `x-api-key` eller Bearer. |
| `/v/:org/:slug` | Delt side med friske data. |
| `/k/:cvr` | Interaktiv virksomhedsvisning fra et signeret link, som `show_company` giver, med samme fokus (`f=`) og spørgsmål (`q=`, og modellens nøgletal som `qm=`). Friske data ved hver visning; udløber efter `LINK_TTL_DAYS` (30). Signeres med `LINK_SECRET`; links uden `q` fra før er stadig gyldige. |
| `/p/:id` | Personside fra et signeret link, som `show_person` giver, med samme personfokus (`f=`, udeladt for overblik) og spørgsmål (`q=`). Samme nøgle og udløb som `/k/`. |
| `/e/:lassoId` | Hostet side for én virksomhed (`CVR-1-…`) eller person (`CVR-3-…`) fra et signeret link, som gemte sider og send-til-Lasso giver, med virksomheds- eller personfokus (`f=`). Komponeret som i chatten, friske data; samme nøgle og udløb som `/k/`. Med `ENTITY_PAGES_PUBLIC=true` virker den også uden signatur. |
| `POST /api/send-to-lasso` | Server-til-server (portal, CRM, e-mail-tjeneste): `{ lassoId \| cvr, userId, org?, focus?, note? }` gemmer siden på brugerens liste og svarer med linket til `/e/`. Kræver `SEND_TO_LASSO_KEY` (ellers `ADMIN_API_KEY`). |
| `POST /api/send-to-lasso/link` | Samme nøgle og body (uden note): giver et signeret `/send-to-lasso`-link til en knap i en e-mail eller et CRM. Gemmer intet. |
| `GET /send-to-lasso` | Signeret link: gemmer siden på brugerens liste og sender videre (302) til `/e/`. |
| `GET /api/views/:org/:slug` | Gemt spec som JSON. |
| `POST /api/views` | Gem via API. Kræver `ADMIN_API_KEY`. |
| `/api/debug/lasso/<sti>` | Rå svar fra Lassos API til tilpasning af adapters. Kræver `ADMIN_API_KEY`. `?shape=true` viser kun struktur. |
| `/k/:cvr.pdf`, `/p/:id.pdf`, `/e/:lassoId.pdf`, `/v/:org/:slug.pdf` | "Gem som PDF": samme signerede link som siden, som rigtig PDF-fil (virksomhed = rapporten, alt andet = siden i print-tilstand). |
| `/x/:token.pdf` | "Gem som PDF" i MCP-appen for `render_view`, `search_companies` og `list_saved_pages` (kortlivet link, 10 min). |
| `/komponenter` | Alle katalogets komponenter med live-data på LASSO X og en person (udstillingen). `?frisk=1` henter igen. |
| `/designguide` | Den dynamiske designguide: fundament (tokens), galleriets elementer, alle moduler i hver bredde og på portal, desktop, chat, tablet og mobil med rigtige data og automatisk overløbstjek, hele sider pr. fokus, alle tekster og reglerne i `docs/design`. Bygges fra koden ved hver build (se `docs/design/README.md`). |
| `/designguide/kommentarer.md` | Kommentarerne i designguiden som arbejdsliste (åbne; `?status=alle`). `GET /designguide/api/kommentarer` giver JSON; `POST`, `PATCH /:id` og `DELETE /:id` kræver `DESIGNGUIDE_KEY` (ellers `ADMIN_API_KEY`). |
| `/health` | Status, datakilde, database, `pdf` (Chromium fundet). |
| `/portal` | Portalen i browseren (login med bruger-id + adgangsnøgle, skinne, faner, søgning, virksomheds- og personsider, gemte sider). Roden `/` sender hertil. Se `docs/portal.md`. |
| `/api/portal/*` | Portalens API bag session-cookie og CSRF-header; samme use-cases som MCP-tools. `/api/portal/pdf/*` giver "Gem som PDF". |

### Data fra Lasso

Ud over CVR-stamdata, regnskaber og søgning henter serveren i dag: legale ejere og ejergraf
(katalog 11, 14), nyheder fra Lasso News + Paqle (katalog 12), produktionsenheder via P-numre (`CVR-2-…`), CHR-husdyrdata, verificerede telefonnumre
(live number) og en tekstlig regnskabsanalyse (katalog 08, 19, 20), samt kreditvurdering fra
Creditsafe (`LassoCreditRating`, katalog 17). Gemte sider vises med komponenten `LassoSavedPages`.
Status pr. endpoint (bekræftet/dokumenteret/tilkøb) står i `docs/lasso-endpoints.md`.

## Kom i gang lokalt

```bash
npm install
npm run build          # render-app + server
npm test               # spec, adapters, kriterier og ende-til-ende over MCP
npm start              # http://localhost:3000/mcp
```

Uden Lasso-credentials kører serveren på opdigtede demodata (`LASSO_DATA_SOURCE=auto`), så UI og MCP-flow kan bygges uden adgang til API'et. Uden `DATABASE_URL` gemmes visninger i hukommelsen.

Test med MCP Inspector:

```bash
npx @modelcontextprotocol/inspector
# Transport: Streamable HTTP, URL: http://localhost:3000/mcp
```

## Log ind i portalen

Åbn `https://<domæne>/portal`. Bruger-id `demo` + `MCP_ACCESS_KEY` logger demobrugeren ind; med
`MCP_USER_KEYS` (`nøgle:bruger-id:Navn:org;…`) får hver kollega sit eget login og sin egen liste af
gemte sider. Uden nøgler (lokalt) er portalen åben. Se `docs/portal.md`.

`PORTAL_PUBLIC=true` åbner portalen uden login: alle besøgende er demobrugeren og deler dens liste
af gemte sider, kontomenuen er skjult, og `/mcp` er stadig beskyttet af nøglen. Et personligt login
gælder fortsat, hvis cookien er der, men login-siden vises ikke.

## Tilføj i Claude

Indstillinger → Connectors → Tilføj brugerdefineret connector, med URL'en:

```
https://lasso-builder-staging.up.railway.app/mcp/<MCP_ACCESS_KEY>
```

Nøglen står under servicens Variables på Railway. Claude Code: `claude mcp add --transport http lasso <samme URL>`.

## Branches og miljøer

| Branch | Railway-miljø | |
|---|---|---|
| `staging` | staging | Der arbejdes her. Push deployer automatisk. |
| `main` | production | Opdateres fra `staging`, når det er testet. |

## Miljøvariabler

Se `.env.example`. På Railway er `DATABASE_URL` en reference til Postgres-servicen, og `PUBLIC_BASE_URL` peger på servicens eget domæne.

| Variabel | Standard | |
|---|---|---|
| `PDF_CHROMIUM_PATH` | `/usr/bin/chromium` | Chromium til "Gem som PDF" (øverst på alle sider i MCP-appen, delte sider og portalen). Findes filen ikke, er PDF slået fra: knappen skjules, PDF-ruterne svarer 503, og `/health` viser `pdf: false`. Docker-billedet sætter den. |
| `PDF_TIMEOUT_MS` | `25000` | Så længe må én PDF tage. |

### Docker og "Gem som PDF"

Slutstadiet i `Dockerfile` installerer `chromium`, `fonts-liberation` og `fonts-noto-core` fra Debian og
sætter `PDF_CHROMIUM_PATH=/usr/bin/chromium`. Serveren starter én Chromium (playwright-core) ved første
PDF, med `--no-sandbox --disable-dev-shm-usage --disable-gpu`, fordi en container uden brugernavnerum ikke
kan starte Chromiums egen sandkasse; Chromium åbner kun serverens egen print-side på loopback
(`/print/<token>`), og alle andre adresser blokeres. Render-appens fonte er indlejret i `view.html`, så
Chromium aldrig skal ud på nettet. Browseren lukkes efter 5 minutters stilhed. Lokalt uden Docker: sæt
`PDF_CHROMIUM_PATH` til en Chromium på maskinen (fx Playwrights). Se `docs/design/README.md`, "A4-eksport (27)".

## Kendte forbehold

- Lassos API bruger en API-nøgle i headeren `lasso-api-key` (bekræftet mod api.lassox.com). Søge-, virksomheds-, regnskabs-, ejerskabs-, risiko-, nyheds- og enhedssvarenes form er bekræftet (se `docs/lasso-endpoints.md`); Creditsafe, reelle ejere og live number kræver tilkøb, som ikke alle nøgler har. Ved opstart røgtester serveren `show_company` og `search_companies` mod Lasso og logger resuméet (`[lasso-probe]`); med `LOG_LEVEL=debug` logges også svarenes form.
- Søgning med kriterier er "klodset bagved": fritekstsøgning hos Lasso, derefter filtrering og sortering i serveren. Kan API'et filtrere serverside, flyttes det dertil.
- Login er en hardcodet demobruger, medmindre `MCP_USER_KEYS` binder nøglen til en bruger (`docs/gem-lag.md`); Lasso ID (OAuth 2.1 + PKCE) kobles på i samme funktion (`apps/server/src/auth/user.ts`).
- Delte links (`/v/`, `/k/`, `/e/`) kan ses af alle med linket; entitetssider under `/e/` er signerede og udløber efter `LINK_TTL_DAYS`, medmindre `ENTITY_PAGES_PUBLIC=true`. Synlighed på gemte visninger håndhæves først med rigtigt login.
- Creditsafe koster en kredit pr. opslag (Lasso cacher 24 timer pr. organisation); kun `focus: "risiko"` og et spørgsmål om kredit ("kan vi handle med dem") henter den. Observationer og regnskabsanalyse har egne tidsbudgetter (`OBSERVATIONS_BUDGET_MS`, `TEXT_SECTIONS_BUDGET_MS`), så et langsomt Lasso-kald fejler pænt uden at hele virksomhedsvisningen venter.
