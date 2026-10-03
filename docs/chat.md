# Lassos egen chat (Claude Platform)

Chatten giver samme oplevelse som Lasso-connectoren i Claude.ai, men i Lassos eget produkt: brugeren
stiller et spørgsmål, Claude vælger værktøj, og svaret vises som en interaktiv Lasso-visning.

Designet af chatten (tråden, svarformerne, panelet, tilstandene, mobilen) står i `docs/design/CHAT.md`; denne fil
beskriver, hvordan den virker.

## Sådan hænger det sammen

```
browser (/chat)  ──POST /api/chat (SSE)──▶  server: chat/agent.ts
                                              │  Claude Platform (Messages API, @anthropic-ai/sdk)
                                              │  ⇅ tool_use / tool_result
                                              └─ MCP-server i processen (InMemoryTransport)
                                                 = de samme værktøjer og instruktioner som /mcp
```

- **Samme værktøjer som MCP.** Chatten forbinder sig til `createMcpServer` i processen og giver Claude
  præcis de værktøjer og beskrivelser, Claude.ai får fra `/mcp`, plus tre af sine egne (`find_entity`,
  `ask_choice`, `place_answer`, se nedenfor; `place_answer` står sidst i listen). App-interne værktøjer (`resolve_view`) udelades. Ændres et værktøj, ændres
  chatten med. Instruktionerne er delt i to: routingen (`ROUTING`, værktøjsvalget) er fælles, reglerne er
  hver sin (`MCP_RULES` til Claude.ai, uændret; `CHAT_RULES` i `chat/agent.ts` til chatten). MCP-serveren
  får `host: "chat"`, så visningssvaret siger "visningen vises under din tekst" i stedet for "skriv intet".
- **Visningen til browseren, teksten til modellen.** Værktøjets spec og datasæt streames til browseren
  som en `view`-hændelse og tegnes med `LassoView`. Modellen får kun resuméteksten, ikke tekstkortet.
- **Klik i visningen** (åbn person/virksomhed, filtre, gem, PDF) går til portal-API'et uden en tur til
  modellen. Opfølgende spørgsmål ("Se hele økonomien", "Se alle … i Historik") sendes som nye beskeder.
- **Svaret bygger på Lassos data.** Tal, navne, roller, status, datoer og vurderinger kommer fra et
  værktøjssvar i samtalen eller fra "Brugeren ser" i konteksten, aldrig fra modellens egen viden. Et
  faktaspørgsmål kalder først det rette værktøj (medmindre tallet allerede står i konteksten eller et
  tidligere værktøjssvar); mangler Lasso data, siger modellen det ligeud ("Lasso har ikke regnskab for 2025
  endnu") i stedet for at gætte; tal i teksten er de samme som i værktøjssvaret, med år og kilde. Der
  lægges aldrig websøgning i chatten. Reglen står i `CHAT_RULES` og kan ikke håndhæves i løkken: et
  tekstsvar uden værktøjskald leveres stadig.

## Kontekst: hvert spørgsmål besvares, hvor brugeren står

Modellen får tre lag af kontekst, alle i brugerens tur, aldrig i systemprompten (den er stabil for cachen):

1. **Historikken**: samtalen indtil nu (`history`), signeret og trimmet af serveren.
2. **Det, brugeren ser** (`context`): den aktive fane (virksomhed, person eller forsiden/et resultat =
   globalt), modulet og serverens resumé af modulets data (`active.view`, højst 4000 tegn, samme tekst som
   værktøjssvarene giver modellen; portalen henter det med siden fra `/api/portal/company` og `/person`),
   de åbne faner (højst 20) og et evt. valg fra valgmenuen. Resuméet sendes kun, når det er nyt i samtalen:
   portalen husker et fingeraftryk (fane, modul, hash) af det, modellen sidst fik, og sender ellers
   `view: { module, same: true }`, som serveren skriver som "Brugeren ser: <modul> (uændret siden sidst)." (det
   fulde resumé står allerede i historikken). Det fulde sendes igen i en ny samtale, efter 400 "Samtalen kunne
   ikke genkendes" og når serveren har trimmet historikken (første besked i `done.history` er ikke længere den,
   der blev sendt). Trimmer serveren i selve den tur, et `same` sendes, tjekker den, om det fulde resumé for fanen og
   modulet stadig står i en bevaret brugerbesked; gør det ikke, skrives ingen "Brugeren ser"-linje i den tur, og
   modellen svarer som på et spørgsmål uden resumé (`withoutStaleSame` i `chat/context.ts`).
