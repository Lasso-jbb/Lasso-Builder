# Risiko- og nyhedsendpoints

Denne fil dækker de to endpoints, `LassoRiskObservations` (katalog 17) og `LassoNews`
(katalog 12) bruger. Kilde: Lassos officielle API-dokumentation (docs.lassox.com),
indsamlet 27.09.2026 (se pakken i sessionens scratchpad, `lasso-api-reference.md`,
afsnittene "Risk › Observations" og "News"). `docs/lasso-endpoints.md` er IKKE ændret af
dette arbejde; den fil markerer stadig disse to endpoints som "ubekræftet" fra dengang
formerne var gættet. Denne fil erstatter den markering for observationer og nyheder.

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

**Dokumenteret svar:**

```json
{
  "relatedLassoId": "CVR-1-34580820",
  "relatedCompanyName": "LASSO X A/S",
  "observations": [
    {
      "title": "Konkursrelationer",
      "type": "DirectBankruptcies",
      "tags": ["CompanyInsight"],
      "shortDescription": "Firmadeltager har direkte konkursrelationer.",
      "description": "…",
      "outcome": 100,
      "notAvailable": false,
      "errors": [],
      "relatedLassoId": "CVR-1-34580820"
    }
  ],
  "relatedObservations": {
    "CVR-3-1122334455": [ /* … samme form, men om personen … */ ]
  }
}
```

`outcome` er 0/25/50/100 og 1:1 med vores `Severity`-skala (0 neutral/grøn, 25 informativ/gul,
50 muligvis vigtig/gul, 100 muligvis vigtig/rød — guide 23 regel 10). Den fulde liste af
observationstyper (title/type/entitet/beskrivelse) står i `lasso-api-reference.md` under
"Risk › Observations"; adapteren gemmer selve `type`-strengen (fx `"DirectBankruptcies"`) råt i
`ObservationRowVM.type`, uden at fortolke den yderligere.

**Hvad adapteren læser** (`adaptObservations` i `riskNewsAdapters.ts`):

- `title` → `ObservationRowVM.title`, `shortDescription` (fald tilbage til `description`) →
  `detail`, `outcome` → `severity`, `type` → `type`, `notAvailable` → `notAvailable`.
- `relatedObservations` (indirekte observationer, fx `DirectBankruptciesPerson`, der egentlig
  måler en tilknyttet person) grupperes pr. person-Lasso-ID i `ObservationsVM.related`. Adapteren
  kender ikke personens navn (det rå svar har det ikke); `LiveProvider.observations`
  (`apps/server/src/data/live.ts`) slår det op efterfølgende med et almindeligt `GET {lassoId}`
  på personens eget Lasso-ID (bedste forsøg, højst 12 personer, 4 ad gangen) og fylder `name` ind.
  Lykkes opslaget ikke, viser UI'en personens Lasso-ID i stedet (`RiskObservations.tsx`).
- Ældre, gættede feltnavne (`severity`/`score`/`riskScore`/…, `detail`/`explanation`/…) er
  bevaret som fallback EFTER de dokumenterede felter, så et svar i en anden form stadig giver
  noget frem for at kaste en fejl.
- Rate-grænsen (120/min) håndteres ikke med et retry-loop; klientens eksisterende cache
  (`LASSO_CACHE_TTL_SECONDS`) og negative cache (4xx undtagen 429) gælder som for alle andre kald.

**UI (`RiskObservations.tsx`):** en `notAvailable`-række vises som ren tekst "Ikke tilgængelig"
i muted, uden badge eller farvet ikon (guide 23 regel 1 og 7), og tælles ikke med i
sammenfatningen ("3 vigtige, 5 mulige, …"). `related` vises som en underliste "Vedrører
personer" under virksomhedens egne observationer, med personens navn (eller Lasso-ID) som
overskrift og samme rækkeform som resten af listen.

**Verificér:** ingen API-nøgle var tilgængelig under dette arbejde, så formen er ikke afprøvet
mod et rigtigt svar. Særligt: (1) om `outcome` altid er ét af de fire dokumenterede tal, eller
om andre tal forekommer i praksis; (2) om `notAvailable: true`-rækker reelt har `outcome: 0`,
eller om `outcome` kan være meningsløst i det tilfælde; (3) om der findes flere pakke-former af
`relatedObservations`-nøglen end et rent Lasso-ID (fx indpakket i et objekt); (4) hvor mange
personer der typisk optræder i `relatedObservations`, så loftet på 12 navneopslag i
`LiveProvider.withRelatedNames` er rigeligt.

## Nyheder

To adskilte kilder flettes til én liste af `LiveProvider.news` (regel 8: én kildelinje pr.
sektion, "Kilde: …, opdateret DD.MM.ÅÅÅÅ").

### Lasso News

`POST api.lassox.com/modules/news` — body er en liste af Lasso Id'er, fx `["CVR-1-34580820"]`.
Klientmetoden `lassoNews` sætter query-parametrene `limit` (default 30), `page` (default 1),
`orderBy=publishtime` (kronologisk, så den kan flettes med Paqle efter tid — dokumentationens
egen default er `promoteduntil`) og videresender `from`/`to`/`types`, når de angives.

**Dokumenteret svar** (array af nyhedsobjekter):

```json
[
  {
    "headline": "{LASSO X A/S|CVR-1-34580820} har flyttet adresse",
    "content": "<p>{LASSO X A/S|CVR-1-34580820} er flyttet …</p>",
    "tagLine": "{LASSO X A/S|CVR-1-34580820} skifter adresse",
    "time": "2026-04-15T10:00:00Z",
    "promotedUntil": "2026-04-22T10:00:00Z",
    "type": "Information",
    "provider": "VIRK",
    "url": "https://lasso.dk/nyheder/…",
    "lassoIds": [{ "relatedLassoIdName": "LASSO X A/S", "lassoId": "CVR-1-34580820", "isMainId": true, "inQuery": true }]
  }
]
```

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
Svaret er en pakket liste, `{ news: [...], continuationToken }` (uændret fra tidligere
bekræftelse, se `docs/lasso-endpoints.md`, afsnittet "Nyheder"). `providerData.headline` og
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
ISO-tidsstempler (fletningen sorterer efter `Date.parse`); (2) om Lasso News' `type`-liste i
praksis indeholder flere værdier end de 12 dokumenterede (ukendte typer får blot ingen
`typeLabel`, ikke en fejl); (3) om `provider` for Lasso News kan antage andre værdier end
VIRK/Ritzau/Statstidende i praksis (se ovenfor).
