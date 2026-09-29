import { composeProbe, composePersonProbe, FOCUSES } from "@lasso/spec";
export const COMPANIES = ["CVR-1-99000001", "CVR-1-99000004", "CVR-1-99000008", "CVR-1-99000005"];
export const P = "CVR-3-4000000002";
export const entries = [
  ...COMPANIES.flatMap((c) => FOCUSES.map((f) => ({ nr: `${c} ${f}`, title: `${c} ${f}`, kind: "company", id: c, focus: f, spec: composeProbe(c, f) as unknown as Record<string, unknown> }))),
  ...["overblik", "roller", "netvaerk", "ejerskab", "risiko", "historik"].map((f) => ({ nr: `${P} ${f}`, title: `${P} ${f}`, kind: "person", id: P, focus: f, spec: composePersonProbe(P, f as never) as unknown as Record<string, unknown> })),
];
