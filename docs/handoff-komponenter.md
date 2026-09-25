# Handoff: Lassos nye designkatalog som MCP-komponenter

Dette dokument er en overdragelse til en model, der skal hjælpe med at planlægge og bygge komponenterne. Læs det hele, før du svarer. Vedhæft designkataloget (PDF, "Combined.pdf", 41 artboards) sammen med dette dokument.

---

## 1. Opgaven i én sætning

Lasso-Builder er en MCP-server, som viser danske virksomhedsdata (CVR, regnskaber, ledelse, ejere, søgning) som grafiske visninger i Claude, ChatGPT og via delte links. Alle visninger skal nu bygges om efter Lassos **nye designkatalog**. Kataloget er det endelige design, og alt tidligere design må ikke bruges mere.

## 2. Det eksisterende system

**Repo:** `Lasso-jbb/Lasso-Builder`. Koden ligger på branchen **`staging`**, fordi `main` kun har en README. Den kører på Railway (staging-URL: `lasso-builder-staging.up.railway.app`).

**Arkitektur (bevares):** modellen sender en JSON-spec, serveren henter data, og UI'et tegner. Modellen skriver aldrig HTML/CSS.

```
packages/spec     zod-schema for visnings-spec, komponentkatalog (catalog.ts), felter, kriterier, talformat, skabeloner
packages/ui       React 19-komponenter. Kender kun spec + data, kalder aldrig API'er. styles.css har alle tokens.
apps/view         Vite-app, der renderer i MCP-appen (mcp.tsx) og som delt weblink (web.tsx)
apps/server       MCP-server (mcp/server.ts), Lasso-klient (lasso/client.ts), adaptere (lasso/adapters.ts),
                  tekstkort til terminaler (data/card.ts), gemte visninger (views/store.ts), tests
docs/             design/README.md (GAMMELT design, skal erstattes), lasso-endpoints.md, screenshots/
```

**MCP-værktøjer i dag:** `show_company`, `search_companies`, `render_view` (fri spec) og `save_view` (delbart link).

**De 8 komponenter i dag** (`packages/ui/src/components/`): `LassoCompanyHeader`, `LassoKeyFigures`, `LassoFinancialChart`, `LassoPeopleList`, `LassoOwnership`, `LassoTable` (+ `FilterPanel`), `LassoComparison` og `LassoActions`. Tilsammen er de ca. 1.100 linjer.

**Vigtige egenskaber, der skal bevares:**

- Hver visning leverer også et **tekstkort** (`card.ts`) til apps, der ikke kan tegne, fx Claude Code og terminaler.
- Hver visning har et link til den interaktive Lasso-visning.
- **Komponentkataloget står i tool-beskrivelserne**, fordi ChatGPT ikke læser MCP-resources. Beskrivelserne afgør, hvilken komponent modellen vælger.
- Specen gemmes uden data, så et delt link altid viser friske tal.

**Data i dag** (`api.lassox.com`, header `lasso-api-key`): `/{lassoId}` (CVR-stamdata, ledelse, ejere), `/{lassoId}/reports/advanced` (fulde XBRL-regnskaber), `/data/ejf/...` (ejerfortegnelsen), `/data/tinglysning/...`, `/data/websites/...` og søgning med filtre på `dev3.api.lassox.com`. `/modules/observations` (risiko) er dokumenteret, men ikke koblet på. `/modules/valuations` svarer tomt. Nye endpoints, der skal kobles på, står i afsnit 4a.

## 3. Designkataloget: det vigtigste

PDF'en har 41 artboards. Tallene i parentes nedenfor er artboard-numrene.

### Fundament (01, 01B)

