import { describe, it, expect } from "vitest";
import { TeamworkGraphClient } from "../src/teamwork-graph.js";

describe("TeamworkGraphClient", () => {
  it("records events and updates governance nodes in the Teamwork Graph", async () => {
    const client = new TeamworkGraphClient();

    const res = await client.recordEvent({
      eventType: "BUDGET_RESERVED",
      issueKey: "ENG-88",
      agentId: "agent-qa",
      metadata: { reservedUsd: 0.25 },
      timestamp: new Date().toISOString(),
    });

    expect(res.success).toBe(true);
    expect(res.eventId).toContain("twg_evt_");

    const events = client.getEventsForIssue("ENG-88");
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe("BUDGET_RESERVED");

    const node = client.getNode("jira:issue:ENG-88");
    expect(node).toBeDefined();
    expect(node?.properties.circuitBreakerStatus).toBe("ACTIVE");
  });

  it("marks circuit breaker status as TRIPPED upon loop detection", async () => {
    const client = new TeamworkGraphClient();

    await client.recordEvent({
      eventType: "LOOP_DETECTED",
      issueKey: "ENG-89",
      agentId: "circuit-guard-governor",
      metadata: { similarityScore: 0.95 },
      timestamp: new Date().toISOString(),
    });

    const node = client.getNode("jira:issue:ENG-89");
    expect(node?.properties.circuitBreakerStatus).toBe("TRIPPED");
  });
});
