# Creditsafe via Lasso: kreditvurdering (katalog 17)

Kilde: docs.lassox.com, afsnittet "Risk › Creditsafe" (indsamlet 27.09.2026). Endpointet er **ikke kaldt mod
et rigtigt svar endnu**; adapteren er bygget defensivt efter dokumentationens form. Se "Skal verificeres" nederst.

Bruges af spec-komponenten `LassoCreditRating` (UI `CreditRating`, datamodel `CreditRatingVM`).

| Del | Fil |
|---|---|
| Klient | `apps/server/src/lasso/client.ts`, `creditsafeRating(cvr, skipCache = false)` |
| Adapter og fejl → tilstand | `apps/server/src/lasso/creditAdapters.ts` (`adaptCreditRating`, `creditRatingFromError`, `loadCreditRating`) |
| Datalag | `DataProvider.creditRating` (`provider.ts`), `LiveProvider` (`live.ts`), `DemoProvider` (`demo.ts`) |
| Hentning | `resolve.ts`: `FETCHERS.creditRating`, fejlnøgle `creditRating:<lassoId>` |
| Model og hjælpere | `packages/spec/src/models.ts` (`CreditRatingVM`, `CreditAssessment`), `packages/spec/src/credit.ts` |
| Komposition | `packages/spec/src/compose.ts`: kun `focus: "risiko"` henter og viser den |
| UI | `packages/ui/src/components/CreditRating.tsx`, A4-rapportens side 4 (`ReportA4.tsx`) |

## Endpoint

```
GET https://api.lassox.com/data/creditsafe/rating/{cvr}?skipCache=false
Header: lasso-api-key: <nøgle>
```

- `{cvr}` er det 8-cifrede **CVR-nummer**, ikke Lasso-ID'et. `LiveProvider` udleder det med `cvrFromLassoId`
  (`CVR-1-34580820` → `34580820`). Et ID uden CVR-nummer giver tilstanden "ikke beregnet" uden kald.
- **Kræver Creditsafe-tilføjelsen** til Lasso-abonnementet.
- Klienten bruger sin egen timeout på **50 sekunder** (`timeoutMs: 50_000`), fordi Creditsafe svarer på 5–45 s,
  når vurderingen skal beregnes live. Den globale `LASSO_API_TIMEOUT_MS` (standard 15 s) gælder ikke her.

### Parameter `skipCache`

| Værdi | Betydning |
|---|---|
| `false` (standard, altid brugt) | Lassos cache bruges: svaret gemmes **24 timer pr. organisation**, så en virksomhed koster højst **én kredit pr. døgn**. |
| `true` | Omgår Lassos cache, beregner igen hos Creditsafe og **koster en ny kredit**. |

`skipCache=true` sendes **aldrig** fra modellen eller fra nogen visning. Metoden har parameteren, så en senere,
bevidst brugerhandling ("Beregn igen" i portalen, med bekræftelse af kreditforbruget) kan bruge den; der er ingen
sådan handling i dag. Ud over Lassos 24-timers cache husker vores egen klient svaret i `LASSO_CACHE_TTL_SECONDS`
(standard 300 s), så samme visning hentet to gange kun giver ét kald.

## Svarform (dokumentationen)

```json
{
  "current": {
    "creditMax": 250000,
    "creditCurrency": "DKK",
    "internationalScore": "B",
    "internationalDescription": "Low",
    "localScore": 62,
    "localDescription": "Low Risk"
  },
  "previous": { "…": "samme felter, forrige vurdering" },
  "latestChange": "2026-04-15",
  "pdfUrl": "https://…/kreditrapport.pdf"
}
```

Adapteren (`adaptCreditRating`):

- slår felter op uden hensyn til store/små bogstaver (`at()`), læser tal givet som tekst, og normaliserer
  `internationalScore` til `A`–`E` (andre værdier droppes);
- `creditMax: null` bevares som `null` ("Creditsafe anbefaler ingen kredit"), et manglende felt som `undefined`;
- accepterer kun `http(s)`-links som `pdfUrl`;
- sætter `updated` til et tidsstempel fra svaret, hvis Lasso sender et (`updated`, `lastUpdated`, `createdAt`,
  `cachedAt`, `timestamp`), ellers til opslagets dato; `cachedUntil` kun hvis svaret har det (`cachedUntil`,
  `cacheExpires`, `expires`). Vi gætter ikke på, hvornår Lassos 24-timers cache udløber;
- en vurdering uden bogstav, lokal score og kreditmaksimum tæller som tom.

## Tilstande (`CreditRatingVM.state`)

`LiveProvider.creditRating` kaster aldrig; fejl bliver tilstande, så en konto uden tilkøb ikke ser en "fejl".

