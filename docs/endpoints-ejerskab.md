# Ejerskabs-endpoints (reelle ejere, legale ejere, ejergraf)

Denne fil dækker de tre ejerskabs-endpoints, Lassos officielle dokumentation
(docs.lassox.com, afsnittet "## Ownership") beskriver, samt personendpointets
ejerfelter ("## People › Information and relations"). Kilden er
`/tmp/claude-0/-home-user-Lasso-Builder/553e393c-3619-5067-957e-dbf68c1ecb41/scratchpad/pakke/lasso-api-reference.md`,
indsamlet 27.09.2026 fra Lassos egen dokumentation. Adapterne, der læser disse
former, ligger i `apps/server/src/lasso/ownershipAdapters.ts`
(`adaptBeneficialOwnershipDocumented`, `adaptOwnershipLegal`,
`markUnknownOwnershipNodes`) og kaldes fra `apps/server/src/lasso/adapters.ts`
(`adaptBeneficialOwnership`, `adaptOwnershipGraph`) og
`apps/server/src/data/live.ts` (`LiveProvider.ownership`,
`.beneficialOwnership`, `.ownershipGraph`). Se også `docs/lasso-endpoints.md`,
som dækker resten af Lasso-integrationen (den fil samles af en anden opgave og
er ikke rørt her).

Denne fil er skrevet UDEN en rigtig API-nøgle, ud fra dokumentationsteksten
alene. Adapterne er derfor defensive (`at()`/`str()`/`num()`; en anden form
giver tom tilstand, aldrig et kast), og punkterne markeret "**Verificér**"
nedenfor bør tjekkes mod et rigtigt svar, når en nøgle er tilgængelig.

## Reelle ejere: `GET /{lassoId}/owners/beneficial`

Ingen parametre ud over `{lassoId}`. Historik er ikke dokumenteret for dette
endpoint (i modsætning til legale ejere).

**Dokumenteret svarform:**

```
{
  couldNotIdentify: boolean,
  exempt: boolean,              // UDGÅET — brug exemptionStatus
  exemptionStatus: "EXEMPT" | "NOT EXEMPT" | "UNKNOWN",
  fallbackDescription: string,  // forklaringstekst når owners er tom
  fallbackType: "MANAGEMENT" | "DAILY MANAGEMENT" | "BOARD" | "UNKNOWN" | null,
  owners: [
    {
      ownership: number,       // 0–1, PRÆCIS (ikke interval)
      voteRights: number,      // 0–1, PRÆCIS
      throughRole: boolean,    // true: ejerskab via en rolle, ikke direkte kapitalejerskab
      address: {...},
      name: string,
      type: "PERSON" | "VIRKSOMHED",
      lassoId: string,
      unitNumber: number,
      role: { mainType: "REGISTER", type: "REEL EJER", attributes: [...] },
      from: string,             // dato
    },
  ],
}
```

**Hvad adapteren læser:** `adaptBeneficialOwnershipDocumented` genkender
formen på, at `raw` er et objekt med et `owners`-array (ellers returneres
`undefined`, og `adaptBeneficialOwnership` i `adapters.ts` falder tilbage til
den ældre, ubekræftede "ultimate owners"-gætteform, som stadig ligger
uændret bagest i samme funktion). Hver ejer får en PRÆCIS procenttekst
(`preciseShareText`, fx "44 %", aldrig et interval — kataloget tillader det
for reelle ejere). `throughRole=true` giver ejeren teksten "Via en rolle (fx
ledelse), ikke et direkte kapitalejerskab" i `BeneficialOwnerVM.chain` i
stedet for en egentlig ejerkæde, fordi den dokumenterede form (i modsætning
til den gamle gætteform) ikke har nogen `paths`/mellemliggende selskaber at
bygge en kæde-tekst ud fra.

En tom `owners`-liste udleder en forklaring (lagt i `gaps[0].reason`, som
`LassoBeneficialOwners` allerede viser) af de fire dokumenterede årsager, i
denne rækkefølge:

1. `fallbackDescription`, når Lasso selv har leveret en færdig tekst.
2. `couldNotIdentify === true` → "har selv oplyst, at den ikke kan
   identificere sine reelle ejere".
3. `exemptionStatus === "EXEMPT"` → "er undtaget lovkravet".
4. `fallbackType` sat (og ≠ "UNKNOWN") → "ingen enkeltperson har over 25 %";
   den øverste ledelse/bestyrelse er registreret i stedet, uden at blive
   navngivet her.
5. Ellers: standardteksten "har endnu ikke registreret reelle ejere".

**Verificér:** den præcise rækkefølge/prioritet mellem disse fire årsager er
ikke selv dokumenteret et sted i kilden — kun at der ER fire årsager. Når en
rigtig nøgle er tilgængelig, bør et svar med `owners: []` tjekkes for hvilke
af felterne der faktisk er sat samtidig, og rækkefølgen justeres, hvis
`fallbackDescription` viser sig altid at være sat (så den reelt er den eneste,
der bruges i praksis).

## Legale ejere: `GET /{lassoId}/owners/legal` (historik: `/{lassoId}/history/owners/legal`)

**Dokumenteret svarform:**

```
{
  hasOwnersUnderFivePercent: boolean,
  owners: [
    {
      ownership: { from: number, to: number },   // brøk-INTERVAL, 0–1
      voteRights: { from: number, to: number },
      name: string,
      type: "PERSON" | "VIRKSOMHED",
      lassoId: string,
      cvr: number,         // eller unitNumber for personer
      address: {...},
      role: {
        mainType: "REGISTER",
        type: "EJER",
        attributes: [{ type: "EJERANDEL_MEDDELELSE_DATO", value: string }],
      },
      from: string,
    },
  ],
}
```

Andelen er ALTID et interval (aldrig ét tal) — CVR-registeret kræver kun
andels-*intervaller* ved indberetning, hvilket er baggrunden for portalens
gennemgående brug af intervaller som "5–9,99 %".

**Hvad adapteren læser:** `adaptOwnershipLegal` genkender formen på samme
måde som de reelle ejere (et objekt med et `owners`-array). Den genbruger
`shareText` uændret (samme brøk-interval-form som `ownership.owners` i
company-full), så konvertering til procent er identisk med den, der allerede
var bekræftet. `hasOwnersUnderFivePercent` lægges direkte i `OwnershipVM`.

`LiveProvider.ownership` (`apps/server/src/data/live.ts`) foretrækker dette
endpoint: den kalder `client.ownersLegal(lassoId)` og `client.company(lassoId)`
parallelt, bruger `adaptOwnershipLegal`-resultatet, når det lykkes og kan
læses, og henter revisoren (som IKKE er en del af dette endpoint) fra det
samtidigt hentede company-svar. Svarer `/owners/legal` med en 4xx-fejl (eller
en form, adapteren ikke kan læse), falder den helt tilbage til
`ownership.owners` fra company-full, præcis som før denne opgave. Ved en
5xx-fejl (eller enhver anden fejltype) kastes fejlen videre uændret — der
falder kun tilbage på 4xx, som opgaven beder om.