3. **Det, brugeren skriver** (`message`).

Konteksten står som første tekstblok i brugerens tur, fx `[Kontekst] Aktiv fane: virksomheden LASSO X A/S
(CVR-1-34580820), modul ejerskab. Brugeren ser: ejerskab — … Åbne faner: Jakob Benediktson (CVR-3-4000123).`
(`apps/server/src/chat/context.ts`). Serveren svarer altid i den aktive kontekst og skifter aldrig kontekst
selv: en anden fane åbnes kun ved et klik i en visning (uden AI), ved brugerens valg i en valgmenu eller når
brugeren udtrykkeligt beder om den ("vis alt om X", "åbn X"; se `place_answer` nedenfor).

**Valgpanelet.** Menuen vises som et panel over spørgefeltet (på telefon som et ark): overskrift med spørgsmålet
og knapperne fold sammen og luk; punkter med titel (`label`) og en linjes beskrivelse (`description`), uden
nummermærker (tallene 1…9 er skjulte tastaturgenveje); det anbefalede (`recommended`, højst ét) står først og
er markeret "(Anbefalet)"; en sidste række "Andet" med feltet "Skriv dit eget svar her"; "Spring over" og "Vælg".
Enkeltvalg (radiogruppe); Esc springer over. "Spring over" er kun klienten: menuen lukkes på fanen, intet sendes,
og næste spørgsmål besvares her. Skriver brugeren i det almindelige spørgefelt, mens panelet står åbent, sendes
det stadig som `choice.free` (hvis menuen tillader fritekst). Kun `action` er afgørende for placeringen og indgår
i verificeringen; titel, beskrivelse og anbefaling stoles der ikke på. Grænserne (description højst 160 tegn,
højst ét anbefalet punkt, mindst to punkter) tjekkes af zod på serveren (mindst to kun i `run()`, så gamle menuer
med ét punkt stadig kan bekræftes) og står kun i beskrivelserne i det skema, der sendes til API'et (strict tool
use kender ikke min/max).

