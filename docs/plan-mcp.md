# Plan: fuldendt Lasso MCP — modulsider ud fra spørgsmål

> **/goal at lave et fuldendt mcp produkt der kan modulere erhvervsoplysninger sammen ud fra ens spørgsmål.**
>
> Enhver AI, der arbejder efter denne plan, arbejder mod dét mål. Hver delopgave bedømmes på ét spørgsmål: *bliver produktet bedre til at bygge den rigtige modulside ud fra brugerens spørgsmål?* Hvis ikke, hører opgaven ikke hjemme her.

Orkestrator: **Fable 5.1** (ejer planen, modelvalg, kritiske vurderinger og godkendelse før/efter hver delopgave). Beslutningstager: **Jakob (jbb@lassox.com)**. Status: **udkast til godkendelse**. Gren: `staging`. Log: `.claude/startprojekt-log.json`.

---

## 1. Ejerens ønsker (gælder over alt andet i planen)

Samlet fra hele forløbet 29.09.2026. Ændres kun af ejeren.

| # | Ønske | Konsekvens for arbejdet |
|---|---|---|
| Ø1 | **Spørgsmålet styrer siden.** `question` + `ask.ts` er kernen. `focus` og `show_all` findes ved siden af ("behold begge"). | Intet arbejde må fjerne eller svække spørgsmålsstien. Nye komponenter skal først og fremmest kunne nås *fra et spørgsmål*. |
| Ø2 | **Alle komponenter skal kunne komme i spil**, og det skal være klart, hvad hver bruges optimalt til. | Ingen komponenttype uden (a) katalogpost, (b) mindst én vej ind, (c) data-opslag. En test håndhæver det. |
| Ø3 | **Dokumentation, så AI kan bruge komponenterne rigtigt.** | Ét register i koden → genereret `docs/komponenter.md` + værktøjstekster. Aldrig håndskrevet to steder. |
| Ø4 | **Tekstkortet må ikke formindskes.** Det giver kunden værdi. | Svarets `card` er urørt. Token-besparelser findes andre steder. |
| Ø5 | **Ingen kildehenvisninger nogen steder** (Runde 6 + "1: fjern kildehenvisning"). | `SourceList` og alle "Kilder"/"Vis kilder"-spor fjernes. |
| Ø6 | **Creditsafe kun med abonnement/credits.** Ellers skal det stå, at man skal have et abonnement. | Score-komponenter viser låst tilstand uden opslag, når abonnement mangler. Aldrig et Creditsafe-kald "for en sikkerheds skyld". |
| Ø7 | **Ja til nye MCP-værktøjer** (`search_persons`, `compare_companies`). | Fase D. |
| Ø8 | **Token-forbruget må ikke vokse ukontrolleret.** Kataloget flyttes *kun* ud af `render_view`, hvis det beviseligt gør spørgsmålssiderne bedre. | Fast token-loft i testen. Katalog-udflytning er *udsat* til målingen i B4 foreligger. |
| Ø9 | **Portal-opgaverne afventer.** | De 9 portal-komponenter (NotificationPanel, PushBanner, EntityUpdates, ReportBatches, SnapshotPicker, PersonSearchResults-i-portal, PageHeader, ScoreCompare-i-portal) røres ikke i denne plan. |
| Ø10 | **Ikke kun dyre modeller.** | Rollemodellen i afsnit 3: billigste tilstrækkelige rolle pr. delopgave. |
| Ø11 | **Produktion deployes af ejeren** via GitHub (`staging → main`). AI pusher kun `staging`. | Hver fase leveres gate-grøn på `staging`; ejeren tester og promoverer. |
| Ø12 | **Paper-designet (Fables runder) er gældende UI**, inkl. højdebudget og "hoved-luft". | Nye elementer på siderne skal holde sig inden for højdebudgettet; `show_all` slår det fra. |
| Ø13 | **Komponenternes bredde skal passe til indholdet.** Nogle moduler trives kun bredt (fx "Sidder sammen med": lange selskabsnavne, flere rækker pr. person og en tidsakse), andre trives bedst smalt (fx "Aktive roller", "Stamoplysninger", kontakt, ejerlister) og må ikke strækkes ud i fuld bredde med tom plads. | Hver komponent får en bredde-profil (bred / smal / fleksibel) med indholdsstyret mindstebredde, og pakkeren må hverken klemme et bredt modul eller strække et smalt. Se A11–A13 og B8–B9. |

