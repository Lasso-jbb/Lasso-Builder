import type { BalanceSheetYear, CashFlowYear, FinancialStatementsVM, IncomeStatementYear } from "@lasso/spec";
import type { StatementRow, StatementSection } from "./statementTable.js";

/**
 * Rækkerne i de tre fulde opgørelser (katalog 19), delt af LassoIncomeStatement, LassoBalanceSheet,
 * LassoCashFlow og den samlede LassoFinancialStatements (19.1), så posterne står ens overalt.
 */

/** Kvalitetsflag: en underpost, der ændrer sig mere end 10× fra året før (katalog 19-note). */
export function bigJumpFlag(prev: number | null | undefined, last: number | null | undefined): string | undefined {
  if (typeof prev !== "number" || typeof last !== "number" || prev === 0) return undefined;
  const ratio = Math.abs(last) / Math.abs(prev);
  if (ratio >= 10 || ratio <= 0.1) return "Mulig fejl i tallet. Værdien afviger mere end 10× fra forrige år. Kan være indberetningsfejl eller en reel ekstraordinær post.";
  return undefined;
}

/** 19.1 (Jakob): en post, som regnskabet ikke indeholder for nogen af de viste år, udelades (ingen tomme rækker). */
function present(rows: StatementRow[]): StatementRow[] {
  return rows.filter((r) => r.values.some((v) => typeof v === "number"));
}

/**
 * Resultatopgørelsen (19.1/19.2), fuldstændig: omsætning, vareforbrug og eksterne omkostninger,
 * bruttofortjeneste, personaleomkostninger, andre driftsomkostninger, EBITDA, af- og nedskrivninger,
 * resultat af primær drift (EBIT), finansielle indtægter og omkostninger (netto, når de ikke er opdelt),
 * resultat før skat, skat og årets resultat. Alle poster står (Jakob 01.10), også uden tal.
 */
export function incomeRows(shown: readonly IncomeStatementYear[]): StatementRow[] {
  const revenueTop = true;
  const split = shown.some((y) => y.financialIncome != null || y.financialExpenses != null);
  // Jakob 01.10 (19): en fuldendt resultatopgørelse; alle poster står, også dem regnskabet ikke oplyser ("Ikke oplyst").
  return ([
    ...(revenueTop
      ? [
          { key: "top", label: "Omsætning", values: shown.map((y) => y.revenue), kind: "subtotal" as const },
          { key: "external", label: "Vareforbrug og eksterne omkostninger", short: "Vareforbrug og ekst.", values: shown.map((y) => y.externalCosts) },
          { key: "gross", label: "Bruttofortjeneste", values: shown.map((y) => y.grossProfit), kind: "subtotal" as const },
        ]
      : [{ key: "top", label: "Bruttofortjeneste", values: shown.map((y) => y.grossProfit), kind: "subtotal" as const }]),
    { key: "staff", label: "Personaleomkostninger", short: "Personaleomk.", values: shown.map((y) => y.staffCosts) },
    { key: "other", label: "Andre driftsomkostninger", short: "Andre driftsomk.", values: shown.map((y) => y.otherOperatingCosts), flag: bigJumpFlag(shown.at(-2)?.otherOperatingCosts, shown.at(-1)?.otherOperatingCosts) },
    { key: "ebitda", label: "EBITDA", values: shown.map((y) => y.ebitda), kind: "subtotal" },
    { key: "depreciation", label: "Af- og nedskrivninger", short: "Af- og nedskr.", values: shown.map((y) => y.depreciation) },
    { key: "ebit", label: "Resultat af primær drift (EBIT)", short: "EBIT", values: shown.map((y) => y.ebit), kind: "subtotal" },
    ...(split
      ? [
          { key: "finIncome", label: "Finansielle indtægter", short: "Fin. indtægter", values: shown.map((y) => y.financialIncome) },
          { key: "finExpenses", label: "Finansielle omkostninger", short: "Fin. omkostninger", values: shown.map((y) => y.financialExpenses) },
        ]
      : [{ key: "financial", label: "Finansielle poster, netto", short: "Finansielle poster", values: shown.map((y) => y.financialItemsNet) }]),
    { key: "pretax", label: "Resultat før skat", values: shown.map((y) => y.profitBeforeTax), kind: "subtotal" },
    { key: "tax", label: "Skat af årets resultat", values: shown.map((y) => y.tax) },
    { key: "profit", label: "Årets resultat", values: shown.map((y) => y.profit), kind: "bottom" },
  ]);
}

