# Lassos designkatalog

Facit er Paper-filen **"Lasso Portal - Designguide"** (id `01M1GZGSTYBM43XSSD4JHQ0ADG`), siden **Designkatalog**, 43 artboards (01–28, 29 Fanebjælke, 30 Layout). Er der modstrid mellem kataloget og koden, vinder kataloget. Alt tidligere design er udgået.

Tokens står i `packages/ui/src/styles.css`. Komponenterne bruger kun CSS-variablerne derfra.

## Faste regler (01, guide 23)

1. Status er ren tekst i vægt 500. Ingen piller, prikker eller farvede flader.
2. Ingen dekorative piller eller badges. Tællere står aldrig på faner.
3. Hvid flade overalt. Opdel med tynde linjer og luft, aldrig hvide kort på grå baggrund.
4. Ingen farvede bannerbokse. AI-analyser er almindelige sektioner med kildelinje og intet "Skrevet af AI"-mærke.
5. Navne står alene: ingen initial-cirkler eller ikonkasser.
6. Ingen midterprik nogen steder. Brug komma.
7. Ikon + ord ved enhver farvekodning, aldrig kun farve.
8. Kildelinje én gang pr. sektion: "Kilde: Navn, opdateret DD.MM.ÅÅÅÅ" (`SourceLine`).
9. Flere værdier end formen kan vise: vis 3 + "Se N …".
10. Risikoskala 0 (lav) til 100 (høj). Fire trin: 0 neutral, 25 info, 50 mulig vigtig, 100 vigtig.

## Fem tilstande

Alle elementer har **fyldt**, **henter** (skelet i samme højde), **tom** (siger hvorfor, stiplet ramme, aldrig "0"), **ikke oplyst** ("Ikke oplyst" eller "—" i text-faint) og **fejl** (kun teknisk fejl, med "Prøv igen"). Brug `DataState` fra `packages/ui/src/primitives.tsx`.

## Talformat (09)

- Beløb: `842 t. kr.`, `18,8 mio. kr.`, `2,4 mia. kr.`
- Tal `1.243.501`, procent med én decimal og mellemrum: `17,3 %`
- Negative tal med ægte minus `−201`, aldrig parentes
- Udvikling ▲/▼ + procent; skifter fortegnet, vises kun pilen
- Dato `15.04.2026`

Alt dette ligger i `packages/spec/src/format.ts`.

## Grid og rækkefølge (06, guide 23)

4-kolonne-grid i midten, kun bredderne ¼, ½, ¾ og fuld. Nøgletalskort deler fuld bredde (3–5), grafer er mindst ½, tabeller altid fuld bredde. Flere grafer på hver sin fane, aldrig stablet på et overblik.

Virksomhedsside: hoved, risiko (kun ved 50+), nøgletal, én graf ved siden af nøgle-værdi-listen, personer og ejere, historik og nyheder.

## Datatype → element (guide 23, trin 4)

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
| Kreditvurdering (Creditsafe A–E) | Kreditvurdering | 17 |
| Personer og roller | Rolleliste, tidsbånd, netværk | 11, 16 |
| Ejerskab | Ejerliste med interval-bjælke, ejerdiagram | 11, 14 |
| Mange virksomheder | Tabel med værktøjslinje og paginering | 15 |
| Begivenheder over tid | Tidslinje, ændringsfeed | 12, 21 |
| Gemte sider | Liste med åbn og fjern (samme rækkemønster som personlisten) | 11 |

## Responsivt (26–26h)

1440 → 1200 (panel under midten) → 960 (skinnen skjules) → 768 (to kolonner, maks 6 tabelkolonner) → 390 (én kolonne). På mobil bliver tabeller til kortlister og ejerdiagrammet til en liste, rækker er mindst 44 px, grafer viser maks 5 punkter. Kun brudpunkter, ingen separate mobiludgaver.

## Faner, layout, navigation, dialoger, overvågning og eksport (06, 07, 21, 27, 29, 30)

Bygget på `feat/faner`. Alt ligger i `packages/ui` og eksporteres fra `@lasso/ui`; kun overvågningsfeedet er en spec-komponent med data.

### Fanebjælke, tre niveauer (29, node `IWE-0`)

