import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Testene kører fra apps/view, hvor tsx kan oversætte JSX klassisk (React.createElement).
(globalThis as { React?: typeof React }).React = React;
import { CardActions } from "@lasso/ui";
import { linksOf, ShareView } from "./mcpLinks.js";

const OPEN = "https://lasso.example/portal?aabn=CVR-1-99000001&fokus=overblik&fastgoer=1";
const SHARE = "https://lasso.example/v/abc123?sig=x";

test("MCP-appen: links læses fra structuredContent; open kun med et gyldigt link, intet uden share", () => {
  assert.deepEqual(linksOf({ links: { open: OPEN, share: SHARE } }), { open: OPEN, share: SHARE });
  assert.deepEqual(linksOf({ links: { share: SHARE } }), { share: SHARE });
  assert.deepEqual(linksOf({ links: { open: "javascript:alert(1)", share: SHARE } }), { share: SHARE });
  assert.equal(linksOf({ links: { open: OPEN } }), null);
  assert.equal(linksOf({}), null);
  assert.equal(linksOf(undefined), null);
});

test("MCP-appen: 'Del visning' nederst kun med et share-link", () => {
  const share = renderToStaticMarkup(createElement(ShareView, { href: SHARE, onCopy: async () => true }));
  assert.match(share, /role="group" aria-label="Del visning"/);
  assert.match(share, />Del visning</);
  assert.match(share, new RegExp(`value="${SHARE.replace(/[?.]/g, "\\$&")}"`));
  assert.match(share, />Kopiér link</);
  assert.equal(renderToStaticMarkup(createElement(ShareView, { onCopy: async () => true })), "");
});

test("Del visning viser og kopierer det korte /d/-link", async () => {
  const SHORT = "https://lasso.example/d/Ab3x9";
  assert.deepEqual(linksOf({ links: { share: SHORT, open: "https://lasso.example/portal?aabn=CVR-1-1&visning=Ab3x9" } })?.share, SHORT);
  let copied = "";
  const html = renderToStaticMarkup(createElement(ShareView, { href: SHORT, onCopy: async (u: string) => ((copied = u), true) }));
  assert.match(html, /value="https:\/\/lasso\.example\/d\/Ab3x9"/);
  assert.match(html, />Kopiér link</);
  assert.equal(copied, "", "intet kopieres, før der klikkes");
});

test("Samme knapper i begge værter (CardActions): MCP-appens række har portalkortets klasser; Åben i Lasso kun med et open-link", () => {
  const noop = () => undefined;
  const mcp = renderToStaticMarkup(createElement(CardActions, { onDownload: noop, downloadLabel: "Gem som PDF", onFullscreen: noop, primary: { label: "Åben i Lasso", icon: "mark", onClick: noop } }));
  const portal = renderToStaticMarkup(createElement(CardActions, { onDownload: noop, onFullscreen: noop, primary: { label: "Tilføj som fane", icon: "bookmark-plus", onClick: noop } }));
  const classes = (h: string) => [...h.matchAll(/class="([^"]*)"/g)].map((m) => m[1]).filter((c) => /lasso-(btn|iconbtn|cardact)\b/.test(c!) && !/__(icon|mark|markwrap)/.test(c!));
  assert.deepEqual(classes(mcp), classes(portal));
  assert.match(mcp, /aria-label="Gem som PDF"/);
  assert.match(mcp, /aria-label="Vis i fuld skærm"/);
  assert.match(mcp, /lasso-cardact__markwrap" aria-hidden="true"/);
  assert.match(mcp, /<span>Åben i Lasso<\/span>/);
  // Uden open-link: ingen pille; uden pdf og fuld skærm: intet.
  assert.doesNotMatch(renderToStaticMarkup(createElement(CardActions, { onFullscreen: noop })), /Åben i Lasso/);
  assert.equal(renderToStaticMarkup(createElement(CardActions, {})), "");
  // Telefon: ingen download, pillen som ikonknap med mærket.
  const narrow = renderToStaticMarkup(createElement(CardActions, { compact: true, onDownload: noop, onFullscreen: noop, primary: { label: "Åben i Lasso", icon: "mark", onClick: noop } }));
  assert.doesNotMatch(narrow, /Gem som PDF/);
  assert.match(narrow, /lasso-cardact__primarym" aria-label="Åben i Lasso"/);
});
