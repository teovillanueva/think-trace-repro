import { Think } from "@cloudflare/think";
import { getAgentByName, routeAgentRequest } from "agents";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

// A model that streams ~20 text deltas over ~4s, then finishes with usage.
function slowModel() {
  return new MockLanguageModelV4({
    provider: "mock",
    modelId: "slow-mock",
    doStream: async () => ({
      stream: simulateReadableStream({
        initialDelayInMs: 200,
        chunkDelayInMs: 200,
        chunks: [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t" },
          ...Array.from({ length: 20 }, (_, i) => ({ type: "text-delta" as const, id: "t", delta: `word${i} ` })),
          { type: "text-end", id: "t" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 20, text: 20, reasoning: 0 },
            },
          },
        ],
      }),
    }),
  });
}

export class ReproAgent extends Think<Env> {
  override getModel() {
    return slowModel();
  }

  // Stand-in for any RPC the app makes to the agent while a turn runs.
  async ping() {
    return "pong";
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/ping/")) {
      const stub = await getAgentByName(env.ReproAgent, url.pathname.slice(6));
      return new Response(await stub.ping());
    }
    return (await routeAgentRequest(request, env)) ?? new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