- **Farver:** koral `#FF6B35` (primary), koral lys `#FFF2EB`, koral kant `#FFCFB6`, koral mørk `#B2450F`. Ink `#16181D` (overskrift), text `#3F444B`, text-secondary/muted `#5B6068` (ALT læsbar hjælpe- og metatekst), `#8A9099` kun til ikoner og dekoration, icon `#9AA0A8`, text-faint `#B9BEC5`, danger `#D92D20`, success `#1F8A4C`, konkurs-rød `#B42318`. Flader: surface `#FFFFFF`, panel `#FCFCFD`, muted `#F4F4F5`, chrome `#F1F2F4`. Linjer: border `#E4E4E7`, divider `#E6E7EB`, divider-subtle `#F1F1F3`. Overlay `#43464D`.
- **Grafserier (fast rækkefølge, serie 2 aldrig uden serie 1):** chart-1 `#FF6B35`, chart-2 `#2F5D8A`, chart-3 `#8FB8DE`, chart-4 `#FFC1A3` (tidligere år), chart-5 `#9AA0A8` (branche/benchmark).
- **Typografi, Poppins:** Display 32/40/700, Titel 24/32/600, Sidetitel 18/24/600, Feltnavn 14/18/600, Knap/værdi 14/18/500, Brødtekst 14/18/400, Lille 13/18/400, Overlinje 11/14/600 med +8 % spatiering.
- **Afstande** i trin af 4 px. **Hjørner:** felter og knapper 8, menupunkter 9, faner og kort 10, dialoger 14.
- **Fokus:** 1 px koral kant (`#FFCFB6`), aldrig ring eller skygge. Kun det, der svæver, har skygge.
- **Knapper:** højde 42 i dialoger og paneler, 36 i sidehoveder, 32 i kompakte rækker. Én primær knap pr. område, yderst til højre.
- **Ikoner:** streg 1,8, runde ender, 24-grid. Aldrig i grå flise eller cirkel.

### Faste regler (ufravigelige, fra 01 og guide 23)

1. Status er ren tekst i vægt 500. Ingen piller, prikker eller farvede flader.
2. Ingen dekorative piller eller badges. Tællere står aldrig på faner.
3. Hvid flade overalt. Opdel med tynde linjer og luft, aldrig hvide kort på grå baggrund. Intet mørkt fyld på rækker eller aktive elementer.
4. Ingen farvede bannerbokse. AI-analyser er almindelige sektioner med kildelinje og intet "Skrevet af AI"-mærke.
5. Navne står alene: ingen initial-cirkler eller ikonkasser. Person og selskab skelnes med tekst, og i diagrammet med form (pille/kasse).
6. **Ingen midterprik (·) nogen steder.** Brug komma.
7. Ikon + ord ved enhver farvekodning, aldrig kun farve.
8. Kildelinje én gang pr. sektion: "Kilde: Navn, opdateret DD.MM.ÅÅÅÅ".
9. Flere værdier end formen kan vise: vis 3 + "Se N …".
10. Risikoskala: 0 = lav (grøn) til 100 = høj (rød). Fire trin: 0 neutral, 25 info, 50 mulig vigtig, 100 vigtig.

### Talformat (09)

- Beløb: < 1 mio. skrives `842 t. kr.`, ≥ 1 mio. `18,8 mio. kr.`, ≥ 1 mia. `2,4 mia. kr.`
- Tal: `1.243.501` og `17,3`, mellemrum før %, én decimal i procent.
- Negative tal med ægte minus `−201`, aldrig parentes. Rød kun når negativt er dårligt.
- Udvikling: ▲ grøn / ▼ rød + procent. Skifter fortegnet, vises kun pilen.
- Dato `15.04.2026`. Intervaller som tekst: `25–33,32 %`.

### Fem tilstande (alle elementer skal have dem)
**Fyldt**, **henter** (skelet i samme højde), **tom** (siger hvorfor, stiplet ramme, aldrig "0"), **ikke oplyst** ("Ikke oplyst"/"—" i text-faint) og **fejl** (kun ved teknisk fejl, med "Prøv igen").

### Sideskabelon og grid (06, guide 23)

- Fanebjælke 56 px, sidehoved 70 px, skinne 236 px, midte flydende (padding 28, gutter 24, 4-kolonne-grid), panel 336 px (valgfrit).
- Kun bredderne ¼, ½, ¾ og fuld. Nøgletalskort deler fuld bredde (3–5 kort). Grafer er mindst ½. Tabeller er altid fuld bredde.
- **Rækkefølge på en virksomhedsside:**
  1. Hoved
  2. Risiko (kun ved 50+, ellers udeladt)
  3. Nøgletal (+ kreditscore)
  4. Én graf ved siden af nøgle-værdi-listen
  5. Personer og ejere
  6. Historik og nyheder
- Flere grafer skal på hver sin fane og må aldrig stables på et overblik.

