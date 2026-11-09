import { IssueCircuitGovernor } from "./governor.js";
import { TeamworkGraphClient } from "./teamwork-graph.js";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, any>;
}

export interface McpResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class RovoMcpServer {
  private governor: IssueCircuitGovernor;
  private twgClient: TeamworkGraphClient;

  constructor(governor?: IssueCircuitGovernor, twgClient?: TeamworkGraphClient) {
    this.governor = governor ?? new IssueCircuitGovernor();
    this.twgClient = twgClient ?? new TeamworkGraphClient();
  }

  public getGovernor(): IssueCircuitGovernor {
    return this.governor;
  }

  public getTeamworkGraphClient(): TeamworkGraphClient {
    return this.twgClient;
  }

  public listTools(): McpToolDefinition[] {
    return [
      {
        name: "check_issue_budget_lease",
        description:
          "Pre-checks and atomically leases an execution token/cost budget for an autonomous agent action on a Jira issue. Fails closed if the issue ceiling is exceeded.",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string", description: "Jira issue key (e.g. PROJ-123)" },
            requestedAmountUsd: {
              type: "number",
              description: "Estimated cost of the impending LLM or tool action in USD",
            },
            agentId: { type: "string", description: "Unique identifier of the executing Rovo agent" },
            actionDescription: {
              type: "string",
              description: "Brief summary of the action to be performed",
            },
          },
          required: ["issueKey", "requestedAmountUsd", "agentId"],
        },
      },
      {
        name: "detect_trajectory_loop",
        description:
          "Analyzes recent agent actions on a Jira issue for repetitive retry loops or semantic stagnation. Trips the circuit breaker if infinite looping is detected.",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string", description: "Jira issue key" },
            recentActions: {
              type: "array",
              description: "List of recent actions containing toolName, inputSummary, outputSummary",
              items: { type: "object" },
            },
            similarityThreshold: {
              type: "number",
              description: "Jaccard similarity threshold for loop detection (default 0.85)",
            },
          },
          required: ["issueKey", "recentActions"],
        },
      },
      {
        name: "sync_teamwork_graph",
        description:
          "Synchronizes governance decisions, budget consumption, and circuit-breaker state to the Atlassian Teamwork Graph.",
        inputSchema: {
          type: "object",
          properties: {
            issueKey: { type: "string", description: "Jira issue key" },
            eventType: {
              type: "string",
              enum: [
                "BUDGET_RESERVED",
                "BUDGET_RECONCILED",
                "CIRCUIT_BREAKER_TRIPPED",
                "LOOP_DETECTED",
              ],
            },
            agentId: { type: "string" },
            metadata: { type: "object" },
          },
          required: ["issueKey", "eventType", "agentId"],
        },
      },
    ];
  }

  public async handleRequest(request: McpRequest): Promise<McpResponse> {
    const { id, method, params } = request;

    if (method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: this.listTools(),
        },
      };
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.arguments ?? {};

      if (toolName === "check_issue_budget_lease") {
        const result = this.governor.reserveBudgetLease({
          issueKey: args.issueKey,
          requestedAmountUsd: args.requestedAmountUsd,
          agentId: args.agentId,
          actionDescription: args.actionDescription ?? "",
        });

        // Sync to Teamwork Graph
        await this.twgClient.recordEvent({
          eventType: result.granted ? "BUDGET_RESERVED" : "CIRCUIT_BREAKER_TRIPPED",
          issueKey: args.issueKey,
          agentId: args.agentId,
          metadata: { ...result },
          timestamp: new Date().toISOString(),
        });

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          },
        };
      }

      if (toolName === "detect_trajectory_loop") {
        const result = this.governor.detectTrajectoryLoop({
          issueKey: args.issueKey,
          recentActions: args.recentActions,
          similarityThreshold: args.similarityThreshold,
        });

        if (result.loopDetected) {
          await this.twgClient.recordEvent({
            eventType: "LOOP_DETECTED",
            issueKey: args.issueKey,
            agentId: "circuit-guard-governor",
            metadata: { ...result },
            timestamp: new Date().toISOString(),
          });
        }

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          },
        };
      }

      if (toolName === "sync_teamwork_graph") {
        const result = await this.twgClient.recordEvent({
          issueKey: args.issueKey,
          eventType: args.eventType,
          agentId: args.agentId,
          metadata: args.metadata ?? {},
          timestamp: new Date().toISOString(),
        });

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          },
        };
      }

      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Method or tool '${toolName}' not found`,
        },
      };
    }

    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32600,
        message: `Invalid MCP request method: '${method}'`,
      },
    };
  }
}
