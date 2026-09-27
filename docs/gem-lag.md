# Gem-laget: gem, gense, fjern, åbn via link og "send til Lasso"

Dato: 27.09.2026. Beslutningerne her er truffet af Fable (orkestrator) ud fra pakken
`README-CODE-PAKKE.md` + `REVIEW-fable.md` og repoets faktiske tilstand (trin 0). To punkter er
ejerens (markeret **EJER**); de er sat til den sikre standard og kan ændres med én miljøvariabel.

## Trin 0: hvad repoet allerede kunne

1. **Rendering.** React + Vite (én HTML-fil, `apps/view`). `packages/ui` har hele katalogsættet (artboard
   01–30). MCP-appen kan kalde tools tilbage (`app.callServerTool`, brugt af `save_view` og
   `resolve_view`), så en "Gem"-knap inde i visningen er mulig i Claude og ChatGPT (MCP Apps).
2. **`save_view`.** Gemmer en `ViewSpec` (ikke data) i Postgres (`views`, `view_versions`) og giver
   `/v/:org/:slug`. Synlighed gemmes, men håndhæves ikke (alle med linket kan se siden). `/k/:cvr` og
   `/p/:id` er signerede entitetssider (HMAC, `LINK_TTL_DAYS`) med friske data. Der fandtes ingen
   brugerbunden liste af gemte entiteter.
3. **API-nøgle.** Én fælles servernøgle (`LASSO_API_TOKEN`), plus en separat søgenøgle (dev3). Ingen
   nøgle pr. bruger.
4. **Identitet.** `getCurrentUser` returnerede altid demobrugeren; `/mcp` beskyttes af én fælles
   `MCP_ACCESS_KEY`. Ingen OAuth.

## Identitet (**EJER**: nøglebundet nu, Lasso ID/OAuth senere)

`MCP_USER_KEYS` (valgfri) binder flere adgangsnøgler til hver sin bruger:

```
MCP_USER_KEYS="k8f3…:jbb:Jakob:lasso;q2m9…:anna:Anna:lasso"     # nøgle:bruger-id[:navn[:org]]
```

En brugernøgle i connector-URL'en (`/mcp/<nøgle>`) giver den bruger; den fælles `MCP_ACCESS_KEY`
(eller ingen nøgle lokalt) giver demobrugeren som før. Gemte sider er bundet til `(org, bruger-id)`.
Alt går gennem `getCurrentUser` i `apps/server/src/auth/user.ts`; når Lasso ID (OAuth 2.1 + PKCE)
kobles på, er det kun den funktion, der ændres. Nøgler logges aldrig; sammenligning er tidskonstant.

## Lager: egen tabel, ikke Lassos Lists/tags-API (endnu)

Pakken beder om at vurdere Lists/tags-API'et først (`POST/DELETE /{lassoId}/tags/{tagId}`,
`GET /tags?userId=`). Det fravælges som lager NU af tre grunde:

1. Der findes intet dokumenteret endpoint til at **oprette** en liste; kun at læse lister og lægge
   entiteter i en eksisterende. Serveren ville være afhængig af en manuelt oprettet liste pr. bruger.
2. Private lister kræver `?userId=<Lasso-bruger-id>`. MCP-brugeren har intet Lasso-bruger-id uden
   OAuth; med den fælles servernøgle ville alle gemte sider ende i ejerens egne lister.
3. Svarformerne er ikke verificeret mod en rigtig nøgle i dette arbejde.

Derfor: tabellen `saved_pages` i samme Postgres som `views`, bag interfacet `SavedPageStore`
(`apps/server/src/pages/store.ts`, Postgres + hukommelse). En Lists-adapter kan lægges bag samme
interface, når (a) identiteten mod Lasso er afklaret, og (b) endpoints er verificeret. Så kan
"Gem" i Claude og "Gemt" i portalen blive den samme knap.

### Datamodel

| Felt | Type | Note |
|---|---|---|
| org, user_id | text | Fra `CurrentUser` |
| lasso_id | text | `CVR-1-<cvr>` (virksomhed) eller `CVR-3-<id>` (person); primærnøgle sammen med org + user_id, så ingen dubletter |
| kind | company \| person | Afledt af og tjekket mod ID'et |
| name | text | Navnesnapshot fra gemmetidspunktet; siden viser altid friske data |
| cvr | text? | Kun virksomheder |
| focus | text? | Fokusvisningen, siden blev gemt fra: et virksomhedsfokus (fx `oekonomi`) eller et personfokus (fx `netvaerk`); et fokus, der ikke passer til siden, gemmes ikke og kommer aldrig i linket |
| note | text? | Brugerens note (højst 500 tegn) |
| origin | manual \| link \| send | Tool/knap, signeret link, eller eksternt system |
| saved_at | timestamptz | Nyeste først; gemmes siden igen, flyttes den øverst |

## Tools

