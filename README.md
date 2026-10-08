# think-trace-repro

Repro for [cloudflare/agents#2539](https://github.com/cloudflare/agents/issues/2539): the spans of a Think `ws-chat` turn (`chat_turn`, `invoke_agent`, `chat`) are force-closed with `span_not_ended` and lose every attribute when another event reaches the Durable Object while the turn is running.

`ReproAgent` is a Think agent with a mock model that streams for about 4 seconds. `client.mjs` sends one chat request over the WebSocket and, 1.5s into the turn, either does nothing (`quiet`), sends another frame on the same socket (`ws-frame`), or calls an RPC method on the agent (`rpc`).

## Run

Traces only exist on a deployed Worker.

```sh
pnpm install
pnpm wrangler types
pnpm wrangler deploy

node client.mjs https://think-trace-repro.<subdomain>.workers.dev quiet-1 quiet
node client.mjs https://think-trace-repro.<subdomain>.workers.dev frame-1 ws-frame
node client.mjs https://think-trace-repro.<subdomain>.workers.dev rpc-1 rpc
```

Then look at the `invoke_agent ReproAgent` spans in Workers Observability (or AI → Agent tracing).

## What we see

| mode | `chat_turn` / `invoke_agent ReproAgent` / `chat slow-mock` | `gen_ai.*` |
|---|---|---|
| `quiet` | 4799 ms, ended normally | all, including usage |
| `ws-frame` | 1495 ms, `span_not_ended` | none |
| `rpc` | 1586 ms, `span_not_ended` | none |

The turns complete in all three cases. Only the tracing is lost.

Versions: agents 0.27.0, @cloudflare/think 0.20.1, ai 7.0.128, wrangler 4.143.0, compatibility_date 2026-09-26.
