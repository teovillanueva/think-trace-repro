# think-trace-repro

Repro for [cloudflare/agents#2539](https://github.com/cloudflare/agents/issues/2539): the spans of a Think chat turn (`chat_turn`, `invoke_agent`, `chat`) are force-closed with `span_not_ended` and lose every attribute when another event reaches the Durable Object while the turn is running.

The app is a Think agent with a mock model that streams for about 4 seconds, and a React page using `useAgentChat` with four buttons:

| button | what reaches the DO during the turn |
|---|---|
| Plain turn | nothing |
| Turn + RPC mid-turn | the page calls `/api/ping`, which calls `agent.ping()` over RPC |
| Turn + setState mid-turn | `agent.setState()` on the same socket |
| Turn with a browser tool | the model calls a tool with no `execute`, `onToolCall` answers it, Think auto-continues. Nothing else is done by the app |

## Run

Traces only exist on a deployed Worker.

```sh
pnpm install
pnpm types
pnpm run deploy
```

Open the Worker URL, click each button once and wait for the reply. Then look at the `invoke_agent ReproAgent` spans in Workers Observability, or at AI → Agent tracing.

## What we see

| turn | `invoke_agent ReproAgent` | `gen_ai.*` |
|---|---|---|
| Plain turn | 4799 ms, ended normally | all, including usage |
| Turn + RPC mid-turn | 1513 ms, `span_not_ended` | none |
| Turn + setState mid-turn | 1495 ms, `span_not_ended` | none |
| Turn with a browser tool, first step | 199 ms, ended normally (`finish_reason: tool-calls`) | all |
| Turn with a browser tool, continuation | 238 ms, `span_not_ended` | none |

Every turn completes and the page gets the full reply. Only the tracing is lost.

Versions: agents 0.27.0, @cloudflare/think 0.20.1, ai 7.0.128, @cloudflare/vite-plugin 1.62.0, wrangler 4.143.0, compatibility_date 2026-09-26.
