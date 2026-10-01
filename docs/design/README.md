# Lassos designkatalog

Facit er koden: komponenterne i `packages/ui`, tokens i `packages/ui/src/styles.css` og galleriet i `tools/gallery` (hvert element tegnet fra koden og mærket med sit katalognummer, fx 09.5), sammen med reglerne i denne fil. Designet skal være komplet i koden; nye moduler og sider sættes op ud fra komponenterne og galleriet, ikke ud fra Paper (Jakob 30.09.2026). Paper-filen "Lasso Portal - Designguide" (id `01M1GZGSTYBM43XSSD4JHQ0ADG`) er kun historisk kilde; katalognumrene og node-id'erne i galleriet peger stadig derhen.

Tokens står i `packages/ui/src/styles.css`. Komponenterne bruger kun CSS-variablerne derfra.

## Designguiden (/designguide)

Designguiden på `/designguide` er den samlede, levende udgave af alt det her. Den bygges fra koden ved hver build (`npm run build -w @lasso/view`), så den altid viser det, der kører:

- **Fundament**: alle tokens fra `styles.css` med lys og mørk værdi, kontrast mod fladen og linjen i filen, plus galleriets tavle 01 og 01b.
- **Moduler**: hver komponent i kataloget med rigtige data, tegnet i hver bredde, gitteret tillader (min til maks i `GRID_RULES`), og i standardbredden på portal 1440, desktop 1200, chat 760, tablet 834 og mobil 390. Hver bredde tegnes i en rigtig skærmbredde (iframe), så container- og media-queries er dem, modulet får. Hver ramme tjekkes automatisk for overløb, vandret rulning og afkortet tekst. Faner for tilstande (henter, fejl, ingen adgang og de andre virksomheders data), tekster, brug og props.
- **Galleriet**: alle elementer fra `tools/gallery` med katalognummer, på desktop og mobil.
- **Hele sider**: `show_company` og `show_person` for hvert fokus med live-data på hver skærm.
- **Tekster**: al brugervendt tekst i `packages/ui` og de brugervendte filer i `packages/spec`, med fil og linje.
- **Validering**: alle moduler i alle bredder på én gang, med resultatet i en matrix.
- **Regler**: denne fil og de andre filer i `docs/design`.

### Kommentarer

Alt i designguiden kan kommenteres: slå **Kommentér** til i topbjælken og klik i et modul, et element eller en hel side for at sætte en nål; tokens, tekster og hver side har en kommentarknap. En kommentar gemmer, hvad den handler om (modultype, bredde, skærm, tilstand, data, tema og elementet under nålen), så den kan findes i koden. De åbne kommentarer er arbejdslisten på `/designguide/kommentarer.md`; når en kommentar er rettet, sættes den til **Rettet** med et svar og commit (`PATCH /designguide/api/kommentarer/:id` med `{ status, reply, commit }`), og svaret står ved nålen. Alle må skrive kommentarer; sættes `DESIGNGUIDE_KEY`, kræver skrivning nøglen. Kommentarerne gemmes i Postgres (`designguide_comments`).

Kildeudtrækket laves af `apps/view/scripts/designguide-source.ts` (tokens, tekster, kildefiler pr. modul, dokumenter og galleriets demodata). Et nyt modul i kataloget, en ny tavle i galleriet, et nyt token eller en ny tekst kommer med af sig selv; kun gruppen i menuen (`apps/view/src/designguide/structure.ts`) sættes i hånden, ellers står det under "Øvrige". Uden Lasso-nøgler bruger guiden demovirksomhederne (`SHOWCASE_DEMO`).

## Faste regler (01, guide 23)

