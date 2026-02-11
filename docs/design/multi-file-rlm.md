# Multi-File Directory RLM Pattern — Design Document

**Status:** Proposal
**Date:** 2026-02-11
**Scope:** Extension of the single-file RLM pattern (`skills/rlm-pattern/SKILL.md` and `agents/rlm-*`) to accept directories, with per-file content-type detection and mixed-type analyst routing in a single team session.
**Depends on:** [Content-Aware RLM Design](content-aware-rlm.md)

---

## 1. Problem Statement

The content-aware RLM pattern operates on a single file per session. Its content-type detection, type-specific chunking, and specialist analyst routing all assume one file in, one content type out.

Users needing directory-level analysis — "review this project directory", "analyze all CSV exports", "audit this mixed codebase" — must fall back to the generic swarm pattern (`orchestration-patterns/SKILL.md` Pattern 3). This loses all content-aware benefits:

- **No semantic chunking** — files get split by line ranges regardless of content structure
- **No type-specific analysts** — all files get the same generic analyzer
- **No cross-file synthesis** — findings from Python, JSON config, and CSV data get no type-aware aggregation
- **No header preservation** — CSV files in a directory lose headers when chunked
- **No import injection** — code files lose dependency context

This design extends the RLM pattern to accept a directory path, enumerate and classify files by content type, partition each file using the appropriate strategy, route chunks to mixed analyst types, and synthesize findings in two phases — first per content type, then across types.

---

## 2. Design Overview

### Extended Pipeline

```
┌───────────────┐    ┌───────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   Directory   │───▶│   Enumerate   │───▶│  Detect Type    │───▶│  Group by Type   │
│   Input       │    │   & Filter    │    │  Per File       │    │                  │
└───────────────┘    └───────────────┘    └─────────────────┘    └──────────────────┘
                                                                         │
                                                                         ▼
┌───────────────┐    ┌───────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  Cross-Type   │◀───│  Per-Type     │◀───│  Mixed Analyst  │◀───│  Partition       │
│  Synthesis    │    │  Synthesis    │    │  Routing        │    │  Per Group       │
│  (Phase 2)    │    │  (Phase 1)    │    │                 │    │                  │
└───────────────┘    └───────────────┘    └─────────────────┘    └──────────────────┘
```

### Key Extension Points from Single-File RLM

| Aspect | Single-File RLM | Multi-File RLM |
|--------|----------------|----------------|
| Input | One file path | Directory path + glob filters |
| Content detection | One type per session | Per-file detection, multiple types |
| Analyst types | One type per session | Mixed types (up to 4 different) |
| Partitioning | One strategy | Per-type strategy for each file |
| Synthesis | Single phase (merge all) | Two phases: per-type then cross-type |
| Context management | Findings via SendMessage | Findings in task descriptions via TaskUpdate |
| Analyst cap | No explicit cap | Max 6 analysts total |

---

## 3. File Enumeration & Filtering

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `directory` | (required) | Absolute path to the target directory |
| `include` | `*` | Glob patterns for files to include (e.g., `*.py`, `*.csv`) |
| `exclude` | See default exclusions | Glob patterns for files to exclude |
| `recursive` | `true` | Whether to descend into subdirectories |
| `max_files` | `20` | Maximum number of files to process (safety cap) |

### Default Exclusions

Always excluded unless explicitly included:

```
# Version control
.git/

# Dependencies
node_modules/
vendor/
.venv/
__pycache__/
.tox/
.eggs/

# Build artifacts
dist/
build/
target/
out/
.next/

# IDE/editor
.idea/
.vscode/
*.swp
*.swo
*~

# Binary and media
*.png, *.jpg, *.jpeg, *.gif, *.ico, *.svg (binary)
*.pdf, *.doc, *.docx
*.zip, *.tar, *.gz, *.bz2
*.exe, *.dll, *.so, *.dylib
*.wasm, *.pyc, *.class

# Lock files
package-lock.json
yarn.lock
Gemfile.lock
poetry.lock
Cargo.lock
pnpm-lock.yaml
composer.lock

# Generated
*.min.js
*.min.css
*.map
*.d.ts (unless explicitly included)
```

### Enumeration Algorithm