const BALANCE_MISMATCH = "Aktiver i alt og passiver i alt matcher ikke. Balancen bør altid gå op; tjek de underliggende regnskabstal.";

/**
 * Balancen (19.1/19.4), fuldstændig: immaterielle, materielle og finansielle anlægsaktiver, anlægsaktiver
 * i alt, varebeholdninger, tilgodehavender, likvide beholdninger, omsætningsaktiver i alt, aktiver i alt;
 * egenkapital, hensatte forpligtelser, langfristet og kortfristet gæld, passiver i alt. Poster uden tal udelades.
 */
export function balanceSections(shown: readonly BalanceSheetYear[]): StatementSection[] {
  const last = shown.at(-1);
  const mismatch =
    last && typeof last.assetsTotal === "number" && typeof last.liabilitiesAndEquityTotal === "number" && Math.abs(last.assetsTotal - last.liabilitiesAndEquityTotal) > 1 ? BALANCE_MISMATCH : undefined;
  return [
    {
      heading: "AKTIVER",
      rows: present([
        { key: "intangible", label: "Immaterielle anlægsaktiver", values: shown.map((y) => y.intangibleAssets) },
        { key: "tangible", label: "Materielle anlægsaktiver", values: shown.map((y) => y.tangibleAssets) },
        { key: "financialFixed", label: "Finansielle anlægsaktiver", values: shown.map((y) => y.financialFixedAssets) },
        { key: "fixedTotal", label: "Anlægsaktiver i alt", values: shown.map((y) => y.fixedAssetsTotal), kind: "subtotal" },
        { key: "inventories", label: "Varebeholdninger", values: shown.map((y) => y.inventories) },
        { key: "tradeReceivables", label: "Tilgodehavender fra salg", values: shown.map((y) => y.tradeReceivables) },
        { key: "otherReceivables", label: "Andre tilgodehavender og periodeafgrænsning", values: shown.map((y) => y.otherReceivables) },
        { key: "cash", label: "Likvide beholdninger", values: shown.map((y) => y.cash) },
        { key: "currentTotal", label: "Omsætningsaktiver i alt", values: shown.map((y) => y.currentAssetsTotal), kind: "subtotal" },
        { key: "assetsTotal", label: "Aktiver i alt", values: shown.map((y) => y.assetsTotal), kind: "bottom", flag: mismatch },
      ]),
    },
    {
      heading: "PASSIVER",
      rows: present([
        { key: "shareCapital", label: "Selskabskapital", values: shown.map((y) => y.shareCapital) },
        { key: "retainedEarnings", label: "Overført resultat", values: shown.map((y) => y.retainedEarnings) },
        { key: "equityTotal", label: "Egenkapital i alt", values: shown.map((y) => y.equityTotal), kind: "subtotal" },
        { key: "provisions", label: "Hensatte forpligtelser", values: shown.map((y) => y.provisions), kind: "subtotal" },
        { key: "longTerm", label: "Langfristet gæld", values: shown.map((y) => y.longTermLiabilities) },
        { key: "shortTerm", label: "Kortfristet gæld", values: shown.map((y) => y.shortTermLiabilities) },
        { key: "liabilitiesTotal", label: "Gæld i alt", values: shown.map((y) => y.liabilitiesTotal), kind: "subtotal" },
        { key: "liabAndEquityTotal", label: "Passiver i alt", values: shown.map((y) => y.liabilitiesAndEquityTotal), kind: "bottom", flag: mismatch },
      ]),
    },
  ];
}

const CASH_MISMATCH = "Likvider ultimo matcher ikke balancens likvide beholdninger for samme år.";