**Antagelser (kan modsiges):**
- A1. "Alle komponenter" = de 53 spec-typer, som MCP'en kan udsende. De 9 rene portal-komponenter afventer (Ø9).
- A2. "Bedre" måles som *træfprocent på et eval-sæt*: andel spørgsmål, hvor siden har det forventede svar-element først. Mål: **≥ 90 %** (ejeren kan justere).
- A3. Rating-historik må gemmes i vores Postgres (én række pr. opslag), så `ScoreHistory` kan bygges op over tid.
- A4. Den relaksede regel "hvert modul ejer sit indhold" (accepteret ved Paper-merge) står ved magt; eval-sættet afgør, om genbrug på tværs af faner skader spørgsmålssiderne.

---

## 2. Udgangspunkt (målt 29.09.2026 på `staging` @ `5247389`)

- 54 komponenttyper i spec (A8 talte 54, ikke 53); alle kan tegnes; alle har data-opslag i `resolve.ts`.
- `ask.ts` (spørgsmål → side) kender **32 af 53**. De 21 øvrige kan aldrig blive svar-elementet på et spørgsmål.
- 15 typer bruges *kun* hvis modellen selv vælger dem i `render_view`; 2 mangler katalogpost (`AuditorIndependence`, `ScoreHistory`).
- Score: `score()` returnerer altid `null`, `scoreHistory()` altid tom → `ScoreGauge`/`ScoreHistory` er altid tomme live.
- Fast token-last pr. samtale ≈ 20.000 (heraf ≈ 14.200 = komponentkataloget i `render_view`-beskrivelsen). Pr. kald ≈ 2.000 (tekstkort ≈ 1.500 — bevares, Ø4).
- Bredde: `GRID_RULES` i `catalog.ts` har standard/min/maks pr. type, men **målt med demodata** (korte navne, få rækker). Derfor står fx `PersonNetwork` (min = ½) klemt med afkortede navne og overlappende årstal, mens `PersonRoles`/lister (maks = fuld) strækkes ud med tom plads. Der findes intet begreb for "trives smalt", og mindstebredden afhænger ikke af indholdet (antal rækker, navnelængde, tidsakse, antal serier).
- Ingen eval: vi ved ikke, hvor godt spørgsmål → side rammer i dag.
- **B5-resultat (29.09.2026, efter B2–B4): side 92,3 % (48/52), plan 96,7 %; eksisterende 88,9 % (uændret), manglende 100 % (16/16). Mål ≥ 90 % nået; B6 (katalog ud af render_view) udsat — ingen målt gevinst (Ø8).**
- Baseline (A4, 29.09.2026): side 61,5 % (52 tilfælde), plan 56,7 % (60 tilfælde; svar-element 25,0 % (8/32), fokus 92,9 % (26/28)); eksisterende 88,9 % (side) / 94,4 % (plan), manglende 0 % / 0 %.

---

## 3. Rollemodel (hvem laver hvad)

Efter `/startprojekt`: billigste tilstrækkelige rolle. Orkestratorlaget rykker aldrig ned.

