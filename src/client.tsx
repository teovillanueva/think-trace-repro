import { useAgentChat } from "@cloudflare/think/react";
import { useAgent } from "agents/react";
import { createRoot } from "react-dom/client";

const NAME = "demo";
const MID_TURN_MS = 1500;
const BROWSER_TOOL_MS = 1000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function App() {
  const agent = useAgent({ agent: "ReproAgent", name: NAME });
  const { messages, sendMessage, addToolOutput, status } = useAgentChat({
    agent,
    // The browser-side tool. Its result goes back over the same WebSocket.
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName !== "get_browser_time") return;
      await wait(BROWSER_TOOL_MS);
      addToolOutput({ toolCallId: toolCall.toolCallId, output: new Date().toISOString() });
    },
  });

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 640, margin: "2rem auto" }}>
      <h1>think-trace-repro</h1>
      <p>status: {status}</p>

      {/* 1. Nothing else reaches the DO during the turn: spans are complete. */}
      <button type="button" onClick={() => sendMessage({ text: "plain turn" })}>
        Plain turn
      </button>

      {/* 2. The app calls the agent over RPC mid-turn (here through a Worker route). */}
      <button
        type="button"
        onClick={async () => {
          sendMessage({ text: "turn + RPC" });
          await wait(MID_TURN_MS);
          await fetch(`/api/ping?name=${NAME}`);
        }}
      >
        Turn + RPC mid-turn
      </button>

      {/* 3. The client sends state over the same socket mid-turn. */}
      <button
        type="button"
        onClick={async () => {
          sendMessage({ text: "turn + state" });
          await wait(MID_TURN_MS);
          agent.setState({ touchedAt: Date.now() });
        }}
      >
        Turn + setState mid-turn
      </button>

      {/* 4. The model calls a client-side tool, the browser answers, the turn continues. */}
      <button type="button" onClick={() => sendMessage({ text: "use the tool" })}>
        Turn with a browser tool
      </button>

      <ul>
        {messages.map((message) => (
          <li key={message.id}>
            <b>{message.role}:</b>{" "}
            {message.parts.map((part) => (part.type === "text" ? part.text : `[${part.type}]`)).join(" ")}
          </li>
        ))}
      </ul>
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