| Tool | Gør |
|---|---|
| `save_page` | Gemmer én virksomhed eller person (CVR, Lasso-ID eller navn) på brugerens liste, med valgfri note og focus. |
| `list_saved_pages` | Viser listen (nyeste først) som Lasso-visning (`LassoSavedPages`) med åbn og fjern; tekstkort med signerede links til værter uden MCP Apps. |
| `remove_saved_page` | Fjerner en side fra listen. |

Routing i serverinstruktionerne: "gem virksomheden/personen", "husk", "min liste", "bogmærk" →
`save_page`; "giv mig et link", "del" → `save_view` (delbart link til en *visning*).

`show_company` og `show_person` sender `savedIds` med i datasættet, så hovedets Gem/Gemt-knap
(katalog 01, regel 21: små ikonknapper øverst til højre) viser den rigtige tilstand uden et ekstra kald.

## Indgange udefra

| Rute | Auth | Gør |
|---|---|---|
| `GET /e/:lassoId?f=&e=&s=` | Signeret link (samme nøgle og udløb som `/k/`, `/p/`) | Hostet side for én virksomhed eller person, komponeret som i chatten, friske data. `/k/` og `/p/` virker uændret. |
| `POST /api/send-to-lasso` | `SEND_TO_LASSO_KEY` (fallback `ADMIN_API_KEY`) | Server-til-server fra portalen, et CRM eller en e-mail-tjeneste: `{ lassoId \| cvr, userId, org?, focus?, note? }`. Gemmer siden (origin `send`) og svarer med det signerede link til `/e/`. |
| `GET /send-to-lasso?id=&u=&o=&f=&e=&s=` | Signeret link | Til en knap i en e-mail eller et CRM: gemmer siden (origin `link`) og sender videre til `/e/`. Links laves med `POST /api/send-to-lasso/link` (samme nøgle). |

**EJER: offentlige entitetssider.** `ENTITY_PAGES_PUBLIC=true` gør `/e/<lassoId>` tilgængelig uden
signatur (stabil URL `…/e/CVR-1-<cvr>`). Standard er `false`, fordi en åben side er et gratis opslag
på ejerens API-nøgle for alle på nettet. Med signatur udløber links efter `LINK_TTL_DAYS` (30);
`list_saved_pages` og `send-to-lasso` giver altid friske links.

## Ikke i dette scope

- Overvågning/notifikationer af gemte sider (Monitoring-API'et; senere udvidelse).
- Synkronisering med portalens "Gemt"-knap (kræver Lists-adapteren ovenfor).
- Login med Lasso ID.

## Status 27.09.2026

**Bygget:** de tre tools (`save_page`, `list_saved_pages`, `remove_saved_page`), rute-laget
(`GET /e/:lassoId`, `POST /api/send-to-lasso`, `POST /api/send-to-lasso/link`,
`GET /send-to-lasso`), Gem/Gemt-knappen i hovedet (katalog 01, regel 21) og listekomponenten
`LassoSavedPages` (`packages/ui/src/components/SavedPages.tsx`), som viser gemte sider i samme
rækkemønster som personlisten, med filter Alle/Virksomheder/Personer og "Fjern".

**Verificeret:** enhedstests for lager, ruter og komponent (`apps/server/src/pages/store.test.ts`,
`apps/server/src/pages/resolveExtras.test.ts`, `apps/server/src/web/entityLinks.test.ts`,
`apps/server/src/pages.e2e.test.ts`, `apps/server/src/e2e.test.ts`,
`packages/ui/src/savedpages.test.ts`). Staging-migreringen af `saved_pages`-tabellen
(`MIGRATION` i `apps/server/src/pages/store.ts`, kørt af `pages.migrate()` ved opstart) kørte uden
fejl på staging (serveren logger `[db] migreret` ved et senere forsøg, hvis databasen ikke er klar
med det samme). MCP-nøglen er sat, og staging kører på live Lasso-data.

**Driftsnoter:**

1. `GET /send-to-lasso` gemmer siden ved et almindeligt GET-kald (til knappen i en e-mail eller et
   CRM). Det betyder, at mail-scannere, der åbner links på forhånd for at tjekke dem (fx Microsoft
   Safe Links), kan udløse en gemning, før brugeren selv har klikket. Det er ufarligt: gemningen er
   et upsert på `(org, user_id, lasso_id)` (primærnøglen i `saved_pages`), så en scanner-udløst
   gemning bare rykker siden øverst uden at skabe en dublet, og siden gemmes uanset kun på den
   bruger, linket er signeret til.
2. `POST /api/send-to-lasso` svarer **503**, hvis hverken `SEND_TO_LASSO_KEY` eller `ADMIN_API_KEY`
   er sat, UDEN for lokal udvikling (`APP_ENV=development`). Lokalt lukkes ruten ikke op uden
   nøgle, så den kan testes uden en hemmelighed; på staging/produktion er en nøgle et krav, fordi
   ruten skriver til en vilkårlig brugers liste ud fra `userId` i body'en (`sendKey`-middleware,
   `apps/server/src/index.ts`).
