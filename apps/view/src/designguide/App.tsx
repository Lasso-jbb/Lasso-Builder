import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LassoMark } from "@lasso/ui";
import { buildModules, ReportsProvider, type ModuleInfo } from "./modules.js";
import { ENTRIES, boards } from "./gallery.js";
import { SOURCE, type DesignguideBoot } from "./source.js";
import { BOARD_TITLES, FOUNDATION, GALLERY_SECTIONS, moduleGroups, slugOf } from "./structure.js";
import { HomePage } from "./pages/Home.js";
import { FoundationPage, TokensPage } from "./pages/Foundation.js";
import { BoardPage } from "./pages/Board.js";
import { ModulesPage } from "./pages/Modules.js";
import { ModulePage } from "./pages/Module.js";
import { CHAT_DOC, ChatPage } from "./pages/Chat.js";
import { PORTAL_DOC, PortalFramePage } from "./pages/PortalFrame.js";
import { LivePagesPage } from "./pages/LivePages.js";
import { TextsPage } from "./pages/Texts.js";
import { ValidationPage } from "./pages/Validation.js";
import { DocPage } from "./pages/Doc.js";
import { CommentsPage } from "./pages/Comments.js";
import { CommentButton, CommentsProvider, useComments } from "./comments.js";
import type { ComponentType } from "@lasso/spec";

export type Theme = "light" | "dark";

export interface Ctx {
  boot: DesignguideBoot;
  modules: Map<ComponentType, ModuleInfo>;
  theme: Theme;
  go: (path: string) => void;
}

