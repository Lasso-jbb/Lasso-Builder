import { useState } from "react";
import { isPersonId, type PersonNetworkCompanyVM, type PersonNetworkVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";

const COLLAPSED = 3;
const year = (d?: string) => (d ? d.slice(0, 4) : "");

function period(c: PersonNetworkCompanyVM): string {
  if (!c.to) return c.from ? `siden ${year(c.from)}` : "";
  return [year(c.from), year(c.to)].filter(Boolean).join("–");
}

/**
 * Netværk (katalog 16, "Sidder sammen med"): personer med fælles selskaber, sorteret efter
 * år sammen. Overlap i år som stort tal til højre; fælles selskaber som tekst med rolle og
 * periode efter komma. Afsluttede relationer er dæmpede. Selskaber under konkurs skrives i
 * mørk rød OG med ordet (regel 7). Navne står alene, uden initial-cirkler.
 */
export function PersonNetwork({ network, title, error, onOpen }: { network?: PersonNetworkVM; title?: string; error?: string; onOpen?: (a: ViewAction) => void }) {
  const heading = title ?? "Sidder sammen med";
  const [expanded, setExpanded] = useState(false);
  if (!network) {
    return (
      <Section title={heading} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={240} />}
      </Section>
    );
  }
  if (network.people.length === 0) {
    return (
      <Section title={heading} span="half">
        <DataState state="empty" reason="Personen sidder ikke sammen med andre i registrerede selskaber." />
      </Section>
    );
  }
  const rows = expanded ? network.people : network.people.slice(0, COLLAPSED);
  return (
    <Section title={heading} span="half" className="lasso-personnet">
      <ul className="lasso-personnet__rows">
        {rows.map((p, i) => {
          const openPerson = onOpen && isPersonId(p.lassoId) ? () => onOpen({ kind: "open-person", lassoId: p.lassoId!, name: p.name }) : undefined;
          const n = p.companies.length;
          const meta = [`${n} ${n === 1 ? "fælles selskab" : "fælles selskaber"}`, p.active ? (p.since ? `siden ${year(p.since)}` : null) : p.until ? `afsluttet ${year(p.until)}` : "afsluttet"]
            .filter(Boolean)
            .join(", ");
          return (
            <li key={`${p.name}-${i}`} className={`lasso-personnet__row ${p.active ? "" : "is-ended"}`}>
              <div className="lasso-personnet__main">
                <div className="lasso-personnet__head">
                  {openPerson ? (
                    <button type="button" className="lasso-link lasso-personnet__name" onClick={openPerson}>
                      {p.name}
                    </button>
                  ) : (
                    <span className="lasso-personnet__name">{p.name}</span>
                  )}
                  <span className="lasso-personnet__meta">, {meta}</span>
                </div>
                <div className="lasso-personnet__companies">
                  {p.companies.map((c, j) => {
                    const bankrupt = c.statusKind === "warning";
                    const nameClass = `lasso-personnet__company ${bankrupt ? "is-bankrupt" : ""}`;
                    const detail = [c.role, period(c), bankrupt ? c.status?.toLowerCase() : null].filter(Boolean).join(", ");
                    return (
                      <span key={j} className="lasso-personnet__rel">
                        {onOpen && c.companyId?.startsWith("CVR-1-") ? (
                          <button type="button" className={`lasso-link ${nameClass}`} onClick={() => onOpen({ kind: "open-company", lassoId: c.companyId!, name: c.companyName })}>
                            {c.companyName}
                          </button>
                        ) : (
                          <span className={nameClass}>{c.companyName}</span>
                        )}
                        {detail ? <span className="lasso-personnet__detail">{detail}</span> : null}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="lasso-personnet__side">
                <div className="lasso-personnet__years">{p.overlapYears < 1 ? "<1 år" : `${p.overlapYears} år`}</div>
                <div className="lasso-personnet__unit">{p.active ? "sammen" : "tidligere"}</div>
              </div>
            </li>
          );
        })}
      </ul>
      {network.people.length > COLLAPSED ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis færre" : `Se alle ${network.people.length}`}
        </button>
      ) : null}
      <SourceLine source="CVR via Lasso" />
    </Section>
  );
}
