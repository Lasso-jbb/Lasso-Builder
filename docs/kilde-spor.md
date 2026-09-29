# Kildevisnings-spor til fjernelse (C5)

**Opdateret:** 29.09.2026

Denne liste dokumenterer alle spor af kildevisning i koden, som C5-opgaven skal fjerne. Søgningen var case-insensitiv og omfatter: komponenter, tekster, CSS-klasser, props, tests, galleri-poster og regler.

---

## Fund-tabel

| Fil | Linje | Uddrag (≤100 tegn) | Kategori | Anbefaling |
|-----|-------|-------------------|----------|-----------|
| apps/server/src/data/summary.ts | 51 | `if (ds.source === "demo") lines.push(...)`; | datakilde-type | BEHOLD: Dataset.source er datakilde-typen, skal blive |
| apps/server/src/portal.e2e.test.ts | 188 | `assert.equal(body.dataset.source, "demo");` | test | BEHOLD: Dataset.source datakilde-type-test |
| apps/view/src/print.tsx | 2 | `import { ... printSources, ... } from "@lasso/ui";` | import | FJERN |
| apps/view/src/print.tsx | 27 | `sources: printSources(boot.dataset), fontFaces: ...` | bruger | FJERN |
| packages/spec/src/catalog.ts | 42 | `Ingen kildevisning nogen steder (Jakob 29.09 og runde 6): hverken kildelinje, 'Vis kilder (N)' eller 'Kilder' + link; answer.source vises ikke.` | regel | BEHOLD: regeltekst |
| packages/spec/src/models.ts | 123 | `sources?: { label: string; url?: string; ... }[];` | prop | BEHOLD: ContactPersonVM.sources er data-prop, skal blive |
| packages/spec/src/models.ts | 461 | `sources?: string[];` (NewsVM) | prop | BEHOLD: NewsVM.sources er data-prop, skal blive |
| packages/spec/src/models.ts | 697 | `sources?: string[];` (RiskObservationsVM) | prop | BEHOLD: RiskObservationsVM.sources er data-prop, skal blive |
| packages/ui/src/components/CompanyEvents.tsx | 97 | `<SourceLine source="CVR via Lasso" updated={events.updated} />` | komponent-brug | FJERN |
| packages/ui/src/components/CompanyMap.tsx | 299 | `{map.source ? <SourceLine source={map.source} updated={map.updated} /> : null}` | komponent-brug | FJERN |
| packages/ui/src/components/CompanyMap.tsx | 360 | `{map.source ? <SourceLine source={map.source} updated={map.updated} /> : null}` | komponent-brug | FJERN |
| packages/ui/src/components/CreditRating.tsx | 146 | `<SourceLine source={rating.source} updated={rating.updated} />` | komponent-brug | FJERN |
| packages/ui/src/components/CreditRating.tsx | 234 | `<SourceLine source={rating.source} updated={rating.updated} />` | komponent-brug | FJERN |
| packages/ui/src/components/LassoBeneficialOwners.tsx | 67 | `<SourceLine source={source} />` | komponent-brug | FJERN |
| packages/ui/src/components/LassoBeneficialOwners.tsx | 79 | `<SourceLine source={source} />` | komponent-brug | FJERN |
| packages/ui/src/components/LassoBeneficialOwners.tsx | 117 | `<SourceLine source={source} />` | komponent-brug | FJERN |
| packages/ui/src/components/LassoContactPersons.tsx | 112 | `// Jakob runde 6: ingen kildevisning (heller ikke "Kilder" + link).` | kommentar | FJERN |
| packages/ui/src/components/LassoNews.tsx | 272 | `{news.sources?.length ? <SourceLine source={news.sources.join(" og ")} ... />` | komponent-brug | FJERN |
| packages/ui/src/components/LassoTextSections.tsx | 231 | `* "Vis kilder", Jakob runde 6). Ingen genereringsdato eller kildelinje (G3).` | kommentar | FJERN |
| packages/ui/src/components/LineChart.tsx | 292 | `<SourceLine source={...} updated={industry.updated} />` | komponent-brug | FJERN |
| packages/ui/src/components/OwnershipDiagram.tsx | 261 | `const source = <SourceLine source="CVR via Lasso" updated={graph.fetchedAt} />;` | komponent-brug | FJERN |
| packages/ui/src/components/PersonFacts.tsx | 84 | `<SourceLine source="CVR via Lasso" updated={person.updated} />` | komponent-brug | FJERN |
| packages/ui/src/components/PersonRoles.tsx | 170 | `<SourceLine source="CVR via Lasso" updated={person.updated} />` | komponent-brug | FJERN |
| packages/ui/src/components/PersonRoles.tsx | 337 | `<SourceLine source="CVR via Lasso" updated={person.updated} />` | komponent-brug | FJERN |
| packages/ui/src/components/RiskObservations.tsx | 265 | `{data.checkedAt ? <SourceLine source={source} updated={data.checkedAt} /> : null}` | komponent-brug | FJERN |
| packages/ui/src/components/RiskObservations.tsx | 359 | `<SourceLine source={source} updated={data.checkedAt} />` | komponent-brug | FJERN |
| packages/ui/src/components/SavedPages.tsx | 158 | `<SourceLine source="Gemt i Lasso" />` | komponent-brug | FJERN |
| packages/ui/src/components/SourceList.tsx | 3 | `export interface SourceListItem { name: string; updated?: string; }` | komponent-def | FJERN |
| packages/ui/src/components/SourceList.tsx | 10 | `export interface SourceListProps { sources: ...; }` | komponent-def | FJERN |
| packages/ui/src/components/SourceList.tsx | 24 | `* pr. kilde (44 px rækker, navn til venstre, tid i muted til højre) og årsrapporten som 40 px række med hent-ikon. Til portalens "Om data"-sektion; kildelinjen (SourceLine) står stadig én gang pr. sektion.` | kommentar | FJERN |
| packages/ui/src/components/SourceList.tsx | 27 | `export function SourceList({ title = "Kilder og opdatering", sources, pdf, onOpenPdf }: SourceListProps)` | komponent-def | FJERN |
| packages/ui/src/index.ts | 7 | `export { ... printSources, ... } from "./print.js";` | eksport | FJERN |
| packages/ui/src/index.ts | 62 | `export { SourceList } from "./components/SourceList.js";` | eksport | FJERN |
| packages/ui/src/index.ts | 63 | `export type { SourceListProps, SourceListItem } from "./components/SourceList.js";` | eksport | FJERN |
| packages/ui/src/index.ts | 203 | `export { ... SourceLine, ... } from "./primitives.js";` | eksport | FJERN |
| packages/ui/src/pdf.test.ts | 8 | `import { ... printSources, ... } from "./print.js";` | test-import | FJERN |
| packages/ui/src/pdf.test.ts | 172 | `const { headerTemplate, footerTemplate } = pageTemplates({ ... sources: printSources(dataset()) });` | test | FJERN |
| packages/ui/src/pdf.test.ts | 180 | `assert.deepEqual(printSources(null), ["CVR"]);` | test | FJERN |
| packages/ui/src/primitives.tsx | 388 | `* Kildelinjen ("Kilde: Navn, opdateret DD.MM.ÅÅÅÅ") er UDGÅET (Jakob 29.09, G3): den vises ikke i noget element. Komponenten beholdes, så eksisterende kald stadig kompilerer, men tegner intet.` | kommentar | FJERN |
| packages/ui/src/primitives.tsx | 390 | `* Ingen anden kildevisning heller (Jakob runde 6): ingen "Vis kilder (N)" og ingen "Kilder" + link.` | kommentar | FJERN |
| packages/ui/src/primitives.tsx | 392 | `export function SourceLine(_props: { source: string; updated?: string \| null; verb?: string }) { return null; }` | komponent-def | FJERN |
| packages/ui/src/print.tsx | 54 | `* Kilderne bag siden, til sidefoden (katalog 27: "Kilder: …"): CVR altid; regnskaber, nyhedskilder, score og Creditsafe, når siden viser dem.` | kommentar | FJERN |
| packages/ui/src/print.tsx | 57 | `export function printSources(ds: Dataset \| null): string[] { ... }` | funktion | FJERN |
| packages/ui/src/print.tsx | 64 | `if (ds.source === "demo") out.push("eksempeldata");` | logik | FJERN |
| packages/ui/src/smaaelementer.test.ts | 6 | `import { SourceList } from "./components/SourceList.js";` | test-import | FJERN |
| packages/ui/src/smaaelementer.test.ts | 12 | `createElement(SourceList, { sources: [...], pdf: {...} })` | test | FJERN |
| packages/ui/src/smaaelementer.test.ts | 15 | `assert.match(html, /...<span class="lasso-sourcelist__time">i dag 06:10/);` | test | FJERN |
| packages/ui/src/smaaelementer.test.ts | 16 | `assert.match(html, /...<span class="lasso-sourcelist__time">02\.06\.2026/);` | test | FJERN |
| packages/ui/src/datatyper28.test.ts | 37 | `assert.doesNotMatch(html, /lasso-source/, "kildelinjen står pr. bekendtgørelse, ikke samlet");` | test | FJERN |
| packages/ui/src/profile.test.ts | 111 | `test("Regnskabsanalyse (19.3, LYO-0): ... uden Vis kilder (runde 6); ...` | test-navn | FJERN |
| packages/ui/src/profile.test.ts | 120 | `assert.doesNotMatch(html, /Vis kilder\|Skjul kilder/);` | test | FJERN |
| packages/ui/src/profile.test.ts | 124 | `assert.doesNotMatch(html, /lasso-source/);` | test | FJERN |
| packages/ui/src/LassoView.tsx | 313 | `demo={empty.source === "demo"}` | datakilde-type-ref | BEHOLD: Dataset.source datakilde-type |
| packages/ui/src/LassoView.tsx | 442 | `demo={empty.source === "demo"}` | datakilde-type-ref | BEHOLD: Dataset.source datakilde-type |
| packages/ui/src/LassoView.tsx | 457 | `demo={empty.source === "demo"}` | datakilde-type-ref | BEHOLD: Dataset.source datakilde-type |
| packages/ui/src/LassoView.tsx | 477 | `demo={empty.source === "demo"}` | datakilde-type-ref | BEHOLD: Dataset.source datakilde-type |
| packages/ui/src/LassoView.tsx | 1198 | `{dataset?.source === "demo" ? <Badge tone="demo">Demodata</Badge> : null}` | datakilde-type-ref | BEHOLD: Dataset.source datakilde-type |
| packages/ui/src/styles.css | 593 | `.lasso-source { margin: ... font-size: var(--lasso-fs-sm); ... color: var(--lasso-muted); }` | CSS | FJERN |
| packages/ui/src/styles.css | 1664 | `.lasso-personhead .lasso-source { margin-top: 2px; }` | CSS | FJERN |
| packages/ui/src/styles.css | 1701 | `.lasso-personroles .lasso-source { margin-top: var(--lasso-space-3); }` | CSS | FJERN |
| packages/ui/src/styles.css | 4533 | `.lasso-sourcelist { display: flex; flex-direction: column; gap: var(--lasso-space-3); }` | CSS | FJERN |
| packages/ui/src/styles.css | 4534 | `.lasso-sourcelist__title, .lasso-snapshot__title { ... }` | CSS | FJERN |
| packages/ui/src/styles.css | 4535 | `.lasso-sourcelist__rows { list-style: none; margin: 0; padding: 0; border-top: ... }` | CSS | FJERN |
| packages/ui/src/styles.css | 4536 | `.lasso-sourcelist__row { display: flex; justify-content: space-between; ... }` | CSS | FJERN |
| packages/ui/src/styles.css | 4537 | `.lasso-sourcelist__name { color: var(--lasso-text-2); min-width: 0; }` | CSS | FJERN |
| packages/ui/src/styles.css | 4538 | `.lasso-sourcelist__time { flex: none; font-size: 12px; color: var(--lasso-muted); }` | CSS | FJERN |
| packages/ui/src/styles.css | 4539 | `.lasso-sourcelist__pdf { display: flex; align-items: center; ... height: 40px; ... }` | CSS | FJERN |
| packages/ui/src/styles.css | 4540 | `.lasso-sourcelist__pdf:focus-visible { outline: none; border-color: ... }` | CSS | FJERN |
| packages/ui/src/styles.css | 4560 | `.lasso-root a.lasso-sourcelist__pdf { color: var(--lasso-text); }` | CSS | FJERN |
| packages/ui/src/styles.css | 4924 | `.lasso-personrolelist .lasso-row__sub, .lasso-row__side, .lasso-source { display: none; }` | CSS | FJERN |
| tools/gallery/entries/a_felter.tsx | 221 | `"Ingen kildelinje ("Kilde: …, opdateret …") på elementerne; ingen "Vis kilder (N)" og ingen "Kilder" + link..."` | guide-tekst | FJERN |
| tools/gallery/entries/e_guide_data.ts | 77 | `"Ingen kildelinje ("Kilde: …, opdateret …") på elementerne; ingen "Vis kilder (N)" og ingen "Kilder" med link nogen steder..."` | guide-tekst | FJERN |