/** Pengestrømmen (19.1/19.5): drift, investering, finansiering, årets ændring i likvider og likvider ultimo; poster uden tal udelades. */
export function cashFlowRows(shown: readonly CashFlowYear[], statements: Pick<FinancialStatementsVM, "balanceSheet">): StatementRow[] {
  const balanceByYear = new Map(statements.balanceSheet.map((y) => [y.year, y.cash]));
  const last = shown.at(-1);
  const lastBalanceCash = last ? balanceByYear.get(last.year) : undefined;
  const mismatch = last && typeof last.cashEnding === "number" && typeof lastBalanceCash === "number" && Math.abs(last.cashEnding - lastBalanceCash) > 1 ? CASH_MISMATCH : undefined;
  return present([
    { key: "profit", label: "Årets resultat", values: shown.map((y) => y.profit) },
    { key: "depreciation", label: "Af- og nedskrivninger", values: shown.map((y) => y.depreciation) },
    { key: "workingCapital", label: "Ændring i driftskapital", values: shown.map((y) => y.workingCapitalChange) },
    { key: "operating", label: "Pengestrøm fra drift", values: shown.map((y) => y.operatingCashFlow), kind: "subtotal" },
    { key: "intangibleInvestments", label: "Køb af immaterielle aktiver", values: shown.map((y) => y.intangibleInvestments) },
    { key: "investing", label: "Pengestrøm fra investering", values: shown.map((y) => y.investingCashFlow), kind: "subtotal" },
    { key: "capitalIncrease", label: "Kapitalforhøjelse", values: shown.map((y) => y.capitalIncrease) },
    { key: "loanChange", label: "Optagelse / afdrag på lån", values: shown.map((y) => y.loanChange) },
    { key: "financing", label: "Pengestrøm fra finansiering", values: shown.map((y) => y.financingCashFlow), kind: "subtotal" },
    { key: "netCashFlow", label: "Årets ændring i likvider", values: shown.map((y) => y.netCashFlow), kind: "bottom" },
    { key: "cashBeginning", label: "Likvider primo", values: shown.map((y) => y.cashBeginning) },
    { key: "cashEnding", label: "Likvider ultimo", values: shown.map((y) => y.cashEnding), kind: "total", flag: mismatch },
  ]);
}

/** Tablet (26f.3): resultatopgørelsen i syv linjer med korte etiketter (uden andre driftsomk. og skat). */
export function incomeRowsCompact(shown: readonly IncomeStatementYear[]): StatementRow[] {
  const keep = new Set(["top", "staff", "ebitda", "depreciation", "financial", "pretax", "profit"]);
  // Tablet: finansielle poster samlet i én linje, selv når regnskabet opdeler dem.
  const full = incomeRows(shown);
  if (!full.some((r) => r.key === "financial") && shown.some((y) => y.financialItemsNet != null)) keep.add("financialNet");
  const net: StatementRow = { key: "financialNet", label: "Finansielle poster, netto", short: "Finansielle poster", values: shown.map((y) => y.financialItemsNet) };
  const rows = full.flatMap((r) => (r.key === "finIncome" ? [net] : [r]));
  return rows.filter((r) => keep.has(r.key));
}

/** Tablet (26f.3): balancen i syv linjer uden grupper: anlæg, omsætning, aktiver i alt, egenkapital, gæld, passiver i alt. */
export function balanceRowsCompact(shown: readonly BalanceSheetYear[]): StatementRow[] {
  return [
    { key: "fixedTotal", label: "Anlægsaktiver", values: shown.map((y) => y.fixedAssetsTotal) },
    { key: "currentTotal", label: "Omsætningsaktiver", values: shown.map((y) => y.currentAssetsTotal) },
    { key: "assetsTotal", label: "Aktiver i alt", values: shown.map((y) => y.assetsTotal), kind: "total" },
    { key: "equityTotal", label: "Egenkapital", values: shown.map((y) => y.equityTotal), kind: "total" },
    { key: "longTerm", label: "Langfristet gæld", values: shown.map((y) => y.longTermLiabilities) },
    { key: "shortTerm", label: "Kortfristet gæld", values: shown.map((y) => y.shortTermLiabilities) },
    { key: "liabAndEquityTotal", label: "Passiver i alt", values: shown.map((y) => y.liabilitiesAndEquityTotal ?? y.assetsTotal), kind: "bottom" },
  ];
}

/* ---------- Detaljeret regnskab (Jakob 01.10, modul 22) ---------- */

/** En sum med underposter; har en underpost et kvalitetsflag, står flaget også ved summen, så det ses foldet ind. */
const sub = (key: string, label: string, values: StatementRow["values"], children: StatementRow[], kind: StatementRow["kind"] = "subtotal"): StatementRow => {
  const kids = present(children);
  const flagged = kids.find((c) => c.flag);
  return { key, label, values, kind, children: kids, ...(flagged ? { flag: `${flagged.label}: ${flagged.flag}` } : {}) };
};

/**
 * Resultatopgørelsen struktureret som i et regnskab: summerne står fremme, og underposterne foldes ud ved
 * summen, hvor det giver mening (mindst to underposter med tal): bruttofortjeneste (omsætning, vareforbrug),
 * driftsomkostninger (personale, andre), finansielle poster (indtægter, omkostninger).
 */
