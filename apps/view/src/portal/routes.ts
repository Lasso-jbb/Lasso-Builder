import { FOCUSES, isPersonFocus, type Focus, type PersonFocus } from "@lasso/spec";

/**
 * Portalens hash-ruter (docs/portal.md), så tilbage/frem og genindlæsning virker:
 *
 *   #/search?q=…                 søgning (tom = ny søgning)
 *   #/company/CVR-1-…?focus=…    virksomhed med et af de otte fokus (standard overblik)
 *   #/person/CVR-3-…?focus=…     person med et af de seks personfokus (standard overblik, som
 *                                udelades i adressen, så ældre links er de samme)
 *   #/saved                      gemte sider
 *
 * Alt andet (også en tom hash) er en ny søgning. Rent modul uden DOM, så det kan testes i node.
 */
export type PortalRoute =
  | { kind: "search"; q: string }
  | { kind: "saved" }
  | { kind: "company"; id: string; focus: Focus }
  | { kind: "person"; id: string; focus: PersonFocus };

export function isFocus(value: string | null | undefined): value is Focus {
  return typeof value === "string" && (FOCUSES as readonly string[]).includes(value);
}

function decode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

/** "#/company/CVR-1-12345678?focus=oekonomi" → { kind: "company", id, focus }. Ukendt → søgning. */
export function portalRoute(hash: string): PortalRoute {
  const raw = hash.replace(/^#/, "").replace(/^\/+/, "");
  const at = raw.indexOf("?");
  const path = at >= 0 ? raw.slice(0, at) : raw;
  const params = new URLSearchParams(at >= 0 ? raw.slice(at + 1) : "");
  const [head = "", ...rest] = path.split("/");
  const id = decode(rest[0] ?? "").trim();
  switch (head) {
    case "search":
      return { kind: "search", q: (params.get("q") ?? "").trim() };
    case "saved":
      return { kind: "saved" };
    case "company": {
      if (!id) break;
      const focus = params.get("focus");
      return { kind: "company", id, focus: isFocus(focus) ? focus : "overblik" };
    }
    case "person": {
      if (!id) break;
      const focus = params.get("focus");
      return { kind: "person", id, focus: isPersonFocus(focus) ? focus : "overblik" };
    }
  }
  return { kind: "search", q: "" };
}

/** Modsat portalRoute: den hash, en rute står som i adresselinjen. */
export function formatRoute(route: PortalRoute): string {
  switch (route.kind) {
    case "search":
      return route.q ? `#/search?q=${encodeURIComponent(route.q)}` : "#/search";
    case "saved":
      return "#/saved";
    case "company":
      return `#/company/${encodeURIComponent(route.id)}?focus=${route.focus}`;
    case "person":
      return `#/person/${encodeURIComponent(route.id)}${route.focus && route.focus !== "overblik" ? `?focus=${route.focus}` : ""}`;
  }
}

export function sameRoute(a: PortalRoute, b: PortalRoute): boolean {
  return formatRoute(a) === formatRoute(b);
}

/** Hvilke data en fane viser. Skifter nøglen (ny søgning, nyt fokus), hentes der igen. */
export function dataKey(route: PortalRoute): string {
  return formatRoute(route);
}
