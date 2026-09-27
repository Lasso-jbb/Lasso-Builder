import type { Json } from "../adapters.js";

/**
 * Eksempelsvar til risiko- og nyhedsadapterne, formet efter Lassos officielle dokumentation
 * (docs/endpoints-risiko-nyheder.md). Bruges af apps/server/src/lasso/riskNewsAdapters.test.ts.
 */

/** POST /modules/observations/{lassoId}, body { observationTags: ["CompanyInsight"] }. */
export const OBSERVATIONS_FIXTURE: Json = {
  relatedLassoId: "CVR-1-34580820",
  relatedCompanyName: "LASSO X A/S",
  observations: [
    {
      title: "Konkursrelationer",
      type: "DirectBankruptcies",
      tags: ["CompanyInsight"],
      shortDescription: "Firmadeltager har direkte konkursrelationer.",
      description: "En eller flere firmadeltagere har været involveret i direkte konkurser.",
      outcome: 100,
      notAvailable: false,
      errors: [],
      relatedLassoId: "CVR-1-34580820",
    },
    {
      title: "Svag betalingsevne",
      type: "WeakAbilityToPay",
      tags: ["CompanyInsight"],
      shortDescription: "Virksomheden har svag betalingsevne.",
      description: "Nøgletallene indikerer en svag betalingsevne.",
      outcome: 50,
      notAvailable: false,
      errors: [],
      relatedLassoId: "CVR-1-34580820",
    },
    {
      title: "Revisorskift",
      type: "AccountingChanges",
      tags: ["CompanyInsight"],
      shortDescription: "Nyligt revisorskifte.",
      description: "Virksomheden har skiftet revisor inden for det seneste år.",
      outcome: 25,
      notAvailable: false,
      errors: [],
      relatedLassoId: "CVR-1-34580820",
    },
    {
      title: "Bestyrelse",
      type: "CompanyBoard",
      tags: ["CompanyInsight"],
      shortDescription: "Virksomheden har en bestyrelse.",
      description: "Virksomheden har en registreret bestyrelse.",
      outcome: 0,
      notAvailable: false,
      errors: [],
      relatedLassoId: "CVR-1-34580820",
    },
    {
      title: "Udlæg til skat",
      type: "Distress",
      tags: ["CompanyInsight"],
      shortDescription: "Reel ejer har udlæg til SKAT i sin bolig.",
      description: "",
      outcome: 0,
      notAvailable: true,
      errors: ["Ejendomsoplysninger ikke tilgængelige"],
      relatedLassoId: "CVR-1-34580820",
    },
  ],
  relatedObservations: {
    "CVR-3-1122334455": [
      {
        title: "Konkursrelationer",
        type: "DirectBankruptciesPerson",
        tags: ["CompanyInsight"],
        shortDescription: "Personen har direkte konkursrelationer.",
        description: "Personen har været direktør i et selskab, der er gået konkurs.",
        outcome: 100,
        notAvailable: false,
        errors: [],
        relatedLassoId: "CVR-3-1122334455",
      },
    ],
  },
};

/** POST /modules/news, body ["CVR-1-34580820"]. */
export const LASSO_NEWS_FIXTURE: Json = [
  {
    headline: "{LASSO X A/S|CVR-1-34580820} har flyttet adresse",
    content:
      "<p>{LASSO X A/S|CVR-1-34580820} er flyttet til ny adresse. Bestyrelsesformand {Anne Eksempel|CVR-3-1122334455} og adm. direktør {Bo Eksempel|CVR-3-2233445566} fortsætter uændret.</p><ul><li>Ny adresse registreret i CVR</li><li>Ingen ændringer i ledelsen</li></ul>",
    tagLine: "{LASSO X A/S|CVR-1-34580820} skifter adresse",
    time: "2026-04-15T10:00:00Z",
    promotedUntil: "2026-04-22T10:00:00Z",
    type: "Information",
    provider: "VIRK",
    url: "https://lasso.dk/nyheder/lasso-x-adresse",
    lassoIds: [
      { relatedLassoIdName: "LASSO X A/S", lassoId: "CVR-1-34580820", isMainId: true, inQuery: true },
      { relatedLassoIdName: "Anne Eksempel", lassoId: "CVR-3-1122334455", isMainId: false, inQuery: false },
    ],
  },
  {
    headline: "{LASSO X A/S|CVR-1-34580820} har fået ny bestyrelse",
    content: "<p>Der er indtrådt nye medlemmer i bestyrelsen for {LASSO X A/S|CVR-1-34580820}.</p>",
    tagLine: "Bestyrelsesændring hos {LASSO X A/S|CVR-1-34580820}",
    time: "2026-03-01T09:00:00Z",
    promotedUntil: "2026-03-08T09:00:00Z",
    type: "Board",
    provider: "VIRK",
    url: "https://lasso.dk/nyheder/lasso-x-bestyrelse",
    lassoIds: [{ relatedLassoIdName: "LASSO X A/S", lassoId: "CVR-1-34580820", isMainId: true, inQuery: true }],
  },
];

/** GET /data/paqle/{lassoId}/news. */
export const PAQLE_NEWS_FIXTURE: Json = {
  news: [
    {
      promotedUntil: "2026-04-20T00:00:00Z",
      headline: "LASSO X A/S udvider med nyt lager",
      content: "LASSO X A/S har annonceret udvidelse af lagerkapaciteten.",
      url: "https://borsen.dk/artikel/lasso-x-lager",
      time: "2026-04-18T08:30:00Z",
      storyId: "story-9911",
      tagLine: "Udvidelse i Aarhus",
      imageId: "img-1",
      type: "Paqle",
      provider: "Paqle",
      providerData: {
        published: "2026-04-18T08:30:00Z",
        sourceName: "Børsen",
        url: "https://borsen.dk/artikel/lasso-x-lager",
        headline: [
          { text: "LASSO X A/S", highlight: true },
          { text: " udvider med nyt lager", highlight: false },
        ],
        extract: [
          { text: "LASSO X A/S", highlight: true },
          { text: " har annonceret udvidelse af lagerkapaciteten.", highlight: false },
        ],
        paqleUrl: "https://paqle.example/story-9911",
        clusterHash: "hash-abc123",
      },
      uniqueId: "u-1",
      lassoIds: [],
    },
  ],
  continuationToken: null,
};
