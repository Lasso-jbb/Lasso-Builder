# Risiko- og nyhedsendpoints

Denne fil dækker de to endpoints, `LassoNews` (katalog 12) og risikoobservationerne bruger.
Risikoobservationerne er fjernet fra alle visninger 27.09.2026 (komponenten `LassoRiskObservations`
komponeres, hentes og vises ikke længere); adapteren, klientkaldet og fixtures bliver, så de kan
tages i brug igen. Formerne herunder er **bekræftet mod API 27.09.2026**: staging kørte de
rigtige kald mod api.lassox.com for Novo Nordisk (CVR-1-24256790), og de bekræftede svar er
lagt ind som fixtures (`apps/server/src/lasso/fixtures/riskNews.ts`) og dækket af tests
(`apps/server/src/lasso/riskNewsAdapters.test.ts`, `apps/server/src/data/live-company.test.ts`).
Grundlaget var Lassos officielle API-dokumentation (docs.lassox.com, indsamlet 27.09.2026, se
pakken i sessionens scratchpad, `lasso-api-reference.md`, afsnittene "Risk › Observations" og
"News"); de steder, hvor det rigtige svar afveg fra dokumentationen, er rettet og markeret
nedenfor. `docs/lasso-endpoints.md` er IKKE ændret af dette arbejde; den fil markerer stadig
disse to endpoints som "ubekræftet" fra dengang formerne var gættet. Denne fil erstatter den
markering for observationer og nyheder.

Adapterne ligger i `apps/server/src/lasso/riskNewsAdapters.ts` (observationer, Lasso News,
Paqle, fletning) og `apps/server/src/lasso/newsMarkup.ts` (entitets-markup og HTML-oprydning).
`adaptNews`/`adaptObservations` genexporteres fra `apps/server/src/lasso/adapters.ts`, så
eksisterende importer uændret virker. Klienten: `apps/server/src/lasso/client.ts`
(`observations`, `lassoNews`, `news`). Fletningen af de to nyhedskilder sker i
`LiveProvider.news` (`apps/server/src/data/live.ts`).

## Observationer (Firmaindsigt)

`POST api.lassox.com/modules/observations/{lassoId}` — **120 kald/min** (strammere end den
generelle grænse på 500/min). Klienten sender body

```json
{ "observationTags": ["CompanyInsight"] }
```

("CompanyInsight" er portalens Firmaindsigt-modul; andre body-felter fra dokumentationen,
`observationTypes` og `includeDataForTypes`, bruges ikke endnu).

**Bekræftet svar (27.09.2026, Novo Nordisk, 22 direkte observationer, 11,8 s svartid).** Værdierne
nedenfor er fixturens eksempelværdier; API'et svarede faktisk `"version": "2024.02.28.1"` og
`"score": 5` for Novo Nordisk (skalaen for `score` er stadig uoplyst):

```json
{
  "version": "1.0",
  "relatedLassoId": "CVR-1-24256790",
  "relatedCompanyName": "NOVO NORDISK A/S",
  "relatedPersonName": null,
  "score": 62,
  "percentages": null,
  "relatedName": null,
  "observations": [
    {
      "title": "Virksomhedsstatus",
      "type": "CompanyStatus",
      "tags": ["Company", "CompanyInsight", "Risk"],
      "shortDescription": "Virksomhedens status er 'normal'.",
      "description": "Virksomhedens status er 'normal'.",
      "outcome": 0,
      "notAvailable": false,
      "errors": null,
      "relatedLassoId": "CVR-1-24256790"
    }
  ],
  "relatedObservations": {
    "cvr-1-24257630": [ /* … samme form, men om et TILKNYTTET SELSKAB … */ ],
    "cvr-3-4000002550": [ /* … samme form, men om en TILKNYTTET PERSON … */ ]
  }
}
```

Afvigelser fra `lasso-api-reference.md`, rettet i koden: (1) toppen af svaret har flere felter
end dokumentationen nævnte (`version`, `relatedPersonName`, `score`, `percentages`,
`relatedName`) — `version` og `score` læses nu ind i `ObservationsVM` (se nedenfor), resten
bruges ikke; (2) `errors` er `null`, ikke et tomt array, når der ingen er (adapteren læste det
aldrig, så ingen ændring krævet); (3) **`relatedObservations`-nøglerne er i SMÅ bogstaver**
("cvr-3-…"/"cvr-1-…"), og dækker BÅDE personer OG selskaber, ikke kun personer som først
antaget.

