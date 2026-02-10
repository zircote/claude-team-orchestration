# Complete Workflows

Full end-to-end workflow examples for agent teams. See [Orchestration Patterns](../SKILL.md) for pattern descriptions and selection guidance.

---

## Workflow 1: Full Code Review with Parallel Specialists

```javascript
// === STEP 1: Setup ===
TeamCreate({ team_name: "pr-review-123", description: "Reviewing PR #123" })

// === STEP 2: Spawn reviewers in parallel ===
// (Send all these in a single message for parallel execution)
Task({
  team_name: "pr-review-123",
  name: "security",
  subagent_type: "sdlc:security-reviewer",
  prompt: `Review PR #123 for security vulnerabilities.

  Focus on:
  - SQL injection
  - XSS vulnerabilities
  - Authentication/authorization bypass
  - Sensitive data exposure

  When done, send your findings to team-lead using:
  SendMessage({ type: "message", recipient: "team-lead", content: "Your findings here", summary: "Security review findings" })`,
  run_in_background: true
})

Task({
  team_name: "pr-review-123",
  name: "quality",
  subagent_type: "feature-dev:code-reviewer",
  prompt: `Review PR #123 for bugs, performance, and code quality issues.

  Focus on:
  - N+1 queries
  - Missing indexes
  - Memory leaks
  - Inefficient algorithms
  - Logic errors

  Send findings to team-lead when done.`,
  run_in_background: true
})

Task({
  team_name: "pr-review-123",
  name: "arch",
  subagent_type: "refactor:architect",
  prompt: `Review PR #123 for architectural concerns.

  Focus on:
  - Design pattern adherence
  - SOLID principles
  - Separation of concerns
  - Testability

  Send findings to team-lead when done.`,
  run_in_background: true
})

// === STEP 3: Monitor and collect results ===
// Messages arrive automatically from teammates

// === STEP 4: Synthesize findings ===
// Combine all reviewer findings into a cohesive report

// === STEP 5: Cleanup ===
SendMessage({ type: "shutdown_request", recipient: "security", content: "Review complete" })
SendMessage({ type: "shutdown_request", recipient: "quality", content: "Review complete" })
SendMessage({ type: "shutdown_request", recipient: "arch", content: "Review complete" })
// Wait for approvals...
TeamDelete()
```

---

## Workflow 2: Research -> Plan -> Implement -> Test Pipeline

```javascript
// === SETUP ===
TeamCreate({ team_name: "feature-oauth", description: "OAuth2 implementation" })

// === CREATE PIPELINE ===
TaskCreate({ subject: "Research OAuth providers", description: "Research OAuth2 best practices and compare providers (Google, GitHub, Auth0)", activeForm: "Researching OAuth..." })
TaskCreate({ subject: "Create implementation plan", description: "Design OAuth implementation based on research findings", activeForm: "Planning..." })
TaskCreate({ subject: "Implement OAuth", description: "Implement OAuth2 authentication according to plan", activeForm: "Implementing OAuth..." })
TaskCreate({ subject: "Write tests", description: "Write comprehensive tests for OAuth implementation", activeForm: "Writing tests..." })
TaskCreate({ subject: "Final review", description: "Review complete implementation for security and quality", activeForm: "Final review..." })

// Set dependencies
TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })
TaskUpdate({ taskId: "3", addBlockedBy: ["2"] })
TaskUpdate({ taskId: "4", addBlockedBy: ["3"] })
TaskUpdate({ taskId: "5", addBlockedBy: ["4"] })

// === SPAWN SPECIALIZED WORKERS ===
Task({
  team_name: "feature-oauth",
  name: "researcher",
  subagent_type: "adr:adr-researcher",
  prompt: "Claim task #1. Research OAuth2 best practices, compare providers, document findings. Mark task complete and send summary to team-lead.",
  run_in_background: true
})

Task({
  team_name: "feature-oauth",
  name: "planner",
  subagent_type: "Plan",
  prompt: "Wait for task #2 to unblock. Read research from task #1. Create detailed implementation plan. Mark complete and send plan to team-lead.",
  run_in_background: true
})

Task({
  team_name: "feature-oauth",
  name: "implementer",
  subagent_type: "general-purpose",
  prompt: "Wait for task #3 to unblock. Read plan from task #2. Implement OAuth2 authentication. Mark complete when done.",
  run_in_background: true
})

Task({
  team_name: "feature-oauth",
  name: "tester",
  subagent_type: "general-purpose",
  prompt: "Wait for task #4 to unblock. Write comprehensive tests for the OAuth implementation. Run tests. Mark complete with results.",
  run_in_background: true
})

Task({
  team_name: "feature-oauth",
  name: "reviewer",
  subagent_type: "sdlc:security-reviewer",
  prompt: "Wait for task #5 to unblock. Review the complete OAuth implementation for security. Send final assessment to team-lead.",
  run_in_background: true
})

// Pipeline auto-progresses as each stage completes
```

