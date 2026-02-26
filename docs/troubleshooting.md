# Troubleshooting

Common failures and fixes for agent teams.

---

## Setup Issues

### Agent teams not enabled

**Symptom:** Claude doesn't respond to team-related requests.

**Fix:** Enable the experimental flag:

```json
// settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Or in your shell:

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

### tmux not found

**Symptom:** Split-pane mode fails. Error: "No pane backend available."

**Fix:** Install tmux:

```bash
# macOS
brew install tmux

# Linux (Debian/Ubuntu)
sudo apt install tmux

# Verify
which tmux
```

If you don't need split panes, set `teammateMode` to `"in-process"`:

```json
{
  "teammateMode": "in-process"
}
```

### iTerm2 panes not working

**Symptom:** In iTerm2, panes don't split for teammates.

**Fix:** Install and configure the `it2` CLI:

```bash
uv tool install it2
# Then: iTerm2 -> Settings -> General -> Magic -> Enable Python API
# Restart iTerm2
it2 --version
```

### Plugin skills not showing

**Symptom:** `/help` doesn't list `swarm:` skills.

**Fix:**
1. Restart Claude Code after installing the plugin
2. Verify the plugin directory has `.claude-plugin/plugin.json`
3. Check the plugin was installed: `claude /plugin list`

---

## Agent Spawning Issues

### "Agent type not found"

**Symptom:** Error when spawning a teammate with a specific agent type.

**Fix:** The agent type references a plugin that isn't installed. Built-in types that always work:
- `Bash`, `Explore`, `Plan`, `general-purpose`, `claude-code-guide`

Plugin agents (like `sdlc:security-reviewer`) require the corresponding plugin to be installed.

### "Already leading a team"

**Symptom:** Can't create a new team.

**Fix:** Clean up the existing team first:

```javascript
// Shut down all teammates
SendMessage({ type: "shutdown_request", recipient: "worker-1", content: "Done" })
// Wait for approvals...
TeamDelete()
```

### Teammates not responding

**Symptom:** Teammates don't produce results or send messages.

**Possible causes:**
1. **Wrong agent type for the task** — Read-only agents can't write files
2. **Insufficient context in prompt** — Teammates don't inherit the lead's conversation history
3. **Agent crashed** — Check with Shift+Up/Down (in-process) or click pane (split mode)

**Fix:** Give teammates clear, detailed prompts with all necessary context.

---

## Communication Issues

### Messages not arriving

**Symptom:** Teammate messages don't appear at the lead.

**Fix:** Messages are delivered automatically between turns. If you're mid-turn, messages queue and deliver when your turn ends. The UI shows a notification when messages are waiting.

### Broadcast costs too high

**Symptom:** Token usage spikes after broadcasts.

**Fix:** Broadcasting sends N messages for N teammates. Use direct messages instead:

```javascript
// Instead of broadcast, message specific teammates
SendMessage({ type: "message", recipient: "worker-1", content: "...", summary: "..." })
```

Reserve broadcasts for critical team-wide announcements only.

---

## Task Issues

### Task appears stuck

**Symptom:** A task stays `pending` even though dependencies are done.

**Possible causes:**
1. Blocking task wasn't marked `completed`
2. Teammate failed to update status

**Fix:** Check the blocking task's status. If the work is done but status wasn't updated:

```javascript
TaskUpdate({ taskId: "1", status: "completed" })
```

### Race condition on task claiming

**Symptom:** Two teammates try to claim the same task.

**Fix:** This is handled automatically. Task claiming uses file locking — one will succeed, the other will see the task is already owned. No action needed.

### Tasks not unblocking

**Symptom:** A dependent task doesn't unblock after its blocker completes.

**Fix:** Verify the blocking task was marked `completed` (not just `in_progress`). Check with:

```javascript
TaskGet({ taskId: "1" })  // Check status of the blocker
```

---

## Shutdown Issues

### "Cannot cleanup with active members"

**Symptom:** `TeamDelete()` fails.

**Fix:** Shut down all teammates first, then wait for their approval:

```javascript
SendMessage({ type: "shutdown_request", recipient: "worker-1", content: "Done" })
// Wait for shutdown_response with approve: true
// Then:
TeamDelete()
```

### Shutdown is slow

**Symptom:** Teammate takes a long time to shut down.

**Explanation:** Teammates finish their current request or tool call before shutting down. This is expected behavior. Wait for the `shutdown_response`.

### Orphaned tmux sessions

**Symptom:** tmux session persists after the team ends.

**Fix:**

```bash
tmux ls                        # List all sessions
tmux kill-session -t claude-swarm   # Kill the orphaned session
```

---

## Performance Issues

### Claude doesn't use teams automatically

**Symptom:** Claude runs tasks sequentially or uses simple subagents instead of spawning coordinated teams.

**Fix:** Add the swarm orchestration instruction to your `CLAUDE.md`:

```markdown
## Always use swarm orchestration patterns (TeamCreate, Task with team_name, SendMessage, TaskCreate/TaskUpdate) when work is best executed by parallel specialist agents.
This means:
  - Spawning teams with specialized teammates for parallelizable work
  - Using the task list for coordination and progress tracking
  - Leveraging SendMessage for inter-agent communication
  - Preferring concurrent execution over sequential when tasks are independent
```

Place this in your project-level `CLAUDE.md` or your user-level `~/.claude/CLAUDE.md`. This tells Claude to prefer parallel teams when work is parallelizable.

### Lead starts implementing instead of delegating

**Symptom:** The lead does work itself instead of waiting for teammates.

**Fix:** Tell it to wait:

```
Wait for your teammates to complete their tasks before proceeding.
```

Or enable **delegate mode** (Shift+Tab) to restrict the lead to coordination-only tools.

### Too many permission prompts

**Symptom:** Teammate permission requests interrupt the lead frequently.

**Fix:** Pre-approve common operations in your permission settings before spawning teammates:

```json
// settings.json
{
  "permissions": {
    "allow": ["Bash(npm *)", "Bash(git *)", "Write"]
  }
}
```

### Teammates stopping on errors

**Symptom:** A teammate encounters an error and stops working.

**Fix:**
1. Check output: Shift+Up/Down (in-process) or click pane (split mode)
2. Give additional instructions directly to the teammate
3. Or spawn a replacement to continue the work

---

> See [Known Limitations](reference.md#known-limitations) for current feature limitations.
>
> See [Debugging Commands](reference.md#debugging-commands) for diagnostic shell commands.
