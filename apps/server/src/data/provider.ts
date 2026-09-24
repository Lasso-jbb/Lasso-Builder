import type {
  CompanyVM,
  DataSourceKind,
  FinancialsVM,
  OwnershipVM,
  PersonRowVM,
  SearchQuery,
  SearchResultVM,
} from "@lasso/spec";

/**
 * Datalaget. Både MCP-tools og (senere) Lassos interne chat kalder de samme
 * funktioner. Ved flytning til Azure er det kun implementeringerne her, der
 * skiftes; spec og UI genbruges uændret.
 */
export interface DataProvider {
  readonly kind: DataSourceKind;
  search(query: SearchQuery): Promise<SearchResultVM>;
  company(lassoId: string): Promise<CompanyVM>;
  financials(lassoId: string): Promise<FinancialsVM>;
  people(lassoId: string): Promise<PersonRowVM[]>;
  ownership(lassoId: string): Promise<OwnershipVM>;
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
