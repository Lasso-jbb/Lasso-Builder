import assert from "node:assert/strict";
import { test } from "node:test";
import { adaptNews, adaptObservations } from "./adapters.js";
import { LASSO_NEWS_FIXTURE, OBSERVATIONS_FIXTURE, PAQLE_NEWS_FIXTURE } from "./fixtures/riskNews.js";
import { parseEntityMarkup, plainTextFromMarkup, segmentsFromMarkup, stripHtml, textWithEntities } from "./newsMarkup.js";
import { adaptLassoNews, canonicalLassoId, mergeNews, newsTypeLabel } from "./riskNewsAdapters.js";

/* ---------------------------------------------------------------------------------------
 * Observationer (docs/endpoints-risiko-nyheder.md: POST /modules/observations/{lassoId}).
 * Fixturen er bekræftet mod api.lassox.com 27.09.2026 (Novo Nordisk, CVR-1-24256790).
 * ------------------------------------------------------------------------------------- */

test("adaptObservations læser outcome 1:1 som severity, og gemmer type/titel/beskrivelse", () => {
  const vm = adaptObservations("CVR-1-24256790", OBSERVATIONS_FIXTURE);
  assert.equal(vm.observations.length, 5);
  const byType = new Map(vm.observations.map((o) => [o.type, o]));
  assert.equal(byType.get("CompanyStatus")?.severity, 0);
  assert.equal(byType.get("DirectBankruptcies")?.severity, 100);
  assert.equal(byType.get("WeakAbilityToPay")?.severity, 50);
  assert.equal(byType.get("AccountingChanges")?.severity, 25);
  assert.equal(byType.get("CompanyStatus")?.title, "Virksomhedsstatus");
  assert.equal(byType.get("CompanyStatus")?.detail, "Virksomhedens status er 'normal'.");
});

test("adaptObservations læser version og score fra svarets top-niveau (skalaen er ikke dokumenteret, vises ikke i UI'en endnu)", () => {
  const vm = adaptObservations("CVR-1-24256790", OBSERVATIONS_FIXTURE);
  assert.equal(vm.version, "1.0");
  assert.equal(vm.score, 62);
});

test("adaptObservations' sammenfatning tæller korrekt efter outcome, uden notAvailable-rækker", () => {
  const vm = adaptObservations("CVR-1-24256790", OBSERVATIONS_FIXTURE);
  const counted = vm.observations.filter((o) => !o.notAvailable);
  assert.equal(counted.filter((o) => o.severity === 100).length, 1);
  assert.equal(counted.filter((o) => o.severity === 50).length, 1);
  assert.equal(counted.filter((o) => o.severity === 25).length, 1);
  assert.equal(counted.filter((o) => o.severity === 0).length, 1, "Virksomhedsstatus (outcome 0) tæller med");
});

test("adaptObservations markerer notAvailable-rækker uden at kaste dem væk", () => {
  const vm = adaptObservations("CVR-1-24256790", OBSERVATIONS_FIXTURE);
  const distress = vm.observations.find((o) => o.type === "Distress");
  assert.equal(distress?.notAvailable, true);
  assert.equal(distress?.severity, 0);
  assert.equal(vm.observations.filter((o) => o.notAvailable).length, 1);
});

test("adaptObservations grupperer relatedObservations pr. entitet (person OG selskab), og normaliserer ID'et til kanonisk form", () => {
  const vm = adaptObservations("CVR-1-24256790", OBSERVATIONS_FIXTURE);
  assert.equal(vm.related?.length, 2);
  const byId = new Map(vm.related!.map((r) => [r.lassoId, r]));

  // relatedObservations-nøglerne er i det rigtige svar i små bogstaver ("cvr-3-…"/"cvr-1-…").
  const person = byId.get("CVR-3-4000002550");
  assert.ok(person, "personens ID skal stå i kanonisk (store bogstaver) form i VM'en");
  assert.equal(person!.name, undefined, "adapteren kender ikke navnet; det slås op af LiveProvider");
  assert.equal(person!.rows[0]!.type, "DirectBankruptciesPerson");
  assert.equal(person!.rows[0]!.severity, 100);

  const company = byId.get("CVR-1-24257630");
  assert.ok(company, "relatedObservations dækker også selskaber, ikke kun personer");
  assert.equal(company!.rows[0]!.type, "CompanyStatus");
  assert.equal(company!.rows[0]!.severity, 100);
});

