// 26a.8 Formularfelter (mobil) og 26c.8 Filterark (mobil): tegnet med felt-komponenterne og Papers
// eksempeltekster. Indgangene står i e_layout.tsx (rækkefølgen); komponenterne her.
import { useState } from "react";
import type { Criterion, Operator } from "@lasso/spec";
import { ChoiceChips, DateInput, FieldRow, FilterSheet, FormPage, OperatorSelect, TagInput, ToggleField, UnitInput, type SheetField } from "@lasso/ui";

const noop = () => undefined;
const KOMMUNER = ["Aarhus", "Odense", "Aalborg", "Esbjerg", "Randers", "Kolding", "Vejle", "København"];
const REGIONER = ["Hovedstaden", "Sjælland", "Syddanmark", "Midtjylland", "Nordjylland"];

/** 26a.8: kriterierne som fuldskærmsside med feltnavn over feltet, 48 px felter og handlingslinjen som to knapper. */
export function MobileForm() {
  const [kommuner, setKommuner] = useState<string[]>(["Aarhus", "Odense"]);
  const [op, setOp] = useState<Operator>("gte");
  const [ansatte, setAnsatte] = useState("10");
  const [stiftet, setStiftet] = useState("01.01.2015");
  const [aktive, setAktive] = useState(true);
  const [region, setRegion] = useState<string[]>(["Hovedstaden"]);
  return (
    <FormPage title="Kriterier (5)" onBack={noop} action={{ label: "Vis 1.243", onClick: noop }}>
      <FieldRow label="Kommune" layout="form" active help="Vælg en eller flere. Tom = alle.">
        <TagInput values={kommuner} suggestions={KOMMUNER} onChange={setKommuner} morePlaceholder="" label="Kommune" />
      </FieldRow>
      <FieldRow label="Antal ansatte" layout="form">
        <OperatorSelect value={op} operators={["gte", "lte", "between"]} labels={{ gte: "Mindst", lte: "Højst", between: "Mellem" }} onChange={setOp} />
        <UnitInput value={ansatte} onChange={setAnsatte} label="Antal ansatte" />
      </FieldRow>
      <FieldRow label="Stiftet efter" layout="form" help="Åbner systemets datovælger.">
        <DateInput value={stiftet} onChange={setStiftet} label="Stiftet efter" />
      </FieldRow>
      <ToggleField label="Kun aktive virksomheder" on={aktive} onChange={setAktive} />
      <FieldRow label="Region" layout="form" pending={{ mode: "update", delta: 4120, onCancel: noop, onConfirm: noop }}>
        <ChoiceChips options={REGIONER} values={region} onChange={setRegion} label="Region" />
      </FieldRow>
    </FormPage>
  );
}

const SHEET_CRITERIA: Criterion[] = [
  { field: "status", operator: "eq", value: "aktiv" },
  { field: "region", operator: "in", value: ["Hovedstaden"] },
];

const SHEET: SheetField[] = [
  { key: "status", as: "chips", options: ["aktiv", "under konkurs", "under likvidation", "ophørt"] },
  { key: "region", as: "row" },
  { key: "bruttofortjeneste", as: "row" },
  { key: "risiko", as: "toggle", label: "Kun med risikoobservationer", def: { key: "risiko", label: "Kun med risikoobservationer", type: "boolean", control: "toggle", description: "Kun virksomheder med mindst én risikoobservation." } },
];

/** 26c.8: filterarket fra tabellens værktøjslinje (bundark). */
export function MobileFilterSheet() {
  return (
    <div style={{ minHeight: 800 }}>
      <FilterSheet open criteria={SHEET_CRITERIA} fields={SHEET} count={312} onApply={noop} onClose={noop} />
    </div>
  );
}
