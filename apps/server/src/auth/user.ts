import type { Request } from "express";
import type { Config } from "../config.js";

export interface CurrentUser {
  id: string;
  name: string;
  org: string;
  isDemo: boolean;
}

/**
 * "Hvem er brugeren, og hvad må han se?" – ÉT sted.
 *
 * MVP: altid den hardcodede demobruger fra miljøvariablerne. Når Lasso ID
 * kobles på (OAuth 2.1 + PKCE), er det kun denne funktion, der ændres: læs
 * token fra requesten, slå brugeren op, og returnér hans id og organisation.
 */
export function getCurrentUser(_req: Request | undefined, config: Config): CurrentUser {
  return {
    id: config.DEMO_USER_ID,
    name: config.DEMO_USER_NAME,
    org: config.DEMO_ORG,
    isDemo: true,
  };
}
