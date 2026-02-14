---
name: rlm-pattern
description: Process files exceeding context limits using the RLM (Recursive Language Model) pattern with agent teams. Use when you need to process large files, analyze documents exceeding context, apply RLM chunking, chunk and analyze large content, or handle long context documents.
---

# RLM (Recursive Language Model) Pattern

Process files that exceed context limits by dividing them into partitions and coordinating a team of analyst agents to analyze each partition in parallel, then synthesizing their reports.

**Based on:** [arXiv:2512.24601](https://arxiv.org/abs/2512.24601)

---

## The Pattern

1. **Team Lead** detects content type, determines partitioning strategy, and divides the content into manageable chunks.

2. **Each Analyst agent** (selected by content type) independently analyzes their assigned partition and reports back to team-lead with structured findings.

3. **Team Lead** collects all analyst reports, then either synthesizes directly or spawns a dedicated Synthesizer agent to produce the consolidated report.

This is a fan-out/fan-in coordination pattern built on agent teams.

---

## When to Use

- File exceeds ~1500 lines or ~1500 CSV rows
- You need comprehensive analysis of the full content, not just a snippet
- Log analysis, data exports, large codebase review, document analysis
- Grep alone can't answer the question (need contextual analysis, not keyword matching)
- Directory contains multiple files needing cross-file analysis (see [Multi-File Directory Analysis](#multi-file-directory-analysis))

**Don't use when:** File fits in context (~1500 lines or fewer), a targeted Grep suffices, or the task is editing (not analyzing).

---

## Content-Type Detection

Before chunking, the Team Lead detects the content type to select the right partitioning strategy and analyst agent. This runs inline — no separate agent needed.

### Stage 1: Extension Mapping

| Extensions | Content Type | Confidence |
|-----------|-------------|------------|
| `.py`, `.ts`, `.js`, `.tsx`, `.jsx`, `.rb`, `.go`, `.rs`, `.java`, `.kt`, `.c`, `.cpp`, `.h`, `.hpp`, `.cs`, `.swift`, `.scala`, `.php`, `.lua`, `.zig`, `.ex`, `.exs`, `.hs`, `.ml`, `.sh`, `.bash`, `.zsh` | `source_code` | High |
| `.csv`, `.tsv` | `structured_data` | High |
| `.json` | `json` | High |
| `.jsonl`, `.ndjson` | `jsonl` | High |
| `.log` | `log` | High |
| `.md`, `.rst`, `.txt`, `.adoc` | `prose` | Medium |
| `.xml`, `.html`, `.htm`, `.svg` | `markup` | Medium |
| `.yaml`, `.yml`, `.toml`, `.ini`, `.conf` | `config` | Medium |

### Stage 2: Content Sniffing (when extension gives Medium or no confidence)

Read the first 50 lines and apply heuristics (first match wins):

| Heuristic | Detected Type | Signal |
|-----------|--------------|--------|
| First line matches CSV header pattern (comma/tab-separated tokens) | `structured_data` | `id,name,email,created_at` |
| Lines match `TIMESTAMP LEVEL message` pattern consistently | `log` | `2026-02-11 01:30:00 ERROR ...` |
| First non-whitespace is `[` or `{` and content parses as JSON | `json` | `{"key": "value", ...}` |
| Every line is independent valid JSON | `jsonl` | `{"event": "click"}\n{"event": "view"}` |
| Lines start with `def `, `function `, `class `, `import `, `#include`, `package ` | `source_code` | `def process_data(df):` |
| Markdown headings (`# `, `## `), paragraph text | `prose` | `## Introduction\n\nThis document...` |
| No pattern matches | `unknown` | Falls back to `prose` behavior |

### Detection Flow

```
1. Map file extension → content_type (Stage 1)
2. If confidence < High OR extension is .txt/.log:
   a. Read first 50 lines
   b. Apply Stage 2 heuristics (first match wins)
3. If still unknown → default to "prose"
4. Log: "Detected content type: {type} (via {extension|sniffing})"
```

---

## Partitioning Strategies

### Quick Reference

| Content Type | Partition By | Chunk Size | Analyst Agent |
|-------------|-------------|------------|---------------|
| Source code | Function/class boundaries | 150-300 lines | `swarm:rlm-code-analyzer` |
| CSV/TSV | Row count | ~2000 rows (narrow) / ~500 rows (wide) | `swarm:rlm-data-analyzer` |
| JSON | Top-level array elements | 200-500 elements | `swarm:rlm-json-analyzer` |
| JSONL | Line count | 500-1000 lines | `swarm:rlm-json-analyzer` |
| Log files | Line ranges + overlap | 200-5000 lines, 20-50 overlap | `swarm:rlm-chunk-analyzer` |
| Prose/docs | Section headings or line ranges | 250 lines, 25 overlap | `swarm:rlm-chunk-analyzer` |
| Config/markup/unknown | Line ranges + overlap | 200 lines, 20 overlap | `swarm:rlm-chunk-analyzer` |

**Choose chunk sizes from the targets above and let partition count scale with data size.** Fewer partitions under-utilizes parallelism; the practical ceiling is the synthesizer's ability to consume all analyst findings (typically manageable up to ~50 partitions with compact reports). For very large files, prefer more smaller partitions over fewer oversized ones — analyst quality degrades when chunks are too large.

### Source Code

- **Chunk boundary**: Function/class/module — scan for lines at indentation level 0 starting with keywords (`def `, `class `, `function `, `func `, `fn `, `pub fn `, `impl `, `module `, `export `, `const `, `type `, `interface `). Group consecutive lines between boundaries into chunks.
- **Chunk size**: 150-300 lines. If any chunk exceeds 300 lines, split at the next inner boundary. If no boundaries detected, fall back to 200-line chunks with 20-line overlap.
- **Overlap**: 0 — boundaries are semantic, no overlap needed.
- **Context injection**: Extract the file's import/require block (lines from start until first non-import line). Prepend this to every chunk file for dependency awareness.
- **Partition method**: Write chunk files (`chunk-01.py` through `chunk-N.py`), each starting with the shared import block.

### Structured Data (CSV/TSV)

- **Chunk boundary**: Row count (even splits).
- **Chunk size**: Target ~2000 rows per partition for narrow data (< 20 columns), ~500 rows for wide data (20+ columns). Partition count scales naturally with total row count — a 50K-row file produces ~25 partitions at 2000 rows each.
- **Overlap**: 0 — rows are independent.
- **Header preservation**: Every chunk file includes the original header row as line 1.
- **Partition method**: Write chunk files (`chunk-01.csv` through `chunk-N.csv`), each starting with the header.

### JSON (single document)

- **Chunk boundary**: Top-level array elements. If root is array, split by element count. If root is object, split by top-level keys.
- **Chunk size**: 200-500 elements per chunk. Adjust per element size.
- **Overlap**: 0 — objects are self-contained.
- **Partition method**: Write chunk files. Each chunk is a valid JSON array: `[element1, element2, ...]`.
- **Schema injection**: Include a schema summary (field names + types from first 5 elements) in the analyst prompt.

### JSONL / NDJSON

- **Chunk boundary**: Line count. Each line is one JSON object.
- **Chunk size**: 500-1000 lines. Adjust per line size.
- **Overlap**: 0 — lines are independent.
- **Partition method**: Write chunk files. Each chunk is valid JSONL.
- **Schema injection**: Include field list from first object in the analyst prompt.

### Log Files

- **Chunk boundary**: Line ranges (sequential).
- **Chunk size**: 200-5000 lines. Partition count scales with file size.
- **Overlap**: 20-50 lines. Prevents splitting multi-line stack traces.
- **Chunk index**: Each analyst receives "chunk M of N" for temporal ordering.
- **Partition method**: Read offset/limit — no file writes needed, analysts read in-place.

### Prose / Markdown / Docs

- **Chunk boundary**: Section headings (`#`, `##`) when possible.
- **Chunk size**: 250 lines, 25 overlap (fallback when no heading structure).
- **Chunk index**: "chunk M of N" for reading order.
- **Partition method**: Read offset/limit — no file writes needed.

### Config / Markup / Unknown

- **Chunk boundary**: Line ranges (current default behavior).
- **Chunk size**: 200 lines, 20 overlap.
- **Partition method**: Read offset/limit.

---

## Agent Routing

The Team Lead selects the analyst agent based on detected content type and the user's analysis goal.

### Routing by Content Type

| Content Type | Analyst Agent | Why |
|-------------|---------------|-----|
| `source_code` | `swarm:rlm-code-analyzer` | Understands function/class boundaries, reports with scope context, supports analysis focus |
| `structured_data` | `swarm:rlm-data-analyzer` | Column-aware, reports distributions and statistics, aggregatable across chunks |
| `json` / `jsonl` | `swarm:rlm-json-analyzer` | Schema-aware, reports field distributions and structural patterns |
| `log` | `swarm:rlm-chunk-analyzer` | General-purpose, good at error/pattern detection in sequential text |
| `prose` | `swarm:rlm-chunk-analyzer` | General-purpose, handles unstructured text |
| `config` / `markup` / `unknown` | `swarm:rlm-chunk-analyzer` | Fallback general-purpose analyzer |

### Analysis Focus (source code only)

For source code, the Team Lead includes an analysis focus in each analyst's prompt to steer findings:

| User's Goal | Analysis Focus | What Analysts Prioritize |
|------------|---------------|-------------------------|
| Code review / bugs | `general` | Logic errors, complexity, code quality |
| Security audit | `security` | Injection, auth bypass, secrets, unsafe operations |
| Architecture review | `architecture` | Coupling, cohesion, SOLID, dependency patterns |
| Performance review | `performance` | Algorithmic complexity, blocking calls, N+1 |

This is passed as text in the prompt, not as a separate parameter:
```
Analysis focus: security
```

---

## Team Composition

| Role | Count | Agent Type | Purpose |
|------|-------|-----------|---------|
| Team Lead | 1 | You (the orchestrating agent) | Detect type, partition, spawn analysts, synthesize |
| Code Analyst | scales to partitions | `swarm:rlm-code-analyzer` | Source code chunks |
| Data Analyst | scales to partitions | `swarm:rlm-data-analyzer` | CSV/TSV data chunks |
| JSON Analyst | scales to partitions | `swarm:rlm-json-analyzer` | JSON/JSONL chunks |
| General Analyst | scales to partitions | `swarm:rlm-chunk-analyzer` | Logs, prose, config, markup, other |
| Synthesizer | 0-1 | `swarm:rlm-synthesizer` | Combine all analyst reports into final output (optional — team lead can do this directly if findings are compact) |

**Single-file mode:** Only one analyst type is used per session — determined by the detected content type.

**Multi-file mode:** Different analyst types run simultaneously when a directory contains mixed content types (e.g., Python + CSV + JSON). See [Multi-File Directory Analysis](#multi-file-directory-analysis).

**Sizing guidance:**
- Spawn 1 analyst per 3-5 tasks — each analyst claims multiple tasks from the shared TaskList
- Scale analyst count proportionally: `analyst_count = ceil(task_count / 4)`
- More analysts = faster throughput but more context pressure from notification messages; fewer = slower but lighter on context
- Beyond ~15 analysts, the cost and notification volume outweigh the parallelism benefit — consider whether the task can be decomposed differently

---

## Team Orchestration Lifecycle

**CRITICAL: RLM uses team orchestration, not plain background subagents.** Analysts are spawned as teammates (with `team_name` + `name`) so they communicate via inbox messages rather than dumping full results into the leader's context.

### Step 1: Create Team and Tasks

```javascript
// Create the RLM team
TeamCreate({ team_name: "rlm-analysis", description: "RLM analysis of production.log" })

// Create one task per partition
TaskCreate({ subject: "Analyze chunk 1 of 8", description: "File: /var/log/app/server.log\nStart line: 1\nEnd line: 5000\nQuery: What errors occurred?", activeForm: "Analyzing chunk 1..." })
TaskCreate({ subject: "Analyze chunk 2 of 8", description: "File: /var/log/app/server.log\nStart line: 4951\nEnd line: 10000\nQuery: What errors occurred?", activeForm: "Analyzing chunk 2..." })
// ... one TaskCreate per partition
```

### Step 2: Spawn Analyst Teammates

```javascript
// Spawn analysts as TEAMMATES (team_name + name), NOT plain subagents
// Each analyst claims tasks from the shared task list

const analystPrompt = `You are an RLM chunk analyst on team "rlm-analysis".

Workflow:
1. Call TaskList to find available tasks
2. Claim a pending task with TaskUpdate (set owner to your name)
3. Read the chunk described in the task
4. Analyze per the query
5. Mark task completed with TaskUpdate
6. Send your JSON findings to team-lead via SendMessage
7. Check TaskList for more work — repeat until no tasks remain
8. When no tasks remain, send "All tasks complete" to team-lead

Query: What errors occurred and are there any patterns?
Always send findings via SendMessage to "team-lead" — do NOT just return them.`

// Calculate analyst count: ceil(task_count / 4)
// Example: 8 tasks → 2 analysts, 40 tasks → 10 analysts
// NOTE: Do NOT set model parameter — agent definition defaults to Haiku, which is correct for chunk analysis
const analystCount = Math.ceil(taskCount / 4)
for (let i = 1; i <= analystCount; i++) {
  Task({ team_name: "rlm-analysis", name: `analyst-${i}`, subagent_type: "swarm:rlm-chunk-analyzer", prompt: analystPrompt, run_in_background: true })
}
```

### Step 3: Collect Reports via Inbox

Analyst messages arrive automatically in the team lead's inbox. Wait for all analysts to report.

### Step 4: Synthesize

Either synthesize directly or spawn a synthesizer teammate:

```javascript
Task({
  team_name: "rlm-analysis",
  name: "synthesizer",
  subagent_type: "swarm:rlm-synthesizer",
  prompt: `Original query: What errors occurred?\n\nFindings:\n${collectedFindings}\n\nSend the consolidated report to team-lead via SendMessage.`,
  run_in_background: true
})
```

### Step 5: Shutdown and Cleanup

```javascript
// Request shutdown for all teammates
SendMessage({ type: "shutdown_request", recipient: "analyst-1", content: "Analysis complete" })
SendMessage({ type: "shutdown_request", recipient: "analyst-2", content: "Analysis complete" })
SendMessage({ type: "shutdown_request", recipient: "analyst-3", content: "Analysis complete" })
SendMessage({ type: "shutdown_request", recipient: "synthesizer", content: "Analysis complete" })

// Wait for shutdown approvals, then cleanup
TeamDelete()
```

### Why Teams, Not Plain Subagents

| Aspect | Plain subagents (`Task()` only) | Team orchestration (`TeamCreate` + `team_name`) |
|--------|--------------------------------|------------------------------------------------|
| Results delivery | Full output dumps into leader context | Compact messages via inbox |
| Context pressure | 8 analysts x 4K = 32K chars in leader context | Messages arrive one at a time, manageable |
| Work distribution | Fixed: 1 subagent per chunk | Flexible: analysts claim from shared task list |
| Lifecycle | Fire and forget | Graceful shutdown + cleanup |
| Scaling | Must pre-assign chunks to agents | Agents self-balance across partitions |

---

## What Analysts Should Report

Each analyst should independently report on their partition:

- **Frequency counts** for categorical fields (types, categories, priorities, statuses)
- **Pattern recognition** in text fields (common phrases, recurring themes, clusters)
- **Temporal patterns** (trends over time, spikes, seasonality)
- **Distributions** (severity, priority, resolution time)
- **Outliers** and anomalies
- **Correlations** between dimensions (type vs. component, priority vs. resolution time)

Reports should be **compact structured data** (JSON or concise markdown), not raw content dumps.

---

## What the Synthesis Should Produce

The consolidated report should include:

- **Overall rankings** — top categories/patterns by frequency and impact across all partitions
- **Trends** — period-over-period or temporal patterns visible only when combining all partitions
- **Risk areas** — categories likely to escalate or grow
- **Recommended focus areas** with supporting data from multiple analysts
- **Summary statistics** — total items analyzed, date range, partition breakdown

---

## Context Management

The RLM pattern creates many agents that report back. To prevent context exhaustion:

1. **Use team orchestration** — spawn analysts as teammates (with `team_name` + `name`) so results arrive via inbox messages, not as full task output dumps in the leader's context
2. **Fewer analysts than tasks** — target 1 analyst per 3-5 tasks, each claiming multiple tasks from the shared TaskList
3. **Size partitions for analyst quality** — chunk size should stay within the content-type targets (see Partitioning Strategies). Let partition count scale with data size rather than forcing oversized chunks to hit a count target
4. **Analyst reports must be compact** — structured summaries, not raw data
5. **Pass by reference** — give analysts file paths and line ranges, never paste content into prompts
6. **Run /compact before synthesis** if context is getting full from collecting reports

**WARNING:** Do NOT spawn analysts as plain background subagents (`Task()` without `team_name`). Their full output will land in the leader's context, and with 8-10 analysts this will exhaust the context window and crash the session.

### Multi-File Context Strategies

When processing directories (multi-file mode), additional strategies apply:

7. **Findings-in-task-descriptions** — analysts write full JSON findings to their task description via `TaskUpdate` instead of sending them via `SendMessage`. Send only a one-line summary to team-lead. Synthesizers read findings via `TaskGet`.
8. **Run /compact between phases** — after all analysts complete and before spawning synthesizers, compact the context to clear analyst notification messages
9. **Scale analysts to task count** — target 1 analyst per 3-5 tasks across all types. For large workloads (50+ tasks), weigh the cost of additional analysts against the quality benefit of faster completion.
10. **Two-phase synthesis** — per-type synthesis (parallel) then cross-type synthesis (sequential) avoids overloading a single synthesizer with heterogeneous findings

---

## Multi-File Directory Analysis

Extend the single-file RLM pattern to process an entire directory of mixed-type files in one session. See [Multi-File RLM Design](../../docs/design/multi-file-rlm.md) for the full design document.

### When to Use Multi-File vs Single-File

| Scenario | Mode |
|----------|------|
| One large file | Single-file RLM |
| Directory of files, all same type | Single-file RLM per file, or multi-file |
| Directory with mixed content types needing cross-file analysis | **Multi-file RLM** |
| "Review this project directory" | **Multi-file RLM** |

### File Enumeration

The Team Lead enumerates the directory inline using Glob:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `directory` | (required) | Target directory path |
| `include` | `*` | Glob include patterns |
| `exclude` | node_modules, .git, __pycache__, binaries, lock files | Glob exclude patterns |
| `recursive` | `true` | Descend into subdirectories |
| `max_files` | `20` | Safety cap on file count |

### Partition Budget

Files are tiered by size:

| Tier | Line Count | Partitions |
|------|-----------|------------|
| Small | ≤ 1500 | 0 (batched with same-type small files) |
| Medium | 1501-5000 | Use content-type chunk size targets (typically 3-5 partitions) |
| Large | > 5000 | Use content-type chunk size targets — scales with file size |

Partition count is data-driven: divide each file's size by its content-type chunk target (e.g., 200-line chunks for code, 2000-row chunks for CSV). If the total partition count across all files becomes very large (50+), consider whether all files need full analysis or if some can be batched or excluded. The practical ceiling is the synthesizer's ability to consume findings, not an arbitrary cap.

### Per-File Chunking

Each file in multi-file mode is partitioned using the same content-type strategy as single-file RLM (see [Partitioning Strategies](#partitioning-strategies) above). Multi-file mode does not introduce new chunking logic. A 50,000-row CSV in a directory gets the same header-preserving, row-count-based chunking as it would in single-file mode.

### Chunking Guardrails

**These rules are mandatory. Violating them defeats the purpose of the RLM pattern.**

1. **No file over 1500 lines/rows goes to a single analyst unchunked.** Every file exceeding 1500 lines MUST be partitioned according to its content-type chunk size target. Assigning a 10,000-row CSV to a single analyst is a pattern violation.

2. **Partition count is computed, never guessed.** Use the formula: `partition_count = ceil(file_size / chunk_size_target)` where chunk_size_target comes from the Partitioning Strategies table (e.g., 2000 rows for narrow CSV, 500 for wide CSV).

3. **Each chunk must fit in an analyst's effective context.** If a chunk would exceed ~2000 lines or ~4MB, reduce the chunk_size_target until chunks are manageable. The RLM pattern exists precisely because files are too large for single-agent processing — never bypass this by sending oversized chunks.

4. **Multi-file directories chunk EACH file independently.** Processing a directory of 10 CSV files means partitioning each file per its content-type target, not assigning one analyst per file. A directory of 10 x 10,000-row CSVs should produce ~50 partition tasks (10 files x 5 chunks each at 2000 rows/chunk), not 10 tasks.

5. **Byte-size check for structured data.** For CSV/TSV files, if the file exceeds 10MB, halve the chunk_size_target. A 100MB CSV with 10,000 rows has ~10KB per row — standard 2000-row chunks would be 20MB each, far too large. Use 500-row chunks instead.

### Small File Batching

Multiple small files of the same content type are batched into ≤ 1500-line groups, each assigned one analyst task. A lone small file gets one analyst task (whole-file). Analysts read each file via the Read tool — the task description lists file paths with boundary markers.

### Mixed Analyst Types

Unlike single-file RLM, a multi-file session spawns different analyst types simultaneously. The Team Lead determines the analyst mix from the file manifest:

```
source_code tasks → swarm:rlm-code-analyzer
structured_data tasks → swarm:rlm-data-analyzer
json/jsonl tasks → swarm:rlm-json-analyzer
log/prose/config tasks → swarm:rlm-chunk-analyzer
```

Scale analyst count to total task count: target 1 analyst per 3-5 tasks, distributed proportionally across content types (at least 1 analyst per type that has tasks). For large workloads, weigh the cost of additional analysts against completion speed.

### Two-Phase Synthesis

Synthesis runs in two phases using task dependencies:

1. **Phase 1 (parallel)**: One synthesis task per content type. Synthesizer reads analyst findings from task descriptions via `TaskGet`, produces type-level summary.
2. **Phase 2 (sequential)**: One cross-type synthesis task, blocked until all Phase 1 tasks complete. Reads Phase 1 summaries via `TaskGet`, produces final report with Per-File Findings, Cross-File Analysis, and Recommendations.

Both phases use the existing `swarm:rlm-synthesizer` with different prompts. No new agents needed.

### Multi-File Context Management

- Analysts write findings to task descriptions via `TaskUpdate`, send only one-line summaries to team-lead
- Synthesizers read findings via `TaskGet` — raw findings never enter Team Lead's context
- Run `/compact` between analyst and synthesis phases
- Scale analyst count to task volume (1 per 3-5 tasks); weigh cost against throughput for large workloads

### Abbreviated Walkthrough

**Input:** `/project/src/` with 3 Python files (2800, 1900, 3200 lines), 2 JSON configs (250, 180 lines), 1 README (300 lines).

1. **Enumerate**: 6 files, detect types → 3 source_code, 2 json, 1 prose
2. **Budget**: Medium files partitioned by content-type chunk targets → 4+3+4 = 11 partitions; small files batched → 2 batch tasks; total = 13 tasks
3. **Analyst mix**: 13 tasks ÷ 4 ≈ 4 analysts → 3 code analysts, 1 JSON analyst (proportional to task counts)
4. **Analysts work**: claim tasks, analyze, write findings to task descriptions
5. **Phase 1 synthesis**: "Synthesize code findings" + "Synthesize JSON findings" (parallel)
6. **Phase 2 synthesis**: Cross-type synthesis (blocked by Phase 1)
7. **Final report**: Per-file findings + cross-file analysis + recommendations

---

## Agent Types

| Role | subagent_type | Model | Tools |
|------|--------------|-------|-------|
| Code analyzer | `swarm:rlm-code-analyzer` | Haiku | Read, Grep, Glob, SendMessage, TaskList, TaskGet, TaskUpdate |
| Data analyzer | `swarm:rlm-data-analyzer` | Haiku | Read, Grep, Glob, SendMessage, TaskList, TaskGet, TaskUpdate |
| JSON analyzer | `swarm:rlm-json-analyzer` | Haiku | Read, Grep, Glob, SendMessage, TaskList, TaskGet, TaskUpdate |
| General chunk analyzer | `swarm:rlm-chunk-analyzer` | Haiku | Read, Grep, Glob, SendMessage, TaskList, TaskGet, TaskUpdate |
| Synthesizer | `swarm:rlm-synthesizer` | Sonnet | Read, SendMessage, TaskGet, TaskUpdate |

All are custom agents defined by this plugin. Fallback: use `general-purpose` with `model: "haiku"` or `model: "sonnet"`.

**Do NOT override analyst models.** The agent frontmatter sets `model: haiku` for analysts because structured counting, distribution extraction, and JSON output are well within Haiku's capability. Passing `model: "sonnet"` in the Task tool call overrides the agent default and burns 10-50x the cost per chunk with no material quality gain on structured analysis tasks. Only the synthesizer uses Sonnet (for narrative synthesis across many findings). Leave the `model` parameter unset when spawning analysts — let the agent definition's default apply.

---

## Comparison with rlm-rs Plugin

| Feature | swarm:rlm-pattern | rlm-rs plugin |
|---------|-------------------|---------------|
| Dependencies | None (Claude Code native) | Requires rlm-rs binary |
| Content-aware chunking | Yes (5 content types) | No (line-range only) |
| Chunking | File splits or Read offset/limit | rlm-rs buffer system |
| Sub-LLM execution | Content-type-specific analyzers (Haiku) | `rlm-rs:rlm-subcall` (Haiku) |
| Synthesis | `swarm:rlm-synthesizer` (Sonnet) | `rlm-rs:rlm-synthesizer` (Sonnet) |
| Best for | Quick setup, no install | Heavy/repeated RLM workflows |