`outcome` er 0/25/50/100 og 1:1 med vores `Severity`-skala (0 neutral/grøn, 25 informativ/gul,
50 muligvis vigtig/gul, 100 muligvis vigtig/rød — guide 23 regel 10). Den fulde liste af
observationstyper (title/type/entitet/beskrivelse) står i `lasso-api-reference.md` under
"Risk › Observations"; adapteren gemmer selve `type`-strengen (fx `"DirectBankruptcies"`) råt i
`ObservationRowVM.type`, uden at fortolke den yderligere.

**Hvad adapteren læser** (`adaptObservations` i `riskNewsAdapters.ts`):

- `title` → `ObservationRowVM.title`, `shortDescription` (fald tilbage til `description`) →
  `detail`, `outcome` → `severity`, `type` → `type`, `notAvailable` → `notAvailable`.
- `version` → `ObservationsVM.version`, `score` → `ObservationsVM.score`. Skalaen for `score` er
  ikke dokumenteret (0–100? kredit-lignende?), så den vises IKKE i UI'en endnu — se
  "Verificér" nedenfor.
- `relatedObservations` (indirekte observationer, fx `DirectBankruptciesPerson`/`CompanyStatus`
  om en tilknyttet person eller et tilknyttet selskab) grupperes pr. entitet i
  `ObservationsVM.related`. Nøglerne fra Lasso er i små bogstaver; `canonicalLassoId`
  normaliserer dem til den kanoniske form (store bogstaver i kilde-delen, fx
  "CVR-3-4000002550"), så matchning mod resten af koden (som altid bruger kanonisk form) er
  case-insensitiv. Adapteren kender ikke navnet (det rå svar har det ikke);
  `LiveProvider.observations` (`apps/server/src/data/live.ts`) slår det op efterfølgende med et
  almindeligt `GET {lassoId}` på entitetens eget Lasso-ID — samme endpoint for personer og
  selskaber (bedste forsøg, højst 12 entiteter, 4 ad gangen) — og fylder `name` ind. Lykkes
  opslaget ikke, viser UI'en entitetens Lasso-ID i stedet (`RiskObservations.tsx`).
- Ældre, gættede feltnavne (`severity`/`score`/`riskScore`/…, `detail`/`explanation`/…) er
  bevaret som fallback EFTER de dokumenterede felter, så et svar i en anden form stadig giver
  noget frem for at kaste en fejl.
- Rate-grænsen (120/min) håndteres ikke med et retry-loop; klientens eksisterende cache
  (`LASSO_CACHE_TTL_SECONDS`) og negative cache (4xx undtagen 429) gælder som for alle andre kald.

