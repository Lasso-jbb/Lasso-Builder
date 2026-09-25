import type {
  BeneficialOwnershipVM,
  CompanyRowVM,
  CompanyVM,
  Criterion,
  DataSourceKind,
  FinancialsVM,
  NewsVM,
  OwnershipVM,
  PersonRowVM,
  SearchQuery,
  SearchResultVM,
  TextSectionsVM,
  TimelineVM,
} from "@lasso/spec";

/**
 * Datalaget. Både MCP-tools og (senere) Lassos interne chat kalder de samme
 * funktioner. Ved flytning til Azure er det kun implementeringerne her, der
 * skiftes; spec og UI genbruges uændret.
 */
export interface DataProvider {
  readonly kind: DataSourceKind;
  search(query: SearchQuery): Promise<SearchResultVM>;
  /** Lassos fortolkning af fritekst som kriterier (prompt-søgningen). null, hvis den ikke kan fortolkes. */
  interpret?(text: string): Promise<{ criteria: Criterion[]; unknown: string[] } | null>;
  /** Hurtigt navneopslag uden regnskabsberigelse (til show_company med et navn). */
  findCompanies(name: string, limit: number): Promise<CompanyRowVM[]>;
  company(lassoId: string): Promise<CompanyVM>;
  financials(lassoId: string): Promise<FinancialsVM>;
  people(lassoId: string): Promise<PersonRowVM[]>;
  ownership(lassoId: string): Promise<OwnershipVM>;
  beneficialOwnership(lassoId: string): Promise<BeneficialOwnershipVM>;
  textSections(lassoId: string): Promise<TextSectionsVM>;
  timeline(lassoId: string): Promise<TimelineVM>;
  news(lassoId: string, limit: number): Promise<NewsVM>;
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} blev ikke fundet`);
    this.name = "NotFoundError";
  }
}

/** Kører async-opgaver med et loft over samtidige kald. */
export async function mapLimit<T, R>(list: readonly T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}
