import { DemoProvider } from "../../apps/server/src/data/demo.ts";
const p = new DemoProvider();
const r = await p.search({ query: "", criteria: [], limit: 20 } as never);
console.log(r.rows.map((x: any) => `${x.lassoId} ${x.name} ${x.status ?? ""}`).join("\n"));
const c = await p.company("CVR-1-99000001" as never).catch((e: any) => e.message);
console.log(JSON.stringify(c).slice(0, 300));
const ppl = await p.people("CVR-1-99000001").catch((e: any) => e.message);
console.log(JSON.stringify(ppl).slice(0, 400));
