# RLM Pattern Examples

Practical example prompts for every RLM mode. Copy, adapt the file path, and paste into Claude Code.

> **Prerequisite:** The `swarm` plugin must be installed and agent teams enabled. See [Getting Started](getting-started.md).

---

## Quick Reference

| Mode | When to Use | What Happens |
|------|------------|--------------|
| [Basic RLM](#basic-rlm) | One large log or text file | Line-range chunks, general analysts |
| [Content-Aware: Source Code](#content-aware-source-code) | One large source file | Function-boundary chunks, code analysts |
| [Content-Aware: CSV/TSV](#content-aware-csvtsv) | One large data file | Header-preserving chunks, data analysts |
| [Content-Aware: JSON/JSONL](#content-aware-jsonjsonl) | One large JSON file | Schema-aware chunks, JSON analysts |
| [Directory Analysis](#directory-analysis) | Multiple files, same type | Per-file partitioning, single analyst type |
| [Multi-Type Directory](#multi-type-directory-analysis) | Mixed file types in a directory | Mixed analysts, two-phase synthesis |

---

## Basic RLM

Analyze a large log file or text document that exceeds context limits. The simplest RLM mode — line-range chunks with the general-purpose analyzer.

### Example: Log File Error Analysis

```
Analyze the application log at /var/log/app/production.log for error patterns
and recurring failures. Use the RLM pattern to process it in parallel.
```

### Example: Large Document Review

```
Analyze the compliance document at docs/soc2-audit-report.txt for gaps,
inconsistencies, and areas needing remediation. Use the RLM pattern.
```

**What Claude does:**
1. Detects content type (`log` or `prose`)
2. Splits into ~5-10 chunks by line ranges (with overlap for logs)
3. Spawns 3-5 `swarm:rlm-chunk-analyzer` agents (Haiku)
4. Each analyst claims chunks from the shared task list
5. Synthesizes all findings into a consolidated report

---

## Content-Aware: Source Code

Analyze a large source file with function/class boundary awareness. Chunks respect code structure — no splitting mid-function.

### Example: Security Audit

```
Perform a security audit of src/services/payment_processor.py using the
RLM pattern. Focus on injection vulnerabilities, authentication bypass,
and unsafe operations.
```

### Example: Architecture Review

```
Review the architecture of src/core/engine.ts using the RLM pattern.
Focus on coupling, SOLID principles, and dependency patterns.
```

### Example: General Code Quality

```
Analyze lib/data_pipeline.rb for code quality issues using the RLM pattern.
Look for complexity, dead code, and anti-patterns.
```

**What Claude does:**
1. Detects `source_code` from file extension
2. Scans for function/class boundaries at indentation level 0
3. Chunks at semantic boundaries (150-300 lines per chunk)
4. Prepends the file's import block to every chunk for dependency context
5. Spawns `swarm:rlm-code-analyzer` agents with the specified analysis focus
6. Findings include scope context like `function:process_payment` and severity levels

### Analysis Focus Options

You can steer the analysis by mentioning what you care about:

| Your Goal | What to Say | What Analysts Prioritize |
|-----------|------------|-------------------------|
| General review | "review for code quality" | Logic errors, complexity, patterns |
| Security audit | "audit for security" or "find vulnerabilities" | Injection, auth, secrets, unsafe ops |
| Architecture | "review the architecture" | Coupling, SOLID, dependency patterns |
| Performance | "analyze performance" | Algorithmic complexity, N+1, blocking calls |

---

## Content-Aware: CSV/TSV

Analyze a large data file with header-preserving chunks. Every chunk includes the original header row so analysts understand column semantics.

### Example: Customer Data Analysis

```
Analyze the customer export at data/customers-2025.csv using the RLM pattern.
Report distributions by region and plan type, identify outliers in MRR,
and flag data quality issues.
```

### Example: Jira Export Triage

```
Analyze the Jira export at exports/support-tickets.csv using the RLM pattern.
Identify top issue categories, recurring error patterns, and resolution
time statistics.
```

**What Claude does:**
1. Detects `structured_data` from `.csv` extension
2. Reads the header row and preserves it in every chunk
3. Splits by row count (500-5000 rows per chunk, targeting 5-10 partitions)
4. Spawns `swarm:rlm-data-analyzer` agents — column-aware, reports distributions and statistics
5. Findings are aggregatable: the synthesizer sums counts across chunks

### What Data Analysts Report

- Frequency distributions per column (e.g., status breakdown, region counts)
- Outliers and anomalies (e.g., unusually high values, rare categories)
- Missing data rates per column
- Correlations between dimensions
- Temporal patterns if date columns are present

---

## Content-Aware: JSON/JSONL

Analyze large JSON documents or JSONL streams with schema awareness. JSON arrays are split into valid sub-arrays; JSONL is split by line count.

### Example: API Event Stream

```
Analyze the event log at data/events.jsonl using the RLM pattern.
Report event type distributions, identify schema inconsistencies,
and flag any anomalous patterns.
```

### Example: Configuration Audit

```
Analyze the feature flags configuration at config/flags.json using the
RLM pattern. Check for stale flags, conflicting rules, and schema
consistency across entries.
```

**What Claude does:**
1. Detects `json` or `jsonl` from extension (or by content sniffing)
2. For JSON: splits top-level array into valid sub-arrays (200-500 elements per chunk)
3. For JSONL: splits by line count (500-1000 lines per chunk)
4. Injects a schema summary (field names + types) into each analyst's prompt
5. Spawns `swarm:rlm-json-analyzer` agents — schema-aware, reports field distributions and type consistency
6. Detects schema drift (objects with different shapes within the same dataset)

---

## Directory Analysis

Analyze a directory where all files are the same type. Simpler than multi-type — uses one analyst type with per-file partitioning.

### Example: Review a Python Package

```
Analyze all Python files in src/mypackage/ using the RLM pattern.
Review for code quality and security issues.
```

### Example: Audit CSV Data Exports

```
Analyze all CSV files in data/exports/ using the RLM pattern.
Report data quality issues, distributions, and cross-file inconsistencies.
```

**What Claude does:**
1. Enumerates files using Glob (respects default exclusions like `node_modules/`, `.git/`)
2. Detects the same content type across all files
3. Applies the tiered partition budget:
   - Small files (<=1500 lines): batched together, no splitting
   - Medium files (1501-5000 lines): 3-5 partitions each
   - Large files (>5000 lines): 5-10 partitions each
4. Spawns one analyst type, up to 6 analysts total
5. Synthesizes findings across all files

---

## Multi-Type Directory Analysis

The most powerful mode. Analyze a directory containing mixed file types — source code, data files, JSON configs, documentation — in a single session with type-specific analysts and two-phase synthesis.

### Example: Full Project Review

```
Analyze the project directory at ./src/ using the RLM pattern.
The directory contains Python source, JSON configs, and CSV test fixtures.
Review for code quality, configuration issues, and data integrity.
Correlate findings across file types.
```

### Example: Microservice Audit

```
Use the RLM pattern to analyze the microservice at services/user-service/.
It contains Java source files, application.yml configs, and SQL migration files.
Review for security vulnerabilities, configuration drift, and architectural concerns.
```

### Example: Data Pipeline Review

```
Analyze the data pipeline directory at etl/ using the RLM pattern.
It contains Python ETL scripts, CSV source data, JSONL event streams,
and shell scripts. Focus on data quality issues, transformation correctness,
and error handling.
```

**What Claude does:**
1. Enumerates and classifies every file by content type (extension + content sniffing)
2. Groups files by type and applies per-type partitioning strategies
3. Allocates a partition budget (30-partition global cap) with tiered sizing
4. Batches small same-type files together to reduce task count
5. Spawns mixed analyst types simultaneously (up to 4 different types, 6 analysts total):
   - `swarm:rlm-code-analyzer` for source files
   - `swarm:rlm-data-analyzer` for CSV/TSV files
   - `swarm:rlm-json-analyzer` for JSON/JSONL files
   - `swarm:rlm-chunk-analyzer` for logs, docs, configs
6. Analysts write findings to task descriptions (not messages) to protect team lead context
7. **Phase 1 synthesis**: per-type summaries in parallel (e.g., "all Python findings", "all CSV findings")
8. **Phase 2 synthesis**: cross-type final report correlating findings across file types
9. Final report includes: Per-File Findings, Cross-File Analysis, and Recommendations

### What Cross-File Analysis Catches

Multi-type analysis detects things single-file analysis cannot:

- Config values referenced in code that don't match
- Data schemas in JSON that diverge from CSV column structures
- Hardcoded values in code that should come from config
- Test fixtures that don't match production data patterns
- Naming inconsistencies across file types

---

## Tips for Better Results

### Be Specific About Your Goal

The more specific your analysis request, the more targeted the findings:

| Vague | Specific |
|-------|----------|
| "Analyze this file" | "Find security vulnerabilities in authentication flows" |
| "Review this directory" | "Check for N+1 queries, missing error handling, and SQL injection" |
| "Look at the data" | "Report customer churn patterns by region and identify MRR anomalies" |

### File Size Guidelines

| File Size | Recommendation |
|-----------|---------------|
| < 1500 lines | No RLM needed — Claude handles it directly |
| 1500-5000 lines | RLM useful — 3-5 partitions |
| 5000-50000 lines | RLM recommended — 5-10 partitions |
| 50000+ lines | RLM essential — adjust chunk sizes for ~10 partitions |

### Directory Size Guidelines

| Directory Profile | Recommendation |
|-------------------|---------------|
| 1-3 small files | No RLM needed |
| 3-10 mixed files | Multi-file RLM useful |
| 10-20 files with large ones | Multi-file RLM recommended (cap applies) |
| 20+ files | Filter with include/exclude globs to focus on key files |

### Mentioning Content Type Isn't Required

RLM auto-detects content types. You don't need to tell Claude what kind of file it is — but you can if auto-detection might be ambiguous (e.g., a `.txt` file that's actually CSV data):

```
Analyze data/export.txt using the RLM pattern. Note: this file contains
CSV data with a header row despite the .txt extension.
```

### Excluding Files in Directory Analysis

Use natural language to filter what gets analyzed:

```
Analyze src/ using the RLM pattern, but skip test files and migrations.
Focus on the core business logic.
```

---

## Feature Comparison

| Feature | Basic RLM | Content-Aware | Directory | Multi-Type |
|---------|-----------|--------------|-----------|------------|
| Content-type detection | No | Yes | Yes | Yes |
| Semantic chunking | No (line ranges) | Yes (type-specific) | Yes | Yes |
| Header preservation (CSV) | No | Yes | Yes | Yes |
| Import injection (code) | No | Yes | Yes | Yes |
| Schema awareness (JSON) | No | Yes | Yes | Yes |
| Multiple analyst types | No | No | No | Yes |
| Small file batching | No | No | Yes | Yes |
| Two-phase synthesis | No | No | No | Yes |
| Cross-file correlation | No | No | Limited | Yes |
| Partition budget | Manual | Auto (per type) | Auto (tiered) | Auto (tiered + global cap) |

---

## Further Reading

- [RLM Pattern Skill](../skills/rlm-pattern/SKILL.md) — Full technical reference
- [Content-Aware RLM Design](design/content-aware-rlm.md) — Design decisions for type detection and routing
- [Multi-File RLM Design](design/multi-file-rlm.md) — Design decisions for directory analysis
- [Agent Types](agent-types.md) — All available analyst agents
- [Orchestration Patterns](patterns.md) — When to use RLM vs other patterns