```
1. List files in directory (recursive if enabled)
2. Apply include globs (whitelist)
3. Apply exclude globs (blacklist — defaults + user overrides)
4. Filter out binary files (check first 512 bytes for null bytes)
5. Sort by file size descending (largest first — they drive partition budget)
6. If count > max_files:
   a. Log warning: "Found {count} files, processing first {max_files}"
   b. Truncate to max_files
7. Return file manifest: [{path, size_bytes, line_count}]
```

The Team Lead executes enumeration inline using Glob, Read, and Bash tools. No separate agent needed — this is O(N) where N ≤ 20.

---

## 4. Partition Budget Allocation

### Tiered Algorithm

Files are classified into size tiers, and each tier gets a different partition count:

| Tier | Line Count | Partitions | Rationale |
|------|-----------|------------|-----------|
| Small | ≤ 1500 lines | 0 (batched — see Section 5) | Fits in analyst context whole |
| Medium | 1501–5000 lines | 3–5 | Needs splitting but not many chunks |
| Large | > 5000 lines | 5–10 | Needs aggressive splitting |

### Global Cap

**Total partitions across all files: 30 maximum.**

If the sum of per-file partitions exceeds 30, scale down proportionally:

```
1. For each file, compute raw_partitions using tier rules
2. Sum all raw_partitions → total_raw
3. If total_raw ≤ 30: use raw_partitions as-is
4. If total_raw > 30:
   a. scale_factor = 30 / total_raw
   b. For each file: scaled = max(2, floor(raw_partitions * scale_factor))
   c. If sum(scaled) > 30: trim the smallest files first (reduce to minimum 2)
5. Every file with partitions > 0 gets at least 2 partitions (minimum for meaningful splitting)
```

### Sizing Guidance

| Directory Profile | Example | Expected Partitions |
|-------------------|---------|-------------------|
| Small (3-5 files, all small) | Config directory | 3-5 tasks (one per file, no splitting) |
| Medium (5-10 files, mixed sizes) | Feature module | 10-20 tasks |
| Large (10-20 files, several large) | Full service | 25-30 tasks (cap applies) |

### Pseudocode

```python
def allocate_budget(files):
    manifest = []
    for f in files:
        lines = count_lines(f)
        content_type = detect_type(f)
        if lines <= 1500:
            manifest.append({"file": f, "lines": lines, "type": content_type, "partitions": 0, "tier": "small"})
        elif lines <= 5000:
            # Scale within 3-5 range based on line count
            partitions = 3 + round((lines - 1501) / (5000 - 1501) * 2)
            manifest.append({"file": f, "lines": lines, "type": content_type, "partitions": partitions, "tier": "medium"})
        else:
            # Scale within 5-10 range based on line count
            partitions = min(10, 5 + round((lines - 5001) / 10000 * 5))
            manifest.append({"file": f, "lines": lines, "type": content_type, "partitions": partitions, "tier": "large"})

    # Apply global cap
    total = sum(f["partitions"] for f in manifest)
    if total > 30:
        scale = 30 / total
        for f in manifest:
            if f["partitions"] > 0:
                f["partitions"] = max(2, floor(f["partitions"] * scale))

    return manifest
```

---

## 5. Small File Optimization

### The Problem

A directory of 15 files where 10 are small (< 1500 lines) would spawn 10 individual analyst tasks if each got its own task. This wastes agent turns on trivial files.

### Solution: Batch Same-Type Small Files

Group small files of the same content type into batches of ≤ 1500 combined lines. Each batch becomes one analyst task.

### Batching Algorithm

```
1. Collect all small files (≤ 1500 lines) from the manifest
2. Group by content_type
3. For each content_type group:
   a. Sort files by line count (smallest first)
   b. Create batches:
      - Start a new batch (running_total = 0)
      - Add files to batch until running_total would exceed 1500
      - When batch is full, start a new one
   c. Each batch → one analyst task
4. A lone small file (only one of its type) → one analyst task (whole-file, no chunking)
```

### Batch Task Format

The task description lists all files in the batch with clear boundary markers:

```
Mode: multi-file
Query: Review for code quality and security issues
Batch: 3 Python files (combined: 1,230 lines)

--- FILE 1: /project/src/utils.py (280 lines) ---
Read with: Read({ file_path: "/project/src/utils.py" })

--- FILE 2: /project/src/config.py (450 lines) ---
Read with: Read({ file_path: "/project/src/config.py" })

--- FILE 3: /project/src/helpers.py (500 lines) ---
Read with: Read({ file_path: "/project/src/helpers.py" })

Analyze each file separately. Report findings with the file path for each finding.
```

### Key Principle

**Analysts read each file via the Read tool (pass-by-reference).** The task description lists file paths — it never inlines file content. The Team Lead never analyzes files inline either — all analysis goes through analyst agents.

---

## 6. Mixed Analyst Routing

### How It Works

After enumeration and type detection, the Team Lead has a manifest of files grouped by content type. Unlike single-file RLM (which uses one analyst type per session), multi-file RLM spawns different analyst types simultaneously.

### Determining the Analyst Mix

```
1. From the manifest, count tasks per content type:
   - source_code tasks: partitions from code files + batches of small code files
   - structured_data tasks: partitions from CSV files + batches of small CSV files
   - json/jsonl tasks: partitions from JSON files + batches of small JSON files
   - general tasks: partitions from log/prose/config files + batches
2. Only spawn analyst types that have tasks
3. Distribute the 6-analyst cap proportional to task counts
```

### Spawning Strategy

**Cap: 6 analysts total** (across all types). Distribute proportionally:

```python
def plan_analysts(tasks_by_type, cap=6):
    total_tasks = sum(tasks_by_type.values())
    analysts = {}
    for content_type, task_count in tasks_by_type.items():
        if task_count == 0:
            continue
        # At least 1 analyst per type, proportional to task share
        raw = max(1, round(task_count / total_tasks * cap))
        analysts[content_type] = raw

    # Trim to cap
    while sum(analysts.values()) > cap:
        # Reduce the type with the most analysts
        max_type = max(analysts, key=analysts.get)
        analysts[max_type] -= 1

    return analysts
```

### Example

A directory with 5 Python files (12 tasks), 3 CSV files (6 tasks), 1 JSON config (1 task):
- Total: 19 tasks
- Code analysts: `max(1, round(12/19 * 6))` = 4
- Data analysts: `max(1, round(6/19 * 6))` = 2
- JSON analysts: `max(1, round(1/19 * 6))` = 1
- Total: 7 → trim code to 3 → total: 6

### Analyst Naming

Each analyst gets a descriptive name incorporating its type:

```
code-analyst-1, code-analyst-2, code-analyst-3
data-analyst-1, data-analyst-2
json-analyst-1
```

---

## 7. Two-Phase Synthesis

### Why Two Phases?

With 25+ analyst reports spanning multiple content types, the synthesizer faces two challenges:
1. **Volume** — too many reports for a single synthesis pass
2. **Heterogeneity** — code findings (severity-based), data findings (distribution-based), and JSON findings (schema-based) use different vocabularies and need different aggregation logic

Two-phase synthesis addresses both.

### Phase 1: Per-Type Synthesis (Parallel)

One synthesis task per content type, running in parallel. Each reads analyst findings from completed tasks via `TaskGet` and produces a type-level summary.

```
Task IDs for per-type synthesis:
  - "synth-code": reads all code analyst task findings → Python summary
  - "synth-data": reads all data analyst task findings → CSV summary
  - "synth-json": reads all JSON analyst task findings → JSON summary
```

**Synthesizer prompt (per-type):**
```
Mode: per-type synthesis
Content type: source_code
Analyst task IDs: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

Read findings from each analyst task using TaskGet (findings are in the task description).
Aggregate all source_code findings into a type-level summary:
- Merge duplicate findings across files
- Rank by severity
- Note which files each finding appears in
- Produce a structured summary

Write your synthesis to this task's description via TaskUpdate.
Send a one-line completion notice to team-lead via SendMessage.
```

### Phase 2: Cross-Type Synthesis (Sequential)

One synthesis task that reads all Phase 1 summaries and produces the final report. Blocked until all Phase 1 tasks complete.

