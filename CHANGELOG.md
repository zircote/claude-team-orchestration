# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-10

### Added

- **Plugin manifest** (`.claude-plugin/plugin.json`): Packaged as standalone Claude Code plugin named "swarm" with proper metadata, version, homepage, and license
- **Skills** (8 modular skills under `skills/`):
  - `orchestrating` — Primitives overview, lifecycle diagram, quick reference
  - `team-management` — Team creation, teammate spawning, delegate mode, permissions, graceful shutdown, cleanup
  - `task-system` — Task CRUD, dependencies, claiming with file locking, status tracking
  - `messaging` — Direct messages, broadcasts, shutdown requests/responses, plan approval protocol, idle notifications
  - `agent-types` — Built-in agents (Bash, Explore, Plan, general-purpose, claude-code-guide) and plugin agents (review, research, refactoring, CI/CD, test generation) with selection guide
  - `orchestration-patterns` — Six proven patterns: parallel specialists, pipeline, swarm, research+implementation, plan approval, multi-file refactoring
  - `spawn-backends` — In-process, tmux, and iTerm2 backends with auto-detection logic and configuration
  - `error-handling` — Common errors, quality gate hooks (TeammateIdle, TaskCompleted), known limitations, recovery strategies
- **Complete workflow examples** (`skills/orchestration-patterns/examples/complete-workflows.md`): Full end-to-end examples for parallel code review, research-plan-implement pipeline, and self-organizing swarm
- **Documentation** (`docs/`):
  - `getting-started.md` — End-to-end walkthrough from install to first team run
  - `agent-types.md` — Agent selection reference with capabilities and use cases
  - `patterns.md` — Pattern selection guide with when-to-use guidance
  - `troubleshooting.md` — Common failures, debugging commands, and known limitations
- **README.md**: Adoption-focused guide with prerequisites (Claude Code, agent teams flag, tmux), installation, quick start example, skills reference table, and attribution

### Attribution

Based on the [Claude Code Swarm Orchestration Skill](https://gist.github.com/kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea) by [@kieranklaassen](https://github.com/kieranklaassen). Decomposed from a monolithic gist into modular, maintainable plugin skills.

[1.0.0]: https://github.com/zircote/claude-team-orchestration/releases/tag/v1.0.0
