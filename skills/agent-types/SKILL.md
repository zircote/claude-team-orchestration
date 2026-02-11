---
name: agent-types
description: Choose the right agent type for each task including built-in agents (Bash, Explore, Plan, general-purpose) and plugin agents (review, research, refactoring, SDLC). Use when selecting agent types, understanding agent capabilities, or matching agents to tasks.
---

# Agent Types

Choose the right agent type for each role in your team. Agent types determine what tools are available and what the agent is optimized for.

**Related skills:**
- [Orchestrating](../orchestrating/SKILL.md) - Primitives overview and quick reference
- [Team Management](../team-management/SKILL.md) - Spawning agents into teams
- [Orchestration Patterns](../orchestration-patterns/SKILL.md) - Patterns that combine different agent types

---

## Agent Type Selection Guide

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
| Source code chunk analysis | **swarm:rlm-code-analyzer** | Code-aware, scope context, analysis focus |
| Data/CSV chunk analysis | **swarm:rlm-data-analyzer** | Column-aware, distributions, statistics |
| JSON chunk analysis | **swarm:rlm-json-analyzer** | Schema-aware, structural patterns |
| General chunk-level analysis | **swarm:rlm-chunk-analyzer** | Haiku, fast, structured JSON output |
| Synthesize chunk findings | **swarm:rlm-synthesizer** | Sonnet, aggregation and deduplication |

**Key rule:** Match the agent's tool access to the task requirements. Read-only agents (Explore, Plan) **cannot** edit or write files. Never assign them implementation work.

---

## Built-in Agent Types

These are always available without plugins:

### Bash
```javascript
Task({
  subagent_type: "Bash",
  description: "Run git commands",
  prompt: "Check git status and show recent commits"
})
```
- **Tools:** Bash only
- **Model:** Inherits from parent
- **Best for:** Git operations, command execution, system tasks

### Explore
```javascript
Task({
  subagent_type: "Explore",
  description: "Find API endpoints",
  prompt: "Find all API endpoints in this codebase. Be very thorough.",
  model: "haiku"  // Fast and cheap
})
```
- **Tools:** All read-only tools (no Edit, Write, NotebookEdit, Task)
- **Model:** Haiku (optimized for speed)
- **Best for:** Codebase exploration, file searches, code understanding
- **Thoroughness levels:** "quick", "medium", "very thorough"

### Plan
```javascript
Task({
  subagent_type: "Plan",
  description: "Design auth system",
  prompt: "Create an implementation plan for adding OAuth2 authentication"
})
```
- **Tools:** All read-only tools
- **Model:** Inherits from parent
- **Best for:** Architecture planning, implementation strategies

### general-purpose
```javascript
Task({
  subagent_type: "general-purpose",
  description: "Research and implement",
  prompt: "Research React Query best practices and implement caching for the user API"
})
```
- **Tools:** All tools (*)
- **Model:** Inherits from parent
- **Best for:** Multi-step tasks, research + action combinations

### claude-code-guide
```javascript
Task({
  subagent_type: "claude-code-guide",
  description: "Help with Claude Code",
  prompt: "How do I configure MCP servers?"
})
```
- **Tools:** Read-only + WebFetch + WebSearch
- **Best for:** Questions about Claude Code, Agent SDK, Anthropic API

### statusline-setup
```javascript
Task({
  subagent_type: "statusline-setup",
  description: "Configure status line",
  prompt: "Set up a status line showing git branch and node version"
})
```
- **Tools:** Read, Edit only
- **Model:** Sonnet
- **Best for:** Configuring Claude Code status line

---

## Plugin Agent Types

Installed plugins provide specialized agent types grouped by function.

### Review Agents