**Svartid:** 11,8 s målt for Novo Nordisk (et stort selskab med mange observationer og relaterede
entiteter). `LiveProvider.observations` venter derfor højst `OBSERVATIONS_BUDGET_MS` (14 s, se
`apps/server/src/data/live.ts`) — samme `withinBudget`-mønster som kontaktopslagets
`CONTACT_BUDGET_MS` — før den fejler (som en `TimeoutError`, "Prøv igen" i UI'en) i stedet for at
lade HELE virksomhedsvisningen vente på observationerne. Det oprindelige kald fortsætter i
baggrunden og ligger klar i klientens cache til næste forsøg. **Verificér:** om 14 s er det
rigtige afvejningspunkt — er de fleste selskaber hurtigere end Novo Nordisk, eller rammer flere
selskaber jævnligt budgettet? Justér `OBSERVATIONS_BUDGET_MS`, hvis rigtig trafik viser noget
andet.

**UI (`RiskObservations.tsx`):** en `notAvailable`-række vises som ren tekst "Ikke tilgængelig"
i muted, uden badge eller farvet ikon (guide 23 regel 1 og 7), og tælles ikke med i
sammenfatningen ("3 vigtige, 5 mulige, …"). `related` vises som en underliste "Vedrører" under
virksomhedens egne observationer (både personer og selskaber kan optræde), med entitetens navn
(eller Lasso-ID) som overskrift og samme rækkeform som resten af listen.

**Verificér:** (1) skalaen for `score` (0–100? andet interval? højere er bedre eller værre?) —
feltet er læst ind (`ObservationsVM.score`), men ikke vist i UI'en, før skalaen kendes; (2) om
`notAvailable: true`-rækker altid har `outcome: 0`, som i det bekræftede eksempel, eller om
`outcome` kan være meningsløst i det tilfælde; (3) hvor mange entiteter der typisk optræder i
`relatedObservations` for andre (mindre) selskaber end Novo Nordisk, så loftet på 12
navneopslag i `LiveProvider.withRelatedNames` er rigeligt; (4) om `relatedPersonName`/
`relatedName`/`percentages` bruges til noget i praksis (de er `null` i det bekræftede eksempel
og læses ikke af adapteren i dag).

## Nyheder

To adskilte kilder flettes til én liste af `LiveProvider.news` (regel 8: én kildelinje pr.
sektion, "Kilde: …, opdateret DD.MM.ÅÅÅÅ").

### Lasso News

`POST api.lassox.com/modules/news` — body er en liste af Lasso Id'er, fx `["CVR-1-24256790"]`.
Klientmetoden `lassoNews` sætter query-parametrene `limit` (default 30), `page` (default 1),
`orderBy=publishtime` (kronologisk, så den kan flettes med Paqle efter tid — dokumentationens
egen default er `promoteduntil`) og videresender `from`/`to`/`types`, når de angives. Afprøvet
med `?limit=2&orderBy=publishtime`.

**Bekræftet svar (27.09.2026, Novo Nordisk):** rent array af nyhedsobjekter, præcis som
dokumenteret, undtagen at `providerData` var `null` (ikke set brugt af adapteren i forvejen):

```json
[
  {
    "headline": "Et medlem udtræder af bestyrelsen for {NOVO NORDISK A/S|CVR-1-24256790}",
    "content": "{Tanja Villumsen|CVR-3-4007574142} har siddet i … I bestyrelsen sidder nu <ul><li>{Britt Meelby Jensen|CVR-3-4003830981}</li>…</ul>",
    "tagLine": "…",
    "time": "2026-09-20T07:15:00Z",
    "promotedUntil": "2026-09-27T07:15:00Z",
    "type": "Board",
    "provider": "VIRK",
    "providerData": null,
    "url": "https://lasso.dk/nyheder/…",
    "storyId": "…",
    "imageId": null,
    "uniqueId": "…",
    "lassoIds": [{ "relatedLassoIdName": "NOVO NORDISK A/S", "lassoId": "CVR-1-24256790", "isMainId": true, "inQuery": true }]
  }
]
```

Bemærk: entitets-markup kan stå midt i en HTML-liste (`<ul><li>{Navn|LassoId}</li>…`), ikke kun
som løbende tekst — `stripHtml`/`plainTextFromMarkup` er testet direkte mod dette eksempel
(`riskNewsAdapters.test.ts`), og navnet kommer korrekt ud som "Britt Meelby Jensen" på sin egen
linje. `plainTextFromMarkup` blev samtidig rettet til at BEVARE linjeskift (kun vandret
mellemrum collapses) — ellers ville `stripHtml`'s linjeskift for `<li>` gå tabt igen, når
markup-parseren efterfølgende fjerner klammerne. `LassoNews.tsx` viser uddraget med
`white-space: pre-line`, så linjeskiftene faktisk ses.

**Nyhedstype → dansk etiket** (`newsTypeLabel` i `riskNewsAdapters.ts`, fra
`lasso-api-reference.md`): Account → "Nyt regnskab", Accountant → "Revisorskift", Ownership →
"Ejerskifte", Board → "Bestyrelsesændring", Management → "Ledelsesændring", Information →
"Stamdataændring", NewCompany → "Nystiftet", StatusChange → "Statusændring", Lifetime →
"Start/ophør", Ritzau → "Pressemeddelelse", Statstidende → "Statstidende", Stakeholder →
"Interessent". Etiketten står i `NewsItemVM.typeLabel` og vises som ren tekst i UI'en, ikke en
badge.

**Entitets-markup:** `headline`/`content`/`tagLine` indeholder indlejret markup i formatet
`{Navn|LassoId}`. `newsMarkup.ts` parser dette (`parseEntityMarkup`, samme regex som Lassos eget
eksempel: `/{([^}]*)}/g`, split på `|`) og udleder ren tekst (`plainTextFromMarkup`) til
`NewsItemVM.headline`/`excerpt` — UI'en får aldrig klammerne eller Lasso Id'erne, kun navnet.

**HTML i `content`:** dokumentationen siger "sæt som innerHTML", men vores UI sætter aldrig
innerHTML (`packages/ui/src/components/LassoNews.tsx`). `stripHtml` (i `newsMarkup.ts`) laver
linjeskift for `<br>`/`<li>` og fjerner resten af tags, før markup-parseren kører. Adapteren
foretrækker `tagLine` (det dokumenterede "korte resumé") som `excerpt`, med det HTML-strippede
`content` som fallback, når `tagLine` mangler.

**Kilde pr. nyhed:** `provider` i det dokumenterede svar er den bagvedliggende datakilde, ikke
en læservendt kilde. Ritzau og Statstidende er selv navngivne udgivere og vises som dem selv;
alt andet (typisk `"VIRK"`, de CVR-udledte hændelser) vises som `"Lasso"`. **Verificér:** om der
findes andre `provider`-værdier end de tre dokumenterede (VIRK, Ritzau, Statstidende) — de vil i
så fald også blive vist som "Lasso" med den nuværende logik (`lassoNewsSourceLabel`).

### Paqle

`GET api.lassox.com/data/paqle/{lassoId}/news` — kræver Paqle-tilføjelse til abonnementet.
Svaret er en pakket liste, `{ news: [...], continuationToken }`, **bekræftet 27.09.2026** som
dokumenteret (uændret fra tidligere bekræftelse, se `docs/lasso-endpoints.md`, afsnittet
"Nyheder"); `tagLine`/`imageId` kan være `null` i praksis (fixtures/tests dækker det). Kilden i
det bekræftede eksempel var `providerData.sourceName: "sundhedstinget.dk"`. `providerData.headline` og
`providerData.extract` er lister af tekstsegmenter `{ text, highlight }`, hvor
`highlight: true` er det stykke, der er virksomhedens navn. Adapteren (`adaptNews` i
`riskNewsAdapters.ts`) gemmer disse ubehandlet i `NewsItemVM.headlineSegments`/`extractSegments`,
så `LassoNews.tsx` kan vise navnet i fed direkte fra Lasso, uden selv at gætte på en
tekstsøgning (regel 17: navn i fed, aldrig koral eller farvet baggrund). Falder segmenterne
bort (ukendt form), bruges den ældre logik: en indekssøgning efter virksomhedsnavnet
(`companyName`) i den almindelige `excerpt`-tekst.

Ét `storyId`/`clusterHash` er ÉN nyhed. Kataloget forbyder at samle flere kilder til
"+N kilder", så adapteren laver ikke nogen gruppering på disse felter — hvert element i
`news`-listen bliver netop ét `NewsItemVM`.

### Fletning (`LiveProvider.news`, `mergeNews` i `riskNewsAdapters.ts`)

Lasso News hentes altid; Paqle hentes parallelt, men fejl (manglende adgang: 401/403/404, eller
enhver anden fejl — 5xx, timeout) udelades stille, uden retry. Fejler den ene kilde, mens den
anden svarer, vises blot det, der kom igennem — `LiveProvider.news` kaster aldrig videre fra en
af de to kilder. Resultatet flettes efter `time` (nyeste først; poster uden tidsstempel havner
sidst, i den rækkefølge kilden leverede dem) og skæres til `limit`. `NewsVM.sources` lister,
hvilke af de to kilder der faktisk bidrog med mindst én nyhed (til kildelinjen "Kilde: Lasso
News og Paqle, opdateret …"); `NewsVM.updatedAt` er den nyeste post på tværs af kilder.

**Verificér:** (1) om `time`/`promotedUntil` på tværs af de to endpoints altid er sammenlignelige
ISO-tidsstempler (fletningen sorterer efter `Date.parse`; `dateStr` bevarer kun dato, ikke
klokkeslæt, samme granularitet som før); (2) om Lasso News' `type`-liste i praksis indeholder
flere værdier end de 12 dokumenterede — `provider: "VIRK"` med `type: "Board"`/`"Account"` er nu
bekræftet, resten (Ritzau, Statstidende, øvrige typer) er stadig kun fra dokumentationen; ukendte
typer får blot ingen `typeLabel`, ikke en fejl; (3) om `provider` for Lasso News kan antage andre
værdier end VIRK/Ritzau/Statstidende i praksis (se ovenfor).
