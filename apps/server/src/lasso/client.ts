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
  private readonly timeoutMs: number;
  private readonly ttlMs: number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(config: Config) {
    this.baseUrl = config.LASSO_API_BASE_URL.replace(/\/+$/, "");
    this.timeoutMs = config.LASSO_API_TIMEOUT_MS;
    this.ttlMs = config.LASSO_CACHE_TTL_SECONDS * 1000;
    this.headers = { Accept: "application/json", ...authHeaders(config) };
  }

  get hasCredentials(): boolean {
    return Object.keys(this.headers).length > 1;
  }

  /** GET mod en sti under base-URL'en. Svar caches kort (LASSO_CACHE_TTL_SECONDS). */
  async get<T = unknown>(path: string, query: Query = {}): Promise<T> {
    const url = new URL(path.replace(/^\/+/, ""), `${this.baseUrl}/`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const key = url.toString();
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

  private async fetchJson(url: URL): Promise<unknown> {
    const res = await fetch(url, { headers: this.headers, signal: AbortSignal.timeout(this.timeoutMs) });
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!res.ok) throw new LassoApiError(res.status, body, url.toString());
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
  contacts(lassoId: string, p: ContactParams = { contacts: true }) {
    return this.get(`apps/contacts/${enc(lassoId)}/data`, { ...p });
  }
  bbrSummary(propertyNumber: string | number, municipality: string | number) {
    return this.get("data/bbr/property/summary", { propertynumber: propertyNumber, municipality });
  }
}

function enc(segment: string): string {
  return encodeURIComponent(segment);
}

function authHeaders(config: Config): Record<string, string> {
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
