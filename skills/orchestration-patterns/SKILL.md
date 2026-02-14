---
name: orchestration-patterns
description: Apply proven orchestration patterns for agent teams including parallel specialists, pipelines, swarms, research+implementation, plan approval, and multi-file refactoring. Use when choosing a team structure, designing workflows, or implementing specific coordination patterns.
---

# Orchestration Patterns

Proven patterns for structuring agent teams. Choose the right pattern based on your task's coordination needs.

**Related skills:**
- [Orchestrating](../orchestrating/SKILL.md) - Primitives overview and quick reference
- [Team Management](../team-management/SKILL.md) - Team lifecycle tools
- [Task System](../task-system/SKILL.md) - Task creation and dependencies
- [Messaging](../messaging/SKILL.md) - Inter-agent communication
- [Agent Types](../agent-types/SKILL.md) - Choosing the right agent for each role

**See also:** [Complete Workflows](examples/complete-workflows.md) for full end-to-end examples.

---

## Pattern Selection Guide

| Pattern | When to Use | Coordination | Dependencies |
|---------|------------|--------------|-------------|
| [Parallel Specialists](#pattern-1-parallel-specialists) | Multiple independent reviews | Low | None |
| [Pipeline](#pattern-2-pipeline) | Sequential stages | Medium | Linear chain |
| [Swarm](#pattern-3-swarm) | Many similar independent tasks | Low | None |
| [Research + Implementation](#pattern-4-research--implementation) | Learn then build | Low | Phase gate |
| [Plan Approval](#pattern-5-plan-approval) | High-risk changes | High | Approval gate |
| [Multi-File Refactoring](#pattern-6-coordinated-multi-file-refactoring) | Cross-file changes | Medium | Fan-in |
| [RLM (Recursive Language Model)](#pattern-7-rlm-recursive-language-model) | Files exceeding context limits | Medium | Fan-out/fan-in |

---

## Pattern 1: Parallel Specialists

Multiple specialists review code simultaneously, each with a different lens:

```javascript
// 1. Create team
TeamCreate({ team_name: "code-review", description: "Parallel code review" })

// 2. Spawn specialists in parallel (single message, multiple Task calls)
Task({
  team_name: "code-review",
  name: "security",
  subagent_type: "sdlc:security-reviewer",
  prompt: "Review the PR for security vulnerabilities. Focus on: SQL injection, XSS, auth bypass. Send findings to team-lead.",
  run_in_background: true
})

Task({
  team_name: "code-review",
  name: "quality",
  subagent_type: "feature-dev:code-reviewer",
  prompt: "Review the PR for bugs, logic errors, and performance issues. Focus on: N+1 queries, memory leaks, slow algorithms. Send findings to team-lead.",
  run_in_background: true
})

Task({
  team_name: "code-review",
  name: "simplicity",
  subagent_type: "code-simplifier:code-simplifier",
  prompt: "Review the PR for unnecessary complexity. Focus on: over-engineering, premature abstraction, YAGNI violations. Send findings to team-lead.",
  run_in_background: true
})

// 3. Wait for results (messages arrive automatically)
// 4. Synthesize findings and cleanup
SendMessage({ type: "shutdown_request", recipient: "security", content: "Done" })
SendMessage({ type: "shutdown_request", recipient: "quality", content: "Done" })
SendMessage({ type: "shutdown_request", recipient: "simplicity", content: "Done" })
// Wait for approvals...
TeamDelete()
```

**Best for:** Code reviews, audits, multi-perspective analysis.

---

## Pattern 2: Pipeline

Each stage depends on the previous:

```javascript
// 1. Create team and task pipeline
TeamCreate({ team_name: "feature-pipeline", description: "Feature development pipeline" })

TaskCreate({ subject: "Research", description: "Research best practices for the feature", activeForm: "Researching..." })
TaskCreate({ subject: "Plan", description: "Create implementation plan based on research", activeForm: "Planning..." })
TaskCreate({ subject: "Implement", description: "Implement the feature according to plan", activeForm: "Implementing..." })
TaskCreate({ subject: "Test", description: "Write and run tests for the implementation", activeForm: "Testing..." })
TaskCreate({ subject: "Review", description: "Final code review before merge", activeForm: "Reviewing..." })

// Set up sequential dependencies
TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })
TaskUpdate({ taskId: "3", addBlockedBy: ["2"] })
TaskUpdate({ taskId: "4", addBlockedBy: ["3"] })
TaskUpdate({ taskId: "5", addBlockedBy: ["4"] })

// 2. Spawn workers that claim and complete tasks
Task({
  team_name: "feature-pipeline",
  name: "researcher",
  subagent_type: "adr:adr-researcher",
  prompt: "Claim task #1, research best practices, complete it, send findings to team-lead. Then check for more work.",
  run_in_background: true
})

Task({
  team_name: "feature-pipeline",
  name: "implementer",
  subagent_type: "general-purpose",
  prompt: "Poll TaskList. When task #3 unblocks, claim it and implement. Then complete and notify team-lead.",
  run_in_background: true
})

// Tasks auto-unblock as dependencies complete
```

**Best for:** Multi-phase features, structured workflows where each step builds on the previous.

---

## Pattern 3: Swarm

Workers grab available tasks from a pool (self-organizing):

```javascript
// 1. Create team and task pool
TeamCreate({ team_name: "file-review-swarm", description: "Self-organizing file review" })

// Create many independent tasks (no dependencies)
// TaskCreate for each file: auth.rb, user.rb, api_controller.rb, payment.rb, etc.

// 2. Spawn worker swarm
const swarmPrompt = `
  You are a swarm worker. Your job:
  1. Call TaskList to see available tasks
  2. Find a task with status 'pending' and no owner
  3. Claim it with TaskUpdate (set owner to your name)
  4. Do the work
  5. Mark it completed with TaskUpdate
  6. Send findings to team-lead
  7. Repeat until no tasks remain
`

Task({ team_name: "file-review-swarm", name: "worker-1", subagent_type: "general-purpose", prompt: swarmPrompt, run_in_background: true })
Task({ team_name: "file-review-swarm", name: "worker-2", subagent_type: "general-purpose", prompt: swarmPrompt, run_in_background: true })
Task({ team_name: "file-review-swarm", name: "worker-3", subagent_type: "general-purpose", prompt: swarmPrompt, run_in_background: true })

// Workers race to claim tasks, naturally load-balance
```

**Best for:** Many similar, independent tasks (file reviews, migrations, test writing).

---

## Pattern 4: Research + Implementation

Research first, then implement with findings:

```javascript
// 1. Research phase (synchronous, returns results)
const research = await Task({
  subagent_type: "adr:adr-researcher",
  description: "Research caching patterns",
  prompt: "Research best practices for implementing caching in APIs. Include: cache invalidation strategies, Redis vs Memcached, cache key design."
})

// 2. Use research to guide implementation
Task({
  subagent_type: "general-purpose",
  description: "Implement caching",
  prompt: `
    Implement API caching based on this research:

    ${research.content}

    Focus on the user_controller.rb endpoints.
  `
})
```

**Best for:** When implementation benefits from prior research. No team needed - uses plain subagents.

---

## Pattern 5: Plan Approval

Require plan approval before implementation (high-risk changes):

```javascript
// 1. Create team
TeamCreate({ team_name: "careful-work", description: "Plan-approved implementation" })

// 2. Spawn architect with plan mode required
Task({
  team_name: "careful-work",
  name: "architect",
  subagent_type: "Plan",
  prompt: "Design an implementation plan for adding OAuth2 authentication",
  mode: "plan",  // Requires plan approval
  run_in_background: true
})

// 3. Wait for plan approval request
// You'll receive: {"type": "plan_approval_request", ...}

// 4. Review and approve/reject
SendMessage({
  type: "plan_approval_response",
  request_id: "plan-xxx",
  recipient: "architect",
  approve: true
})
// OR reject with feedback:
SendMessage({
  type: "plan_approval_response",
  request_id: "plan-xxx",
  recipient: "architect",
  approve: false,
  content: "Please add rate limiting considerations"
})
```

**Best for:** Database migrations, security-sensitive changes, architectural decisions.

---

## Pattern 6: Coordinated Multi-File Refactoring

```javascript
// 1. Create team for coordinated refactoring
TeamCreate({ team_name: "refactor-auth", description: "Auth module refactoring" })

// 2. Create tasks with clear file boundaries
TaskCreate({
  subject: "Refactor User model",
  description: "Extract authentication methods to AuthenticatableUser concern",
  activeForm: "Refactoring User model..."
})

TaskCreate({
  subject: "Refactor Session controller",
  description: "Update to use new AuthenticatableUser concern",
  activeForm: "Refactoring Sessions..."
})

TaskCreate({
  subject: "Update specs",
  description: "Update all authentication specs for new structure",
  activeForm: "Updating specs..."
})

// Dependencies: specs depend on both refactors completing
TaskUpdate({ taskId: "3", addBlockedBy: ["1", "2"] })

// 3. Spawn workers for each task
Task({
  team_name: "refactor-auth",
  name: "model-worker",
  subagent_type: "general-purpose",
  prompt: "Claim task #1, refactor the User model, complete when done",
  run_in_background: true
})

Task({
  team_name: "refactor-auth",
  name: "controller-worker",
  subagent_type: "general-purpose",
  prompt: "Claim task #2, refactor the Session controller, complete when done",
  run_in_background: true
})

Task({
  team_name: "refactor-auth",
  name: "spec-worker",
  subagent_type: "general-purpose",
  prompt: "Wait for task #3 to unblock (when #1 and #2 complete), then update specs",
  run_in_background: true
})
```

**Best for:** Refactoring across multiple files with fan-in dependencies.

---

## Pattern 7: RLM (Recursive Language Model)

Divide large files into partitions, analyze each with a parallel agent team, then synthesize.

**When to use:** Large log analysis, data exports, full-codebase review, CSV processing — any content that exceeds context limits (~1500 lines).

**How it works:**
1. Team lead detects content type and determines partitioning strategy
2. Team lead creates a team (`TeamCreate`) and tasks (`TaskCreate`, one per partition)
3. Team lead spawns analyst **teammates** (scaled to partition count, with `team_name` + `name`) — NOT plain subagents
4. Each analyst processes its pre-assigned chunk (1 analyst per partition, fresh context), writes findings to task description via `TaskUpdate`, and sends a one-line summary via `SendMessage`
5. Team lead collects inbox messages and synthesizes (or spawns a synthesizer teammate)
6. Graceful shutdown (`SendMessage` shutdown requests) and cleanup (`TeamDelete`)

```javascript
// Create team and partition tasks
TeamCreate({ team_name: "rlm-analysis", description: "RLM analysis of large file" })
TaskCreate({ subject: "Analyze chunk 1/8", description: "File: path\nStart: 1\nEnd: 1100\nQuery: ...", activeForm: "Analyzing..." })
// ... more TaskCreate calls

// Spawn 1 analyst TEAMMATE per partition (fresh context each, staged in batches of ~15)
Task({ team_name: "rlm-analysis", name: "analyst-1", subagent_type: "swarm:rlm-chunk-analyzer", prompt: "Analyze chunk 1...", run_in_background: true })
Task({ team_name: "rlm-analysis", name: "analyst-2", subagent_type: "swarm:rlm-chunk-analyzer", prompt: "Analyze chunk 2...", run_in_background: true })
// ... 1 analyst per partition

// Collect inbox messages, synthesize, shutdown, cleanup
```

**CRITICAL:** Analysts must be teammates, not plain subagents. Plain subagents dump full output into the leader's context (8 x 4K = 32K chars), causing context exhaustion. Teammates communicate via inbox messages.

**Agent recommendations:**
- Analysts: Content-type-specific (`swarm:rlm-code-analyzer`, `swarm:rlm-data-analyzer`, `swarm:rlm-json-analyzer`, or `swarm:rlm-chunk-analyzer`)
- Synthesizer: `swarm:rlm-synthesizer` (Sonnet)

**See also:** [RLM Pattern](../rlm-pattern/SKILL.md) for content-type detection, partitioning strategies, and full team lifecycle.

### Multi-File Variant

For directories with mixed content types, the RLM pattern extends to multi-file mode:
- Per-file content-type detection and mixed analyst types in one team
- Tiered partition budget (small/medium/large files) with data-driven sizing
- Small files of the same type batched into single analyst tasks
- Two-phase synthesis: per-type (parallel) then cross-type (sequential)
- Findings written to task descriptions (not SendMessage) to protect Team Lead context
- 1 analyst per task (fresh context each), staged spawning in batches of ~15 for large workloads

See [Multi-File Directory Analysis](../rlm-pattern/SKILL.md#multi-file-directory-analysis) for the full specification and [Multi-File RLM Design](../../docs/design/multi-file-rlm.md) for the design document.

---

## Best Practices

### 1. Always Cleanup
Don't leave orphaned teams. Always call `TeamDelete()` when done.

### 2. Use Meaningful Names
```javascript
// Good
name: "security-reviewer"
name: "oauth-implementer"
name: "test-writer"

// Bad
name: "worker-1"
name: "agent-2"
```

### 3. Write Clear Prompts
Tell workers exactly what to do:
```javascript
// Good
prompt: `
  1. Review app/models/user.rb for N+1 queries
  2. Check all ActiveRecord associations have proper includes
  3. Document any issues found
  4. Send findings to team-lead
`

// Bad
prompt: "Review the code"
```

### 4. Use Task Dependencies
Let the system manage unblocking:
```javascript
// Good: Auto-unblocking
TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })

// Bad: Manual polling
"Wait until task #1 is done, check every 30 seconds..."
```

### 5. Give Teammates Enough Context
Teammates load project context (CLAUDE.md, MCP servers, skills) but don't inherit the lead's conversation history. Include task-specific details in the spawn prompt.

### 6. Start with Research and Review
If you're new to agent teams, start with tasks that have clear boundaries and don't require writing code: reviewing a PR, researching a library, or investigating a bug.

### 7. Avoid File Conflicts
Two teammates editing the same file leads to overwrites. Break work so each teammate owns a different set of files.

### 8. Use Pass-by-Reference for Large Content

Never paste file content into prompts. Pass file paths and line ranges instead:

```javascript
// Good: Pass by reference
prompt: "Read /path/to/file.log lines 1-200 and analyze for errors"

// Bad: Paste content into prompt
prompt: `Analyze this content: ${fileContent}`
```

This is critical for the RLM pattern where chunks can be large. Analyzers should read files directly using the Read tool.
