import assert from "node:assert/strict";
import { test } from "node:test";
import { adaptNews, adaptObservations } from "./adapters.js";
import { LASSO_NEWS_FIXTURE, OBSERVATIONS_FIXTURE, PAQLE_NEWS_FIXTURE } from "./fixtures/riskNews.js";
import { parseEntityMarkup, plainTextFromMarkup, stripHtml } from "./newsMarkup.js";
import { adaptLassoNews, mergeNews, newsTypeLabel } from "./riskNewsAdapters.js";

/* ---------------------------------------------------------------------------------------
 * Observationer (docs/endpoints-risiko-nyheder.md: POST /modules/observations/{lassoId}).
 * ------------------------------------------------------------------------------------- */

test("adaptObservations læser outcome 1:1 som severity, og gemmer type/titel/beskrivelse", () => {
  const vm = adaptObservations("CVR-1-34580820", OBSERVATIONS_FIXTURE);
  assert.equal(vm.observations.length, 5);
  const byType = new Map(vm.observations.map((o) => [o.type, o]));
  assert.equal(byType.get("DirectBankruptcies")?.severity, 100);
  assert.equal(byType.get("WeakAbilityToPay")?.severity, 50);
  assert.equal(byType.get("AccountingChanges")?.severity, 25);
  assert.equal(byType.get("CompanyBoard")?.severity, 0);
  assert.equal(byType.get("DirectBankruptcies")?.title, "Konkursrelationer");
  assert.equal(byType.get("DirectBankruptcies")?.detail, "Firmadeltager har direkte konkursrelationer.");
});

test("adaptObservations' sammenfatning tæller korrekt efter outcome, uden notAvailable-rækker", () => {
  const vm = adaptObservations("CVR-1-34580820", OBSERVATIONS_FIXTURE);
  const counted = vm.observations.filter((o) => !o.notAvailable);
  assert.equal(counted.filter((o) => o.severity === 100).length, 1);
  assert.equal(counted.filter((o) => o.severity === 50).length, 1);
  assert.equal(counted.filter((o) => o.severity === 25).length, 1);
  assert.equal(counted.filter((o) => o.severity === 0).length, 1, "Bestyrelse (outcome 0) tæller med");
});

test("adaptObservations markerer notAvailable-rækker uden at kaste dem væk", () => {
  const vm = adaptObservations("CVR-1-34580820", OBSERVATIONS_FIXTURE);
  const distress = vm.observations.find((o) => o.type === "Distress");
  assert.equal(distress?.notAvailable, true);
  assert.equal(distress?.severity, 0);
  assert.equal(vm.observations.filter((o) => o.notAvailable).length, 1);
});