1. Status er ren tekst i vægt 500. Ingen piller, prikker eller farvede flader. Farven følger ordet (se "Status" nedenfor).
2. Ingen dekorative piller eller badges. Tællere står aldrig på faner.
3. Hvid flade overalt. Opdel med tynde linjer og luft, aldrig hvide kort på grå baggrund.
4. Ingen farvede bannerbokse. AI-analyser er almindelige sektioner uden kildelinje og uden "Skrevet af AI"-mærke.
5. Navne står alene: ingen initial-cirkler eller ikonkasser.
6. Ingen midterprik nogen steder. Brug komma.
7. Ikon + ord ved enhver farvekodning, aldrig kun farve.
8. UDGÅET (Jakob 29.09, G3): ingen kildelinje ("Kilde: …, opdateret …") i nogen elementer. `SourceLine` tegner intet og bruges ikke. Heller ingen anden kildevisning (Jakob runde 6): ingen "Vis kilder (N)" (19.3, 30.2) og ingen "Kilder" + link (08.7, 08.9-08.11).
9. Flere værdier end formen kan vise: vis 3 + "Se N …".
10. Risikoskala 0 (lav) til 100 (høj). Fire trin: 0 neutral, 25 info, 50 mulig vigtig, 100 vigtig.
11. Grupperede navnelister (personer og virksomheder under et gruppenavn, fx Direktion, Bestyrelse, Legale ejere, Reelle ejere; 11.1): gruppenavnet i 13/600 tekstfarve, hvert navn på sin egen linje i 14/400 tekstfarve (aldrig 500 eller koral i hvile; koral og understregning kun ved hover og fokus, når navnet kan åbnes), note efter navnet ("(formand)") og "og N flere" i 13/400 muted. Gælder overalt, også i sideskabelonens tre kolonner (Jakob 30.09.2026).
12. To former for "mere" (Jakob 30.09.2026): en liste eller folder, der folder sig ud på stedet, får linket "Vis alle N ›" (koralt, 14/500, pil til højre; "Vis færre" med pil op, når den er foldet ud; `ExpandLink`). Åbner handlingen en ny prompt eller en anden visning (fane, fokus, spørgsmål til Claude), er den en knap med kant og "→" som de opfølgende spørgsmål (`PromptLink`, `LassoFollowUps`). Ingen "og N flere", "Se N oplysninger" eller "Vis flere" som udfoldning.

## Generelle regler fra Jakobs gennemgang (29.09.2026)

- G1: Knapper vises kun, når de har en funktion (værtens kapabilitet eller handler findes). En segmentkontrol med ét valg tegnes ikke.
- G2: Ikoner ved en værdi (telefon, e-mail) vises kun, når der er data; ingen dæmpede ikoner for manglende kanaler.
- G3: Ingen kildelinje nogen steder (se regel 8).
- G5: Ingen "Gem", "Gem visning" eller "Opdatér" på elementer; data kommer i realtid. Gem hører kun til sidens hoved (gem-laget).
- G7: Tankestreg "-" som skilletegn i tekst erstattes af bindestreg "-". Intervaller (66,67–89,99 %) beholder tankestreg; "-" for manglende værdi i tabeller afventer Jakob.
- G8: Luk er altid et ×-ikon (ikonknap med aria-label "Luk"), aldrig ordet "Luk".
- G9: Hoveder viser kun navnet (virksomhed: med status og binavn). Ingen faktalinje (CVR, adresse, ansatte …) under navnet og ingen skillestreg under hovedet. Identiteten står i nøgle-værdi-listen, adressen i kontaktblokken.
- Faner: kun faner, der har data, vises (ingen deaktiverede faner, alle niveauer).
- Skeletter er i bevægelse (shimmer), når der hentes; stille ved prefers-reduced-motion.

## Fem tilstande

Alle elementer har **fyldt**, **henter** (skelet i samme højde), **tom** (siger hvorfor, stiplet ramme, aldrig "0"), **ikke oplyst** ("Ikke oplyst" eller "-" i text-faint) og **fejl** (kun teknisk fejl, med "Prøv igen"). Brug `DataState` fra `packages/ui/src/primitives.tsx`.

## Talformat (09)

- Beløb: `842 t. kr.`, `18,8 mio. kr.`, `2,4 mia. kr.`
- Tal `1.243.501`, procent med én decimal og mellemrum: `17,3 %`
- Negative tal med ægte minus `−201`, aldrig parentes
- Beløb + ændring (02c.4): kun pil + procent i grøn (stigning) eller rød (fald): `48,3 mio. kr. ▲ 12,4 %`, `3,4 mio. kr. ▼ 15,1 %`. Ingen ord efter procenten ("stigning", "fald", "fra 2024", "underskud"). Ved fortegnsskift vises stadig pil + procent (`changePercent`: (nu − forrige) / |forrige|); kan ændringen ikke beregnes (intet forrige år eller forrige = 0), vises ingen ændring. Gælder nøgletalskort, nøgle-værdi, tabeller, grafer, A4-rapport og tekstkort.
- Procent (02c.5): kun den ene procent; ingen anden procent eller sammenligning efter (ingen "branchen 11,2 %").
- Liste af værdier (02c.9): "og 1 mere" ved én ekstra, "og N flere" ved to eller flere, overalt hvor der opsummeres (`moreText`, `listParts`).
- Reference til virksomhed (02c.13): kun navnet, ingen undertekst (CVR, rolle eller andel). Personreferencer må have "Siden <dato>" (`EntityRef kind`).
- Dato `15.04.2026`. Datofelt "mellem" (02a.6, 02b.10): fra-dato og til-dato; til-datoen kan ikke vælges før fra-datoen (dagene før er deaktiverede i kalenderen), og en indtastet til-dato før fra-datoen afvises med fejlteksten "Til-datoen kan ikke være før fra-datoen." (`DATE_RANGE_ERROR`).