export function incomeRowsDetailed(shown: readonly IncomeStatementYear[]): StatementRow[] {
  const v = (f: (y: IncomeStatementYear) => number | null | undefined) => shown.map(f);
  const opex = (y: IncomeStatementYear) => (y.staffCosts == null && y.otherOperatingCosts == null ? null : (y.staffCosts ?? 0) + (y.otherOperatingCosts ?? 0));
  const fin = (y: IncomeStatementYear) => y.financialItemsNet ?? (y.financialIncome == null && y.financialExpenses == null ? null : (y.financialIncome ?? 0) + (y.financialExpenses ?? 0));
  return [
    sub("gross", "Bruttofortjeneste", v((y) => y.grossProfit), [
      { key: "revenue", label: "Omsætning", values: v((y) => y.revenue) },
      { key: "external", label: "Vareforbrug og eksterne omkostninger", short: "Vareforbrug og ekst.", values: v((y) => y.externalCosts) },
    ]),
    sub("opex", "Driftsomkostninger", v(opex), [
      { key: "staff", label: "Personaleomkostninger", short: "Personaleomk.", values: v((y) => y.staffCosts) },
      { key: "other", label: "Andre driftsomkostninger", short: "Andre driftsomk.", values: v((y) => y.otherOperatingCosts), flag: bigJumpFlag(shown.at(-2)?.otherOperatingCosts, shown.at(-1)?.otherOperatingCosts) },
    ], "line"),
    { key: "ebitda", label: "EBITDA", values: v((y) => y.ebitda), kind: "subtotal" },
    { key: "depreciation", label: "Af- og nedskrivninger", short: "Af- og nedskr.", values: v((y) => y.depreciation) },
    { key: "ebit", label: "Resultat af primær drift (EBIT)", short: "EBIT", values: v((y) => y.ebit), kind: "subtotal" },
    sub("financial", "Finansielle poster, netto", v(fin), [
      { key: "finIncome", label: "Finansielle indtægter", short: "Fin. indtægter", values: v((y) => y.financialIncome) },
      { key: "finExpenses", label: "Finansielle omkostninger", short: "Fin. omkostninger", values: v((y) => y.financialExpenses) },
    ], "line"),
    { key: "pretax", label: "Resultat før skat", values: v((y) => y.profitBeforeTax), kind: "subtotal" },
    { key: "tax", label: "Skat af årets resultat", values: v((y) => y.tax) },
    { key: "profit", label: "Årets resultat", values: v((y) => y.profit), kind: "bottom" },
  ];
}

/** Balancen struktureret: anlægsaktiver, omsætningsaktiver, egenkapital og gæld med underposterne foldet ind. */
export function balanceSectionsDetailed(shown: readonly BalanceSheetYear[]): StatementSection[] {
  const flat = balanceSections(shown);
  const v = (f: (y: BalanceSheetYear) => number | null | undefined) => shown.map(f);
  const debt = (y: BalanceSheetYear) => y.liabilitiesTotal ?? (y.longTermLiabilities == null && y.shortTermLiabilities == null ? null : (y.longTermLiabilities ?? 0) + (y.shortTermLiabilities ?? 0));
  const mismatchA = flat[0]!.rows.find((r) => r.key === "assetsTotal")?.flag;
  const mismatchP = flat[1]!.rows.find((r) => r.key === "liabAndEquityTotal")?.flag;
  return [
    {
      heading: "AKTIVER",
      rows: [
        sub("fixedTotal", "Anlægsaktiver i alt", v((y) => y.fixedAssetsTotal), [
          { key: "intangible", label: "Immaterielle anlægsaktiver", values: v((y) => y.intangibleAssets) },
          { key: "tangible", label: "Materielle anlægsaktiver", values: v((y) => y.tangibleAssets) },
          { key: "financialFixed", label: "Finansielle anlægsaktiver", values: v((y) => y.financialFixedAssets) },
        ]),
        sub("currentTotal", "Omsætningsaktiver i alt", v((y) => y.currentAssetsTotal), [
          { key: "inventories", label: "Varebeholdninger", values: v((y) => y.inventories) },
          { key: "tradeReceivables", label: "Tilgodehavender fra salg", values: v((y) => y.tradeReceivables) },
          { key: "otherReceivables", label: "Andre tilgodehavender og periodeafgrænsning", values: v((y) => y.otherReceivables) },
          { key: "cash", label: "Likvide beholdninger", values: v((y) => y.cash) },
        ]),
        { key: "assetsTotal", label: "Aktiver i alt", values: v((y) => y.assetsTotal), kind: "bottom", flag: mismatchA },
      ],
    },
    {
      heading: "PASSIVER",
      rows: [
        sub("equityTotal", "Egenkapital i alt", v((y) => y.equityTotal), [
          { key: "shareCapital", label: "Selskabskapital", values: v((y) => y.shareCapital) },
          { key: "retainedEarnings", label: "Overført resultat", values: v((y) => y.retainedEarnings) },
        ]),
        ...present([{ key: "provisions", label: "Hensatte forpligtelser", values: v((y) => y.provisions), kind: "subtotal" }]),
        sub("liabilitiesTotal", "Gæld i alt", v(debt), [
          { key: "longTerm", label: "Langfristet gæld", values: v((y) => y.longTermLiabilities) },
          { key: "shortTerm", label: "Kortfristet gæld", values: v((y) => y.shortTermLiabilities) },
        ]),
        { key: "liabAndEquityTotal", label: "Passiver i alt", values: v((y) => y.liabilitiesAndEquityTotal), kind: "bottom", flag: mismatchP },
      ],
    },
  ];
}