**Synthesizer prompt (cross-type):**
```
Mode: cross-type synthesis
Per-type synthesis task IDs: [synth-code-id, synth-data-id, synth-json-id]
Original query: <user's query>

Read per-type summaries from each synthesis task using TaskGet.
Produce the final report with these sections:

## Per-File Findings
Brief findings organized by file, noting content type.

## Cross-File Analysis
Patterns that span multiple files or content types:
- Config values referenced in code
- Data schemas matching JSON structures
- Shared naming conventions or inconsistencies
- Dependencies between files

## Recommendations
Actionable items informed by cross-file context.

Write your final report to this task's description via TaskUpdate.
Send the final report to team-lead via SendMessage.
```

### Task Dependency Wiring

```javascript
// Phase 1 tasks (parallel, no dependencies between them)
TaskCreate({ subject: "Synthesize Python findings", description: "Mode: per-type synthesis\n..." })  // → task 31
TaskCreate({ subject: "Synthesize CSV findings", description: "Mode: per-type synthesis\n..." })     // → task 32
TaskCreate({ subject: "Synthesize JSON findings", description: "Mode: per-type synthesis\n..." })    // → task 33

// Phase 2 task (blocked by all Phase 1)
TaskCreate({ subject: "Cross-type synthesis", description: "Mode: cross-type synthesis\n..." })      // → task 34
TaskUpdate({ taskId: "34", addBlockedBy: ["31", "32", "33"] })
```

The dependency graph is acyclic: analyst tasks → Phase 1 synthesis tasks → Phase 2 cross-type task.

### No New Agent Needed

Both phases use the existing `swarm:rlm-synthesizer` agent. The only difference is the prompt:
- Per-type prompt: reads analyst findings, produces type-level summary
- Cross-type prompt: reads per-type summaries, produces final report

The synthesizer reads findings via `TaskGet` in both cases.

---

## 8. Context Management Strategy

### The Core Problem

In single-file RLM, analysts send full JSON findings to the Team Lead via `SendMessage`. With 25+ analysts in multi-file mode, this would flood the Team Lead's inbox with 25+ messages of 2-4K characters each — 50-100K characters of raw findings in context.

### Solution: Findings-in-Task-Descriptions Pattern

**Critical architectural change from single-file RLM:**

| Aspect | Single-File RLM | Multi-File RLM |
|--------|----------------|----------------|
| Analyst findings delivery | Full JSON via SendMessage to team-lead | JSON written to task description via TaskUpdate |
| Team Lead inbox | Receives all findings | Receives only one-line summaries |
| Synthesizer reads findings | From team-lead's forwarded message | From TaskGet on analyst task IDs |
| Team Lead context pressure | Moderate (5-10 messages) | Low (only summaries + orchestration) |

### How It Works

1. **Analyst completes analysis** → writes full JSON findings to its own task description:
   ```javascript
   TaskUpdate({
     taskId: "7",
     status: "completed",
     description: "...original description...\n\n--- FINDINGS ---\n{\"findings\": [...], \"metadata\": {...}}"
   })
   ```

2. **Analyst notifies team-lead** with a one-line summary only:
   ```javascript
   SendMessage({
     type: "message",
     recipient: "team-lead",
     content: "Chunk 3/10 complete: 4 findings (2 high, 1 medium, 1 low)",
     summary: "Chunk 3/10 — 4 findings"
   })
   ```

3. **Synthesizer reads findings** from task records, not from inbox:
   ```javascript
   // Synthesizer reads each analyst task's description
   TaskGet({ taskId: "7" })  // → contains full findings JSON
   ```

### Additional Context Strategies

1. **`/compact` between phases**: Run `/compact` after all analysts complete and before spawning synthesizers. This clears analyst notification messages from context.

2. **Max 6 analysts**: Hard cap prevents spawning too many teammates. With 30 tasks and 6 analysts, each analyst processes ~5 tasks.

3. **Descriptive task IDs in synthesis prompts**: The synthesizer prompt lists exactly which task IDs to read, rather than asking it to "find all completed tasks."

