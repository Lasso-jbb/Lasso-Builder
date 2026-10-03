/**
 * Tjek mod det rigtige Claude-API (docs/chat.md, "Tjek mod det rigtige API"): sender den præcise anmodning, chatten
 * sender (samme systemprompt, værktøjsliste, cache-markører og model, bygget af chattens egne funktioner), to gange
 * med en harmløs besked og max_tokens 64, og skriver kun model, stop_reason, forbrug og om 1-timers-cachen læste.
 * Kør: npm run chat:live-check -w @lasso/server (lokalt med ANTHROPIC_API_KEY i .env) eller railway run. Skriver aldrig
 * nøglen eller selve anmodningen. Udgangskode 0 = alt virker; 1 = ingen nøgle eller API-fejl; 2 = cachen læste ikke.
 */
export {};
process.env.LASSO_NO_MAIN = "1";
const { loadConfig, isSet } = await import("../config.js");
const config = loadConfig();

if (!isSet(config.ANTHROPIC_API_KEY)) {
  console.error("ANTHROPIC_API_KEY er ikke sat, så der er ikke sendt noget. Sæt nøglen (fx i .env, eller kør med `railway run`), og prøv igen.");
  process.exit(1);
}

const Anthropic = (await import("@anthropic-ai/sdk")).default;
const { anthropicModelCall, buildChatSetup, chatRequest, connect, userTurn } = await import("../chat/agent.js");
const { GLOBAL_CONTEXT } = await import("../chat/context.js");
const { DemoProvider } = await import("../data/demo.js");
const { createViewStore } = await import("../views/store.js");
const { createSavedPageStore } = await import("../pages/store.js");
const { demoUser } = await import("../auth/user.js");

const { client, close } = await connect({ config, provider: new DemoProvider(), store: createViewStore(""), pages: createSavedPageStore(""), user: demoUser(config), host: "chat" });
let exitCode = 0;
try {
  const setup = await buildChatSetup(client, config);
  const params = { ...chatRequest(config, setup, [userTurn({ ...GLOBAL_CONTEXT, open: [] }, "Sig kun ordet ok.")]), max_tokens: 64 };
  const call = anthropicModelCall(config.ANTHROPIC_API_KEY);
  console.log(`Model ${params.model}, ${setup.toolList.length} værktøjer, cache-TTL ${config.CHAT_CACHE_TTL}`);

  const reads: number[] = [];
  for (const n of [1, 2]) {
    const r = await call(params, () => {});
    const u = r.usage;
    reads.push(u.cache_read_input_tokens ?? 0);
    console.log(`Kald ${n}: model ${r.model}, stop_reason ${r.stop_reason}, input ${u.input_tokens}, cache skrevet ${u.cache_creation_input_tokens ?? 0}, cache læst ${u.cache_read_input_tokens ?? 0}, output ${u.output_tokens}`);
  }
  if (reads[1]! > 0) console.log(`Cachen virker: kald 2 læste ${reads[1]} tokens fra cachen.`);
  else {
    console.error("Cachen læste ikke i kald 2 (cache_read_input_tokens er 0). Tjek, at præfikset (værktøjer + systemprompt) er over modellens mindste cachebare længde, og at intet i det skifter mellem kald.");
    exitCode = 2;
  }
} catch (e) {
  if (e instanceof Anthropic.APIError) console.error(`API-fejl ${e.status ?? "?"}: ${e.message}`);
  else console.error(`Fejl: ${e instanceof Error ? e.message : String(e)}`);
  exitCode = 1;
} finally {
  await close();
}
process.exit(exitCode);
