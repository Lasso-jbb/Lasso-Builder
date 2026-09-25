# Lassos designkatalog

Facit er Paper-filen **"Lasso Portal - Designguide"** (id `01M1GZGSTYBM43XSSD4JHQ0ADG`), siden **Designkatalog**, 41 artboards. Er der modstrid mellem kataloget og koden, vinder kataloget. Alt tidligere design er udgået.

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
| Personer og roller | Rolleliste, tidsbånd, netværk | 11, 16 |
| Ejerskab | Ejerliste med interval-bjælke, ejerdiagram | 11, 14 |
| Mange virksomheder | Tabel med værktøjslinje og paginering | 15 |
| Begivenheder over tid | Tidslinje, ændringsfeed | 12, 21 |

## Responsivt (26–26h)

1440 → 1200 (panel under midten) → 960 (skinnen skjules) → 768 (to kolonner, maks 6 tabelkolonner) → 390 (én kolonne). På mobil bliver tabeller til kortlister og ejerdiagrammet til en liste, rækker er mindst 44 px, grafer viser maks 5 punkter. Kun brudpunkter, ingen separate mobiludgaver.