Alt dette ligger i `packages/spec/src/format.ts`.

## Status (02c.8, 05.7, 28.1)

Alle 19 CVR-statusser står som ren tekst i vægt 500 med dansk navn; CVR's originalnavne (`NORMAL`, `OPLØSTEFTERKONKURS`, `UNDERREASSUMERING`/`UNDERREASUMMERING` …) mappes med `statusLabel`. Farven følger ordet (`statusGroup` i `packages/spec/src/status.ts`, `statusTone` i `primitives.tsx`), og ordet bærer altid betydningen (regel 7):

| Gruppe | Farve | Statusser |
|---|---|---|
| Aktiv | tekstfarve | Aktiv, Normal |
| Midlertidig, ikke krise | gul (warning-tekst) | Fremtid, Uden retsvirkning, Under frivillig likvidation, Under reassumering |
| Problem | rød (mørk rød som konkurs) | Under konkurs, Under tvangsopløsning, Under rekonstruktion, Tvangsopløst, Opløst efter konkurs |
| Inaktiv | muted (som Ophørt) | Ophørt, Opløst, Opløst efter erklæring, Opløst efter frivillig likvidation, Opløst efter fusion, Opløst efter grænseoverskridende fusion, Opløst efter spaltning, Slettet |

`statusKind` i modellen siger stadig kun, om virksomheden er i drift (`active`), i et forløb (`warning`) eller afsluttet (`inactive`); "Opløst efter konkurs" er afsluttet, men farves som problem.

## Teknologi (02b.2, 03.3, 03.4)

Teknologier er grupperet i typer (fx CRM-system, Live chat, Digital marketing); en gruppe uden type bruges ikke. Pr. type slår til/fra-kontakten foran rækken kriteriet til og fra. Operator-dropdown'en har tre valg: "Firmaer der benytter et <type>" (kun typen, intet søgefelt), "Inkluder kun følgende" og "Ekskluder følgende" (produkt-tags + "Søg efter flere…"). `TechnologyField`/`TechnologyRow`.

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

Brudpunktsregler (26, node `DH5-0`; guide 23 trin 7) og hvor de står i `styles.css`:

| Bredde | Sideskabelon (`AppShell`, container = hele portalen) | Midten (`LassoView`, container = selve visningen) |
|---|---|---|
| ≥ 1200 | Skinne 236 + midte + panel 336 (`panel`-prop) | Midten er > 960: 4-kolonne-grid, gap 24 |
| 1024–1199 (`max-width: 1199px`) | Skinne 64 med ikoner; panelet falder ned under midten | - |
| ≤ 960 (`max-width: 960px`) | Skinnen skjules; fanebjælke + midte, bundnavigation | Tablet: 2 kolonner, ½ + ½ holder, ¼ og ¾ bliver fuld, gap 16; kolonnebånd 3 → 2 + 1, ¾ + ¼ stables. Chatten (640–900 px) står her. |
| < 768 (`max-width: 767px`) | Mobil: topbjælke 52 med "Sektioner", ingen fanebjælke, én kolonne, panelet nederst, padding 16 | - |
| ≤ 560 (`max-width: 560px`) | - | Mobil: én kolonne, gap 12, elementernes mobilformer (kortlister, 2 × 2 nøgletal, 44 px). Kun Claude på mobil (390) rammer den; chatten gør aldrig (30). |

Midtens brud er lavere end skærmens, fordi containeren er midten: ved skærm 1200 er midten ~960 px.

## Lasso-side (layout `page`, galleri 06.5)

Portalens side som genbrugelig sideform til nye sider og til visninger i en chat via MCP (Jakob 30.09.2026). Sættes med `layout: "page"` på specen og `column: 1 | 2 | 3` på komponenterne; en komponent uden `column` står i fuld bredde med samme sideluft (fx Stamoplysninger). Bredderne (`width`) bruges ikke i denne form. CSS'en står i `styles.css` under "Lasso-side", renderingen i `LassoView` (`lasso-content--page`, `lasso-lpage`).