`OwnerList` (`packages/ui/src/components/OwnerList.tsx`) viser
`hasOwnersUnderFivePercent` som en ren, dæmpet tekstlinje ("Der er ejere
under 5 %, som ikke er registreret enkeltvis."), uden badge, når feltet er
sat.

**Verificér:** om `cvr`/`unitNumber` altid er sat sammen med eller i stedet
for `lassoId`, og om `type`-værdierne er præcis "PERSON"/"VIRKSOMHED" (store
bogstaver) som i beneficial-formen — dokumentationsteksten skriver kun
`type` uden at gentage værdisættet for dette endpoint specifikt.

## Ejerstruktur/graf: `POST /modules/relations/graph`

**Body:**

```
{
  ids: string[],                          // Lasso Ids at bygge grafen ud fra
  relationTypes: string[],                // "ownership" | "votingrights" | "unknownOwnership"
  enrichments: string[],                  // "companyinfo" | "personinfo" | "reports" | "ultimateowner"
  ingoingDepth: number,
  outgoingDepth: number,
  onDate?: string,                        // ÅÅÅÅ-MM-DD, udelades for i dag
}
```

**Dokumenteret svarform:**

```
{
  relations: [
    {
      id: string,
      type: string,                       // fx "ownership", "unknownOwnership"
      from: string,                       // Lasso Id (ejer)
      to: string,                         // Lasso Id (ejet)
      data: {
        ownershipPercentage?: { label: string, from: number, to: number },   // fx label "5-9,99%"
        votingrightsPercentage?: { label: string, from: number, to: number },
      },
      metadata: {...},
    },
  ],
  entities: [
    {
      id: string, type: "company",
      data: {
        lassoId: string, name: string, cvr: string, companyType: string, status: string,
        employees: number, fte: number, industryCode: string,
        trueOwners: { [ejerLassoId: string]: { ownershipLabel, voteRightsLabel, ownershipPercentage, voteRightsPercentage } },
        report?: {...},                   // kun med enrichment "reports"
        ultimateOwners?: { [lassoId: string]: { label, from, to } },  // kun med enrichment "ultimateowner"
      },
    } | {
      id: string, type: "person",
      data: { name: string, trueOwnerships: { [ejetLassoId: string]: {...samme struktur som trueOwners...} } },
    },
  ],
}
```

`unknownOwnership`: en syntetisk kant fra en knude med id
`"{lassoId}_UNKNOWN"` — dækker den lovligt uregistrerede andel under 5 %
(portalens "ukendt ejerskab"). Der er intet tegn på, at denne syntetiske
knude selv optræder i `entities`; den findes kun som endepunkt på en kant.

**Hvad adapteren læser:** `adaptOwnershipGraph` (i `adapters.ts`) var i
forvejen bygget som en generisk, kandidat-baseret parser, der prøver mange
mulige feltnavne. Den er justeret, så de dokumenterede navne prøves FØRST i
hver kandidatliste, og de gamle, ubekræftede gæt bevares som reserve
derefter:

- Node-kilde: `entities` (dokumenteret) før `nodes`/`vertices`/... Kanterne:
  `relations` (dokumenteret) før `edges`/`links`/....
- Andel på en kant: `data.ownershipPercentage`/`data.votingrightsPercentage`
  (dokumenteret) før `ownership`/`share`/`voteRights`/... `shareRange`
  håndterer, at `from`/`to` kan være en brøk (≤ 1, ganges med 100) eller
  allerede et procenttal (> 1, bruges direkte) — se "Verificér" nedenfor.
  Mangler `from`/`to` på et andels-objekt, læses `label`-teksten i stedet
  (fx "5-9,99%" parses som tekst).
- Virksomhedsform på en node: `companyType` (dokumenteret) før
  `form.shortDescription`/....
- `"{lassoId}_UNKNOWN"`-knuder får efterfølgende (`markUnknownOwnershipNodes`
  i `ownershipAdapters.ts`) navnet "Ukendt ejerskab (< 5 %)", `kind:
  "company"` og et nyt, valgfrit flag `unknown: true` på
  `OwnershipNodeVM` (tilføjet i `packages/spec/src/models.ts`, da feltet
  ikke fandtes i forvejen). Roden markeres uændret som i dag
  (`OwnershipNodeVM.root`).

Kroppen, klienten sender (`LassoClient.relationsGraph`), matcher allerede
den dokumenterede form (`ids`, `relationTypes`, `enrichments`, `ingoingDepth`,
`outgoingDepth`, `onDate?`) og er ikke ændret i denne opgave.

**Verificér:**

- Om `data.ownershipPercentage.from`/`to` reelt er en brøk (0–1) eller
  allerede et procenttal (0–100). Dokumentationsteksten selv er usikker på
  dette ("from, to" uden eksplicit enhed, kun `label`-teksten "5-9,99%" er
  utvetydig). Adapteren håndterer BEGGE tolkninger defensivt (`shareRange`:
  værdi ≤ 1 regnes som brøk og ganges med 100; > 1 bruges direkte som
  procent), så et forkert gæt i den ene retning ikke kan give et tal over
  100 % eller under 1 % ved en fejl — men den nøjagtige skalering bør
  bekræftes mod et rigtigt svar.
- Om `"{lassoId}_UNKNOWN"`-knuden nogensinde selv optræder i `entities`
  (med sit eget `data`-objekt), eller om den, som teksten antyder, kun findes
  implicit som endepunkt på en `unknownOwnership`-kant. Adapteren håndterer
  begge tilfælde (findes en entity med det id, bruges dens felter som
  udgangspunkt, men navn og `unknown`-flag sættes altid af
  `markUnknownOwnershipNodes` bagefter).
- Om `relations[].type` for en almindelig ejerskabsrelation altid er
  strengen `"ownership"` (som i `relationTypes`-parameteren), eller om Lasso
  bruger andre værdier (fx "Ownership", "LEGAL_OWNERSHIP"). Nuværende filter
  (`/owner|ejer|share|legal/i`) er bredt nok til at ramme både "ownership" og
  "unknownOwnership", men er ikke testet mod en rigtig værdi.
- `trueOwners`/`trueOwnerships`/`ultimateOwners`/`report`
  (enrichments `companyinfo`ets/`ultimateowner`ets øvrige felter) læses
  IKKE af adapteren i denne omgang — kun de felter, der er nødvendige for at
  bygge noder og kanter (`lassoId`, `name`, `cvr`, `companyType`, `status`,
  `type`). Bruges disse felter senere (fx til et "reelle ejere fra grafen"-
  visning), skal de tilføjes.

## Personendpointets ejerfelter: `GET /{lassoId}` (person, `CVR-3-…`)

Dokumentationens "## People › Information and relations" bekræfter, at
personendpointets `owner`/`trueOwner`-lister følger SAMME form som de to
ejer-endpoints ovenfor:

```
owner: [{ ownership: {from,to}, voterights: {from,to}, lassoId, cvr, name, status, form, lifeTime, type,
          role: { mainType: "REGISTER", type: "EJER", attributes: [...] } }]
trueOwner: [{ ownership: number, voteRights: number, throughRole: boolean, lassoId, cvr, name, status, form,
              lifeTime, type, role: { mainType: "REGISTER", type: "REEL EJER" } }]
```

Dvs. `owner` (legale ejerskaber, personen ejer selv) er et brøk-INTERVAL
(samme som `/owners/legal`), mens `trueOwner` (reelle ejerskaber) er et
PRÆCIST tal (samme som `/owners/beneficial`). Dette bekræfter allerede den
antagelse, `apps/server/src/lasso/personAdapters.ts` gjorde uden
dokumentation (se `docs/lasso-endpoints.md`, afsnittet om personer); ingen
kode er ændret her, da personadapteren ikke var en del af denne opgave, men
bekræftelsen er noteret, så en fremtidig opgave ikke behøver gætte igen.

## Fixtures og tests

`apps/server/src/lasso/fixtures/ownership.ts` indeholder LASSO X A/S
(CVR-1-34580820)-eksemplet fra dokumentationen (EGGERT HOLDING ApS 5–9,99 %,
BENEDIKTSON HOLDING ApS 15–19,99 %, JP/POLITIKENS HUS A/S 25–33,32 %) i alle
tre former (beneficial, legal, graf), samt de fire tomme-tilstands-varianter
for reelle ejere. De bagvedliggende personers PRÆCISE reelle andele og
CVR-/Lasso-ID'erne for de nævnte selskaber er IKKE opgivet i dokumentationen
(kun grafens virksomhedsniveau er beskrevet med konkrete tal) og er derfor
illustrative eksempeltal, ikke de rigtige numre.

Tests: `apps/server/src/lasso/ownershipAdapters.test.ts`.
