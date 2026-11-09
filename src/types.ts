export interface IssueBudgetRecord {
  issueKey: string;
  maxBudgetUsd: number;
  currentSpendUsd: number;
  reservedSpendUsd: number;
  isTripped: boolean;
  tripReason?: string;
  lastUpdated: string;
}

export interface BudgetLeaseRequest {
  issueKey: string;
  requestedAmountUsd: number;
  agentId: string;
  actionDescription: string;
}

export interface BudgetLeaseResult {
  granted: boolean;
  issueKey: string;
  currentSpendUsd: number;
  remainingBudgetUsd: number;
  reason: string;
}

export interface TrajectoryAction {
  timestamp: string;
  agentId: string;
  toolName: string;
  inputSummary: string;
  outputSummary: string;
}

export interface LoopDetectionRequest {
  issueKey: string;
  recentActions: TrajectoryAction[];
  similarityThreshold?: number; // default 0.85
}

export interface LoopDetectionResult {
  loopDetected: boolean;
  issueKey: string;
  similarityScore: number;
  repeatedActionsCount: number;
  recommendation: "PROCEED" | "HALT_CIRCUIT_BREAKER" | "ESCALATE_TO_HUMAN";
  reason: string;
}

export interface TeamworkGraphEvent {
  eventType: "BUDGET_RESERVED" | "BUDGET_RECONCILED" | "CIRCUIT_BREAKER_TRIPPED" | "LOOP_DETECTED";
  issueKey: string;
  agentId: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}
