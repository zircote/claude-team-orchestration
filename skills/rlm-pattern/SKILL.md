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

### Critical: What RLM is NOT

RLM partitions **the data**, not the analysis. Every analyst receives the same query and examines all columns/fields in their chunk of rows. The analysis goals are the query — not separate tasks.

**WRONG** (thematic decomposition):
- Task 1: "Analyze error patterns" (reads entire file)
- Task 2: "Analyze root causes" (reads entire file again)
- Task 3: "Analyze trends" (reads entire file again)
- Task 4: Synthesize (blocked by 1-3)

**RIGHT** (data partitioning):
- Task 1: "Chunk 1 of 10 — rows 1-5000" (query: find error patterns, root causes, and trends)
- Task 2: "Chunk 2 of 10 — rows 5001-10000" (same query)
- ...
- Task 10: "Chunk 10 of 10 — rows 45001-50000" (same query)
- Synthesis: aggregate all chunk findings

If you find yourself creating tasks named after analysis concerns rather than data partitions, STOP — you are not doing RLM.

---

## When to Use

- File exceeds ~1500 lines or ~1500 CSV rows
- You need comprehensive analysis of the full content, not just a snippet
- Log analysis, data exports, large codebase review, document analysis
- Grep alone can't answer the question (need contextual analysis, not keyword matching)
- Directory contains multiple files needing cross-file analysis (see [Multi-File Directory Analysis](#multi-file-directory-analysis))

**Don't use when:** File fits in context (~1500 lines or fewer), a targeted Grep suffices, or the task is editing (not analyzing).

---

## Pre-Processing

Before content-type detection, handle compressed or archived inputs:

| Input | Action |
|-------|--------|
| `.zip` | `unzip <file> -d /tmp/rlm-extract/` — then detect content type of extracted file(s) |
| `.gz` | `gunzip -k <file>` — then detect content type of decompressed file |
| `.tar.gz` / `.tgz` | `tar xzf <file> -C /tmp/rlm-extract/` — then enumerate extracted files |

If a zip/archive contains a single file, proceed with single-file RLM on the extracted file.
If it contains multiple files, proceed with multi-file directory analysis on the extraction directory.

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
| CSV/TSV | Row count | ~2000 rows (narrow) / ~500-1500 rows (wide) | `swarm:rlm-data-analyzer` |
| JSON | Top-level array elements | 200-500 elements | `swarm:rlm-json-analyzer` |
| JSONL | Line count | 500-1000 lines | `swarm:rlm-json-analyzer` |
| Log files | Line ranges + overlap | 200-5000 lines, 20-50 overlap | `swarm:rlm-chunk-analyzer` |
| Prose/docs | Section headings or line ranges | 250 lines, 25 overlap | `swarm:rlm-chunk-analyzer` |
| Config/markup/unknown | Line ranges + overlap | 200 lines, 20 overlap | `swarm:rlm-chunk-analyzer` |

**Choose chunk sizes from the targets above and let partition count scale with data size.** Fewer partitions under-utilizes parallelism and degrades analysis quality. Be aggressive with partitioning — more smaller chunks produce better findings than fewer large ones. There is no practical ceiling on partition count when using findings-in-task-descriptions mode and staged spawning.

### Source Code

- **Chunk boundary**: Function/class/module — scan for lines at indentation level 0 starting with keywords (`def `, `class `, `function `, `func `, `fn `, `pub fn `, `impl `, `module `, `export `, `const `, `type `, `interface `). Group consecutive lines between boundaries into chunks.
- **Chunk size**: 150-300 lines. If any chunk exceeds 300 lines, split at the next inner boundary. If no boundaries detected, fall back to 200-line chunks with 20-line overlap.
- **Overlap**: 0 — boundaries are semantic, no overlap needed.
- **Context injection**: Extract the file's import/require block (lines from start until first non-import line). Prepend this to every chunk file for dependency awareness.
- **Partition method**: Write chunk files (`chunk-01.py` through `chunk-N.py`), each starting with the shared import block.

### Structured Data (CSV/TSV)

- **Chunk boundary**: Row count (even splits).
- **Chunk size**: Target ~2000 rows per partition for narrow data (< 20 columns), ~500-1500 rows for wide data (20+ columns). Use ~500 for dense wide data (most columns populated); use ~1500 for sparse wide data (many empty columns, e.g., Jira exports). Partition count scales naturally with total row count — a 50K-row file produces ~25 partitions at 2000 rows each.
- **Overlap**: 0 — rows are independent.
- **Header preservation**: Every chunk file includes the original header row as line 1.
- **Partition method**: Write chunk files (`chunk-01.csv` through `chunk-N.csv`), each starting with the header.

**Mandatory partitioning procedure for every CSV/TSV file:**

```bash
# 1. Count rows (subtract 1 for header)
total_rows=$(($(wc -l < input.csv) - 1))

# 2. Determine chunk size based on column count
col_count=$(head -1 input.csv | awk -F',' '{print NF}')
if [ "$col_count" -ge 20 ]; then
  chunk_size=1500  # wide data (use ~500 for dense, ~1500 for sparse like Jira exports)
else
  chunk_size=2000  # narrow data
fi

# 3. Calculate partition count
chunk_count=$(( (total_rows + chunk_size - 1) / chunk_size ))

# 4. Extract header and write chunk files
header=$(head -1 input.csv)
mkdir -p /tmp/rlm-chunks
for i in $(seq 1 $chunk_count); do
  start=$(( (i - 1) * chunk_size + 2 ))  # +2 to skip header
  end=$(( start + chunk_size - 1 ))
  chunk_file=$(printf "/tmp/rlm-chunks/chunk-%02d.csv" $i)
  echo "$header" > "$chunk_file"
  sed -n "${start},${end}p" input.csv >> "$chunk_file"
done

# 5. Create one task per chunk file — NOT one task per source file
```

**One CSV file = many tasks.** A 10,000-row CSV produces ~7 chunks at 1500 rows/chunk or ~5 chunks at 2000 rows/chunk — never 1 task. If you are creating one task per source file, you are NOT partitioning — stop and run this procedure.

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
- **Chunk size**: 200-5000 lines (adjust to target 5-10 partitions).
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
- **1 analyst per partition, fresh context each** — every partition gets its own analyst agent with a clean context window. An analyst reads exactly one chunk, analyzes it, reports findings, and exits. No analyst processes more than one partition — fresh context prevents cross-chunk contamination
- `analyst_count = partition_count` — 60 partitions = 60 analysts
- There is no hard cap on analyst count. Haiku analysts are lightweight; scale to the data
- **Staged spawning**: Spawn analysts in batches (e.g., 15 at a time). Each batch processes its assigned partitions. When one batch completes, spawn the next. Tasks are pre-assigned (1 task per analyst), not claimed from a shared pool
- Use findings-in-task-descriptions mode (see Context Management) so analyst reports don't flood the leader's inbox

---

## Team Orchestration Lifecycle

**CRITICAL: RLM uses team orchestration, not plain background subagents.** Analysts are spawned as teammates (with `team_name` + `name`) so they communicate via inbox messages rather than dumping full results into the leader's context.

### Step 1: Create Team and Tasks

```javascript
// Create the RLM team
TeamCreate({ team_name: "rlm-analysis", description: "RLM analysis of production.log" })

// Create one task per DATA PARTITION (not per analysis concern)
// The query is the SAME for every task — only the data range differs
// Each task will be pre-assigned to exactly one analyst — no shared claiming
TaskCreate({ subject: "Analyze chunk 1 of 8", description: "File: /var/log/app/server.log\nStart line: 1\nEnd line: 5000\nQuery: What errors occurred?", activeForm: "Analyzing chunk 1..." })
TaskCreate({ subject: "Analyze chunk 2 of 8", description: "File: /var/log/app/server.log\nStart line: 4951\nEnd line: 10000\nQuery: What errors occurred?", activeForm: "Analyzing chunk 2..." })
// ... one TaskCreate per partition
```

### Step 2: Spawn Analyst Teammates

```javascript
// 1 analyst per partition, each with a fresh context
// Spawn in stages if partition count is large (e.g., batches of 15)
// NOTE: Do NOT set model parameter — agent definition defaults to Haiku, which is correct for chunk analysis
const stageSize = 15
for (let stage = 0; stage < Math.ceil(partitionCount / stageSize); stage++) {
  const start = stage * stageSize + 1
  const end = Math.min((stage + 1) * stageSize, partitionCount)

  for (let i = start; i <= end; i++) {
    Task({
      team_name: "rlm-analysis",
      name: `analyst-${i}`,
      subagent_type: "swarm:rlm-chunk-analyzer",
      prompt: `You are analyst-${i}. You have exactly one task: analyze chunk ${i} of ${partitionCount}.
Query: What errors occurred and are there any patterns?
File: /var/log/app/server.log
Read your assigned chunk using the offset/limit from your task description.
Write your JSON findings to the task description via TaskUpdate, then send a one-line summary to team-lead.`,
      run_in_background: true
    })
  }
  // Wait for this stage to complete before spawning next
  // Run /compact between stages to clear notification messages
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
| Work distribution | Fixed: 1 subagent per chunk | Pre-assigned: 1 analyst per partition, fresh context each |
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
2. **1 analyst per partition, fresh context each** — every analyst processes exactly one chunk in a clean context window. Use findings-in-task-descriptions mode and staged spawning to manage context pressure — never reduce analyst count or reuse analyst contexts across chunks
3. **Size partitions for analyst quality** — chunk size should stay within the content-type targets (see Partitioning Strategies). Let partition count scale with data size rather than forcing oversized chunks to hit a count target
4. **Analyst reports must be compact** — structured summaries, not raw data
5. **Pass by reference** — give analysts file paths and line ranges, never paste content into prompts
6. **Run /compact before synthesis** if context is getting full from collecting reports

**WARNING:** Do NOT spawn analysts as plain background subagents (`Task()` without `team_name`). Their full output will land in the leader's context, and with 8-10 analysts this will exhaust the context window and crash the session.

### Multi-File Context Strategies

When processing directories (multi-file mode), additional strategies apply:

7. **Findings-in-task-descriptions** — analysts write full JSON findings to their task description via `TaskUpdate` instead of sending them via `SendMessage`. Send only a one-line summary to team-lead. Synthesizers read findings via `TaskGet`.
8. **Run /compact between phases** — after all analysts complete and before spawning synthesizers, compact the context to clear analyst notification messages
9. **1 analyst per task, fresh context each** — every analyst processes exactly one chunk. For large workloads (50+ tasks), use staged spawning (batches of ~15 analysts) with findings-in-task-descriptions mode. Run /compact between stages.
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

### Critical: Every Large File Must Be Partitioned

In multi-file mode, the most common failure is treating each source file as a single task. **This is wrong.** Multi-file RLM means:

1. Enumerate all files in the directory
2. **Partition every file that exceeds 1500 lines/rows into chunks** using the content-type partitioning strategy
3. Create one task per chunk — not one task per file

**Sanity check:** If your total task count equals your file count, you have not partitioned. Stop. Go back to step 2 and partition each large file into chunks using the procedures in [Partitioning Strategies](#partitioning-strategies).

Example: 11 CSV files × 10,000 rows each ÷ 1500 rows per chunk = ~77 tasks total. If you have 11 tasks, you skipped partitioning.

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

1 analyst per task, fresh context each — every analyst processes exactly one chunk. Distribute proportionally across content types (at least 1 analyst per type that has tasks). For large workloads (50+ tasks), use staged spawning (batches of ~15 analysts) with findings-in-task-descriptions mode.

### Two-Phase Synthesis

Synthesis runs in two phases using task dependencies:

1. **Phase 1 (parallel)**: One synthesis task per content type. Synthesizer reads analyst findings from task descriptions via `TaskGet`, produces type-level summary.
2. **Phase 2 (sequential)**: One cross-type synthesis task, blocked until all Phase 1 tasks complete. Reads Phase 1 summaries via `TaskGet`, produces final report with Per-File Findings, Cross-File Analysis, and Recommendations.

Both phases use the existing `swarm:rlm-synthesizer` with different prompts. No new agents needed.

### Multi-File Context Management

- Analysts write findings to task descriptions via `TaskUpdate`, send only one-line summaries to team-lead
- Synthesizers read findings via `TaskGet` — raw findings never enter Team Lead's context
- Run `/compact` between analyst and synthesis phases
- 1 analyst per task, fresh context each — use staged spawning for large workloads

### Abbreviated Walkthrough

**Input:** `/project/src/` with 3 Python files (2800, 1900, 3200 lines), 2 JSON configs (250, 180 lines), 1 README (300 lines).

1. **Enumerate**: 6 files, detect types → 3 source_code, 2 json, 1 prose
2. **Budget**: Medium files partitioned by content-type chunk targets (~200-line chunks for source code) → 14+10+16 = 40 partitions (approximate — actual count depends on function/class boundary detection); small files batched → 2 batch tasks; total = 42 tasks
3. **Analyst mix**: 42 tasks = 42 analysts (1:1) → 40 code analysts, 2 JSON analysts; staged spawning in batches of 15
4. **Analysts work**: each analyst processes its pre-assigned chunk, writes findings to task descriptions
5. **Phase 1 synthesis**: "Synthesize code findings" + "Synthesize JSON findings" (parallel)
6. **Phase 2 synthesis**: Cross-type synthesis (blocked by Phase 1)
7. **Final report**: Per-file findings + cross-file analysis + recommendations

### Abbreviated Walkthrough: Large CSV Directory

**Input:** `csi/exports/` with 11 CSV files, each 10,000+ rows and 2000+ columns (wide data).

1. **Enumerate**: 11 files, all detect as `structured_data` (`.csv` extension → High confidence)
2. **Partition each file**: Wide data (2000+ columns) → ~1500 rows per chunk.
   - `file-01.csv` (12,000 rows) → 8 chunks
   - `file-02.csv` (10,500 rows) → 7 chunks
   - ... (each file produces 7-10 chunks)
   - **Total: ~88 chunk files, 88 tasks**
   - Sanity check: 88 tasks >> 11 files. Partitioning is correct.
3. **Chunk file creation**: For each source CSV, run the partitioning procedure:
   ```bash
   header=$(head -1 file-01.csv)
   mkdir -p /tmp/rlm-chunks/file-01
   # Write chunk-01.csv through chunk-08.csv, each starting with header
   ```
4. **Analyst mix**: 88 tasks = 88 data analysts (1:1). Staged spawning: 6 stages of 15 (15+15+15+15+15+13)
5. **Analysts work**: each reads its pre-assigned chunk file, analyzes all columns, writes JSON findings to task description
6. **Phase 1 synthesis**: Single "Synthesize CSV findings" task (all 88 analyst tasks are same type)
7. **Phase 2 synthesis**: Not needed — only one content type, Phase 1 produces the final report
8. **Final report**: Frequency distributions, temporal trends, missing data rates, outliers, text patterns

**Key difference from mixed-type walkthrough:** All files are the same type, so there's only one Phase 1 synthesis task and no Phase 2 cross-type synthesis needed.

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
