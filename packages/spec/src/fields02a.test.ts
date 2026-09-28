import assert from "node:assert/strict";
import { test } from "node:test";
import { FIELD_BY_KEY, fieldOperators } from "./fields.js";

test("02a Operatorer i Papers rækkefølge", () => {
  assert.deepEqual(fieldOperators(FIELD_BY_KEY.get("navn")), ["contains", "starts_with", "eq", "neq"]);
  assert.deepEqual(fieldOperators(FIELD_BY_KEY.get("stiftet")), ["after", "before", "eq", "between"]);
  assert.deepEqual(fieldOperators(FIELD_BY_KEY.get("kommune")), ["in", "not_in"]);
  // En operator fra modellen uden for listen lægges bagerst, så feltet kan vise den.
  assert.deepEqual(fieldOperators(FIELD_BY_KEY.get("navn"), "in"), ["contains", "starts_with", "eq", "neq", "in"]);
});
