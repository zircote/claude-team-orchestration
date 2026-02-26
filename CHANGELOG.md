# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-02-26

### Added

- **JSONL Log Analyzer skill** (`skills/jsonl-log-analyzer/SKILL.md`): Automated schema-aware JSONL log analysis — discovers field schema via `jq`, generates tailored extraction recipes, and orchestrates the RLM fan-out/fan-in pipeline with `swarm:rlm-json-analyzer` analysts
- **JSONL Log Analysis examples** in `docs/rlm-examples.md`: Copy-paste prompts for error investigation, traffic analysis, and incident timeline reconstruction with comparison to standard JSON/JSONL RLM
- **Cross-references** in `docs/agent-types.md` and `skills/agent-types/SKILL.md` linking `swarm:rlm-json-analyzer` to the new JSONL Log Analyzer skill
- **`docs/concepts.md`** (explanation): Team lifecycle, pattern mechanics, RLM content processing internals, cross-file analysis, task dependencies
- **`docs/reference.md`** (reference): Consolidated lookup tables — primitives, pattern quick reference, message types, task statuses, task fields, configuration, spawn backends, RLM tables, known limitations, debugging commands

### Changed

- Restructured `docs/` along the Diataxis framework (tutorial, how-to, reference, explanation separation)
- Refocused `docs/patterns.md` as how-to: extracted "How it works" blocks to `concepts.md`, pattern table and agent recs to `reference.md`, absorbed "Choosing Agents for Teams" from `agent-types.md`
- Cleaned `docs/rlm-examples.md` as how-to: extracted "What Claude does" blocks to `concepts.md`, reference tables to `reference.md`, added cross-reference links
- Cleaned `docs/troubleshooting.md`: extracted Known Limitations and Debugging Commands to `reference.md`
- Cleaned `docs/getting-started.md`: extracted "What happens" lifecycle to `concepts.md`, added reference link to Next Steps
- Cleaned `docs/agent-types.md`: moved "Choosing Agents for Teams" to `patterns.md`, added See Also footer

## [1.3.0] - 2026-02-13

### Added

- **Anti-pattern guardrail** ("Critical: What RLM is NOT"): New section in `skills/rlm-pattern/SKILL.md` that prevents thematic decomposition — explicitly warns against creating per-analysis-goal tasks instead of per-data-partition tasks
- **Pre-processing for compressed inputs**: New section handles `.zip`, `.gz`, `.tar.gz` archives before content-type detection, with routing to single-file or multi-file mode based on archive contents
- **Mandatory CSV partitioning procedure**: Concrete step-by-step bash commands (`wc -l` → divide → write chunk files) in the Structured Data section — eliminates ambiguity about how to partition CSVs
- **Multi-file partitioning sanity check**: Warning in Multi-File Directory Analysis section with concrete validation: "if task count = file count, you haven't partitioned"
- **Large CSV Directory walkthrough**: New abbreviated walkthrough showing 11 CSV files → 88 chunks → 88 analysts with staged spawning — mirrors real-world Jira export analysis scenario

### Changed

- **1:1 analyst-per-partition model**: Replaced `ceil(partition_count / 4)` formula with `analyst_count = partition_count` across all sizing guidance (3 locations in SKILL.md, design doc, and all referencing docs)
- **Staged spawning**: Analysts spawn in batches of ~15 instead of all at once; pre-assigned chunks instead of shared task pool claiming
- **Fresh context per analyst**: Each analyst gets a clean context window for one chunk — no cross-chunk contamination from reusing analyst contexts
- **Wide CSV chunk range widened** to ~500-1500 rows: ~500 for dense wide data, ~1500 for sparse wide data (e.g., Jira exports with many empty columns)
- **Removed ~15 analyst cap**: No hard ceiling on analyst count; Haiku analysts are lightweight
- **Aggressive partitioning guidance**: Replaced "practical ceiling" language with "no ceiling when using findings-in-task-descriptions mode and staged spawning"
- Updated Step 1 and Step 2 lifecycle code examples to show 1:1 pre-assigned model
- Updated "Why Teams" table to show pre-assigned distribution model
- Updated multi-file sections: analyst mix text, walkthrough analyst counts, context management
- Synchronized all referencing documentation: `docs/patterns.md`, `docs/rlm-examples.md`, `skills/orchestration-patterns/SKILL.md`, `skills/agent-types/SKILL.md`, `docs/design/content-aware-rlm.md`, `docs/design/multi-file-rlm.md`, `skills/orchestration-patterns/examples/complete-workflows.md`

## [1.2.2] - 2026-02-13

### Changed

- Replaced hard caps (6 analysts, 30 partitions) in RLM pattern with data-driven scaling guidance
  - Partition count now scales with data size using content-type chunk targets instead of a fixed 30-partition cap
  - Analyst count scales to task volume (1 per 3-5 tasks) instead of a fixed 6-analyst cap
  - CSV partitioning uses concrete row targets (~2000 rows narrow, ~500 rows wide) instead of "target 5-10 partitions"
  - Practical ceilings framed as cost/context trade-offs (~50 partitions, ~15 analysts) rather than hard limits
- Updated sizing guidance across `skills/rlm-pattern/SKILL.md`, `skills/orchestration-patterns/SKILL.md`, `skills/agent-types/SKILL.md`, `docs/rlm-examples.md`, `docs/design/multi-file-rlm.md`, and `CLAUDE.md`