**Kolonnernes plads, 9 dele:** kolonne 1 = 2 dele (smal: virksomhedskort, genveje, score, kreditvurdering), kolonne 2 = 3 dele (midt: relationer, virksomhedsprofil), kolonne 3 = 4 dele (bred: nøgle-værdi-lister, regnskabsoplysninger, erhvervsresume). Kolonnerne adskilles af 1 px linjer, elementerne i en kolonne af 1 px linjer.

**Luft til kanterne vokser med bredden** (container-enheder, så det virker både på en hel side og i en chat):

| Token | Værdi | Bruges til |
|---|---|---|
| `--lasso-page-x` | `clamp(24px, 3.2cqi, 88px)` | luft fra tekst til kant, begge sider |
| `--lasso-page-y` | `clamp(24px, 2cqi, 56px)` | luft over og under hvert element |
| `--lasso-page-top` | `clamp(32px, 2.6cqi, 72px)` | luft over det første element i en kolonne |
| `--lasso-page-row` | `clamp(38px, 2.5cqi, 52px)` | højde på nøgle-værdi-rækker |
| `--lasso-page-gap` | `clamp(14px, 1.1cqi, 24px)` | afstand mellem blokkene i virksomhedskortet |
| `--lasso-page-label` | `clamp(140px, 36%, 300px)` | nøglekolonnens bredde i nøgle-værdi |

**Responsivt i tre trin, så siden glider** (visningens bredde): fra 1320 px 2:3:4; 660–1319 px kolonne 1 og 2 side om side (2:3) og kolonne 3 i fuld bredde under; under 660 px én kolonne. Aldrig et hop direkte fra tre kolonner til én.

**Nøgle-værdi i sideformen:** tallene står ved nøglen (venstrestillet), ikke yderst til højre. I den brede kolonne er der tre gange så meget luft mellem nøgle og værdi (`3 × --lasso-space-4`), og nøglekolonnen er `clamp(200px, 40%, 320px)`, så den længste etiket står på én linje.

**I en ramme (MCP):** sideformen går ud til rammens kant, så luften kun kommer fra `--lasso-page-x`. Uden ramme (portalen, `/komponenter`) fylder den hele fladen.

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

`packages/spec/src/ask.ts` er serverens implementering af Paper 30 for `show_company` og `show_person` med `question`: spørgsmålet ordret → spørgsmålsprofil (`parseAsk`) → en hel side med svar-elementet først og kontekst fra hele kataloget (`askPlan`, se `docs/portal.md`, "Spørgsmålet styrer formen").

`LAYOUT_RULES` i `packages/spec/src/catalog.ts` står i `render_view`-beskrivelsen efter `COMPOSITION_RULES` og er det, modellen slår op i: tre svarniveauer (A Element, B Sektion, C Side), ni mønstre (1 Overblik, 2 Fokus, 3 Ligeværdige, 4 Liste først, 5 Sammenligning, 6 Tidslinje, 7 Fortælling, 8 Kortgitter, 9 Harmonika) og foldreglerne på 1440/768/390. Mønster 1–7 tegnes med bredderne ¼/½/¾/fuld og `column` i `LassoView`; 8 og 9 har egne primitiver, som `LassoView` bruger, når sammenhængende komponenter i en spec har samme `group: { id, pattern: "cards" | "accordion", title? }` (i dashboard, i fuld bredde og inde i en kolonne; én komponent alene er ingen gruppe; harmonikaens rækkenavn er komponentens `title` eller typens navn, første række åben):

```ts
<CardGrid>…artikler…</CardGrid>                       // to kolonner, én på mobil, luft og tynde linjer
<Accordion items={[{ id, title, meta?, children }]} open? onToggle? defaultOpen? single? />   // 48 px rækker, aria-expanded
```

Modulværktøjslinjen (56 px under modulbjælken, primær handling til venstre, visningsvalg til højre) er `ModuleToolbar` (06).

### Navigation og sideskabelon (06, node `9I4-0`; mobil 26a)

