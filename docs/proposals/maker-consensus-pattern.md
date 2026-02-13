# Pattern 8: Redundant Consensus (MAKER-Inspired) — Proposal

**Status:** Proposal
**Date:** 2026-02-12
**Author:** Community Proposal
**Scope:** Addition of a new orchestration pattern to the pattern catalog, providing redundant execution with statistical error reduction via multi-agent voting.
**Reference:** Meyerson et al., "Solving a Million-Step LLM Task with Zero Errors" (arXiv:2511.09030, November 2025)

---

## 1. Executive Summary

This proposal introduces **Redundant Consensus** as a potential Pattern 8 in the claude-team-orchestration pattern catalog. The pattern is inspired by the MAKER framework (Maximal Agentic decomposition, K-voting, Error Red-flagging), a research system that achieved zero errors across 1,048,575 sequential LLM steps on the Towers of Hanoi benchmark.

The core idea: decompose a task into atomic subtasks, execute each subtask with N independent agents, and use majority voting to select the correct answer. When per-step accuracy exceeds 50%, voting amplifies correctness toward statistical certainty. Red-flagging adds a self-check layer that rejects unreliable outputs before they enter the vote.

No existing pattern in the catalog provides this coordination topology — same task given to multiple agents whose outputs are compared for consensus. Parallel Specialists assign *different lenses* to the same input; Redundant Consensus assigns the *same lens* to the same input and uses statistical redundancy to catch errors.

This document presents the framework, maps it to Claude Code primitives, evaluates fit with equal weight to arguments for and against, and proposes a concrete implementation design for community consideration.

---

## 2. MAKER Framework Overview

### 2.1 Origin and Results

MAKER was published by Meyerson et al. (Cognizant AI Labs) in November 2025. The paper demonstrated that a framework combining extreme decomposition with voting-based error correction could solve arbitrarily long sequential tasks with zero errors — specifically, a 20-disk Towers of Hanoi problem requiring 2^20 - 1 = 1,048,575 individual moves, each produced by a separate LLM call.

The key results:
- **Zero errors** across all 1,048,575 steps
- **Log-linear cost scaling** in step count (not exponential)
- **Model independence**: even models with ~55–60% per-step accuracy achieve zero-error solutions through voting — no state-of-the-art reasoning model required
- **GPT-4.1-mini** was sufficient as the voter model after cost optimization

### 2.2 The Three Pillars

#### Pillar 1: MAD (Maximal Agentic Decomposition)

Tasks are broken into the smallest possible units — ideally single-step subtasks where m=1. Each agent receives:

- The overall solution strategy (provided explicitly, not discovered)
- The current state
- The prior action taken
- An instruction to produce one next action and the resulting state

This separates *strategic reasoning* (what approach to take) from *mechanical execution* (what the next step is). The agent only handles execution; the strategy is pre-determined and injected into every prompt.

Why this matters: monolithic approaches where one agent generates an entire solution sequence (m=s) show exponential error accumulation. A single mistake at step 50 corrupts all subsequent steps. MAD isolates each step so errors cannot cascade.

#### Pillar 2: First-to-Ahead-by-K Voting

Instead of fixed-count majority voting (always sample 3 or 5 times), MAKER uses an adaptive scheme: samples are drawn until one candidate achieves K more votes than any competitor. This adapts naturally — easy steps converge in 1–2 samples, hard steps draw more.

The winning probability for a correct answer:

```
p(correct win) = 1 / (1 + ((1-p)/p)^K)
```

Where `p` is the per-step accuracy. For the full task with `s` steps:

```
p_full = (1 + ((1-p)/p)^K)^(-s)
```

The minimum K grows logarithmically with step count: `K_min = Θ(ln s)`. For 1M steps, roughly 18 voting rounds suffice for the hardest steps.

**Temperature control**: The first vote uses temperature 0 (deterministic best guess). Subsequent votes use temperature 0.1 — enough diversity to decorrelate errors while staying close to the model's best output.

**Token budget**: Maximum 750 output tokens per step. This constraint is both a cost control and a red-flagging signal (see Pillar 3).

#### Pillar 3: Red-Flagging

Before a response enters the vote tally, it passes through self-checks that reject unreliable outputs:

1. **Length check**: Responses exceeding ~700 tokens show dramatically higher error rates (approaching 10% vs. typical 0.1%). Overly long outputs signal confused reasoning and are rejected.
2. **Format check**: Responses must match expected output patterns (in the paper: `move = <move>` and `next_state = <next_state>`). Incorrect formatting signals confused reasoning.

Red-flagging reduces *correlated* errors more effectively than improving base accuracy. The valid response probability `v` adjusts the expected cost:

```
E[cost] = Θ(cs × ln s / (vp))
```

Where `c` is the per-token cost, `s` is step count, `v` is valid response rate, and `p` is accuracy among valid responses.

### 2.3 Cost Scaling

The critical property: with maximal decomposition (m=1), expected cost grows **log-linearly** in step count:

```
E[cost] = Θ(p⁻¹ × cs × ln s)
```

This contrasts sharply with coarser decompositions (m > 1), which show exponential cost growth in m. The log factor comes from K_min = Θ(ln s) — voting needs logarithmically more rounds as tasks get longer, not linearly more.

For context: doubling the number of subtasks roughly adds one more voting round rather than doubling the cost.

---

## 3. Gap Analysis — What's Missing from Existing Patterns

### 3.1 Current Pattern Catalog