### Datatype → element (guide 23, trin 4)
| Datatype | Element | Artboard |
|---|---|---|
| Identitet | Virksomhedshoved, personhoved | 08, 16 |
| Ét tal med udvikling | Nøgletalskort 3–5 på række | 09 |
| Mange felter, én enhed | Nøgle-værdi-liste med årsvælger | 09 |
| Fuldt regnskab | Resultatopgørelse med subtotaler + analyse | 19 |
| Udvikling over år | Søjlegraf, sparkline i tabeller | 13 |
| 2–3 serier / benchmark | Grupperede søjler, linje + område | 13 |
| Dele af en helhed | Stablede søjler, donut + andelsbjælker | 13, 20 |
| Fra A til B | Vandfald | 13 |
| Placering blandt lignende | Rangliste, sammenligning i kolonner | 13, 22 |
| Score 0–100 | Scoremåler, score over tid | 10, 13, 18 |
| Risiko | Alvorsskala + observationsliste | 17 |
| Personer og roller | Rolleliste, tidsbånd, netværk | 11, 16 |
| Ejerskab | Ejerliste med interval-bjælke, ejerdiagram | 11, 14 |
| Mange virksomheder | Tabel med værktøjslinje og paginering | 15 |
| Begivenheder over tid | Tidslinje, ændringsfeed | 12, 21 |

### Responsivt (26–26H)
Brudpunkterne er 1440 → 1200 (panel falder under midten) → 960 (skinnen skjules) → 768 (tablet, to kolonner, maks 6 tabelkolonner) → 390 (mobil, én kolonne).

På mobil:

- Tabeller bliver kortlister, og ejerdiagrammet bliver en liste.
- Rækker er mindst 44 px høje.
- Grafer viser maks 5 punkter ad gangen og har en fast tooltip under grafen.
- Intet element får en separat mobiludgave. Det er kun brudpunkter.

## 4. Afgrænsning

