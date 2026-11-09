import { describe, it, expect, beforeEach } from "vitest";
import { IssueCircuitGovernor } from "../src/governor.js";

describe("IssueCircuitGovernor", () => {
  let governor: IssueCircuitGovernor;

  beforeEach(() => {
    governor = new IssueCircuitGovernor(1.0); // $1.00 budget ceiling for tests
  });

  it("grants atomic budget reservation under the ceiling", () => {
    const res = governor.reserveBudgetLease({
      issueKey: "PROJ-101",
      requestedAmountUsd: 0.35,
      agentId: "agent-triage",
      actionDescription: "Summarize issue requirements",
    });

    expect(res.granted).toBe(true);
    expect(res.remainingBudgetUsd).toBeCloseTo(0.65, 2);
  });

  it("trips circuit breaker when cumulative reservation exceeds limit", () => {
    // 1st lease: $0.80 -> approved
    const res1 = governor.reserveBudgetLease({
      issueKey: "PROJ-102",
      requestedAmountUsd: 0.8,
      agentId: "agent-planner",
      actionDescription: "Plan test architecture",
    });
    expect(res1.granted).toBe(true);

    // 2nd lease: $0.40 -> ($0.80 + $0.40 = $1.20 > $1.00) -> tripped!
    const res2 = governor.reserveBudgetLease({
      issueKey: "PROJ-102",
      requestedAmountUsd: 0.4,
      agentId: "agent-coder",
      actionDescription: "Generate code",
    });
    expect(res2.granted).toBe(false);
    expect(res2.reason).toContain("exceeds ceiling");

    const budget = governor.getOrCreateBudget("PROJ-102");
    expect(budget.isTripped).toBe(true);
  });

  it("reconciles actual spend and frees unused reservation", () => {
    governor.reserveBudgetLease({
      issueKey: "PROJ-103",
      requestedAmountUsd: 0.5,
      agentId: "agent-reviewer",
      actionDescription: "Review PR diff",
    });

    // Reconcile: reserved $0.50, actual spend was only $0.30
    governor.reconcileSpend("PROJ-103", 0.5, 0.3);

    const budget = governor.getOrCreateBudget("PROJ-103");
    expect(budget.currentSpendUsd).toBe(0.3);
    expect(budget.reservedSpendUsd).toBe(0.0);
    expect(budget.isTripped).toBe(false);
  });

  it("detects trajectory loops when consecutive actions repeat identically", () => {
    const actions = [
      {
        timestamp: "2026-11-09T10:00:00Z",
        agentId: "agent-fixer",
        toolName: "run_build",
        inputSummary: "npm run build --target=production",
        outputSummary: "Error: TS2304 Cannot find name 'foo'",
      },
      {
        timestamp: "2026-11-09T10:01:00Z",
        agentId: "agent-fixer",
        toolName: "run_build",
        inputSummary: "npm run build --target=production",
        outputSummary: "Error: TS2304 Cannot find name 'foo'",
      },
      {
        timestamp: "2026-11-09T10:02:00Z",
        agentId: "agent-fixer",
        toolName: "run_build",
        inputSummary: "npm run build --target=production",
        outputSummary: "Error: TS2304 Cannot find name 'foo'",
      },
    ];

    const result = governor.detectTrajectoryLoop({
      issueKey: "PROJ-104",
      recentActions: actions,
      similarityThreshold: 0.85,
    });

    expect(result.loopDetected).toBe(true);
    expect(result.recommendation).toBe("HALT_CIRCUIT_BREAKER");
    expect(result.similarityScore).toBe(1.0);

    const budget = governor.getOrCreateBudget("PROJ-104");
    expect(budget.isTripped).toBe(true);
  });

  it("allows healthy progressing trajectories without tripping loop detection", () => {
    const actions = [
      {
        timestamp: "2026-11-09T10:00:00Z",
        agentId: "agent-fixer",
        toolName: "read_file",
        inputSummary: "src/utils.ts line 10-50",
        outputSummary: "Found export function helper",
      },
      {
        timestamp: "2026-11-09T10:01:00Z",
        agentId: "agent-fixer",
        toolName: "edit_file",
        inputSummary: "src/utils.ts replace helper logic",
        outputSummary: "Replaced 1 occurrence cleanly",
      },
      {
        timestamp: "2026-11-09T10:02:00Z",
        agentId: "agent-fixer",
        toolName: "run_tests",
        inputSummary: "npm test test/utils.test.ts",
        outputSummary: "3 passed in 0.5s",
      },
    ];

    const result = governor.detectTrajectoryLoop({
      issueKey: "PROJ-105",
      recentActions: actions,
      similarityThreshold: 0.85,
    });

    expect(result.loopDetected).toBe(false);
    expect(result.recommendation).toBe("PROCEED");
    expect(result.similarityScore).toBeLessThan(0.85);
  });
});
