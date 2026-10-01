import { composePerson, composePersonProbe } from "@lasso/spec";
import { DemoProvider } from "../data/demo.js";
import { resolveSpec } from "../data/resolve.js";
for (const id of ["CVR-3-4000000001", "CVR-3-4000000002"]) {
  const ds = await resolveSpec(composePersonProbe(id, "overblik"), new DemoProvider());
  console.log(id, composePerson(id, ds).components.map((c: any) => `${c.type.replace("Lasso","")}:${c.width ?? ""}@${c.column ?? ""}`).join("  "));
}
