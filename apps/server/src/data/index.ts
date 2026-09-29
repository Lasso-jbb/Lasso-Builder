import { hasLassoCredentials, type Config } from "../config.js";
import { LassoClient } from "../lasso/client.js";
import { DemoProvider } from "./demo.js";
import { LiveProvider } from "./live.js";
import type { ScoreStore } from "../scores/store.js";
import type { DataProvider } from "./provider.js";

export function createProvider(config: Config, client: LassoClient, scores?: ScoreStore): DataProvider {
  const mode = config.LASSO_DATA_SOURCE;
  if (mode === "demo") return new DemoProvider();
  if (mode === "live" || hasLassoCredentials(config)) return new LiveProvider(client, config, scores);
  return new DemoProvider();
}

export type { DataProvider } from "./provider.js";
