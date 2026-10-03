import type { Dataset, Focus, PersonFocus, SavedPageKind, ViewSpec } from "@lasso/spec";
import type { Visibility } from "@lasso/ui";
import type { PortalUser } from "../boot.js";
import { filenameFromDisposition, pdfErrorText, type FetchedPdf } from "../pdfDownload.js";

/**
 * Klient til portal-API'et (docs/portal.md). Samme origin, session-cookien sendes med
 * (credentials: same-origin), og alle kald, der ikke er GET, sender CSRF-headeren
 * `x-lasso-portal: 1`. 401 betyder, at sessionen er udløbet: klienten kalder onUnauthorized
 * (appen viser login-siden) og kaster en PortalApiError. Andre fejl kastes med serverens
 * `{ error }` som tekst.
 */
export const PORTAL_API = "/api/portal";
export const CSRF_HEADER = "x-lasso-portal";
export const LOGGED_OUT = "Du er logget ud. Log ind igen.";

/** Svar fra search, company, person, resolve og pages: samme form som MCP-tools. */
export interface ViewResult {
  spec: ViewSpec;
  dataset: Dataset;
  note?: string;
  /** Signeret /e/-side (kun company og person). */
  link?: string;
  /** Resumé af det viste som tekst (kun company og person): chattens kontekst for "det, brugeren ser". */
  summary?: string;
}

/** GET /lookup: søgefeltets resultater (Lassos navnesøgning). */
export interface LookupResult {
  q: string;
  companies: { lassoId: string; name: string; cvr?: string; city?: string; status?: string; statusKind?: "active" | "inactive" | "warning" }[];
  persons: { lassoId: string; name: string; city?: string }[];
}

export interface SavePageResult {
  lassoId: string;
  kind: SavedPageKind;
  name: string;
  cvr?: string;
  savedAt: string;
  created: boolean;
  total: number;
  url: string;
}

export interface RemovePageResult {
  lassoId: string;
  removed: boolean;
  total: number;
}

export interface SaveViewResult {
  url: string;
  org: string;
  slug: string;
  version: number;
  name: string;
  visibility: Visibility;
}

/**
 * En egen side (sideskabelon): en side, chatten satte sammen om én virksomhed/person, gemt uden entiteten og bundet til
 * slagsen (docs/chat.md, "Tilføj som fane"). Den vises som et ekstra modul på alle virksomheder/personer af slagsen.
 */
export interface PageTemplate {
  id: string;
  kind: "company" | "person";
  title: string;
  subtitle?: string;
}

/** POST /templates: den viste spec, titlen og den entitet, specen er lavet til (serveren erstatter den med en pladsholder). */
export interface SaveTemplateBody {
  kind: "company" | "person";
  title: string;
  subtitle?: string;
  spec: ViewSpec;
  entity: { kind: "company" | "person"; id: string };
}

export class PortalApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PortalApiError";
    this.status = status;
  }
}

export function isUnauthorized(e: unknown): boolean {
  return e instanceof PortalApiError && e.status === 401;
}

/**
 * Om "Prøv igen" giver mening: netværksfejl (status 0 eller en anden fejl end serverens) og serverfejl (5xx). En 4xx
 * (fx 400 "Siden indeholder stadig navnet; omdøb den først.") fejler igen på samme måde, så den står uden "Prøv igen".
 */
export function retryable(e: unknown): boolean {
  if (!(e instanceof PortalApiError)) return true;
  return e.status === 0 || e.status >= 500;
}

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

type Method = "GET" | "POST" | "DELETE";

function query(params: Record<string, string | number | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") s.set(k, String(v));
  const text = s.toString();
  return text ? `?${text}` : "";
}

