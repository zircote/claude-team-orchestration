---
name: rlm-pattern
description: Process files exceeding context limits using the RLM (Recursive Language Model) pattern with agent teams. Use when you need to process large files, analyze documents exceeding context, apply RLM chunking, chunk and analyze large content, or handle long context documents.
---

# RLM (Recursive Language Model) Pattern

Process files that exceed context limits by dividing them into partitions and coordinating a team of analyst agents to analyze each partition in parallel, then synthesizing their reports.

**Based on:** [arXiv:2512.24601](https://arxiv.org/abs/2512.24601)

---

## The Pattern

1. **Team Lead** assesses the data, determines partitioning strategy, and divides the content into manageable chunks.

2. **Each Analyst agent** independently analyzes their assigned partition and reports back to team-lead with structured findings.

3. **Team Lead** collects all analyst reports, then either synthesizes directly or spawns a dedicated Synthesizer agent to produce the consolidated report.

This is a fan-out/fan-in coordination pattern built on agent teams.

---

## When to Use

- File exceeds ~2000 lines or ~1500 CSV rows
- You need comprehensive analysis of the full content, not just a snippet
- Log analysis, data exports, large codebase review, document analysis
- Grep alone can't answer the question (need contextual analysis, not keyword matching)

**Don't use when:** File fits in context (< 1500 lines), a targeted Grep suffices, or the task is editing (not analyzing).

---

## Partitioning Strategies

The team lead should choose a partitioning approach based on the data:

| Data Type | Partition By | Chunk Size | Notes |
|-----------|-------------|------------|-------|
| CSV/data exports | Row count (equal splits) | 500-1000 rows | Preserve header row in each chunk file |
| Log files | Line ranges | 200 lines, 20 overlap | Overlap prevents splitting multi-line entries |
| Source code | File boundaries | 1 file per chunk | Natural boundaries; no splitting mid-file |
| Prose/docs | Section boundaries | 250 lines, 25 overlap | Respect heading structure when possible |
| Time-series data | Date ranges | By month/quarter | Enables temporal comparison across analysts |

**For CSV data:** Write each partition to a separate file (e.g., `chunk-01.csv` through `chunk-N.csv`) with the header row preserved. This is more reliable than line offsets for structured data.

**For log/text files:** Use Read tool `offset` and `limit` parameters to give each analyst a line range. Include overlap to avoid splitting entries.

---

## Team Composition

| Role | Count | Agent Type | Purpose |
|------|-------|-----------|---------|
| Team Lead | 1 | You (the orchestrating agent) | Partition data, spawn analysts, collect and synthesize |
| Analyst | 3-10 | `swarm:rlm-chunk-analyzer` | Analyze one partition, report findings |
| Synthesizer | 0-1 | `swarm:rlm-synthesizer` | Combine all analyst reports into final output (optional — team lead can do this directly if findings are compact) |

**Sizing guidance:**
- 1 analyst per partition is ideal for independent chunks
- For many small chunks, use 3-5 analysts in a swarm (each processes multiple chunks via TaskList)
- Keep total agents under 10 to avoid context overflow from completion messages

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

1. **Keep partition count reasonable** — 5-10 partitions is the sweet spot
2. **Analyst reports must be compact** — structured summaries, not raw data
3. **Pass by reference** — give analysts file paths and line ranges, never paste content into prompts
4. **Run /compact before synthesis** if context is getting full from collecting reports

---

## Agent Types

| Role | subagent_type | Model | Tools |
|------|--------------|-------|-------|
| Chunk analyzer | `swarm:rlm-chunk-analyzer` | Haiku | Read, Grep, Glob |
| Synthesizer | `swarm:rlm-synthesizer` | Sonnet | Read |

Both are custom agents defined by this plugin. Fallback: use `general-purpose` with `model: "haiku"` or `model: "sonnet"`.

---

## Comparison with rlm-rs Plugin

| Feature | swarm:rlm-pattern | rlm-rs plugin |
|---------|-------------------|---------------|
| Dependencies | None (Claude Code native) | Requires rlm-rs binary |
| Chunking | File splits or Read offset/limit | rlm-rs buffer system |
| Sub-LLM execution | `swarm:rlm-chunk-analyzer` (Haiku) | `rlm-rs:rlm-subcall` (Haiku) |
| Synthesis | `swarm:rlm-synthesizer` (Sonnet) | `rlm-rs:rlm-synthesizer` (Sonnet) |
| Best for | Quick setup, no install | Heavy/repeated RLM workflows |