/** Pengestrømmen struktureret: drift, investering og finansiering med underposterne foldet ind. */
export function cashFlowRowsDetailed(shown: readonly CashFlowYear[], statements: Pick<FinancialStatementsVM, "balanceSheet">): StatementRow[] {
  const flat = cashFlowRows(shown, statements);
  const v = (f: (y: CashFlowYear) => number | null | undefined) => shown.map(f);
  return [
    sub("operating", "Pengestrøm fra drift", v((y) => y.operatingCashFlow), [
      { key: "profit", label: "Årets resultat", values: v((y) => y.profit) },
      { key: "depreciation", label: "Af- og nedskrivninger", values: v((y) => y.depreciation) },
      { key: "workingCapital", label: "Ændring i driftskapital", values: v((y) => y.workingCapitalChange) },
    ]),
    sub("investing", "Pengestrøm fra investering", v((y) => y.investingCashFlow), [{ key: "intangibleInvestments", label: "Køb af immaterielle aktiver", values: v((y) => y.intangibleInvestments) }]),
    sub("financing", "Pengestrøm fra finansiering", v((y) => y.financingCashFlow), [
      { key: "capitalIncrease", label: "Kapitalforhøjelse", values: v((y) => y.capitalIncrease) },
      { key: "loanChange", label: "Optagelse / afdrag på lån", values: v((y) => y.loanChange) },
    ]),
    ...flat.filter((r) => ["netCashFlow", "cashBeginning", "cashEnding"].includes(r.key)),
  ];
}

const ratio = (a: number | null | undefined, b: number | null | undefined) => (typeof a === "number" && typeof b === "number" && b !== 0 ? (a / b) * 100 : null);

/**
 * Nøgletallene, der kan regnes ud af regnskabet (Jakob 01.10: "alle nøgletal der er tilgængelige"):
 * bruttomargin, overskudsgrad, afkastningsgrad, egenkapitalens forrentning, soliditetsgrad og likviditetsgrad.
 * Nøgletal uden tal i nogen af årene udelades.
 */
export function keyFigureRows(income: readonly IncomeStatementYear[], balance: readonly BalanceSheetYear[], years: readonly number[]): StatementRow[] {
  const inc = (y: number) => income.find((r) => r.year === y);
  const bal = (y: number) => balance.find((r) => r.year === y);
  const row = (key: string, label: string, f: (y: number) => number | null): StatementRow => ({ key, label, values: years.map(f), percent: true });
  return present([
    row("grossMargin", "Bruttomargin", (y) => ratio(inc(y)?.grossProfit, inc(y)?.revenue)),
    row("operatingMargin", "Overskudsgrad", (y) => ratio(inc(y)?.ebit, inc(y)?.revenue ?? inc(y)?.grossProfit)),
    row("roa", "Afkastningsgrad", (y) => ratio(inc(y)?.ebit, bal(y)?.assetsTotal)),
    row("roe", "Egenkapitalens forrentning", (y) => ratio(inc(y)?.profit, bal(y)?.equityTotal)),
    row("solvency", "Soliditetsgrad", (y) => ratio(bal(y)?.equityTotal, bal(y)?.assetsTotal)),
    row("liquidity", "Likviditetsgrad", (y) => ratio(bal(y)?.currentAssetsTotal, bal(y)?.shortTermLiabilities)),
  ]);
}
