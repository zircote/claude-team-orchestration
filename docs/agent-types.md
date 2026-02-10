# Agent Types

Which agents are available and when to use each. Match the agent's tool access to the task requirements.

---

## Quick Selection Guide

| Need | Agent Type | Why |
|------|-----------|-----|
| Search/read code | **Explore** | Read-only, fast, cheap (haiku) |
| Architecture design | **Plan** | Read-only, thoughtful analysis |
| Run commands/git | **Bash** | Shell access only |
| Multi-step implementation | **general-purpose** | Full tool access |
| Claude Code questions | **claude-code-guide** | Docs and web access |
| Security review | **sdlc:security-reviewer** | Vulnerability assessment, secure coding |
| Code quality review | **sdlc:quality-enforcer** | Formatting, linting, code style |
| Code simplification | **code-simplifier:code-simplifier** | Clarity, consistency, minimalism |
| Architecture analysis | **refactor:architect** | Design review, optimization planning |
| Best practices research | **adr:adr-researcher** | Codebase analysis + web research |
| Deep code exploration | **feature-dev:code-explorer** | Trace execution paths, map architecture |
| Code review | **feature-dev:code-reviewer** | Bugs, logic errors, conventions |
| Chunk-level file analysis | **swarm:rlm-chunk-analyzer** | Haiku, fast, structured JSON output |
| Synthesize chunk findings | **swarm:rlm-synthesizer** | Sonnet, aggregation and deduplication |

**Key rule:** Read-only agents (Explore, Plan) **cannot** edit or write files. Never assign them implementation work.

---

## Built-in Agents

Always available without plugins.

### Bash

```javascript
Task({ subagent_type: "Bash", prompt: "Check git status and show recent commits" })
```

- **Tools:** Bash only
- **Best for:** Git operations, command execution, system tasks

### Explore

```javascript
Task({ subagent_type: "Explore", prompt: "Find all API endpoints", model: "haiku" })
```

- **Tools:** All read-only (no Edit, Write, Task)
- **Model:** Haiku (fast, cheap)
- **Best for:** Codebase exploration, file searches, code understanding

### Plan

```javascript
Task({ subagent_type: "Plan", prompt: "Design an OAuth2 implementation plan" })
```

- **Tools:** All read-only
- **Best for:** Architecture planning, implementation strategies

### general-purpose

```javascript
Task({ subagent_type: "general-purpose", prompt: "Implement caching for the user API" })
```

- **Tools:** All tools (full access)
- **Best for:** Multi-step tasks, research + action combinations

### claude-code-guide

```javascript
Task({ subagent_type: "claude-code-guide", prompt: "How do I configure MCP servers?" })
```

- **Tools:** Read-only + WebFetch + WebSearch
- **Best for:** Questions about Claude Code, Agent SDK, Anthropic API

---

## Plugin Agents

Available when the corresponding plugins are installed. Plugin agents use the format `{plugin}:{agent-name}`.

### Review Agents

| Agent | Focus |
|-------|-------|
| `sdlc:security-reviewer` | Vulnerabilities, supply chain security, secure coding |
| `sdlc:quality-enforcer` | Formatting, linting, error handling, documentation |
| `sdlc:compliance-auditor` | Full SDLC compliance audit |
| `feature-dev:code-reviewer` | Bugs, logic errors, security, code quality, conventions |
| `code-simplifier:code-simplifier` | Clarity, consistency, minimalism |
| `refactor:architect` | Architectural analysis, optimization planning |
| `superpowers:code-reviewer` | Review against plan and coding standards |
| `human-voice:voice-reviewer` | Content voice and tone |

### Research Agents

| Agent | Focus |
|-------|-------|
| `adr:adr-researcher` | Codebase analysis + web search for best practices |
| `feature-dev:code-explorer` | Trace execution paths, map architecture, dependencies |
| `feature-dev:code-architect` | Design feature architectures based on existing patterns |
| `mnemonic:mnemonic-search-subcall` | Search across stored knowledge |

### Refactoring Agents

| Agent | Focus |
|-------|-------|
| `refactor:architect` | Architecture analysis and optimization planning |
| `refactor:code` | Implementation of architectural optimizations |
| `refactor:test` | Test coverage analysis and test generation |

### CI/CD Agents

| Agent | Focus |
|-------|-------|
| `sdlc:ci-architect` | CI pipeline design and GitHub Actions configuration |

### Test Generation Agents

| Agent | Focus |
|-------|-------|
| `auto-harness:test-generator` | Comprehensive test definitions for components |

### RLM Agents

| Agent | Focus |
|-------|-------|
| `swarm:rlm-chunk-analyzer` | Read file chunks via offset/limit, return structured JSON findings (Haiku) |
| `swarm:rlm-synthesizer` | Aggregate chunk findings into coherent reports (Sonnet) |

---

## Choosing Agents for Teams

When spawning teammates, pick the agent type that matches the task:

```javascript
// Research phase — read-only agent is sufficient
Task({
  team_name: "my-team",
  name: "researcher",
  subagent_type: "adr:adr-researcher",
  prompt: "Research OAuth2 best practices...",
  run_in_background: true
})

// Implementation phase — needs full tool access
Task({
  team_name: "my-team",
  name: "implementer",
  subagent_type: "general-purpose",
  prompt: "Implement OAuth2 authentication...",
  run_in_background: true
})
```

**Tips:**
- Use `model: "haiku"` for fast, cheap Explore agents
- Use `general-purpose` when the agent needs to edit files
- Use specialized review agents for focused audits
- Never assign implementation work to read-only agents (Explore, Plan)
