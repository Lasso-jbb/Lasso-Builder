import { isSet, type Config } from "../config.js";

export type QueryValue = string | number | boolean | undefined;
export type Query = Record<string, QueryValue>;

export class LassoApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    public readonly url: string,
  ) {
    super(`Lasso API svarede ${status} på ${url}`);
    this.name = "LassoApiError";
  }
}

export interface SearchParams {
  query: string;
  type?: "all" | "company" | "person";
  pageSize?: number;
  page?: number;
  extended?: boolean;
  lookupWeb?: boolean;
  personStatus?: string;
  companyStatus?: string;
}

/** Body til POST /modules/relations/graph (ejergrafen). */
export interface RelationsGraphParams {
  ids: string[];
  relationTypes?: string[];
  enrichments?: string[];
  ingoingDepth: number;
  outgoingDepth: number;
  /** ÅÅÅÅ-MM-DD; udelades for i dag. */
  onDate?: string;
}

export interface ContactParams {
  contacts?: boolean;
  emails?: boolean;
  phonenumbers?: boolean;
  links?: boolean;
}

interface CacheEntry {
  expires: number;
  value: Promise<unknown>;
}

/**
 * Tynd klient over Lassos API. Returnerer rå JSON; oversættelsen til vores
 * datamodeller sker i adapters.ts. Endpoints: docs/lasso-endpoints.md.
 */
