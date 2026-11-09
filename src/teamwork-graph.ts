import { TeamworkGraphEvent } from "./types.js";

export interface TeamworkGraphNode {
  id: string;
  type: string;
  properties: Record<string, unknown>;
}

export class TeamworkGraphClient {
  private events: TeamworkGraphEvent[] = [];
  private nodes: Map<string, TeamworkGraphNode> = new Map();

  public async recordEvent(event: TeamworkGraphEvent): Promise<{ success: boolean; eventId: string }> {
    const eventId = `twg_evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.events.push(event);

    // Upsert or update node in Teamwork Graph
    const nodeId = `jira:issue:${event.issueKey}`;
    const existingNode = this.nodes.get(nodeId);

    this.nodes.set(nodeId, {
      id: nodeId,
      type: "JiraIssueGovernance",
      properties: {
        ...(existingNode?.properties ?? {}),
        lastEvent: event.eventType,
        lastUpdated: event.timestamp,
        circuitBreakerStatus:
          event.eventType === "CIRCUIT_BREAKER_TRIPPED" || event.eventType === "LOOP_DETECTED"
            ? "TRIPPED"
            : "ACTIVE",
      },
    });

    return {
      success: true,
      eventId,
    };
  }

  public getEventsForIssue(issueKey: string): TeamworkGraphEvent[] {
    return this.events.filter((e) => e.issueKey === issueKey);
  }

  public getNode(nodeId: string): TeamworkGraphNode | undefined {
    return this.nodes.get(nodeId);
  }
}
