import { createRoot } from "react-dom/client";
import { composeCompany, composePerson, type Dataset } from "@lasso/spec";
import { LassoView, ToastProvider } from "@lasso/ui";
import { entries } from "./entries.js";
const id = Number(new URLSearchParams(location.search).get("id") ?? "0");
const e = entries[id]!;
const ds = (window as unknown as { __GALLERY_DATA__: Record<string, Dataset> }).__GALLERY_DATA__[String(id)]!;
const spec = e.kind === "company" ? composeCompany(e.id, ds, { focus: e.focus as never, name: ds.companies[e.id]?.name, followUps: false }) : composePerson(e.id, ds, { focus: e.focus as never, followUps: false });
createRoot(document.getElementById("stage")!).render(<ToastProvider><div className="lasso-root"><LassoView spec={spec} dataset={ds} host={{ openSection: true, drillDown: true, save: true, export: true, refresh: true }} onAction={() => undefined} theme="light" frameless /></div></ToastProvider>);