test("canonicalLassoId normaliserer kildedelen til store bogstaver, uden at røre selve ID'et", () => {
  assert.equal(canonicalLassoId("cvr-3-4000002550"), "CVR-3-4000002550");
  assert.equal(canonicalLassoId("cvr-1-24257630"), "CVR-1-24257630");
  assert.equal(canonicalLassoId("CVR-1-24257630"), "CVR-1-24257630", "allerede kanonisk form ændres ikke");
  assert.equal(canonicalLassoId("CvR-3-123"), "CVR-3-123", "case-insensitiv");
  assert.equal(canonicalLassoId("ukendtformuidenbindestreg"), "ukendtformuidenbindestreg", "ingen bindestreg -> uændret");
});

test("adaptObservations: ældre, gættede feltnavne virker stadig som fallback", () => {
  const vm = adaptObservations("CVR-1-1", [{ headline: "Adresse ændret", score: "medium" }]);
  assert.equal(vm.observations.length, 1);
  assert.equal(vm.observations[0]!.severity, 50);
  assert.equal(vm.observations[0]!.type, undefined);
});

/* ---------------------------------------------------------------------------------------
 * Entitets-markup og HTML-oprydning (newsMarkup.ts).
 * ------------------------------------------------------------------------------------- */

test("parseEntityMarkup splitter tekst og indlejrede {Navn|LassoId}", () => {
  const segments = parseEntityMarkup("Et medlem udtræder af bestyrelsen for {NOVO NORDISK A/S|CVR-1-24256790}");
  assert.deepEqual(segments, [
    { text: "Et medlem udtræder af bestyrelsen for " },
    { text: "NOVO NORDISK A/S", lassoId: "CVR-1-24256790" },
  ]);
});

test("parseEntityMarkup håndterer flere navne og ingen markup", () => {
  assert.deepEqual(parseEntityMarkup("Ingen markup her"), [{ text: "Ingen markup her" }]);
  const segments = parseEntityMarkup("{A|CVR-1-1} og {B|CVR-3-2}");
  assert.deepEqual(segments, [
    { text: "A", lassoId: "CVR-1-1" },
    { text: " og " },
    { text: "B", lassoId: "CVR-3-2" },
  ]);
});

test("plainTextFromMarkup fjerner klammer og Lasso Id, beholder navnet", () => {
  assert.equal(plainTextFromMarkup("Et medlem udtræder af bestyrelsen for {NOVO NORDISK A/S|CVR-1-24256790}"), "Et medlem udtræder af bestyrelsen for NOVO NORDISK A/S");
  assert.equal(plainTextFromMarkup(undefined), undefined);
});

test("plainTextFromMarkup bevarer linjeskift (fx fra stripHtml), men collapser mellemrum inden for hver linje", () => {
  assert.equal(plainTextFromMarkup("Første  linje.\n{Navn|CVR-3-1}\nTredje linje."), "Første linje.\nNavn\nTredje linje.");
});

test("stripHtml laver linjeskift for <br>/<li> og fjerner resten af tags", () => {
  const html = "<p>Første linje.<br/>Anden linje.</p><ul><li>Punkt et</li><li>Punkt to</li></ul>";
  assert.equal(stripHtml(html), "Første linje.\nAnden linje.\nPunkt et\nPunkt to");
  assert.equal(stripHtml(undefined), undefined);
});

test("stripHtml + plainTextFromMarkup håndterer det bekræftede content-eksempel (markup inde i en <ul><li>-liste)", () => {
  const content =
    "{Tanja Villumsen|CVR-3-4007574142} har siddet i bestyrelsen siden 2021, men udtræder nu. I bestyrelsen sidder nu <ul><li>{Britt Meelby Jensen|CVR-3-4003830981}</li><li>{Henrik Poulsen|CVR-3-4001112223}</li></ul>";
  const plain = plainTextFromMarkup(stripHtml(content));
  assert.equal(plain, "Tanja Villumsen har siddet i bestyrelsen siden 2021, men udtræder nu. I bestyrelsen sidder nu\nBritt Meelby Jensen\nHenrik Poulsen");
});

/* ---------------------------------------------------------------------------------------
 * Lasso News (POST /modules/news). Fixturen er bekræftet mod api.lassox.com 27.09.2026.
 * ------------------------------------------------------------------------------------- */

test("adaptLassoNews parser entitets-markup i headline/tagLine, også når entiteten står til sidst i teksten", () => {
  const items = adaptLassoNews(LASSO_NEWS_FIXTURE);
  assert.equal(items.length, 2);
  const [first, second] = items;
  assert.equal(first!.headline, "Et medlem udtræder af bestyrelsen for NOVO NORDISK A/S");
  assert.equal(first!.excerpt, "Bestyrelsesændring hos NOVO NORDISK A/S", "tagLine (kort resumé) foretrækkes frem for det fulde content");
  assert.equal(first!.typeLabel, "Bestyrelsesændring");
  assert.equal(first!.source, "Lasso", "VIRK er den bagvedliggende kilde, ikke en læservendt kilde");
  assert.equal(first!.time, "2026-09-20");
  assert.equal(second!.typeLabel, "Nyt regnskab");
});

