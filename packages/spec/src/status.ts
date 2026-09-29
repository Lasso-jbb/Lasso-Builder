import type { CompanyVM } from "./models.js";

/**
 * CVR-status -> farvegruppe (katalog 28.1 og 01 regel 1). Samme klassificering for live-data
 * (apps/server/src/lasso/adapters.ts) og demodata, så teksten altid kommer fra værdilisten og
 * farven fra gruppen.
 *
 * Afsluttede forløb ("Opløst efter konkurs", "Opløst efter frivillig likvidation", "Ophørt",
 * "Slettet") er inaktive og testes FØRST, fordi de også indeholder ord som "konkurs" og
 * "likvidation". Igangværende forløb ("Under konkurs", "Under frivillig likvidation", "Under
 * tvangsopløsning", "Tvangsopløst", "Under reassumering", "Under rekonstruktion") er advarsler.
 * Kun "Normal"/"Aktiv" er aktive; en ukendt værdi får ingen gruppe (vises neutralt).
 */
export function statusKind(status: string | undefined): CompanyVM["statusKind"] {
  if (!status) return undefined;
  const s = status.toLowerCase().trim();
  if (/^(opløst|ophør|slettet|lukket|ceased|dissolved|inactive|closed)/.test(s)) return "inactive";
  if (/konkurs|likvid|tvangs|rekonstruktion|reassum|bankrupt|liquidat|insolv|under /.test(s)) return "warning";
  if (/opløst|ophør|ceased|dissolved|slettet/.test(s)) return "inactive";
  if (/aktiv|normal|active/.test(s)) return "active";
  return undefined;
}