4. **Message flow comparison:**

   ```
   Single-File RLM (10 chunks):
   ┌──────────┐    SendMessage (full findings)      ┌───────────┐
   │ Analyst  │ ──────────────────────────────────▶ │ Team Lead │
   │ (×10)    │    ~3K chars each = ~30K total      │           │
   └──────────┘                                     └───────────┘

   Multi-File RLM (30 chunks):
   ┌──────────┐    TaskUpdate (findings to task)    ┌───────────┐
   │ Analyst  │ ──────────────────────────────────▶ │ Task List │
   │ (×6)     │                                     │           │
   │          │    SendMessage (one-line summary)   ┌───────────┐
   │          │ ──────────────────────────────────▶ │ Team Lead │
   │          │    ~50 chars each = ~1.5K total     │           │
   └──────────┘                                     └───────────┘
                                                         │
   ┌──────────────┐    TaskGet (reads findings)    ┌─────┘
   │ Synthesizer  │ ◀─────────────────────────────
   │ (Phase 1+2)  │
   └──────────────┘
   ```

---

## 9. Changes to Existing Agents

### Analyst Agents (all 4)

Add a **multi-file mode flag** to the Team Workflow section. When a task description contains `Mode: multi-file`, the analyst changes its reporting behavior:

**Standard mode (single-file):**
- Write findings to `SendMessage` → team-lead
- Full JSON findings in message content

**Multi-file mode:**
- Write findings to task description via `TaskUpdate`
- Send only a one-line summary to team-lead via `SendMessage`
- Same analysis workflow otherwise (TaskList → claim → read → analyze → report → repeat)

This is a prompt-level change — no new tools, no new output schema, no behavioral change to the analysis itself.

### Synthesizer Agent

Add support for **TaskGet-based retrieval**. The synthesizer already receives findings via its prompt in single-file mode. In multi-file mode, findings are stored in task descriptions:

**Single-file mode (existing):**
- Prompt contains all findings inline
- Synthesizer processes them directly

**Multi-file mode (new):**
- Prompt contains task IDs to read
- Synthesizer calls `TaskGet` for each ID to retrieve findings
- Two prompt variants: per-type synthesis and cross-type synthesis

The synthesizer needs `TaskGet` in its tools list (currently has only `Read` and `SendMessage`). Add `TaskGet` and `TaskUpdate` to its tool list.

---

## 10. End-to-End Examples

### Example A: Mixed Project Directory

**Input:** `/project/src/` — 9 files, mixed types:

| File | Lines | Content Type | Tier |
|------|-------|-------------|------|
| `data_pipeline.py` | 2800 | source_code | Medium |
| `api_server.py` | 1900 | source_code | Medium |
| `models.py` | 3200 | source_code | Medium |
| `utils.py` | 400 | source_code | Small |
| `config.json` | 250 | json | Small |
| `schema.json` | 180 | json | Small |
| `README.md` | 300 | prose | Small |
| `requirements.txt` | 50 | config | Small |
| `Makefile` | 120 | config | Small |

**Query:** "Review this project for code quality, security issues, and architectural concerns."

**Step 1 — Enumerate & Detect:**
Team Lead uses Glob to list files, applies default exclusions, detects content types via extension mapping.

**Step 2 — Partition Budget:**

| File | Tier | Raw Partitions |
|------|------|---------------|
| `data_pipeline.py` | Medium | 4 |
| `api_server.py` | Medium | 3 |
| `models.py` | Medium | 4 |
| `utils.py` | Small | 0 (batched) |
| `config.json` | Small | 0 (batched) |
| `schema.json` | Small | 0 (batched) |
| `README.md` | Small | 0 (batched) |
| `requirements.txt` | Small | 0 (batched) |
| `Makefile` | Small | 0 (batched) |
| **Total partitioned** | | **11** |

**Step 3 — Small File Batching:**

| Batch | Content Type | Files | Combined Lines |
|-------|-------------|-------|---------------|
| Batch A | source_code | `utils.py` | 400 (lone file) |
| Batch B | json | `config.json`, `schema.json` | 430 |
| Batch C | config | `requirements.txt`, `Makefile` | 170 |
| Batch D | prose | `README.md` | 300 (lone file) |

**Total analyst tasks: 11 (partitioned) + 4 (batched) = 15**

However — with `README.md` (prose) and `requirements.txt`/`Makefile` (config) being trivial, the Team Lead can exclude them or batch them together as general-type. Adjusted: **13 analyst tasks**.

