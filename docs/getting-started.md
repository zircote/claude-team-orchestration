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

## 4. Choose a display mode

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

## 5. Run your first team

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

## 6. Next steps

- Read [Patterns](patterns.md) to learn the six orchestration patterns
- Read [Agent Types](agent-types.md) to pick the right agent for each role
- Try the [complete workflow examples](../skills/orchestration-patterns/examples/complete-workflows.md)
