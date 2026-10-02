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
  præcis de værktøjer, beskrivelser og instruktioner, Claude.ai får fra `/mcp`. App-interne værktøjer
  (`resolve_view`) udelades. Ændres et værktøj, ændres chatten med.
- **Visningen til browseren, teksten til modellen.** Værktøjets spec og datasæt streames til browseren
  som en `view`-hændelse og tegnes med `LassoView`. Modellen får kun resuméteksten, ikke tekstkortet.
- **Klik i visningen** (åbn person/virksomhed, filtre, gem, PDF) går til portal-API'et uden en tur til
  modellen. Opfølgende spørgsmål ("Se hele økonomien", "Se alle … i Historik") sendes som nye beskeder.

## API: `POST /api/chat`

Body: `{ "message": "…", "history": [...], "sig": "…" }`. `history` og `sig` er det, sidste `done` gav.
Serveren gemmer ingen samtaler. `sig` binder historikken til brugeren, så en klient ikke kan lægge falske
værktøjssvar ind.

Svar: `text/event-stream`, én `data: <json>` pr. hændelse:

| type | felter | |
|---|---|---|
| `text` | `text` | Et stykke af Claudes tekst (streames). |
| `tool` | `id`, `name`, `title` | Et værktøj er gået i gang ("Vis virksomhed"). |
| `view` | `id`, `name`, `spec`, `dataset`, `pdfLink?` | Visningen fra værktøjet. Tegnes med `LassoView`. |
| `tool_error` | `id`, `name`, `message` | Værktøjet fejlede. Claude får fejlen og kan rette sig. |
| `error` | `message` | Samtalen kunne ikke fortsætte (Claude-fejl, afvist svar, for mange trin). |
| `done` | `history`, `sig` | Sendes med næste spørgsmål. |

`GET /api/chat/status` → `{ enabled, user, model }`.

**Adgang:** en portal-session (cookie + headeren `x-lasso-portal: 1`) eller en brugernøgle fra
`MCP_USER_KEYS` som `Authorization: Bearer <nøgle>` (server-til-server fra Lassos produkt). Er portalen åben
(`PORTAL_PUBLIC=true`), er chatten også åben fra portalens side som demobrugeren (headeren kræves), og bremsen
tæller så pr. IP-adresse.

## Portalen (/portal)

`/portal` er den nye portal efter prototypen "lasso-portal - new.html": topbjælke med søgning, ikonskinne,
virksomhedens hoved med fanerne Overblik, Økonomi, Regnskab, Ejerskab, Risiko, Historik og Kontakt, og
spørgefeltet nederst. Søgefeltet åbner virksomheden på Overblik (uden AI). Spørgefeltet er chatten: det, Claude
henter, vises under fanen med Lasso-mærket (mærket bevæger sig, mens der hentes), og man kan klikke videre i
de faste faner og tilbage til Lasso-fanen. Den klassiske portal står på `/portal/klassisk`.

Fejl før streamen er JSON `{ error }`: 400 (tom besked, ændret historik), 401, 429 (bremsen), 503
(ingen `ANTHROPIC_API_KEY`).

## Opsætning

| Variabel | Standard | |
|---|---|---|
| `ANTHROPIC_API_KEY` | (tom) | Nøglen fra platform.claude.com → API keys. Tom: chatten er slået fra. |
| `CHAT_MODEL` | `claude-haiku-4-5` | Den nyeste Haiku. `claude-sonnet-5-5` eller `claude-opus-5-5` giver mere omtanke til en højere pris, fx hvis Claude skal sammensætte egne visninger med `render_view`. |
| `CHAT_MAX_TOKENS` | `16000` | Højst så mange tokens pr. modelsvar (1024–128000). Under ca. 8000 kan en `render_view`-spec blive afbrudt. |
| `CHAT_EFFORT` | `medium` | `low` … `max`. Bruges ikke med Haiku. |
| `CHAT_MAX_PER_HOUR` | `60` | Højst så mange beskeder pr. bruger pr. time. |

Med Haiku sendes hverken `effort` eller `fallbacks`, fordi Haiku 4.5 afviser dem. Med de større modeller
sendes `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`): afviser modellen et svar, prøver
Claude Platform selv en anden model.

Lokalt uden nøgle: `npx tsx apps/server/src/dev/chat-preview.ts` starter serveren med en falsk model
på http://localhost:3999/chat.
