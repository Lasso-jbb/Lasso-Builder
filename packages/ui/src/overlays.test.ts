import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Dialog } from "./components/Dialog.js";
import { Menu, Picker } from "./components/Menu.js";
import { ToastItem, ToastProvider } from "./components/Toast.js";
import { Tooltip } from "./components/Tooltip.js";
import { SaveDialog } from "./SaveDialog.js";

const noop = () => {};

test("Dialog (07): role, aria-modal, titel/undertekst og knapper i rækkefølgen destruktiv, sekundær, primær", () => {
  const html = renderToStaticMarkup(
    createElement(
      Dialog,
      {
        open: true,
        title: "Gem ændringer først?",
        description: "Du har ændret listen uden at gemme.",
        onClose: noop,
        actions: {
          destructive: { label: "Kassér", onClick: noop },
          secondary: { label: "Annuller", onClick: noop },
          primary: { label: "Gem og gå videre", onClick: noop },
        },
      },
      "indhold",
    ),
  );
  assert.match(html, /role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="([^"]+)"[^>]*aria-describedby="([^"]+)"/);
  const [, titleId, descId] = html.match(/aria-labelledby="([^"]+)"[^>]*aria-describedby="([^"]+)"/)!;
  assert.match(html, new RegExp(`<h2 id="${titleId}" class="lasso-dialog__title">Gem ændringer først\\?</h2>`));
  assert.match(html, new RegExp(`<p id="${descId}" class="lasso-dialog__desc">Du har ændret listen uden at gemme.</p>`));
  assert.match(html, /class="lasso-dialog__scrim"/);
  assert.match(html, /aria-label="Luk"/);
  assert.match(html, /lasso-dialog__body">indhold</);
  const order = ["Kassér", "Annuller", "Gem og gå videre"].map((t) => html.indexOf(`>${t}<`));
  assert.ok(order[0]! > 0 && order[0]! < order[1]! && order[1]! < order[2]!, "knapperne står i rækkefølgen destruktiv, sekundær, primær");
  assert.match(html, /lasso-btn--danger lasso-dialog__destructive"[^>]*>Kassér</);
  assert.match(html, /lasso-btn--primary lasso-dialog__primary"[^>]*>Gem og gå videre</);
  // Lukket dialog tegner intet
  assert.equal(renderToStaticMarkup(createElement(Dialog, { open: false, title: "x", onClose: noop })), "");
});

test("Dialog: destruktiv bekræftelse får ink-knap, sm-størrelse", () => {
  const html = renderToStaticMarkup(createElement(Dialog, { open: true, title: "Slet listen?", onClose: noop, size: "sm", actions: { primary: { label: "Slet", onClick: noop, destructive: true } } }));
  assert.match(html, /lasso-dialog--sm/);
  assert.match(html, /lasso-btn--ink lasso-dialog__primary"[^>]*>Slet</);
});

test("Gem-dialog bruger Dialog: felter, Annuller og Gem og få link", () => {
  const html = renderToStaticMarkup(createElement(SaveDialog, { defaultName: "Store IT-selskaber", prefix: "lasso.dk/v/", onAction: noop, onClose: noop }));
  assert.match(html, /role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /lasso-dialog__title">Gem visning</);
  assert.match(html, /id="lasso-save-name"[^>]*value="Store IT-selskaber"/);
  assert.match(html, /value="store-it-selskaber"/);
  assert.match(html, /lasso-dialog__secondary"[^>]*>Annuller</);
  assert.match(html, /lasso-dialog__primary"[^>]*>Gem og få link</);
});

test("Menu (07): knap med aria-haspopup/expanded, liste role=menu, destruktivt punkt, kontekst og Annuller til mobil", () => {
  const html = renderToStaticMarkup(
    createElement(Menu, {
      trigger: "…",
      triggerLabel: "Flere handlinger",
      label: "Handlinger",
      context: { title: "Store IT-selskaber", subtitle: "Gemt liste, 1.243 virksomheder" },
      items: [
        { id: "rename", label: "Omdøb", onSelect: noop },
        { id: "export", label: "Eksportér", onSelect: noop },
        { id: "delete", label: "Slet", destructive: true, onSelect: noop },
      ],
    }),
  );
  assert.match(html, /<button[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"[^>]*aria-controls="([^"]+)"[^>]*aria-label="Flere handlinger"/);
  const [, listId] = html.match(/aria-controls="([^"]+)"/)!;
  assert.match(html, new RegExp(`<div id="${listId}" class="lasso-menu__pop[^"]*" hidden=""`));
  assert.match(html, /role="menu"[^>]*aria-label="Handlinger"/);
  assert.equal((html.match(/role="menuitem"/g) ?? []).length, 3);
  assert.match(html, /lasso-menu__item lasso-menu__item--danger [^"]*"[^>]*>(?:(?!<\/button>).)*Slet/);
  assert.match(html, /lasso-menu__context-title">Store IT-selskaber</);
  assert.match(html, /lasso-menu__context-sub">Gemt liste, 1.243 virksomheder</);
  assert.match(html, /lasso-menu__cancel"[^>]*>Annuller</);
  assert.doesNotMatch(html, /·/);
});

test("Vælgerliste (Picker): gruppeoverskrift, valgt punkt med flueben og aria-checked", () => {
  const html = renderToStaticMarkup(
    createElement(Picker, {
      trigger: "Store IT-selskaber",
      value: "a",
      groups: [
        { items: [{ id: "new", label: "Ny", sub: "Start forfra" }] },
        { label: "Gemte", items: [{ id: "a", label: "Store IT-selskaber" }, { id: "b", label: "IT i Hovedstaden" }] },
      ],
    }),
  );
  assert.match(html, /lasso-menu__pop--picker/);
  assert.match(html, /lasso-menu__heading">Gemte</);
  assert.match(html, /lasso-menu__sub">Start forfra</);
  assert.equal((html.match(/role="menuitemradio"/g) ?? []).length, 3);
  assert.match(html, /aria-checked="true"[^>]*class="lasso-menu__item [^"]*is-on"[^>]*>(?:(?!<\/button>).)*Store IT-selskaber(?:(?!<\/button>).)*lasso-menu__check/);
  assert.equal((html.match(/lasso-menu__check/g) ?? []).length, 1);
});

test("Besked/toast (07): ikon + tekst + handling + luk, stak med role=status", () => {
  const html = renderToStaticMarkup(
    createElement(ToastProvider, {
      initial: [
        { text: "“Store IT-selskaber” er gemt", tone: "ok", action: { label: "Fortryd", onClick: noop } },
        { text: "Eksporten kunne ikke hentes", tone: "error", action: { label: "Prøv igen", onClick: noop } },
      ],
    }),
  );
  assert.match(html, /class="lasso-toasts" role="status" aria-live="polite"/);
  assert.equal((html.match(/class="lasso-toast lasso-toast--/g) ?? []).length, 2);
  assert.match(html, /lasso-toast--ok"[^>]*>(?:(?!lasso-toast--error).)*Fortryd/);
  assert.match(html, /lasso-toast--error" role="alert"[^>]*>(?:(?!<\/div>).)*Prøv igen/);
  assert.equal((html.match(/aria-label="Luk"/g) ?? []).length, 2);
  const one = renderToStaticMarkup(createElement(ToastItem, { toast: { id: 1, text: "Link kopieret" } }));
  assert.match(one, /lasso-toast__text">Link kopieret</);
  assert.doesNotMatch(one, /lasso-toast__action/);
});

test("Tooltip (07): role=tooltip og aria-describedby på elementet", () => {
  const html = renderToStaticMarkup(createElement(Tooltip, { text: "To eller flere direktionsmedlemmer med samme efternavn", children: createElement("button", { type: "button" }, "Hjælp") }));
  assert.match(html, /<button type="button" aria-describedby="([^"]+)">Hjælp<\/button>/);
  const [, tipId] = html.match(/aria-describedby="([^"]+)"/)!;
  assert.match(html, new RegExp(`<span role="tooltip" id="${tipId}" class="lasso-tip__bubble">To eller flere direktionsmedlemmer med samme efternavn</span>`));
});