export class LassoClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly authQuery: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly ttlMs: number;
  private readonly cache = new Map<string, CacheEntry>();
  /** Klient til søge-endpoints, når de ligger på et andet miljø med egen nøgle (LASSO_SEARCH_API_*). */
  private readonly searchClient: LassoClient;

  constructor(config: Config) {
    this.baseUrl = config.LASSO_API_BASE_URL.replace(/\/+$/, "");
    this.timeoutMs = config.LASSO_API_TIMEOUT_MS;
    this.ttlMs = config.LASSO_CACHE_TTL_SECONDS * 1000;
    this.authQuery = authQuery(config);
    this.headers = { Accept: "application/json", ...(Object.keys(this.authQuery).length ? {} : authHeaders(config)) };
    this.searchClient = isSet(config.LASSO_SEARCH_API_TOKEN)
      ? new LassoClient({
          ...config,
          LASSO_API_BASE_URL: config.LASSO_SEARCH_API_BASE_URL,
          LASSO_API_TOKEN: config.LASSO_SEARCH_API_TOKEN,
          LASSO_API_TOKEN_HEADER: config.LASSO_SEARCH_API_TOKEN_HEADER.trim() || config.LASSO_API_TOKEN_HEADER,
          LASSO_API_TIMEOUT_MS: config.LASSO_SEARCH_API_TIMEOUT_MS,
          LASSO_API_TOKEN_QUERY: "",
          LASSO_API_USERNAME: "",
          LASSO_API_PASSWORD: "",
          LASSO_SEARCH_API_TOKEN: "",
        })
      : this;
  }

  /** Om søgningen har sin egen nøgle (og dermed kører mod LASSO_SEARCH_API_BASE_URL). */
  get hasSearchCredentials(): boolean {
    return this.searchClient !== this;
  }

  get hasCredentials(): boolean {
    return Object.keys(this.headers).length > 1 || Object.keys(this.authQuery).length > 0;
  }

  /** GET mod en sti under base-URL'en. Svar caches kort (LASSO_CACHE_TTL_SECONDS). */
  async get<T = unknown>(path: string, query: Query = {}): Promise<T> {
    const url = new URL(path.replace(/^\/+/, ""), `${this.baseUrl}/`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const key = url.toString();
    for (const [k, v] of Object.entries(this.authQuery)) url.searchParams.set(k, v);
    const now = Date.now();
    const hit = this.cache.get(key);
    if (hit && hit.expires > now) return hit.value as Promise<T>;

    const value = this.fetchJson(url);
    if (this.ttlMs > 0) {
      this.cache.set(key, { expires: now + this.ttlMs, value });
      value.catch(() => this.cache.delete(key));
      if (this.cache.size > 2000) this.prune(now);
    }
    return value as Promise<T>;
  }

  /** POST med JSON-body. Caches som GET, med body som del af nøglen. */
  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const url = new URL(path.replace(/^\/+/, ""), `${this.baseUrl}/`);
    const json = JSON.stringify(body);
    const key = `POST ${url} ${json}`;
    for (const [k, v] of Object.entries(this.authQuery)) url.searchParams.set(k, v);
    const now = Date.now();
    const hit = this.cache.get(key);
    if (hit && hit.expires > now) return hit.value as Promise<T>;
    const value = this.fetchJson(url, { method: "POST", body: json, headers: { ...this.headers, "Content-Type": "application/json" } });
    if (this.ttlMs > 0) {
      this.cache.set(key, { expires: now + this.ttlMs, value });
      value.catch(() => this.cache.delete(key));
    }
    return value as Promise<T>;
  }

  /** Fejlfinding: kalder uden cache og uden at kaste, og giver status og starten af svaret. */
  async tryRequest(method: "GET" | "POST", path: string, body?: unknown, maxChars = 300): Promise<{ status: number; body: string }> {
    const url = new URL(path.replace(/^\/+/, ""), `${this.baseUrl}/`);
    for (const [k, v] of Object.entries(this.authQuery)) url.searchParams.set(k, v);
    try {
      const res = await fetch(url, {
        method,
        headers: { ...this.headers, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return { status: res.status, body: (await res.text()).slice(0, maxChars) };
    } catch (err) {
      return { status: 0, body: err instanceof Error ? err.message : String(err) };
    }
  }

  private async fetchJson(url: URL, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(url, { headers: this.headers, ...init, signal: AbortSignal.timeout(this.timeoutMs) });
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!res.ok) throw new LassoApiError(res.status, body, redact(url));
    return body;
  }

  private prune(now: number) {
    for (const [k, v] of this.cache) if (v.expires <= now) this.cache.delete(k);
  }

  search(p: SearchParams) {
    return this.get("data/cvr/search", {
      query: p.query,
      type: p.type ?? "all",
      pageSize: p.pageSize ?? 20,
      page: p.page ?? 1,
      extended: p.extended ?? false,
      lookupWeb: p.lookupWeb ?? true,
      personStatus: p.personStatus ?? "all",
      companyStatus: p.companyStatus ?? "active",
    });
  }

  /** Lassos AI-søgning: fritekst -> liste af filtre (POST /apps/search/query/prompt). */
  searchPrompt(prompt: string) {
    return this.searchClient.post("apps/search/query/prompt", { Prompt: prompt });
  }

  /** Virksomheder, der matcher filtrene fra searchPrompt (POST /apps/search/lassoid). */
  searchByFilters(filters: unknown, orderBy?: string, extra: Record<string, unknown> = {}) {
    return this.searchClient.post("apps/search/lassoid", { filters, ...(orderBy ? { OrderBy: orderBy } : {}), ...extra });
  }

  company(lassoId: string) {
    return this.get(enc(lassoId));
  }
  reports(lassoId: string) {
    return this.get(`${enc(lassoId)}/reports/advanced`);
  }
  tinglysning(lassoId: string) {
    return this.get(`data/tinglysning/${enc(lassoId)}`);
  }
  ejf(lassoId: string) {
    return this.get(`data/ejf/${enc(lassoId)}/ownerships/current`);
  }
  websites(lassoId: string) {
    return this.get(`data/websites/${enc(lassoId)}`);
  }
  valuations(lassoId: string) {
    return this.get(`modules/valuations/${enc(lassoId)}`);
  }
  observations(lassoId: string) {
    return this.get(`modules/observations/${enc(lassoId)}`);
  }
  /** Ubekræftet form; se docs/lasso-endpoints.md under "Ubekræftet". */
  ownersBeneficial(lassoId: string) {
    return this.get(`${enc(lassoId)}/owners/beneficial`);
  }
  /** Nyheder (docs.lassox.com/data-apis/paqle/). */
  news(lassoId: string, cToken?: string) {
    return this.get(`data/paqle/${enc(lassoId)}/news`, { cToken });
  }

  /** Ejergrafen i flere lag (POST /modules/relations/graph). Svarformen er ubekræftet, se docs/lasso-endpoints.md. */
  relationsGraph(p: RelationsGraphParams) {
    return this.post("modules/relations/graph", {
      ids: p.ids,
      relationTypes: p.relationTypes ?? ["ownership"],
      enrichments: p.enrichments ?? ["companyinfo"],
      ingoingDepth: p.ingoingDepth,
      outgoingDepth: p.outgoingDepth,
      ...(p.onDate ? { onDate: p.onDate } : {}),
    });
  }
  contacts(lassoId: string, p: ContactParams = { contacts: true }) {
    return this.get(`apps/contacts/${enc(lassoId)}/data`, { ...p });
  }
  bbrSummary(propertyNumber: string | number, municipality: string | number) {
    return this.get("data/bbr/property/summary", { propertynumber: propertyNumber, municipality });
  }
  /**
   * Katalog 20, CHR. UBEKRÆFTET: intet CHR-endpoint er fundet i docs.lassox.com
   * under dette arbejde. Stien er et gæt (samme mønster som de øvrige
   * `modules/*`-endpoints) og kaldes ikke fra `LiveProvider`, før den er
   * bekræftet. Se docs/lasso-endpoints.md, afsnittet "Ubekræftet".
   */
  chr(lassoId: string) {
    return this.get(`modules/chr/${enc(lassoId)}`);
  }
}

function enc(segment: string): string {
  return encodeURIComponent(segment);
}

/** Fjerner auth-parametre fra en URL, før den logges eller vises. */
function redact(url: URL): string {
  const u = new URL(url.toString());
  for (const k of [...u.searchParams.keys()]) if (/key|code|token|secret|password/i.test(k)) u.searchParams.set(k, "***");
  return u.toString();
}

function authQuery(config: Config): Record<string, string> {
  if (isSet(config.LASSO_API_TOKEN) && config.LASSO_API_TOKEN_QUERY.trim()) {
    return { [config.LASSO_API_TOKEN_QUERY.trim()]: config.LASSO_API_TOKEN.trim() };
  }
  return {};
}

export function authHeaders(config: Config): Record<string, string> {
  if (isSet(config.LASSO_API_TOKEN)) {
    const header = config.LASSO_API_TOKEN_HEADER.trim() || "Authorization";
    const token = config.LASSO_API_TOKEN.trim();
    const value = header.toLowerCase() === "authorization" ? `${config.LASSO_API_AUTH_SCHEME.trim()} ${token}`.trim() : token;
    return { [header]: value };
  }
  if (isSet(config.LASSO_API_USERNAME) && isSet(config.LASSO_API_PASSWORD)) {
    const raw = `${config.LASSO_API_USERNAME.trim()}:${config.LASSO_API_PASSWORD.trim()}`;
    return { Authorization: `Basic ${Buffer.from(raw, "utf8").toString("base64")}` };
  }
  return {};
}

/**
 * Beskriver strukturen af et svar uden værdier (kun nøgler og typer), så den
 * kan logges sikkert og bruges til at tilpasse adapters.
 */
export function describeShape(value: unknown, depth = 3): unknown {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return depth > 0 ? [describeShape(value[0], depth - 1), `…${value.length}`] : `array(${value.length})`;
  }
  if (typeof value === "object") {
    if (depth <= 0) return "object";
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 40)) out[k] = describeShape(v, depth - 1);
    return out;
  }
  return typeof value;
}

