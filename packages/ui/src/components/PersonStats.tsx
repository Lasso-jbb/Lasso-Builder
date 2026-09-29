import { personRisk, type PersonNetworkVM, type PersonVM } from "@lasso/spec";
import { DataState, stateForError } from "../primitives.js";

/** Årstal fra en ISO-dato. */
const year = (d?: string) => (d ? d.slice(0, 4) : undefined);

/**
 * Netværkstal som tre små kort (katalog 16, mobil 26d.5): Netværk (personer i 1. led),
 * Konkurser (antal, seneste år) og Tvangsopløsninger. Tallet 18/600; et tal over 0 for konkurser
 * står i rød MED ordet i overskriften (regel 7). Hvide kort med 1 px kant, aldrig fyld.
 */
export function PersonStats({ person, network, error, networkError }: { person?: PersonVM; network?: PersonNetworkVM; error?: string; networkError?: string }) {
  if (!person) {
    return (
      <div className="lasso-personstats lasso-span-full">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={2} height={84} />}
      </div>
    );
  }
  const risk = personRisk(person);
  const lastBankruptcy = risk.bankruptcies.map((b) => b.date).filter(Boolean).sort().at(-1);
  const lastDissolution = risk.dissolutions.map((b) => b.date).filter(Boolean).sort().at(-1);
  const cards: { key: string; label: string; value: number | null; sub: string; tone?: "danger" }[] = [
    {
      key: "network",
      label: "Netværk",
      value: network ? network.people.length : null,
      sub: network ? "personer i 1. led" : networkError ? "kunne ikke hentes" : "henter …",
    },
    {
      key: "bankruptcies",
      label: "Konkurser",
      value: risk.bankruptcies.length,
      sub: risk.bankruptcies.length ? (year(lastBankruptcy) ? `seneste ${year(lastBankruptcy)}` : "registreret") : "ingen registreret",
      tone: risk.bankruptcies.length ? "danger" : undefined,
    },
    {
      key: "dissolutions",
      label: "Tvangsopl.",
      value: risk.dissolutions.length,
      sub: risk.dissolutions.length ? (year(lastDissolution) ? `seneste ${year(lastDissolution)}` : "registreret") : "ingen registreret",
      tone: risk.dissolutions.length ? "danger" : undefined,
    },
  ];
  return (
    <ul className="lasso-personstats lasso-span-full" aria-label="Netværkstal">
      {cards.map((c) => (
        <li key={c.key} className="lasso-personstats__card">
          <span className="lasso-personstats__label" title={c.key === "dissolutions" ? "Tvangsopløsninger" : undefined}>
            {c.label}
          </span>
          <span className={`lasso-personstats__value${c.tone ? " lasso-personstats__value--danger" : ""}`}>{c.value === null ? "-" : c.value}</span>
          <span className="lasso-personstats__sub">{c.sub}</span>
        </li>
      ))}
    </ul>
  );
}
