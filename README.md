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
| `show_company` | Fast virksomhedsskabelon: header, nøgletal, graf, ledelse, ejerskab/revisor, opfølgning. |
| `render_view` | Fri komposition til sammenligninger og oversigter. |
| `save_view` | Gemmer specen og giver et link. Samme adresse opdateres, versioner bevares. |
| `resolve_view` | Kun for appen: henter data ved drill-down, filterændring og opdatering. |

### Ruter

| Rute | |
|---|---|
| `/mcp` | MCP-endpoint. Kræver `MCP_ACCESS_KEY` som `?key=`, `/mcp/<key>`, `x-api-key` eller Bearer. |
| `/v/:org/:slug` | Delt side med friske data. |
| `GET /api/views/:org/:slug` | Gemt spec som JSON. |
| `POST /api/views` | Gem via API. Kræver `ADMIN_API_KEY`. |
| `/api/debug/lasso/<sti>` | Rå svar fra Lassos API til tilpasning af adapters. Kræver `ADMIN_API_KEY`. `?shape=true` viser kun struktur. |
| `/health` | Status, datakilde, database. |

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

## Kendte forbehold

- Lassos API bruger en API-nøgle i headeren `lasso-api-key` (bekræftet mod api.lassox.com). Søgesvarets form er bekræftet. Oversættelsen af virksomheds- og regnskabssvar (`apps/server/src/lasso/adapters.ts`) rettes løbende efter strukturen, serveren logger ved opstart (`[lasso-probe]`).
- Søgning med kriterier er "klodset bagved": fritekstsøgning hos Lasso, derefter filtrering og sortering i serveren. Kan API'et filtrere serverside, flyttes det dertil.
- Login er en hardcodet demobruger i `apps/server/src/auth/user.ts`. Lasso ID (OAuth 2.1 + PKCE) kobles på dér.
- Delte links kan ses af alle med linket. Synlighed gemmes, men håndhæves først med rigtigt login.
