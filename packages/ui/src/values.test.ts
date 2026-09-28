import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AmountValue, BooleanValue, FoldText, IndustryValue, LockedValue, NotReported, QualityFlag, ScoreValue, ShareValue, ValueList } from "./components/Values.js";

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
  assert.match(render(h(ScoreValue, { score: 85 })), /lasso-score--high[^]*85[^]*, af 100, høj risiko/);
  assert.match(render(h(QualityFlag, { reason: "Afviger fra sidste år" })), /aria-label="Mulig fejl: Afviger fra sidste år"/);
  const locked = render(h(LockedValue, { onUpgrade: noop }));
  assert.match(locked, /lasso-locked__blur/);
  assert.match(locked, />Opgradér for at se</);
  assert.doesNotMatch(locked, /Pro/);
  assert.match(render(h(FoldText, { text: "Kort" })), /Kort/);
  assert.match(render(h(FoldText, { text: "x ".repeat(200) })), /Vis mere/);
});
