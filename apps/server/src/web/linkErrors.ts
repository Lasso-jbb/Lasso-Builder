import type { Response } from "express";
import { injectBoot } from "./page.js";

/**
 * Fejlsiderne for de hostede sider (/k/, /p/, /e/, /v/) og deres PDF-varianter (.pdf): samme status og
 * samme tekst, uanset om brugeren åbnede siden eller bad om PDF'en.
 */
export const failPage = (res: Response, html: string, status: number, message: string) =>
  void res.status(status).type("html").set("X-Robots-Tag", "noindex").send(injectBoot(html, { mode: "web", error: message }, "Lasso"));

export const linkFailure = (reason: "invalid" | "expired", expired: string) =>
  reason === "expired" ? { status: 410, message: `Linket er udløbet. ${expired}` } : { status: 403, message: "Linket er ugyldigt. Brug linket fra Claude, som det er." };

export const ASK_AGAIN = (what: string) => `Spørg Claude om ${what} igen for at få et nyt link.`;

export const FROM_LIST = "Åbn siden igen fra dine gemte sider i Claude (\"mine gemte sider\") for at få et nyt link.";

/** Gemte visninger (/v/): findes ikke, eller lavet med spec v1. */
export const VIEW_MISSING = "Visningen findes ikke eller er slettet.";
export const VIEW_OUTDATED = "Visningen er lavet med en ældre version af Lasso og kan ikke vises længere. Bed Claude om at lave den igen, og gem den på ny.";