---

## Statistik

### Fund pr. kategori
- **komponent-brug**: 13 (LassoNews, CreditRating, PersonRoles osv. bruger SourceLine)
- **komponent-def**: 5 (SourceList, SourceListItem, SourceListProps definitioner)
- **CSS**: 12 (lasso-source og lasso-sourcelist klasse-families)
- **test**: 10 (assertions og test-data med kilder)
- **eksport**: 4 (index.ts re-exports af SourceList, SourceLine, printSources)
- **funktion**: 2 (printSources i print.tsx)
- **kommentar**: 6 (Jakob-bemærkninger om kildevisning)
- **datakilde-type**: 9 (dataset.source === "demo", skal BEHOLD)
- **test-import**: 2 (pdf.test.ts, smaaelementer.test.ts)
- **logik**: 1 (ds.source === "demo" i printSources)
- **import**: 2 (apps/view og packages/ui)
- **guide-tekst**: 2 (tools/gallery guide-data)
- **regel**: 1 (catalog.ts "Ingen kildevisning..." regel)
- **prop**: 3 (NewsVM.sources, RiskObservationsVM.sources, ContactPersonVM.sources - skal BEHOLD)

### Filer der kan slettes helt
- **packages/ui/src/components/SourceList.tsx** — hele komponenten + interfaces SourceListItem, SourceListProps (brug 1: smaaelementer.test.ts test)
- **Ingen andre filer kan slettes helt** — alle andre filer indeholder anden logik