test("adaptObservations grupperer relatedObservations pr. person", () => {
  const vm = adaptObservations("CVR-1-34580820", OBSERVATIONS_FIXTURE);
  assert.equal(vm.related?.length, 1);
  const person = vm.related![0]!;
  assert.equal(person.lassoId, "CVR-3-1122334455");
  assert.equal(person.name, undefined, "adapteren kender ikke navnet; det slås op af LiveProvider");
  assert.equal(person.rows.length, 1);
  assert.equal(person.rows[0]!.type, "DirectBankruptciesPerson");
  assert.equal(person.rows[0]!.severity, 100);
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
  const segments = parseEntityMarkup("{LASSO X A/S|CVR-1-34580820} har flyttet adresse");
  assert.deepEqual(segments, [
    { text: "LASSO X A/S", lassoId: "CVR-1-34580820" },
    { text: " har flyttet adresse" },
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
  assert.equal(plainTextFromMarkup("{LASSO X A/S|CVR-1-34580820} har flyttet adresse"), "LASSO X A/S har flyttet adresse");
  assert.equal(plainTextFromMarkup(undefined), undefined);
});

test("stripHtml laver linjeskift for <br>/<li> og fjerner resten af tags", () => {
  const html = "<p>Første linje.<br/>Anden linje.</p><ul><li>Punkt et</li><li>Punkt to</li></ul>";
  assert.equal(stripHtml(html), "Første linje.\nAnden linje.\nPunkt et\nPunkt to");
  assert.equal(stripHtml(undefined), undefined);
});

/* ---------------------------------------------------------------------------------------
 * Lasso News (POST /modules/news).
 * ------------------------------------------------------------------------------------- */

test("adaptLassoNews parser entitets-markup i headline/tagLine og HTML i content", () => {
  const items = adaptLassoNews(LASSO_NEWS_FIXTURE);
  assert.equal(items.length, 2);
  const [first, second] = items;
  assert.equal(first!.headline, "LASSO X A/S har flyttet adresse");
  assert.equal(first!.excerpt, "LASSO X A/S skifter adresse", "tagLine (kort resumé) foretrækkes frem for det fulde content");
  assert.equal(first!.typeLabel, "Stamdataændring");
  assert.equal(first!.source, "Lasso", "VIRK er den bagvedliggende kilde, ikke en læservendt kilde");
  assert.equal(first!.time, "2026-04-15");
  assert.equal(second!.typeLabel, "Bestyrelsesændring");
});

test("newsTypeLabel oversætter Lassos nyhedstyper til dansk, ukendte typer giver undefined", () => {
  assert.equal(newsTypeLabel("Account"), "Nyt regnskab");
  assert.equal(newsTypeLabel("Ritzau"), "Pressemeddelelse");
  assert.equal(newsTypeLabel("Statstidende"), "Statstidende");
  assert.equal(newsTypeLabel("UkendtType"), undefined);
  assert.equal(newsTypeLabel(undefined), undefined);
});

/* ---------------------------------------------------------------------------------------
 * Paqle (GET /data/paqle/{lassoId}/news).
 * ------------------------------------------------------------------------------------- */

test("adaptNews (Paqle) bevarer highlight-segmenterne til at fremhæve firmanavnet", () => {
  const vm = adaptNews("CVR-1-34580820", PAQLE_NEWS_FIXTURE, 10);
  assert.equal(vm.items.length, 1);
  const item = vm.items[0]!;
  assert.equal(item.source, "Børsen");
  assert.equal(item.headline, "LASSO X A/S udvider med nyt lager");
  assert.deepEqual(item.headlineSegments, [
    { text: "LASSO X A/S", highlight: true },
    { text: " udvider med nyt lager", highlight: undefined },
  ]);
  assert.deepEqual(item.extractSegments, [
    { text: "LASSO X A/S", highlight: true },
    { text: " har annonceret udvidelse af lagerkapaciteten.", highlight: undefined },
  ]);
});

test("adaptNews: ét storyId bliver til netop én nyhed, aldrig samlet til '+N kilder'", () => {
  const vm = adaptNews("CVR-1-34580820", PAQLE_NEWS_FIXTURE, 10);
  assert.equal(vm.items.length, 1, "fixturen har ét storyId og skal give ét NewsItemVM, ikke et samlet 'kilder'-tal");
});

/* ---------------------------------------------------------------------------------------
 * Fletning af Lasso News og Paqle (LiveProvider.news, apps/server/src/data/live.ts).
 * ------------------------------------------------------------------------------------- */

test("mergeNews fletter efter tid (nyeste først), skærer til limit og lister bidragende kilder", () => {
  const lasso = adaptLassoNews(LASSO_NEWS_FIXTURE); // 2026-04-15 og 2026-03-01
  const paqle = adaptNews("CVR-1-34580820", PAQLE_NEWS_FIXTURE, 10).items; // 2026-04-18

  const merged = mergeNews("CVR-1-34580820", [
    { items: lasso, label: "Lasso News" },
    { items: paqle, label: "Paqle" },
  ], 10);

  assert.deepEqual(
    merged.items.map((i) => i.time),
    ["2026-04-18", "2026-04-15", "2026-03-01"],
  );
  assert.deepEqual(merged.sources, ["Lasso News", "Paqle"]);
  assert.equal(merged.updatedAt, "2026-04-18");
});

test("mergeNews skærer til limit og udelader en kilde uden poster fra kildelinjen", () => {
  const lasso = adaptLassoNews(LASSO_NEWS_FIXTURE);
  const merged = mergeNews("CVR-1-34580820", [
    { items: lasso, label: "Lasso News" },
    { items: [], label: "Paqle" },
  ], 1);
  assert.equal(merged.items.length, 1);
  assert.equal(merged.items[0]!.time, "2026-04-15");
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