**Valgmenuen (`ask_choice`) er kun til flere match.** Passer et navn på flere ("vis alt om Jakob"), finder
modellen kandidaterne med `find_entity` (navneopslag uden visning; de åbne faner tæller som præcise match) og
kalder `ask_choice` uden nogen visning: ét punkt pr. kandidat (placement `entity` med `entity` fra `find_entity`,
`focus` overblik), titel = navnet, beskrivelse = rolle, alder, by og virksomheder, den mest sandsynlige først og
anbefalet. Der tilbydes aldrig kort eller fuld indsigt, og menuen bruges aldrig til at vælge placering. Serveren
sender `choice` (spørgsmål, 2–8 punkter, fritekst tilladt) og afslutter turen; andre værktøjskald i samme svar
afvises ("vis intet, før brugeren har valgt"). Punktets handling (`action`) er placeringen: `current`, `entity`
(med `focus`) eller `global` (med `title`, et af de fire generiske navne). Brugerens valg kommer med næste
spørgsmål som `context.choice` (`{ id, index, action }`, eller `{ id, free: true }` ved fritekst); serveren tjekker,
at `id` er modellens eget `ask_choice`-kald i den signerede historik, og at `action` er præcis punktets (ellers 400
"Valget passer ikke til samtalen"). Så står valget først i konteksten ("Brugeren valgte 'Jakob Benediktson': svaret
skrives på personen …"), valget er bindende (`place_answer` afvises), og modellen gør det i ét trin. Spørger
brugeren om noget andet i stedet, svares der her.

**Placeringen vælges med `place_answer`, før noget vises.** Modellen kalder `place_answer` højst én gang pr. tur og
som det første; placeringen er altså afgjort, før en visning tegnes (højst én fane pr. spørgsmål). Standard er at
blive: `current` (på en person eller virksomhed er det "her"; nævner spørgsmålet en anden, men brugeren ikke har
bedt om dens side, kalder modellen `current`). `entity` (en anden persons eller virksomheds egen fane) kræver, at
brugerens besked udtrykkeligt beder om det (`EXPLICIT_OPEN` i `chat/place.ts`: "vis/se (mig) alt/det hele" eller
"åbn"), at id'et ikke er den aktive fane, og at id'et enten står i de åbne faner eller er det eneste kandidat, når
serveren selv slår navnet op (`resolveEntity`, grænse 2); navnet kommer fra kandidaten, ikke fra modellen. Passer
navnet på flere, svarer serveren med en fejl ("Navnet passer på flere; kald ask_choice med kandidaterne."). `global`
(en liste, sammenligning eller analyse) kræver en `title` fra de fire generiske navne `GLOBAL_TITLES`
(Firmaliste, Sammenligning, Markedsanalyse, Kort), aldrig spørgsmålet; på en resultatfane med navn bliver man
(`current`). Fejl er `is_error`-værktøjssvar (og `tool_error`-hændelser), så modellen kan rette; kommer `place_answer`
i samme svar som en visning og afvises, vises intet i det svar. `place_answer` efter en visning, en anden gang i
samme tur og efter et bindende valg i menuen afvises også. Serveren kontrollerer, at modellen ikke kan åbne faner,
brugeren ikke bad om (reglen står i serveren, ikke kun i prompten).

**Placeringen på hændelserne.** Første hændelse i hver tur er `placement` (fra valget, ellers `current`; på
forsiden `global`), sendt før modellen kaldes. Lykkes `place_answer`, sendes endnu en `placement` med `decided: true`
(og `here: true` ved `current` på en entitet, `title` ved `global`). Et skifte af fane sker, når placement er `entity`,
eller `global` fra en fane, der ikke er global; højst én gang pr. tur, efter den første `placement`-hændelse.
Portalen åbner eller aktiverer kun en anden fane på `placement`, aldrig på en visning. Åbner `entity` en ny fane,
står fanen, man spurgte fra, præcis som før (hverken nulstillet til Overblik eller genindlæst); spørgsmålet og
notitsen "Åbner X i en ny fane. Fortryd" står i den gamle tråd, svaret i den nye.

**Frisk historik ved et skifte.** Flytter svaret (entity, eller global fra en fane), starter den nye fane en ny
samtale: `done.history` er kun denne tur (beskederne efter den bevarede historik), `done.fresh` er `true`, og
signaturen gælder den friske historik. Klienten gemmer den på den nye fane; den gamle fanes historik er uændret.
Blev fanen åbnet til turen, og brugeren fortryder (10 sekunder, `Fortryd`; kun klienten, serveren ved intet om det), standses strømmen, fanen lukkes (eller
turen fjernes fra den eksisterende fane), og turen fjernes fra den gamle tråd; efter 10 sekunder forsvinder linket,
og notitsen bliver stående.

**Flytning ind i en fane, der allerede er åben.** Fandtes målfanen (fx et firma, der allerede er åbent), erstatter
den friske historik fanens tidligere samtale: modellens hukommelse på den fane nulstilles til den flyttede tur, mens
de tidligere ture stadig står synlige i tråden. Klienten husker fanens samtale fra før (historik, signatur og det
sendte resumé) på flytningens notits (`prev`), så `Fortryd` lægger den tilbage, også når svaret allerede er færdigt. En åben fane, der aldrig har haft en samtale, husker en tom samtale, så den flyttede turs historik heller ikke bliver stående dér.
`prev` gemmes ikke i browseren; efter en genindlæsning kan flytningen ikke fortrydes.

**Fanenavne.** En entitetsfane hedder det, entiteten hedder. En resultatfane hedder aldrig spørgsmålet, men et af de
generiske navne `Firmaliste`, `Sammenligning`, `Markedsanalyse` eller `Kort`: fra `place_answer`/valgets `title`, og
på forsiden uden valgt navn sætter serveren et ud fra den første visning (`done.placement.title`: søgninger og
gemte sider = Firmaliste, `compare_companies` = Sammenligning, en visning med `LassoMap` = Kort, ellers
Markedsanalyse). Uden visning er der intet navn; en resultatfane med navn beholder sit.

**Tilføj som fane (egne sider).** På en side, chatten har sat sammen om én virksomhed eller person (fx et
KYC-overblik), gemmer "Tilføj som fane" siden som en **sideskabelon** bundet til entitetens slags: den dukker op som
et ekstra modul (efter de indbyggede, med sidens titel) på hver virksomhed (eller person), brugeren åbner, og vises
med den enheds data. Specen gemmes uden entiteten, og uden hoved (`LassoCompanyHead`/`LassoPersonHead`) og opfølgende spørgsmål (`LassoFollowUps`), som bærer navnet; entitetens navn (slået op i Lasso) klippes af titel og undertitel (efterstillet ", Navn"/" – Navn", også uden A/S, ApS), en tom titel bliver første komponents titel eller "Side", og står navnet stadig i specen, afvises siden (400 "Siden indeholder stadig navnet; omdøb den først."). Teknisk: `templateFromSpec` (`apps/server/src/pages/templateSpec.ts`)
erstatter hver strengværdi, der er entitetens Lasso-ID (eller virksomhedens CVR-nummer), med `{{entity}}`, og
afviser en side uden en forekomst ("Siden handler ikke om én virksomhed/person"); `instantiate` sætter det nye id
ind igen. Andre virksomheder i specen (en benchmark, en sammenligning) røres ikke. Skabelonerne er pr. bruger og
organisation (tabellen `page_templates`, eller hukommelsen uden database; højst 50 pr. bruger). Portal-API'et
(session + CSRF som resten):

| kald | |
|---|---|
| `POST /api/portal/templates` `{ kind, title, subtitle?, spec, entity: { kind, id } }` | gemmer; svar `{ id, kind, title, subtitle?, createdAt }` (uden spec); 400 ved ugyldig spec, en side uden entiteten, en slags der ikke passer til id'et |
| `GET /api/portal/templates?kind=company\|person` | `{ templates: [{ id, kind, title, subtitle?, createdAt }] }`, ældste først, kun brugerens egne |
| `DELETE /api/portal/templates/:id` | `{ id, removed: true }`; en andens eller ukendt id er 404 "Siden findes ikke."; listen afspejler det med det samme |
| `GET /api/portal/templates/:id/render?entity=<Lasso-ID>` | `{ spec, dataset, summary }` for den enhed, gennem samme vej som `resolve_view` (brugerens dataadgang); titel og undertitel fra skabelonen; `summary` er "Brugeren ser"-resuméet; 400 hvis id'et ikke passer til slagsen, 404 ved en andens id |

Klienten (`api.templates.list/save/remove/render`, `moduleTabs` i `portal2/model.ts`) viser skabelonerne som moduler
med nøglen `tpl:<id>` (højst 40 tegn, som `context.tab`); fjernes en skabelon, står en fane på den på Overblik.
Chattens `done`- og `view`-hændelser er uændrede: klienten sender den spec, den allerede har.

**Den røde pin.** På et skabelonmodul står pinnen rød ("tilføjet på alle virksomheder/personer"). Et klik åbner en
bekræftelse ("Fjern modulet?", "<titel> fjernes fra alle virksomheder. Det kan ikke fortrydes.", Annuller / Fjern), og
Fjern kalder `DELETE /api/portal/templates/:id` (`api.templates.remove`): skabelonen forsvinder fra alle enheder af
slagen, og en åben fane på modulet står derefter på Overblik. De indbyggede moduler har ingen pin. Designet står i
`docs/design/CHAT.md`.

## API: `POST /api/chat`

Body: `{ "message": "…", "context": {...}, "history": [...], "sig": "…" }`. `history` og `sig` er det, sidste
`done` gav. Serveren gemmer ingen samtaler. `sig` binder historikken til brugeren, så en klient ikke kan lægge
falske værktøjssvar ind. `context` (valgfri; uden den svares der globalt, så Bearer-kald og `/chat` virker):

```json
{ "active": { "kind": "company", "id": "CVR-1-34580820", "name": "LASSO X A/S", "tab": "ejerskab",
              "view": { "module": "ejerskab", "summary": "…" } },
  "open": [ { "kind": "person", "id": "CVR-3-4000123", "name": "Jakob Benediktson" } ],
  "choice": { "id": "toolu_01…", "index": 0, "action": { "placement": "entity", "entity": { "kind": "person", "id": "CVR-3-4000123", "name": "Jakob Benediktson" }, "focus": "overblik" } } }
```

`active.kind` er `company`, `person` eller `global` (forsiden eller et resultat, med valgfri `title`). Id'er
valideres (CVR-1-…/CVR-nummer, CVR-3-…), `open` højst 20, `view.summary` højst 4000 tegn; ellers 400
"context er ugyldig". `choice` sendes kun i turen lige efter en `choice`-hændelse.

Svar: `text/event-stream`, én `data: <json>` pr. hændelse:

| type | felter | |
|---|---|---|
| `placement` | `placement`, `target?`, `focus?`, `title?`, `decided?`, `here?` | Første hændelse i hver tur: hvor svaret skrives (`current`, `entity` med `target` {kind, id, name}, eller `global` med `title`). Efter et vellykket `place_answer` kommer en ny med `decided: true` (`here: true` ved `current` på en entitet). |
| `text` | `text` | Et stykke af Claudes tekst (streames). Tekst og visninger kommer i den rækkefølge, de laves. |
| `tool` | `id`, `name`, `title` | Et værktøj er gået i gang ("Vis virksomhed"). |
| `view` | `id`, `name`, `tool`, `form`, `spec`, `dataset`, `pdfLink?` | Visningen fra værktøjet. `form` er `page` (show_*, søgninger, render_view med layout page) eller `module`. `tool` er MCP-værktøjets navn (som `name`): klienten viser "Tilføj som fane" kun for `render_view`. Tegnes med `LassoView`. |
| `tool_error` | `id`, `name`, `message` | Værktøjet fejlede. Claude får fejlen og kan rette sig. |
| `choice` | `id`, `question`, `options[{label, description, recommended?, action}]`, `allowFreeText` | Valgmenuen (ask_choice, kun til flere match). Turen slutter; valget sendes med næste spørgsmål i `context.choice`. |
| `error` | `message` | Samtalen kunne ikke fortsætte (Claude-fejl, afvist svar, for mange trin). |
| `done` | `history`, `sig`, `placement`, `fresh?` | Sendes med næste spørgsmål. `history` er den trimmede historik (se nedenfor); ved `fresh: true` er svaret flyttet til en anden fane, og `history` er kun denne tur (hører til den nye fane). `placement.title` kan være sat af serveren (generisk navn). |

Et svar kan være tekst, en eller flere visninger, eller begge dele ("Jakob har 4 firmaer …" og et ejerdiagram),
eller en hel side. Portalen viser delene i rækkefølge under spørgsmålet.

`GET /api/chat/status` → `{ enabled, user, model }`.

**Adgang:** en portal-session (cookie + headeren `x-lasso-portal: 1`) eller en brugernøgle fra
`MCP_USER_KEYS` som `Authorization: Bearer <nøgle>` (server-til-server fra Lassos produkt). Er portalen åben
(`PORTAL_PUBLIC=true`), er chatten også åben fra portalens side som demobrugeren (headeren kræves), og bremsen
tæller så pr. IP-adresse.

## Portalen (/portal)

`/portal` er den nye portal efter prototypen "lasso-portal4.html": topbjælke med søgning mens man skriver
(firmaer og personer fra Lassos navnesøgning, `GET /api/portal/lookup`, med status, genveje og seneste), faner for
åbne firmaer, personer og resultater, ikonskinne,
virksomhedens hoved med fanerne Overblik, Økonomi, Regnskab, Ejerskab, Risiko, Historik og Kontakt, og
spørgefeltet nederst. Et valg i søgningen åbner firmaet eller personen på Overblik (uden AI). Spørgefeltet er chatten: det, Claude
henter, vises under fanen med Lasso-mærket (mærket bevæger sig, mens der hentes), og man kan klikke videre i
de faste faner og tilbage til Lasso-fanen. Den klassiske portal står på `/portal/klassisk`.

Fejl før streamen er JSON `{ error }`: 400 (tom besked, ændret historik, ugyldig context, et valg, der ikke
passer til samtalen), 401, 429 (bremsen), 503 (ingen `ANTHROPIC_API_KEY`).

### Samtalen i browseren

Serveren gemmer ingen samtaler, men portalen gemmer selv samtalen i browseren (`localStorage`, nøglen
`lasso-chat`, **cache v2**): pr. fane `{ chat: { history, sig }, turns, sent }` (hver fane har sin egen historik, fordi et
skifte giver en frisk), de åbne faner og den aktive, bundet til brugerens id og med 24 timers udløb
(`CHAT_CACHE_TTL_MS` i `apps/view/src/portal2/thread.ts`, genudgivet fra `model.ts`). Så overlever samtalen en
genindlæsning. Ventende ture gemmes ikke, og tidspunktet for Fortryd (`undoUntil`) gendannes ikke (linket er væk
efter en genindlæsning). **Migrering:** en gemt v1 (ét svar pr. fane og én fælles samtale) læses som v2: hvert svar
bliver fanens eneste tur, og den fælles historik følger den aktive fane, så den kan fortsættes. Historikken afkortes
aldrig i det gemte (signaturen er en HMAC over præcis den historik, serveren gav; en afkortet kopi ville give 400
ved hvert spørgsmål efter en genindlæsning). Er lageret fuldt, droppes først visningerne (datasættene) fra de mindst
nyligt aktive faner ét ad gangen (teksten bliver; en firma- eller personfane står på Overblik og henter selv sit
modul igen ved genskabelsen), så glemmes hele samtalen (tom historik og ingen signatur i hver fane, åbne menuer
lukkes; faner og ture bliver), og først til sidst springes gemningen over; der prøves igen efter hvert trin.
Svarer serveren 400 "Samtalen kunne ikke genkendes", begynder portalen en ny samtale på fanen (tom historik), så
brugeren ikke sidder fast. Efter et logud (eller et udløbet login) gemmes samtalen ikke igen. Lageret ryddes ved
udløb, for en anden bruger og når sessionen er logget ud. Modulernes egne data (de faste faner og egne sider)
gemmes ikke; de hentes igen.

### Tokens: hvad chatværten udelader i forhold til /mcp

Alt nedenfor er slået til med `host: "chat"` i MCP-serveren; Claude.ai over `/mcp` får teksten uændret
(`chatHost.test.ts` pinner instruktionerne og `render_view`'s beskrivelse som hash).

| | /mcp (Claude.ai) | chatten |
|---|---|---|
| `render_view`'s beskrivelse | fuld: komposition, layoutguiden (Paper 30), komponentindeks med formål (~13.000 tegn) | kort (<1.500 tegn): formål, `describe_components` først, 1–12 komponenter, højst én graf, udelad width, layout "page", aldrig HTML, og typenavnene (uden dem kan modellen ikke kalde `describe_components`) |
| gem-værktøjer (`save_view`, `save_page`, `remove_saved_page`, `list_saved_pages`) | ja | nej: portalen har knapper til at gemme; routingen i systemprompten (`CHAT_ROUTING`) nævner dem ikke |
| værktøjssvar (tekst til modellen) | SILENT-linje, resumé, "Visningen er svaret: skriv ingen tekst …", link til visningen, tekstkort-blok | kun noten og resuméet; demonoten er én kort linje; `structuredContent` har samme felter (tekstkortet står dér) |
| tekst efter en visning | ingen (visningen er svaret) | en til tre korte sætninger, der sætter visningen i sammenhæng, uden at gentage tallene (`CHAT_RULES`) |
| "Brugeren ser" i konteksten | (findes ikke) | fuldt resumé første gang, derefter `same: true`, til det ændrer sig |

Målt med demodata (`buildChatSetup` + `textForModel` på show_company 99000001, 03.10.2026): værktøjslisten 37,3k → 21,7k
tegn (render_view 15,2k → 3,5k, heraf beskrivelsen 13,0k → 1,4k; de fire gem-værktøjer 3,8k væk), systemprompten 5,7k →
5,6k, et visningssvar til modellen 1,0–1,1k → 0,6–0,8k tegn (overblik 1.035 → 724, økonomi 955 → 632, ejerskab 1.083 → 754,
risiko 996 → 676), og "Brugeren ser" op til 4k tegn pr. spørgsmål → kun ved ændring. /mcp: uændret. Mål igen med samme fremgangsmåde,
når værktøjsbeskrivelser eller resuméer ændres.

### Historik og prompt-cache

Systemprompt, værktøjer og samtalen caches hos Claude Platform (`CHAT_CACHE_TTL`, standard 1 time, samme TTL
på markøren på det sidste værktøj og på beskederne), så et spørgsmål kun betaler for det nye. Derfor er
systemprompten stabil (intet pr. spørgsmål), konteksten står i brugerens tur, og chattens egne værktøjer
ligger sidst i værktøjslisten i fast rækkefølge. Hvert modelkald logges med én linje (`[chat] trin …`): input,
cache læst, cache skrevet og output; er "cache læst" 0 fra kald til kald, er noget i præfikset skiftet.

Historikken trimmes på serveren (`chat/history.ts`): over `CHAT_HISTORY_MAX_CHARS` kastes de ældste hele
ture (aldrig et værktøjssvar uden sit kald) ned til ca. 60 % af grænsen i ét hug, så det sker sjældent; hver
trimning ændrer præfikset og koster en fuld genlæsning af samtalen. Den trimmede historik er den, `done`
giver og signerer.

Chatten bruger én model i hele samtalen (`CHAT_MODEL`); et modelskift undervejs ville være en garanteret
cache-miss (cachen er pr. model), så der er intet skift til en større model til `render_view`.

TODO (delvist): værktøjssvarenes resuméer til modellen er stadig den største løbende omkostning i samtalen
(boilerplaten er væk for chatten; selve resuméets linjer kan kortes yderligere); hold dem korte.

TODO (udskudt): en server-side kontrol af datareglen (fx markere svar med tal, men uden værktøjssvar i turen).

## Opsætning

| Variabel | Standard | |
|---|---|---|
| `ANTHROPIC_API_KEY` | (tom) | Nøglen fra platform.claude.com → API keys. Tom: chatten er slået fra. |
| `CHAT_MODEL` | `claude-haiku-4-5` | Den nyeste Haiku. `claude-sonnet-5-5` eller `claude-opus-5-5` giver mere omtanke til en højere pris, fx hvis Claude skal sammensætte egne visninger med `render_view`. |
| `CHAT_MAX_TOKENS` | `16000` | Højst så mange tokens pr. modelsvar (1024–128000). Under ca. 8000 kan en `render_view`-spec blive afbrudt. |
| `CHAT_EFFORT` | `medium` | `low` … `max`. Bruges ikke med Haiku. |
| `CHAT_MAX_PER_HOUR` | `60` | Højst så mange beskeder pr. bruger pr. time. |
| `CHAT_CACHE_TTL` | `1h` | Prompt-cachens levetid, `5m` eller `1h`; samme TTL på begge markører. |
| `CHAT_HISTORY_MAX_CHARS` | `400000` | Så lang (tegn som JSON) må samtalen være, før de ældste ture kastes. |

Med Haiku sendes hverken `effort` eller `fallbacks`, fordi Haiku 4.5 afviser dem. Med de større modeller
sendes `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`): afviser modellen et svar, prøver
Claude Platform selv en anden model.

## Tjek mod det rigtige API

`npm run chat:live-check -w @lasso/server` (lokalt med `ANTHROPIC_API_KEY` i `.env`, eller `railway run npm run chat:live-check -w @lasso/server`)
sender den præcise anmodning, chatten sender (samme systemprompt, værktøjsliste med strict-skemaerne, cache-markører med
`CHAT_CACHE_TTL` og `CHAT_MODEL`, bygget af chattens egne funktioner i `chat/agent.ts`), to gange med beskeden "Sig kun ordet
ok." og `max_tokens` 64 (en brøkdel af en øre). Det skriver kun model, `stop_reason`, forbrug (input, cache skrevet, cache
læst, output) og om kald 2 læste fra cachen, aldrig nøglen eller anmodningen. Udgangskode 0: alt virker; 1: ingen nøgle (der
sendes intet) eller API-fejl (status og besked); 2: cachen læste ikke (tjek, at præfikset er over modellens mindste cachebare
længde). Kør det efter ændringer i værktøjsskemaer, `CHAT_RULES` eller cache-indstillinger.

Lokalt uden nøgle: `npx tsx apps/server/src/dev/chat-preview.ts` starter serveren med en falsk model
på http://localhost:3999/chat og /portal; skriver man "alt om …", slår den virksomheden op (`find_entity`) og åbner
dens fane (`place_answer` entity); ellers svarer den her (`place_answer` current).
