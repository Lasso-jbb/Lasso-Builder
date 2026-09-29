/**
 * Use-cases delt af MCP-tools (mcp/server.ts) og portal-API'et (web/portalApi.ts), så svaret i
 * Claude og i browseren kommer fra samme kode (docs/portal.md).
 */
export { extrasOf, fail, type UseCaseCtx, type UseCaseError, type ViewData } from "./context.js";
export {
  compareCompanies,
  companyNameHints,
  criteriaError,
  lookupCompanyNames,
  renderView,
  resolveView,
  saveView,
  searchCompanies,
  searchPersons,
  showCompany,
  showPerson,
  type CompanyView,
  type CompareCompaniesInput,
  type PersonView,
  type SavedViewResult,
  type SaveViewInput,
  type SearchInput,
  type SearchPersonsInput,
  type ShowCompanyInput,
} from "./views.js";
export {
  listSavedPages,
  removeSavedPage,
  savePage,
  type ListSavedPagesInput,
  type RemovedPageResult,
  type SavedPageResult,
  type SavePageInput,
  type SavePageOutcome,
} from "./pages.js";
