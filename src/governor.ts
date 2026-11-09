import {
  BudgetLeaseRequest,
  BudgetLeaseResult,
  IssueBudgetRecord,
  LoopDetectionRequest,
  LoopDetectionResult,
} from "./types.js";

export class IssueCircuitGovernor {
  private budgets: Map<string, IssueBudgetRecord> = new Map();
  private defaultMaxBudgetUsd: number;

  constructor(defaultMaxBudgetUsd: number = 5.0) {
    this.defaultMaxBudgetUsd = defaultMaxBudgetUsd;
  }

  public getOrCreateBudget(issueKey: string, customLimit?: number): IssueBudgetRecord {
    let record = this.budgets.get(issueKey);
    if (!record) {
      record = {
        issueKey,
        maxBudgetUsd: customLimit ?? this.defaultMaxBudgetUsd,
        currentSpendUsd: 0.0,
        reservedSpendUsd: 0.0,
        isTripped: false,
        lastUpdated: new Date().toISOString(),
      };
      this.budgets.set(issueKey, record);
    }
    return record;
  }

  public reserveBudgetLease(request: BudgetLeaseRequest): BudgetLeaseResult {
    const record = this.getOrCreateBudget(request.issueKey);

    if (record.isTripped) {
      return {
        granted: false,
        issueKey: request.issueKey,
        currentSpendUsd: record.currentSpendUsd,
        remainingBudgetUsd: Math.max(0, record.maxBudgetUsd - record.currentSpendUsd),
        reason: `Circuit breaker already TRIPPED: ${record.tripReason}`,
      };
    }

    const projectedSpend =
      record.currentSpendUsd + record.reservedSpendUsd + request.requestedAmountUsd;

    if (projectedSpend > record.maxBudgetUsd) {
      record.isTripped = true;
      record.tripReason = `Projected spend ($${projectedSpend.toFixed(4)}) exceeds ceiling ($${record.maxBudgetUsd.toFixed(2)})`;
      record.lastUpdated = new Date().toISOString();

      return {
        granted: false,
        issueKey: request.issueKey,
        currentSpendUsd: record.currentSpendUsd,
        remainingBudgetUsd: Math.max(
          0,
          record.maxBudgetUsd - (record.currentSpendUsd + record.reservedSpendUsd)
        ),
        reason: record.tripReason,
      };
    }

    // Grant atomic lease
    record.reservedSpendUsd += request.requestedAmountUsd;
    record.lastUpdated = new Date().toISOString();

    return {
      granted: true,
      issueKey: request.issueKey,
      currentSpendUsd: record.currentSpendUsd,
      remainingBudgetUsd: record.maxBudgetUsd - (record.currentSpendUsd + record.reservedSpendUsd),
      reason: `Budget lease granted for agent '${request.agentId}' ($${request.requestedAmountUsd.toFixed(4)})`,
    };
  }

  public reconcileSpend(
    issueKey: string,
    reservedAmount: number,
    actualSpendAmount: number
  ): void {
    const record = this.getOrCreateBudget(issueKey);
    record.reservedSpendUsd = Math.max(0, record.reservedSpendUsd - reservedAmount);
    record.currentSpendUsd += actualSpendAmount;
    record.lastUpdated = new Date().toISOString();
  }

  public releaseReservation(issueKey: string, reservedAmount: number): void {
    const record = this.getOrCreateBudget(issueKey);
    record.reservedSpendUsd = Math.max(0, record.reservedSpendUsd - reservedAmount);
    record.lastUpdated = new Date().toISOString();
  }

  public detectTrajectoryLoop(request: LoopDetectionRequest): LoopDetectionResult {
    const threshold = request.similarityThreshold ?? 0.85;
    const actions = request.recentActions;

    if (actions.length < 3) {
      return {
        loopDetected: false,
        issueKey: request.issueKey,
        similarityScore: 0.0,
        repeatedActionsCount: 0,
        recommendation: "PROCEED",
        reason: "Insufficient action history (< 3 actions) to evaluate trajectory loops",
      };
    }

    // Inspect last 3 consecutive actions
    const window = actions.slice(-3);
    const textA = `${window[0].toolName}:${window[0].inputSummary}:${window[0].outputSummary}`.toLowerCase();
    const textB = `${window[1].toolName}:${window[1].inputSummary}:${window[1].outputSummary}`.toLowerCase();
    const textC = `${window[2].toolName}:${window[2].inputSummary}:${window[2].outputSummary}`.toLowerCase();

    const simAB = this.jaccardSimilarity(textA, textB);
    const simBC = this.jaccardSimilarity(textB, textC);
    const avgSimilarity = (simAB + simBC) / 2;

    if (avgSimilarity >= threshold) {
      const record = this.getOrCreateBudget(request.issueKey);
      record.isTripped = true;
      record.tripReason = `Repetitive loop detected across recent actions (similarity ${avgSimilarity.toFixed(2)} >= ${threshold})`;
      record.lastUpdated = new Date().toISOString();

      return {
        loopDetected: true,
        issueKey: request.issueKey,
        similarityScore: Math.round(avgSimilarity * 100) / 100,
        repeatedActionsCount: 3,
        recommendation: "HALT_CIRCUIT_BREAKER",
        reason: `Trajectory stagnation detected: Agent executed repeated failing actions with similarity ${avgSimilarity.toFixed(2)}. Tripped circuit breaker to prevent runaway spend.`,
      };
    }

    return {
      loopDetected: false,
      issueKey: request.issueKey,
      similarityScore: Math.round(avgSimilarity * 100) / 100,
      repeatedActionsCount: 0,
      recommendation: "PROCEED",
      reason: `Action trajectory is healthy (similarity ${avgSimilarity.toFixed(2)} < ${threshold})`,
    };
  }

  private jaccardSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.split(/\s+/));
    const set2 = new Set(str2.split(/\s+/));

    if (set1.size === 0 && set2.size === 0) return 1.0;
    if (set1.size === 0 || set2.size === 0) return 0.0;

    let intersectionCount = 0;
    for (const item of set1) {
      if (set2.has(item)) {
        intersectionCount++;
      }
    }

    const unionSize = new Set([...set1, ...set2]).size;
    return intersectionCount / unionSize;
  }
}