| # | Pattern | Coordination Topology | Agent Relationship | Output Combination |
|---|---------|----------------------|-------------------|-------------------|
| 1 | Parallel Specialists | Fan-out / fan-in | Different focus, same input | Synthesize diverse perspectives |
| 2 | Pipeline | Linear chain | Sequential handoff | Each stage transforms prior output |
| 3 | Swarm | Work pool | Same role, different inputs | Independent results, no combination |
| 4 | Research + Implementation | Two-phase | Research feeds implementation | Knowledge transfer |
| 5 | Plan Approval | Gate | Worker + approver | Approval / rejection |
| 6 | Multi-File Refactoring | Fan-out with fan-in | Same role, different files | Integration testing |
| 7 | RLM | Fan-out / fan-in | Same role, different chunks | Synthesis of chunk findings |

### 3.2 The Missing Topology

None of the seven patterns provide: **same task, same focus, N agents, consensus voting**.

The closest pattern is **Parallel Specialists** (#1), but it assigns *different lenses* to the same input — a security reviewer, a performance reviewer, and an architecture reviewer each look at the same code but analyze different aspects. Their outputs are *complementary* and get *synthesized*.

Redundant Consensus assigns the *same lens* to the same input — three agents all answer "Is this function vulnerable to SQL injection?" independently. Their outputs are *redundant* and get *voted on*.

| Dimension | Parallel Specialists | Redundant Consensus |
|-----------|---------------------|-------------------|
| Agent prompts | Different (each has unique focus) | Identical (same task) |
| Outputs | Complementary perspectives | Redundant answers |
| Combination method | Synthesis (merge all) | Voting (pick majority) |
| Goal | Coverage (find everything) | Accuracy (get it right) |
| Error model | Each catches what others miss | Errors decorrelate across agents |
| Failure mode | Missing a perspective | Correlated errors defeat voting |

**Swarm** (#3) is also distinct — it assigns the *same role* to *different inputs*. Three swarm workers process three different files. Redundant Consensus gives the *same input* to three workers and compares their answers.

### 3.3 Is the Gap Real?

The gap is real but narrow. Most software engineering tasks are *creative* — there is no single correct answer to "refactor this function" or "write a test for this endpoint." Voting requires tasks with *verifiable* or at least *comparable* outputs. The gap exists specifically for:

- Binary classification tasks (vulnerable / not vulnerable)
- Deterministic transformations (callback → async/await)
- Exact-match outputs (configuration validation: compliant / non-compliant)
- Structured answers with enumerable options

For tasks outside this scope, the existing patterns are better fits.

---

## 4. Fit Assessment — Arguments For

### 4.1 A Genuinely New Coordination Topology

The pattern catalog should be *complete* — covering the space of useful coordination topologies. Redundant Consensus fills a real gap: the case where you want *high confidence in a single answer* rather than *diverse perspectives* or *parallel throughput*.

### 4.2 Concrete Software Engineering Use Cases

#### Security Classification (Binary YES/NO)

```
For each function in src/:
  - 3 voters independently answer: "Is this function vulnerable to injection? YES/NO"
  - Majority wins
  - Red-flag: any voter that produces >200 tokens of reasoning (likely confused)
```

This is the strongest use case. Binary classification has exact-match voting, no semantic comparison needed. A single reviewer might miss a subtle vulnerability or hallucinate one; three independent reviews with majority voting reduce both false positives and false negatives.

#### Test Generation Verification (Generate-then-Verify)

```
Step 1: One agent generates a test suite
Step 2: 3 voters independently answer: "Does this test correctly validate the specification? YES/NO"
Step 3: Majority determines whether to accept or regenerate
```

A variant where voting validates rather than generates. The creative work (test writing) stays with one agent; the mechanical judgment (does this test do what it claims?) gets voted on.

#### Migration Script Validation

```
For each file requiring callback→async/await conversion:
  - 3 voters independently produce the converted code
  - Exact-match comparison (after whitespace normalization)
  - Any disagreement → flag for human review
```

Mechanical code transformations have deterministic correct outputs. Three agents should produce identical conversions; disagreement signals a genuinely ambiguous case worth human attention.

#### Configuration / Compliance Auditing

```
For each configuration entry:
  - 3 voters check: "Does this comply with policy X? PASS/FAIL"
  - Majority determines compliance status
  - Disputed entries escalated to human reviewer
```

Policy compliance checks are binary and well-defined. Voting reduces the chance of a single agent misinterpreting a policy rule.

#### Mechanical Code Transformations

```
For each function using deprecated API pattern:
  - 3 voters independently produce the updated function
  - Exact-match vote (normalized)
  - Unanimous agreement → auto-apply
  - Split vote → manual review
```

When the transformation is mechanical (rename, signature change, pattern substitution), redundancy catches the occasional hallucination or omission.

### 4.3 Cost Analysis

Haiku as the voter model makes redundancy cheap:

| Scenario | Subtasks | Voters | Model | Est. Cost |
|----------|----------|--------|-------|-----------|
| Security audit (50 functions) | 50 | 3 | Haiku | ~$0.15 |
| Compliance check (100 policies) | 100 | 3 | Haiku | ~$0.25 |
| Migration validation (30 files) | 30 | 3 | Haiku | ~$0.10 |

The cost multiplier (3x per subtask) is offset by using the cheapest model. For comparison, a single Sonnet pass over the same 50 functions costs ~$0.50 — three Haiku voters cost less.

### 4.4 The Statistical Argument

The mathematical foundation is sound: if each voter independently gets the right answer with probability p > 0.5, majority voting amplifies correctness exponentially in the number of voters. With 3 voters and p = 0.8:

- Single agent accuracy: 80%
- 3-voter majority accuracy: 89.6%
- 5-voter majority accuracy: 94.2%

With ahead-by-K voting (K=2) and p = 0.8:

- Correct-win probability per step: 94.1%
- Over 100 steps: ~99.8% (K can be tuned higher)

The paper proves this scales to millions of steps with appropriate K.

---

## 5. Fit Assessment — Arguments Against

### 5.1 MAKER Was Designed for Mechanical Tasks

The Towers of Hanoi benchmark is maximally mechanical: every step has exactly one correct answer, the state representation is compact and unambiguous, and the strategy is provided in advance. Most software engineering tasks are creative, subjective, or context-dependent:

- "Refactor this function" has many valid outputs
- "Write a descriptive variable name" is subjective
- "Design an API endpoint" involves tradeoffs

Voting only works when there is a *consensus-eligible answer* — something that can be meaningfully compared across agents. This restricts the pattern to a narrow subset of SE tasks.

**Severity: High.** This is the fundamental limitation. The pattern is genuinely useful only for binary/deterministic/enumerable tasks.

### 5.2 Output Comparison for Code Is Hard

For non-trivial code outputs, comparing agent answers requires semantic equivalence checking. Two functions that do the same thing may have different variable names, control flow, or formatting. The paper avoided this entirely by using a structured output format with exact-match comparison.

In software engineering, exact-match comparison works for:
- Binary YES/NO answers
- Numeric values
- Enum selections
- Single-line outputs

It does not work for:
- Multi-line code generation
- Free-text explanations
- Architectural recommendations

**Severity: High.** This limits practical applicability to tasks with constrained output formats.

### 5.3 No Native Voting Primitives in Claude Code

Claude Code provides TeamCreate, TaskCreate, TaskUpdate, TaskGet, and SendMessage. None of these implement voting, consensus, or output comparison. The entire voting mechanism must be built from:

- Multiple identical tasks (voter agents)
- Message collection at the lead/judge
- Custom comparison logic in the judge's prompt
- Consensus determination via prompt engineering

This works but is fragile — the judge must correctly parse, compare, and tally heterogeneous outputs. There is no programmatic guarantee of correct vote counting.

**Severity: Medium.** Prompt-based voting works for simple output formats (YES/NO, PASS/FAIL) but becomes unreliable for complex outputs.

### 5.4 Cost Multiplier Regardless of Savings

Every subtask runs N times (typically 3). Even with Haiku, this is a 3x cost multiplier on agent compute. For large task decompositions, this can become significant:

| Subtasks | Single pass (Haiku) | 3-voter (Haiku) | 3-voter (Sonnet) |
|----------|-------------------|-----------------|-----------------|
| 10 | ~$0.01 | ~$0.03 | ~$0.15 |
| 100 | ~$0.05 | ~$0.15 | ~$1.50 |
| 1,000 | ~$0.50 | ~$1.50 | ~$15.00 |

The cost is justified only when the accuracy improvement matters more than the cost increase. For many SE tasks, a single careful pass is sufficient.

**Severity: Medium.** Manageable with Haiku voters, but users must consciously decide the accuracy/cost tradeoff.

### 5.5 Correlated Errors Defeat Voting

The voting argument assumes *independent* errors — each agent fails independently with probability 1-p. In practice, LLM errors are often *correlated*:

- **Systematic model biases**: If Haiku consistently misclassifies a certain code pattern, all three voters will get it wrong. Voting amplifies correctness only for *random* errors, not *systematic* ones.
- **Shared training data**: All voters share the same training distribution. They are likely to share the same blind spots.
- **Identical prompts**: The paper used temperature variation (0 then 0.1) to decorrelate, but identical prompts still bias toward the same failure modes.

Mitigation strategies (varied prompts, different few-shot examples, temperature variation) help but cannot eliminate correlation entirely.

**Severity: High.** This is the strongest theoretical objection. The paper acknowledges this and addresses it for Towers of Hanoi specifically, but generalizing to SE tasks requires empirical validation.

### 5.6 Sequential Bottleneck at the Judge

The judge must collect all votes, parse all outputs, compare them, and determine consensus — for every subtask. This creates a sequential bottleneck:

- Judge context grows linearly with the number of subtasks × voters
- For large task decompositions, the judge risks context exhaustion
- The judge itself can make errors in vote tallying

**Severity: Medium.** Mitigated by batching and the lead-managed variant for small task counts, but becomes a real constraint at scale.

### 5.7 No Nested Teams in Claude Code

Claude Code teams are flat — all agents exist in one team with one task list. MAKER's architecture (orchestrator → decomposer → voter pools) maps to a flat structure where the team lead or a judge agent manages both decomposition and voting. This conflates concerns and makes the team lead/judge a bottleneck.

**Severity: Low.** Workable with the two-variant design (lead-managed for small, judge-mediated for large), but less clean than a hierarchical implementation would be.

### 5.8 Risk of Overselling a Narrow Pattern

The existing seven patterns are all broadly applicable. Every engineering team will use Swarm, Pipeline, or Parallel Specialists regularly. Redundant Consensus is genuinely useful only for a narrow class of tasks. Including it in the catalog at equal prominence risks:

- Users applying it to inappropriate tasks (voting on creative work)
- Inflating the pattern count without proportional utility
- Confusing users choosing between patterns

**Severity: Medium.** Mitigated by clear "when to use" and "when NOT to use" guidance, but the risk of misapplication is real.

---

## 6. Mapping to Claude Code Primitives

### 6.1 Pillar-by-Pillar Mapping

#### Pillar 1: MAD → TaskCreate with Fine-Grained Decomposition

The team lead decomposes the overall task into atomic subtasks using `TaskCreate`. Each task represents one unit of work to be voted on.

```javascript
// Decompose "audit 50 functions for SQL injection" into 50 tasks
for (const func of functions) {
  TaskCreate({
    subject: `Vote: Is ${func.name} vulnerable to SQL injection?`,
    description: `
      File: ${func.file}
      Lines: ${func.startLine}-${func.endLine}
      Question: Is this function vulnerable to SQL injection? Answer YES or NO.
      Include confidence (HIGH/MEDIUM/LOW) and one-line reasoning.
    `,
    activeForm: `Voting on ${func.name}`
  })
}
```

Granularity is configurable — for binary classification, each function is one subtask. For migration validation, each file is one subtask.

#### Pillar 2: Voting → N Identical Tasks + Collection via SendMessage

For each subtask, N voter agents independently process the same input. Votes are collected by the team lead or a dedicated judge.

**Lead-managed approach** (for <10 subtasks):

```javascript
// Spawn 3 voters for each subtask — voters send results via SendMessage
Task({
  team_name: "maker-team",
  name: "voter-1",
  subagent_type: "swarm:maker-voter",
  model: "haiku",
  prompt: `Vote on task: "${taskDescription}"`,
  run_in_background: true
})
// ... repeat for voter-2, voter-3
// Lead collects 3 messages, tallies inline
```

**Judge-mediated approach** (for 10+ subtasks):

```javascript
// Persistent judge collects votes and tallies
Task({
  team_name: "maker-team",
  name: "judge",
  subagent_type: "swarm:maker-judge",
  model: "haiku",
  prompt: `Collect votes from voters. For each subtask, determine consensus...`,
  run_in_background: true
})
```

#### Pillar 3: Red-Flagging → Prompt-Level Self-Check + Judge-Level Filtering

Red-flagging operates at two levels:

1. **Voter self-check** (prompt-level): The voter prompt includes instructions to flag uncertainty:
   ```
   If you are uncertain or your reasoning exceeds 3 sentences, set confidence to LOW.
   If the question is ambiguous or unanswerable from the given context, answer UNCERTAIN.
   ```

2. **Judge-level filtering**: The judge rejects votes with LOW confidence or UNCERTAIN answers before tallying.

3. **Optional hooks** (implementation-level): A Claude Code hook could validate voter output format before it reaches the judge:
   ```json
   {
     "event": "on_message",
     "script": "validate-voter-output.sh",
     "pattern": "maker-voter"
   }
   ```

### 6.2 Detailed Concept Mapping

| MAKER Concept | Claude Code Primitive | Notes |
|---------------|----------------------|-------|
| Task decomposition | `TaskCreate` | One task per votable subtask |
| Voter agent | `Task` with `swarm:maker-voter` | Haiku model, identical prompt |
| Vote collection | `SendMessage` to judge/lead | Structured JSON output |
| Vote tallying | Judge agent prompt logic | Parse and compare votes |
| Red-flag: length | Voter prompt: "keep response under N tokens" | Prompt-enforced |
| Red-flag: format | Judge parses JSON, rejects malformed | Judge-enforced |
| Red-flag: confidence | Voter self-reports confidence level | Prompt-enforced |
| Ahead-by-K | Judge tracks vote counts per answer | Prompt logic |
| Temperature variation | Not directly controllable | Use prompt variation instead |
| State passing | Task description carries context | Via `TaskCreate` description |
| Result aggregation | Judge sends final report to lead | Via `SendMessage` |

### 6.3 Key Differences from Paper

| Paper | Claude Code Implementation |
|-------|--------------------------|
| Temperature 0 for first vote, 0.1 for subsequent | Temperature not controllable per-call; use prompt variation for decorrelation |
| Programmatic vote parsing and tallying | Prompt-based parsing by judge agent |
| Exact-match string comparison | Judge compares structured JSON fields |
| Adaptive sampling (draw until ahead-by-K) | Fixed N voters or judge requests additional voters via message |
| Token-count red-flagging | Prompt-based length guidance; no programmatic token counting |

---

## 7. Proposed Pattern Design

### 7.1 Pattern Identity

- **Name:** Redundant Consensus (MAKER-Inspired)
- **Number:** 8
- **When to use:** Binary classification, deterministic validation, compliance checks — tasks with verifiable correct answers where high confidence matters more than speed or cost
- **When NOT to use:** Creative tasks, subjective judgment, code generation, any task where "correct" is ambiguous

### 7.2 Two Team Structures

#### Variant A: Lead-Managed (<10 Subtasks)

The team lead spawns voters directly and tallies inline. No dedicated judge needed.

```
User prompt:
  "Check these 5 functions for SQL injection vulnerability using
   redundant consensus with 3 voters each."

Team Lead behavior:
  1. Create team
  2. For each function (5 subtasks):
     a. Spawn 3 voter agents (Haiku) with identical prompts
     b. Collect 3 responses via incoming messages
     c. Parse JSON from each voter
     d. Apply red-flag filter (reject LOW confidence, malformed JSON)
     e. Tally valid votes:
        - If one answer leads by ≥2 among valid votes → accept as consensus
        - If tied or insufficient valid votes → mark as DISPUTED
     f. Record result for this subtask
  3. Compile all results into final report
  4. Shutdown voters, delete team
```

**Pseudocode for lead-managed consensus:**

```
function processSubtask(subtask, voterCount = 3):
    votes = []
    for i in 1..voterCount:
        spawn voter-{i} as swarm:maker-voter (Haiku, background)
        prompt: formatVoterPrompt(subtask)

    // Collect responses
    for i in 1..voterCount:
        response = awaitMessage(from: voter-{i})
        parsed = parseVoterJSON(response)
        if parsed.confidence != "LOW" and parsed.answer != "UNCERTAIN":
            votes.append(parsed)

    // Tally
    if votes.length < 2:
        return { subtask, result: "DISPUTED", reason: "insufficient valid votes" }

    counts = countBy(votes, v => v.answer)
    leader = maxBy(counts, (answer, count) => count)

    if leader.count >= leader.count + 2:  // ahead-by-K where K=2
        return { subtask, result: leader.answer, confidence: "CONSENSUS" }
    else if leader.count > votes.length / 2:
        return { subtask, result: leader.answer, confidence: "MAJORITY" }
    else:
        return { subtask, result: "DISPUTED", votes: counts }
```

#### Variant B: Judge-Mediated (10+ Subtasks)

A persistent judge agent manages vote collection, freeing the team lead from per-vote coordination.

```
Team structure:
  - team-lead: Decomposes task, creates subtasks, spawns judge + voters
  - judge: Persistent agent that claims voting tasks, spawns voters, tallies
  - voter-1, voter-2, voter-3: Identical Haiku agents, process tasks from pool

Team Lead behavior:
  1. Create team
  2. Create one task per subtask (all pending)
  3. Spawn judge agent (Haiku)
  4. Spawn 3 voter agents (Haiku)
  5. Judge claims subtasks, assigns to voters via SendMessage
  6. Judge collects votes, tallies, records results to task descriptions
  7. Judge sends consolidated report to team-lead when all subtasks done
  8. Team lead presents report, shuts down team

Judge behavior:
  1. Check TaskList for pending subtasks
  2. For each pending subtask:
     a. Send the subtask prompt to all 3 voters via SendMessage
     b. Collect 3 responses
     c. Apply red-flag filters
     d. Tally votes, determine consensus
     e. Write result to task description via TaskUpdate
     f. Mark task completed
  3. After all tasks: send consolidated report to team-lead
```

### 7.3 Voter Output Schema

All voters produce structured JSON:

```json
{
  "answer": "YES",
  "confidence": "HIGH",
  "reasoning": "The function concatenates user input directly into the SQL query at line 42 without parameterization."
}
```

Field constraints:
- `answer`: One of the expected values for this subtask type (YES/NO, PASS/FAIL, or the specific transformation output)
- `confidence`: HIGH, MEDIUM, or LOW
- `reasoning`: One sentence maximum. Longer reasoning triggers the length red-flag.

### 7.4 Consensus Logic

```
function determineConsensus(votes, K = 2):
    // Step 1: Red-flag filter
    validVotes = votes.filter(v =>
        v.confidence != "LOW" and
        v.answer != "UNCERTAIN" and
        v.reasoning.sentenceCount <= 3
    )

    // Step 2: Insufficient valid votes
    if validVotes.length < 2:
        return DISPUTED("insufficient valid votes after red-flag filtering")

    // Step 3: Count by answer
    counts = groupAndCount(validVotes, by: "answer")
    sorted = sortDescending(counts)
    leader = sorted[0]
    runnerUp = sorted.length > 1 ? sorted[1] : { count: 0 }

    // Step 4: Ahead-by-K fast path
    if leader.count - runnerUp.count >= K:
        return CONSENSUS(leader.answer)

    // Step 5: Simple majority fallback
    if leader.count > validVotes.length / 2:
        return MAJORITY(leader.answer)

    // Step 6: No consensus
    return DISPUTED("split vote", details: counts)
```

### 7.5 Error Decorrelation Strategies

Since Claude Code does not expose temperature control per API call, decorrelation must come from prompt-level variation:

| Strategy | Implementation | Effectiveness |
|----------|---------------|---------------|
| Varied system prompts | Each voter gets a slightly different framing ("You are a security expert", "You are a code auditor", "You are a penetration tester") | Medium — introduces perspective diversity but may bias answers |
| Different few-shot examples | Each voter sees different example classifications | Medium — helps with pattern variety |
| Reordered context | Present the code snippet with different surrounding context | Low — minor effect on classification tasks |
| Role rotation | Voter 1 argues YES, Voter 2 argues NO, Voter 3 gives honest answer | High for adversarial tasks, not suitable for classification |

**Recommended default**: Use identical prompts. The simplicity benefit outweighs the marginal decorrelation from prompt variation, and identical prompts make vote comparison straightforward. Reserve prompt variation for cases where empirical testing shows correlated failures.

### 7.6 Cost Optimization Strategies

| Strategy | Mechanism | Tradeoff |
|----------|-----------|----------|
| Haiku voters | Use cheapest model for voters | Lower per-vote cost; slightly lower per-step accuracy |
| Selective voting | Only vote on ambiguous subtasks; single-pass for obvious ones | Reduces total votes but requires a pre-classification step |
| Adaptive N | Start with N=3; increase to N=5 only for DISPUTED results | Reduces average cost; adds latency for disputed items |
| Batch processing | Process all subtasks before voting (generate answers, then compare) | Better parallelism; requires holding all outputs in context |
| Early termination | Stop voting when ahead-by-K is reached (don't wait for all N) | Cannot implement cleanly with background agents; requires sequential spawning |

---

## 8. Proposed Agent Definitions

These agents would be created if the pattern is accepted. Definitions here are specifications only — no files are created by this proposal.

### 8.1 `swarm:maker-voter`

**File:** `agents/maker-voter.md`

```yaml
---
name: maker-voter
description: Independent voter agent for MAKER-inspired redundant consensus. Analyzes a single subtask and returns a structured JSON vote with answer, confidence, and reasoning. Includes red-flag self-checks.
model: haiku
tools:
  - Read
  - Grep
  - Glob
  - SendMessage
  - TaskList
  - TaskGet
  - TaskUpdate
color: yellow
---
```

**Behavioral description:**

```markdown
# MAKER Voter Agent

You are an independent voter in a redundant consensus workflow. Your job is to
analyze a single subtask and return a structured vote.

## Critical Rules

1. **Independence**: Do not coordinate with other voters. Your answer must be
   your own independent judgment.
2. **Structured output**: Always return valid JSON matching the schema below.
3. **Brevity**: Keep reasoning to ONE sentence. If you need more than one
   sentence, your confidence should be LOW.
4. **Honesty**: If you are uncertain, say UNCERTAIN. Do not guess.

## Output Schema

{
  "answer": "<YES|NO|PASS|FAIL|or task-specific value>",
  "confidence": "<HIGH|MEDIUM|LOW>",
  "reasoning": "<one sentence explaining your answer>"
}

## Red-Flag Self-Checks

Before submitting your vote, verify:
- [ ] Your reasoning is ONE sentence (not two or more)
- [ ] Your answer matches one of the expected values
- [ ] You have actually read the relevant code/content
- [ ] If uncertain, confidence is LOW or answer is UNCERTAIN

## Team Workflow

1. Check TaskList for pending voting tasks
2. Claim a task with TaskUpdate (set owner to your name, status to in_progress)
3. Read the relevant file/content specified in the task description
4. Form your independent judgment
5. Send your JSON vote to the judge or team-lead via SendMessage
6. Mark task completed via TaskUpdate
7. Check TaskList for more work — repeat until no pending tasks remain
```

### 8.2 `swarm:maker-judge`

**File:** `agents/maker-judge.md`

```yaml
---
name: maker-judge
description: Vote collection and consensus determination agent for MAKER-inspired redundant consensus. Collects votes from voter agents, applies red-flag filtering, tallies results, and reports consensus or disputes.
model: haiku
tools:
  - Read
  - Grep
  - Glob
  - SendMessage
  - TaskList
  - TaskGet
  - TaskUpdate
color: magenta
---
```

**Behavioral description:**

```markdown
# MAKER Judge Agent

You are the judge in a redundant consensus workflow. Your job is to collect
votes from voter agents, filter unreliable votes, determine consensus, and
report results.

## Workflow

For each subtask:

1. Receive votes from voter agents (via incoming messages or task descriptions)
2. Parse each vote's JSON: { answer, confidence, reasoning }
3. Apply red-flag filters:
   - REJECT votes with confidence: "LOW"
   - REJECT votes with answer: "UNCERTAIN"
   - REJECT votes with reasoning longer than 2 sentences
   - REJECT votes with malformed JSON
4. Tally valid votes by answer value
5. Determine consensus:
   - CONSENSUS: Leading answer ahead by ≥K (default K=2) → high confidence
   - MAJORITY: Leading answer has >50% of valid votes → moderate confidence
   - DISPUTED: No clear winner → flag for review
6. Record result in the task description via TaskUpdate

## Result Format

For each subtask, record:

{
  "subtask": "<subtask identifier>",
  "result": "<CONSENSUS|MAJORITY|DISPUTED>",
  "answer": "<winning answer or null if DISPUTED>",
  "vote_counts": { "YES": 2, "NO": 1 },
  "filtered_count": 0,
  "filter_reasons": []
}

## Final Report

After all subtasks are processed, compile a consolidated report:

## Consensus Results

| Subtask | Result | Answer | Votes | Filtered |
|---------|--------|--------|-------|----------|
| func_a  | CONSENSUS | NO  | 3/3   | 0        |
| func_b  | CONSENSUS | YES | 2/3   | 0        |
| func_c  | DISPUTED  | —   | 1Y/1N | 1        |

### Summary
- Total subtasks: X
- Consensus reached: Y (Z%)
- Disputed: W (require manual review)

Send this report to team-lead via SendMessage.

## Guidelines

- Never cast your own vote — you are an impartial judge
- Never modify or reinterpret voter answers
- Apply red-flag filters consistently
- Report disputed items prominently — they need human attention
```

---

## 9. Comparison with Existing Patterns

### 9.1 Side-by-Side Comparison

| Dimension | Redundant Consensus | Parallel Specialists | Swarm | RLM |
|-----------|-------------------|---------------------|-------|-----|
| **Task type** | Binary/deterministic | Multi-perspective analysis | Many similar independent | Large file analysis |
| **Agent prompts** | Identical | Different focus per agent | Identical | Identical (per content type) |
| **Input per agent** | Same input | Same input | Different input each | Different chunk each |
| **Output combination** | Voting (pick majority) | Synthesis (merge all) | None (independent) | Synthesis (merge all) |
| **Goal** | High accuracy on one answer | Comprehensive coverage | Throughput | Comprehensive analysis |
| **Optimal agent count** | 3–5 (odd numbers) | 2–5 (one per focus) | 2–5 (load-dependent) | 3–6 (chunk-dependent) |
| **Model recommendation** | Haiku (voters), Haiku (judge) | Varies by focus | Varies by task | Haiku (analysts), Sonnet (synthesizer) |
| **Cost profile** | N × per subtask × count | Fixed (one per focus) | Fixed (one per item) | Fixed (one per chunk) |
| **Error model** | Random errors decorrelate | Different errors per lens | Independent | Independent per chunk |
| **Failure mode** | Correlated errors | Missing a perspective | Bottleneck on slow items | Chunk boundary effects |

### 9.2 Decision Heuristic

Use this pattern selection guide:

```
Is the output verifiable (binary, deterministic, exact-match)?
  YES → Is high confidence worth 3x cost?
    YES → Redundant Consensus
    NO  → Single-pass Swarm
  NO  → Do you need multiple perspectives?
    YES → Parallel Specialists
    NO  → Is the input too large for one context?
      YES → RLM
      NO  → Is work sequential?
        YES → Pipeline
        NO  → Swarm
```

### 9.3 When NOT to Use Redundant Consensus

| Situation | Why Not | Better Alternative |
|-----------|---------|-------------------|
| Code generation (write a function) | No verifiable "correct" output | Single agent or Pipeline |
| Code review (find all issues) | Goal is coverage, not consensus | Parallel Specialists |
| Refactoring (improve code quality) | Subjective, many valid outputs | Multi-File Refactoring |
| Architecture design | Creative, no single answer | Plan Approval |
| Large file analysis | Need comprehensive findings, not consensus | RLM |
| Many independent files | Need throughput, not accuracy per file | Swarm |
| Research tasks | Exploratory, no votable question | Research + Implementation |

---

## 10. Limitations and Trade-offs

### 10.1 Complete Limitation Enumeration

| # | Limitation | Severity | Mitigation |
|---|-----------|----------|------------|
| 1 | Only works for tasks with verifiable correct answers | **High** | Clear documentation of eligible task types; "when NOT to use" guidance |
| 2 | Correlated LLM errors defeat voting | **High** | Prompt variation, different few-shot examples, empirical validation before deployment |
| 3 | Output comparison requires structured formats | **High** | Constrain voter output to JSON schema; use binary answer fields for comparison |
| 4 | 3x+ cost multiplier per subtask | **Medium** | Haiku voters ($0.003/subtask vs $0.01 for Sonnet single-pass); selective voting for obvious cases |
| 5 | No programmatic voting primitives | **Medium** | Judge agent handles parsing/tallying via prompt; works for simple output formats |
| 6 | Judge is a sequential bottleneck | **Medium** | Batch subtask results; lead-managed variant for small counts; judge processes results as they arrive |
| 7 | No temperature control for decorrelation | **Medium** | Use prompt variation instead; accept that correlation may be higher than paper's setup |
| 8 | Flat team structure (no nesting) | **Low** | Two-variant design accommodates; lead-managed for small, judge-mediated for large |
| 9 | Narrow applicability relative to other patterns | **Medium** | Position as a specialized tool, not a general-purpose pattern; clear selection guide |
| 10 | Judge can make errors in tallying | **Low** | Structured JSON makes parsing reliable; simple counting logic is robust |
| 11 | Cannot implement adaptive sampling (ahead-by-K with dynamic N) | **Low** | Use fixed N=3 with optional retry for DISPUTED; simpler and sufficient for most cases |

### 10.2 Trade-offs Relative to Each Existing Pattern

| vs. Pattern | Redundant Consensus Wins When... | Other Pattern Wins When... |
|-------------|--------------------------------|---------------------------|
| vs. Parallel Specialists | You need one right answer, not many perspectives | You need comprehensive coverage from different angles |
| vs. Pipeline | Steps are independent and votable | Steps depend on each other sequentially |
| vs. Swarm | Same input needs high-confidence classification | Different inputs need throughput |
| vs. Research + Implementation | Validation needs statistical confidence | Work requires creative discovery then execution |
| vs. Plan Approval | Many binary decisions need automated checking | One complex decision needs human judgment |
| vs. Multi-File Refactoring | Each file needs validated transformation | Files need coordinated creative changes |
| vs. RLM | Input is small but answer must be reliable | Input is large and needs comprehensive analysis |

---

## 11. Implementation Roadmap

### 11.1 Files to Create

| File | Description | Dependencies |
|------|-------------|-------------|
| `agents/maker-voter.md` | Voter agent definition | None |
| `agents/maker-judge.md` | Judge agent definition | None |
| `skills/maker-consensus/SKILL.md` | User-invocable skill for the pattern | Agent definitions |
| `docs/patterns.md` (modify) | Add Pattern 8 entry | Skill definition |
| `docs/agent-types.md` (modify) | Add voter and judge to agent catalog | Agent definitions |

### 11.2 Implementation Sequence

```
Phase 1: Agent Definitions (parallelizable)
├── Create agents/maker-voter.md
└── Create agents/maker-judge.md

Phase 2: Skill Definition
└── Create skills/maker-consensus/SKILL.md
    (depends on Phase 1)

Phase 3: Documentation Updates (parallelizable)
├── Update docs/patterns.md — add Pattern 8
└── Update docs/agent-types.md — add new agents
    (both depend on Phase 2)
```

### 11.3 Verification Plan

| Check | Method |
|-------|--------|
| Agent definitions load correctly | Spawn each agent type via `Task` and verify they respond |
| Voter produces valid JSON | Send a test subtask and validate output schema |
| Judge correctly tallies votes | Provide 3 mock votes and verify consensus determination |
| Lead-managed variant works end-to-end | Run a 3-subtask binary classification with 3 voters each |
| Judge-mediated variant works end-to-end | Run a 10-subtask binary classification with persistent judge |
| Pattern docs are internally consistent | Cross-reference pattern entry, agent docs, and skill definition |
| "When NOT to use" guidance is clear | Review with someone unfamiliar with the pattern |

---

## 12. Open Questions

### 12.1 Questions for Community Input

1. **Pattern numbering**: Should this be Pattern 8, or should it be categorized differently (e.g., as a sub-pattern or variant of Parallel Specialists)?

2. **Default voter count**: Should the default be 3 (minimum for majority vote) or 5 (more robust but costlier)? The paper uses adaptive sampling, but fixed-N is simpler for Claude Code.

3. **Judge model**: Should the judge use Haiku (cheaper, sufficient for simple tallying) or Sonnet (more reliable parsing of complex outputs)?

4. **Scope of initial implementation**: Should the first version support only binary YES/NO tasks (simplest case, strongest fit), or attempt to support arbitrary structured outputs from the start?

5. **Prompt variation for decorrelation**: Should voters get identical prompts (simpler, cleaner comparison) or varied prompts (better decorrelation but harder comparison)? The paper used temperature variation, which is not available here.

6. **Naming**: Is "Redundant Consensus" the right name? Alternatives considered:
   - "Voting Consensus"
   - "Multi-Agent Verification"
   - "Statistical Redundancy"
   - "Consensus Voting"

7. **Catalog placement**: Given the narrow applicability (binary/deterministic tasks only), should this be a full pattern or documented as a "technique" or "recipe" at a lower tier than the core seven?

### 12.2 Alternative Approaches Considered

| Alternative | Description | Why Not Recommended |
|-------------|-------------|-------------------|
| Built-in voting hook | A Claude Code hook that automatically runs N copies of any agent and votes | Over-engineers the solution; most tasks don't benefit from voting; hooks can't compare semantic output |
| Confidence-based single pass | One agent with a confidence score; retry if confidence is low | Doesn't provide statistical guarantees; self-reported confidence is unreliable |
| Debate pattern (agents argue) | Two agents take opposing positions; a judge decides | Different topology (adversarial, not redundant); better for subjective questions than binary classification |
| Ensemble with different models | Use different models (Haiku, Sonnet, Opus) as voters | Model-level diversity is better for decorrelation but much more expensive; harder to compare outputs across capability levels |
| LLM-as-judge (single evaluator) | One agent generates, another evaluates | Two-agent variant of Plan Approval; no statistical amplification |

---

## Appendix A: Worked Example — Security Audit

A complete walkthrough of the lead-managed variant applied to SQL injection classification.

### Setup

```
Task: Audit 5 functions for SQL injection vulnerability
Voters: 3 per function (Haiku)
Consensus rule: Ahead-by-2
```

### Step 1: Decomposition

Team lead creates 5 tasks:

```
Task 1: "Is getUserById() in src/users.py:15-30 vulnerable to SQL injection? YES/NO"
Task 2: "Is searchProducts() in src/products.py:42-68 vulnerable to SQL injection? YES/NO"
Task 3: "Is updateOrder() in src/orders.py:101-125 vulnerable to SQL injection? YES/NO"
Task 4: "Is deleteComment() in src/comments.py:55-72 vulnerable to SQL injection? YES/NO"
Task 5: "Is getReport() in src/reports.py:200-240 vulnerable to SQL injection? YES/NO"
```

### Step 2: Voting (Task 1 example)

Three voters independently read `src/users.py:15-30` and respond:

**Voter 1:**
```json
{ "answer": "YES", "confidence": "HIGH", "reasoning": "User input 'user_id' is concatenated directly into SQL string at line 22." }
```

**Voter 2:**
```json
{ "answer": "YES", "confidence": "HIGH", "reasoning": "String formatting used for SQL query construction with unsanitized parameter." }
```

**Voter 3:**
```json
{ "answer": "YES", "confidence": "MEDIUM", "reasoning": "The query uses f-string interpolation with the user_id parameter." }
```

### Step 3: Consensus

```
Red-flag filter: All votes pass (all HIGH or MEDIUM confidence, all valid JSON)
Vote tally: YES=3, NO=0
Ahead-by-K check: 3-0 = 3 ≥ K(2) → CONSENSUS
Result: YES (CONSENSUS, 3/3 votes)
```

### Step 4: Final Report

```markdown
## SQL Injection Audit Results

| Function | Result | Answer | Votes | Confidence |
|----------|--------|--------|-------|------------|
| getUserById() | CONSENSUS | YES (vulnerable) | 3/3 | HIGH |
| searchProducts() | CONSENSUS | NO (safe) | 3/3 | HIGH |
| updateOrder() | CONSENSUS | YES (vulnerable) | 2/3 | HIGH |
| deleteComment() | DISPUTED | — | 1Y/1N/1U | LOW |
| getReport() | CONSENSUS | NO (safe) | 3/3 | HIGH |

### Summary
- 5 functions audited with 3-voter redundant consensus
- 4/5 reached consensus (80%)
- 1 disputed (deleteComment) — requires manual review
- 2 confirmed vulnerabilities found
```

---

## Appendix B: Cost Comparison

### Scenario: 50-Function Security Audit

| Approach | Agents | Model | Est. Input Tokens | Est. Output Tokens | Est. Cost |
|----------|--------|-------|-------------------|-------------------|-----------|
| Single pass | 50 | Sonnet | 100K | 25K | ~$0.50 |
| Single pass | 50 | Haiku | 100K | 25K | ~$0.05 |
| 3-voter consensus | 150 | Haiku | 300K | 75K | ~$0.15 |
| 5-voter consensus | 250 | Haiku | 500K | 125K | ~$0.25 |
| 3-voter consensus | 150 | Sonnet | 300K | 75K | ~$1.50 |

**Key insight**: 3 Haiku voters cost less than 1 Sonnet pass while providing statistical error reduction. The cost argument only holds when Haiku is the voter model.

---

## Appendix C: Relationship to Existing Research

### MAKER Paper (Meyerson et al., 2025)

| Aspect | Paper | This Proposal |
|--------|-------|--------------|
| Domain | Towers of Hanoi (mechanical puzzle) | Software engineering (binary/deterministic subtasks) |
| Model | GPT-4.1-mini | Claude Haiku (voters), Claude Haiku (judge) |
| Decomposition | Automated (one move per step) | Manual (team lead identifies subtasks) |
| Voting | Adaptive (first-to-ahead-by-K) | Fixed N with optional retry for disputes |
| Red-flagging | Token count + format validation | Confidence self-report + JSON format validation |
| Temperature | 0 (first), 0.1 (subsequent) | Not controllable; use prompt variation |
| Scale tested | 1,048,575 steps | Proposed for 10–500 subtask range |
| Error independence | Partially addressed via temperature | Partially addressed via prompt variation |
| Infrastructure | Custom orchestration code | Claude Code native primitives |

### Other Related Work

- **LLM-as-Judge**: Single evaluator, no statistical amplification. Complementary — could serve as a dispute resolution mechanism within Redundant Consensus.
- **Constitutional AI / RLAIF**: Uses multiple models to evaluate outputs, but for alignment training, not runtime consensus.
- **Self-Consistency (Wang et al., 2023)**: Samples multiple reasoning paths from one model and takes majority vote. Similar principle but operates within a single agent, not across a team.
- **Debate (Irving et al., 2018)**: Adversarial agents argue opposing positions. Different topology — suited for subjective questions, not binary classification.
