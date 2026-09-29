import assert from "node:assert/strict";
import { test } from "node:test";
import { composeCompany, composePerson, emptyDataset, parseViewSpec } from "@lasso/spec";
import { focusPrompt } from "./focusPrompt.js";

const CO = "CVR-1-99000001";
const PERSON = "CVR-3-4000000002";

test("MCP-appen: open-focus bliver en besked til chatten med fanen og sidens navn", () => {
  const ds = emptyDataset("demo");
  ds.companies[CO] = { lassoId: CO, name: "EKSEMPEL BYG A/S", status: "Normal" };
  const spec = composeCompany(CO, ds, { focus: "overblik" });
  // Kortnavnet som i opfølgningerne; modellen svarer med show_company focus historik.
  assert.equal(focusPrompt(spec, ds, "historik"), "Vis historik for Eksempel Byg");
  assert.equal(focusPrompt(spec, ds, "oekonomi"), "Vis økonomi for Eksempel Byg");
  // Et personfokus på en virksomhedsside, eller et ukendt fokus: ingen besked.
  assert.equal(focusPrompt(spec, ds, "netvaerk"), null);
  assert.equal(focusPrompt(spec, ds, "salg"), null);

  ds.persons[PERSON] = { lassoId: PERSON, name: "Bo Eksempel", roles: [] };
  const person = composePerson(PERSON, ds);
  assert.equal(focusPrompt(person, ds, "netvaerk"), "Vis netværk for Bo Eksempel");
  assert.equal(focusPrompt(person, ds, "roller"), "Vis roller for Bo Eksempel");
  assert.equal(focusPrompt(person, ds, "oekonomi"), null);
  // Uden datasæt: specens titel. En liste har ingen faner.
  assert.equal(focusPrompt(person, null, "historik"), "Vis historik for Bo Eksempel");
  const list = parseViewSpec({ kind: "list", title: "Revisorer", components: [{ type: "LassoTimeline", company: CO, more: "historik" }] });
  assert.equal(focusPrompt(list, ds, "historik"), null);
});
