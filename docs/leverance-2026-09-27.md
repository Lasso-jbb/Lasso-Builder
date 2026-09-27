# Leverance 27.09.2026: gem-lag, API-tilpassede adaptere og kreditvurdering

Kort status for det arbejde, der ligger på `staging` fra 35844d7 til e44ff17 (19 commits, 72 filer).
Beslutningerne bag gem-laget står i `docs/gem-lag.md`; endpoint-status i `docs/lasso-endpoints.md`.

## Leveret

| Område | Hvad | Hvor |
|---|---|---|
| Gem-laget | `save_page`, `list_saved_pages`, `remove_saved_page`; tabellen `saved_pages` bag `SavedPageStore` (Postgres + hukommelse); nøglebundne brugere via `MCP_USER_KEYS`; `savedIds` i alle visninger | `apps/server/src/pages/`, `apps/server/src/auth/user.ts`, `apps/server/src/mcp/server.ts` |
| Indgange udefra | `GET /e/:lassoId` (signeret entitetsside for virksomhed og person), `POST /api/send-to-lasso`, `POST /api/send-to-lasso/link`, signeret `GET /send-to-lasso` | `apps/server/src/index.ts`, `apps/server/src/web/links.ts` |
| UI | `SavedPages` (liste med åbn og fjern, filter, "Se alle N", fem tilstande), Gem/Gemt som lille ikonknap i hovedet, handlinger i MCP-appen; handlingsbjælkens knap hedder "Gem visning" | `packages/ui/src/components/SavedPages.tsx`, `packages/ui/src/LassoView.tsx`, `apps/view/src/mcp.tsx` |
| Ejerskab | Legale ejere fra `/owners/legal` (interval, "ejere under 5 %"), reelle ejere og ejergraf efter de dokumenterede former | `apps/server/src/lasso/ownershipAdapters.ts` |
| Risiko og nyheder | Observationer med `CompanyInsight` og `outcome` 0/25/50/100, relaterede entiteter, Lasso News med `{Navn|Id}`-markup, Paqle-fremhævning, flettet nyhedsliste | `apps/server/src/lasso/riskNewsAdapters.ts`, `newsMarkup.ts` |
| Enheder, kontakt, analyse | P-enheder via `CVR-2-…`, CHR-husdyr (faktisk form), live number, regnskabsanalyse som tekstsektioner | `apps/server/src/lasso/unitAdapters.ts`, `htmlText.ts` |
| Kreditvurdering | `LassoCreditRating` (Creditsafe A–E + lokal score, forrige vurdering, PDF, låst/ikke beregnet/fejl) i focus risiko med 12 s budget | `packages/ui/src/components/CreditRating.tsx`, `apps/server/src/lasso/creditAdapters.ts` |
| Verifikation | Opstartsproben logger form og udsnit af de nye endpoints mod api.lassox.com ved hvert deploy | `apps/server/src/index.ts` (`probeEndpointShapes`) |

Tests: 250 (server) + 69 (ui) + 49 (spec), alle grønne; `npm run build` grøn. Staging deployer fra `staging`
og kørte migreringen af `saved_pages` uden fejl.

## Bekræftet mod Lassos API i dag

Legale ejere, ejergraf (`from`/`to` er brøker, `type` er `ownership`), observationer (nøgler i
`relatedObservations` er i små bogstaver; top-niveau har `score`, skala ukendt), Lasso News, Paqle,
P-enheder (172 for Novo Nordisk), CHR (array af ejendomme med `livestockList`), regnskabsanalyse
(`sections` med syv dele). Reelle ejere og live number svarer 401 for den nuværende nøgle (tilkøb).
Creditsafe er ikke kaldt (koster en kredit).

## Ejerens to valg (sat til den sikre standard)

1. **Identitet.** Nøglebundne brugere (`MCP_USER_KEYS`) nu; Lasso ID/OAuth senere i `getCurrentUser`.
2. **Offentlige entitetssider.** `/e/<lassoId>` kræver signeret link; `ENTITY_PAGES_PUBLIC=true` åbner dem.

## Åbne punkter

- Skalaen for observationernes `score` (5 for Novo Nordisk) og om den kan bære Lassos 0–100-måler.
- Creditsafes faktiske svar, statuskoder og om `pdfUrl` kræver nøgle (proxy-rute).
- Ikke-tomt `veterinaryEventList.events` i CHR er ikke set.
- `GET /send-to-lasso` gemmer ved GET; mail-scannere kan udløse en gemning (upsert, ingen dubletter).
- Lists/tags-adapter bag `SavedPageStore`, når identitet mod Lasso findes (så "Gem" i Claude og "Gemt" i portalen bliver den samme knap).