| Svar | `state` | `reason` | UI |
|---|---|---|---|
| 200 med `current` | `ok` | – | Bogstav + ord med ikon, A–E-række, kreditmaksimum, lokal score, forrige vurdering (▲ dårligere / ▼ bedre), "Hent kreditrapport (PDF)", forbehold og kildelinje |
| 200 uden `current`, men med `previous` | `ok` | – | "Ikke oplyst" |
| 200 tomt / uden vurderinger, eller 404 | `unavailable` | "Creditsafe har ingen vurdering af virksomheden endnu." | "Ikke beregnet endnu. …" |
| Timeout (50 s) | `unavailable` | "Creditsafe beregner stadig, prøv igen om lidt" | Som ovenfor + "Hent igen" (refresh) |
| 401 / 403 | `locked` | "Kræver Creditsafe-tilføjelse til Lasso-abonnementet" | "Låst. Kræver …" (tom-tilstand, ingen fejl) |
| 429 | `error` | "Lasso API: for mange kald, prøv igen om lidt" | Fejltilstand med "Prøv igen" |
| Andre fejl (5xx, 400, 402 …) | `error` | "Lasso API-fejl (status): Lassos errorMessage" | Fejltilstand med "Prøv igen" |

Fejl, der huskes i klientens negative cache (4xx undtagen 408/429 og timeout), gentages i højst 90 sekunder
(`NEGATIVE_TTL_MS`). "Hent igen" kort efter en timeout giver derfor samme tilstand, indtil de 90 s er gået.

## Kredit, ventetid og komposition

- **Kun `show_company focus risiko`** henter Creditsafe (`composeProbe`). Overblik og de andre fokus kalder aldrig
  endpointet, så et almindeligt opslag hverken koster en kredit eller venter 5–45 s. Overblikket viser kun
  kreditvurderingen, hvis datasættet allerede har den og der er et alvorligt risikosignal (i praksis aldrig i dag).
- På risiko-siden står `LassoCreditRating` (½) øverst i kolonne 2 ved siden af virksomhedsoplysningerne, under
  risikoboksen. Den står der også, når tilstanden er låst eller hentningen fejlede.
- Et risiko-opslag, hvor Creditsafe skal beregne, gør hele `show_company`-kaldet op til ~45 s langsomt (dataene
  hentes parallelt, men værktøjssvaret venter på det langsomste kald).
- Tre risikoskalaer blandes aldrig: Lassos score 0–100 (`LassoScoreGauge`), observationer 0/25/50/100
  (`LassoRiskObservations`) og Creditsafe A–E + lokal score (`LassoCreditRating`). Tonen for Creditsafe er A–B ok,
  C advarsel, D–E fare, altid som ikon + ord.
- Tekstkortet og resuméet har én linje: `Kreditvurdering (Creditsafe): B, lav risiko, kreditmaksimum 250 t. kr.,
  lokal score 62, forrige C, ændret 15.04.2026` eller `låst: kræver Creditsafe-tilføjelse`.

## Skal verificeres mod api.lassox.com

1. **Svarformen**: feltnavne og typer i `current`/`previous` (er `creditMax` et tal eller en tekst; er
   `internationalScore` et bogstav eller et objekt; findes `previous` altid).
2. **Manglende tilkøb**: giver det 401, 403, 402 eller noget andet? Kun 401/403 vises som låst i dag.
3. **Ingen vurdering**: giver en virksomhed uden Creditsafe-vurdering 404, 200 med tomme felter eller andet?
4. **E-bogstavet**: Creditsafe bruger ofte E for "Not Rated" (fx ophørte selskaber) snarere end "meget høj risiko".
   Creditsafes egen beskrivelse vises, når den findes (oversat, når den er kendt: "Not Rated" → "Ikke vurderet");
   vores ord "Meget høj risiko" er kun reserve. Tonen for E er fare.
5. **`pdfUrl`**: kan brugeren åbne linket direkte i browseren, eller kræver det `lasso-api-key`-headeren? I så fald
   skal PDF'en hentes gennem serveren (en proxy-rute), ikke åbnes som link.
6. **Tidsstempler**: sender Lasso et felt for, hvornår vurderingen blev beregnet eller gemt? Så kan kildelinjen vise
   Creditsafes dato i stedet for opslagets, og `cachedUntil` sættes korrekt.
7. **Timeout**: fortsætter Lasso beregningen, når vi afbryder efter 50 s, så næste kald rammer Lassos cache?
8. **Valuta**: `creditCurrency` som ISO-kode ("DKK") eller tekst ("kr.")? Begge vises korrekt via `currencyUnit`.
9. **Rate limit**: endpointet er under den generelle grænse (500/min); ingen særlig begrænsning er dokumenteret.