Én komponent, `Tabs`, styret udefra, så indholdet kan hentes ved skift. Niveauerne skelnes på højde, skrift og vægt, aldrig på farve. Kun navnet på fanen: aldrig tal, badge eller prik. Valgt fane har aldrig mørkt fyld. Højst tre niveauer over hinanden, og to bjælker på samme niveau står aldrig direkte over hinanden.

```ts
<Tabs level={1|2|3} items={[{ id, label, disabled?, disabledReason? }]} value={id} onChange={(id) => …} ariaLabel="…" id? maxVisible? />
<TabPanel id={sammeId} tab={id} loading? loadingHeight? loadingLabel="Økonomi">…</TabPanel>
```

| Niveau | Hvor | Mål | Valgt | Eksempel |
|---|---|---|---|---|
| 1, side | under virksomheds-/personhovedet og i portalens modulbjælke (06) | 48 px, 14, gap 28, 1 px divider under | ink 600 + 2 px koral streg | `<Tabs level={1} items={[Overblik, Økonomi, Ejerskab]} …/>` med `TabPanel` under, der viser skelet mens fanens data hentes. Over 8 faner: "Flere" som `Menu`. |
| 2, sektion | inde i en sektion, altid under sektionsoverskriften | 36 px, 13, gap 20, divider-subtle under | ink 600 + 1 px ink-streg | Regnskab → `Resultatopgørelse, Balance, Pengestrøm` (19); Notifikationer → `Ulæste, Alle, Overvågning` (21). Højst 6. |
| 3, element | i elementets hoved (`Section action`), skifter kun elementets egen visning | segmentkontrol 32 px, 13, 1 px kant radius 8 | 1 px ink-kant + 600, hvid flade | Årsvælger i `KeyValueList` (09), `Nuværende/Alle` i `PersonList` (11), selskab/koncern (19). Højst 4; på mobil fuld bredde 44 px, over 3 segmenter en dropdown. |

Tilstande: hvile, hover (tekst ink + divider-streg), valgt, fokus (1 px koral kant, kun tastatur), deaktiveret (45 % + `disabledReason` som tooltip). Tastatur: kun den valgte fane i tab-rækkefølgen, pil venstre/højre flytter og vælger, Home/End, deaktiverede springes over. Mobil: niveau 1 og 2 ruller vandret med fade i kanten, den valgte rulles ind i syne.

### Layout, fra spørgsmål til skærm (30, node `J48-0`)

`LAYOUT_RULES` i `packages/spec/src/catalog.ts` står i `render_view`-beskrivelsen efter `COMPOSITION_RULES` og er det, modellen slår op i: tre svarniveauer (A Element, B Sektion, C Side), ni mønstre (1 Overblik, 2 Fokus, 3 Ligeværdige, 4 Liste først, 5 Sammenligning, 6 Tidslinje, 7 Fortælling, 8 Kortgitter, 9 Harmonika) og foldreglerne på 1440/768/390. Mønster 1–7 tegnes med bredderne ¼/½/¾/fuld og `column` i `LassoView`; 8 og 9 har egne primitiver:

```ts
<CardGrid>…artikler…</CardGrid>                       // to kolonner, én på mobil, luft og tynde linjer
<Accordion items={[{ id, title, meta?, children }]} open? onToggle? defaultOpen? single? />   // 48 px rækker, aria-expanded
```

Modulværktøjslinjen (56 px under modulbjælken, primær handling til venstre, visningsvalg til højre) er `ModuleToolbar` (06).

### Navigation og sideskabelon (06, node `9I4-0`; mobil 26a)

```ts
<AppShell rail={RailProps} tabs={TabStripProps} mobile?={{ title, subtitle?, sections?, activeSection?, onSelectSection?, actions?, onMore?, unread?, onBell?, nav?, sheetOpen?, onToggleSheet? }}>
  <ModuleBar modules={TabItem[]} value onChange actions?={[{ id, label, icon?, tone?: "accent", menu?, onSelect }]} />
  <ModuleToolbar primary?={{ label, onClick }} secondary?=[…] controls?={<Tabs level={3} …/>} />
  <Columns count={3}><Column>…</Column><Column>…</Column><Column>…</Column></Columns>
</AppShell>
```

