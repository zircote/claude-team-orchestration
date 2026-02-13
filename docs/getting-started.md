# Getting Started

End-to-end walkthrough from installation to your first successful team run.

---

## 1. Install prerequisites

### Claude Code

```bash
# Install (if not already)
npm install -g @anthropic-ai/claude-code

# Verify
claude --version   # Must be 1.0.33+
```

### Enable agent teams

Add to your `settings.json` (open with `claude /settings`):

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### Install tmux (recommended)

tmux lets you see each teammate in its own terminal pane.

```bash
# macOS
brew install tmux

# Linux (Debian/Ubuntu)
sudo apt install tmux

# Verify
which tmux
```

Without tmux, teammates run in-process (invisible but functional). You can still interact with them using **Shift+Up/Down** to select and message teammates.

---

## 2. Install the plugin

```bash
claude /plugin install https://github.com/zircote/claude-team-orchestration
```

Restart Claude Code to load the plugin.

---

## 3. Verify the plugin loaded

```
/help
```

Look for skills under the `swarm:` namespace. You should see entries like `swarm:orchestrating`, `swarm:team-management`, etc.

---

## 4. Configure CLAUDE.md (recommended)

Add the following to your project's `CLAUDE.md` (or `~/.claude-personal/CLAUDE.md` for all projects) to tell Claude to prefer parallel agent teams when work can be parallelized:

```markdown
## Always use swarm orchestration patterns (TeamCreate, Task with team_name, SendMessage, TaskCreate/TaskUpdate) when work is best executed by parallel specialist agents.
This means:
  - Spawning teams with specialized teammates for parallelizable work
  - Using the task list for coordination and progress tracking
  - Leveraging SendMessage for inter-agent communication
  - Preferring concurrent execution over sequential when tasks are independent
```

Without this, Claude may run tasks sequentially or use simple subagents rather than coordinated teams. This instruction ensures Claude proactively spawns teams when appropriate.

> **Tip:** If you only want swarm behavior in specific projects, put it in the project-level `CLAUDE.md`. For global behavior across all projects, put it in `~/.claude-personal/CLAUDE.md`.

---

## 5. Choose a display mode

| Mode | What you see | Setup required |
|------|-------------|----------------|
| **In-process** (default) | Single terminal, teammates run invisibly | None |
| **tmux split panes** | Each teammate in its own pane | tmux installed |
| **iTerm2 split panes** | Native iTerm2 panes (macOS) | `it2` CLI + Python API enabled |

### Force a display mode

In `settings.json`:

```json
{
  "teammateMode": "tmux"
}
```

Or per-session:

```bash
claude --teammate-mode tmux
```

The default `"auto"` uses split panes if you're already inside a tmux session, and in-process otherwise.

---

## 6. Run your first team

Start Claude Code (inside tmux for split panes):

```bash
tmux new-session -s claude
claude
```

Then give Claude a team task:

```
Create a 3-person agent team to review the codebase.
Spawn reviewers for security, code quality, and architecture.
Have each send findings to team-lead, then synthesize a summary.
```

### What happens

1. **TeamCreate** — Claude creates a team with a shared task list
2. **Task spawning** — Three agents start in parallel, each with a focused prompt
3. **Independent work** — Each agent reviews code through its own lens
4. **Message delivery** — Findings arrive automatically at the team lead
5. **Synthesis** — The lead combines all findings into a report
6. **Cleanup** — Agents shut down and the team is deleted

### Interact with teammates

**In-process mode:**
- **Shift+Up/Down** — Select a teammate
- **Enter** — View their session
- **Escape** — Interrupt their current turn
- **Ctrl+T** — Toggle the task list

**Split-pane mode:**
- Click into any pane to interact directly

---

## 7. Next steps

- Read [Patterns](patterns.md) to learn the seven orchestration patterns
- Read [Agent Types](agent-types.md) to pick the right agent for each role
- Try the [complete workflow examples](../skills/orchestration-patterns/examples/complete-workflows.md)