**Step 4 — Analyst Mix:**

| Content Type | Tasks | Analysts |
|-------------|-------|----------|
| source_code | 12 | 4 |
| json | 1 | 1 |
| general | 0 | 0 |
| **Total** | **13** | **5** |

**Step 5 — Synthesis:**

| Phase | Task | Reads From | Produces |
|-------|------|-----------|----------|
| Phase 1 | Synthesize code findings | 12 code analyst tasks | Code summary |
| Phase 1 | Synthesize JSON findings | 1 JSON analyst task | JSON summary |
| Phase 2 | Cross-type synthesis | 2 Phase 1 summaries | Final report |

**Total tasks: 13 analyst + 2 Phase 1 synthesis + 1 Phase 2 synthesis = 16**
**Total agents: 5 analysts + 1 synthesizer (reused across phases) = 6**

---

### Example B: Data Pipeline Directory

**Input:** `/data/pipeline/` — 8 files, data-heavy:

| File | Lines | Content Type | Tier |
|------|-------|-------------|------|
| `customers.csv` | 45000 | structured_data | Large |
| `transactions.csv` | 82000 | structured_data | Large |
| `events.jsonl` | 25000 | jsonl | Large |
| `etl_transform.py` | 4200 | source_code | Medium |
| `etl_load.sh` | 800 | source_code | Small |
| `pipeline_config.json` | 350 | json | Small |
| `etl.log` | 15000 | log | Large |
| `README.md` | 200 | prose | Small |

**Query:** "Analyze data quality, identify transformation issues, and check for pipeline errors."

**Step 1 — Partition Budget:**

| File | Tier | Raw Partitions |
|------|------|---------------|
| `transactions.csv` | Large | 10 |
| `customers.csv` | Large | 8 |
| `events.jsonl` | Large | 6 |
| `etl.log` | Large | 5 |
| `etl_transform.py` | Medium | 4 |
| `etl_load.sh` | Small | 0 (batched) |
| `pipeline_config.json` | Small | 0 (batched) |
| `README.md` | Small | 0 (batched) |
| **Total raw** | | **33** |

**Global cap applied** (33 > 30): scale factor = 30/33 = 0.91

| File | Scaled Partitions |
|------|------------------|
| `transactions.csv` | 9 |
| `customers.csv` | 7 |
| `events.jsonl` | 5 |
| `etl.log` | 4 |
| `etl_transform.py` | 4 |
| **Total scaled** | **29** |

**Step 2 — Small File Batching:**

| Batch | Content Type | Files | Combined Lines |
|-------|-------------|-------|---------------|
| Batch A | source_code | `etl_load.sh` | 800 |
| Batch B | json | `pipeline_config.json` | 350 |
| Batch C | prose | `README.md` | 200 |

Total analyst tasks: 29 (partitioned) + 3 (batched) = **32** (slight overshoot; Team Lead can drop the README batch or merge Batch B and C into a general batch → **30 analyst tasks**).

**Step 3 — Analyst Mix:**

| Content Type | Tasks | Analysts |
|-------------|-------|----------|
| structured_data | 16 | 3 |
| jsonl | 5 | 1 |
| source_code | 5 | 1 |
| general (log) | 4 | 1 |
| **Total** | **30** | **6** |

**Step 4 — Synthesis:**

| Phase | Task | Reads From |
|-------|------|-----------|
| Phase 1 | Synthesize CSV findings | 16 data analyst tasks |
| Phase 1 | Synthesize JSONL findings | 5 JSON analyst tasks |
| Phase 1 | Synthesize code findings | 5 code analyst tasks |
| Phase 1 | Synthesize log findings | 4 general analyst tasks |
| Phase 2 | Cross-type synthesis | 4 Phase 1 summaries |

**Total tasks: 30 analyst + 4 Phase 1 synthesis + 1 Phase 2 synthesis = 35**
**Total agents: 6 analysts + 1 synthesizer (reused) = 7**

The synthesizer is spawned once for Phase 1 (claiming Phase 1 tasks from TaskList) and once for Phase 2 (after Phase 1 completes). Alternatively, one synthesizer handles all phases sequentially.

