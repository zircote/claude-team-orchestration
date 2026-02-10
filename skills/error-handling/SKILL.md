---
name: error-handling
description: Debug and recover from agent team errors including common errors, hooks for quality gates, known limitations, and recovery strategies. Use when encountering team errors, enforcing quality gates with hooks, understanding limitations, or debugging agent issues.
---

# Error Handling

Debug, recover from, and prevent common agent team errors. Includes hooks for quality enforcement and known limitations.

**Related skills:**
- [Orchestrating](../orchestrating/SKILL.md) - Primitives overview and quick reference
- [Team Management](../team-management/SKILL.md) - Shutdown and cleanup procedures
- [Task System](../task-system/SKILL.md) - Task status issues
- [Messaging](../messaging/SKILL.md) - Message debugging
- [Spawn Backends](../spawn-backends/SKILL.md) - Backend troubleshooting

---

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Cannot cleanup with active members" | Teammates still running | Shutdown all teammates first, wait for approval |
| "Already leading a team" | Team already exists | `TeamDelete()` first, or use different team name |
| "Agent not found" | Wrong teammate name | Read `config.json` for actual names |
| "Team does not exist" | No team created | Call `TeamCreate()` first |
| "team_name is required" | Missing team context | Provide `team_name` parameter |
| "Agent type not found" | Invalid subagent_type | Check available agents with proper prefix |

---

## Quality Gate Hooks

Use [hooks](https://code.claude.com/docs/en/hooks) to enforce rules when teammates finish work or tasks complete.

### TeammateIdle Hook

Runs when a teammate is about to go idle. Exit with code 2 to send feedback and keep the teammate working.

```json
{
  "hooks": {
    "TeammateIdle": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python3 check_teammate_quality.py"
          }
        ]
      }
    ]
  }
}
```

**Use cases:**
- Verify teammate completed all assigned tasks before going idle
- Run linting or tests on teammate's changes
- Enforce documentation requirements

**Exit codes:**
- `0` - Allow teammate to go idle normally
- `2` - Send feedback to teammate, keep them working

### TaskCompleted Hook

Runs when a task is being marked complete. Exit with code 2 to prevent completion and send feedback.

```json
{
  "hooks": {
    "TaskCompleted": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python3 validate_task_completion.py"
          }
        ]
      }
    ]
  }
}
```

**Use cases:**
- Verify tests pass before marking a task complete
- Ensure code quality standards are met
- Validate documentation was updated

**Exit codes:**
- `0` - Allow task completion
- `2` - Prevent completion, send feedback to teammate

---

## Known Limitations

Agent teams are experimental. Current limitations:

1. **No session resumption with in-process teammates**: `/resume` and `/rewind` do not restore in-process teammates. After resuming, the lead may try to message teammates that no longer exist. Tell the lead to spawn new teammates.

2. **Task status can lag**: Teammates sometimes fail to mark tasks as completed, which blocks dependent tasks. Check whether work is done and update status manually, or tell the lead to nudge the teammate.

3. **Shutdown can be slow**: Teammates finish their current request or tool call before shutting down.

4. **One team per session**: A lead can only manage one team at a time. Clean up the current team before starting a new one.

5. **No nested teams**: Teammates cannot spawn their own teams or teammates. Only the lead can manage the team.

6. **Lead is fixed**: The session that creates the team is the lead for its lifetime. You cannot promote a teammate or transfer leadership.

7. **Permissions set at spawn**: All teammates start with the lead's permission mode. You can change individual modes after spawning, but cannot set per-teammate modes at spawn time.

8. **Split panes require tmux or iTerm2**: Default in-process mode works in any terminal. Split-pane mode isn't supported in VS Code's integrated terminal, Windows Terminal, or Ghostty.

---

## Graceful Shutdown Sequence

See [Team Management](../team-management/SKILL.md) for the full shutdown procedure. In summary:

```javascript
// 1. Request shutdown for all teammates
SendMessage({ type: "shutdown_request", recipient: "worker-1", content: "Done" })
SendMessage({ type: "shutdown_request", recipient: "worker-2", content: "Done" })

// 2. Wait for shutdown approvals

// 3. Verify no active members

// 4. Only then cleanup
TeamDelete()
```

---

## Handling Crashed Teammates

Teammates have a 5-minute heartbeat timeout. If a teammate crashes:

1. They are automatically marked as inactive after timeout
2. Their tasks remain in the task list
3. Another teammate can claim their tasks
4. Cleanup will work after timeout expires

---

## Recovery Strategies

### Teammate Stops on Error

Teammates may stop after encountering errors instead of recovering.

**Recovery:**
1. Check their output using **Shift+Up/Down** (in-process) or click pane (split mode)
2. Give them additional instructions directly
3. Or spawn a replacement teammate to continue the work

### Lead Starts Implementing Instead of Delegating

The lead sometimes starts doing work itself instead of waiting for teammates.

**Recovery:** Tell it to wait:
```
Wait for your teammates to complete their tasks before proceeding
```

Or enable [delegate mode](../team-management/SKILL.md) to restrict the lead to coordination-only tools.

### Lead Shuts Down Prematurely

The lead may decide the team is finished before all tasks are complete.

**Recovery:** Tell it to keep going. You can also tell the lead to wait for teammates to finish before proceeding.

### Task Appears Stuck

A task stays in `pending` even though its dependencies are done.

**Recovery:**
1. Check if the blocking task was actually marked completed
2. If work is done but status wasn't updated, update it manually
3. Tell the lead to nudge the teammate

### Too Many Permission Prompts

Teammate permission requests bubble up to the lead.

**Recovery:** Pre-approve common operations in your [permission settings](https://code.claude.com/docs/en/permissions) before spawning teammates.

### Orphaned tmux Sessions

A tmux session persists after the team ends.

**Recovery:**
```bash
tmux ls
tmux kill-session -t <session-name>
```

---

## Debugging Commands

```bash
# Check team config
cat ~/.claude/teams/{team}/config.json | jq '.members[] | {name, agentType, backendType}'

# Check teammate inboxes
cat ~/.claude/teams/{team}/inboxes/{agent}.json | jq '.'

# List all teams
ls ~/.claude/teams/

# Check task states
cat ~/.claude/tasks/{team}/*.json | jq '{id, subject, status, owner, blockedBy}'

# Watch for new messages
tail -f ~/.claude/teams/{team}/inboxes/team-lead.json
```

---

## Best Practices for Error Prevention

### Handle Worker Failures
- Workers have 5-minute heartbeat timeout
- Tasks of crashed workers can be reclaimed
- Build retry logic into worker prompts

### Avoid File Conflicts
Two teammates editing the same file leads to overwrites. Break work so each teammate owns a different set of files.

### Monitor and Steer
Check in on teammate progress, redirect approaches that aren't working, and synthesize findings as they come in. Letting a team run unattended too long increases risk of wasted effort.
