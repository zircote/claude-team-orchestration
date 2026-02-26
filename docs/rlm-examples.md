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
| [JSONL Log Analysis](#jsonl-log-analysis) | JSONL log files | Schema discovery, tailored jq recipes, JSON analysts |
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

> See [How RLM processes logs and prose](concepts.md#basic-logs-and-prose) for what happens internally.

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

> See [How RLM processes source code](concepts.md#source-code) for what happens internally. See [Analysis Focus Options](reference.md#rlm-analysis-focus-options) for steering analyst priorities.

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

> See [How RLM processes CSV/TSV](concepts.md#csvtsv) for what happens internally. See [What Data Analysts Report](reference.md#rlm-data-analyst-output) for the standard output format.

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

> See [How RLM processes JSON/JSONL](concepts.md#jsonjsonl) for what happens internally.

---

## JSONL Log Analysis

Analyze large JSONL log files with automated schema discovery and tailored jq recipes. This is a specialization of JSON/JSONL RLM — it auto-discovers the log schema, classifies fields (timestamp, level, error, etc.), and generates extraction recipes before spawning analysts.

> **Skill reference:** See [`skills/jsonl-log-analyzer/SKILL.md`](../skills/jsonl-log-analyzer/SKILL.md) for the full procedure.

### Example: Error Investigation

```
Analyze the application logs at /var/log/app/events.jsonl for error patterns.
Use the JSONL log analyzer skill. I need to understand:
- What types of errors are most frequent?
- Are there temporal spikes?
- Which services are generating the most errors?
```

### Example: Traffic Analysis

```
Use the JSONL log analyzer to analyze the API gateway log at
data/gateway-access.jsonl. Report on:
- Request volume by endpoint and status code
- P50/P95 latency patterns over time
- Any anomalous traffic patterns or suspicious request bursts
```

### Example: Incident Timeline

```
Investigate the production incident using logs at /tmp/incident-2026-02-25.jsonl.
Use the JSONL log analyzer skill to:
- Build a timeline of events leading to the outage
- Trace affected request IDs across services
- Identify the root cause service and error type
```

> See [How JSONL Log Analysis works](concepts.md#jsonl-log-analysis) for what happens internally. See [Standard vs JSONL Log Analyzer](reference.md#standard-vs-jsonl-log-analyzer) for when to use each mode.

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

> See [How RLM processes directories](concepts.md#directory-and-multi-type-analysis) for what happens internally.

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

> See [How RLM processes directories](concepts.md#directory-and-multi-type-analysis) for what happens internally. See [Cross-File Analysis](concepts.md#cross-file-analysis) for what multi-type analysis catches that single-file cannot.

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
| 1500-5000 lines | RLM useful — partitions based on content-type chunk targets |
| 5000-50000 lines | RLM recommended — partitions scale with file size |
| 50000+ lines | RLM essential — partitions scale with file size |

### Directory Size Guidelines

| Directory Profile | Recommendation |
|-------------------|---------------|
| 1-3 small files | No RLM needed |
| 3-10 mixed files | Multi-file RLM useful |
| 10-20 files with large ones | Multi-file RLM recommended |
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

## Further Reading

- [RLM Pattern Skill](../skills/rlm-pattern/SKILL.md) — Full technical reference
- [RLM Concepts](concepts.md#rlm-content-processing) — How content processing works internally
- [RLM Reference Tables](reference.md#rlm-analysis-focus-options) — Analysis options, feature comparison, data output format
- [Content-Aware RLM Design](design/content-aware-rlm.md) — Design decisions for type detection and routing
- [Multi-File RLM Design](design/multi-file-rlm.md) — Design decisions for directory analysis
- [Agent Types](agent-types.md) — All available analyst agents
- [Orchestration Patterns](patterns.md) — When to use RLM vs other patterns