---

## 11. Design Decisions & Tradeoffs

### D1: Hybrid Orchestration (Flat + Two-Phase Synthesis)

**Chosen over:** Hierarchical model (Type Coordinators per content type) and pure-flat model (all findings to Team Lead).

**Why hierarchical was eliminated:**
- Platform constraint: "No nested teams: Teammates cannot spawn their own teams or teammates" (`skills/error-handling/SKILL.md:112`)
- Platform constraint: "One team per session" (`skills/error-handling/SKILL.md:110`)
- Type Coordinators would need to be mid-level orchestrators with their own sub-teams — not possible

**Why pure-flat was rejected:**
- Team Lead receiving 25+ raw analyst reports causes severe context pressure
- Shallow synthesis when merging heterogeneous finding types in one pass
- No opportunity for type-specific aggregation (summing CSV distributions, merging code scopes)

**Hybrid approach:** Team Lead handles all orchestration (flat). Synthesis uses task dependencies for two phases (per-type then cross-type), giving depth without hierarchy.

### D2: Tiered Partition Budget with Global Cap

**Chosen over:** Uniform partition count per file and unlimited partitions.

**Why uniform was rejected:**
- A 50-line config file doesn't need 5 partitions
- A 80,000-line CSV needs more than 5 partitions
- Tier-based allocation matches resource to need

**Why unlimited was rejected:**
- 20 files × 10 partitions = 200 tasks → overwhelms task system and synthesis
- Global cap of 30 keeps the session manageable
- Proportional scaling preserves relative allocation when cap is hit

### D3: Batch Small Files Instead of Inline Analysis

**Chosen over:** Team Lead analyzing small files inline and skipping small files.

**Why inline analysis rejected:**
- Violates the principle that the Team Lead orchestrates but never analyzes
- Puts file content in the Team Lead's context, adding pressure
- Inconsistent protocol (some findings from analysts, some from Team Lead)

**Why skipping rejected:**
- Small files often contain critical information (config, utilities, schemas)
- Users expect directory analysis to cover all files

**Batching** keeps analysis in analyst agents while avoiding one-task-per-tiny-file overhead.

### D4: Findings-in-Task-Descriptions Over SendMessage

**Chosen over:** Standard SendMessage delivery (as used in single-file RLM).

**Rationale:** With 30 tasks, even compact 2K-character findings would put 60K characters in the Team Lead's inbox. Writing findings to task descriptions and having synthesizers read via TaskGet completely bypasses the Team Lead's context for raw findings data.

**Tradeoff:** Synthesizers must make multiple TaskGet calls (one per analyst task). This is slower than reading from a pre-collected prompt but keeps the Team Lead lean.

### D5: No New Agents Needed

All multi-file capability is achieved through:
- **Prompt variation** — analysts detect `Mode: multi-file` and switch reporting behavior
- **Task orchestration** — two-phase synthesis via task dependencies
- **Existing agents** — the same 4 analyst types and 1 synthesizer handle both modes

No new agent definitions, no new tools, no new plugin configuration.

---

## 12. Future Considerations (Out of Scope)

- **Incremental directory re-analysis** — Only re-analyze files that changed since the last run. Track file hashes in a manifest and skip unchanged files. Useful for CI/CD integration where the same directory is analyzed on every commit.

- **Cross-directory analysis** — Analyzing multiple directories in one session (e.g., comparing `src/` and `test/` for coverage gaps). Would require a third synthesis phase or a pre-synthesis grouping step.

- **Custom type registrations** — Letting users define their own content types (e.g., `.proto` → protobuf, `.tf` → terraform) with custom chunking rules and analyst prompts. Wait for user demand before adding configuration surface.

- **Streaming enumeration** — For very large directories (1000+ files), enumerate and start processing in parallel rather than waiting for full enumeration. Current max_files=20 cap makes this unnecessary.

- **Analyst result caching** — Cache analyst findings for files that haven't changed, enabling fast re-runs. Requires content hashing and a storage layer beyond the current task system.

- **Priority-based partition ordering** — Analyze high-priority files first (e.g., files with known issues, recently modified files). Currently all partitions are unordered and analysts claim by availability.
