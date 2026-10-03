# Lassos egen chat (Claude Platform)

Chatten giver samme oplevelse som Lasso-connectoren i Claude.ai, men i Lassos eget produkt: brugeren
stiller et spørgsmål, Claude vælger værktøj, og svaret vises som en interaktiv Lasso-visning.

## Sådan hænger det sammen

```
browser (/chat)  ──POST /api/chat (SSE)──▶  server: chat/agent.ts
                                              │  Claude Platform (Messages API, @anthropic-ai/sdk)
                                              │  ⇅ tool_use / tool_result
                                              └─ MCP-server i processen (InMemoryTransport)
                                                 = de samme værktøjer og instruktioner som /mcp
```

- **Samme værktøjer som MCP.** Chatten forbinder sig til `createMcpServer` i processen og giver Claude
  præcis de værktøjer og beskrivelser, Claude.ai får fra `/mcp`, plus to af sine egne (`find_entity`,
  `ask_choice`, se nedenfor). App-interne værktøjer (`resolve_view`) udelades. Ændres et værktøj, ændres
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
   de åbne faner (højst 20) og et evt. valg fra valgmenuen.
3. **Det, brugeren skriver** (`message`).

Konteksten står som første tekstblok i brugerens tur, fx `[Kontekst] Aktiv fane: virksomheden LASSO X A/S
(CVR-1-34580820), modul ejerskab. Brugeren ser: ejerskab — … Åbne faner: Jakob Benediktson (CVR-3-4000123).`
(`apps/server/src/chat/context.ts`). Serveren svarer altid i den aktive kontekst og skifter aldrig kontekst
selv: en anden fane åbnes kun ved et klik i en visning (uden AI) eller ved brugerens valg i en valgmenu.

**Valgmenuen (`ask_choice`).** Lægger spørgsmålet op til en anden kontekst ("vis alt om Jakob" på LASSO X's
side, "åbn X", en global liste fra en side), eller er et navn tvetydigt, kalder modellen `ask_choice` uden
nogen visning. Serveren sender `choice` (spørgsmål, 1–8 punkter med hver sin handling, fritekst tilladt) og
afslutter turen; andre værktøjskald i samme svar afvises ("vis intet, før brugeren har valgt"). Punktets
handling (`action`) er placeringen: `current` (svaret skrives her), `entity` (på personens/virksomhedens egen
fane, med `focus`) eller `global`. Brugerens valg kommer med næste spørgsmål som `context.choice`
(`{ id, index, action }`, eller `{ id, free: true }` ved fritekst); serveren tjekker, at `id` er modellens eget
`ask_choice`-kald i den signerede historik, og at `action` er præcis punktets (ellers 400 "Valget passer ikke
til samtalen"). Så står valget først i konteksten ("Brugeren valgte 'Alt om Jakob Benediktson': svaret
skrives på personen …"), og modellen gør det i ét trin. Spørger brugeren om noget andet i stedet, svares der
her. Kandidater med id'er finder modellen med `find_entity` (navneopslag uden visning; de åbne faner tæller
som præcise match), aldrig `show_person` med et fornavn alene.

**Placeringen bæres, ikke bestemmes.** Første hændelse i hver tur er `placement` (fra valget, ellers
`current`; på forsiden `global`), sendt før modellen kaldes, og den gentages i `done`. Portalen åbner eller
aktiverer kun en anden fane på `placement`, aldrig på en visning.

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
| `placement` | `placement`, `target?`, `focus?` | Første hændelse i hver tur: hvor svaret skrives (`current`, `entity` med `target` {kind, id, name}, eller `global`). |
| `text` | `text` | Et stykke af Claudes tekst (streames). Tekst og visninger kommer i den rækkefølge, de laves. |
| `tool` | `id`, `name`, `title` | Et værktøj er gået i gang ("Vis virksomhed"). |
| `view` | `id`, `name`, `form`, `spec`, `dataset`, `pdfLink?` | Visningen fra værktøjet. `form` er `page` (show_*, søgninger, render_view med layout page) eller `module`. Tegnes med `LassoView`. |
| `tool_error` | `id`, `name`, `message` | Værktøjet fejlede. Claude får fejlen og kan rette sig. |
| `choice` | `id`, `question`, `options[{label, action}]`, `allowFreeText` | Valgmenuen (ask_choice). Turen slutter; valget sendes med næste spørgsmål i `context.choice`. |
| `error` | `message` | Samtalen kunne ikke fortsætte (Claude-fejl, afvist svar, for mange trin). |
| `done` | `history`, `sig`, `placement` | Sendes med næste spørgsmål. `history` er den trimmede historik (se nedenfor). |

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
`lasso-chat`): historik og signatur, de åbne faner og det seneste svar pr. fane (også en åben valgmenu), bundet
til brugerens id og med 24 timers udløb (`CHAT_CACHE_TTL_MS` i `apps/view/src/portal2/model.ts`). Så overlever
samtalen en genindlæsning. Kun den trimmede historik fra `done` gemmes, og aldrig mens der hentes. Er lageret
fuldt, kastes den ældste halvdel af turene (hele ture), og der prøves én gang til; ellers springes gemningen
over. Lageret ryddes ved udløb, for en anden bruger og når sessionen er logget ud. Modulernes data gemmes
ikke; de hentes igen.

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

TODO (ikke lavet endnu): værktøjssvarenes resuméer til modellen er den største omkostning i samtalen; hold dem
korte.

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

Lokalt uden nøgle: `npx tsx apps/server/src/dev/chat-preview.ts` starter serveren med en falsk model
på http://localhost:3999/chat og /portal; skriver man "alt om …", viser den valgmenuen først.
