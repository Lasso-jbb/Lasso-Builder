import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDataset, type CompanyVM, type NewsVM, type OwnershipVM, type ViewSpec } from "@lasso/spec";
import { KeyValueList } from "./components/KeyValueList.js";
import { LassoNews } from "./components/LassoNews.js";
import { LassoView } from "./LassoView.js";

/**
 * Links på alle relationer: navne med Lasso-ID (nyheder, revisor) bliver lasso-link-knapper, når
 * værten har drill-down, og ellers ren tekst. Nyhedsrækken er ikke længere ét stort <a>, fordi
 * knapper ikke må ligge inde i et link.
 */

const SELF = "CVR-1-24256790";
const noop = () => {};

function news(): NewsVM {
  return {
    lassoId: SELF,
    items: [
      {
        source: "Lasso",
        url: "https://lasso.dk/nyheder/bestyrelse",
        time: "2026-09-20",
        headline: "Et medlem udtræder af bestyrelsen for NOVO NORDISK A/S",
        excerpt: "Tanja Villumsen udtræder. Ny ejer: Novo Holdings A/S",
        headlineSegments: [{ text: "Et medlem udtræder af bestyrelsen for " }, { text: "NOVO NORDISK A/S", lassoId: SELF }],
        extractSegments: [
          { text: "Tanja Villumsen", lassoId: "CVR-3-4007574142" },
          { text: " udtræder. Ny ejer: " },
          { text: "Novo Holdings A/S", lassoId: "CVR-1-24257630" },
        ],
      },
      {
        source: "sundhedstinget.dk",
        url: "https://sundhedstinget.dk/artikel",
        time: "2026-09-18",
        headline: "NOVO NORDISK A/S udvider",
        headlineSegments: [{ text: "NOVO NORDISK A/S", highlight: true }, { text: " udvider" }],
      },
      { source: "Lasso", time: "2026-09-01", headline: "Nævner Anne Test", headlineSegments: [{ text: "Nævner " }, { text: "Anne Test", lassoId: "CVR-3-1" }] },
    ],
  };
}

/** Intet <a>…</a> må indeholde en knap (ugyldig HTML, og klik på navnet ville også åbne artiklen). */
function assertNoButtonInLink(html: string) {
  for (const m of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) assert.ok(!m[1]!.includes("<button"), `knap inde i et link: ${m[0]}`);
}

test("LassoNews med drill-down: overskriften linker til artiklen, navne med Lasso-ID er lasso-link-knapper", () => {
  const html = renderToStaticMarkup(createElement(LassoNews, { news: news(), companyId: SELF, onOpen: noop }));
  assert.ok(!html.includes('<a class="lasso-news__row"'), "rækken er ikke selv et link");
  assert.match(html, /<article class="lasso-news__row">/);
  assert.match(html, /<a href="https:\/\/lasso.dk\/nyheder\/bestyrelse" target="_blank" rel="noreferrer"><span>Et medlem udtræder af bestyrelsen for <\/span><strong>NOVO NORDISK A\/S<\/strong><\/a>/, "sidens eget navn står fed i linket, ikke som knap til sig selv");
  assert.match(html, /<button type="button" class="lasso-link lasso-news__entity">Tanja Villumsen<\/button>/);
  assert.match(html, /<button type="button" class="lasso-link lasso-news__entity">Novo Holdings A\/S<\/button>/);
  assert.match(html, /<strong>NOVO NORDISK A\/S<\/strong><span> udvider<\/span>/, "Paqles highlight er stadig fed");
  // Uden url: ingen artikel-link, men navnet kan stadig åbnes.
  assert.match(html, /<span>Nævner <\/span><button type="button" class="lasso-link lasso-news__entity">Anne Test<\/button>/);
  assertNoButtonInLink(html);
});

