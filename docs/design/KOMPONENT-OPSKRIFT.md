# Opskrift: én ny komponent

Gælder alle nye komponenter. Mønstret er sat af de syv første: `packages/ui/src/components/CompanyHead.tsx`, `KeyFigureCards.tsx`, `BarChart.tsx`, `PersonList.tsx`, `OwnerList.tsx`, `CompanyTable.tsx`, `CompareTable.tsx`. Læs mindst to af dem, før du begynder.

## 0. Designet kommer fra koden

Designet er komplet i koden (Jakob 30.09.2026); Paper bruges ikke, når nye moduler og komponenter udvikles.

1. Find det nærmeste element i galleriet (`tools/gallery/entries/*.tsx`, mærket med katalognummer, fx 09.5) og i `docs/design/README.md`. Byg videre på de eksisterende komponenter og deres klasser; en ny variant bruger samme typografi og mønstre som et eksisterende element (fx virksomhedskortet 08.7, "Hent regnskabet" og "Se alle" i 09.5).
2. Tegn galleriet (`npx tsx tools/gallery/build.ts <ud-mappe>`, `node tools/gallery/shoot.mjs <ud-mappe> <nr>`) og sammenlign dit element med det.
3. Tokens står i `packages/ui/src/styles.css`. Brug KUN CSS-variablerne derfra; aldrig hex i komponenten.
4. Et nyt element får sin egen indgang i galleriet med katalognummer, så designet forbliver komplet i koden.

## 1. Faste regler (bryd dem aldrig)

1. Status er ren tekst i vægt 500. Ingen piller, prikker eller farvede flader.
2. Ingen dekorative badges. Tællere aldrig på faner.
3. Hvid flade. Opdel med tynde linjer og luft, aldrig kort på grå baggrund. Brug `Section` fra `primitives.tsx`.
4. Ingen farvede bannerbokse. AI-tekst er en almindelig sektion med kildelinje, uden "Skrevet af AI".
5. Navne står alene: ingen initial-cirkler eller ikonkasser.
6. **Ingen midterprik (·) nogen steder, heller ikke i resuméet.** Brug komma.
7. Ikon eller ord ved enhver farvekodning, aldrig kun farve.
8. UDGÅET (Jakob 29.09, G3): ingen kildelinje i elementerne (der findes ingen kildelinje-komponent).
9. Flere værdier end formen kan vise: 3 + "Se N …".
10. Risikoskala 0 (lav) til 100 (høj).

Tal: brug `formatAmount`, `formatNumber`, `formatPercent`, `formatDate`, `amountScale`, `formatScaled` fra `@lasso/spec`. Aldrig egne talformater.

## 2. Fem tilstande

Brug `DataState` fra `primitives.tsx`: henter (`loading`, samme højde som fyldt), tom (`empty`, med en `reason` der siger hvorfor, aldrig "0"), ikke oplyst (`notreported`, eller `Missing` for én værdi), fejl (`error`). Fyldt tegner komponenten selv.

## 3. De fire dele af en komponent

1. **Schema** i `packages/spec/src/spec.ts`: et zod-objekt med `type: z.literal("Lasso…")` og tilføj det til `componentSchema`. Navn: `Lasso` + engelsk navn efter katalogelementet.
2. **Data**: en normaliseret model i `packages/spec/src/models.ts` og et felt i `Dataset` (+ `emptyDataset`). Metode i `DataProvider` (`apps/server/src/data/provider.ts`), implementeret i `LiveProvider` (`live.ts`, via adapter i `apps/server/src/lasso/adapters.ts` og klient i `client.ts`) OG i `DemoProvider` (`demo.ts`, med eksempeldata, hvor alle navne indeholder "Eksempel" eller "Prøve"). Registrér behovet i `resolveSpec` (`resolve.ts`). UI'en kalder aldrig API'er.
3. **React-komponent** i `packages/ui/src/components/<Navn>.tsx`, registreret i `LassoView.tsx` (`renderComponent`) og eksporteret fra `packages/ui/src/index.ts`. CSS i `styles.css` under en overskrift med artboard-nummer. Grafer som ren SVG uden chartbibliotek. `useWidth` til bredde.
4. **Resumé** i `apps/server/src/data/summary.ts` (tekstkortet er udgået) og **tests** (schema i `spec.test.ts`, adapter i `adapters.test.ts`, resumé i `summary.test.ts`).

Tilføj også en foreløbig katalogtekst i `packages/spec/src/catalog.ts` (én linje: hvornår modellen skal vælge komponenten). Den skrives om senere efter skabelonen i trin 3.

## 4. Responsivt

Container queries på `.lasso-root` (`@container lasso (max-width: 560px)`). På mobil: tabeller bliver kortlister, rækker mindst 44 px, grafer maks 5 punkter. Ingen separat mobilkomponent. Mobilformen står i galleriet ved elementets egen tavle (mobilbilledet 390 og de mobile indgange, fx 26c.3 ved 10 og 15.2b ved 15).

## 5. Endpoints, der ikke er bekræftet

Du har ikke API-nøglen. Bekræftede svarformer står i `docs/lasso-endpoints.md`. For andre endpoints: læs docs.lassox.com med WebFetch, byg adapteren defensivt (`at()`-hjælperen i adapters.ts, alle felter valgfrie) og skriv i `docs/lasso-endpoints.md` under en ny overskrift "Ubekræftet", hvilken form du har antaget. Kendte endpoints:

- Ejergraf: `POST /modules/relations/graph` med `{ ids: ["CVR-1-…"], relationTypes: ["ownership"], enrichments: ["companyinfo"], ingoingDepth, outgoingDepth, onDate? }`
- Reelle ejere: `GET /{lassoId}/owners/beneficial`
- Risiko: `GET /modules/observations/{lassoId}`
- Regnskab (XBRL, bekræftet): `GET /{lassoId}/reports/advanced`

## 6. Færdig betyder

- `npm run typecheck` grøn, `npm run build` grøn, `npm test` grøn.
- Visuelt sammenlignet med galleriet på 1200 og 390 px (render demodata med Playwright; se hvordan i `docs/design/VISUEL-TEST.md`).
- Ét commit pr. komponentgruppe med dansk commit-besked, der nævner artboard-numrene.
