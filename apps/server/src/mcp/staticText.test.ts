import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogAsText, catalogIndexText, COMPONENT_CATALOG, viewSpecSchema } from "@lasso/spec";
import { staticToolParts } from "./staticText.js";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { DemoProvider } from "../data/demo.js";
import { createMcpServer, describeComponents, type McpContext } from "./server.js";

/** Tegn pr. token på dansk (plan Ø8). */
const CHARS_PER_TOKEN = 3.3;
/**
 * Token-loft for de faste tekster, modellen får i hver samtale: instruktioner, alle
 * værktøjsbeskrivelser OG input-skemaerne (plan Ø8).
 * 29.09.2026: ≈ 21.400 i beskrivelser + ≈ 48.400 i skemaer (render_view's fulde viewSpec-skema ≈ 45.400).
 * 30.09.2026: kataloget hentes med describe_components, gitterreglerne er ude (Lasso pakker bredderne),
 * og render_view's skema er løst (serveren validerer) → ≈ 7.100 + 3.600. Loftet ligger lige over,
 * så katalog eller skema ikke sniger sig tilbage.
 */
const TOKEN_CEILING = 12_000;

const tok = (chars: number) => Math.round(chars / CHARS_PER_TOKEN);

test(`faste tekster (beskrivelser + skemaer) ≤ ${TOKEN_CEILING} tokens (tegn / ${CHARS_PER_TOKEN})`, async () => {
  const p = await staticToolParts();
  const perTool = Object.keys(p.tools).map((n) => ({ n, d: p.tools[n]!.length, s: p.schemas[n]!.length }));
  const total = p.instructions.length + perTool.reduce((sum, t) => sum + t.d + t.s, 0);
  const fordeling = [`instruktioner: ${tok(p.instructions.length)}`, ...perTool.map((t) => `${t.n}: ${tok(t.d)} + skema ${tok(t.s)}`)].join("\n  ");
  assert.ok(
    total / CHARS_PER_TOKEN <= TOKEN_CEILING,
    `Faste tekster er ${tok(total)} tokens (${total} tegn), loft ${TOKEN_CEILING} (plan Ø8). Fordeling i tokens:\n  ${fordeling}`,
  );
  assert.ok(p.tools["render_view"]?.includes(catalogIndexText()), "komponentindekset står ikke i render_view's beskrivelse");
  assert.ok(!p.tools["render_view"]?.includes(catalogAsText()), "det fulde katalog må ikke stå i render_view's beskrivelse");
  assert.ok(p.tools["describe_components"], "describe_components er ikke registreret");
});

test("komponentindekset nævner alle katalogtyper", () => {
  const idx = catalogIndexText();
  for (const c of COMPONENT_CATALOG) assert.ok(idx.includes(`- ${c.type} (`), c.type);
});

test("describe_components giver fulde katalogposter og retter ukendte typer", () => {
  const all = describeComponents(COMPONENT_CATALOG.map((c) => c.type));
  for (const c of COMPONENT_CATALOG) assert.ok(all.includes(`Props: ${c.props}.`), c.type);
  const out = describeComponents(["LassoOwnerList", "LassoFoo"]);
  assert.match(out, /LassoOwnerList/);
  assert.match(out, /Ukendte typer: LassoFoo/);
  assert.doesNotMatch(out, /LassoKeyValueList \(/);
});

test("eksemplet i render_view's beskrivelse er en gyldig spec", async () => {
  const p = await staticToolParts();
  const m = /Eksempel \(ét dashboard\): (\{.*\})$/m.exec(p.tools["render_view"] ?? "");
  assert.ok(m, "eksemplet mangler");
  const r = viewSpecSchema.safeParse({ ...JSON.parse(m[1]!), version: 2, kind: "custom" });
  assert.ok(r.success, JSON.stringify(r.error?.issues));
});

test("render_view: ugyldig spec giver katalogposten i fejlsvaret; gyldig spec tegnes", async () => {
  const server = createMcpServer({ provider: new DemoProvider(), config: { LASSO_COMPANY_ID_PREFIX: "CVR-1-", publicBaseUrl: "http://localhost", PDF_CHROMIUM_PATH: "" } } as unknown as McpContext);
  const client = new Client({ name: "t", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  try {
    const bad = (await client.callTool({ name: "render_view", arguments: { title: "t", components: [{ type: "LassoOwnerList", firma: "x" }] } })) as { isError?: boolean; content: { text: string }[] };
    assert.equal(bad.isError, true);
    assert.match(bad.content[0]!.text, /Specen er ugyldig: components\.0\.company/);
    assert.match(bad.content[0]!.text, /Katalog for typerne i specen:\n- LassoOwnerList .*Props: /);
    const unknownType = (await client.callTool({ name: "render_view", arguments: { title: "t", components: [{ type: "LassoFoo" }] } })) as { isError?: boolean };
    assert.equal(unknownType.isError, true);
    const good = (await client.callTool({ name: "render_view", arguments: { title: "Ejere", components: [{ type: "LassoCompanyHead", company: "99000001" }, { type: "LassoOwnerList", company: "99000001" }] } })) as { isError?: boolean; structuredContent?: { spec?: { components: unknown[] } } };
    assert.ok(!good.isError, JSON.stringify(good).slice(0, 300));
    assert.equal(good.structuredContent?.spec?.components.length, 2);
  } finally {
    await client.close();
    await server.close();
  }
});
