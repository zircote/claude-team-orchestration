---
name: team-management
description: Create, configure, and manage agent teams including spawning teammates, delegate mode, permissions, shutdown, and cleanup. Use when setting up a new team, spawning workers, configuring team modes, or shutting down a completed team.
---

# Team Management

Create, manage, and shut down agent teams. This skill covers team lifecycle from creation through cleanup.

> **Experimental**: Agent teams are disabled by default. Enable with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` in your [settings.json](https://code.claude.com/docs/en/settings) or environment.

**Related skills:**
- [Orchestrating](../orchestrating/SKILL.md) - Primitives overview and quick reference
- [Task System](../task-system/SKILL.md) - Managing work items and dependencies
- [Messaging](../messaging/SKILL.md) - Communication between agents
- [Agent Types](../agent-types/SKILL.md) - Choosing the right agent for each role
- [Spawn Backends](../spawn-backends/SKILL.md) - How teammates run (in-process, tmux, iTerm2)
- [Error Handling](../error-handling/SKILL.md) - Troubleshooting and recovery

---

## Core Architecture

A team consists of:
- **Leader** (you) - Creates team, spawns workers, coordinates work
- **Teammates** (spawned agents) - Execute tasks, report back
- **Task List** - Shared work queue with dependencies
- **Inboxes** - JSON files for inter-agent messaging

### File Structure

```
~/.claude/teams/{team-name}/
├── config.json              # Team metadata and member list
└── inboxes/
    ├── team-lead.json       # Leader's inbox
    ├── worker-1.json        # Worker 1's inbox
    └── worker-2.json        # Worker 2's inbox

~/.claude/tasks/{team-name}/
├── 1.json                   # Task #1
├── 2.json                   # Task #2
└── 3.json                   # Task #3
```

### Team Config Structure

```json
{
  "name": "my-project",
  "description": "Working on feature X",
  "leadAgentId": "team-lead@my-project",
  "createdAt": 1706000000000,
  "members": [
    {
      "agentId": "team-lead@my-project",
      "name": "team-lead",
      "agentType": "team-lead",
      "color": "#4A90D9",
      "joinedAt": 1706000000000,
      "backendType": "in-process"
    },
    {
      "agentId": "worker-1@my-project",
      "name": "worker-1",
      "agentType": "Explore",
      "model": "haiku",
      "prompt": "Analyze the codebase structure...",
      "color": "#D94A4A",
      "planModeRequired": false,
      "joinedAt": 1706000001000,
      "tmuxPaneId": "in-process",
      "cwd": "/Users/me/project",
      "backendType": "in-process"
    }
  ]
}
```

---

## Two Ways to Spawn Agents

### Method 1: Task Tool (Subagents)

Use Task for **short-lived, focused work** that returns a result:

```javascript
Task({
  subagent_type: "Explore",
  description: "Find auth files",
  prompt: "Find all authentication-related files in this codebase",
  model: "haiku"  // Optional: haiku, sonnet, opus
})
```

**Characteristics:**
- Runs synchronously (blocks until complete) or async with `run_in_background: true`
- Returns result directly to you
- No team membership required
- Best for: searches, analysis, focused research

### Method 2: Task Tool + team_name + name (Teammates)

Use Task with `team_name` and `name` to **spawn persistent teammates**:

```javascript
// First create a team
TeamCreate({ team_name: "my-project", description: "Working on feature X" })

