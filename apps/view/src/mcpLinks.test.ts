import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Testene kører fra apps/view, hvor tsx kan oversætte JSX klassisk (React.createElement).
(globalThis as { React?: typeof React }).React = React;
import { linksOf, OpenInLasso, ShareView } from "./mcpLinks.js";

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

test("MCP-appen: 'Åben i Lasso' øverst kun med et open-link; 'Del visning' nederst kun med et share-link", () => {
  const open = renderToStaticMarkup(createElement(OpenInLasso, { href: OPEN, onOpen: () => undefined }));
  assert.match(open, /lasso-mcplinks--top/);
  assert.match(open, /lasso-btn[^"]*lasso-mcplinks__open/);
  assert.match(open, /Åben i Lasso/);
  assert.equal(renderToStaticMarkup(createElement(OpenInLasso, { onOpen: () => undefined })), "");

  const share = renderToStaticMarkup(createElement(ShareView, { href: SHARE, onCopy: async () => true }));
  assert.match(share, /role="group" aria-label="Del visning"/);
  assert.match(share, />Del visning</);
  assert.match(share, new RegExp(`value="${SHARE.replace(/[?.]/g, "\\$&")}"`));
  assert.match(share, />Kopiér link</);
  assert.equal(renderToStaticMarkup(createElement(ShareView, { onCopy: async () => true })), "");
});
