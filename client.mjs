// usage: node client.mjs <base-url> <instance> <mode: quiet | ws-frame | rpc>
const [base, instance, mode] = process.argv.slice(2);
const ws = new WebSocket(`${base.replace(/^http/, "ws")}/agents/repro-agent/${instance}`);
const id = crypto.randomUUID();
const done = new Promise((resolve) => {
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "cf_agent_use_chat_response" && msg.id === id && msg.done) resolve();
  });
});
await new Promise((r) => ws.addEventListener("open", r));
ws.send(JSON.stringify({
  type: "cf_agent_use_chat_request",
  id,
  init: {
    method: "POST",
    body: JSON.stringify({
      messages: [{ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: "hi" }] }],
    }),
  },
}));
if (mode !== "quiet") {
  await new Promise((r) => setTimeout(r, 1500)); // mid-turn
  if (mode === "ws-frame") ws.send("ping"); // any frame on the same socket
  if (mode === "rpc") console.log(await (await fetch(`${base}/ping/${instance}`)).text());
}
await done;
console.log(mode, "turn done", id);
ws.close();
