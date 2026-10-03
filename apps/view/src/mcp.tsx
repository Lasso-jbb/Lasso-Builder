import { useCallback, useEffect, useRef, useState } from "react";
import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/client";
import { CardActions, LassoView, LassoMark, type ActionResult, type ViewAction } from "@lasso/ui";
import { composeCompany, composePerson, composeProbe, composePersonProbe, DATASET_META_KEY, formatCriterion, type Dataset, type ViewSpec } from "@lasso/spec";
import { focusPrompt } from "./focusPrompt.js";

/** Handlinger, der først skifter visningen til fuld skærm (se ensureFullscreen). */
const FULLSCREEN_FIRST = new Set<ViewAction["kind"]>(["prompt", "open-focus", "open-section", "open-company", "open-person", "set-criteria"]);
import { downloadPdfInHost } from "./pdfDownload.js";
import { linksOf, ShareView, type ViewLinks } from "./mcpLinks.js";

interface Screen {
  spec: ViewSpec;
  dataset: Dataset | null;
  url?: string;
  /** "Gem som PDF": serverens signerede .pdf-link til denne skærm (structuredContent.pdfLink). */
  pdfLink?: string;
  /** "Åben i Lasso" og "Del visning" (structuredContent.links); kun skærmen fra værktøjsresultatet har dem. */
  links?: ViewLinks;
}