```javascript
// Security review
Task({
  subagent_type: "sdlc:security-reviewer",
  description: "Security audit",
  prompt: "Audit this PR for security vulnerabilities"
})

// Code quality
Task({
  subagent_type: "sdlc:quality-enforcer",
  description: "Quality check",
  prompt: "Check formatting, linting, and code style"
})

// Code review (bugs, logic, conventions)
Task({
  subagent_type: "feature-dev:code-reviewer",
  description: "Code review",
  prompt: "Review this code for bugs, logic errors, and adherence to project conventions"
})

// Code simplification
Task({
  subagent_type: "code-simplifier:code-simplifier",
  description: "Simplicity check",
  prompt: "Check if this implementation can be simplified"
})

// Architecture review
Task({
  subagent_type: "refactor:architect",
  description: "Architecture review",
  prompt: "Review the system architecture of the authentication module"
})

// General code review against plan and standards
Task({
  subagent_type: "superpowers:code-reviewer",
  description: "Plan compliance review",
  prompt: "Review implementation against the original plan and coding standards"
})

// SDLC compliance audit
Task({
  subagent_type: "sdlc:compliance-auditor",
  description: "Compliance audit",
  prompt: "Audit this project against all SDLC standards"
})
```

**All review agents:**
- `sdlc:security-reviewer` - Vulnerability assessment, supply chain security, secure coding
- `sdlc:quality-enforcer` - Formatting, linting, error handling, documentation standards
- `sdlc:compliance-auditor` - Full SDLC compliance audit
- `feature-dev:code-reviewer` - Bugs, logic errors, security, code quality, conventions
- `code-simplifier:code-simplifier` - Clarity, consistency, minimalism
- `refactor:architect` - Architectural analysis, optimization planning
- `superpowers:code-reviewer` - Review against plan and coding standards
- `human-voice:voice-reviewer` - Content voice and tone review

### Research Agents

```javascript
// Best practices and architectural research
Task({
  subagent_type: "adr:adr-researcher",
  description: "Research auth best practices",
  prompt: "Research current best practices for JWT authentication"
})

// Deep codebase exploration
Task({
  subagent_type: "feature-dev:code-explorer",
  description: "Analyze auth module",
  prompt: "Trace execution paths and map the architecture of the authentication module"
})

// Feature architecture design
Task({
  subagent_type: "feature-dev:code-architect",
  description: "Design feature architecture",
  prompt: "Design the architecture for adding OAuth2 authentication based on existing patterns"
})

// Memory/knowledge search
Task({
  subagent_type: "mnemonic:mnemonic-search-subcall",
  description: "Search prior knowledge",
  prompt: "Search for prior decisions and learnings about authentication"
})
```

**All research agents:**
- `adr:adr-researcher` - Codebase analysis + web search for best practices
- `feature-dev:code-explorer` - Trace execution paths, map architecture, understand dependencies
- `feature-dev:code-architect` - Design feature architectures based on existing patterns
- `mnemonic:mnemonic-search-subcall` - Iterative search across stored knowledge

### Refactoring Agents

```javascript
// Architecture analysis and planning
Task({
  subagent_type: "refactor:architect",
  description: "Plan refactoring",
  prompt: "Analyze code architecture and create a prioritized optimization plan"
})

// Implementation
Task({
  subagent_type: "refactor:code",
  description: "Implement refactoring",
  prompt: "Implement the architectural optimizations while preserving functionality"
})

// Test coverage
Task({
  subagent_type: "refactor:test",
  description: "Refactoring test coverage",
  prompt: "Analyze coverage, add missing tests, ensure all tests pass"
})
```

### CI/CD and Infrastructure Agents

```javascript
// CI pipeline design
Task({
  subagent_type: "sdlc:ci-architect",
  description: "Design CI pipeline",
  prompt: "Configure GitHub Actions workflow for this project"
})
```

### Bug Reproduction and Testing

```javascript
// Bug reproduction (full tool access)
Task({
  subagent_type: "general-purpose",
  description: "Validate bug",
  prompt: "Reproduce and validate this reported bug: [description]"
})

// Test generation
Task({
  subagent_type: "auto-harness:test-generator",
  description: "Generate tests",
  prompt: "Generate comprehensive test definitions for this component"
})
```

### RLM Agents

Content-aware chunk analyzers — the Team Lead selects the analyst based on detected content type.

