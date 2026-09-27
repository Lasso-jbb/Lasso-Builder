import type { Json } from "../adapters.js";

/**
 * Eksempelsvar til risiko- og nyhedsadapterne, bekræftet mod api.lassox.com 27.09.2026 (Novo
 * Nordisk, CVR-1-24256790, se docs/endpoints-risiko-nyheder.md). Bruges af
 * apps/server/src/lasso/riskNewsAdapters.test.ts og apps/server/src/data/live-company.test.ts.
 */

/** POST /modules/observations/{lassoId}, body { observationTags: ["CompanyInsight"] }. */
export const OBSERVATIONS_FIXTURE: Json = {
  version: "1.0",
  relatedLassoId: "CVR-1-24256790",
  relatedCompanyName: "NOVO NORDISK A/S",
  relatedPersonName: null,
  score: 62,
  percentages: null,
  relatedName: null,
  observations: [
    {
      title: "Virksomhedsstatus",
      type: "CompanyStatus",
      tags: ["Company", "CompanyInsight", "Risk"],
      shortDescription: "Virksomhedens status er 'normal'.",
      description: "Virksomhedens status er 'normal'.",
      outcome: 0,
      notAvailable: false,
      errors: null,
      relatedLassoId: "CVR-1-24256790",
    },
    {
      title: "Konkursrelationer",
      type: "DirectBankruptcies",
      tags: ["Company", "CompanyInsight", "Risk"],
      shortDescription: "Firmadeltager har direkte konkursrelationer.",
      description: "En eller flere firmadeltagere har været involveret i direkte konkurser.",
      outcome: 100,
      notAvailable: false,
      errors: null,
      relatedLassoId: "CVR-1-24256790",
    },
    {
      title: "Svag betalingsevne",
      type: "WeakAbilityToPay",
      tags: ["Company", "CompanyInsight", "Risk"],
      shortDescription: "Virksomheden har svag betalingsevne.",
      description: "Nøgletallene indikerer en svag betalingsevne.",
      outcome: 50,
      notAvailable: false,
      errors: null,
      relatedLassoId: "CVR-1-24256790",
    },
    {
      title: "Revisorskift",
      type: "AccountingChanges",
      tags: ["Company", "CompanyInsight", "Risk"],
      shortDescription: "Nyligt revisorskifte.",
      description: "Virksomheden har skiftet revisor inden for det seneste år.",
      outcome: 25,
      notAvailable: false,
      errors: null,
      relatedLassoId: "CVR-1-24256790",
    },
    {
      title: "Udlæg til skat",
      type: "Distress",
      tags: ["Company", "CompanyInsight", "Risk"],
      shortDescription: "Reel ejer har udlæg til SKAT i sin bolig.",
      description: "",
      outcome: 0,
      notAvailable: true,
      errors: ["Ejendomsoplysninger ikke tilgængelige"],
      relatedLassoId: "CVR-1-24256790",
    },
  ],
  // Nøglerne er i SMÅ bogstaver i det rigtige svar, og dækker både personer (cvr-3-…) og
  // selskaber (cvr-1-…) — adapteren normaliserer dem til kanonisk form (canonicalLassoId).
  relatedObservations: {
    "cvr-3-4000002550": [
      {
        title: "Konkursrelationer",
        type: "DirectBankruptciesPerson",
        tags: ["Person", "CompanyInsight", "Risk"],
        shortDescription: "Personen har direkte konkursrelationer.",
        description: "Personen har været direktør i et selskab, der er gået konkurs.",
        outcome: 100,
        notAvailable: false,
        errors: null,
        relatedLassoId: "cvr-3-4000002550",
      },
    ],
    "cvr-1-24257630": [
      {
        title: "Virksomhedsstatus",
        type: "CompanyStatus",
        tags: ["Company", "CompanyInsight", "Risk"],
        shortDescription: "Virksomhedens status er 'under konkurs'.",
        description: "Virksomhedens status er 'under konkurs'.",
        outcome: 100,
        notAvailable: false,
        errors: null,
        relatedLassoId: "cvr-1-24257630",
      },
    ],
  },
};

/** POST /modules/news?limit=2&orderBy=publishtime, body ["CVR-1-24256790"]. */
export const LASSO_NEWS_FIXTURE: Json = [
  {
    headline: "Et medlem udtræder af bestyrelsen for {NOVO NORDISK A/S|CVR-1-24256790}",
    content:
      "{Tanja Villumsen|CVR-3-4007574142} har siddet i bestyrelsen siden 2021, men udtræder nu. I bestyrelsen sidder nu <ul><li>{Britt Meelby Jensen|CVR-3-4003830981}</li><li>{Henrik Poulsen|CVR-3-4001112223}</li></ul>",
    tagLine: "Bestyrelsesændring hos {NOVO NORDISK A/S|CVR-1-24256790}",
    time: "2026-09-20T07:15:00Z",
    promotedUntil: "2026-09-27T07:15:00Z",
    type: "Board",
    provider: "VIRK",
    providerData: null,
    url: "https://lasso.dk/nyheder/novo-nordisk-bestyrelse",
    storyId: "story-nn-1",
    imageId: null,
    uniqueId: "u-nn-1",
    lassoIds: [
      { relatedLassoIdName: "NOVO NORDISK A/S", lassoId: "CVR-1-24256790", isMainId: true, inQuery: true },
      { relatedLassoIdName: "Tanja Villumsen", lassoId: "CVR-3-4007574142", isMainId: false, inQuery: false },
      { relatedLassoIdName: "Britt Meelby Jensen", lassoId: "CVR-3-4003830981", isMainId: false, inQuery: false },
    ],
  },
  {
    headline: "{NOVO NORDISK A/S|CVR-1-24256790} har offentliggjort nyt regnskab",
    content: "<p>{NOVO NORDISK A/S|CVR-1-24256790} har indberettet årsrapport til Erhvervsstyrelsen.</p>",
    tagLine: "Nyt regnskab fra {NOVO NORDISK A/S|CVR-1-24256790}",
    time: "2026-08-01T06:00:00Z",
    promotedUntil: "2026-08-08T06:00:00Z",
    type: "Account",
    provider: "VIRK",
    providerData: null,
    url: "https://lasso.dk/nyheder/novo-nordisk-regnskab",
    storyId: "story-nn-2",
    imageId: null,
    uniqueId: "u-nn-2",
    lassoIds: [{ relatedLassoIdName: "NOVO NORDISK A/S", lassoId: "CVR-1-24256790", isMainId: true, inQuery: true }],
  },
];

/** GET /data/paqle/{lassoId}/news. */
export const PAQLE_NEWS_FIXTURE: Json = {
  news: [
    {
      headline: "NOVO NORDISK A/S udvider med ny fabrik",
      content: "NOVO NORDISK A/S har annonceret udvidelse af produktionskapaciteten.",
      url: "https://sundhedstinget.dk/artikel/novo-nordisk-fabrik",
      time: "2026-09-18T08:30:00Z",
      storyId: "story-9911",
      tagLine: null,
      imageId: null,
      type: "Paqle",
      provider: "Paqle",
      providerData: {
        published: "2026-09-18T08:30:00Z",
        sourceName: "sundhedstinget.dk",
        url: "https://sundhedstinget.dk/artikel/novo-nordisk-fabrik",
        headline: [
          { text: "NOVO NORDISK A/S", highlight: true },
          { text: " udvider med ny fabrik", highlight: false },
        ],
        extract: [
          { text: "NOVO NORDISK A/S", highlight: true },
          { text: " har annonceret udvidelse af produktionskapaciteten.", highlight: false },
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