function textOf(result: CallToolResult): string {
  return (result.content ?? [])
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

/** Gem-laget: læg et Lasso-ID til eller træk det fra datasættets savedIds (Gem/Gemt i hovedet). */
function withSaved(ds: Dataset, lassoId: string, saved: boolean): Dataset {
  const ids = new Set(ds.savedIds ?? []);
  if (saved) ids.add(lassoId);
  else ids.delete(lassoId);
  return { ...ds, savedIds: [...ids] };
}

/** Navnet på en virksomhed eller person i datasættet, også fra en liste over gemte sider. */
function nameIn(ds: Dataset | null | undefined, lassoId: string): string | undefined {
  if (!ds) return undefined;
  return (
    ds.companies[lassoId]?.name ??
    ds.persons[lassoId]?.name ??
    Object.values(ds.savedPages ?? {})
      .flatMap((l) => l.pages)
      .find((p) => p.lassoId === lassoId)?.name
  );
}

async function resolve(app: App, spec: ViewSpec): Promise<Screen> {
  const res = await app.callServerTool({ name: "resolve_view", arguments: { spec } });
  if (res.isError) throw new Error(textOf(res) || "Kunne ikke hente data");
  const sc = res.structuredContent as { spec: ViewSpec; dataset: Dataset; pdfLink?: string } | undefined;
  if (!sc) throw new Error("Tomt svar fra serveren");
  return { spec: sc.spec, dataset: sc.dataset, ...(sc.pdfLink ? { pdfLink: sc.pdfLink } : {}) };
}

/** MCP App: tegner tool-resultater i Claude/ChatGPT og håndterer interaktion uden model-tur. */
export function McpView() {
  const [stack, setStack] = useState<Screen[]>([]);
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<McpUiHostContext | undefined>();
  /** Smal iframe (telefon): handlingerne som på portalens mobilkort (ingen download, pillen som ikonknap). */
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth <= 560);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth <= 560);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const appRef = useRef<App | null>(null);

  const showResult = useCallback(async (result: CallToolResult) => {
    const app = appRef.current;
    setPendingTitle(null);
    if (result.isError) {
      setError(textOf(result) || "Værktøjet fejlede");
      return;
    }
    const sc = result.structuredContent as { spec?: ViewSpec; pdfLink?: string } | undefined;
    if (!sc?.spec) return;
    const ds = (result._meta as Record<string, unknown> | undefined)?.[DATASET_META_KEY] as Dataset | undefined;
    const links = linksOf(sc);
    /** Værktøjets eget pdfLink (med visningens fokus) og links følger skærmen. */
    const extra = { ...(sc.pdfLink ? { pdfLink: sc.pdfLink } : {}), ...(links ? { links } : {}) };
    setError(null);
    if (ds) {
      setStack([{ spec: sc.spec, dataset: ds, ...extra }]);
      return;
    }
    // Værten sendte ikke _meta med: hent data via det app-interne tool.
    setStack([{ spec: sc.spec, dataset: null, ...extra }]);
    if (!app) return;
    try {
      // Værktøjets eget pdfLink vinder over resolve_view's.
      setStack([{ ...(await resolve(app, sc.spec)), ...extra }]);
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
  // Gem-laget: savedIds opdateres på alle skærme i stakken, så Gem/Gemt også passer efter "tilbage".
  const patchSaved = (lassoId: string, saved: boolean) =>
    setStack((st) => st.map((s) => (s.dataset ? { ...s, dataset: withSaved(s.dataset, lassoId, saved) } : s)));

  // Jakob 30.09: brugeren skal over i fuld skærm. Et klik, der viser noget nyt (spørgsmål, fane, virksomhed,
  // person, filtre), skifter først til fuld skærm og udfører derefter handlingen. Downloads, links og gem gør ikke.
  const ensureFullscreen = async () => {
    if (!app || ctx?.displayMode === "fullscreen" || !ctx?.availableDisplayModes?.includes("fullscreen")) return;
    try {
      const res = await app.requestDisplayMode({ mode: "fullscreen" });
      const mode = (res as { mode?: McpUiHostContext["displayMode"] } | undefined)?.mode ?? "fullscreen";
      setCtx((prev) => ({ ...prev, displayMode: mode }));
    } catch {
      // Afviser værten fuld skærm, udføres handlingen alligevel.
    }
  };

  const onAction = async (a: ViewAction): Promise<ActionResult | void> => {
    if (!app) return { ok: false, error: "Ikke forbundet" };
    if (FULLSCREEN_FIRST.has(a.kind)) await ensureFullscreen();
    try {
      switch (a.kind) {
        case "prompt": {
          const r = await app.sendMessage({ role: "user", content: [{ type: "text", text: a.prompt }] });
          return r.isError ? { ok: false, error: "Værten afviste beskeden" } : { ok: true };
        }
        case "open-focus": {
          // Overblikkets "Se alle … i Historik": en besked til chatten ("Vis historik for X"), så
          // modellen viser fanen med show_company/show_person og kan svare på den.
          const text = current ? focusPrompt(current.spec, current.dataset, a.focus) : null;
          if (!text) return { ok: false, error: "Fanen findes ikke på denne side." };
          const r = await app.sendMessage({ role: "user", content: [{ type: "text", text }] });
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
          replaceTop({ spec: composeCompany(a.lassoId, ds, { focus: "overblik", name }), dataset: ds, pdfLink: fetched.pdfLink });
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
          replaceTop({ spec: composePerson(a.lassoId, ds, { name }), dataset: ds, pdfLink: fetched.pdfLink });
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
          // Opdatér: samme visning, så links (Åben i Lasso, Del visning) gælder stadig.
          replaceTop({ ...(await resolve(app, current.spec)), url: current.url, ...(current.links ? { links: current.links } : {}) });
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
        case "save-page": {
          // Gem-laget (docs/gem-lag.md): gem den viste virksomhed eller person på brugerens liste.
          const r = await app.callServerTool({
            name: "save_page",
            arguments: { page: a.lassoId, kind: a.pageKind, ...(a.focus ? { focus: a.focus } : {}) },
          });
          if (r.isError) return { ok: false, error: textOf(r) || "Siden kunne ikke gemmes" };
          patchSaved(a.lassoId, true);
          const name = (r.structuredContent as { name?: string } | undefined)?.name ?? a.name;
          void app
            .updateModelContext({ content: [{ type: "text", text: `Brugeren gemte ${name} (${a.lassoId}) på sin liste.` }] })
            .catch(() => {});
          return { ok: true, message: "Gemt på din liste" };
        }
        case "remove-saved-page": {
          const r = await app.callServerTool({ name: "remove_saved_page", arguments: { page: a.lassoId } });
          if (r.isError) return { ok: false, error: textOf(r) || "Siden kunne ikke fjernes" };
          const top = current;
          const name = nameIn(top?.dataset, a.lassoId) ?? a.lassoId;
          patchSaved(a.lassoId, false);
          void app
            .updateModelContext({ content: [{ type: "text", text: `Brugeren fjernede ${name} (${a.lassoId}) fra sin liste.` }] })
            .catch(() => {});
          // Viser skærmen listen over gemte sider, hentes den igen, så antal og rækker passer.
          if (top && top.spec.components.some((c) => c.type === "LassoSavedPages")) {
            setLoading(true);
            try {
              const fresh = await resolve(app, top.spec);
              setStack((st) => (st.at(-1)?.spec === top.spec ? [...st.slice(0, -1), { ...fresh, url: top.url }] : st));
            } catch {
              // Siden er fjernet; listen står med rækken som "fjernet", til den hentes igen.
            }
          }
          return { ok: true };
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
        case "pdf": {
          // "Gem som PDF": serveren laver filen; appen gemmer den gennem værten (pdfDownload.ts).
          if (!current?.pdfLink) return { ok: false, error: "Denne visning kan ikke gemmes som PDF." };
          return await downloadPdfInHost(app, current.pdfLink);
        }
        case "fullscreen": {
          const next = ctx?.displayMode === "fullscreen" ? "inline" : "fullscreen";
          const res = await app.requestDisplayMode({ mode: next });
          // Værten svarer med den tilstand, den faktisk valgte; så forsvinder "Vis i fuld skærm" med det samme.
          const mode = (res as { mode?: McpUiHostContext["displayMode"] } | undefined)?.mode ?? next;
          setCtx((prev) => ({ ...prev, displayMode: mode }));
          return { ok: true };
        }
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    } finally {
      setLoading(false);
    }
  };

  /** "Åben i Lasso": værtens åbn-link (MCP Apps ui/open-link); afviser værten, åbnes et nyt vindue. */
  const openInLasso = async (url: string) => {
    try {
      const r = await app?.openLink({ url });
      if (r && !r.isError) return;
    } catch {
      // Falder igennem til window.open.
    }
    window.open(url, "_blank", "noopener");
  };
  /** "Kopiér link": udklipsholderen i iframen; uden adgang returneres false, og linket markeres i stedet. */
  const copyLink = async (url: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
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
  const isFullscreen = ctx?.displayMode === "fullscreen";
  // Smagsprøvernes "Se alle … i Historik" sender en besked til chatten; kan værten ikke modtage
  // beskeder (ui/message), folder "Se alle" ud på stedet som før.
  const canMessage = Boolean(app?.getHostCapabilities()?.message);
  return (
    <div style={style}>
      {/* Samme handlinger som portalens chatkort (CardActions, Jakob 03.10): download (Gem som PDF), fuld skærm og
          "Åben i Lasso" som pille med Lasso-mærket; erstatter rammens udvid-ikon og "Gem som PDF". */}
      {current.pdfLink || (canFullscreen && !isFullscreen) || current.links?.open ? (
        <div className="lasso-root lasso-mcpbar" data-theme={theme}>
          <CardActions
            compact={narrow}
            onDownload={current.pdfLink ? () => void onAction({ kind: "pdf" }) : undefined}
            downloadLabel="Gem som PDF"
            onFullscreen={canFullscreen && !isFullscreen ? () => void onAction({ kind: "fullscreen" }) : undefined}
            primary={current.links?.open ? { label: "Åben i Lasso", icon: "mark", onClick: () => void openInLasso(current.links!.open!) } : undefined}
          />
        </div>
      ) : null}
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
          savePage: true,
          refine: true,
          drillDown: true,
          back: stack.length > 1,
          refresh: true,
          export: true,
          // PDF og fuld skærm står i CardActions øverst (ikke i visningens ramme).
          pdf: false,
          fullscreen: false,
          fullscreenActive: isFullscreen,
          minimalHead: true,
          openFocus: canMessage,
        }}
        onAction={onAction}
      />
      {current.links?.share ? (
        <div className="lasso-root" data-theme={theme}>
          <ShareView href={current.links.share} onCopy={copyLink} />
        </div>
      ) : null}
    </div>
  );
}
