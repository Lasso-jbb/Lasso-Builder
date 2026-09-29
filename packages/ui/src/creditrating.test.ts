import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDataset, parseViewSpec, type CreditRatingVM } from "@lasso/spec";
import { CreditRating, type CreditRatingProps } from "./components/CreditRating.js";
import { ReportA4 } from "./components/ReportA4.js";
import { LassoView } from "./LassoView.js";
import type { ViewAction } from "./types.js";

const ID = "CVR-1-99000001";
const base = { lassoId: ID, cvr: "99000001", source: "Creditsafe via Lasso" };
const OK: CreditRatingVM = {
  ...base,
  state: "ok",
  current: { creditMax: 250_000, creditCurrency: "DKK", internationalScore: "B", internationalDescription: "Low", localScore: 62, localDescription: "Low Risk" },
  previous: { creditMax: 180_000, creditCurrency: "DKK", internationalScore: "C", internationalDescription: "Moderate", localScore: 45 },
  latestChange: "2026-04-15",
  pdfUrl: "https://example.com/eksempel-kreditrapport.pdf",
  updated: "2026-09-25",
};

const render = (props: CreditRatingProps) => renderToStaticMarkup(createElement(CreditRating, props));
/** Synlig tekst uden tags og skjult skærmlæsertekst. */
const text = (html: string) => html.replace(/<span class="lasso-credit__sr">[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");

test("fyldt: bogstav + ord, kreditmaksimum, lokal score, seneste ændring (ingen forrige), PDF, forbehold og kildelinje", () => {
  const html = render({ rating: OK, onAction: () => {} });
  const t = text(html);
  assert.match(html, /<h3 class="lasso-section__title">Kreditvurdering<\/h3>/);
  assert.match(html, /class="lasso-section lasso-span-half lasso-credit"/);
  assert.match(html, /class="lasso-credit__letter" aria-hidden="true">B</);
  assert.match(t, /BLav risiko/, "bogstavet efterfulgt af ordet");
  assert.match(html, /<span class="lasso-credit__sr">B, <\/span>Lav risiko/, "skærmlæser: 'B, Lav risiko'");
  assert.match(t, /Kreditmaksimum250 t\. kr\./);
  assert.match(t, /Lokal score62, Lav risiko/);
  // 18.1 (Jakob 29.09): kun den aktuelle vurdering; ingen forrige, ingen pil/ændring.
  assert.doesNotMatch(html, /lasso-scorecmp|Forrige|mindre risiko/);
  assert.match(t, /Seneste ændring15\.04\.2026/);
  assert.match(html, /<button type="button" class="lasso-link lasso-credit__action">Hent kreditrapport \(PDF\)<\/button>/);
  assert.match(t, /Ny beregning hos Creditsafe koster en kredit og tager 5–45 sekunder; vurderingen gemmes 24 timer\./);
  assert.doesNotMatch(t, /Kilde:/, "G3: ingen kildelinje");
  // Egen skala: ingen 0–100-måler eller observationernes alvorsord.
  assert.doesNotMatch(html, /lasso-gauge|af 100|lasso-sev-/);
  assert.doesNotMatch(t, /·/, "regel 6: ingen midterprik");
});

test("A–E-skalaen markerer det aktuelle bogstav med kant alene (ingen fyld) og kun ét", () => {
  for (const letter of ["A", "C", "E"] as const) {
    const html = render({ rating: { ...OK, current: { ...OK.current, internationalScore: letter, internationalDescription: undefined } } });
    const steps = [...html.matchAll(/<li class="lasso-credit__step( is-current)?"( aria-current="true")?[^>]*>([A-E])<\/li>/g)];
    assert.deepEqual(steps.map((m) => m[3]), ["A", "B", "C", "D", "E"], "fem positioner, lav risiko til venstre");
    assert.deepEqual(steps.filter((m) => m[1]).map((m) => m[3]), [letter]);
    assert.deepEqual(steps.filter((m) => m[2]).map((m) => m[3]), [letter], "aria-current på samme bogstav");
  }
});

test("tonen står aldrig som farve alene: hver toneklasse bærer ikon og ord", () => {
  const cases = [
    ["A", "ok", "Meget lav risiko"],
    ["C", "warning", "Moderat risiko"],
    ["D", "danger", "Høj risiko"],
  ] as const;
  for (const [letter, tone, word] of cases) {
    const html = render({ rating: { ...OK, current: { internationalScore: letter } } });
    const m = new RegExp(`<span class="lasso-credit__word lasso-credit__tone--${tone}"><svg[^]*?</svg><span class="lasso-credit__sr">${letter}, </span>${word}</span>`).exec(html);
    assert.ok(m, `${letter}: ikon + ord i tone ${tone}`);
  }
  // 18.1: ingen forrige vurdering vises, heller ikke når data har en.
  const worse = render({ rating: { ...OK, current: { internationalScore: "D" }, previous: { internationalScore: "B" } } });
  assert.doesNotMatch(worse, /lasso-scorecmp|mere risiko/);
  // Ingen farvet flade, pille eller banner i komponenten.
  assert.doesNotMatch(worse, /style="[^"]*background|lasso-badge|lasso-notice/);
});

test("låst, ikke beregnet, fejl, ingen vurdering og henter", () => {
  const locked = text(render({ rating: { ...base, state: "locked", reason: "Kræver Creditsafe-tilføjelse til Lasso-abonnementet" } }));
  assert.match(locked, /Låst\. Kræver Creditsafe-tilføjelse til Lasso-abonnementet\./);

  const actions: ViewAction[] = [];
  const pendingHtml = render({ rating: { ...base, state: "unavailable", reason: "Creditsafe beregner stadig, prøv igen om lidt" }, onAction: (a) => actions.push(a) });
  assert.match(text(pendingHtml), /Ikke beregnet endnu\. Creditsafe beregner stadig, prøv igen om lidt\./);
  assert.match(pendingHtml, />Hent igen<\/button>/, "ventetilstand: kan hentes igen");
  const none = render({ rating: { ...base, state: "unavailable", reason: "Creditsafe har ingen vurdering af virksomheden endnu." }, onAction: () => {} });
  assert.match(text(none), /Ikke beregnet endnu\. Creditsafe har ingen vurdering af virksomheden endnu\./);
  assert.doesNotMatch(none, /Hent igen/);

  const error = render({ rating: { ...base, state: "error", reason: "Lasso API-fejl (500)" }, onAction: () => {} });
  assert.match(error, /role="alert"/);
  assert.match(error, /Lasso API-fejl \(500\)[^]*Prøv igen/);
  assert.doesNotMatch(render({ rating: { ...base, state: "error", reason: "x" } }), /Prøv igen/, "uden onAction ingen knap");

  assert.match(render({ rating: { ...base, state: "ok" } }), /class="lasso-notreported">Ikke oplyst</);

  const loading = render({});
  assert.match(loading, /aria-busy="true"[^>]*style="min-height:240px"/, "skelet i samme højde");
  assert.match(text(loading), /op til 45 sekunder/);
  assert.match(render({ error: "Lasso API svarede ikke i tide", onAction: () => {} }), /Data kunne ikke hentes[^]*Prøv igen/);
});

test("PDF-linket går gennem værten (open-link), og uden vært er det et almindeligt link", () => {
  assert.match(render({ rating: OK }), /<a class="lasso-link lasso-credit__action" href="https:\/\/example\.com\/eksempel-kreditrapport\.pdf" target="_blank" rel="noopener noreferrer">/);
  assert.doesNotMatch(render({ rating: { ...OK, pdfUrl: undefined } }), /Hent kreditrapport/);
});

test("LassoView tegner LassoCreditRating fra datasættet og slår fejlnøglen creditRating:<id> op", () => {
  const spec = parseViewSpec({ kind: "company", title: "Eksempel Byg A/S", components: [{ type: "LassoCreditRating", company: ID }] });
  const ds = emptyDataset("demo");
  ds.creditRatings[ID] = OK;
  const html = renderToStaticMarkup(createElement(LassoView, { spec, dataset: ds, host: {}, onAction: () => {} }));
  assert.match(html, /lasso-credit__letter[^>]*>B</);
  const failed = emptyDataset("demo");
  failed.errors[`creditRating:${ID}`] = "Virksomheden blev ikke fundet";
  assert.match(renderToStaticMarkup(createElement(LassoView, { spec, dataset: failed, host: {}, onAction: () => {} })), /Virksomheden blev ikke fundet/);
});

test("A4-rapporten (27.1-27.2): Creditsafe indgår ikke; Lassos risikoscore står alene", () => {
  const ds = emptyDataset("demo");
  ds.companies[ID] = { lassoId: ID, cvr: "99000001", name: "Eksempel Byg A/S" };
  ds.scores[ID] = { lassoId: ID, score: 42, source: "Eksempeldata" };
  ds.creditRatings[ID] = OK;
  const t = text(renderToStaticMarkup(createElement(ReportA4, { company: ID, dataset: ds })));
  assert.match(t, /42 af 100, lav/, "Lassos score på forsiden");
  assert.doesNotMatch(t, /Creditsafe/);
  assert.doesNotMatch(t, /Kreditmaks/);
});
