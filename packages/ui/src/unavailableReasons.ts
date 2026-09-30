/**
 * Årsager til "ikke tilgængelig"/låst, identiske med register.liveNote i packages/spec/src/catalog.ts
 * (LassoScoreGauge, LassoScoreHistory, LassoLivestock, LassoKeyFigureGauge). VM'erne har intet felt, der
 * skiller abonnements- og modulårsager fra andre "unavailable"; komponenterne matcher derfor på
 * teksten (serverens SCORE_LOCKED_REASON og livestock.unavailableReason bærer samme tekst).
 */
export const SCORE_SUBSCRIPTION_REASON = "Kræver Creditsafe-abonnement. Score og kreditvurdering vises, når Creditsafe er tilføjet Lasso-abonnementet.";
export const LIVESTOCK_MODULE_REASON = "Kræver Ejendomme-modulet i Lasso-abonnementet";
export const NO_BENCHMARK_REASON = "Lasso har ingen branchetal for virksomhedens branche endnu.";

/** Abonnementsårsag for score: præcis teksten, eller alt der begynder med "Kræver Creditsafe-abonnement". */
export const isScoreSubscriptionReason = (reason?: string): boolean => Boolean(reason && reason.startsWith("Kræver Creditsafe-abonnement"));
export const isModuleReason = (reason?: string): boolean => Boolean(reason && reason.startsWith("Kræver Ejendomme-modulet"));
