# Chatten i portalen

Samtalen med Lasso i portalens første modul: tråden, svarformerne, placeringen af svaret, afklaringen, tilstandene og
mobilen. Designet kommer fra Paper-eksporten `docs/design/chat/chat-designguide.html` (historisk kilde, den ligger
som den blev eksporteret), og koden er sandheden: komponenterne i `apps/view/src/portal2/chat/`, tilstanden i
`apps/view/src/portal2/thread.ts`, stilen i `portal2.css` (`.p3`-blokken) og serveren i `apps/server/src/chat/`.
Hvordan chatten virker (værktøjer, kontekst, protokol, cache) står i `docs/chat.md`; rammen om chatten (topbjælke,
modulrække, spørgefelt) i `docs/design/PORTAL.md`. Designguidens side "Chatten" viser de rigtige komponenter med
rigtige data i fire bredder, så det, der står her, og det, man ser, er det samme.

## De femten regler

Fra eksporten, ordret, bortset fra de steder hvor en beslutning (se "Beslutninger") ændrer dem; det er markeret.

1. Chatten er et modul som alle andre og er altid første modul i modullinjen, vist med Lasso-mærket. Aktivt er mærket sort med orange streg. Pin bruges ikke længere. *(Ændret: pinnen findes stadig, men kun på et skabelonmodul, hvor den er rød; se "Sideskabeloner og den røde pin".)*
2. Hver fane har sin egen samtale. Samtalen slettes ikke; man ruller op for at se ældre spørgsmål. Nyeste besked står nederst, og siden ruller selv ned, medmindre brugeren er rullet op.
3. Brugerens beskeder står til højre i en grå boble. Lassos svar står til venstre uden boble, med mærket som avatar. Ingen skillelinjer og ingen datoer i tråden; tidspunkt står småt under hvert svar, kopiér-ikonet kun under tekstsvar. *(Tidspunktet står som "Lasso 09:41", uden midterprik; D2.)*
4. Et svar kan være tekst, et element eller en hel side. Teksten står altid først og forklarer, hvad der vises.
5. Et enkelt element har titel, undertitel og to ikoner i rammen: download og fuld skærm. Det kan ikke åbnes som fane. Kun en sammensætning af flere elementer (en side) har Tilføj som fane, som gemmer siden som en sideskabelon for virksomheder eller personer, så den står som et ekstra modul i modulrækken på hver virksomhed eller person og vises med den enheds data. Et katalog til at styre de gemte sider kommer senere. *(Ændret: eksporten siger "som åbner den som ny fane og gemmer den blandt brugerens egne sider"; se sideskabeloner under Beslutninger.)*
6. Fuld skærm åbner elementet i hele fladen under Lasso-fanen med et kryds til at lukke. Inputfeltet bliver stående, så man kan spørge videre.
7. Links til moduler er modul-links med orange ikon. Fører et link til et andet firma eller en anden person, står der ved siden af: Åbner `<navn>` i ny fane.
8. Inputfeltet står fast i bunden, 864 px bredt (Jakob 03.10; eksporten 720), med enter-ikon, og hedder altid Spørg Lasso. Tre forslag står centreret under feltet som ren tekst, aldrig inde i svaret.
9. Placeringen afgøres før svaret skrives: samme fane, ny fane for firma eller person, global fane, eller spørg først. Lasso åbner aldrig en fane, brugeren ikke har bedt om, og aldrig mere end én pr. spørgsmål.
10. Et spørgsmål bliver i fanen, når det giver mening i fanens kontekst, også når det nævner andre. "Vis mig alt om …" åbner en ny fane, og spørgsmålet følger med som første besked. Når Lasso skifter fane, står der en meddelelsesrække i den gamle samtale med Fortryd i 10 sekunder.
11. Spørgsmål uden ét firma eller én person får en global fane med et generelt navn: Firmaliste, Sammenligning, Markedsanalyse eller Kort. Dens ikon er Lasso-mærket. Emnet står i samtalen, ikke i fanens navn. *(Modulerne Liste, Sammenligning, Kort og Noter i eksportens eksempel findes ikke endnu; en global fane viser kun Lasso-modulet; D4.)*
12. Er der flere mulige match, lægger et valg sig over samtalen lige over inputfeltet med mulighederne, en Andet-række med frit felt og knapperne Spring over og Vælg. Rækkerne har kun titel og beskrivelse. *(Valget bruges kun til flere match, aldrig til at vælge placering.)*
13. Tom tilstand viser en hilsen med fanens navn og forslag som piller med pil. Mens Lasso tænker, vises kun tre prikker i tekstfarven (Jakob 03.10: ingen "Tænker…", ikke koral); tager det længere, står der i ord hvad den gør, med et skelet. Der er ingen Stop i samtalen eller i feltet (Jakob 03.10). Fejl står som almindelig tekst med mindst én handling. Rullet op vises en rund knap med pil ned.
14. På mobilen fylder samtalen hele bredden med 16 px luft, brugerens bobler er højst 280 px, inputfeltet er 48 px og står lige over bundlinjen. Kort har kun fuld skærm i rammen; en hel side får desuden Tilføj som fane som en neutral ikonknap med koral ikon. Afklaringen er et ark fra bunden.
15. Alle knapper kommer fra designguiden; ingen opfundne knapper. Mål: boble radius 18, tekst 14/22, avatar 24, kortramme radius 10, inputpille 52, modul-link 46 høj radius 12. *(Knapperne er `Button` og `IconButton` fra `packages/ui` i 14 px og mindst 32 px, ikke eksportens 13 px og 28 px; D6.)*