// Then spawn a teammate into that team
Task({
  team_name: "my-project",        // Required: which team to join
  name: "security-reviewer",      // Required: teammate's name
  subagent_type: "general-purpose",
  prompt: "Review all authentication code for vulnerabilities. Send findings to team-lead.",
  run_in_background: true         // Teammates usually run in background
})
```

**Characteristics:**
- Joins team, appears in `config.json`
- Communicates via inbox messages
- Can claim tasks from shared task list
- Persists until shutdown
- Best for: parallel work, ongoing collaboration, pipeline stages

### Key Difference

| Aspect | Task (subagent) | Task + team_name + name (teammate) |
|--------|-----------------|-----------------------------------|
| Lifespan | Until task complete | Until shutdown requested |
| Communication | Return value | Inbox messages |
| Task access | None | Shared task list |
| Team membership | No | Yes |
| Coordination | One-off | Ongoing |

---

## Creating a Team

### TeamCreate

```javascript
TeamCreate({
  team_name: "feature-auth",
  description: "Implementing OAuth2 authentication"
})
```

**Creates:**
- `~/.claude/teams/feature-auth/config.json`
- `~/.claude/tasks/feature-auth/` directory
- You become the team leader

**Constraint:** One team per session. Clean up the current team before starting a new one.

---

## Delegate Mode

By default, the lead may start implementing tasks itself instead of waiting for teammates. **Delegate mode** restricts the lead to coordination-only tools: spawning, messaging, shutting down teammates, and managing tasks.

**When to use:** When you want the lead to focus entirely on orchestration (breaking down work, assigning tasks, synthesizing results) without touching code directly.

**How to enable:** Start a team first, then press **Shift+Tab** to cycle into delegate mode.

---

## Permissions Model

- Teammates start with the **lead's permission settings**
- If the lead runs with `--dangerously-skip-permissions`, all teammates do too
- You can change individual teammate modes **after** spawning
- You **cannot** set per-teammate modes at spawn time

---

## Environment Variables

Spawned teammates automatically receive these:

```bash
CLAUDE_CODE_TEAM_NAME="my-project"
CLAUDE_CODE_AGENT_ID="worker-1@my-project"
CLAUDE_CODE_AGENT_NAME="worker-1"
CLAUDE_CODE_AGENT_TYPE="Explore"
CLAUDE_CODE_AGENT_COLOR="#4A90D9"
CLAUDE_CODE_PLAN_MODE_REQUIRED="false"
CLAUDE_CODE_PARENT_SESSION_ID="session-xyz"
```

**Using in prompts:**
```javascript
Task({
  team_name: "my-project",
  name: "worker",
  subagent_type: "general-purpose",
  prompt: "Your name is $CLAUDE_CODE_AGENT_NAME. Use it when sending messages."
})
```

---

## Plan Approval

For complex or risky tasks, require teammates to plan before implementing:

```javascript
Task({
  team_name: "careful-work",
  name: "architect",
  subagent_type: "Plan",
  prompt: "Design an implementation plan for adding OAuth2 authentication",
  mode: "plan",  // Requires plan approval
  run_in_background: true
})
```

When the teammate finishes planning, they send a `plan_approval_request` to the lead. The lead reviews and either approves or rejects with feedback. If rejected, the teammate stays in plan mode, revises based on feedback, and resubmits.

See [Messaging](../messaging/SKILL.md) for plan approval tool syntax.

---

## Graceful Shutdown

**Always follow this sequence:**

```javascript
// 1. Request shutdown for all teammates
SendMessage({ type: "shutdown_request", recipient: "worker-1", content: "All tasks complete" })
SendMessage({ type: "shutdown_request", recipient: "worker-2", content: "All tasks complete" })

// 2. Wait for shutdown approvals
// Teammates respond with: SendMessage({ type: "shutdown_response", request_id: "...", approve: true })

// 3. Only then cleanup
TeamDelete()
```

**Shutdown behavior:** Teammates finish their current request or tool call before shutting down, which can take time.

**Crashed teammates:** Teammates have a 5-minute heartbeat timeout. If a teammate crashes:
1. They are automatically marked as inactive after timeout
2. Their tasks remain in the task list
3. Another teammate can claim their tasks
4. Cleanup will work after timeout expires

---

## Cleanup

### TeamDelete

```javascript
TeamDelete()
```

**Removes:**
- `~/.claude/teams/{team-name}/` directory
- `~/.claude/tasks/{team-name}/` directory

**IMPORTANT:**
- Will fail if teammates are still active. Use shutdown first.
- Always use the **lead** to clean up. Teammates should not run cleanup because their team context may not resolve correctly.

---

## Discovering Team Members

Teammates can read the team config file to discover other team members:

```bash
cat ~/.claude/teams/{team-name}/config.json
```

The config contains a `members` array with each teammate's:
- `name` - Human-readable name (**always use this** for messaging and task assignment)
- `agentId` - Unique identifier (for reference only)
- `agentType` - Role/type of the agent

**IMPORTANT:** Always refer to teammates by their **name** (e.g., "team-lead", "researcher", "tester").