test("adaptLassoNews tåler providerData: null (bekræftet i det rigtige svar)", () => {
  const items = adaptLassoNews(LASSO_NEWS_FIXTURE);
  assert.ok(items.every((i) => i.headline.length > 0), "et null providerData må ikke få adapteren til at springe posten over");
});

test("adaptLassoNews falder tilbage til content (linjeskift bevaret), når tagLine mangler", () => {
  const items = adaptLassoNews([
    {
      headline: "{NOVO NORDISK A/S|CVR-1-24256790} har fået ny bestyrelse",
      content: "Nye medlemmer: <ul><li>{Britt Meelby Jensen|CVR-3-4003830981}</li><li>{Henrik Poulsen|CVR-3-4001112223}</li></ul>",
      tagLine: null,
      time: "2026-09-21T09:00:00Z",
      type: "Board",
      provider: "VIRK",
      providerData: null,
      url: "https://lasso.dk/x",
    },
  ]);
  assert.equal(items[0]!.excerpt, "Nye medlemmer:\nBritt Meelby Jensen\nHenrik Poulsen");
});

test("adaptLassoNews giver overskrift og uddrag som segmenter, hvor navnene beholder deres Lasso-ID", () => {
  const [first] = adaptLassoNews(LASSO_NEWS_FIXTURE);
  assert.deepEqual(first!.headlineSegments, [
    { text: "Et medlem udtræder af bestyrelsen for " },
    { text: "NOVO NORDISK A/S", lassoId: "CVR-1-24256790" },
  ]);
  assert.deepEqual(first!.extractSegments, [{ text: "Bestyrelsesændring hos " }, { text: "NOVO NORDISK A/S", lassoId: "CVR-1-24256790" }]);
  // Den rene tekst er uændret, og segmenterne er præcis samme tekst.
  assert.equal(first!.headlineSegments!.map((s) => s.text).join(""), first!.headline);
  assert.equal(first!.extractSegments!.map((s) => s.text).join(""), first!.excerpt);
});

test("adaptLassoNews: uddragets segmenter følger content (personer, linjeskift fra <li>), når tagLine mangler", () => {
  const [item] = adaptLassoNews([{ ...(LASSO_NEWS_FIXTURE as object[])[0], tagLine: null }]);
  assert.equal(item!.excerpt, "Tanja Villumsen har siddet i bestyrelsen siden 2021, men udtræder nu. I bestyrelsen sidder nu\nBritt Meelby Jensen\nHenrik Poulsen");
  assert.deepEqual(item!.extractSegments, [
    { text: "Tanja Villumsen", lassoId: "CVR-3-4007574142" },
    { text: " har siddet i bestyrelsen siden 2021, men udtræder nu. I bestyrelsen sidder nu\n" },
    { text: "Britt Meelby Jensen", lassoId: "CVR-3-4003830981" },
    { text: "\n" },
    { text: "Henrik Poulsen", lassoId: "CVR-3-4001112223" },
  ]);
  assert.equal(item!.extractSegments!.map((s) => s.text).join(""), item!.excerpt);
});

test("adaptLassoNews: tekst uden navne med Lasso-ID giver ingen segmenter (den rene tekst er nok)", () => {
  const [item] = adaptLassoNews([{ headline: "Markedet i dag", tagLine: "Kort nyt {uden id}", url: "https://lasso.dk/y" }]);
  assert.equal(item!.headlineSegments, undefined);
  assert.equal(item!.extractSegments, undefined);
  assert.equal(item!.excerpt, "Kort nyt uden id");
});

test("segmentsFromMarkup normaliserer mellemrum og linjeskift som plainTextFromMarkup", () => {
  const text = "  Ny  direktør:\n\n {Anne  Test|CVR-3-1}  \n   og {Holding ApS|CVR-1-22222222} ";
  const segments = segmentsFromMarkup(text)!;
  assert.equal(segments.map((s) => s.text).join(""), plainTextFromMarkup(text));
  assert.deepEqual(segments, [
    { text: "Ny direktør:\n" },
    { text: "Anne Test", lassoId: "CVR-3-1" },
    { text: "\nog " },
    { text: "Holding ApS", lassoId: "CVR-1-22222222" },
  ]);
  assert.equal(segmentsFromMarkup("Ingen navne"), undefined);
  assert.equal(segmentsFromMarkup(undefined), undefined);
});