`Rail({ groups: [{ id, label, collapsed?, items: [{ id, label, icon?: ReactNode | "letter", active?, onSelect }], footer? }], activeItem?, onToggleGroup? })` er skinnen (Værktøjer, Firmaer, Personer), `TabStrip({ tabs, onSelect, onClose, onAdd, unread?, onBell?, onFeedback?, onAccount? })` er fanebjælken med åbne virksomheder og klokken (`MonitorBell`). Modulbjælken bruger `Tabs level={1}`; hvert punkt er et modul, kunden vælger selv hvilke. Kroppen er tre lige brede kolonner adskilt af 1 px linjer. Mobil: topbjælke 52 px med burger (sektionsark), bundnavigation 56 px, én kolonne. Tablet: skinne 64 px med ikoner, 5 moduler + Flere.

### Dialoger, menuer og beskeder (07, node `9L1-0`)

```ts
<Dialog open title description? onClose actions={{ primary?, secondary?, destructive? }} size?="sm|md">…</Dialog>   // 520 px, radius 14, bundark på mobil
<Menu trigger items={[{ id, label, icon?, destructive?, disabled?, onSelect }]} align? context?={{ title, subtitle }} />   // handlingsark på mobil
<Picker groups={[{ label, items }]} value onChange />                                                                    // valgt = koral-soft + flueben
const { show } = useToast(); show({ text, tone?: "ok"|"error", action?: { label, onClick }, ttl? })                       // nederst i midten, 5 sek., stakkes
<Tooltip text="…">…</Tooltip>                                                                                              // maks 280 px, mørk
```

`SaveDialog` bygger på `Dialog`; "Link kopieret" i `LassoView` er en toast. Fokus = 1 px koral kant, Esc lukker, fokusfælde i dialogen.

### Overvågningsfeed og notifikationer (21, node `CA3-0`)

Spec-komponent `LassoChangeFeed { list?, days? (7), types?, title? }` → `ChangeFeedVM` (`apps/server/src/data/provider.ts changeFeed`), UI `ChangeFeed`. Ændringstyper: regnskab, ledelse, ejerskab, status, stamdata, kredit. Ulæst = koral prik + 3 px koral venstrekant; status som "Aktiv → Under konkurs"; små ændringer af samme type foldes til "5 virksomheder". Rene UI-komponenter til portalen: `NotificationPanel({ items, onMarkAllRead?, onAction?, onSeeAll? })` (380 px, faner niveau 2), `MonitorSettings({ companyName, monitoring, listName?, since?, settings, onToggle?, onStop? })` og `MonitorBell({ unread, important? })`. Live-endpointet er ubekræftet, se `docs/lasso-endpoints.md`.

### A4-eksport (27, node `DO8-0`)

`ReportA4({ company, dataset, generatedAt? })` tegner op til fire A4-sider (forside, nøgletal + graf + ledelse/ejere, regnskab 5 år, kreditvurdering/risiko/reelle ejere/revisor) uden interaktion; `@media print` giver ét ark pr. side. `LassoView` viser knappen "Eksportér PDF" (host.export, spec.kind "company") med Print og Luk. Preview: `npx tsx apps/server/src/dev/render-preview.ts <mappe> --report CVR-1-99000001`.

## Tabeller, massehandlinger og persontabel (15, mobil 26c)

`CompanyTable` har værktøjslinjen (søg i resultatet, `Filtre (n)` der åbner `FilterSheet`, kolonnevalg, eksport), afkrydsning med `BulkBar` (15.2: "N markeret, vælg alle", handlinger, luk; destruktiv som rød tekst), 25 rækker pr. side med `Pagination` (aktiv side ink 600 + 2 px streg) og tilstande inde i rammen (`TableStateRows`, hovedet står). Under 560 px bliver den en kortliste (navn + status, CVR og by, tynd linje, tre nøgletal + score) med fjernbare filterchips. `LassoPersonTable { query, limit? }` (15.3) er samme tabel med personer: navn alene, fødselsår og by, 2 roller + "og n flere", konkurser kun > 0. Delene ligger i `components/TableKit.tsx`.

Ejerdiagrammet (14, layoutregel 3) har Legale/Reelle ejere, datovælger (klientsidet ud fra registreringsdatoer), dobbeltklik for nyt fokus, mini-kort med viewport-ramme og eksport til PNG/PDF af hele grafen med legende og dato (`ownershipExport.ts`, `print.ts`).
