import { useCallback, useEffect, useRef, useState } from "react";
import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/client";
import { LassoView, LassoMark, type ActionResult, type ViewAction } from "@lasso/ui";
import { composeCompany, composePerson, composeProbe, composePersonProbe, DATASET_META_KEY, formatCriterion, type Dataset, type ViewSpec } from "@lasso/spec";

interface Screen {
  spec: ViewSpec;
  dataset: Dataset | null;
  url?: string;
}

function textOf(result: CallToolResult): string {
  return (result.content ?? [])
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

async function resolve(app: App, spec: ViewSpec): Promise<Screen> {
  const res = await app.callServerTool({ name: "resolve_view", arguments: { spec } });
  if (res.isError) throw new Error(textOf(res) || "Kunne ikke hente data");
  const sc = res.structuredContent as { spec: ViewSpec; dataset: Dataset } | undefined;
  if (!sc) throw new Error("Tomt svar fra serveren");
  return { spec: sc.spec, dataset: sc.dataset };
}

/** MCP App: tegner tool-resultater i Claude/ChatGPT og håndterer interaktion uden model-tur. */
export function McpView() {
  const [stack, setStack] = useState<Screen[]>([]);
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<McpUiHostContext | undefined>();
  const appRef = useRef<App | null>(null);

  const showResult = useCallback(async (result: CallToolResult) => {
    const app = appRef.current;
    setPendingTitle(null);
    if (result.isError) {
      setError(textOf(result) || "Værktøjet fejlede");
      return;
    }
    const sc = result.structuredContent as { spec?: ViewSpec } | undefined;
    if (!sc?.spec) return;
    const ds = (result._meta as Record<string, unknown> | undefined)?.[DATASET_META_KEY] as Dataset | undefined;
    setError(null);
    if (ds) {
      setStack([{ spec: sc.spec, dataset: ds }]);
      return;
    }
    // Værten sendte ikke _meta med: hent data via det app-interne tool.
    setStack([{ spec: sc.spec, dataset: null }]);
    if (!app) return;
    try {
      setStack([await resolve(app, sc.spec)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const { app, error: connectError } = useApp({
    appInfo: { name: "Lasso", version: "0.1.0" },
    capabilities: {},
    onAppCreated: (a) => {
      appRef.current = a;
      a.ontoolinput = (p) => {
        const args = (p.arguments ?? {}) as { title?: string; company?: string; person?: string; query?: string };
        setPendingTitle(args.title ?? args.company ?? args.person ?? (args.query ? `Søgning: ${args.query}` : "Henter…"));
      };
      a.ontoolresult = (r) => void showResult(r as CallToolResult);
      a.ontoolcancelled = () => setPendingTitle(null);
      a.onhostcontextchanged = (p) => setCtx((prev) => ({ ...prev, ...p }));
      a.onerror = (e) => console.error("[lasso] app-fejl", e);
    },
  });

  useEffect(() => {
    if (app) setCtx(app.getHostContext());
  }, [app]);

  const current = stack.at(-1);

  const replaceTop = (s: Screen) => setStack((st) => [...st.slice(0, -1), s]);

  const onAction = async (a: ViewAction): Promise<ActionResult | void> => {
    if (!app) return { ok: false, error: "Ikke forbundet" };
    try {
      switch (a.kind) {
        case "prompt": {
          const r = await app.sendMessage({ role: "user", content: [{ type: "text", text: a.prompt }] });
          return r.isError ? { ok: false, error: "Værten afviste beskeden" } : { ok: true };
        }
        case "open-company": {
          // Samme cockpit som show_company og /k/: hent data først, og lad komponisten vælge form.
          const probe = composeProbe(a.lassoId, "overblik");
          setStack((st) => [...st, { spec: { ...probe, title: a.name ?? a.lassoId }, dataset: null }]);
          setLoading(true);
          const fetched = await resolve(app, probe);
          const ds = fetched.dataset!;
          const name = ds.companies[a.lassoId]?.name ?? a.name ?? a.lassoId;
          replaceTop({ spec: composeCompany(a.lassoId, ds, { focus: "overblik", name }), dataset: ds });
          void app
            .updateModelContext({ content: [{ type: "text", text: `Brugeren kigger nu på ${name} (${a.lassoId}) i Lasso-visningen.` }] })
            .catch(() => {});
          return { ok: true };
        }
        case "open-person": {
          // Katalog 16: hent persondata, og lad komponisten vælge form, som show_person gør.
          const probe = composePersonProbe(a.lassoId);
          setStack((st) => [...st, { spec: { ...probe, title: a.name ?? a.lassoId }, dataset: null }]);
          setLoading(true);
          const fetched = await resolve(app, probe);
          const ds = fetched.dataset!;
          const name = ds.persons[a.lassoId]?.name ?? a.name ?? a.lassoId;
          replaceTop({ spec: composePerson(a.lassoId, ds, { name }), dataset: ds });
          void app
            .updateModelContext({ content: [{ type: "text", text: `Brugeren kigger nu på personen ${name} (${a.lassoId}) i Lasso-visningen.` }] })
            .catch(() => {});
          return { ok: true };
        }
        case "back":
          setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
          return { ok: true };
        case "set-criteria": {
          if (!current) return;
          const criteria = a.criteria;
          const spec: ViewSpec = {
            ...current.spec,
            criteria,
            components: current.spec.components.map((c) => (c.type === "LassoCompanyTable" ? { ...c, search: { ...c.search, criteria } } : c)),
          };
          setLoading(true);
          replaceTop({ spec, dataset: current.dataset, url: undefined });
          replaceTop(await resolve(app, spec));
          void app
            .updateModelContext({ content: [{ type: "text", text: `Brugeren har rettet filtrene til: ${criteria.map(formatCriterion).join("; ") || "ingen"}.` }] })
            .catch(() => {});
          return { ok: true };
        }
        case "refresh": {
          if (!current) return;
          setLoading(true);
          replaceTop({ ...(await resolve(app, current.spec)), url: current.url });
          return { ok: true };
        }
        case "save": {
          if (!current) return;
          const r = await app.callServerTool({ name: "save_view", arguments: { spec: current.spec, name: a.name, slug: a.slug, visibility: a.visibility } });
          if (r.isError) return { ok: false, error: textOf(r) || "Kunne ikke gemme" };
          const url = (r.structuredContent as { url?: string } | undefined)?.url;
          if (url) replaceTop({ ...current, url });
          return { ok: true, url };
        }
        case "copy-link":
          try {
            await navigator.clipboard.writeText(a.url);
            return { ok: true };
          } catch {
            const r = await app.openLink({ url: a.url });
            return r.isError ? { ok: false, error: "Kopiering er ikke tilladt her. Brug 'Vis i Lasso'." } : { ok: true };
          }
        case "open-link": {
          const r = await app.openLink({ url: a.url });
          return r.isError ? { ok: false, error: "Værten afviste linket" } : { ok: true };
        }
        case "export": {
          const r = await app.downloadFile({
            contents: [{ type: "resource", resource: { uri: `file:///${a.filename}`, mimeType: "text/csv", text: a.csv } }],
          });
          return r.isError ? { ok: false, error: "Download blev afvist" } : { ok: true };
        }
        case "fullscreen": {
          const next = ctx?.displayMode === "fullscreen" ? "inline" : "fullscreen";
          await app.requestDisplayMode({ mode: next });
          return { ok: true };
        }
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    } finally {
      setLoading(false);
    }
  };

  const insets = ctx?.safeAreaInsets;
  const style = { paddingTop: insets?.top, paddingRight: insets?.right, paddingBottom: insets?.bottom, paddingLeft: insets?.left };
  const theme = ctx?.theme === "dark" ? "dark" : "light";

  if (connectError) return <div className="boot">Kunne ikke forbinde til værten: {connectError.message}</div>;
  if (error && !current) {
    return (
      <div className="lasso-root" data-theme={theme} style={style}>
        <div className="lasso-frame">
          <div className="lasso-state lasso-state--error" role="alert">
            <div className="lasso-state__title">Kunne ikke vise data</div>
            <div className="lasso-small">{error}</div>
          </div>
        </div>
      </div>
    );
  }
  if (!current) {
    return (
      <div className="lasso-root" data-theme={theme} style={style}>
        <div className="lasso-frame">
          <div className="lasso-frame__header">
            <LassoMark className="lasso-logo" />
            <div className="lasso-frame__titles">
              <h1 className="lasso-frame__title">{pendingTitle ?? "Lasso"}</h1>
              <div className="lasso-frame__meta">Henter data…</div>
            </div>
          </div>
          <div className="lasso-card">
            <div className="lasso-skeleton" style={{ width: "70%" }} />
            <div className="lasso-skeleton" style={{ width: "45%", marginTop: 10 }} />
          </div>
        </div>
      </div>
    );
  }

  const canFullscreen = ctx?.availableDisplayModes?.includes("fullscreen") ?? false;
  return (
    <div style={style}>
      <LassoView
        key={stack.length}
        spec={current.spec}
        dataset={current.dataset}
        url={current.url}
        loading={loading || current.dataset === null}
        theme={theme}
        savePrefix="…/v/"
        host={{
          prompt: true,
          save: true,
          refine: true,
          drillDown: true,
          back: stack.length > 1,
          refresh: true,
          export: true,
          fullscreen: canFullscreen,
        }}
        onAction={onAction}
      />
    </div>
  );
}