---

## Workflow 3: Self-Organizing Code Review Swarm

```javascript
// === SETUP ===
TeamCreate({ team_name: "codebase-review", description: "Full codebase review" })

// === CREATE TASK POOL (all independent, no dependencies) ===
const filesToReview = [
  "app/models/user.rb",
  "app/models/payment.rb",
  "app/controllers/api/v1/users_controller.rb",
  "app/controllers/api/v1/payments_controller.rb",
  "app/services/payment_processor.rb",
  "app/services/notification_service.rb",
  "lib/encryption_helper.rb"
]

for (const file of filesToReview) {
  TaskCreate({
    subject: `Review ${file}`,
    description: `Review ${file} for security vulnerabilities, code quality, and performance issues`,
    activeForm: `Reviewing ${file}...`
  })
}

// === SPAWN WORKER SWARM ===
const swarmPrompt = `
You are a swarm worker. Your job is to continuously process available tasks.

LOOP:
1. Call TaskList() to see available tasks
2. Find a task that is:
   - status: 'pending'
   - no owner
   - not blocked
3. If found:
   - Claim it: TaskUpdate({ taskId: "X", owner: "YOUR_NAME" })
   - Start it: TaskUpdate({ taskId: "X", status: "in_progress" })
   - Do the review work
   - Complete it: TaskUpdate({ taskId: "X", status: "completed" })
   - Send findings to team-lead via SendMessage
   - Go back to step 1
4. If no tasks available:
   - Send idle notification to team-lead
   - Wait 30 seconds
   - Try again (up to 3 times)
   - If still no tasks, exit

Replace YOUR_NAME with your actual agent name from $CLAUDE_CODE_AGENT_NAME.
`

// Spawn 3 workers
Task({ team_name: "codebase-review", name: "worker-1", subagent_type: "general-purpose", prompt: swarmPrompt, run_in_background: true })
Task({ team_name: "codebase-review", name: "worker-2", subagent_type: "general-purpose", prompt: swarmPrompt, run_in_background: true })
Task({ team_name: "codebase-review", name: "worker-3", subagent_type: "general-purpose", prompt: swarmPrompt, run_in_background: true })

// Workers self-organize: race to claim tasks, naturally load-balance
// Monitor progress with TaskList() or by reading inbox
```

---

## Workflow 4: RLM Document Analysis

**Scenario:** Analyze an 8500-line production log for error patterns and root causes.

**Prompt:**
```
Analyze production.log (8500 lines) for error patterns and root causes.

1. Team Lead: Determine file size. If too large for context, partition into
   ~10 chunks of 200 lines each (with 20-line overlap). Use Grep to scout
   for error-dense regions first — only create chunks for relevant sections.

2. Each of 3-5 Analyst agents: Read your assigned chunk(s), identify error
   patterns, categorize by type (database, auth, memory, etc.), note
   timestamps and frequency, and report structured findings back to team-lead.

3. Team Lead: Synthesize all analyst reports into a consolidated analysis with:
   - Error pattern summary ranked by frequency
   - Root cause analysis with cascading failure chains
   - Timeline of events
   - Recommendations for prevention
```

**What happens:**
1. Team lead checks file size with `wc -l` — 8500 lines, too large
2. Team lead uses Grep to find error clusters (lines 2000-4000 and 7000-8000)
3. Team lead creates team and spawns 3-5 analyst agents with targeted line ranges
4. Each analyst reads their chunk, analyzes for errors, and messages findings to team lead
5. Team lead collects all reports and produces the consolidated analysis
6. Team shuts down and cleans up

**Agent recommendations:**
- Analysts: `swarm:rlm-chunk-analyzer` (Haiku — fast and cheap for per-chunk analysis)
- Synthesizer (optional): `swarm:rlm-synthesizer` (Sonnet — for complex cross-chunk synthesis)
