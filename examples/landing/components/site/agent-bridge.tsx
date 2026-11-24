"use client"

import { createAgent, registerTools } from "@ui-sdk/react/agent"

type AgentWindow = Window & { agent?: ReturnType<typeof createAgent> }

// One bridge for the whole site. It lists every ui-sdk component on the page with its state
// and actions, so an agent can call them instead of clicking. `window.agent` is for agents
// that run script in the page; a browser with WebMCP gets the same three tools on its own.
if (typeof window !== "undefined" && !(window as AgentWindow).agent) {
  const agent = createAgent()
  ;(window as AgentWindow).agent = agent
  // Nothing on this site is marked as needing a person. If something ever is, it waits for one.
  registerTools(agent, { allow: (step) => !step.confirm })
}

export function AgentBridge() {
  return null
}