test("textWithEntities bevarer afsnit og giver segmenter, der sat sammen er teksten", () => {
  const { text, segments } = textWithEntities("Revideret af {Crowe|CVR-1-33256876}.\n\nAndet  afsnit.");
  assert.equal(text, "Revideret af Crowe.\n\nAndet afsnit.");
  assert.deepEqual(segments, [{ text: "Revideret af " }, { text: "Crowe", lassoId: "CVR-1-33256876" }, { text: ".\n\nAndet afsnit." }]);
  assert.deepEqual(textWithEntities("Ingen markup.\n\nTo afsnit."), { text: "Ingen markup.\n\nTo afsnit." });
});

test("newsTypeLabel oversætter Lassos nyhedstyper til dansk, ukendte typer giver undefined", () => {
  assert.equal(newsTypeLabel("Account"), "Nyt regnskab");
  assert.equal(newsTypeLabel("Ritzau"), "Pressemeddelelse");
  assert.equal(newsTypeLabel("Statstidende"), "Statstidende");
  assert.equal(newsTypeLabel("UkendtType"), undefined);
  assert.equal(newsTypeLabel(undefined), undefined);
});

/* ---------------------------------------------------------------------------------------
 * Paqle (GET /data/paqle/{lassoId}/news). Fixturen er bekræftet mod api.lassox.com 27.09.2026.
 * ------------------------------------------------------------------------------------- */

test("adaptNews (Paqle) bevarer highlight-segmenterne til at fremhæve firmanavnet", () => {
  const vm = adaptNews("CVR-1-24256790", PAQLE_NEWS_FIXTURE, 10);
  assert.equal(vm.items.length, 1);
  const item = vm.items[0]!;
  assert.equal(item.source, "sundhedstinget.dk");
  assert.equal(item.headline, "NOVO NORDISK A/S udvider med ny fabrik");
  assert.deepEqual(item.headlineSegments, [
    { text: "NOVO NORDISK A/S", highlight: true },
    { text: " udvider med ny fabrik", highlight: undefined },
  ]);
  assert.deepEqual(item.extractSegments, [
    { text: "NOVO NORDISK A/S", highlight: true },
    { text: " har annonceret udvidelse af produktionskapaciteten.", highlight: undefined },
  ]);
});

test("adaptNews tåler tagLine: null og imageId: null (bekræftet i det rigtige svar)", () => {
  const vm = adaptNews("CVR-1-24256790", PAQLE_NEWS_FIXTURE, 10);
  assert.equal(vm.items.length, 1);
});

test("adaptNews: ét storyId bliver til netop én nyhed, aldrig samlet til '+N kilder'", () => {
  const vm = adaptNews("CVR-1-24256790", PAQLE_NEWS_FIXTURE, 10);
  assert.equal(vm.items.length, 1, "fixturen har ét storyId og skal give ét NewsItemVM, ikke et samlet 'kilder'-tal");
});

/* ---------------------------------------------------------------------------------------
 * Fletning af Lasso News og Paqle (LiveProvider.news, apps/server/src/data/live.ts).
 * ------------------------------------------------------------------------------------- */

test("mergeNews fletter efter tid (nyeste først), skærer til limit og lister bidragende kilder", () => {
  const lasso = adaptLassoNews(LASSO_NEWS_FIXTURE); // 2026-09-20 og 2026-08-01
  const paqle = adaptNews("CVR-1-24256790", PAQLE_NEWS_FIXTURE, 10).items; // 2026-09-18

  const merged = mergeNews(
    "CVR-1-24256790",
    [
      { items: lasso, label: "Lasso News" },
      { items: paqle, label: "Paqle" },
    ],
    10,
  );

  assert.deepEqual(
    merged.items.map((i) => i.time),
    ["2026-09-20", "2026-09-18", "2026-08-01"],
  );
  assert.deepEqual(merged.sources, ["Lasso News", "Paqle"]);
  assert.equal(merged.updatedAt, "2026-09-20");
});

test("mergeNews skærer til limit og udelader en kilde uden poster fra kildevisningn", () => {
  const lasso = adaptLassoNews(LASSO_NEWS_FIXTURE);
  const merged = mergeNews(
    "CVR-1-24256790",
    [
      { items: lasso, label: "Lasso News" },
      { items: [], label: "Paqle" },
    ],
    1,
  );
  assert.equal(merged.items.length, 1);
  assert.equal(merged.items[0]!.time, "2026-09-20");
  assert.deepEqual(merged.sources, ["Lasso News"]);
});

test("mergeNews: poster uden tidsstempel havner sidst", () => {
  const withTime = { source: "Lasso", headline: "Med tid", time: "2026-01-01" };
  const withoutTime = { source: "Lasso", headline: "Uden tid" };
  const merged = mergeNews("CVR-1-1", [{ items: [withoutTime, withTime], label: "Lasso News" }], 10);
  assert.deepEqual(
    merged.items.map((i) => i.headline),
    ["Med tid", "Uden tid"],
  );
});
