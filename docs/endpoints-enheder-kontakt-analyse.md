# Produktionsenheder, CHR, live number og regnskabsanalyse

Fire nye datakilder koblet på efter Lassos officielle dokumentation
(docs.lassox.com, indsamlet 27.09.2026). Klient: `apps/server/src/lasso/client.ts`.
Adaptere (nye, egne funktioner): `apps/server/src/lasso/unitAdapters.ts` og
`apps/server/src/lasso/htmlText.ts`. Sammensætning: `apps/server/src/data/live.ts`
(`LiveProvider.productionUnits`, `.livestock`, `.contact`, `.textSections`).
Denne fil rører ikke `docs/lasso-endpoints.md`, som andre agenter arbejder i.

## Produktionsenheder (katalog 20)

**Bekræftet** (Companies → "Company information (full)" og "Production units"):

- `GET /{lassoId}` (company-full) har feltet `productionUnits: [{ lassoId: "CVR-2-<pNummer>",
  pNumber }][]`. Dette er listen af enhedsreferencer — IKKE fulde detaljer.
- `GET /{lassoId}` med en `CVR-2-{pNumber}`-id (samme kombinerede endpoint som virksomheder/
  personer) giver enhedens fulde detaljer: `lassoId, pNumber, unitNumber, name, cvr, status,
  lifeTime{from,to}, phone/email/fax/website, commerciallyProtected, creationDate, address
  (samme Address-objekt som companies), industry/altIndustry1-3, employees{interval, type,
  month, year, quarter, count, fullTimeEquivalentCount}, lastUpdated`.
- `GET /{lassoId}/related/company` (på en produktionsenheds-id) giver moderselskabets
  fulde company-full-data — bruges ikke her, da vi allerede har virksomhedens data.
- `GET /data/cvr/place/delta?since=...` er en ændringsliste, ikke et opslag pr. virksomhed
  (se `docs/lasso-endpoints.md`), og bruges fortsat ikke her.

**Hvad `LiveProvider.productionUnits` gør** (`buildProductionUnits` i `unitAdapters.ts`):

1. `productionUnitRefs(companyRaw)` læser `productionUnits`-feltet fra company-full.
2. Findes feltet ikke (tom liste), falder metoden tilbage til de gamle feltnavne-gæt
   (`adaptProductionUnits` i `adapters.ts`, som stadig forsøger `produktionsenheder`/`units`/
   `secondaryUnits`/`establishments`/`mainUnit` — beholdt som reserve).
3. Ellers hentes højst `PRODUCTION_UNIT_DETAIL_LIMIT` (25) enheders detaljer parallelt
   (`mapLimit`, 5 ad gangen) via `GET /{CVR-2-…}`. Fejler ét enkelt opslag, vises enheden
   kun med sit P-nummer (resten "Ikke oplyst" i UI'en) — aldrig et kast.
4. Hovedenheden markeres: samme adresse (gade + postnummer) som virksomheden selv, ellers
   den ældste (laveste `created`).
5. De gamle gæt tilføjes bagefter for enheder, det bekræftede detaljekald ikke selv fandt.
6. Har virksomheden flere end 25 enheder, sættes `total` i `ProductionUnitsVM` til det
   fulde antal, så UI'en kan vise "Se N flere" (kun `units`, de første 25, hentes med
   detaljer). `ProductionUnitsVM.total` er nyt i `packages/spec/src/models.ts`.

**At verificere:** ingen rigtig virksomhed med flere P-numre er testet mod det faktiske
API i dette arbejde. Employees-feltets præcise struktur (`interval` vs. `count` vs.
`fullTimeEquivalentCount` ved kvartalstal) bør bekræftes mod et rigtigt svar — adapteren
prøver `count`, så `fullTimeEquivalentCount`, i den rækkefølge.

## CHR — Centrale Husdyrbrugsregister (katalog 20)