### Filer der skal rettes
1. **packages/ui/src/print.tsx** — fjern `printSources` funktion + kommentarer + reference i print.tsx
2. **packages/ui/src/primitives.tsx** — fjern `SourceLine` komponent + kommentarer
3. **packages/ui/src/index.ts** — fjern eksporter af SourceList, SourceLine, SourceListProps, SourceListItem, printSources
4. **packages/ui/src/components/*.tsx** (13 filer) — fjern `<SourceLine .../>` kald fra CompanyEvents, PersonFacts, LassoBeneficialOwners, LassoNews, ScoreHistory, CreditRating, PersonRoles, LineChart, SavedPages, OwnershipDiagram, RiskObservations, CompanyMap
5. **packages/ui/src/components/LassoContactPersons.tsx** — fjern kildevisnings-kommentar
6. **packages/ui/src/components/LassoTextSections.tsx** — fjern kildevisnings-reference i kommentar
7. **packages/ui/src/styles.css** — fjern alle `.lasso-source*` CSS-regler (ligner 28 linjer)
8. **packages/ui/src/smaaelementer.test.ts** — fjern SourceList-test helt
9. **packages/ui/src/profile.test.ts** — opdater test-navn og fjern assertions om `Vis kilder` og `lasso-source`
10. **packages/ui/src/datatyper28.test.ts** — fjern assertion om `lasso-source`
11. **packages/ui/src/pdf.test.ts** — fjern printSources-references og test
12. **apps/view/src/print.tsx** — fjern printSources-import og -brug
13. **tools/gallery/entries/a_felter.tsx** — opdater guide-tekst om kildevisning
14. **tools/gallery/entries/e_guide_data.ts** — opdater guide-tekst om kildevisning

---

## Vigtige noter

1. **BEHOLD altid:**
   - `Dataset.source` som datakilde-type ("demo" / "live") — bruges til at mærke demodata
   - `NewsVM.sources`, `RiskObservationsVM.sources`, `ContactPersonVM.sources` — disse er data-props som bruges fra backend
   - Katalog-reglen "Ingen kildevisning nogen steder..." i catalog.ts
   - Alle datakilde-type-referencer i LassoView.tsx

2. **SourceLine komponent:** Returnerer allerede `null` — den er deaktiveret men brugt forkert rundt omkring

3. **printSources funktion:** Bruges til sidefoden af PDF-rapporter, skal fjernes helt

4. **CSS:** Alle `.lasso-source*` CSS-regler har ingen effekt da komponenten tegner `null`, men skal fjernes for rent code