```ts
<AppShell rail={RailProps} tabs={TabStripProps} panel?={ReactNode /* højre panel 336, sammendrag og handlinger */} panelLabel? mobile?={{ title, subtitle?, sections?, activeSection?, onSelectSection?, actions?, onMore?, unread?, onBell?, nav?, sheetOpen?, onToggleSheet? }}>
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

`ReportA4({ company, dataset, generatedAt? })` tegner op til fire A4-sider (forside, nøgletal + graf + ledelse/ejere, regnskab 5 år, kreditvurdering/risiko/reelle ejere/revisor) uden interaktion; i print er hver `.lasso-a4-page` præcis ét ark (210 × 297 mm, `break-after: page`, uden skygge og ramme). Preview: `npx tsx apps/server/src/dev/render-preview.ts <mappe> --report CVR-1-99000001`.

**"Gem som PDF"** står øverst til højre i hovedet på alle sider i alle tre værter (MCP-appen, delte sider og portalen), ved siden af Gem/Gemt: samme lille ikonknap (regel 21) med download-ikonet og ordet, kun ikonet under 640 px (aria-label "Gem som PDF"). `LassoView` viser den med `host.pdf` og beder værten om `{ kind: "pdf" }`; mens værten arbejder, står der "Laver PDF …", og knappen er slået fra. Den gamle "Eksportér PDF" nederst og overlay'en med Print og Luk er fjernet; "Eksportér CSV" står, hvor den stod.

Klik giver en rigtig PDF-fil, lavet på serveren med headless Chromium (`apps/server/src/pdf/`):

- **Virksomhed** (spec.kind "company"): rapporten ovenfor som A4-PDF, ét ark pr. side, vektorgrafer og sidetal "x af n". Data hentes friskt (stamdata, regnskab 5 år og fuldt regnskab, ledelse, ejere, reelle ejere, score og revisor); Creditsafe kun fra fokus risiko, fordi et opslag kan koste en kredit.
- **Alle andre sider** (person, lister, `render_view`, gemte sider og visninger): selve visningen i print-tilstand (`LassoView print`): A4 stående, 794 px bred skaleret ind mellem margenerne (`@page { size: A4; margin: 14mm }`), uden handlingsbjælke, modulbjælke, knapper og kontroller, "Se alle" og "Vis hele" foldet ud, faner (`Tabs`) som overskrift med den viste fanes navn, `break-inside: avoid` på elementerne og rækkerne (tabeller løber videre på næste ark med kolonneoverskrifterne gentaget). Sidehoved med Lasso-mærket, sidens navn og datastempel og sidefod med kilder og "side x af n" på hvert ark (Chromiums sidehoved og sidefod, `pageTemplates` i `packages/ui/src/print.tsx`).
- Filnavn: `Virksomhedsrapport <navn> <ÅÅÅÅ-MM-DD>.pdf` eller `<sidens titel> <ÅÅÅÅ-MM-DD>.pdf`; tegn uden for bogstaver, tal, mellemrum, bindestreg og punktum bliver "-".

Serveren (én delt Chromium via playwright-core, startet ved første PDF og lukket efter 5 minutters stilhed, højst 2 PDF'er ad gangen, `PDF_TIMEOUT_MS` = 25 s pr. PDF; ved fejl lukkes browseren, og næste kald starter en ny) opretter et print-job i hukommelsen (engangstoken, 60 s), åbner `http://127.0.0.1:<PORT>/print/<token>` (svarer kun til loopback; render-appen med `boot.mode "print"`), venter på fontene og `document.documentElement.dataset.lassoReady === "1"` og gemmer siden med `page.pdf`. Siden må kun hente fra serveren selv; fontene er indlejret i render-appen, og nyhedernes kildeikoner udefra vises ikke i print. Hver PDF logges med varighed (`[pdf] company CVR-1-… 1.4 s`).

| Rute | Giver |
|---|---|
| `GET /k/:cvr.pdf?m=&y=&e=&f=&s=` | Virksomhedsrapporten. Samme signerede query som `/k/:cvr` (samme signatur, samme fejl: 403 ugyldig, 410 udløbet). |
| `GET /p/:id.pdf?f=&e=&s=` | Personsiden med samme fokus. |
| `GET /e/:lassoId.pdf?f=&e=&s=` | Rapport for `CVR-1-…`, siden for `CVR-3-…`. |
| `GET /v/:org/:slug.pdf` | En gemt visning som side-PDF (samme adgang som `/v/`). |
| `GET /x/:token.pdf` | MCP-appens `render_view`, `search_companies` og `list_saved_pages`: specen og data, som de blev vist, i et kortlivet lager (10 min, kan hentes flere gange i den tid; tokenet er 32 tilfældige bytes). |
| `GET /api/portal/pdf/company/:id?focus=`, `GET /api/portal/pdf/person/:id?focus=`, `POST /api/portal/pdf/spec` | Portalen bag session (se `docs/portal.md`). |

