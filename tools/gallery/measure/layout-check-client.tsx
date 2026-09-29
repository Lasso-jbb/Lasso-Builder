import { createRoot } from "react-dom/client";
import type { Dataset, ViewSpec } from "@lasso/spec";
import { LassoView, ToastProvider } from "@lasso/ui";
const i = Number(new URLSearchParams(location.search).get("i") ?? "0");
const { spec, ds } = (window as unknown as { __PAGES__: { spec: ViewSpec; ds: Dataset }[] }).__PAGES__[i]!;
createRoot(document.getElementById("stage")!).render(<ToastProvider><div className="lasso-root"><LassoView spec={spec} dataset={ds} host={{ openSection: true, drillDown: true, save: true, export: true, refresh: true }} onAction={() => undefined} theme="light" frameless /></div></ToastProvider>);
