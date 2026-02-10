# Orchestration Patterns

Seven proven patterns for structuring agent teams. Choose based on your task's coordination needs.

---

## Pattern Selection Guide

| Pattern | When to Use | Agents | Dependencies |
|---------|------------|--------|-------------|
| [Parallel Specialists](#parallel-specialists) | Multiple independent reviews | 2-5 | None |
| [Pipeline](#pipeline) | Sequential stages | 3-5 | Linear chain |
| [Swarm](#swarm) | Many similar tasks | 3-5 | None |
| [Research + Implementation](#research--implementation) | Learn then build | 2 | Phase gate |
| [Plan Approval](#plan-approval) | High-risk changes | 1-2 | Approval gate |
| [Multi-File Refactoring](#multi-file-refactoring) | Cross-file changes | 2-4 | Fan-in |
| [RLM (Recursive Language Model)](#rlm-recursive-language-model) | Files exceeding context | 3-5 | Fan-out/fan-in |

---

## Parallel Specialists

Multiple specialists work simultaneously, each with a different focus.

**When to use:** Code reviews, audits, multi-perspective analysis. Tasks are independent and don't share data.

**Example prompt:**
```
Create a team to review PR #42 with three specialists:
- Security reviewer for vulnerabilities
- Code reviewer for bugs and performance
- Architecture reviewer for design concerns
Have each send findings to team-lead, then synthesize.
```

**How it works:**
1. Create team, spawn specialists in parallel
2. Each reviews independently through its own lens
3. Findings arrive as messages to the lead
4. Lead synthesizes into unified report
5. Shutdown and cleanup

**Agent recommendations:**
- Security: `sdlc:security-reviewer`
- Quality: `feature-dev:code-reviewer`
- Architecture: `refactor:architect`
- Simplicity: `code-simplifier:code-simplifier`

---

## Pipeline

Each stage depends on the previous. Work flows linearly through phases.

**When to use:** Feature development, multi-phase workflows where each step builds on the last.

**Example prompt:**
```
Create a pipeline team for OAuth2:
1. Research best practices (adr:adr-researcher)
2. Create implementation plan (Plan agent)
3. Implement (general-purpose)
4. Write tests (general-purpose)
5. Final security review (sdlc:security-reviewer)

Each stage should wait for the previous to complete.
```

**How it works:**
1. Create team and all tasks upfront
2. Set task dependencies: #2 blocked by #1, #3 blocked by #2, etc.
3. Spawn all workers at once — they'll wait for their dependencies
4. As each task completes, the next auto-unblocks
5. Workers claim and complete newly available tasks

**Key detail:** Use `TaskUpdate` with `addBlockedBy` to create the dependency chain. The system auto-unblocks tasks when dependencies complete.

---

## Swarm

Workers grab available tasks from a shared pool. Self-organizing, naturally load-balancing.

**When to use:** Many similar, independent tasks like file reviews, migrations, test writing.

**Example prompt:**
```
Create a swarm team to review these 10 files for security issues.
Spawn 3 workers that each grab the next available file, review it,
and move on until all files are done.
```

**How it works:**
1. Create team and a task for each work item (no dependencies)
2. Spawn N workers with identical prompts: "check TaskList, claim next pending task, do it, repeat"
3. Workers race to claim tasks — file locking prevents double-claims
4. Each worker processes multiple tasks, naturally balancing load
5. When no tasks remain, workers go idle

**Tips:**
- 3 workers is a good starting point; add more for large task pools
- Workers should check `TaskList()` after completing each task
- Each task should be self-contained (one file, one module, one endpoint)

---

## Research + Implementation

Research first, then implement using findings. Clean phase separation.

**When to use:** When implementation benefits from prior research. No team needed — uses plain subagents.

**Example prompt:**
```
First, research caching best practices for our API using an adr:adr-researcher agent.
Then use the findings to implement caching in the user controller with a general-purpose agent.
```

**How it works:**
1. Spawn a research agent (synchronous, returns result)
2. Feed research findings into the implementation prompt
3. Spawn an implementation agent with the enriched prompt

**Key detail:** This pattern uses sequential subagents, not a full team. The research result flows directly into the implementation prompt.

---

## Plan Approval

Require a teammate to plan before implementing. The lead reviews and approves or rejects.

**When to use:** Database migrations, security-sensitive changes, architectural decisions — any high-risk work.

**Example prompt:**
```
Spawn an architect teammate in plan mode to design the database migration.
Don't let them implement until I've approved the plan.
Only approve plans that include rollback procedures and data validation.
```

**How it works:**
1. Create team, spawn teammate with `mode: "plan"`
2. Teammate works in read-only mode, designing the plan
3. Teammate sends a `plan_approval_request` to the lead
4. Lead reviews and approves or rejects with feedback
5. If rejected, teammate revises and resubmits
6. Once approved, teammate exits plan mode and implements

**Key detail:** Use the `mode: "plan"` parameter when spawning to enforce plan approval. The lead can set approval criteria in its prompt.

---

## Multi-File Refactoring

Coordinated changes across multiple files with fan-in dependencies.

**When to use:** Refactoring that spans models, controllers, and tests. Each file can be changed independently, but integration testing must wait for all changes.

**Example prompt:**
```
Create a team to refactor the auth module:
- Worker 1: Refactor User model (task #1)
- Worker 2: Refactor Session controller (task #2)
- Worker 3: Update all specs (task #3, blocked by #1 and #2)

Workers 1 and 2 can work in parallel. Worker 3 waits for both to finish.
```

**How it works:**
1. Create team and tasks with fan-in dependencies (#3 blocked by #1 AND #2)
2. Spawn workers for each task
3. Independent tasks run in parallel
4. Dependent tasks auto-unblock when all blockers complete
5. Final worker validates the integrated changes

**Key detail:** Fan-in dependencies ensure the test worker doesn't start until all code changes are complete. Use `TaskUpdate({ taskId: "3", addBlockedBy: ["1", "2"] })`.

---

## RLM (Recursive Language Model)

Divide large files into partitions, analyze each with parallel analyst agents, then synthesize.

**When to use:** Large log analysis, data exports, full-codebase review, CSV processing — any content > ~2000 lines.

**Example prompt:**
```
Analyze this 8000-line production log for error patterns.
Partition it into 8 chunks. Spawn 8 analyst agents to review
each partition in parallel. Each analyst reports: error types,
frequency counts, temporal patterns, and outliers.
Synthesize all 8 reports into a consolidated analysis.
```

**How it works:**
1. Team lead assesses file size and determines partitioning strategy
2. Team lead divides content into chunks (line ranges, file splits, or logical partitions)
3. Analyst agents (3-10) each analyze one partition independently
4. Each analyst reports structured findings back to team lead
5. Team lead (or a dedicated synthesizer agent) combines all reports
6. Shutdown and cleanup

**Key details:**
- Describe roles and workflow — team lead divides, analysts analyze, team lead synthesizes
- Pass file paths and line ranges — never paste content into prompts
- Use Grep scouting to skip irrelevant regions (can reduce work by 80%)
- Keep partition count to 5-10 to avoid context overflow
- See [swarm:rlm-pattern](../skills/rlm-pattern/SKILL.md) for partitioning strategies and team composition

**Agent recommendations:**
- Analysts: `swarm:rlm-chunk-analyzer` (Haiku)
- Synthesizer: `swarm:rlm-synthesizer` (Sonnet)

---

## Best Practices

### Pick the right pattern

- **Independent tasks, same type** → Swarm
- **Independent tasks, different focus** → Parallel Specialists
- **Sequential phases** → Pipeline
- **Learn then build** → Research + Implementation
- **Risky changes** → Plan Approval
- **Cross-file changes with integration step** → Multi-File Refactoring
- **Large document analysis** → RLM

### Avoid file conflicts

Two teammates editing the same file leads to overwrites. Break work so each teammate owns a different set of files.

### Size tasks well

- **Too small:** coordination overhead exceeds benefit
- **Too large:** teammates work too long without check-ins
- **Just right:** self-contained units producing a clear deliverable

### Always clean up

Shut down all teammates before calling `TeamDelete()`. Orphaned tmux sessions can be cleaned with `tmux kill-session -t <name>`.
