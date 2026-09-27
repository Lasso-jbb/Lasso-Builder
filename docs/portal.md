# Portalen: Lasso i browseren med login

Dato: 27.09.2026. Portalen er samme render-app og samme komponenter som i Claude/ChatGPT, men
med login, skinne, fanebjælke og modulbjælke fra designkataloget (06), så den kan bruges som
portal.lassox.com bruges i dag. Den bor på `/portal` (roden `/` sender videre), og API'et under
`/api/portal/*` genbruger præcis den serverlogik, MCP-tools bruger.

## Login og session (apps/server/src/auth/session.ts)

- Login = **bruger-id + adgangsnøgle**, samme nøgler som MCP-connectoren: `MCP_ACCESS_KEY` logger
  demobrugeren ind (bruger-id = `DEMO_USER_ID`, standard `demo`), `MCP_USER_KEYS` logger hver sin
  bruger ind. Lasso ID/OAuth kobles på i `loginWithKey`/`getCurrentUser` senere.
- Session = signeret, httpOnly cookie `lasso_session` (HMAC med `LINK_SECRET`, samme hemmelighed
  som links), 30 dage, `SameSite=Lax`, `Secure` på https. Ingen sessioner i databasen.
- CSRF: alle andre kald end GET/HEAD til `/api/portal/*` skal sende headeren `x-lasso-portal: 1`.
- Uden nøgler (lokal udvikling) er portalen åben som demobrugeren, ligesom `/mcp`.
- Login er bremset til 10 forsøg pr. IP pr. kvarter (429).

| Rute | Body | Svar |
|---|---|---|
| `POST /api/portal/login` | `{ user, key }` | `200 { user: { id, name, org, isDemo } }`, ellers `401 { error }` |
| `POST /api/portal/logout` | – | `200 { ok: true }` og cookien slettes |
| `GET /api/portal/me` | – | `200 { user }` eller `401` |
| `GET /portal` | – | Render-appen med `window.__LASSO_BOOT__ = { mode: "portal", user: {…} \| null, loginRequired, baseUrl }` |

## Portal-API (kræver session; alle svar er JSON)

Samme use-cases som MCP-tools (`apps/server/src/usecases/`), så resultatet i browseren er identisk
med det i Claude: `{ spec, dataset, note? }` som `structuredContent.spec` + `_meta`-datasættet.

| Rute | Gør | Svar |
|---|---|---|
| `GET /api/portal/search?query=&limit=&title=` | Som `search_companies` (Lassos fortolkning af friteksten, kriterier som chips) | `{ spec, dataset, note? }` |
| `GET /api/portal/company/:ref?focus=&years=&metric=` | Som `show_company` (navn, CVR eller Lasso-ID; `focus` = overblik, oekonomi, regnskab, ejerskab, ledelse, risiko, historik, kontakt) | `{ spec, dataset, note?, link }` (link = signeret `/e/`-side) |
| `GET /api/portal/person/:ref` | Som `show_person` | `{ spec, dataset, note?, link }` |
| `POST /api/portal/resolve` `{ spec }` | Som `resolve_view` (drill-down, filterændring, opdatér) | `{ spec, dataset }` |
| `GET /api/portal/pages?kind=company\|person\|all&limit=` | Som `list_saved_pages` | `{ spec, dataset }` |
| `POST /api/portal/pages` `{ page, kind?, focus?, note? }` | Som `save_page` | `{ lassoId, kind, name, cvr?, savedAt, created, total, url }` |
| `DELETE /api/portal/pages/:lassoId` | Som `remove_saved_page` | `{ lassoId, removed, total }` |
| `POST /api/portal/views` `{ spec, name?, slug?, visibility? }` | Som `save_view` | `{ url, org, slug, version, name, visibility }` |

Fejl: `400 { error }` ved ugyldigt input, `404 { error }` når virksomheden/personen ikke findes,
`401`/`403` fra sessionen, `409` ved optaget adresse i `views`.

## Render-appen i portal-tilstand (apps/view/src/portal/)

- `boot.mode === "portal"` → `PortalApp`. Uden `user` (og `loginRequired`) vises login-siden:
  bruger-id, adgangsnøgle, fejltekst, "Log ind". Med `user` vises rammen.
- Rammen er `AppShell` (katalog 06): `Rail` med grupperne Værktøjer (Søgning, Gemte sider),
  Firmaer (de nyeste gemte virksomheder, "Se alle") og Personer (gemte personer); `TabStrip` med
  de åbne sider (søgning, gemte, hver virksomhed/person) med luk og "+" (ny søgning), klokke
  udeladt (ingen overvågning endnu), konto = navn + "Log ud".
- En virksomhedsfane har `ModuleBar` med de otte fokus (Overblik … Kontakt) og handlingerne
  Gem/Gemt (accent), Del link og Eksportér; kroppen er `LassoView` med host `{ savePage, save,
  refine, drillDown, refresh, export, back: false }` og handlinger via fetch mod API'et.
- Hash-routing, så tilbage/frem og genindlæsning virker: `#/search?q=…`, `#/company/CVR-1-…?focus=`,
  `#/person/CVR-3-…`, `#/saved`.
- Mobil: `AppShell`s mobile-props (titel, sektioner = fokus, bundnavigation Søg, Lister, Konto).

## Ikke i denne runde

Overvågning/notifikationer, brugerens egne lister (ud over gemte sider), dataudtræk, prospecting,
rapportering, ejendomme som selvstændigt værktøj og Lasso ID-login.
