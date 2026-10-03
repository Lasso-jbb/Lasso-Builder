import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AmountValue, BooleanValue, ContactValue, FoldText, formatPhone, formatWeb, PercentValue, PeriodValue, IndustryValue, LockedValue, NotReported, QualityFlag, ScoreValue, ShareValue, ValueList } from "./components/Values.js";

const noop = () => {};
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

test("02c Felter med data", () => {
  assert.match(render(h(NotReported, { kind: "registered" })), /Ikke registreret/);
  assert.match(render(h(BooleanValue, { value: null })), /Ikke oplyst/);
  const amount = render(h(AmountValue, { value: 18_812_400, previous: 16_740_000 }));
  assert.match(amount, /18,8 mio\. kr\./);
  assert.match(amount, /role="tooltip"[^>]*>18\.812\.400 kr\./);
  assert.match(amount, /><span class="lasso-arrow">▲<\/span> 12,4 %<\/span>/);
  assert.doesNotMatch(amount, /stigning<|fald<|fra 20/);
  const list = render(h(ValueList, { values: ["Anna Eksempel", "Bo Prøve", "Carl Eksempel"], onShowAll: noop }));
  assert.match(list, /Anna Eksempel, Bo Prøve og <button[^>]*>1 mere<\/button>/);
  assert.match(list, /Anna Eksempel og <button[^>]*>2 flere<\/button>/);
  assert.match(render(h(ValueList, { values: [] })), /Ingen/);
  assert.match(render(h(IndustryValue, { code: "692000", text: "Revisorvirksomhed" })), /lasso-industry__text">Revisorvirksomhed<\/span><span class="lasso-industry__code">\(692000\)/);
  const share = render(h(ShareValue, { range: [25, 33.32] }));
  assert.match(share, /25–33,32 %/);
  assert.match(share, /left:25%;width:8\.32/);
  assert.match(render(h(ScoreValue, { score: 85 })), /lasso-score--high[^]*85<\/span><span class="lasso-score__meta"> af 100, høj risiko/);
  assert.match(render(h(QualityFlag, { reason: "Afviger fra sidste år" })), /aria-label="Mulig fejl: Afviger fra sidste år"/);
  const locked = render(h(LockedValue, { onUpgrade: noop }));
  assert.doesNotMatch(locked, /lasso-locked__blur/);
  assert.match(locked, /lasso-locked__icon/);
  assert.match(locked, />Kræver Lasso Pro</);
  const lockedCount = render(h(LockedValue, { count: 3, noun: "personer", onUpgrade: noop }));
  assert.match(lockedCount, /lasso-locked__icon[^]*>3 personer<\/span>.*>Kræver Lasso Pro</);
  assert.match(render(h(AmountValue, { value: 18_834_000, previous: 17_520_000, since: "2024" })), /lasso-up[^>]*><span class="lasso-arrow">▲<\/span> 7,5 %<\/span>/);
  assert.match(render(h(AmountValue, { value: -201_000, previous: 318_000, since: "2024" })), /\u2212201 t\. kr\.[^]*lasso-down[^>]*><span class="lasso-arrow">▼<\/span> 163,2 %<\/span>/);
  assert.doesNotMatch(render(h(AmountValue, { value: 5, previous: 0 })), /▲|▼/);
  assert.doesNotMatch(render(h(AmountValue, { value: 5 })), /▲|▼/);
  assert.match(render(h(ScoreValue, { score: 52 })), /52<\/span><span class="lasso-score__meta"> af 100, lav risiko/);
  assert.match(render(h(FoldText, { text: "Kort" })), /Kort/);
  assert.match(render(h(FoldText, { text: "x ".repeat(200) })), /Vis mere/);
});

test("02c.5 PercentValue, 02c.6 PeriodValue med én dato, 02c.12 ContactValue", () => {
  const pct = render(h(PercentValue, { value: 17.3, compare: 11.2 }));
  // 02c.5 (Jakob 29.09.2026): kun den ene procent, ingen sammenligning efter.
  assert.equal(pct, '<span class="lasso-num">17,3 %</span>');
  assert.match(render(h(PercentValue, { value: null })), /Ikke oplyst/);
  assert.match(render(h(PeriodValue, { date: "2016-03-01", extra: "10 år" })), /^<span>01\.03\.2016<span class="lasso-muted-extra"> 10 år<\/span><\/span>$/);
  assert.match(render(h(PeriodValue, { from: "2016-03-01", to: "2016-03-01" })), /^<span>01\.03\.2016<\/span>$/);
  assert.match(render(h(PeriodValue, { from: "2025-01-01", to: "2025-12-31" })), /01\.01\.2025–31\.12\.2025/);
  assert.equal(formatPhone("+45 71747812"), "71 74 78 12");
  assert.equal(formatWeb("https://www.eksempelbyg.dk/"), "eksempelbyg.dk");
  const tel = render(h(ContactValue, { kind: "phone", value: "71747812", more: 2, onShowAll: noop }));
  // Jakob 01.10: nummeret er ren tekst; kun "Se alle N" (alle numre) kan klikkes.
  assert.match(tel, /<span>71 74 78 12<\/span>/);
  assert.doesNotMatch(tel, /tel:/);
  assert.match(tel, />Se alle 3</);
  assert.match(render(h(ContactValue, { kind: "email", value: "Info@Eksempel.DK" })), /mailto:info@eksempel\.dk">info@eksempel\.dk/);
  assert.match(render(h(ContactValue, { kind: "web", value: "https://www.eksempelbyg.dk" })), /href="https:\/\/www\.eksempelbyg\.dk" target="_blank"[^>]*>eksempelbyg\.dk/);
  assert.match(render(h(ContactValue, { kind: "phone", value: null })), /Ikke registreret/);
});

test("02c.13 EntityRef: virksomheder kun med navnet, personer må have Siden <dato>", async () => {
  const { EntityRef } = await import("./components/Values.js");
  const co = render(h(EntityRef, { name: "Eksempel Holding ApS", secondary: "CVR 99000010", kind: "company", onOpen: noop }));
  assert.match(co, /Eksempel Holding ApS/);
  assert.doesNotMatch(co, /CVR|lasso-entity__sub/);
  assert.match(render(h(EntityRef, { name: "Anne Eksempel", secondary: "Siden 01.03.2016" })), /lasso-entity__sub">Siden 01\.03\.2016/);
});

test("02c.8/05.7 Status: farven følger ordet i fire grupper for alle 19 CVR-statusser", async () => {
  const { STATUS_GROUPS, statusKind } = await import("@lasso/spec");
  const { statusTone } = await import("./primitives.js");
  const tone = { active: "active", temporary: "liquidation", problem: "warning", inactive: "inactive" } as const;
  for (const g of STATUS_GROUPS) for (const s of g.statuses) assert.equal(statusTone(s, statusKind(s)), tone[g.group], s);
  assert.equal(statusTone("OPLØSTEFTERKONKURS", "inactive"), "warning");
  assert.equal(statusTone("Ukendt", "active"), "active");
});