**Bekræftet mod API 27.09.2026** (Other → "CHR", verificeret mod staging):
`GET /data/CHR/livestock/{cvr}?onlyCurrent=true` — CVR-nummeret (IKKE Lasso-ID'et) sendes i
stien. Kræver **Ejendomme-modulet** i Lasso-abonnementet. `onlyCurrent=false` inkluderer
historiske besætningsdata (bruges ikke her).

**Svarformen, bekræftet mod API 27.09.2026:** et RENT ARRAY af ejendomme (`property`). Ét
CVR kan have flere ejendomme (flere array-elementer). Hvert element:

```
{ chrNumber, property: { address, city, postalCode, postalDistrict, municipalityNumber,
  municipality, startDate, lastUpdated }, veterinaryAndFoodAdministration: {…},
  stableCoordinates: { x, y },
  livestockList: { livestock: [ { chrNumber, livestockNumber, animalTypeCode, animalType,
    usageTypeCode, usageType, tradeType, tradabilityCode, tradability,
    livestockSize: [ { text, value } ], livestockSizeLastUpdated,
    owner: { cvrNumber, name, address, city, postalCode, postalDistrict, municipalityNumber,
      municipality, country, addressProtected, commerciallyProtected },
    user: { …samme form som owner… },
    startDate, endDate, lastUpdated, veterinarianInfo: { idSpecified, name, … } } ],
    livestockCount },
  veterinaryEventList: { events, problems } }
```

`livestockSize` er en liste af delantal (fx "Søer, gylte og orner", "Smågrise mellem 7 og 30
kg"), hvor ét element typisk har en tekst, der ender på "i alt" (fx "Svin i alt"), med
totalen. `veterinaryEventList.events` var `null` i det bekræftede eksempel; formen af et
ikke-tomt element er derfor stadig et gæt (`type | name`, `date | time`, `description`).
`owner`/`user` kan være en privatperson (`cvrNumber: null`) — deres navn og adresse må
ALDRIG læses ind i `LivestockVM` (se nedenfor).

**Hvad `LiveProvider.livestock` gør** (`adaptChrLivestock` i `unitAdapters.ts`):

1. Henter virksomhedens CVR-nummer (`company()`), springer over uden det (`herds: []`).
2. Kalder `client.chrLivestock(cvr)`. 401/403/404 giver en tom, forklaret tilstand:
   "Kræver Ejendomme-modulet i Lasso-abonnementet" (`unavailableReason`), ikke en fejl.
3. **Den bekræftede form forsøges FØRST** (`isConfirmedChrShape` + `adaptChrLivestockConfirmed`):
   genkendes ved at mindst ét array-element har `property` eller `livestockList.livestock`.
   Hvert element i `livestockList.livestock` bliver én besætningsrække:
   - dyreart = `animalType`, anvendelse = `usageType` (ellers `tradeType`).
   - antal = værdien af det `livestockSize`-element, hvis tekst ender på "i alt", ellers
     summen af alle elementernes værdier (`livestockCount`).
   - CHR-nummer og ejendommens adresse/kommune (`propertyAddressText`, fx "Orevej 5, 3660
     Stenløse (Egedal)") sættes pr. række (`LivestockHerdVM.chrNumber`/`.propertyAddress`,
     nye felter), så flere ejendomme kan skelnes. `LivestockVM.chrNumber` (top-level) er
     den første ejendoms CHR-nummer.
   - `LivestockVM.updated` er den seneste af alle `livestockSizeLastUpdated` og
     `property.lastUpdated`-datoer.
   - `LivestockVM.ownerName` er navnet på den FØRSTE ejer/bruger, der er en **virksomhed**
     (`owner.cvrNumber`/`user.cvrNumber` sat) — `owner` foretrækkes frem for `user`.
     Privatpersoners navn og adresse (intet `cvrNumber`) læses aldrig, uanset felt.
   - `veterinaryEventList.problems` (en tekst) bliver én hændelse ("Bemærkning");
     `veterinaryEventList.events` (defensivt, da et ikke-tomt eksempel ikke er set) læses
     som en liste med `type|name`, `date|time`, `description`.
4. Matcher svaret ikke den bekræftede form, forsøges de tidligere, uverificerede gæt som
   reserve: enten et rent array, eller et objekt med en liste under
   `herds | livestock | besaetninger | properties | results`, med dyreart
   (`species|animalType|dyreart|type`), antal (`count|number|antal|animals`), CHR-nummer
   (`chrNumber|chrId|chr`) og hændelser (`events|veterinaryEvents|haendelser`).
5. Genkendes intet af det, gives en tom `LivestockVM` med `unavailableReason: "CHR-svarets
   struktur er ikke verificeret endnu"` i stedet for et (muligvis forkert) gæt.
6. Svarets form logges én gang pr. kørende server på debug-niveau
   (`LOG_LEVEL=debug`, `console.debug("[lasso-chr] svarform …")` via `describeShape`),
   så næste session kan rette adapteren uden at logge værdier.

**At verificere:** formen af et ikke-tomt `veterinaryEventList.events`-element (kun `null`
er set); om flere ejendomme pr. CVR forekommer i praksis (kun ét element er set i
eksemplet); om `category`-underarten (fx "slagtesvin" vs. "søer", som `LivestockHerdVM`
har plads til) findes andre steder end `usageType`/`tradeType`.

## Live number (Contact information, katalog 08)

**Bekræftet:** `GET /data/livenumber/{lassoId}` → `{ lassoId, updated, isRobinson (bool),
isCommerciallyProtected (bool), numbers: [{ phoneNumber, sources: [{ type, timestamp, note }],
score (tal, højere = bedre), explanation (læsbar tekst), callable (bool), obfuscated (bool) }] }`.
Kræver **egen livenumber-tilføjelse** til abonnementet (kontakt Lasso for adgang).
(Ikke koblet på her: `GET /data/livenumber/lookup/{telefonnummer}` og
`POST /data/livenumber` (flere virksomheder) samt `GET /data/livenumber/delta?since=…`
— ingen af komponenterne i kataloget bruger dem endnu.)

**Hvad `LiveProvider.contact` gør** (`adaptLiveNumber` i `unitAdapters.ts`):

1. Kaldes parallelt med det eksisterende CVR-/hjemmeside-opslag (`client.liveNumber`),
   pakket i `safe()` — 401/403/404 og enhver anden fejl udelades derfor stille, ingen
   fejlvisning.
2. Numre med `obfuscated: true` udelades altid.
3. De resterende sorteres efter `score` (højest først) og beskæres til højst 3.
4. Resultatet lægges oven i den almindelige `ContactVM` som `verifiedNumbers`,
   `isRobinson` og `verifiedAt` (nye, valgfrie felter i `ContactVM`,
   `packages/spec/src/models.ts`).

**UI** (`packages/ui/src/components/LassoContact.tsx`): hvert verificeret nummer vises
som en almindelig kontaktrække ("86 12 34 56 — Telefon (verificeret DD.MM.ÅÅÅÅ)", ren
tekst, klikbar `tel:`-link når `callable`). Er virksomheden tilmeldt Robinsonlisten,
vises linjen "Tilmeldt Robinsonlisten, må ikke kontaktes med markedsføring" i muted.
Findes verificerede numre, får sektionen sin egen kildelinje "Kilde: Lasso live number,
opdateret DD.MM.ÅÅÅÅ" (ud over den almindelige CVR/hjemmeside-kildelinje).

**At verificere:** ingenting er antaget ud over det, docs.lassox.com selv angiver —
formen er fuldt dokumenteret. Bør stadig afprøves mod en rigtig virksomhed med
livenumber-tilføjelsen slået til.

## Regnskabsanalyse (Financials, katalog 12/19)

**Bekræftet:** `POST /modules/reportanalysis/{lassoid}` (tom body `{}`) — en tekstlig
AI/redaktionel analyse baseret på op til 5 års regnskabsdata og de seneste to regnskaber.
Kan tage længere end almindelige kald; klienten bruger derfor en egen, længere timeout
(`REPORT_ANALYSIS_TIMEOUT_MS = 30_000` i `client.ts`, `post()` tager nu valgfrie
`RequestOptions`).

**Svarformen, bekræftet mod API 27.09.2026:**

```
{ "lassoId": "CVR-1-…",
  "sections": { "konklusion", "resultat", "likviditet", "balanceogkapitalforhold",
    "branchestatistik", "revisoroplysninger", "sprgsml" },   // hvert felt: HTML-streng
  "text": "…hele analysen som én HTML-streng…",
  "latestReport": { …nøgletal som {unit,value,sources,possibleError,error}… },
  "previousReport": { … } }
```

Teksten i hvert `sections`-felt og i `text` indeholder simple HTML-tags (`<b>`, `<br>` set i
det bekræftede svar), som skal renderes/konverteres. Dette er kilden til
"Erhvervsresumé"/"Se regnskabsanalyse" i portalens UI. `latestReport`/`previousReport`
indeholder standardnøgletal i samme form som `GET /{lassoId}/reports` (`{unit, value,
sources, possibleError, error}`, se `docs/lasso-endpoints.md`) — **bruges IKKE endnu**;
en senere mulighed er en visning, der viser `possibleError`-flaget (designkatalogets regel 8:
ved `possibleError`/`error` bør den linkede rapport tjekkes).

**Hvad `LiveProvider.textSections` gør** (`adaptReportAnalysisSections` i `unitAdapters.ts`):

1. Kalder `client.reportAnalysis(lassoId)` parallelt med det almindelige CVR-opslag,
   pakket i `safe()` og `withinBudget(…, TEXT_SECTIONS_BUDGET_MS = 8_000)` — samme
   mønster som kontaktblokkens `CONTACT_BUDGET_MS`. Svarer analysen ikke inden for
   budgettet, fejler den, eller er den tom/401/403/404, udelades sektionerne helt
   (ingen fejlvisning, ingen tom sektion).
2. Findes `sections`, bygges én `TextSectionItem` pr. felt, i denne bekræftede rækkefølge
   og med disse danske overskrifter (tomme felter, som `revisoroplysninger` ofte er,
   udelades): `konklusion` → "Regnskabsanalyse: konklusion", `resultat` → "Resultat",
   `likviditet` → "Likviditet", `balanceogkapitalforhold` → "Balance og kapitalforhold",
   `branchestatistik` → "Branchestatistik", `revisoroplysninger` → "Revisoroplysninger",
   `sprgsml` → "Spørgsmål til overvejelse" (sidst).
3. Er `sections` slet ikke til stede (eller giver ingen brugbare sektioner), falder den
   tilbage til `text` som ÉN sektion med overskriften "Regnskabsanalyse".
4. Hver sektions HTML konverteres til ren tekst med `htmlToText` (ny fil,
   `apps/server/src/lasso/htmlText.ts`): `<br>`, `</p>` og `</li>` bliver til
   linjeskift (en linje der starter med "- " i kildeteksten, fx "<br>- spørgsmål",
   bevares som sin egen linje med "- "), `<li>` får desuden et foranstillet "• ", alle
   andre tags fjernes, `<script>`/`<style>`-indhold fjernes helt, og standardentiteterne
   (`&amp; &lt; &gt; &quot; &#39; &nbsp;`) afkodes.
5. Hver sektion får `note: "Kilde: Lasso regnskabsanalyse"` — ingen bannerboks, intet
   "Skrevet af AI"-mærke (designkatalogets regel 4: AI-analyser er almindelige sektioner
   med kildelinje).

**At verificere:** om der findes flere HTML-tags i de rigtige sektioner end `<b>`/`<br>`
(fx `<p>`, `<ul>`/`<li>`, overskrifter, tabeller) — `htmlToText` fjerner ukendte tags uden
linjeskift, hvilket kan slå tekst sammen, den ikke bør. Om `sections` altid er til stede
(fallback til `text` er derfor stadig ikke afprøvet mod et rigtigt svar uden `sections`).

## Klientmetoder (nye)

| Metode | Endpoint | Placering i `client.ts` |
|---|---|---|
| `productionUnit(lassoId)` | `GET /{lassoId}` (med et `CVR-2-…`-id) | lige efter `company` |
| `reportAnalysis(lassoId)` | `POST /modules/reportanalysis/{lassoId}` | lige efter `reports` |
| `liveNumber(lassoId)` | `GET /data/livenumber/{lassoId}` | lige efter `contacts` |
| `chrLivestock(cvr)` | `GET /data/CHR/livestock/{cvr}?onlyCurrent=true` | lige efter `chr` |
