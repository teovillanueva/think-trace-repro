import { Think } from "@cloudflare/think";
import { getAgentByName, routeAgentRequest } from "agents";
import { simulateReadableStream, tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

const usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
};

// ~20 text deltas over ~4s, so there is time for something else to reach the DO mid-turn.
const slowText = () =>
  simulateReadableStream({
    initialDelayInMs: 200,
    chunkDelayInMs: 200,
    chunks: [
      { type: "stream-start" as const, warnings: [] },
      { type: "text-start" as const, id: "t" },
      ...Array.from({ length: 20 }, (_, i) => ({ type: "text-delta" as const, id: "t", delta: `word${i} ` })),
      { type: "text-end" as const, id: "t" },
      { type: "finish" as const, finishReason: { unified: "stop" as const, raw: "stop" }, usage },
    ],
  });

// Asks the browser to run `get_browser_time`.
const callBrowserTool = () =>
  simulateReadableStream({
    initialDelayInMs: 200,
    chunks: [
      { type: "stream-start" as const, warnings: [] },
      { type: "tool-call" as const, toolCallId: crypto.randomUUID(), toolName: "get_browser_time", input: "{}" },
      { type: "finish" as const, finishReason: { unified: "tool-calls" as const, raw: "tool_calls" }, usage },
    ],
  });

export class ReproAgent extends Think<Env> {
  override getModel() {
    return new MockLanguageModelV4({
      provider: "mock",
      modelId: "slow-mock",
      doStream: async ({ prompt }) => {
        const last = prompt.at(-1);
        const wantsTool = JSON.stringify(last).includes("use the tool");
        return { stream: last?.role === "user" && wantsTool ? callBrowserTool() : slowText() };
      },
    });
  }

  override getTools() {
    return {
      // No execute: the browser answers it (onToolCall in src/client.tsx).
      get_browser_time: tool({
        description: "Read the time from the user's browser",
        inputSchema: z.object({}),
      }),
    };
  }

  // Any RPC the app makes to the agent, e.g. from a server function.
  async ping() {
    return "pong";
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/ping") {
      const agent = await getAgentByName(env.ReproAgent, url.searchParams.get("name") ?? "demo");
      return new Response(await agent.ping());
    }
    return (await routeAgentRequest(request, env)) ?? new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
