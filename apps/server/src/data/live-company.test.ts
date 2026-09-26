import assert from "node:assert/strict";
import { test } from "node:test";
import { composeProbe } from "@lasso/spec";
import { loadConfig } from "../config.js";
import { LassoApiError, type LassoClient } from "../lasso/client.js";
import { CONTACT_BUDGET_MS, LiveProvider } from "./live.js";
import { resolveSpec } from "./resolve.js";

/** Falsk klient, der logger kald og kan gøre kontaktendpoints langsomme. */
function fakeClient(opts: { scrapeMs?: number; contactsError?: unknown; websites?: unknown; calls?: string[] } = {}) {
  const calls = opts.calls ?? [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  return {
    calls,
    client: {
      async company(id: string) {
        calls.push(`company:${id}`);
        return { lassoId: id, name: "Lasso X A/S", status: "Normal", address: { postalCode: 1000 } };
      },
      async websites(id: string) {
        calls.push(`websites:${id}`);
        await sleep(opts.scrapeMs ?? 0);
        return opts.websites ?? { cvr: "34580820", urls: [{ url: "https://lassox.com", verifiedAt: "2026-01-01" }] };
      },
      async contacts(id: string, p: Record<string, boolean>) {
        calls.push(`contacts:${id}:${Object.keys(p).join(",")}`);
        await sleep(opts.scrapeMs ?? 0);
        if (opts.contactsError) throw opts.contactsError;
        return p.contacts ? { contacts: [{ name: "Anne Kontakt", title: "Salg" }] } : { phonenumbers: ["+45 70 70 70 70"], emails: ["info@lassox.com"] };
      },
      async reports() {
        return [];
      },
      async observations() {
        return [];
      },
      async news() {
        return { news: [] };
      },
    } as unknown as LassoClient,
  };
}

test("company() bruger kun CVR og venter aldrig på kontakt-scraping", async () => {
  const { client, calls } = fakeClient({ scrapeMs: 2_000 });
  const started = Date.now();
  const co = await new LiveProvider(client, loadConfig({})).company("CVR-1-34580820");
  assert.ok(Date.now() - started < 500, "company() må ikke vente på websites/contacts");
  assert.equal(co.name, "Lasso X A/S");
  assert.deepEqual(calls, ["company:CVR-1-34580820"]);
});

test("contact() henter hjemmesidens kontaktdata, når CVR mangler dem, og resolveSpec fylder virksomheden ud", async () => {
  const { client } = fakeClient();
  const provider = new LiveProvider(client, loadConfig({}));
  const c = await provider.contact("CVR-1-34580820");
  assert.equal(c.phone, "+45 70 70 70 70");
  assert.equal(c.website, "https://lassox.com");
  // Overblik henter LassoContact; hovedet får så telefon/web derfra uden et ekstra kald i company().
  const ds = await resolveSpec(composeProbe("CVR-1-34580820", "overblik"), provider);
  assert.equal(ds.companies["CVR-1-34580820"]!.phone, "+45 70 70 70 70");
  assert.equal(ds.companies["CVR-1-34580820"]!.website, "https://lassox.com");
});

test("økonomi-fokus kalder aldrig kontaktendpoints", async () => {
  const { client, calls } = fakeClient();
  await resolveSpec(composeProbe("CVR-1-34580820", "oekonomi"), new LiveProvider(client, loadConfig({})));
  assert.ok(!calls.some((c) => c.startsWith("websites") || c.startsWith("contacts")), calls.join(", "));
});

test("contactPersons(): 400 'None of company's webpages were valid' og 404 er en tom tilstand, ikke en fejl", async () => {
  for (const status of [400, 404]) {
    const err = new LassoApiError(status, { errorMessage: "Request failed: \"None of company's webpages were valid\"" }, "x");
    const { client } = fakeClient({ contactsError: err });
    const vm = await new LiveProvider(client, loadConfig({})).contactPersons("CVR-1-38113891");
    assert.deepEqual(vm.people, []);
    assert.match(vm.emptyReason ?? "", /ingen hjemmeside/i);
  }
});

test("contactPersons(): ingen hjemmeside i websites giver forklaret tom tilstand; timeout er stadig en fejl", async () => {
  const empty = fakeClient({ websites: { cvr: "1", urls: [] } });
  (empty.client as unknown as { contacts: () => Promise<unknown> }).contacts = async () => ({ contacts: [] });
  const vm = await new LiveProvider(empty.client, loadConfig({})).contactPersons("CVR-1-1");
  assert.match(vm.emptyReason ?? "", /ingen hjemmeside/i);

  const timeout = new Error("The operation was aborted due to timeout");
  timeout.name = "TimeoutError";
  const { client } = fakeClient({ contactsError: timeout });
  await assert.rejects(new LiveProvider(client, loadConfig({})).contactPersons("CVR-1-1"), /timeout/);
});

test("ejergrafen: navneløse personnoder får navn fra ejerlisten i det ejede selskab, BlackRock bliver selskab", async () => {
  const calls: string[] = [];
  const client = {
    async relationsGraph() {
      return {
        nodes: [{ id: "CVR-1-54562519", name: "LEGO A/S" }, { id: "CVR-1-10000001", name: "KIRKBI A/S" }, { id: "CVR-3-4000543165" }, { id: "CVR-3-4010801698" }, { id: "CVR-3-4099999999" }],
        edges: [
          { from: "CVR-1-10000001", to: "CVR-1-54562519", ownership: { from: 0.75, to: 0.75 } },
          { from: "CVR-3-4000543165", to: "CVR-1-10000001", ownership: { from: 0.25, to: 0.3332 } },
          { from: "CVR-3-4010801698", to: "CVR-1-54562519", ownership: { from: 0.05, to: 0.0999 } },
          { from: "CVR-3-4099999999", to: "CVR-1-54562519", ownership: { from: 0.05, to: 0.0999 } },
        ],
      };
    },
    async company(id: string) {
      calls.push(`company:${id}`);
      if (id === "CVR-1-10000001") return { ownership: { owners: [{ name: "Kjeld Kirk Kristiansen", lassoId: "CVR-3-4000543165", type: "Person" }] } };
      return { ownership: { owners: [{ name: "BlackRock, Inc", lassoId: "CVR-3-4010801698" }] } };
    },
    async person(id: string) {
      calls.push(`person:${id}`);
      return { lassoId: id, name: "Agnete Kirk Thinggaard" };
    },
  } as unknown as LassoClient;
  const g = await new LiveProvider(client, loadConfig({})).ownershipGraph("CVR-1-54562519", { ingoingDepth: 3, outgoingDepth: 2 });
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  assert.equal(byId.get("CVR-3-4000543165")!.name, "Kjeld Kirk Kristiansen");
  assert.equal(byId.get("CVR-3-4000543165")!.kind, "person");
  assert.equal(byId.get("CVR-3-4010801698")!.name, "BlackRock, Inc");
  assert.equal(byId.get("CVR-3-4010801698")!.kind, "company");
  // Ikke i nogen ejerliste: slås op på eget ID.
  assert.equal(byId.get("CVR-3-4099999999")!.name, "Agnete Kirk Thinggaard");
  assert.ok(g.nodes.every((n) => n.name !== n.id), "ingen node står med sit ID som navn");
  assert.deepEqual(calls.filter((c) => c.startsWith("person:")), ["person:CVR-3-4099999999"]);
});

test("søgerækker kalder aldrig kontaktendpoints", async () => {
  const { client, calls } = fakeClient();
  (client as unknown as { hasSearchCredentials: boolean }).hasSearchCredentials = false;
  (client as unknown as { search: () => Promise<unknown> }).search = async () => ({ companies: { results: [{ lassoId: "CVR-1-1", name: "A ApS" }, { lassoId: "CVR-1-2", name: "B ApS" }], resultsFound: 2 } });
  await new LiveProvider(client, loadConfig({})).search({ query: "a", criteria: [], limit: 2 } as never);
  assert.ok(!calls.some((c) => c.startsWith("websites") || c.startsWith("contacts")), calls.join(", "));
});

test("contact(): langsom telefon/e-mail-scraping venter højst CONTACT_BUDGET_MS; hjemmesiden vises alligevel", async () => {
  const { client } = fakeClient({ scrapeMs: CONTACT_BUDGET_MS + 1_500 });
  (client as unknown as { websites: () => Promise<unknown> }).websites = async () => ({ urls: [{ url: "https://lassox.com" }] });
  const started = Date.now();
  const c = await new LiveProvider(client, loadConfig({})).contact("CVR-1-34580820");
  const elapsed = Date.now() - started;
  assert.ok(elapsed < CONTACT_BUDGET_MS + 800, `ventede ${elapsed} ms`);
  assert.equal(c.website, "https://lassox.com");
  assert.equal(c.phone, undefined);
});
