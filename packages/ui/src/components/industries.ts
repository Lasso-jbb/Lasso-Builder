/**
 * Branchetræ til branchevælgeren (katalog 02a.12): sektion → hovedgruppe → kode (DB07, 6 cifre).
 * Dette er et UDSNIT af DB07 til eksempler, tests og som standard, indtil værten leverer hele
 * træet (FilterPanel `industryTree`). Endepunktet for hele træet er ikke bekræftet.
 */
export interface TreeNode {
  /** Kode: sektionsbogstav, 2-cifret hovedgruppe eller 6-cifret branchekode. */
  code: string;
  label: string;
  children?: readonly TreeNode[];
}

export const DB07_EXCERPT: readonly TreeNode[] = [
  {
    code: "F",
    label: "Bygge- og anlægsvirksomhed",
    children: [
      { code: "41", label: "Opførelse af bygninger", children: [
        { code: "411000", label: "Gennemførelse af byggeprojekter" },
        { code: "412000", label: "Opførelse af bygninger" },
      ] },
      { code: "43", label: "Specialiserede bygge- og anlægsaktiviteter", children: [
        { code: "432100", label: "El-installation" },
        { code: "432200", label: "VVS- og blikkenslagerforretninger" },
        { code: "433200", label: "Tømrer- og bygningssnedkervirksomhed" },
      ] },
    ],
  },
  {
    code: "G",
    label: "Handel",
    children: [
      { code: "47", label: "Detailhandel", children: [
        { code: "471110", label: "Supermarkeder" },
        { code: "471120", label: "Discountforretninger" },
      ] },
    ],
  },
  {
    code: "I",
    label: "Hoteller og restauranter",
    children: [
      { code: "56", label: "Restaurationsvirksomhed", children: [
        { code: "561010", label: "Restauranter" },
        { code: "561020", label: "Pizzeriaer, grillbarer, isbarer mv." },
        { code: "563000", label: "Serveringssteder" },
      ] },
    ],
  },
  {
    code: "J",
    label: "Information og kommunikation",
    children: [
      { code: "62", label: "It-konsulenter mv.", children: [
        { code: "620100", label: "Computerprogrammering" },
        { code: "620200", label: "Konsulentbistand vedrørende informationsteknologi" },
        { code: "620900", label: "Andre serviceydelser inden for informationsteknologi" },
      ] },
      { code: "63", label: "Informationstjenester", children: [
        { code: "631100", label: "Databehandling, webhosting og lignende serviceydelser" },
      ] },
    ],
  },
  {
    code: "K",
    label: "Finansiering og forsikring",
    children: [
      { code: "64", label: "Pengeinstitut- og finansieringsvirksomhed", children: [
        { code: "642020", label: "Finansielle holdingselskaber" },
        { code: "642120", label: "Ikke-finansielle holdingselskaber" },
      ] },
    ],
  },
  {
    code: "M",
    label: "Videnservice",
    children: [
      { code: "69", label: "Juridisk bistand, bogføring og revision", children: [
        { code: "691000", label: "Juridisk bistand" },
        { code: "692000", label: "Bogføring og revision; skatterådgivning" },
      ] },
      { code: "70", label: "Hovedsæders virksomhed og virksomhedsrådgivning", children: [
        { code: "701000", label: "Hovedsæders virksomhed" },
        { code: "702200", label: "Virksomhedsrådgivning og anden rådgivning om driftsledelse" },
      ] },
      { code: "71", label: "Arkitekter og rådgivende ingeniører", children: [
        { code: "711100", label: "Arkitektvirksomhed" },
        { code: "711200", label: "Rådgivende ingeniørvirksomhed" },
      ] },
    ],
  },
];

/** Alle blade (6-cifrede koder) under en knude, eller knuden selv. */
export function leafCodes(node: TreeNode): string[] {
  return node.children?.length ? node.children.flatMap(leafCodes) : [node.code];
}

/** Opslag kode → navn for alle knuder i træet. */
export function treeLabels(tree: readonly TreeNode[]): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (n: TreeNode) => {
    out.set(n.code, n.label);
    n.children?.forEach(walk);
  };
  tree.forEach(walk);
  return out;
}