export function createPortalApi(onUnauthorized: () => void, fetcher: typeof fetch = (...args) => fetch(...args)) {
  async function call<T>(method: Method, path: string, body?: unknown, { session = true }: { session?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (method !== "GET") headers[CSRF_HEADER] = "1";
    if (body !== undefined) headers["content-type"] = "application/json";
    let res: Response;
    try {
      res = await fetcher(`${PORTAL_API}${path}`, {
        method,
        credentials: "same-origin",
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new PortalApiError(0, "Serveren kunne ikke nås. Tjek forbindelsen, og prøv igen.");
    }
    const json = (await res.json().catch(() => null)) as (Record<string, unknown> & { error?: unknown }) | null;
    if (res.status === 401 && session) {
      onUnauthorized();
      throw new PortalApiError(401, LOGGED_OUT);
    }
    if (!res.ok) {
      const text = typeof json?.error === "string" && json.error ? json.error : `Serveren svarede med fejl ${res.status}.`;
      throw new PortalApiError(res.status, text);
    }
    if (json === null) throw new PortalApiError(res.status, "Tomt svar fra serveren.");
    return json as T;
  }

  /**
   * "Gem som PDF" (/api/portal/pdf/*): samme session og CSRF-regler som resten, men svaret er en
   * PDF-fil (blob) med filnavnet fra Content-Disposition. GET kræver ingen CSRF-header; POST /spec gør.
   */
  async function pdf(path: string, body?: unknown): Promise<FetchedPdf> {
    const method = body === undefined ? "GET" : "POST";
    const headers: Record<string, string> = { accept: "application/pdf" };
    if (method !== "GET") headers[CSRF_HEADER] = "1";
    if (body !== undefined) headers["content-type"] = "application/json";
    let res: Response;
    try {
      res = await fetcher(`${PORTAL_API}/pdf${path}`, { method, credentials: "same-origin", headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new PortalApiError(0, "Serveren kunne ikke nås. Tjek forbindelsen, og prøv igen.");
    }
    if (res.status === 401) {
      onUnauthorized();
      throw new PortalApiError(401, LOGGED_OUT);
    }
    if (!res.ok) throw new PortalApiError(res.status, pdfErrorText(res.status, await res.json().catch(() => null)));
    return { blob: await res.blob(), filename: filenameFromDisposition(res.headers.get("content-disposition")) ?? "Lasso.pdf" };
  }

  return {
    /** 401 her er forkert bruger/nøgle, ikke en udløbet session. */
    login: (user: string, key: string) => call<{ user: PortalUser }>("POST", "/login", { user, key }, { session: false }),
    logout: () => call<{ ok: true }>("POST", "/logout", undefined, { session: false }),
    me: () => call<{ user: PortalUser }>("GET", "/me", undefined, { session: false }),
    search: (q: string) => call<ViewResult>("GET", `/search${query({ query: q })}`),
    lookup: (q: string) => call<LookupResult>("GET", `/lookup${query({ q })}`),
    company: (ref: string, focus: Focus) => call<ViewResult>("GET", `/company/${encodeURIComponent(ref)}${query({ focus })}`),
    person: (ref: string, focus: PersonFocus = "overblik") => call<ViewResult>("GET", `/person/${encodeURIComponent(ref)}${query({ focus: focus === "overblik" ? undefined : focus })}`),
    resolve: (spec: ViewSpec) => call<ViewResult>("POST", "/resolve", { spec }),
    pages: (kind: SavedPageKind | "all" = "all", limit = 100) => call<ViewResult>("GET", `/pages${query({ kind, limit })}`),
    savePage: (body: { page: string; kind?: SavedPageKind; focus?: string; note?: string }) => call<SavePageResult>("POST", "/pages", body),
    removePage: (lassoId: string) => call<RemovePageResult>("DELETE", `/pages/${encodeURIComponent(lassoId)}`),
    /** Egne sider (sideskabeloner): hent, gem, fjern og vis om en bestemt virksomhed/person (spec, dataset og summary som et modul). */
    templates: {
      list: async (kind: "company" | "person"): Promise<PageTemplate[]> => (await call<{ templates: PageTemplate[] }>("GET", `/templates${query({ kind })}`)).templates,
      save: (body: SaveTemplateBody) => call<PageTemplate & { createdAt: string }>("POST", "/templates", body),
      remove: (id: string) => call<{ id: string; removed: true }>("DELETE", `/templates/${encodeURIComponent(id)}`),
      render: (id: string, entityId: string) => call<ViewResult>("GET", `/templates/${encodeURIComponent(id)}/render${query({ entity: entityId })}`),
    },
    saveView: (body: { spec: ViewSpec; name?: string; slug?: string; visibility?: Visibility }) => call<SaveViewResult>("POST", "/views", body),
    /** Virksomhedsrapporten (PDF) med fanens fokus (Creditsafe kun fra Risiko). */
    pdfCompany: (id: string, focus: Focus = "overblik") => pdf(`/company/${encodeURIComponent(id)}${query({ focus: focus === "overblik" ? undefined : focus })}`),
    /** Personsiden som PDF med fanens fokus. */
    pdfPerson: (id: string, focus: PersonFocus = "overblik") => pdf(`/person/${encodeURIComponent(id)}${query({ focus: focus === "overblik" ? undefined : focus })}`),
    /** Søgning og gemte sider: den viste spec som PDF. */
    pdfSpec: (spec: ViewSpec) => pdf("/spec", { spec }),
  };
}

export type PortalApi = ReturnType<typeof createPortalApi>;
