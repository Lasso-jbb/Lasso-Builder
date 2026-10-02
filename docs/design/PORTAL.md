# Portalens ramme

Rammen om modulerne på `/portal`: topbjælke, skinne, åbne faner, modulrække og spørgefelt. Modulerne i midten
er beskrevet under Moduler; her står kun rammen. Designet kommer fra prototypen `lasso-portal4.html`, og koden er
`apps/view/src/portal2/` (`Portal2App.tsx`, elementerne i `parts.tsx`, stilen i `portal2.css`). Designguidens side "Portalens ramme" viser den kørende
portal, så det, der står her, og det, man ser, er det samme. Den klassiske portal (tavle 06 og 26a, AppShell)
står på `/portal/klassisk` og videreudvikles ikke.

## Opbygning

| Del | Desktop (over 760 px) | Telefon (760 px og derunder) |
|---|---|---|
| Topbjælke | 56 px, rammegrå (`--frame`), navnelogo 90 × 26, søgefeltet, tema, notifikationer, profil | Altid samlet: logo 59 × 17, de åbne faner, og tema, notifikationer og profil som små ikoner (18 px, 30 px brede knapper) |
| Søgefelt | Pille 36 px, højst 720 px, flugter med indholdets venstre kant | Søgning i fuld skærm fra bundbjælken |
| Skinne | 60 px, ikoner 20 px, tooltip til højre | Skjult |
| Åbne faner | 44 px bjælke, fane 36 px, radius 10 foroven | I topbjælken (ingen egen bjælke) |
| Modulrække | 52 px, klæber øverst; Lasso-mærket, modulerne, "Flere", Følg og Gem | 48 px |
| Indhold | Kolonne på højst 1200 px med 40 px sideluft | 28 px sideluft (`--gut`) |
| Spørgefelt | Pille 52 px, højst 720 px, centreret nederst med tre forslag | Lasso-knappen (52 px) i bundbjælken åbner feltet |
| Bundbjælke | – | Lasso-knap til venstre, kapsel 158 × 52 med Søg, Værktøjer, Lister |

## Topbjælke og søgning

- Søgningen er Lassos navnesøgning (`GET /api/portal/lookup`), ikke AI. Den søger mens man skriver (fra 2 tegn).
- Resultaterne har fanerne Firmaer og Personer med antal (Lasso giver højst 20 pr. type) og et statusfilter for
  firmaer (Aktive, Inaktive, Alle). Det søgte står med fed i navnet; under navnet by og CVR.
- Et firma har genveje, når rækken er valgt: åbn direkte i Økonomi, Ejerskab eller Historik.
- Tastatur: pil op/ned vælger, Enter åbner, Tab skifter mellem Firmaer og Personer, Esc lukker, `/` sætter fokus.
- Uden tekst viser feltet de seneste (gemt i browseren, højst 8, "Ryd"). Uden match står "Spørg Lasso om …",
  som sender teksten til chatten.
- "Se alle firmaer for …" åbner den fulde søgning som en fane.

## Skinnen

Værktøjer (forsiden) og Lister (gemte sider) virker. Handlinger, Profil, Abonnement, Integrationer, Firma,
Moduler og Brugere står dæmpet, til de findes.

## Åbne faner

- Hvert åbnet firma, person og resultat er en fane med navn og luk-kryds; tooltip med by og CVR.
- Mangler der plads, smalles de inaktive til 136 px og skjules derefter bag "Flere ▾" (med luk pr. række og
  "Luk alle andre faner"). Står kun den aktive tilbage, bliver den selv en dropdown med alle åbne.
- Midterklik lukker en fane. Lukkes den aktive, bliver naboen til venstre aktiv.
- Henter Lasso til en fane, står Lasso-mærket i fanen og bevæger sig.

## Modulrækken

- Først Lasso-mærket: fanen med det, chatten senest hentede om siden. Den er slået fra, til der er et svar, og
  mærket bevæger sig, mens der hentes. Klikker man over på et modul og tilbage, står svaret som man forlod det.
- Derefter modulerne (fokus) i fast rækkefølge: Overblik, Økonomi, Regnskab, Ejerskab, Risiko, Historik, Kontakt
  for firmaer; Overblik, Roller, Netværk, Ejerskab, Risiko, Historik for personer. De hentes uden AI.
- Mangler der plads, skjules moduler fra højre bag "Flere ▾"; er der plads til færre end to, bliver rækken en
  vælger med det aktive modul.
- Til højre Følg (kommer senere) og Gem (gemmer siden på brugerens liste).
- Navnet står i fanen, ikke over modulrækken; modulernes eget hoved udelades i portalen.

## Spørgefeltet (chatten)

- Feltet sender til `/api/chat` (Claude med samme værktøjer som MCP, se `docs/chat.md`). Pladsholderen er
  "Spørg om <navn>" på en side og "Spørg Lasso om en virksomhed, en person eller en målgruppe" ellers.
- Svaret vises under Lasso-mærket på den fane, man spurgte fra, med spørgsmålet ("Du spurgte: …") og Claudes
  korte tekst over visningen. Henter Claude et andet firma, åbnes det som fane med svaret; spørger man fra
  forsiden eller et resultat, bliver svaret en ny fane.
- Mens der hentes, bliver Send til Stop.

## Telefon

- Skinne, søgefelt og spørgefelt skjules; bundbjælken tager over.
- Topbjælken står altid i den samlede form: det lille logo, de åbne faner (den aktive, med "Flere" eller som
  dropdown, når der ikke er plads) og tema, notifikationer og profil som små ikoner tæt sammen. Der er ingen
  fanebjælke under topbjælken, og den klapper ikke sammen ved rulning.
- Modulrækken bliver en vælger, når modulerne ikke kan stå ved siden af hinanden.

## Tema

Lys og mørk med samme tokens som prototypen (står øverst i `portal2.css` og vises på designguidens side).
Valget huskes i browseren. `?tema=dark` i adressen sætter temaet uden at gemme det.

## Adresser

`/portal?aaben=CVR-1-…,CVR-3-…&fane=oekonomi` åbner fanerne (den sidste er aktiv) på et modul. Designguiden
bruger det til sine rammer.