| Rolle | Model | Bruges til | Må ikke |
|---|---|---|---|
| **Orkestrator & arkitekt** | Fable 5.1 (`claude-fable-5-1`) | Plan, dekomponering, alle kritiske valg (datamodel, hvad AI'en instrueres i, kundevendte tekster, abonnement/penge), godkendelse før/efter hver delopgave | Uddelegere kritiske vurderinger |
| **Bygger** | Opus (`claude-opus-5-5`) | Flertrins-kode i komplekse filer (`ask.ts`, `compose*.ts`, grid/højdebudget), nye composere | Ændre scope eller arkitektur |
| **Håndværker** | Sonnet (`claude-sonnet-5-5`) | Standardkode med klare krav, wiring af schemas/`views.ts`, tests, generator-scripts, tekst efter tjekliste, køre gate | Løse tvetydige krav selv — eskalér |
| **Assistent** | Haiku 4.5 (`claude-haiku-4-5-20251001`) | Mekanisk udtræk (hvilke VM-felter en komponent bruger), formatering af fixtures/JSON, søgning efter referencer, token-optælling | Fortolke uklare instrukser |
| **Beslutningstager** | Jakob | Godkender plan og faser, tester `staging`, deployer prod, alt med kunde-/abonnementskonsekvens | — |

**Kritisk = Fable selv:** datamodel/schema (rating-historik), hvad der sendes til modellen (værktøjstekster, regler), abonnements-/Creditsafe-logik, valg af eval-mål, deploy-beslutninger, tvetydige spørgsmålstyper.

---

## 4. Delopgaver

Rækkefølge og roller. "Gate" = `npm run typecheck && npm test && npm run build` grøn + dækningstest grøn.

### Fase A — Fundament: mål det, og få ét register
| # | Delopgave | Rolle | Kritisk | Begrundelse |
|---|---|---|---|---|
| A1 | Eval-skema + 15 seed-spørgsmål med forventet svar-element (virksomhed + person, alle 8+6 fokus, de 21 manglende komponenter dækket) | Fable | ja | Definerer hvad "godt" betyder for hele planen |
| A2 | Udvid eval-sættet til 60 spørgsmål efter A1's mønster (variationer i formulering, synonymer, stavemåder) | Sonnet | nej | Tekstproduktion efter klart mønster |
| A3 | Formatér eval-sættet som fixture (`packages/spec/src/eval/questions.json`) | Haiku | nej | Mekanisk |
| A4 | Måle-script: kør `composeCompany`/`composePerson` med `ask` på eval-sættet mod demo-data; rapportér træfprocent + liste over misses. Kør baseline og gem tallet i planen | Sonnet | nej | Standardkode, klar spec |
| A5 | Register-skema: udvid `CatalogEntry` med `formaal`, `bedstTil` (spørgsmålstyper), `undgaaNaar`, `kraeverData` (VM-nøgler), `liveTilgaengelighed`, `veje` (ask/focus/render_view/tool), `grid` | Fable | ja | Datamodel, former dokumentation og AI-instruktion |
| A6 | Udtræk pr. komponenttype: hvilke VM-nøgler `resolve.ts` henter, hvilke composere udsender den (tabel) | Haiku | nej | Mekanisk udtræk fra kode |
| A7 | Udfyld registeret for alle 53 typer ud fra A5+A6 (inkl. de 2 manglende poster) | Sonnet | nej | Tekst efter tjekliste; Fable reviewer "bedstTil" |
| A8 | Dækningstest: fejler hvis en type mangler registerpost, vej ind, `resolve`-case — eller hvis de faste værktøjstekster overstiger token-loftet (loft = dagens niveau + 10 %) | Sonnet | nej | Testkode |
| A9 | Generator: `docs/komponenter.md` genereres fra registeret (npm-script + test på at den er ajour) | Sonnet | nej | Script |
| A11 | Bredde-profil (Ø13): definér klasserne *bred* (kræver ≥ ⅔: tidsakser, flere kolonner, lange navne), *smal* (bedst ≤ ½: nøgle/værdi-lister, kontakt, ejer-/rollelister; må ikke strækkes til fuld, medmindre alene i båndet) og *fleksibel*; og hvilke indholdsmål der styrer mindstebredden (antal rækker pr. post, længste navn, tidsakse, antal serier). Registerfelt `bredde: { profil, std, min, max, indholdsstyret }` | Fable | ja | Former pakkeren og alle sider |
| A12 | Udtræk nuværende `GRID_RULES` + målte højder pr. type/bredde til en tabel; markér typer, hvor min < ½ eller max = fuld | Haiku | nej | Mekanisk |
| A13 | Mål alle 53 typer i galleriet med *realistiske* data (lange selskabsnavne, 5+ rækker, 3 selskaber pr. person, 10 år på aksen) i hver tilladt bredde; registrér afkortning, overlap og tom plads; foreslå ny std/min/max pr. type efter A11 | Sonnet | nej | Måling efter tjekliste; Fable godkender forslagene |
| A10 | Godkendelse af Fase A, push `staging` | Fable → Jakob | ja | Port |

### Fase B — Kernen: spørgsmål → modulside (målet)
| # | Delopgave | Rolle | Kritisk | Begrundelse |
|---|---|---|---|---|
| B1 | Spørgsmålsordbog for de 21 manglende komponenter: hvilke spørgsmålstyper/ord udløser dem, svar-element først, hvad står rundt om. Beslutning om `topic`-hint (AI'en sender emne, fx "fusioner", "branche", "placering") | Fable | ja | Tvetydige krav; former produktet |
| B2 | Implementér B1 i `ask.ts` (nye ask-typer, regex-mønstre, plan-items for alle 21) | Opus | nej | Flertrins-kode i 900-linjers regelmotor |
| B3 | `topic`-hint i `show_company`/`show_person` (schema, `views.ts`, `parseAsk`-hints) | Sonnet | nej | Wiring med klar spec |
| B4 | Fokus-sider bruger flere komponenter automatisk inden for højdebudgettet: risiko → RiskObservations; historik → Announcements/Mergers/Publications/ChangeFeed; økonomi → KeyFigureGauge/Summary; regnskab → FinancialStatements; kontakt/overblik → Map (m. P-enheder)/Registration; person → PersonStats | Opus | nej | Grid/budget-samspil |
| B5 | Kør eval igen. Port: træfprocent ≥ A2-mål og ingen regressioner på de 32 eksisterende | Sonnet kører, Fable dømmer | ja | Beviset for at produktet blev bedre |
| B6 | *Kun hvis B5 viser, at modellen vælger forkert værktøj pga. katalogstørrelse:* flyt kataloget til opslag (`get_catalog`/ressource). Ellers udsat (Ø8) | Fable beslutter | ja | Ø1-betingelse |
| B8 | Bredde i pakkeren (Ø13): nye `GRID_RULES` fra A13; indholdsstyret mindstebredde (et element med lange navne/mange rækker/tidsakse kræver mere end sin type-min); *smal*-profil strækkes aldrig til fuld, medmindre den står alene i båndet; *bred*-profil pakkes aldrig under sin mindstebredde — hellere udelades (højdebudget) eller får eget bånd. Mobil/tablet-brudpunkter respekterer det samme | Opus | nej | Grid-algoritme, samspil med højdebudget |
| B9 | Layout-test i eval: for hver eval-side fejler testen, hvis et element står under sin mindstebredde, en *smal* står i fuld bredde ved siden af andre, eller galleri-screenshots viser afkortning/overlap (fx årstal på tidsaksen) | Sonnet | nej | Testkode; bruger galleriets måleværktøj |
| B7 | Godkendelse af Fase B, push `staging` | Fable → Jakob | ja | Port |

### Fase C — Datahuller
| # | Delopgave | Rolle | Kritisk | Begrundelse |
|---|---|---|---|---|
| C1 | Abonnementsregel for Creditsafe: hvornår må der slås op, låst tilstand "Kræver Creditsafe-abonnement", ingen opslag uden abonnement. Mapping Creditsafe-rating → `ScoreVM` | Fable | ja | Penge/abonnement, kundevendt tekst |
| C2 | Schema for rating-historik i Postgres (én række pr. opslag) + migration | Fable | ja | Datamodel |
| C3 | Implementér C1+C2 i `live.ts` (`score`, `scoreHistory`) + tests | Sonnet | nej | Klar spec |
| C4 | Find alle kilde-spor (SourceList, "Kilder", "Vis kilder", `sources`-props, galleri) | Haiku | nej | Søgning |
| C5 | Fjern dem (Ø5) + tests | Sonnet | nej | Sletning efter liste |
| C6 | Tomme tilstande med årsag: Livestock (Ejendomme-modul), KeyFigureGauge (branchetal), Score (abonnement) — tekst i register + UI | Sonnet | nej | Efter tjekliste; Fable godkender teksterne |
| C7 | Godkendelse af Fase C, push `staging` | Fable → Jakob | ja | Port |

### Fase D — Nye MCP-værktøjer (Ø7)
| # | Delopgave | Rolle | Kritisk | Begrundelse |
|---|---|---|---|---|
| D1 | `search_persons`: spec, hvilke komponenter (PersonTable), hvad svaret indeholder | Fable | ja | Nyt kundevendt værktøj |
| D2 | Implementér `search_persons` (server + `views.ts` + tests) | Sonnet | nej | Bruger eksisterende `personSearch` |
| D3 | `compare_companies`: spec (CompareTable/Ranking/ScoreCompare, hvornår hvilken, spørgsmål som "sammenlign X og Y") | Fable | ja | Komposition, kundevendt |
| D4 | Implementér `compare_companies` (composer + server + tests) | Opus | nej | Ny composer |
| D5 | Værktøjstekster, `INSTRUCTIONS`, `COMPOSITION_RULES` skrives om ud fra registeret ("brug X når …"), inden for token-loftet | Fable skriver, Haiku tæller | ja | Det AI'en styres af |
| D6 | Godkendelse af Fase D, push `staging` | Fable → Jakob | ja | Port |

### Fase E — Kvalitet og aflevering
| # | Delopgave | Rolle | Kritisk | Begrundelse |
|---|---|---|---|---|
| E1 | Smoke-test mod staging-MCP'en med 10 eval-spørgsmål (virksomhed, person, `show_all`, `search_persons`, `compare_companies`) | Sonnet | nej | Efter tjekliste |
| E2 | Samlet review: mål opfyldt? alle 53 i spil? dokumentation ajour? token-loft holdt? | Fable | ja | Samlet kvalitet |
| E3 | Prod-deploy (`staging → main` på GitHub) | Jakob | ja | Irreversibel (Ø11) |

**Rækkefølge:** A1 → (A2, A5, A6, A11, A12 parallelt) → (A3, A13) → (A4, A7 parallelt) → (A8, A9) → A10 → B1 → (B2, B3, B4, B8 parallelt) → (B5, B9) → B6? → B7 → (C1, C4 parallelt) → C2 → (C3, C5, C6 parallelt) → C7 → (D1, D3 parallelt) → (D2, D4 parallelt) → D5 → D6 → E1 → E2 → E3.
Fase C og D kan køre parallelt med hinanden efter B7, hvis kapaciteten er der.

**Udsat (ikke i denne plan):** portal-opgaverne (Ø9); katalog-udflytning (B6, betinget — ikke udløst efter B5); "hvert modul ejer sit indhold" (A4, afventer eval).

**Åbne punkter efter Fase B (Fable):** (1) `LassoChangeFeed` for én virksomhed dækker live kun de seneste 500 CVR-ændringer; fuldt feed kræver et endpoint pr. virksomhed hos Lasso — afklares i Fase C. (2) Forældede katalogtekster ("Dækkes ikke af show_company" m.fl. på RiskObservations, Map, Registration, Mergers, Announcements, Publications, FinancialStatements, ScoreHistory) rettes i B8. (3) RiskObservations står efter Kreditvurderingen på fokus risiko (Papers default, Ø12) og som svar-element nr. 1 ved spørgsmål om røde flag. (4) Fokus regnskab beholder de tre opgørelser; hele regnskabet nås via spørgsmål/`heleregnskab`.

---

## 5. Acceptkriterier for hele planen

1. Eval-træfprocent ≥ mål (A2, foreslået 90 %) — og **højere end baseline** fra A4.
2. Dækningstesten er grøn: alle 53 typer har registerpost, vej ind og data-opslag.
3. `docs/komponenter.md` genereres fra registeret og er ajour (test).
4. Faste værktøjstekster ≤ token-loft.
5. Tekstkortet er uændret (Ø4) — test på kort-output for en fast virksomhed.
6. Ingen kilde-spor i UI eller spec (Ø5).
7. Creditsafe kaldes aldrig uden abonnement; låst tilstand viser abonnementskravet (Ø6).
8. `search_persons` og `compare_companies` findes og er dokumenteret (Ø7).
9. Alt leveret gate-grønt på `staging`; ejeren har promoveret til prod.
10. Bredde (Ø13): hver af de 53 typer har en bredde-profil i registeret; layout-testen (B9) er grøn — intet element under sin indholdsstyrede mindstebredde, ingen *smal* strakt til fuld ved siden af andre, ingen afkortning/overlap i galleriets screenshots med realistiske data.

---

## 6. Arbejdsregler for AI'er på planen

- Start med at læse **/goal** øverst og afsnit 1. Passer opgaven ikke til målet, stop og spørg.
- Overhold rollemodellen (afsnit 3). En billigere rolle, der eskalerer med et præcist spørgsmål, er bedre end en dyr, der gætter.
- Hver delopgave: mål, input, output-format, acceptkriterier, rammer, eskalationsregel (efter `/startprojekt`).
- Ingen commit uden grøn gate. Ingen push til andet end `staging`. Prod er ejerens.
- Log hver godkendelse i `.claude/startprojekt-log.json`.
- Ændr aldrig Ø1–Ø12 uden ejerens ord.

---

## 7. E2 — Samlet review og aflevering (Fable, 29.09.2026, natkørsel)

Status: **alle faser leveret på `staging`.** Prod-deploy (E3) er ejerens: `staging → main` på GitHub (https://github.com/Lasso-jbb/Lasso-Builder/compare/main...staging).

### Acceptkriterier (afsnit 5)
| # | Kriterie | Resultat |
|---|---|---|
| 1 | Eval ≥ 90 % og > baseline | **Side 92,3 %** (48/52) mod baseline 61,5 %; plan 96,7 %; manglende 16/16; ingen regression (eksisterende 88,9 % uændret) ✅ |
| 2 | Dækningstest grøn: alle typer har registerpost, vej ind og data-opslag | 54/54 ✅ (`packages/spec/src/coverage.test.ts`, `apps/server/src/data/coverage.test.ts`) |
| 3 | `docs/komponenter.md` genereret og ajour | ✅ (`npm run docs:komponenter -w @lasso/spec`, test) |
| 4 | Faste værktøjstekster ≤ loft | 21.243 / 22.000 tokens ✅ (`staticText.test.ts`) |
| 5 | Tekstkortet uændret/udvidet (Ø4) | ✅ 11 nye sætninger for de nye spørgsmålstyper; intet fjernet |
| 6 | Ingen kilde-spor (Ø5) | ✅ SourceList/SourceLine/printSources fjernet, PDF-sidefod uden "Kilder" |
| 7 | Creditsafe kun med abonnement (Ø6) | ✅ ét opslag pr. side; låst tilstand "Kræver Creditsafe-abonnement"; rating-historik i `score_points` |
| 8 | `search_persons` + `compare_companies` (Ø7) | ✅ registreret, testet, dokumenteret |
| 9 | Gate grøn på `staging` | ✅ typecheck 0, **911 tests**, build ok (sidste commit) |
| 10 | Bredde (Ø13) | ✅ layout 60/60, 0 overlappende årstal, 0 afkortede, 0 overløb; netværk fuld bredde, roller/stamoplysninger ½+½ |

### Verificeret live mod staging-MCP'en (E1)
- "Er der røde flag ved Novo Nordisk?" → `LassoRiskObservations` først; kort med observationer + kreditvurdering. Creditsafe svarede med abonnement: rating A, lokal score 71 → Lasso-score 29 (lav risiko) — **skalaen `100 − localScore` er hermed set mod ét rigtigt svar og stemmer** (A = lav risiko).
- "Hvem sidder Lars Rebien Sørensen sammen med?" → netværket i fuld bredde som egen række, stamoplysninger/nyheder under.
- De nye værktøjer (`search_persons`, `compare_companies`) og `topic`-parameteren ses først i Claude, når **connectoren gen-connectes** (værktøjslisten hentes ved forbindelse). Serverens e2e-tests dækker dem.

### Ejeren skal
1. Gen-connecte Lasso Builder-connectoren (nye værktøjer/parametre).
2. Teste på staging: et spørgsmål pr. ny type (røde flag, fusion, offentliggørelser, dokumenter, branche, placering, hele regnskabet, registrering, opsummering, ændringer, persontal), "vis alt om X", `search_persons`, `compare_companies` ("sammenlign A og B", "hvem har lavest soliditet af …").
3. Merge `staging → main` på GitHub (E3).

### Åbne punkter (udsat, ikke blokerende)
- `LassoChangeFeed` for én virksomhed dækker live kun de seneste 500 CVR-ændringer; fuldt feed kræver endpoint pr. virksomhed hos Lasso.
- Portal-komponenterne (Ø9) afventer ejeren.
- Katalog ud af `render_view` (B6): ikke udløst — ingen målt gevinst.
- `reasonKind` på Score/Livestock-VM'er (UI matcher i dag på tekst).
- 3 af 138 personoverblik overskrider højdebudgettet (op til 1591 px) for at holde netværket i fuld bredde uden at tabe elementer (Fables valg).
- Rating-historikkens `observed_at` bruger opslagsdatoen, indtil Creditsafe-svarets form er kendt.

### Rollemodel i praksis
Fable: plan, 9 kritiske delopgaver (A1, A5/A11, B1, B5/B6, C1/C2, D1/D3, D5, E2) og alle godkendelser. Opus: B2, B4, B8, B10, D4 (regelmotor, composere, grid). Sonnet: A2, A4, A7, A8, A9, A13, B3, B9, C3, C5, C6, D2, D4b, E0. Haiku: A3-format (inkl. i A2), A6, A12, C4. Beslutningslog: `.claude/startprojekt-log.json` (lokal, gitignoreret).

## 8. Token-reduktion (30.09, ejerens godkendelse af punkt 1–3)

Målt med `staticText.test.ts`, som nu tæller både beskrivelser og input-skemaer (tegn / 3,3):

| | Før | Efter |
|---|---|---|
| Værktøjsbeskrivelser + instruktioner | ≈ 21.400 | ≈ 7.100 |
| Input-skemaer (JSON Schema) | ≈ 48.400 (heraf render_view ≈ 45.400) | ≈ 3.600 |
| **I alt pr. samtale** | **≈ 69.800** | **≈ 10.700** (loft 12.000 i test) |

1. **Katalog efter behov:** render_view har et komponentindeks (type, titel, formål). Props, brug og eksempler hentes med det nye værktøj `describe_components`. render_view's input-skema er løst (typenavnene står i det), og serveren validerer specen præcist. En ugyldig spec får katalogposterne for sine typer i fejlsvaret, så modellen kan rette i ét forsøg.
2. **Gitterregler ude af teksten:** uden `width` pakker Lasso selv bredderne efter GRID_RULES og indholdet (Ø13, `dashboardBands`). Modellens eget valg var ringere end pakkerens.
3. **LAYOUT_RULES kortet ned:** svarniveauer, mønstre, regnskab, group/toolbar og højdebudget er bevaret. Pakke- og foldningsregler, som rendereren selv klarer, er fjernet.

Kvalitet: show_company, show_person, compare_companies og search_* er uberørte. Eval er uændret (side 92,3 %, plan 96,7 %, layout 60/60), og der er 915 tests. Prisen er ét ekstra kald (describe_components) i de få svar, der bruger fri komposition.