test("LassoNews: et navn midt i en linket overskrift deler linket i to <a> omkring knappen", () => {
  const vm: NewsVM = {
    lassoId: SELF,
    items: [
      {
        source: "Lasso",
        url: "https://lasso.dk/x",
        headline: "Anne Test indtræder i NOVO",
        headlineSegments: [{ text: "Ny direktør " }, { text: "Anne Test", lassoId: "CVR-3-1" }, { text: " i NOVO" }],
      },
    ],
  };
  const html = renderToStaticMarkup(createElement(LassoNews, { news: vm, companyId: SELF, onOpen: noop }));
  assert.match(
    html,
    /<a href="https:\/\/lasso.dk\/x" target="_blank" rel="noreferrer"><span>Ny direktør <\/span><\/a><button type="button" class="lasso-link lasso-news__entity">Anne Test<\/button><a href="https:\/\/lasso.dk\/x" target="_blank" rel="noreferrer"><span> i NOVO<\/span><\/a>/,
  );
  assertNoButtonInLink(html);
});

test("LassoNews uden drill-down: ingen knapper, navnene står som ren tekst, overskriften linker stadig", () => {
  const html = renderToStaticMarkup(createElement(LassoNews, { news: news(), companyId: SELF }));
  assert.ok(!html.includes("<button type=\"button\" class=\"lasso-link lasso-news__entity\""));
  assert.match(html, /<span>Tanja Villumsen<\/span>/);
  assert.match(html, /<a href="https:\/\/lasso.dk\/nyheder\/bestyrelse" target="_blank" rel="noreferrer">/);
});

const company: CompanyVM = { lassoId: "CVR-1-99000001", cvr: "99000001", name: "Eksempel Byg A/S" };
const ownership = (auditor: OwnershipVM["auditor"]): OwnershipVM => ({ lassoId: company.lassoId, owners: [], auditor });

test("KeyValueList: revisoren med CVR-1-ID er et lasso-link, når værten har drill-down", () => {
  const html = renderToStaticMarkup(
    createElement(KeyValueList, { company, ownership: ownership({ name: "Crowe", lassoId: "CVR-1-33256876" }), variant: "company", onOpen: noop }),
  );
  assert.match(html, /<button type="button" class="lasso-link">Crowe<\/button>/);
});

test("KeyValueList: revisoren står som ren tekst uden drill-down eller uden Lasso-ID", () => {
  const without = renderToStaticMarkup(createElement(KeyValueList, { company, ownership: ownership({ name: "Crowe", lassoId: "CVR-1-33256876" }), variant: "company" }));
  assert.ok(!without.includes("<button"));
  assert.match(without, />Crowe</);
  const noId = renderToStaticMarkup(createElement(KeyValueList, { company, ownership: ownership({ name: "Crowe" }), variant: "company", onOpen: noop }));
  assert.ok(!noId.includes("<button"));
});

test("LassoView sender drill-down videre til nyheder og revisor", () => {
  const spec: ViewSpec = {
    version: 2,
    kind: "company",
    title: "Eksempel Byg A/S",
    layout: "dashboard",
    criteria: [],
    components: [
      { type: "LassoKeyValueList", company: company.lassoId, variant: "company" },
      { type: "LassoNews", company: company.lassoId, limit: 3 },
    ],
  };
  const ds = emptyDataset("demo");
  ds.companies[company.lassoId] = company;
  ds.ownership[company.lassoId] = ownership({ name: "Crowe", lassoId: "CVR-1-33256876" });
  ds.news[company.lassoId] = { lassoId: company.lassoId, items: news().items };
  const render = (drillDown: boolean) => renderToStaticMarkup(createElement(LassoView, { spec, dataset: ds, host: { drillDown }, onAction: noop }));
  const on = render(true);
  assert.match(on, /<button type="button" class="lasso-link">Crowe<\/button>/);
  assert.match(on, /lasso-news__entity">Tanja Villumsen</);
  const off = render(false);
  assert.ok(!off.includes("lasso-news__entity"));
  assert.ok(!off.includes('class="lasso-link">Crowe'));
});