## [1.2.1] - 2026-02-11

### Added

- **RLM Examples Guide** (`docs/rlm-examples.md`): Copy-paste example prompts for all 6 RLM modes (basic, code-aware, CSV, JSON, directory, multi-type) with feature comparison table and sizing guidelines

## [1.2.0] - 2026-02-11

### Added

- **Content-Aware RLM**: Automatic content-type detection (extension mapping + content sniffing) and type-specific chunking strategies. Design document at `docs/design/content-aware-rlm.md`
- **New agents** (`agents/`):
  - `swarm:rlm-code-analyzer` — Haiku-powered source code analyzer with function/class scope context, severity levels, and configurable analysis focus (general, security, architecture, performance)
  - `swarm:rlm-data-analyzer` — Haiku-powered CSV/TSV analyzer with column-aware distributions, statistics, and aggregatable frequency counts
  - `swarm:rlm-json-analyzer` — Haiku-powered JSON/JSONL analyzer with schema pattern detection, field distributions, and type consistency checks
- **Multi-File Directory RLM**: Extension of single-file RLM to process entire directories with mixed content types in one team session. Design document at `docs/design/multi-file-rlm.md`
  - Per-file content-type detection and mixed analyst routing
  - Tiered partition budget (small/medium/large) with 30-partition global cap
  - Small file batching by content type
  - Two-phase synthesis: per-type (parallel) then cross-type (sequential) via task dependencies
  - Findings-in-task-descriptions pattern to protect Team Lead context
  - Max 6 analysts across all types
- **Workflow 5: Multi-File Directory Analysis** (`skills/orchestration-patterns/examples/complete-workflows.md`): End-to-end example with mixed analyst types, two-phase synthesis, and task dependency wiring

### Changed

- Updated `skills/rlm-pattern/SKILL.md` with content-type detection, type-specific partitioning strategies, agent routing matrix, content-aware team composition, and multi-file directory analysis section
- Updated `skills/agent-types/SKILL.md` with 3 new content-aware RLM agents and multi-file mixed-type usage note
- Updated `skills/orchestration-patterns/SKILL.md` Pattern 7 with content-aware agent recommendations and multi-file variant
- Updated `agents/rlm-chunk-analyzer.md` with role scope note (general-purpose analyzer for logs, prose, config) and multi-file mode workflow
- Updated `agents/rlm-synthesizer.md` with heterogeneous findings support, TaskGet/TaskUpdate tools, and multi-file synthesis modes (per-type and cross-type)
- Updated all 4 analyst agents with multi-file mode reporting (findings to task descriptions via TaskUpdate)
- Updated `docs/agent-types.md`, `docs/patterns.md` to reflect content-aware and multi-file capabilities
- Updated `docs/design/content-aware-rlm.md` Future Considerations with forward reference to multi-file design
- Added analyst model override guardrails to `skills/rlm-pattern/SKILL.md` and `skills/agent-types/SKILL.md`

## [1.1.0] - 2026-02-10

### Added

- **RLM Pattern** (Pattern 7): Fan-out/fan-in chunked parallel analysis for files exceeding context limits, based on [arXiv:2512.24601](https://arxiv.org/abs/2512.24601). Uses role-based workflow descriptions that naturally trigger team orchestration (TeamCreate, Task, SendMessage, TeamDelete)
- **New agents** (`agents/`):
  - `swarm:rlm-chunk-analyzer` — Haiku-powered chunk-level analysis agent with structured JSON output; reads files directly via Read tool with offset/limit
  - `swarm:rlm-synthesizer` — Sonnet-powered synthesis agent for aggregating multi-chunk findings into consolidated reports with file:line references
- **New skill** (`skills/rlm-pattern/`):
  - `swarm:rlm-pattern` — Complete RLM workflow with partitioning strategy guide (CSV, logs, source code, prose, time-series), team composition table, analyst report format, synthesis output structure, context management guardrails, and comparison with rlm-rs plugin
- **Workflow 4: RLM Document Analysis** (`skills/orchestration-patterns/examples/complete-workflows.md`): End-to-end scenario-based example with Grep scouting, targeted chunk analysis, and structured synthesis
- **Example analysis prompt** (`docs/RLM-Prompt-Example.md`): Reference prompt for CSI Jira export analysis using the RLM pattern

### Changed

- Updated orchestration pattern count from 6 to 7 across all documentation
- Added RLM agents (`swarm:rlm-chunk-analyzer`, `swarm:rlm-synthesizer`) to agent type selection guides
- Added best practice "Use Pass-by-Reference for Large Content" to orchestration patterns
- Updated README skills reference table and verify-installation skill list
- Updated plugin version from 1.0.0 to 1.1.0

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

[1.4.0]: https://github.com/zircote/claude-team-orchestration/releases/tag/v1.4.0
[1.0.0]: https://github.com/zircote/claude-team-orchestration/releases/tag/v1.0.0
[1.1.0]: https://github.com/zircote/claude-team-orchestration/releases/tag/v1.1.0
[1.2.0]: https://github.com/zircote/claude-team-orchestration/releases/tag/v1.2.0
[1.2.1]: https://github.com/zircote/claude-team-orchestration/releases/tag/v1.2.1
[1.2.2]: https://github.com/zircote/claude-team-orchestration/releases/tag/v1.2.2
[1.3.0]: https://github.com/zircote/claude-team-orchestration/releases/tag/v1.3.0
