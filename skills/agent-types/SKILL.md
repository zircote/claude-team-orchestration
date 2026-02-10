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
| Chunk-level file analysis | **swarm:rlm-chunk-analyzer** | Haiku, fast, structured JSON output |
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

```javascript
// Chunk analysis (fast, cheap)
Task({
  subagent_type: "general-purpose",
  model: "haiku",
  description: "Analyze log chunk",
  prompt: "Read /path/to/file.log lines 1-200 and analyze for errors. Return JSON findings."
})

// Synthesis (higher quality)
Task({
  subagent_type: "general-purpose",
  model: "sonnet",
  description: "Synthesize findings",
  prompt: "Synthesize these chunk findings into a coherent report: [findings JSON]"
})
```

**RLM agents (defined by this plugin):**
- `swarm:rlm-chunk-analyzer` — Haiku model, reads file chunks via Read with offset/limit, returns structured JSON findings
- `swarm:rlm-synthesizer` — Sonnet model, aggregates findings from multiple chunk analyses into coherent reports

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
- `swarm:rlm-chunk-analyzer`
- `swarm:rlm-synthesizer`