**Single-file mode:** One analyst type per session (determined by content type).
**Multi-file mode:** Different analyst types run simultaneously when a directory contains mixed content types. Max 6 analysts total, distributed proportionally to task counts per type. See [Multi-File Directory Analysis](../rlm-pattern/SKILL.md#multi-file-directory-analysis).

**IMPORTANT:** In actual RLM workflows, spawn these as **teammates** (with `team_name` + `name`) so they communicate via `SendMessage` instead of dumping results into the leader's context. In multi-file mode, analysts write findings to task descriptions via `TaskUpdate` and send only one-line summaries to team-lead. See [RLM Pattern](../rlm-pattern/SKILL.md) for the full team lifecycle. The examples below show the `subagent_type` syntax only:

```javascript
// Source code analysis (code-aware boundaries)
Task({
  subagent_type: "swarm:rlm-code-analyzer",
  description: "Analyze code chunk",
  prompt: "Query: Review for security issues\nFile: /tmp/rlm-chunks/chunk-01.py\nLanguage: python\nAnalysis focus: security\nThis is chunk 1 of 10."
})

// CSV data analysis (header-preserving chunks)
Task({
  subagent_type: "swarm:rlm-data-analyzer",
  description: "Analyze data chunk",
  prompt: "Query: Analyze distribution by region\nFile: /tmp/rlm-chunks/chunk-03.csv\nThis is chunk 3 of 9.\nKey columns: region, plan, mrr"
})

// JSON analysis (schema-aware chunks)
Task({
  subagent_type: "swarm:rlm-json-analyzer",
  description: "Analyze JSON chunk",
  prompt: "Query: Report schema patterns and anomalies\nFile: /tmp/rlm-chunks/chunk-02.jsonl\nFormat: jsonl\nThis is chunk 2 of 8."
})

// General chunk analysis (logs, prose, config, other)
Task({
  subagent_type: "swarm:rlm-chunk-analyzer",
  description: "Analyze log chunk",
  prompt: "Query: What errors occurred?\nFile: /var/log/app/server.log\nStart line: 1\nEnd line: 200\nThis is chunk 1 of 10."
})

// Synthesis (higher quality)
Task({
  subagent_type: "swarm:rlm-synthesizer",
  description: "Synthesize findings",
  prompt: "Original query: What errors occurred?\n\nFindings:\n[...findings JSON...]"
})
```

**RLM agents (defined by this plugin):**
- `swarm:rlm-code-analyzer` — Haiku model, code-aware chunk analysis with scope context and analysis focus
- `swarm:rlm-data-analyzer` — Haiku model, CSV/TSV chunk analysis with column distributions and statistics
- `swarm:rlm-json-analyzer` — Haiku model, JSON/JSONL chunk analysis with schema patterns and field distributions
- `swarm:rlm-chunk-analyzer` — Haiku model, general-purpose chunk analysis for logs, prose, config, markup
- `swarm:rlm-synthesizer` — Sonnet model, aggregates findings from multiple chunk analyses into coherent reports

**Do NOT override analyst models.** Do not pass `model: "sonnet"` or `model: "opus"` in the Task tool call when spawning analyst agents. The agent frontmatter defines `model: haiku` because structured counting, frequency analysis, and JSON output are well within Haiku's capability. Overriding to a more expensive model burns 10-50x the cost per chunk with no material quality gain. Only the synthesizer uses Sonnet. Leave the `model` parameter unset — let the agent definition's default apply.

---

## Agent Type Naming Convention

Plugin agents use the format: `{plugin}:{agent-name}` or `{plugin}:{category}:{agent-name}`

Examples:
- `sdlc:security-reviewer`
- `feature-dev:code-reviewer`
- `refactor:architect`
- `code-simplifier:code-simplifier`

Built-in agents use simple names: `Bash`, `Explore`, `Plan`, `general-purpose`, `claude-code-guide`, `statusline-setup`.

Swarm plugin agents follow the same convention:
- `swarm:rlm-code-analyzer`
- `swarm:rlm-data-analyzer`
- `swarm:rlm-json-analyzer`
- `swarm:rlm-chunk-analyzer`
- `swarm:rlm-synthesizer`
