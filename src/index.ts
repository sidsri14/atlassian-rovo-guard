export * from "./types.js";
export * from "./governor.js";
export * from "./teamwork-graph.js";
export * from "./mcp-handler.js";

import { IssueCircuitGovernor } from "./governor.js";
import { RovoMcpServer, McpRequest } from "./mcp-handler.js";
import { TeamworkGraphClient } from "./teamwork-graph.js";

const sharedGovernor = new IssueCircuitGovernor(5.0);
const sharedTwgClient = new TeamworkGraphClient();
const sharedMcpServer = new RovoMcpServer(sharedGovernor, sharedTwgClient);

/**
 * Atlassian Forge function handler for the Rovo MCP server module.
 */
export async function mcpHandler(req: McpRequest) {
  return await sharedMcpServer.handleRequest(req);
}

/**
 * Atlassian Forge function handler for the Jira issue panel module.
 */
export async function panelHandler(context: { extension: { issue: { key: string } } }) {
  const issueKey = context?.extension?.issue?.key ?? "UNKNOWN";
  const budget = sharedGovernor.getOrCreateBudget(issueKey);
  const events = sharedTwgClient.getEventsForIssue(issueKey);

  return {
    issueKey,
    maxBudgetUsd: budget.maxBudgetUsd,
    currentSpendUsd: budget.currentSpendUsd,
    reservedSpendUsd: budget.reservedSpendUsd,
    isTripped: budget.isTripped,
    tripReason: budget.tripReason ?? "None",
    recentEvents: events.slice(-5),
  };
}