/** Adressen er #/sti?fane=…, så hver side og fane kan deles som link. */
function useRoute(): [string, URLSearchParams] {
  const read = () => {
    const h = location.hash.replace(/^#\/?/, "");
    const [path = "", q = ""] = h.split("?");
    return [decodeURIComponent(path), new URLSearchParams(q)] as [string, URLSearchParams];
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      if (!location.hash.includes("?")) window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

function usePrefersDark(): boolean {
  const q = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setDark(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return dark;
}

interface NavItem {
  path: string;
  label: string;
  count?: number;
  children?: NavItem[];
}

function navTree(modules: Map<ComponentType, ModuleInfo>): { title: string; items: NavItem[] }[] {
  const b = boards();
  const boardItems = (re: RegExp) => b.filter((x) => re.test(x)).map((x) => ({ path: `galleri/${x}`, label: `${x} ${BOARD_TITLES[x] ?? ""}`.trim() }));
  const covered = GALLERY_SECTIONS.map((s) => s.boards);
  const otherBoards = b.filter((x) => x !== "01" && x !== "01b" && !covered.some((re) => re.test(x)));
  return [
    { title: "Kom i gang", items: [{ path: "", label: "Oversigt" }, { path: "principper", label: "Principper og regler" }, ...SOURCE.docs.slice(1).filter((d) => d.file !== PORTAL_DOC && d.file !== CHAT_DOC).map((d) => ({ path: `dokumenter/${slugOf(d.file.split("/").pop()!.replace(/\.md$/, ""))}`, label: d.title }))] },
    { title: "Portalen", items: [{ path: "portal", label: "Portalens ramme" }, { path: "chat", label: "Chatten" }] },
    { title: "Fundament", items: [...FOUNDATION.map((f) => ({ path: `fundament/${f.id}`, label: f.label })), { path: "fundament/tokens", label: "Alle tokens", count: SOURCE.tokens.length }] },
    {
      title: "Moduler",
      items: [
        { path: "moduler", label: "Alle moduler", count: modules.size },
        ...moduleGroups().map((g) => ({ path: `moduler?gruppe=${g.id}`, label: g.label, count: g.types.length, children: g.types.map((t) => ({ path: `moduler/${slugOf(t)}`, label: modules.get(t)?.title ?? t })) })),
      ],
    },
    ...GALLERY_SECTIONS.map((s) => ({ title: s.label, items: [...boardItems(s.boards), ...(s.id === "moenstre" ? [{ path: "sider", label: "Hele sider med live-data" }] : [])] })),
    ...(otherBoards.length ? [{ title: "Øvrige tavler", items: otherBoards.map((x) => ({ path: `galleri/${x}`, label: `${x} ${BOARD_TITLES[x] ?? ""}`.trim() })) }] : []),
    { title: "Indhold og kvalitet", items: [{ path: "tekster", label: "Tekster", count: SOURCE.texts.length }, { path: "validering", label: "Validering" }, { path: "kommentarer", label: "Kommentarer" }] },
  ];
}

/* ---------- Søgning ---------- */

interface Hit {
  kind: string;
  label: string;
  sub?: string;
  path: string;
}

function searchIndex(modules: Map<ComponentType, ModuleInfo>): Hit[] {
  const hits: Hit[] = [];
  for (const m of modules.values()) hits.push({ kind: "Modul", label: `${m.n} ${m.title}`, sub: `${m.type}: ${m.catalog.register?.formaal ?? ""}`, path: `moduler/${slugOf(m.type)}` });
  for (const t of SOURCE.tokens) hits.push({ kind: "Token", label: t.name, sub: `${t.light}${t.comment ? `, ${t.comment}` : ""}`, path: `fundament/tokens?q=${encodeURIComponent(t.name)}` });
  ENTRIES.forEach((e) => {
    const board = (e.sortAs ?? e.nr).split(".")[0]!;
    hits.push({ kind: "Element", label: `${e.nr} ${e.title}`, sub: BOARD_TITLES[board], path: `galleri/${board}?e=${encodeURIComponent(e.nr)}` });
  });
  for (const d of SOURCE.docs) for (const m of d.markdown.matchAll(/^#{2,3}\s+(.+)$/gm)) hits.push({ kind: "Regel", label: m[1]!, sub: d.title, path: d.file.endsWith("README.md") ? "principper" : d.file === PORTAL_DOC ? "portal" : d.file === CHAT_DOC ? "chat" : `dokumenter/${slugOf(d.file.split("/").pop()!.replace(/\.md$/, ""))}` });
  return hits;
}

function Search({ modules, go }: { modules: Map<ComponentType, ModuleInfo>; go: (p: string) => void }) {
  const index = useMemo(() => searchIndex(modules), [modules]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  const needle = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!needle) return [];
    const words = needle.split(/\s+/);
    const found = index.filter((h) => words.every((w) => `${h.label} ${h.sub ?? ""}`.toLowerCase().includes(w)));
    const texts = SOURCE.texts.filter((t) => words.every((w) => t.t.toLowerCase().includes(w))).slice(0, 8);
    return [...found.slice(0, 24), ...texts.map((t) => ({ kind: "Tekst", label: t.t, sub: `${t.f.split("/").pop()}:${t.l}`, path: `tekster?q=${encodeURIComponent(t.t)}` }))];
  }, [needle, index]);
  const pick = (h: Hit) => {
    go(h.path);
    setOpen(false);
    setQ("");
    input.current?.blur();
  };
  return (
    <div className="dg-search">
      <svg className="dg-search__icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        ref={input}
        value={q}
        placeholder="Søg i moduler, tokens, elementer, regler og tekster"
        aria-label="Søg i designguiden"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(results.length - 1, a + 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
          else if (e.key === "Enter" && results[active]) pick(results[active]!);
          else if (e.key === "Escape") input.current?.blur();
        }}
      />
      <kbd className="dg-search__kbd">⌘K</kbd>
      {open && needle ? (
        <div className="dg-search__results" role="listbox">
          {results.length ? (
            results.map((h, i) => (
              <button key={`${h.kind}${h.path}${i}`} role="option" aria-selected={i === active} className="dg-search__hit" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)} onMouseEnter={() => setActive(i)}>
                <span className="dg-search__kind">{h.kind}</span>
                <span className="dg-search__label">{h.label}</span>
                {h.sub ? <span className="dg-search__sub">{h.sub}</span> : null}
              </button>
            ))
          ) : (
            <div className="dg-search__none">Intet fundet for "{q}".</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Skallen ---------- */

function Nav({ tree, path, onNavigate }: { tree: ReturnType<typeof navTree>; path: string; onNavigate: () => void }) {
  const isOn = (p: string) => p === path;
  return (
    <nav className="dg-nav" aria-label="Designguiden">
      {tree.map((section) => (
        <div key={section.title} className="dg-nav__section">
          <div className="dg-nav__title">{section.title}</div>
          {section.items.map((it) => {
            const open = it.children?.some((c) => c.path === path);
            return (
              <div key={it.path}>
                <a href={`#/${it.path}`} className={`dg-nav__link${isOn(it.path) || open ? " is-on" : ""}`} aria-current={isOn(it.path) ? "page" : undefined} onClick={onNavigate}>
                  <span>{it.label}</span>
                  {it.count != null ? <span className="dg-nav__count">{it.count}</span> : null}
                </a>
                {open && it.children ? (
                  <div className="dg-nav__children">
                    {it.children.map((c) => (
                      <a key={c.path} href={`#/${c.path}`} className={`dg-nav__sublink${c.path === path ? " is-on" : ""}`} aria-current={c.path === path ? "page" : undefined} onClick={onNavigate}>
                        {c.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function App({ boot }: { boot: DesignguideBoot }) {
  const [path, query] = useRoute();
  const prefersDark = usePrefersDark();
  const [themePref, setThemePref] = useState<"system" | Theme>(() => {
    try {
      return (localStorage.getItem("dg-theme") as "system" | Theme) || "system";
    } catch {
      return "system";
    }
  });
  const theme: Theme = themePref === "system" ? (prefersDark ? "dark" : "light") : themePref;
  const [menu, setMenu] = useState(false);
  const modules = useMemo(() => buildModules(boot), [boot]);
  const tree = useMemo(() => navTree(modules), [modules]);
  const go = (p: string) => (location.hash = `#/${p}`);
  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    document.body.style.background = theme === "dark" ? "#101114" : "#ffffff";
  }, [theme]);
  const setTheme = (t: "system" | Theme) => {
    setThemePref(t);
    try {
      localStorage.setItem("dg-theme", t);
    } catch {
      /* privat vindue */
    }
  };
  const ctx: Ctx = { boot, modules, theme, go };

  let page: ReactNode;
  const [head, rest] = [path.split("/")[0], path.split("/").slice(1).join("/")];
  if (!path) page = <HomePage ctx={ctx} />;
  else if (path === "principper") page = <DocPage ctx={ctx} file="docs/design/README.md" />;
  else if (head === "dokumenter") page = <DocPage ctx={ctx} file={SOURCE.docs.find((d) => slugOf(d.file.split("/").pop()!.replace(/\.md$/, "")) === rest)?.file ?? ""} />;
  else if (path === "fundament/tokens") page = <TokensPage ctx={ctx} query={query.get("q") ?? ""} />;
  else if (head === "fundament") page = <FoundationPage ctx={ctx} id={rest} />;
  else if (head === "galleri") page = <BoardPage ctx={ctx} board={rest} focus={query.get("e") ?? undefined} />;
  else if (path === "moduler") page = <ModulesPage ctx={ctx} group={query.get("gruppe") ?? undefined} />;
  else if (head === "moduler") {
    const m = [...modules.values()].find((x) => slugOf(x.type) === rest);
    page = m ? <ModulePage key={m.type} ctx={ctx} module={m} tab={query.get("fane") ?? "bredder"} /> : <NotFound />;
  } else if (path === "sider") page = <LivePagesPage ctx={ctx} kind={query.get("type") === "person" ? "person" : "company"} focus={query.get("fokus") ?? "overblik"} />;
  else if (path === "portal") page = <PortalFramePage ctx={ctx} />;
  else if (path === "chat") page = <ChatPage ctx={ctx} />;
  else if (path === "tekster") page = <TextsPage ctx={ctx} query={query.get("q") ?? ""} file={query.get("fil") ?? ""} />;
  else if (path === "validering") page = <ValidationPage ctx={ctx} />;
  else if (path === "kommentarer") page = <CommentsPage ctx={ctx} />;
  else page = <NotFound />;

  const when = new Date(boot.showcase.generatedAt).toLocaleString("da-DK", { dateStyle: "medium", timeStyle: "short" });
  return (
    <CommentsProvider keyRequired={boot.comments?.keyRequired ?? false} theme={theme}>
    <ReportsProvider>
      <div className="dg lasso-root" data-theme={theme}>
        <header className="dg-top">
          <button className="dg-top__menu" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <a href="#/" className="dg-brand">
            <LassoMark className="dg-brand__mark" />
            <span className="dg-brand__name">Lasso</span>
            <span className="dg-brand__sub">Designguide</span>
          </a>
          <Search modules={modules} go={go} />
          <div className="dg-top__right">
            <CommentToggle />
            <span className={`dg-source dg-source--${boot.source}`} title={`Data hentet ${when}`}>
              <span className="dg-source__dot" aria-hidden="true" />
              {boot.source === "live" ? "Live-data" : "Demodata"}
            </span>
            <div className="dg-seg" role="group" aria-label="Tema">
              {(["light", "dark", "system"] as const).map((t) => (
                <button key={t} className={themePref === t ? "is-on" : ""} aria-pressed={themePref === t} onClick={() => setTheme(t)}>
                  {{ light: "Lys", dark: "Mørk", system: "Auto" }[t]}
                </button>
              ))}
            </div>
          </div>
        </header>
        <div className="dg-body">
          <aside className={`dg-side${menu ? " is-open" : ""}`}>
            <Nav tree={tree} path={path} onNavigate={() => setMenu(false)} />
            <div className="dg-side__foot">
              Bygget fra koden {new Date(SOURCE.generatedAt).toLocaleString("da-DK", { dateStyle: "medium", timeStyle: "short" })}
              {SOURCE.commit || boot.version ? `, version ${boot.version !== "lokal" ? boot.version : SOURCE.commit}` : ""}.
            </div>
          </aside>
          <main className="dg-main" key={path}>
            <div className="dg-pagecomment">
              <CommentButton target={{ target: `sti:${path}${path === "fundament/tokens" || path === "tekster" ? "" : query.toString() ? `?${query}` : ""}`, label: `Siden #/${path || ""}${path ? "" : " (oversigten)"}`, context: { kind: "sti", ref: `#/${path}` } }} />
            </div>
            {page}
          </main>
        </div>
      </div>
    </ReportsProvider>
    </CommentsProvider>
  );
}

/** Kommentartilstand: klik på en ramme sætter en nål. Viser antallet af åbne kommentarer. */
function CommentToggle() {
  const { mode, setMode, comments } = useComments();
  const open = comments.filter((c) => c.status === "aaben").length;
  return (
    <button className={`dg-ctoggle${mode ? " is-on" : ""}`} aria-pressed={mode} onClick={() => setMode(!mode)} title={mode ? "Slå kommentering fra" : "Klik på moduler, elementer og sider for at kommentere"}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M5 5h14v10H10l-4 4v-4H5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      {mode ? "Kommenterer" : "Kommentér"}
      {open ? <span className="dg-ctoggle__n">{open}</span> : null}
    </button>
  );
}

function NotFound() {
  return (
    <div className="dg-page">
      <h1 className="dg-h1">Siden findes ikke</h1>
      <p className="dg-lead">
        Adressen peger ikke på noget i designguiden. <a href="#/">Gå til oversigten</a>.
      </p>
    </div>
  );
}