Alle svarer `application/pdf` med `Content-Disposition: attachment; filename*=UTF-8''…`. Uden Chromium (`PDF_CHROMIUM_PATH` findes ikke) svarer de `503 { error: "PDF er ikke slået til på denne server." }`, `/health` viser `pdf: false`, og værterne skjuler knappen (`boot.pdf === false`, eller intet `pdfLink` i MCP-svaret).

Værterne: MCP-appen får `pdfLink` i `structuredContent` (`show_company` → `/k/<cvr>.pdf`, `show_person` → `/p/<id>.pdf`, `render_view`, `search_companies` og `list_saved_pages` → `/x/<token>.pdf`, `resolve_view` efter drill-down og filterændringer), henter filen og gemmer den gennem værten (`app.downloadFile` med PDF'en som blob); kan appen ikke hente linket, eller afviser værten download, åbnes linket i stedet (`app.openLink`), og browseren gemmer filen. Appens ressource tillader forbindelser til serveren selv (`csp.connectDomains`). Delte sider får `pdf` og `pdfUrl` (sidens eget .pdf-link) i boot'en og går til linket. Portalen henter fra `/api/portal/pdf/*` med sessionen og gemmer med `<a download>`; beskeden er "PDF'en er hentet" eller fejlen med "Prøv igen".

### Virksomheds- og personhoved, genveje og "Se alle"-panelet (08, 09, 16)

```ts
<CompanyHead company variant?="full|compact|line" actions?={HeadActionsProps} risk?={ObservationsVM} onSeeRisk? onHistory? below? />
<PersonHead person variant? actions? onSeeRisk? below? />
<HeadActions monitor?={{ monitoring, onClick }} save?={{ saved, onClick }} exportItems?={MenuItem[]} more?={MenuItem[]} history? labels? />
<Shortcuts items={[{ id, label, icon, onSelect }]} />                       // 08.4, maks 6 + "Flere"
<SidePanel open title subtitle? onClose list={<SidePanelList groups selected onSelect />} detail? view?="list|detail" onBack? />   // 08.7
```

Handlingerne (Overvåg/Overvåger, Gem/Gemt, Eksportér, "…") er 32 px ikonknapper øverst til højre i hovedet; `LassoView` fylder dem ud fra `HostCapabilities` (`monitor`, `savePage`, `export`, `refresh`, `fullscreen`) og flytter dem ud af rammens header og footer, når sidens hoved står på siden. "Se risiko" (`risk: true` i specen, kun ved 50+), "Se historik" (ophørt) og genveje sender `open-section` (værten skifter fokus) eller en `prompt`. `headTabs` på `LassoView` giver sektionsfanerne (08.2) under hovedet. Kontaktpersoner (08.6) viser 3 + "Se N kontaktpersoner" og åbner `SidePanel` (720/600 px, fuldskærmsark på mobil). Live-nummeret (08.5) har fire tilstande (`liveState`), og `verify-contact` beder værten verificere i realtid.

## Tabeller, massehandlinger og persontabel (15, mobil 26c)

`CompanyTable` har værktøjslinjen (søg i resultatet, `Filtre (n)` der åbner `FilterSheet`, kolonnevalg, eksport), afkrydsning med `BulkBar` (15.2: "N markeret, vælg alle", handlinger, luk; destruktiv som rød tekst), 25 rækker pr. side med `Pagination` (aktiv side ink 600 + 2 px streg) og tilstande inde i rammen (`TableStateRows`, hovedet står). Under 560 px bliver den en kortliste (navn + status, CVR og by, tynd linje, tre nøgletal + score) med fjernbare filterchips. `LassoPersonTable { query, limit? }` (15.3) er samme tabel med personer: navn alene, fødselsår og by, 2 roller + "og n flere", konkurser kun > 0. Delene ligger i `components/TableKit.tsx`.

Ejerdiagrammet (14, layoutregel 3) har Legale/Reelle ejere, datovælger (klientsidet ud fra registreringsdatoer), dobbeltklik for nyt fokus, mini-kort med viewport-ramme og eksport til PNG/PDF af hele grafen med legende og dato (`ownershipExport.ts`, `print.tsx`).
