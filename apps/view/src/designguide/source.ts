/**
 * Designguidens to datakilder:
 *  - `SOURCE`: kildeudtrækket fra koden, lavet ved build (scripts/designguide-source.ts): tokens, tekster,
 *    kildefiler pr. modul, reglerne i docs/design og galleriets demodata.
 *  - `boot`: de rigtige data fra serveren (/designguide), samme live-data som /komponenter.
 */
import type { ComponentType, Dataset, ShowcaseAlternatives, ShowcaseTab, PortalPage, ViewComponent, ViewSpec } from "@lasso/spec";
import raw from "./generated/source.json";

export interface Token {
  name: string;
  light: string;
  dark?: string;
  comment?: string;
  group: string;
  line: number;
}

export interface SourceText {
  t: string;
  f: string;
  l: number;
  k: "jsx" | "attr" | "str";
  a?: string;
}

export interface Source {
  generatedAt: string;
  commit: string;
  stylesLines: number;
  tokens: Token[];
  texts: SourceText[];
  componentFiles: Record<string, string[]>;
  errPrefixes: Record<string, string[]>;
  docs: { file: string; title: string; markdown: string }[];
  gallery: { data: Record<string, Dataset>; problems: string[] };
}

export const SOURCE = raw as unknown as Source;

/** Samme form som serverens ShowcaseBoot (apps/server/src/web/showcase.ts). */
export interface ShowcaseData {
  generatedAt: string;
  version?: string;
  tabs: (ShowcaseTab & { dataset: Dataset })[];
  alt: ShowcaseAlternatives & { dataset: Dataset };
  portal: { company: string; name: string; pages: (PortalPage & { dataset: Dataset })[] };
}

/** Samme form som serverens DesignguideBoot (apps/server/src/web/designguide.ts). */
export interface DesignguideBoot {
  mode: "designguide";
  version: string;
  source: string;
  showcase: ShowcaseData;
  focuses: { company: readonly string[]; person: readonly string[] };
  /** Fiktive data til alle moduler (demodata), til moduler uden rigtige data. */
  fictive?: { items: { type: ComponentType; label: string; component: ViewComponent }[]; dataset: Dataset };
  /** Om det kræver en nøgle at skrive kommentarer. */
  comments?: { keyRequired: boolean };
}

export interface LivePage {
  spec: ViewSpec;
  dataset: Dataset;
}

/** Hele sider (show_company/show_person pr. fokus) hentes efter behov og huskes, mens siden er åben. */
const pageCache = new Map<string, Promise<LivePage>>();
export function fetchPage(kind: "company" | "person", focus: string): Promise<LivePage> {
  const key = `${kind}:${focus}`;
  let p = pageCache.get(key);
  if (!p) {
    p = fetch(`/designguide/side.json?kind=${kind}&focus=${encodeURIComponent(focus)}`).then(async (r) => {
      const body = (await r.json()) as LivePage & { error?: string };
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      return body;
    });
    p.catch(() => pageCache.delete(key));
    pageCache.set(key, p);
  }
  return p;
}