**Med (bruges af MCP'en):**

- Fundament
- Visning af felter
- Tilstande
- Knapper, chips og tags
- Dataelementerne 08–15, 17, 19 og 22
- Datavisualisering (13)
- Ejerdiagram (14, 14B)
- Filterpanel (02–04, 07)
- Responsivt
- Guidens regler

**Ikke med nu:**

- Portalens navigation og fanebjælke
- Dialoger og menuer ud over det, filterpanelet bruger
- Overvågningsfeed (21)
- A4-eksport (27)

**Venter på data (bygges, når der er endpoints):**

- Kreditvurdering (18)
- Personsidens risikoblok og netværk (16). Tidsbåndet kan bygges med `history/participants`.
- P-enheder, BBR og CHR (20)
- Overvågning (21). `companies/delta` findes, men overvågning er udenfor nu.

## 4a. Nye endpoints: vurdering og placering

Alle ligger på `api.lassox.com` med samme header (`lasso-api-key`) og samme nøgle som i dag (`LASSO_API_TOKEN`). **På Railway skal der ikke ændres noget.** Endpoints er stier i koden og hører hjemme som metoder i `apps/server/src/lasso/client.ts`, med en adapter i `adapters.ts` og en række i `docs/lasso-endpoints.md`. Kun hvis et endpoint viser sig at kræve en anden nøgle, skal der oprettes en ny variabel på Railway.

Svarformerne er ikke bekræftet endnu. Hvert endpoint skal kaldes én gang mod LASSO X A/S (`CVR-1-34580820`) og svaret noteres i `docs/lasso-endpoints.md`, før adapteren skrives. Samme fremgangsmåde blev brugt for de eksisterende endpoints.

| Endpoint | Bruges til | Artboard | Beslutning |
|---|---|---|---|
| `POST /modules/relations/graph` (`ids`, `relationTypes: ["ownership"]`, `enrichments: ["companyinfo"]`, `ingoingDepth`/`outgoingDepth`, `onDate`) | Ejerdiagram: ejere over, datterselskaber under, fokusvirksomheden i midten. `onDate` giver datoen for øjebliksbilledet. | 14, 14B | **Brug, høj prioritet.** Det er ejergrafen, som diagrammet manglede. Start med dybde 3 og fold dybere kæder, som 14B viser. Dybde 10 kan give meget store svar. |
| `GET /{lassoId}/owners/legal` | Ejerliste med interval-bjælke | 11 | **Brug.** Erstatter udtrækket af ejere fra `/{lassoId}`. |
| `GET /{lassoId}/owners/beneficial` | Reelle ejere | 11, 14 | **Brug.** Kataloget har reelle ejere som et fast element. |
| `GET /{lassoId}/history/owners/legal` | Ejerskifter over tid i historikken, fratrådte ejere | 11, 12 | **Brug, lav prioritet.** |
| `GET /{lassoId}/participants` | Direktion, bestyrelse og revisor | 11 | **Brug.** Erstatter udtrækket af ledelse fra `/{lassoId}`. |
| `GET /{lassoId}/history/participants` | Roller over tid (tidsbånd), fratrådte, historik | 11, 16, 12 | **Brug.** Grundlaget for personsidens tidsbånd og `show='all'` i ledelseslisten. |
| `GET /data/paqle/{lassoId}/news` | Nyhedsliste med kilde og favicon | 12 | **Brug.** Nyheder kan nu flyttes fra "venter på data" til trin 3. |
| `POST /modules/news` (Lasso News) | Lassos egne nyheder. Lasso-ikonet bruges som kilde. | 12 | **Brug, hvis body-formatet kan afklares.** Formatet mangler. Ellers er paqle nok i første omgang. |
| `GET /data/livenumber/{lassoId}` | Kontaktblok med live-verificerede telefonnumre | 08 | **Brug.** Kataloget har "kontaktblok (+ live-verificering)". |
| `GET /data/livenumber/lookup/{phonenumber}` | Opslag fra telefonnummer til virksomhed | – | **Ikke nu.** Det er en søgefunktion, ikke en visning. Den kan blive et senere MCP-værktøj. Kræver en vurdering af persondata, før den bruges. |
| `GET /{lassoId}/reports/advanced` | Nøgletal, grafer og fuldt regnskab | 09, 13, 19 | **Fortsæt som primær kilde.** Den er AI-optimeret, og alle regnskabskomponenter bygger på den. |
| `GET /{lassoId}/reports?metadataOnly=true` | Årsvælger og liste over regnskabspubliceringer uden at hente hele regnskabet | 19, 28 | **Brug.** Billig måde at bygge periodevælgeren på. |
| `GET /{lassoId}/reports/latest/pdf` | Link "Åbn årsrapport (PDF)" i kildelinjen for regnskabet | 19 | **Brug via en proxy på serveren.** API-nøglen må aldrig sendes til browseren. |
| `GET /{lassoId}/reports`, `/reports/latest` | Ældre regnskabsformat | – | **Brug ikke.** `reports/advanced` dækker det. |
| `GET /data/cvr/companies/delta?since=&max=` | Ændringer i CVR i en periode | 21 | **Ikke nu.** Hører til overvågning, som er udenfor. Relevant, hvis MCP'en senere skal kunne svare på "hvad er ændret siden …". |

**Effekt på planen:**

- Ejerdiagrammet har nu en datakilde og er ikke længere blokeret.
- Nyheder (12) og rolledelen af personsiden (16) kan flyttes ind i trin 3.
- Tilkobling af de nye endpoints tager ca. **6–10 timer ekstra Claude-tid**, primært Sonnet 5:
  - relations/graph: 2–3 t
  - ejere (legal/beneficial/historik): 1–2 t
  - deltagere med historik: 1–2 t
  - nyheder: 1–2 t
  - livenumber: 0,5–1 t
  - metadata og PDF-proxy: 0,5–1 t

## 5. Opskrift på én komponent

Hver ny komponent kræver præcis disse fire ting:

1. **Schema** i `packages/spec/src/spec.ts` (zod) og en katalogtekst i `catalog.ts`. Teksten skal sige, *hvornår* modellen skal vælge komponenten.
2. **Data:** en adapter i `apps/server/src/lasso/adapters.ts` og et felt i `Dataset`. UI'et kalder aldrig API'er.
3. **React-komponent** i `packages/ui/src/components/`. Den må kun bruge CSS-variabler fra `styles.css`, bruger `DataState` til de fem tilstande og tegner grafer som ren SVG uden chartbibliotek.
4. **Tekstkort** i `apps/server/src/data/card.ts` og tests.

Eksisterende spec-format og komponentnavne ændres ikke uden en migrering, så gemte visninger og delte links bliver ved med at virke.

## 6. Arbejdsplan

| Trin | Indhold | Tid (Claude) |
|---|---|---|
| **0. Gør designet læsbart** | Eksportér alle 41 artboards som PNG til `docs/design/artboards/`. Træk tokens ud. Erstat `docs/design/README.md` helt med det nye katalog. | ~1 t |
| **1. Nyt designgrundlag** | Omskriv `styles.css` med de nye tokens (bevar variabelnavne, hvor det kan lade sig gøre). Omskriv `primitives.tsx` (knap, chip, tag, kildelinje). Ny fælles `DataState` til de fem tilstande. | 2–3 t |
| **2. De 8 komponenter i nyt design** | CompanyHeader (08), KeyFigures (09), FinancialChart (13), PeopleList + Ownership (11), CompanyTable (15), Comparison (22) og FilterPanel (02–04, 07). Opdatér tekstkortet for hver. | 4–6 t |
| **3. Nye komponenter** | `LassoFinancialStatement` (19, data findes i XBRL) · `LassoMultiYearTable` + `LassoGauge` (10) · flere graftyper i en fælles `LassoChart` (grupperet, linje + område, stablet, donut, vandfald, rangliste) (13) · `LassoRiskObservations` (17, kobl `/modules/observations` på) · `LassoOwnershipDiagram` (14, 14B, data fra `relations/graph`, layout-algoritme i lag med foldede kæder og cirkulært ejerskab) · `LassoNews` (12, paqle) · reelle ejere og roller over tid (11, 16) · tilkobling af de nye endpoints fra afsnit 4a (6–10 t) | 14–24 t |
| **4. Guidens regler i MCP'en** | `templates.ts` følger rækkefølgen fra guiden. Spec-validering fanger brud på bredderegler og stablede grafer. `layout` udvides til 4-kolonne-grid (¼, ½, ¾, fuld). Tool-beskrivelser i `mcp/server.ts` opdateres, og gamle komponentnavne fjernes. | 2–3 t |
| **5. Responsivt** | Brudpunkterne fra 26 via `useWidth.ts`. Kortlister på mobil. | 2–3 t |
| **6. Visuel test** | Playwright renderer hver komponent med `data/demo.ts` i 1440, 768 og 390 px, side om side med artboardet. Ret til det matcher. `npm run typecheck` og `npm test` skal være grønne. | 3–5 t |
| **I alt** | | **~31–48 t** |

**Rækkefølge:** trin 0–2 skal laves først og i rækkefølge, fordi de fastlægger mønsteret. Trin 3 kan derefter køre parallelt, fordi komponenterne ikke rører hinanden. Trin 4–6 afslutter.

**Arbejdsgang:** feature-branch fra `staging`, én PR pr. trin mod `staging` med før/efter-screenshots, godkendelse på Railway-staging og først derefter `main`.

## 7. Modelfordeling og tid

| Model | Opgaver | Timer |
|---|---|---|
| **Opus 5.5** | Trin 0–2, trin 4, ejerdiagram og gennemsyn af hver PR | 15–23 t |
| **Sonnet 5** | Trin 3 (undtagen ejerdiagram) inkl. de nye endpoints, responsivt og rettelser efter visuel test. Flere agenter parallelt. | 14–22 t |
| **Haiku 4.5** | Eksport af artboards, screenshot-kørsler og tests af tekstkort | 1,5–2,5 t |
| **Fable 5.1** | Kun reserve, hvis ejerdiagrammet går i stå. Den overtager Opus-timer og kommer ikke oveni. | 0–3 t |

**Kalendertid:**

1. Opus alene i ca. 7–10 t (trin 0–2).
2. Parallelt i ca. 6–10 t: Sonnet-agenter bygger nye komponenter, mens Opus laver ejerdiagrammet.
3. Afslutning i ca. 5–6 t.

Samlet ca. 18–26 t (ca. 31–48 t arbejdstid i alt), før menneskelige gennemsyn kommer oveni. Det er gennemsynene, der bestemmer den reelle kalendertid.

**Største usikkerheder:**

- Ejerdiagrammet (4–8 t).
- Svarformerne fra de nye endpoints er ikke bekræftet.
- Data til kredit, BBR/CHR og personrisiko mangler stadig. Hver datatype tager 1–3 t, når der er endpoints.

## 8. Åbne spørgsmål, der skal afklares

1. Body-format for `POST /modules/news` (Lasso News).
2. Dækker den nuværende API-nøgle alle de nye endpoints (paqle, livenumber, relations)?
3. Kilde til kreditvurdering: Creditsafe eller `/modules/valuations`, som i dag svarer tomt.
4. Endpoints til P-enheder, BBR, CHR og personrisiko (PEP, konkurser).
5. Skal portalens elementer (navigation, dialoger, A4-eksport) med senere?
6. Må gamle komponentnavne omdøbes? Hvis ja, skal gemte visninger migreres.

## 9. Sådan hjælper du bedst

- Svar på dansk.
- Tag udgangspunkt i planen ovenfor. Foreslå ændringer, hvis du ser huller, men ændr ikke arkitekturen: spec → data → UI, katalog i tool-beskrivelser og tekstkort til hver visning.
- Henvis altid til artboard-numre, når du taler om en komponent.
- Kataloget er facit. Er der modstrid mellem kataloget og den nuværende kode eller `docs/design/README.md`, vinder kataloget.
