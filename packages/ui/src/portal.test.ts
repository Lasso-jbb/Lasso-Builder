import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "./components/AppShell.js";
import { LoginCard, LOGIN_HELP } from "./components/LoginCard.js";
import { Menu } from "./components/Menu.js";
import { ModuleToolbar } from "./components/ModuleToolbar.js";
import { TabStrip } from "./components/TabStrip.js";

const noop = () => {};
const login = (props: Partial<Parameters<typeof LoginCard>[0]> = {}) => renderToStaticMarkup(createElement(LoginCard, { onSubmit: noop, ...props }));

test("Login (portal): navnelogo, overskrift, bruger-id, adgangsnøgle som password, primær knap og hjælpelinje", () => {
  const html = login();
  assert.match(html, /<div class="lasso-login ">/);
  assert.match(html, /<form class="lasso-login__card" noValidate=""/);
  assert.match(html, /<svg[^>]*class="lasso-login__wordmark"[^>]*aria-label="Lasso"/);
  assert.match(html, /<h1 id="[^"]+" class="lasso-login__title">Log ind i Lasso<\/h1>/);
  assert.match(html, /<label for="([^"]+)">Bruger-id<\/label><input id="\1" type="text" class="lasso-input" autoComplete="username"[^>]*name="user"/);
  assert.match(html, /<label for="([^"]+)">Adgangsnøgle<\/label><input id="\1" type="password" class="lasso-input" autoComplete="current-password"[^>]*name="key"/);
  // Enter sender: knappen er formularens submit-knap, primær i koral
  assert.match(html, /<button type="submit" class="lasso-btn lasso-btn--primary lasso-login__submit">Log ind<\/button>/);
  assert.match(html, new RegExp(`class="lasso-login__help">${LOGIN_HELP}<`));
  assert.equal(LOGIN_HELP, "Brug samme nøgle som i din Lasso-connector.");
  // Ingen fejl eller besked uden grund
  assert.doesNotMatch(html, /role="alert"|role="status"|aria-invalid/);
});

test("Login: fejltekst under knappen som ren tekst med role=alert, felterne markeres ugyldige", () => {
  const html = login({ error: "Forkert bruger eller adgangsnøgle." });
  const button = html.indexOf("lasso-login__submit");
  const error = html.indexOf("Forkert bruger eller adgangsnøgle.");
  assert.ok(button > 0 && error > button, "fejlteksten står under knappen");
  assert.match(html, /<p id="([^"]+)" class="lasso-field__error lasso-login__error" role="alert">Forkert bruger eller adgangsnøgle\.<\/p>/);
  assert.equal((html.match(/aria-invalid="true"/g) ?? []).length, 2);
  assert.match(html, /class="lasso-input lasso-input--invalid"/);
  // Regel 1 og 4: ingen farvet boks, badge eller pille
  assert.doesNotMatch(html, /lasso-badge|lasso-notice|lasso-state--error/);
});

test("Login: besked efter udløbet session og slået fra, mens login står på", () => {
  const html = login({ notice: "Du er logget ud. Log ind igen.", busy: true });
  assert.match(html, /<p class="lasso-login__notice" role="status">Du er logget ud\. Log ind igen\.<\/p>/);
  // Beskeden står over felterne
  assert.ok(html.indexOf("lasso-login__notice") < html.indexOf("Bruger-id"));
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /<button type="submit"[^>]*disabled=""[^>]*>Log ind<\/button>/);
});

test("Fanebjælken: konto som eget element (portalens menu med navn og Log ud) i stedet for kontoknappen", () => {
  const account = createElement(Menu, {
    trigger: "Konto",
    triggerClassName: "lasso-strip__tool",
    triggerLabel: "Konto",
    context: { title: "Anne Eksempel", subtitle: "revisorhuset" },
    items: [{ id: "logout", label: "Log ud", sub: "Logget ind som Anne Eksempel" }],
  });
  const html = renderToStaticMarkup(createElement(TabStrip, { tabs: [{ id: "s", label: "Søgning", active: true }], onAccount: noop, account }));
  const tools = html.slice(html.indexOf("lasso-strip__tools"));
  assert.match(tools, /<button type="button" class="lasso-strip__tool" aria-haspopup="menu" aria-expanded="false"[^>]*aria-label="Konto">/);
  assert.match(tools, /lasso-menu__context-title">Anne Eksempel</);
  assert.match(tools, /lasso-menu__label">Log ud</);
  // Kun ét kontoelement: menuen erstatter den almindelige kontoknap
  assert.equal((tools.match(/aria-label="Konto"/g) ?? []).length, 1);
  // Uden account er det stadig den almindelige knap
  const plain = renderToStaticMarkup(createElement(TabStrip, { tabs: [], onAccount: noop }));
  assert.match(plain, /<button type="button" class="lasso-strip__tool" aria-label="Konto" title="Konto">/);
});

test("Modulværktøjslinjen: søgefelt før den primære handling (portalens søgning)", () => {
  const html = renderToStaticMarkup(
    createElement(ModuleToolbar, { field: createElement("input", { className: "lasso-input", "aria-label": "Søg" }), primary: { label: "Søg" } }),
  );
  assert.match(html, /class="lasso-toolbar lasso-toolbar--field /);
  assert.ok(html.indexOf("lasso-toolbar__field") < html.indexOf("lasso-toolbar__primary"), "feltet står før knappen");
  assert.match(html, /<div class="lasso-toolbar__field"><input class="lasso-input" aria-label="Søg"\/><\/div>/);
  // Et felt alene er nok til at tegne linjen
  assert.notEqual(renderToStaticMarkup(createElement(ModuleToolbar, { field: "x" })), "");
});

test("AppShell: bundnavigation med portalens tre punkter (Søg, Lister, Konto), uden overvågning", () => {
  const html = renderToStaticMarkup(
    createElement(AppShell, {
      rail: { groups: [] },
      tabs: { tabs: [{ id: "s", label: "Søgning", active: true }] },
      mobile: {
        title: "Søgning",
        nav: [
          { id: "soeg", label: "Søg", active: true },
          { id: "lister", label: "Lister" },
          { id: "konto", label: "Konto" },
        ],
      },
    }),
  );
  const nav = html.slice(html.indexOf('<nav class="lasso-bottomnav"'));
  assert.equal((nav.match(/lasso-bottomnav__item/g) ?? []).length, 3);
  assert.doesNotMatch(nav, /Overvågning/);
  assert.match(nav, /class="lasso-bottomnav__item is-on" aria-current="page"[^>]*>[^]*?Søg</);
  assert.match(html, /lasso-mobilebar__title">Søgning</);
});