/**
 * Afprøver de mest almindelige login-former mod ét endpoint og returnerer kun
 * HTTP-status pr. variant (aldrig værdier). Bruges ved opstart, når det
 * konfigurerede login giver 401/403, så man kan se i loggen, hvad Lasso forventer.
 */
export async function probeAuthVariants(config: Config, path: string, query: Query): Promise<Record<string, number | string>> {
  const base = config.LASSO_API_BASE_URL.replace(/\/+$/, "");
  const user = config.LASSO_API_USERNAME.trim();
  const pass = config.LASSO_API_PASSWORD.trim();
  const token = isSet(config.LASSO_API_TOKEN) ? config.LASSO_API_TOKEN.trim() : "";
  const secrets: [string, string][] = [];
  if (isSet(pass)) secrets.push(["password", pass]);
  if (token) secrets.push(["token", token]);
  if (isSet(user)) secrets.push(["username", user]);

  const variants: { name: string; headers?: Record<string, string>; query?: Record<string, string> }[] = [];
  if (isSet(user) && isSet(pass)) variants.push({ name: "basic(username:password)", headers: { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` } });
  for (const [label, secret] of secrets) {
    variants.push({ name: `bearer(${label})`, headers: { Authorization: `Bearer ${secret}` } });
    variants.push({ name: `header x-api-key(${label})`, headers: { "x-api-key": secret } });
    variants.push({ name: `header Ocp-Apim-Subscription-Key(${label})`, headers: { "Ocp-Apim-Subscription-Key": secret } });
    variants.push({ name: `header lasso-api-key(${label})`, headers: { "lasso-api-key": secret } });
    variants.push({ name: `query apikey(${label})`, query: { apikey: secret } });
    variants.push({ name: `query code(${label})`, query: { code: secret } });
  }

  const out: Record<string, number | string> = {};
  for (const v of variants) {
    const url = new URL(path.replace(/^\/+/, ""), `${base}/`);
    for (const [k, val] of Object.entries(query)) if (val !== undefined) url.searchParams.set(k, String(val));
    for (const [k, val] of Object.entries(v.query ?? {})) url.searchParams.set(k, val);
    try {
      const res = await fetch(url, { headers: { Accept: "application/json", ...(v.headers ?? {}) }, signal: AbortSignal.timeout(10_000) });
      out[v.name] = res.status;
      await res.body?.cancel().catch(() => {});
    } catch (err) {
      out[v.name] = err instanceof Error ? err.name : "fejl";
    }
  }
  return out;
}
