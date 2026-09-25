# Lassos designsprog (fra Paper)

Kilde: [Filterfelter i Paper](https://app.paper.design/file/01M394PD9M8HG31MG333AX2NHM/p-1-0/YL-0), eksporteret 24. sep. 2026.
Værdierne her er implementeret som CSS-variabler i `packages/ui/src/styles.css`. Ret dem dér, ikke i komponenterne.

## Tokens

| Token | Værdi | Bruges til |
|---|---|---|
| Skrift | Poppins (400/500/600), system-ui som fallback | Alt |
| Tekst primær | `#16181D` | Feltnavne, værdier, overskrifter |
| Tekst sekundær | `#3F444B` / `#5B6068` / `#6B7280` | Brødtekst, knaptekst, enheder |
| Tekst dæmpet | `#8A9099` | Hjælpetekst, placeholders, ikoner |
| Ikon dæmpet | `#9AA0A8` / `#A8AEB6` / `#C9CDD3` | Chevrons, deaktiverede datoer |
| Kant felt | `#E4E4E7` | Input, dropdown, chip, knap |
| Kant skillelinje | `#E6E7EB` | Sektioner, tabelrækker |
| Tag-flade | `#F1F1F3` (hover `#E8E9EC`) | Tags i felter |
| Koral stærk | `#FF6B35` | Primærknap, kontakt, valgt chip med antal |
| Koral tekst | `#B2450F` | Flueben, kryds ved hover, effekttekst, numre |
| Koral blød flade | `#FFF2EB` | Valgt chip, valgt listepunkt, fokusring |
| Koral blød kant | `#FFCFB6` | Valgt chip, felt i målgruppen, fokus |
| Rød | `#D92D20` | Kun påkrævet-stjerne og det, der ikke kan fortrydes |
| Tooltip | `#16181D` på hvid tekst | Info-ikon |
| Skelet | `#EEEFF2`, 14 px høj, 7 px radius, svag puls | Indlæsning |

## Mål

| Element | Mål |
|---|---|
| Felt (input, dropdown) | 44 px høj, 8 px radius, 13–14 px vandret padding |
| Tag i felt | 30 px høj, 6 px radius, 13 px tekst, gråt kryds |
| Chip (valg) | 38 px høj, 8 px radius, 13 px tekst |
| Knap | 38 px høj, 8 px radius, 13/600 |
| Listepunkt i dropdown | 42 px høj |
| Popover | 10 px radius, skygge `0 14px 34px #10121824` |
| Fokusring | kant `#FFCFB6` + `0 0 0 3px #FFF2EB` |

## Typografi

18/600 overskrifter og totaltal · 14/600 feltnavne · 14/500 operatorer · 14/400 værdier og lister · 13 brødtekst, tags, chips og knapper · 11/600 versal-labels.

## Regler, der styrer komponenterne

- Operatoren står først og bestemmer resten af rækken. "er mellem" folder et andet felt ud.
- Koral markerer valg og uafsluttede handlinger, aldrig dekoration.
- Rød er forbeholdt det, der ikke kan fortrydes.
- Under seks faste værdier: chips. Ellers søgbar liste.
- Tag i et felt er neutralt med kryds. Krydset er gråt i hvile og koralt ved hover.
- Sammenklappet felt viser værdien som rolig grå tekst: "Normal / aktiv, Ophørt og 3 flere".
- Intet er i målgruppen, før man trykker "Tilføj til målgruppen" / "Opdater målgruppe".
- Et felt med værdi har "Ryd" yderst til højre. Der er intet kryds på rækken.
- Datoer skrives dansk: dd.mm.åååå.

## Operatorer: én fælles liste

Logikken bruger altid nøglerne. De danske tekster er kun labels (`packages/spec/src/criteria.ts`).

| Nøgle | Label | Bemærkning |
|---|---|---|
| `eq` | er lig med | Dato: "præcis den" |
| `neq` | er ikke | |
| `gt` | er større end | Strengt `>` |
| `gte` | er mindst | `≥` |
| `lt` | er mindre end | Strengt `<` |
| `lte` | er højst | `≤` |
| `between` | er mellem | Inklusiv i begge ender |
| `in` / `not_in` | er en af / er ikke en af | |
| `contains` / `starts_with` | indeholder / begynder med | |
| `before` / `after` | før den / efter den | |

Rettelse i forhold til filterdokumentet: beløbsfelter (04) brugte "Mere end / Mindre end / Mellem". De bruger nu samme labels som talfelter, så "er større end" altid betyder `>` og "er mindst" altid betyder `≥`.

## Præsentationslaget indtil del 2

Del 2 (nøgletal, grafer, lister, tabel) er ikke designet endnu. Komponenterne er derfor bygget på reglerne ovenfor, gennemgået 25.09.2026:

| Element | Regel fra del 1 |
|---|---|
| Virksomhedsnavn, totaltal i nøgletal | 18/600 |
| Faktalabels, korttitler, tabeloverskrifter, år i grafer, "Ny" | 11/600 versaler, sporing 0,06em |
| Navne i lister og tabeller, faktaværdier | 14/400 |
| Roller, datoer, ejerandele, enheder, tal over søjler | 13/400 (tal over søjler 13/500) |
| Knapper | 38 px, 8 px radius, 13/600 |
| Status ("Normal", "Ophørt") | Neutralt tag: 30 px, 6 px radius, 13 px, `#F1F1F3` |
| Udvikling (▲ 6,4 %) | Pil i neutral tekst. Ingen grøn, og rød er forbeholdt det, der ikke kan fortrydes |
| Søjler | `#E4E4E7`, seneste år `#3F444B`, negative `#C9CDD3` |
| Kort | 1 px `#E6E7EB`, 10 px radius, 18 px luft, ingen skygge (skygge kun på popovers) |

Kun størrelserne 11, 13, 14 og 18 px bruges.

## Endnu ikke dækket

- Del 2 kan ændre ovenstående; så rettes det her og i `styles.css`.
- Mørk tilstand er afledt af tokens og ikke designet.
