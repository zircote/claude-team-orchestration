# CLAUDE.md

## Project Overview

**swarm** — A Claude Code plugin for multi-agent orchestration. Coordinates teams of agents with shared tasks, inter-agent messaging, and 7 proven patterns including RLM for large-file analysis.

- **Version:** 1.2.2
- **License:** MIT
- **Plugin namespace:** `swarm:`

## Project Structure

```
.claude-plugin/plugin.json   # Plugin manifest (name, version, description)
agents/                      # Agent definitions (markdown, loaded by Claude Code)
  rlm-chunk-analyzer.md      # Haiku — logs, prose, config analysis
  rlm-code-analyzer.md       # Haiku — source code analysis
  rlm-data-analyzer.md       # Haiku — CSV/TSV data analysis
  rlm-json-analyzer.md       # Haiku — JSON/JSONL analysis
  rlm-synthesizer.md         # Sonnet — aggregates analyst findings
skills/                      # Skills (each has SKILL.md)
  orchestrating/             # Entry point — primitives, lifecycle, quick reference
  team-management/           # TeamCreate, spawn, delegate, shutdown, cleanup
  task-system/               # TaskCreate, dependencies, claiming, progress
  messaging/                 # SendMessage, broadcasts, shutdown/plan protocols
  agent-types/               # Built-in + plugin agents, selection guide
  orchestration-patterns/    # 7 patterns + complete workflow examples
  rlm-pattern/               # Content-aware chunked analysis (RLM)
  spawn-backends/            # in-process, tmux, iTerm2
  error-handling/            # Common errors, hooks, recovery
docs/                        # User-facing documentation
  getting-started.md         # Install to first team run
  agent-types.md             # Agent selection guide
  patterns.md                # 7 orchestration patterns
  rlm-examples.md            # Copy-paste RLM prompts
  troubleshooting.md         # Common failures and fixes
  design/                    # Design documents for features
```

## Development Conventions

- **Content is markdown-only.** No source code, no build step, no dependencies. Skills are SKILL.md files with YAML frontmatter. Agents are plain markdown.
- **Plugin manifest** lives at `.claude-plugin/plugin.json`. Update `version` there and in README badge when releasing.
- **CHANGELOG.md** follows Keep a Changelog format with semantic versioning.
- **Skills** each live in their own directory under `skills/` with a `SKILL.md` file. The YAML frontmatter `name` and `description` fields are required.
- **Agents** are markdown files in `agents/`. They define agent behavior, tools, and model preferences.
- **Docs** in `docs/` are user-facing guides. Design docs go in `docs/design/`.

## The 7 Orchestration Patterns

1. **Parallel Specialists** — Independent reviewers, different focus areas
2. **Pipeline** — Sequential stages with task dependencies
3. **Swarm** — Workers grab tasks from shared pool, self-balancing
4. **Research + Implementation** — Learn then build with subagents
5. **Plan Approval** — Require plan review before implementation
6. **Multi-File Refactoring** — Fan-in dependencies for cross-file changes
7. **RLM** — Chunked parallel analysis for large files/directories

## Key RLM Details

- Content-aware: auto-detects file types and uses type-specific chunking
- 4 analyst types: code, data, JSON, chunk (general). All run on Haiku.
- Synthesizer runs on Sonnet. Do not override analyst models.
- Multi-file mode: batches small files by type, two-phase synthesis
- Data-driven partition sizing (scales with input size), analyst count scales to task volume

## Writing New Skills

- Create `skills/<skill-name>/SKILL.md` with YAML frontmatter (`name`, `description`)
- Register in plugin.json is not needed — skills are auto-discovered from the `skills/` directory
- Follow existing patterns: clear sections, mermaid diagrams where useful, practical examples

## Writing New Agents

- Create `agents/<agent-name>.md` with role description, available tools, and output format
- Specify model preference (Haiku for analysis workers, Sonnet for synthesis)
- Include structured output format expectations
