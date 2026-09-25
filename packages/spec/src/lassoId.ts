/**
 * Lasso-ID'er for virksomheder har formen "CVR-1-<cvr>". Modellen må sende
 * både et Lasso-ID og et rent 8-cifret CVR-nummer; vi normaliserer her.
 */
export const DEFAULT_COMPANY_PREFIX = "CVR-1-";

export function toLassoId(ref: string, companyPrefix = DEFAULT_COMPANY_PREFIX): string {
  const trimmed = ref.trim();
  const digits = trimmed.replace(/[\s-]/g, "");
  if (/^\d{8}$/.test(digits) && !/^[A-Za-z]/.test(trimmed)) return `${companyPrefix}${digits}`;
  return trimmed;
}

/** Udtrækker CVR-nummeret fra et Lasso-ID, hvis muligt. */
export function cvrFromLassoId(lassoId: string): string | null {
  const m = /(\d{8})$/.exec(lassoId.trim());
  return m ? m[1]! : null;
}
