import type { CompanyVM } from "./models.js";

/**
 * CVR-status (katalog 02c.8, 05.7, 28.1; Jakobs justering 29.09.2026). Alle 19 CVR-statusser står
 * som ren tekst i vægt 500 uden pille; farven følger ordet, og betydningen bæres altid af ordet
 * selv (regel 7). Fire farvegrupper:
 *
 * - "active"    Aktiv (tekstfarve): Aktiv, Normal.
 * - "temporary" Midlertidig, ikke krise (gul, warning-tekst): Fremtid, Uden retsvirkning,
 *               Under frivillig likvidation, Under reassumering.
 * - "problem"   Problem (rød, danger/mørk rød som konkurs): Under konkurs, Under tvangsopløsning,
 *               Under rekonstruktion, Tvangsopløst, Opløst efter konkurs.
 * - "inactive"  Inaktiv (som "Ophørt", muted): Ophørt, Opløst, Opløst efter erklæring, Opløst efter
 *               frivillig likvidation, Opløst efter fusion, Opløst efter grænseoverskridende fusion,
 *               Opløst efter spaltning, Slettet.
 */
export type StatusGroup = "active" | "temporary" | "problem" | "inactive";

/** De fire grupper med deres danske statusnavne i visningsrækkefølge (galleri 02c.8/05.7, dokumentation). */
export const STATUS_GROUPS: readonly { group: StatusGroup; title: string; statuses: readonly string[] }[] = [
  { group: "active", title: "Aktiv", statuses: ["Aktiv", "Normal"] },
  { group: "temporary", title: "Midlertidig, ikke krise", statuses: ["Fremtid", "Uden retsvirkning", "Under frivillig likvidation", "Under reassumering"] },
  { group: "problem", title: "Problem", statuses: ["Under konkurs", "Under tvangsopløsning", "Under rekonstruktion", "Tvangsopløst", "Opløst efter konkurs"] },
  {
    group: "inactive",
    title: "Inaktiv",
    statuses: ["Ophørt", "Opløst", "Opløst efter erklæring", "Opløst efter frivillig likvidation", "Opløst efter fusion", "Opløst efter grænseoverskridende fusion", "Opløst efter spaltning", "Slettet"],
  },
];

/** CVR's originalnavne (store bogstaver uden mellemrum) -> de danske navne. */
const CVR_CODES: Record<string, string> = {
  AKTIV: "Aktiv",
  NORMAL: "Normal",
  FREMTID: "Fremtid",
  UDENRETSVIRKNING: "Uden retsvirkning",
  UNDERFRIVILLIGLIKVIDATION: "Under frivillig likvidation",
  UNDERLIKVIDATION: "Under likvidation",
  UNDERREASSUMERING: "Under reassumering",
  UNDERREASUMMERING: "Under reassumering",
  UNDERREASUMERING: "Under reassumering",
  UNDERKONKURS: "Under konkurs",
  UNDERTVANGSOPLØSNING: "Under tvangsopløsning",
  UNDERREKONSTRUKTION: "Under rekonstruktion",
  TVANGSOPLØST: "Tvangsopløst",
  OPLØSTEFTERKONKURS: "Opløst efter konkurs",
  OPHØRT: "Ophørt",
  OPLØST: "Opløst",
  OPLØSTEFTERERKLÆRING: "Opløst efter erklæring",
  OPLØSTEFTERFRIVILLIGLIKVIDATION: "Opløst efter frivillig likvidation",
  OPLØSTEFTERFUSION: "Opløst efter fusion",
  OPLØSTEFTERGRÆNSEOVERSKRIDENDEFUSION: "Opløst efter grænseoverskridende fusion",
  OPLØSTEFTERSPALTNING: "Opløst efter spaltning",
  SLETTET: "Slettet",
};

const codeOf = (s: string) =>
  s
    .toUpperCase()
    .replace(/OE/g, "Ø")
    .replace(/AE/g, "Æ")
    .replace(/[^A-ZÆØÅ]/g, "");

/**
 * CVR-status som dansk navn: "OPLØSTEFTERKONKURS" -> "Opløst efter konkurs", "UNDERREASUMMERING" ->
 * "Under reassumering", "NORMAL" -> "Normal". Ukendte værdier vises uændret (trimmet).
 */
export function statusLabel(status: string): string;
export function statusLabel(status: string | undefined): string | undefined;
export function statusLabel(status: string | undefined): string | undefined {
  if (!status) return status;
  const t = status.trim();
  const hit = CVR_CODES[codeOf(t)];
  if (hit) return hit;
  return t;
}

/** Farvegruppen for en status (dansk navn eller CVR-kode). Ukendt værdi = ingen gruppe (vises neutralt). */
export function statusGroup(status: string | undefined): StatusGroup | undefined {
  if (!status) return undefined;
  const s = statusLabel(status).toLowerCase().replace(/\s+/g, " ").trim();
  // Problem testes først: "Opløst efter konkurs" og "Tvangsopløst" indeholder også "opløst".
  if (/konkurs|tvangsopløs|rekonstruktion|bankrupt|insolv/.test(s)) return "problem";
  if (/^(opløst|ophør|slettet|lukket|ceased|dissolved|inactive|closed)/.test(s)) return "inactive";
  if (/^fremtid|retsvirkning|likvid|reassum|reasum|liquidat/.test(s)) return "temporary";
  if (/^(aktiv|normal|active)/.test(s)) return "active";
  if (/^under /.test(s)) return "temporary";
  return undefined;
}

/**
 * CVR-status -> livsforløb i modellen (CompanyVM.statusKind). Samme klassificering for live-data
 * (apps/server/src/lasso/adapters.ts) og demodata. statusKind siger, om virksomheden er i drift
 * ("active"), i et forløb ("warning") eller afsluttet ("inactive"); farven bestemmes af
 * {@link statusGroup} (statusTone i packages/ui). "Opløst efter konkurs" er afsluttet (inactive),
 * men farves som problem.
 */
export function statusKind(status: string | undefined): CompanyVM["statusKind"] {
  const g = statusGroup(status);
  if (!g) return undefined;
  if (g === "active") return "active";
  if (g === "inactive") return "inactive";
  if (g === "problem" && /^opløst/i.test(statusLabel(status!))) return "inactive";
  return "warning";
}
