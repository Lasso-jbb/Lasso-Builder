# Opskrift: én ny komponent fra Paper

Gælder alle nye komponenter. Mønstret er sat af de otte første: `packages/ui/src/components/CompanyHead.tsx`, `KeyFigureCards.tsx`, `BarChart.tsx`, `PersonList.tsx`, `OwnerList.tsx`, `CompanyTable.tsx`, `CompareTable.tsx`. Læs mindst to af dem, før du begynder.

## 0. Designet kommer KUN fra Paper

Der er ingen PDF. Filen er **"Lasso Portal - Designguide"**, `fileId` = `01M1GZGSTYBM43XSSD4JHQ0ADG`, siden **Designkatalog**. Værktøjerne hedder `mcp__remote-devices__Paper__*` (indlæs dem med ToolSearch).

1. `get_tree_summary` (depth 2–3) på artboardet finder elementerne og deres node-id'er. Artboard-id'er:
   08 `9R4-0`, 09 `9UH-0`, 10 `9YC-0`, 11 `A3C-0`, 12 `A7X-0`, 13 `ABC-0`, 14 `AQA-0`, 14b `G5W-0`, 15 `B45-0`, 16 `BN9-0`, 17 `BTG-0`, 18 `BX4-0`, 19 `C0U-0`, 20 `C48-0`, 21 `CA3-0`, 22 `CFC-0`, 23 guide `CK3-0`, 26b mobil grafer `E2J-0`, 26c mobil lister `EBV-0`, 26d mobil person/risiko/regnskab `EOD-0`, 26e mobil enheder/sammenligning `EYK-0`, 28 øvrige `H0G-0`.
2. `get_screenshot` på hvert element. Læs noten under elementet: den indeholder mål og regler.
3. `get_jsx` (format `inline-styles`) eller `get_computed_styles`, når mål, farver eller skriftstørrelser skal aflæses præcist.
4. Tokens står allerede i `packages/ui/src/styles.css`. Brug KUN CSS-variablerne derfra. Mangler en farve, så find den i tokens, aldrig hex i komponenten.

## 1. Faste regler (bryd dem aldrig)

1. Status er ren tekst i vægt 500. Ingen piller, prikker eller farvede flader.
2. Ingen dekorative badges. Tællere aldrig på faner.
3. Hvid flade. Opdel med tynde linjer og luft, aldrig kort på grå baggrund. Brug `Section` fra `primitives.tsx`.
4. Ingen farvede bannerbokse. AI-tekst er en almindelig sektion med kildelinje, uden "Skrevet af AI".
5. Navne står alene: ingen initial-cirkler eller ikonkasser.
6. **Ingen midterprik (·) nogen steder, heller ikke i tekstkortet.** Brug komma.
7. Ikon eller ord ved enhver farvekodning, aldrig kun farve.
8. Kildelinje én gang pr. sektion: `SourceLine` ("Kilde: Navn, opdateret DD.MM.ÅÅÅÅ").
9. Flere værdier end formen kan vise: 3 + "Se N …".
10. Risikoskala 0 (lav) til 100 (høj).

Tal: brug `formatAmount`, `formatNumber`, `formatPercent`, `formatDate`, `amountScale`, `formatScaled` fra `@lasso/spec`. Aldrig egne talformater.

## 2. Fem tilstande

Brug `DataState` fra `primitives.tsx`: henter (`loading`, samme højde som fyldt), tom (`empty`, med en `reason` der siger hvorfor, aldrig "0"), ikke oplyst (`notreported`, eller `Missing` for én værdi), fejl (`error`). Fyldt tegner komponenten selv.

## 3. De fire dele af en komponent

1. **Schema** i `packages/spec/src/spec.ts`: et zod-objekt med `type: z.literal("Lasso…")` og tilføj det til `componentSchema`. Navn: `Lasso` + engelsk navn efter katalogelementet.
2. **Data**: en normaliseret model i `packages/spec/src/models.ts` og et felt i `Dataset` (+ `emptyDataset`). Metode i `DataProvider` (`apps/server/src/data/provider.ts`), implementeret i `LiveProvider` (`live.ts`, via adapter i `apps/server/src/lasso/adapters.ts` og klient i `client.ts`) OG i `DemoProvider` (`demo.ts`, med eksempeldata, hvor alle navne indeholder "Eksempel" eller "Prøve"). Registrér behovet i `resolveSpec` (`resolve.ts`). UI'en kalder aldrig API'er.
3. **React-komponent** i `packages/ui/src/components/<Navn>.tsx`, registreret i `LassoView.tsx` (`renderComponent`) og eksporteret fra `packages/ui/src/index.ts`. CSS i `styles.css` under en overskrift med artboard-nummer. Grafer som ren SVG uden chartbibliotek. `useWidth` til bredde.
4. **Tekstkort** i `apps/server/src/data/card.ts` (samme bredde på alle linjer, ingen midterprik) og **tests** (schema i `spec.test.ts`, adapter i `adapters.test.ts`, kort i `card.test.ts`).

Tilføj også en foreløbig katalogtekst i `packages/spec/src/catalog.ts` (én linje: hvornår modellen skal vælge komponenten). Den skrives om senere efter skabelonen i trin 3.

## 4. Responsivt

Container queries på `.lasso-root` (`@container lasso (max-width: 560px)`). På mobil: tabeller bliver kortlister, rækker mindst 44 px, grafer maks 5 punkter. Ingen separat mobilkomponent. Se mobil-artboardet (26b–26e) for elementet.

## 5. Endpoints, der ikke er bekræftet

Du har ikke API-nøglen. Bekræftede svarformer står i `docs/lasso-endpoints.md`. For andre endpoints: læs docs.lassox.com med WebFetch, byg adapteren defensivt (`at()`-hjælperen i adapters.ts, alle felter valgfrie) og skriv i `docs/lasso-endpoints.md` under en ny overskrift "Ubekræftet", hvilken form du har antaget. Kendte endpoints:

- Ejergraf: `POST /modules/relations/graph` med `{ ids: ["CVR-1-…"], relationTypes: ["ownership"], enrichments: ["companyinfo"], ingoingDepth, outgoingDepth, onDate? }`
- Reelle ejere: `GET /{lassoId}/owners/beneficial`
- Risiko: `GET /modules/observations/{lassoId}`
- Regnskab (XBRL, bekræftet): `GET /{lassoId}/reports/advanced`

## 6. Færdig betyder

- `npm run typecheck` grøn, `npm run build` grøn, `npm test` grøn.
- Visuelt sammenlignet med Paper-skærmbilledet på 1200 og 390 px (render demodata med Playwright; se hvordan i `docs/design/VISUEL-TEST.md`).
- Ét commit pr. komponentgruppe med dansk commit-besked, der nævner artboard-numrene.
