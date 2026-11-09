import { describe, it, expect } from "vitest";
import { RovoMcpServer } from "../src/mcp-handler.js";

describe("RovoMcpServer Protocol Handlers", () => {
  it("responds to tools/list with all 3 governance tools", async () => {
    const server = new RovoMcpServer();
    const res = await server.handleRequest({
      jsonrpc: "2.0",
      id: "req-1",
      method: "tools/list",
    });

    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe("req-1");
    expect(res.result).toBeDefined();

    const tools = (res.result as any).tools;
    expect(tools.length).toBe(3);
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain("check_issue_budget_lease");
    expect(toolNames).toContain("detect_trajectory_loop");
    expect(toolNames).toContain("sync_teamwork_graph");
  });

  it("handles tools/call for check_issue_budget_lease", async () => {
    const server = new RovoMcpServer();
    const res = await server.handleRequest({
      jsonrpc: "2.0",
      id: "req-2",
      method: "tools/call",
      params: {
        name: "check_issue_budget_lease",
        arguments: {
          issueKey: "KAN-42",
          requestedAmountUsd: 0.15,
          agentId: "rovo-reviewer",
          actionDescription: "Review Bitbucket PR diff",
        },
      },
    });

    expect(res.result).toBeDefined();
    const content = (res.result as any).content[0].text;
    const parsed = JSON.parse(content);
    expect(parsed.granted).toBe(true);
    expect(parsed.issueKey).toBe("KAN-42");
  });

  it("returns -32601 error for unknown tool", async () => {
    const server = new RovoMcpServer();
    const res = await server.handleRequest({
      jsonrpc: "2.0",
      id: "req-3",
      method: "tools/call",
      params: {
        name: "non_existent_tool",
      },
    });

    expect(res.error).toBeDefined();
    expect(res.error?.code).toBe(-32601);
  });
});