## Mål

Målt på eksportens CSS (desktop / mobil, hvor de er forskellige). Værdierne står som `--chat-*`-tokens (se nedenfor)
eller som de eksisterende tokens i `styles.css`.

| Element | Værdi |
|---|---|
| Tråd | 960 bred, centreret; bund 168 (128 uden forslag) *(Jakob 03.10: 20 % bredere end Paper-eksporten, som har 800)* |
| Afstand | 20 px mellem beskeder, 28 px mellem ture |
| Brugerboble | `--lasso-surface-muted` (#F4F4F5), radius 18, padding 10/14, 14/22 ink, højst 576 (mobil 280) *(Jakob 03.10: 20 % bredere end Paper-eksporten, som har 480)* |
| Lasso-besked | gitter 24 px + 1fr, gap 12 (mobil 10) |
| Avatar | 24 px cirkel, primary-soft baggrund, mærket 12 px i primary; tom tilstand 40 px med mærke 20 px |
| Svartekst | højst 60 % af trådens bredde (576; Jakob 03.10: tekst 60 % af trådens bredde; mobil fuld bredde), 14/22 i `--lasso-font`, `--lasso-text-2`, tabeltal; fremhævning 600 i `--lasso-text` (Jakob 03.10: samme skrift som modulteksten, regnskabsanalysens afsnit; eksporten har ink og 500); afsnitsafstand 8 *(Jakob 03.10: 20 % bredere end Paper-eksporten, som har 760)* |
| Punktlister | 6 px ink-prik, padding-left 16 |
| Meta | margin 8 0 0 36 (mobil 34), 11/16 faint (#8A9099), gap 10, kopiér-ikon 16; kun under rene tekstsvar |
| Modul-link (pille) | 46 høj, padding 0 18, radius 12, 1 px kant #E4E4E7, 16/500 ink, ikon 18 px i primary, gap 10; rækken margin-top 14, gap 12. Mobil: 40 høj, 14 px, padding 0 14, ikon 16 px |
| Pillenote | 12 faint, "Åbner Novo Nordisk A/S i ny fane" |
| Tekstlink | 14/500 primary-text #B2450F ("Prøv igen", "Fortryd", "Se alle") |
| Links i teksten | `lasso:`-links og webadresser inde i en sætning: ingen farve, tekstens egen farve og vægt, kun en tynd understregning i 40 % af farven (offset 3), fuld ved hover og fokus (Jakob 03.10). Modul-links som række (pillerne) er uændrede. |
| Meddelelsesrække | centreret pille 28 høj, padding 0 12, surface-panel, 1 px divider-kant, 12 px text-secondary, mærke 14 |
| Inputbjælke | padding 40 0 24, gradient til hvid over 32 px, gap 16 |
| Inputpille | 864 × 52 (Jakob 03.10: 20 % bredere end Paper-eksporten, som har 720), radius fuld, 1 px divider-subtle, skygge 0 8 24 rgba(22,24,29,.08), padding 0 20 0 22, 16 px faint, enter-ikon 18 |
| Mobil input | 48 høj, venstre/højre 16, bund 140 (76 uden forslag) |
| Forslag | centreret række, gap 28, 14/22 text-secondary; mobil stablet 13/20, gap 2 |
| Svarkort | 1 px kant, radius 10, margin-top 14, hele trådens bredde; hoved padding 16/20, gap 12; titel 14/500/20; undertitel 13/18 text-secondary; handlinger gap 8, ikonknapper 32, radius 8; krop padding 0 20 16 |
| Primær knap | 36, radius 8, bookmark-plus-ikon; mobil: orange ikonknap |
| Afklaringspanel | 864 bredt (inputfeltets bredde), bund 122, radius 12, skygge 0 12 32 rgba(.12), padding 24, 1 px divider-subtle |
| Panelhoved | titel 16/500/24; chevron og × 18, gap 12, margin-bottom 16 |
| Panelrækker | surface-panel, divider-subtle kant, radius 8, padding 14/16, 8 px mellemrum; titel 16/24 ink; "(Anbefalet)" 14 text-secondary; beskrivelse 14/22 text-secondary |
| "Andet"-felt | 44 højt, radius 8, "Skriv dit eget svar her"; knapper højrestillet, margin-top 16, gap 8: "Spring over" (sekundær), "Vælg" (primær) |
| Mobilark | venstre/højre 16, bund 132, padding 16, rækker 12/14, titel 15, beskrivelse 13/20 |
| Tænker | prikker 6 px i tekstfarven (`--lasso-text`, Jakob 03.10: ikke koral), gap 5, puls 1,2 s, opacitet 1/.6/.3; ingen tekst ("Lasso tænker" kun for skærmlæsere, role=status) |
| Længere opgave | statustekst (værktøjets titel) + skelet (shimmer); ingen Stop (Jakob 03.10) |
| Fuld skærm | samme bredde og sideluft som modulerne (`.col` og `.view`, i alle brudpunkter; hovedet flugter med indholdet), Jakob 03.10 (eksporten har venstre/højre 42); padding 24 0; titel 18/26/500, undertitel 14/20; hoved margin-bottom 28; download + × 32; inputfeltet bliver |
| Mobil fuld skærm | mellem modulrække og input; titel 16/22; kun × |
| Rul-ned-knap | 40 cirkel, 1 px kant, skygge 0 4 12 rgba(.1), pil ned 18, bund 170 |
| Ældre beskeder | 12 faint, centreret, margin-bottom 24, "Indlæser ældre beskeder…" |
| Tom tilstand | titel 24/32/600 "Spørg Lasso om `<fane>`"; hjælpetekst 14/22; 2 × 2 piller 864 brede (inputfeltets bredde), gap 12, hver 56 høj, radius fuld, padding 0 28, 16 ink, pil højre |
| Modulrække | Lasso-mærket først, aktiv = ink med inset 0 -2px 0 primary; faner viser et slagsikon (bygning / person / mærke) |

Ikoner i modul-links: Risiko = flag, Kreditorer = kort, Overblik = øje, Ejerskab = lag, Netværk = netværk, Regnskab =
diagram, dokument = dok, virksomhed = bygning.

## Tokens

Eksisterende tokens bruges, hvor værdien findes: afstand `--lasso-space-row/-7/-5/-4/-3/-2`; radius `--lasso-radius-lg`
(10), `--lasso-radius-card` (12), `--lasso-radius` (8), `--lasso-radius-pill`; flader `--lasso-surface-muted` og
`--lasso-surface-2`; linjer `--lasso-border-strong`, `--lasso-border`, `--lasso-divider-subtle`; accent
`--lasso-accent-soft` og `--lasso-accent-text`; skrift `--lasso-fs-label` (11), `-sm` (13), `fs` (14), `-lg` (18),
`-xl` (24); den svage tekst er `--faint` i `.p3`.

Nye, i `.p3`-blokken i `portal2.css` (lys og mørk):

| Token | Værdi |
|---|---|
| `--chat-w` | 960px (tråden; Jakob 03.10: 20 % bredere end Paper-eksporten, som har 800) |
| `--chat-input-w` | 864px (inputpille, panel, forslagsgitter; eksporten 720) |
| `--chat-body-max` | `calc(var(--chat-w) * 0.6)` = 576px (svartekst, afsnit, punkter og modul-links; Jakob 03.10: tekst 60 % af trådens bredde; mobil `none`, fuld bredde; eksporten 760) |
| `--chat-bubble-max` | 576px (mobil 280px; eksporten 480) |
| `--chat-bubble-r` | 18px |
| `--chat-lh` | 22px |
| `--chat-avatar` | 24px |
| `--chat-link-h` | 46px (mobil 40px) |
| `--chat-input-h` | 52px (mobil 48px) |
| `--chat-shadow-input`, `--chat-shadow-panel`, `--chat-shadow-jump` | skyggerne i målene (inputpille, panel, rul-ned-knap) |
| `--chat-fs-12`, `--chat-fs-16` | 12px og 16px |

## Tre svarformer

| Form | Indhold | Handlinger i rammen | Meta |
|---|---|---|---|
| Tekst | Afsnit og punktlister, 14/22 | ingen | tid og kopiér-ikon |
| Element | En enkelt komponent (`render_view` med én komponent) med titel og undertitel i kortets hoved | Download (PDF) og fuld skærm; kan ikke blive en fane | ingen |
| Side | En sammensætning af flere elementer | Download, fuld skærm og Tilføj som fane (Jakob 03.10: Tilføj som fane som modul-link: neutral pille med koral ikon, 36 px i kortets hoved; på mobil en neutral ikonknap med koral ikon) | ingen |

Teksten står altid først (en til tre korte sætninger, der siger, hvad visningen viser, uden at gentage tallene).
Modul-links står på svarets sidste linje og skrives som `[Risiko](lasso:modul/risiko)`,
`[Navn](lasso:firma/CVR-1-…)` og `[Navn](lasso:person/CVR-3-…)`; et ugyldigt id eller fokus bliver almindelig tekst
(`apps/view/src/chat/markdown.ts`). Kortets krop er `LassoView` uden ramme.

## Placering og de tre situationer

Placeringen afgøres af serveren (`place_answer`, se `docs/chat.md`), før noget vises. Flytter svaret, ser brugeren det
som en meddelelsesrække i tråden; bliver det på fanen, står der ingen række (Jakob 03.10: ingen "Svarer her"-række):

1. **Bliv i fanen** (standard). Spørgsmålet giver mening i fanens kontekst, også når det nævner en anden ("Hvad laver
   Jakob ellers?"). Svaret står i fanen uden en meddelelsesrække (Jakob 03.10: ingen "Svarer her"-række; Paper-eksportens
   "Svarer her i LASSO X A/S" gælder ikke længere).
2. **Ny fane for et firma eller en person.** Kun ved et udtrykkeligt "vis mig alt om …" eller "åbn …" og kun når
   navnet er entydigt. Den nye fane åbnes og aktiveres, spørgsmålet følger med som første besked, og i den gamle
   tråd står "Åbner Jakob Bech Benediktson i en ny fane. Fortryd" (efter de 10 sekunder: "Åbnede Jakob Bech Benediktson i en ny fane"; flyttes svaret til en fane, der allerede var åben: "Svarer i fanen `<navn>`"). Fortryd virker i 10 sekunder og er kun på
   klienten: strømmen standses, en fane, der blev åbnet til turen, lukkes, og turen fjernes fra den gamle tråd;
   derefter forsvinder linket, men rækken står. Den nye fane starter en frisk samtale.
3. **Global fane.** Spørgsmål uden ét firma eller én person (lister, sammenligninger, analyser), stillet fra en
   fane, der ikke er global, eller fra forsiden, giver en fane med et af de fire navne og Lasso-mærket som ikon.
   Den viser kun Lasso-modulet (D4).

Mere end én fane pr. spørgsmål findes ikke, og Lasso åbner aldrig en fane, brugeren ikke har bedt om.

## Afklaringspanelet

Er der flere mulige match, vises et panel lige over inputfeltet, lige så bredt som det (864 px) (på telefon et ark fra bunden med 16
px sideluft). Hoved: spørgsmålet og to knapper, fold sammen og luk. Rækker: titel, "(Anbefalet)" på den mest
sandsynlige (den står først), og en linjes beskrivelse (rolle, alder, by, virksomheder); ingen talmærker (tallene
1 til 9 er skjulte tastaturgenveje). Sidste række er "Andet" med feltet "Skriv dit eget svar her". Knapperne er
"Spring over" (sekundær) og "Vælg" (primær). Enkeltvalg som radiogruppe; Esc springer over; den valgte række har 1 px
`--lasso-focus-border` (D10). Panelet kommer kun ved flere match, aldrig for at vælge placering eller for at tilbyde
kort eller fuld indsigt.

## Sideskabeloner og den røde pin

"Tilføj som fane" står på hvert sidekort om fanens egen virksomhed eller person (show_company, show_person og
render_view som side; aldrig et enkelt element og aldrig på en global fane). På en sådan side (fx et KYC-overblik), gemmer den siden
som en **sideskabelon** bundet til entitetens slags (virksomhed eller person) via `/api/portal/templates` (se
`docs/chat.md`). Skabelonen bliver et ekstra modul efter de indbyggede i modulrækken på hver enhed af den slags og
vises med den enheds data; modulets navn er sidens titel.

Pinnen (`pin` i `icons.tsx`) vises kun på et skabelonmodul, og den er rød og betyder "tilføjet på alle virksomheder"
(eller "alle personer"). Et klik åbner en bekræftelse og fjerner skabelonen alle steder:

- Titel: "Fjern modulet?"
- Tekst: "KYC-overblik fjernes fra alle virksomheder. Det kan ikke fortrydes." (sidens titel indsættes; "alle
  personer" for en personskabelon)
- Knapper: Annuller (sekundær) og Fjern (primær)

Efter fjernelsen står en åben fane på modulet på Overblik. De indbyggede moduler har ingen pin.

## Tilstande

| Tilstand | Udseende |
|---|---|
| Tom | Lasso-avatar 40 px, titel "Spørg Lasso om `<fane>`", hjælpetekst efter slags og fire piller (tre faste og en fjerde pr. slags: "Lav et fuldt KYC-overblik" på en virksomhed, "Vis netværket" på en person, "Sammenlign de største" globalt); forslagene under feltet skjules |
| Tænker | Tre prikker i tekstfarven, ingen tekst (Jakob 03.10) |
| Længere opgave | Værktøjets titel i ord og skelet med shimmer; ingen Stop (Jakob 03.10) |
| Fejl | Almindelig tekst og linket "Prøv igen" |
| Lang samtale | Ældre ture indlæses, mens man ruller op ("Indlæser ældre beskeder…"); rul-ned-knappen vises, når man er rullet op |
| Ventende | Inputfeltet er slået fra, mens et svar hentes; ingen Stop (Jakob 03.10). Hentningen afbrydes kun, når fanen lukkes, eller flytningen fortrydes |

## Mobil

Tråden fylder hele bredden med 16 px luft, bobler højst 280 px, inputpille 48 høj lige over bundlinjen (bund 140, 76
uden forslag), modul-links 40 høje, forslagene stablet. Et element har kun fuld skærm; en side har desuden Tilføj som
fane som et orange ikon. Fuld skærm ligger mellem modulrækken og inputfeltet med kun et kryds. Afklaringen er et ark.
Mobilens øvrige ramme (tælleren "2 åbne" og bundbjælken i eksportens eksempler) er ikke en del af chatten (D8).

## Beslutninger

Truffet ved gennemgangen af eksporten (D1 til D10) og af ejeren; ejerens afgørelser står først.

- **Ejerdiagrammet tilpasses vinduet (Jakob 03.10).** I kort, fuld skærm og Ejerskab-modulet viser diagrammet hele
  grafen i både bredde og højde ved første visning (`fitOwnership` i `packages/ui/src/ownershipLayout.ts`): lærredet er
  så højt som den tilpassede graf, højst vinduets synlige højde, så en dyb struktur skaleres i stedet for at blive
  klippet. Zoom, panorering og Tilpas virker bagefter; har brugeren zoomet eller panoreret, beholdes det ved resize.
- **Ingen række efter Tilføj som fane (Jakob 03.10).** Fanen skifter til det nye modul, og den røde pin er bekræftelsen;
  der står ingen meddelelsesrække "Tilføjet som modul …" i samtalen. En fejl står stadig som tekst (med "Prøv igen"
  ved netværks- og serverfejl).
- **20 % bredere (Jakob 03.10).** `--chat-w` 960, `--chat-input-w` 864, `--chat-body-max` 60 % af tråden (576; Jakob 03.10), `--chat-bubble-max`
  576; mobilværdierne er uændrede. Fuld skærm har modulernes bredde og sideluft (`.col` og `.view`).
- **Spørgsmålet øverst (Jakob 03.10).** Når et svar kommer og er færdigt, står brugerens spørgsmål øverst i det synlige
  (16 px luft, `anchorScrollTop` i `chat/util.ts`) med svarets tekst og kortets top under; et langt kort følges ikke
  ned, og "Rul til nyeste" viser, at der er mere. Har brugeren selv rullet, bliver positionen stående, og en fane, man
  vender tilbage til, står, som man forlod den (med mindre der er kommet nye ture).
- **Ingen opfølgende spørgsmål i portalen (regel 8).** `LassoFollowUps` tegnes aldrig i portalen: ikke i modulerne,
  ikke i egne sider og ikke i kort eller fuld skærm i samtalen (`forPortal`/`withoutFollowUps` i `model.ts`); forslagene
  står kun under spørgefeltet. `/mcp` og `/chat` beholder dem.
- **Ingen chatknapper i portalen (Jakob 03.10).** Heller ikke de andre knapper til et næste spørgsmål eller en anden
  fane: svarets bundlink (`answer.next`, "Se hele økonomien"), "Se alle N … i <fane> →" (komponenternes `more` med et
  fokus) og modulværktøjslinjens spørgsmål (`group.toolbar`) fjernes af `withoutChatPrompts` (via `forPortal`) i
  modulerne, egne sider, kort og fuld skærm. Uden `more` folder "Se alle"/"Vis alle" ud på stedet; de almindelige
  udfoldningslinks bliver.
- **Tilføj som fane på hvert sidekort (regel 5).** Også `show_company`/`show_person`-sider om fanens entitet. En sådan
  side hedder entiteten selv; skabelonen får så modulets navn (sidens undertitel, fx "Ejerskab") i stedet for navnet
  (`templateTitle`).

- **Sideskabeloner (erstatter D3).** Tilføj som fane på en sammensat side gemmer en sideskabelon bundet til entitetens
  slags, som vises som et ekstra modul på hver enhed af den slags, med den enheds data (`/api/portal/templates`).
  Det erstatter planen om at gemme siden som en enkelt fane eller som en delt visning.
- **Pinnen bliver (afviger fra eksportens regel 1).** På et skabelonmodul er den rød ("tilføjet på alle
  virksomheder/personer"); et klik giver bekræftelsen "Fjern modulet?" og fjerner skabelonen alle steder.
- **D1** Følg og Gem i modulrækken står som i PORTAL.md. Modulrækkens mål er uændrede (52 høj, gap 22).
- **D2** Ingen midterprik. README-reglen "Ingen midterprik nogen steder" gælder også i chatten, så eksportens
  "Lasso · 09:41" bliver "Lasso 09:41" (to spans), meddelelsesrækken "Åbner Jakob Bech Benediktson i en ny fane.
  Fortryd", og undertekster skrives med komma. **Afvigelse fra eksporten.**
- **D4** Globale faner viser kun Lasso-modulet, til Liste, Sammenligning, Kort og Noter findes.
- **D5** Skelettet er en shimmer, som README beskriver.
- **D6** Knapper er `Button` og `IconButton` (14 px, mindst 32 px). **Afvigelse fra eksporten** (13 px og 28 px).
  Tilføj som fane er modul-link-pillen (`chat-link chat-card__add`, Jakob 03.10); `IconButton`'s `primary`-variant er fjernet igen.
- **D7** Chatcachens levetid er stadig 24 timer.
- **D8** Mobilens ramme uden for chatten (tæller, bundbjælke) er ikke med.
- **D9** Tidspunkter vises som "09:41" (`hhmm()`).
- **D10** Den valgte række i afklaringspanelet har 1 px `--lasso-focus-border`.
- Lasso-mærket er `LassoMark`-komponenten, ikke eksportens glyf.
- Tom tilstand: fire piller; den fjerde afhænger af slagen (se Tilstande).
