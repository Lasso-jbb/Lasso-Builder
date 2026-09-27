import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request } from "express";
import { loadConfig } from "../config.js";
import { getCurrentUser, isValidMcpKey, mcpKeyRequired, parseUserKeys } from "./user.js";

const req = (key: string) => ({ header: (name: string) => (name === "x-api-key" ? key : undefined), query: {}, params: {} }) as unknown as Request;

test("parseUserKeys læser nøgle:bruger[:navn[:org]] og springer ugyldige poster over", () => {
  const users = parseUserKeys("abcdefgh1:jbb:Jakob:lasso; ijklmnop2:anna ;kort:x; abcdefgh3:bad id", "demo-org");
  assert.deepEqual(users, [
    { key: "abcdefgh1", id: "jbb", name: "Jakob", org: "lasso" },
    { key: "ijklmnop2", id: "anna", name: "anna", org: "demo-org" },
  ]);
});

test("brugernøgler giver hver sin bruger; den fælles nøgle giver demobrugeren", () => {
  const config = loadConfig({ MCP_ACCESS_KEY: "shared-key-1", MCP_USER_KEYS: "userkey-jbb:jbb:Jakob:lasso", DEMO_ORG: "lasso-demo" });
  assert.equal(mcpKeyRequired(config), true);
  assert.equal(isValidMcpKey(config, "shared-key-1"), true);
  assert.equal(isValidMcpKey(config, "userkey-jbb"), true);
  assert.equal(isValidMcpKey(config, "userkey-jb"), false);
  assert.equal(isValidMcpKey(config, ""), false);
  assert.deepEqual(getCurrentUser(req("userkey-jbb"), config), { id: "jbb", name: "Jakob", org: "lasso", isDemo: false });
  assert.equal(getCurrentUser(req("shared-key-1"), config).isDemo, true);
  assert.equal(getCurrentUser(undefined, config).org, "lasso-demo");
});

test("kun brugernøgler (ingen fælles nøgle) kræver stadig nøgle", () => {
  const config = loadConfig({ MCP_USER_KEYS: "userkey-anna:anna" });
  assert.equal(mcpKeyRequired(config), true);
  assert.equal(isValidMcpKey(config, "userkey-anna"), true);
  assert.equal(isValidMcpKey(config, "other"), false);
  const open = loadConfig({});
  assert.equal(mcpKeyRequired(open), false);
});
