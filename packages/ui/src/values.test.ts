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
  assert.match(amount, /▲ 12,4 % stigning/);
  const list = render(h(ValueList, { values: ["Anna Eksempel", "Bo Prøve", "Carl Eksempel"], onShowAll: noop }));
  assert.match(list, /Anna Eksempel, Bo Prøve og <button[^>]*>1 flere<\/button>/);
  assert.match(list, /Anna Eksempel og <button[^>]*>2 flere<\/button>/);
  assert.match(render(h(ValueList, { values: [] })), /Ingen/);
  assert.match(render(h(IndustryValue, { code: "692000", text: "Revisorvirksomhed" })), /lasso-industry__code">692000<\/span><span class="lasso-industry__text">Revisorvirksomhed/);
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
  assert.match(lockedCount, /lasso-locked__icon[^]*>3 personer<\/span>.*>Se med Lasso Pro</);
  assert.match(render(h(AmountValue, { value: 18_834_000, previous: 17_520_000, since: "2024" })), /▲7,5 % fra 2024/);
  assert.match(render(h(AmountValue, { value: -201_000, previous: 318_000, since: "2024" })), /\u2212201 t\. kr\.[^]*▼underskud, fra 318 t\. kr\./);
  assert.match(render(h(ScoreValue, { score: 52 })), /52<\/span><span class="lasso-score__meta"> af 100, lav risiko/);
  assert.match(render(h(FoldText, { text: "Kort" })), /Kort/);
  assert.match(render(h(FoldText, { text: "x ".repeat(200) })), /Vis mere/);
});

test("02c.5 PercentValue, 02c.6 PeriodValue med én dato, 02c.12 ContactValue", () => {
  const pct = render(h(PercentValue, { value: 17.3, compare: 11.2 }));
  assert.match(pct, /17,3 %<\/span><span class="lasso-muted-extra"> branche 11,2 %/);
  assert.match(render(h(PercentValue, { value: null })), /Ikke oplyst/);
  assert.match(render(h(PeriodValue, { date: "2016-03-01", extra: "10 år" })), /^<span>01\.03\.2016<span class="lasso-muted-extra"> 10 år<\/span><\/span>$/);
  assert.match(render(h(PeriodValue, { from: "2016-03-01", to: "2016-03-01" })), /^<span>01\.03\.2016<\/span>$/);
  assert.match(render(h(PeriodValue, { from: "2025-01-01", to: "2025-12-31" })), /01\.01\.2025–31\.12\.2025/);
  assert.equal(formatPhone("+45 71747812"), "71 74 78 12");
  assert.equal(formatWeb("https://www.eksempelbyg.dk/"), "eksempelbyg.dk");
  const tel = render(h(ContactValue, { kind: "phone", value: "71747812", more: 2, onShowAll: noop }));
  assert.match(tel, /href="tel:\+4571747812">71 74 78 12<\/a>/);
  assert.match(tel, /Se 2 flere/);
  assert.match(render(h(ContactValue, { kind: "email", value: "Info@Eksempel.DK" })), /mailto:info@eksempel\.dk">info@eksempel\.dk/);
  assert.match(render(h(ContactValue, { kind: "web", value: "https://www.eksempelbyg.dk" })), /href="https:\/\/www\.eksempelbyg\.dk" target="_blank"[^>]*>eksempelbyg\.dk/);
  assert.match(render(h(ContactValue, { kind: "phone", value: null })), /Ikke registreret/);
});
