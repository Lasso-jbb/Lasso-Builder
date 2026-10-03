import assert from "node:assert/strict";
import { test } from "node:test";
import { createLinkFilter, idsIn, sanitizeLinks } from "./links.js";

const allowed = new Set(["CVR-3-4000000007", "CVR-1-99000001"]);
const gitte = "[Gitte](lasso:person/CVR-3-4000000007)";

test("idsIn: Lasso-ID'er i store bogstaver", () => {
  assert.deepEqual(idsIn("se cvr-3-4000000007 og CVR-1-99000001, ikke CVR-9-1"), ["CVR-3-4000000007", "CVR-1-99000001"]);
});

test("sanitizeLinks: opfundne id'er bliver tekst, ens links bliver ét, modullinks dedupes men valideres ikke mod id", () => {
  const seen = new Set<string>();
  assert.equal(sanitizeLinks(`Se [Ole](lasso:person/CVR-3-9999999) og ${gitte}.`, allowed, seen), `Se Ole og ${gitte}.`);
  // Samme link igen i samme tur: væk, uden dobbelte mellemrum.
  assert.equal(sanitizeLinks(`Mere: ${gitte} ${gitte} slut`, allowed, seen), "Mere: slut");
  assert.equal(sanitizeLinks("[Byg](lasso:firma/cvr-1-99000001)", allowed, new Set()), "[Byg](lasso:firma/cvr-1-99000001)", "id'et sammenlignes uden hensyn til store/små bogstaver");
  const s2 = new Set<string>();
  assert.equal(sanitizeLinks("[Regnskab](lasso:modul/regnskab) [Regnskab](lasso:modul/regnskab) [Overblik](lasso:modul/overblik)", allowed, s2), "[Regnskab](lasso:modul/regnskab) [Overblik](lasso:modul/overblik)");
  // Almindelige links og tekst røres ikke.
  assert.equal(sanitizeLinks("Se [Lasso](https://lassox.com) [x] (y)", allowed, new Set()), "Se [Lasso](https://lassox.com) [x] (y)");
});

test("createLinkFilter: samme resultat, uanset hvor deltaerne deles; tekst uden links streames straks", () => {
  const text = `Hej [fed] og (parentes). Se [Ole](lasso:person/CVR-3-9999999), ${gitte} ${gitte}\n\n[Regnskab](lasso:modul/regnskab) [Lasso](https://lassox.com) [ufærdig`;
  // Mellemrum før et linjeskift er uden betydning (klienten trimmer linjer).
  const tidy = (t: string) => t.replace(/[ \t]+\n/g, "\n");
  const whole = (() => {
    const f = createLinkFilter(() => allowed, new Set());
    return f.push(text) + f.flush();
  })();
  assert.equal(tidy(whole), `Hej [fed] og (parentes). Se Ole, ${gitte}\n\n[Regnskab](lasso:modul/regnskab) [Lasso](https://lassox.com) [ufærdig`);
  for (let cut = 1; cut < text.length; cut++) {
    const f = createLinkFilter(() => allowed, new Set());
    assert.equal(f.push(text.slice(0, cut)) + f.push(text.slice(cut)) + f.flush(), whole, `delt ved ${cut}`);
  }
  // Tegn for tegn.
  const f = createLinkFilter(() => allowed, new Set());
  let out = "";
  for (const ch of text) out += f.push(ch);
  assert.equal(out + f.flush(), whole);
  // Almindelig tekst kommer ud med det samme (ingen forsinkelse).
  const g = createLinkFilter(() => allowed, new Set());
  assert.equal(g.push("Jeg viser regnskabet "), "Jeg viser regnskabet ");
  assert.equal(g.push("nu. [Reg"), "nu. ");
  assert.equal(g.push("nskab](lasso:modul/regnskab)"), "[Regnskab](lasso:modul/regnskab)");
});
