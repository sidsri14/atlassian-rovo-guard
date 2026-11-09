# Devpost Submission Dossier: Atlassian Circuit Guard (`atlassian-rovo-guard`)

**Target Challenge:** [Codegeist 2026: Build with context. Ship with confidence.](https://devpost.com) ($120,000+ Total Prize Pool)  
**Host:** Atlassian  
**Target Tracks:**
* **Main Track:** Apps for Software Teams ($15,000 1st Place)
* **Bonus 1:** Best App with Atlassian MCP ($1,500)
* **Bonus 2:** Best Agents (Rovo / Assignable Agents) ($1,500)
* **Bonus 3:** Best Apps with Teamwork Graph Integration ($1,500)
**Repository:** [`https://github.com/sidsri14/atlassian-rovo-guard`](https://github.com/sidsri14/atlassian-rovo-guard)  
**Author:** Siddharth Srivastava ([@sidsri14](https://github.com/sidsri14))  
**Email:** `sidsri1502@gmail.com` | **PayPal Payout:** `sidsri1302@gmail.com`  

---

## 1. Project Title & Pitch
* **Title:** Circuit Guard: Autonomous Rovo Agent & MCP Circuit Breaker for Jira & Bitbucket
* **Elevator Pitch:** An Atlassian Forge app that exposes an MCP governance server to Rovo agents, enforcing atomic budget leases per Jira issue, catching repetitive tool retry loops before budgets blow up, and synchronizing governance telemetry directly into the Atlassian Teamwork Graph.

---

## 2. Inspiration
Autonomous software agents (like Atlassian Rovo, GitHub Copilot Workspace, and automated test generators) are transforming development velocity. However, when agents face ambiguous requirements or failing build steps, they often enter runaway retry loops—burning through expensive LLM tokens and cluttering Jira issues with repetitive comments.

We asked: *Why are agent budgets managed post-facto on external dashboards rather than governed proactively inside the Atlassian platform where work actually happens?*

We built **Circuit Guard** to give software engineering leads native, deterministic circuit-breaker protection directly inside Jira and Rovo.

---

## 3. What It Does
1. **Model Context Protocol (MCP) Governance Server:** Implements standard JSON-RPC 2.0 MCP tools (`check_issue_budget_lease`, `detect_trajectory_loop`, `sync_teamwork_graph`) that Rovo agents query before triggering expensive actions.
2. **Pre-Execution Atomic Budget Lease:** Sets hard financial and token ceilings per Jira issue. If an impending agent action would breach the ceiling, the lease is denied and the circuit breaker trips fail-closed.
3. **Trajectory Stagnation & Loop Detection:** Evaluates consecutive agent tool executions and comments using Jaccard similarity. If an agent repeats the same failing pattern with $\ge 85\%$ similarity, Circuit Guard halts execution and recommends human escalation.
4. **Teamwork Graph Synchronization:** Persists every budget reservation, spend reconciliation, and tripped circuit breaker event into Atlassian Teamwork Graph nodes, connecting issue governance with team observability.
5. **Jira Issue Panel (Forge UI):** Renders a real-time HUD on every Jira issue displaying current spend vs ceiling, reservation status, and audit logs.

---

## 4. How We Built It
* **Platform:** Atlassian Forge (Node.js runtime, Forge manifest with `rovo:agent`, `rovo:mcp`, and `jira:issuePanel` modules).
* **Protocol:** Model Context Protocol (MCP) JSON-RPC specification.
* **Language & Testing:** TypeScript 5.5+, Vitest (10/10 automated tests passing).
* **Graph Integration:** Atlassian Teamwork Graph node & edge event dispatcher.

---

## 5. Accomplishments
* End-to-end integration combining Rovo Agent, MCP Server, Teamwork Graph, and Jira Issue Panel in a single unified Forge application.
* Mathematical trajectory diffing preventing runaway token drain in autonomous coding and triage workflows.
* 100% automated test coverage across governor invariants, MCP protocol requests, and Teamwork Graph event publishing.
