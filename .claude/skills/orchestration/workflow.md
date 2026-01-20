# Multi-Agent Orchestration Workflow

Quick reference for running the orchestration workflow.

## The 6 Phases

```
┌──────────┐   ┌─────────┐   ┌──────────────────┐   ┌────────────┐   ┌──────────┐   ┌─────────────┐
│ ARCHITECT│ → │ PLANNER │ → │EXECUTE + VERIFY  │ → │DUAL REVIEW │ → │INTEGRATE │ → │FINAL AUDIT  │
└──────────┘   └─────────┘   └──────────────────┘   └────────────┘   └──────────┘   └─────────────┘
    What?         How?        Do it! + PM checks   Review + PM     Merge + fix    Architect + PM
```

## Quick Start

### Phase 1: Architect
1. Open new chat
2. Paste `agents/architect.md` prompt
3. Describe what you want to build
4. Get: **Specification**

### Phase 2: Planner
1. Open new chat
2. Paste `agents/planner.md` prompt
3. Paste the specification from Phase 1
4. Get: **Execution plan + copy-paste prompts**

### Phase 3: Execute + Continuous PM Verification

**For each wave:**
1. Open N new chats (one per task)
2. Paste each task's prompt
3. Run all wave tasks in parallel
4. Collect outputs

**While next wave runs, PM verifies:**
1. Open new chat with `agents/planner-verify.md`
2. Paste task requirements + executor output
3. Get: Quick verdict (✅ | ⚠️ | ❌)

```
Wave 1: [A] [B] [C]  →  PM verifies A, B, C
           ↓              (while Wave 2 runs)
Wave 2: [D] [E]      →  PM verifies D, E
           ↓
Wave 3: [F]          →  PM verifies F
```

### Phase 4: Dual Review

Run TWO chats in parallel:

**Chat 1 - Reviewer:**
1. Paste `agents/reviewer.md` prompt
2. Paste spec + all outputs
3. Get: **Audit report (security, perf, edge cases)**

**Chat 2 - Planner Review:**
1. Paste `agents/planner.md` in review mode
2. Paste spec + all outputs + PM notes
3. Get: **Cross-task consistency report**

Combine findings into one issues list.

### Phase 5: Integrate
1. Open new chat
2. Paste `agents/integrator.md` prompt
3. Paste everything (spec + outputs + combined issues)
4. Get: **Merged code + verification**

### Phase 6: Final Dual Audit

Run TWO chats in parallel:

**Chat 1 - Architect Final:**
1. Paste `agents/architect-final.md` prompt
2. Paste original spec + final output
3. Get: **Vision match verdict**

**Chat 2 - Planner Final:**
1. Paste `agents/planner-final.md` prompt
2. Paste original plan + final output
3. Get: **Quality gate verdict**

Both should agree: **SHIP IT** | **SHIP WITH CAVEATS** | **NEEDS MORE WORK**

## Dependency Waves

```
Wave 1: [A] [B] [C]  ← Run in parallel, no dependencies
           ↓
Wave 2: [D] [E]      ← Wait for Wave 1, then parallel
           ↓
Wave 3: [F]          ← Wait for Wave 2
```

**Rule**: Never start Wave N+1 until Wave N is complete.
**Optimization**: PM can verify Wave N outputs while Wave N+1 runs.

## Artifacts Flow

```
Architect    →  Specification
                     ↓
Planner      →  Execution Plan + Prompts
                     ↓
Executors    →  Task Outputs (code + summaries)
    ↓               ↓
PM Verify    →  Per-task verdicts (✅/⚠️/❌)
                     ↓
Reviewer     →  Full Audit Report
    +               ↓
Planner      →  Cross-task Consistency Report
                     ↓
Integrator   →  Merged Code + Verification
                     ↓
Architect    →  Vision Match Verdict
    +               ↓
Planner      →  Quality Gate Verdict
                     ↓
              SHIP / CAVEATS / REWORK
```

## Tips

### For Complex Features
- Break into smaller features first
- Each feature gets its own orchestration run
- Better to do 2 small runs than 1 huge one

### For Speed
- Wave 1 should have the most tasks
- Push dependencies to later waves
- More parallel = faster
- PM verifies while next wave runs
- Dual reviews run in parallel

### For Quality
- Never skip any review phase
- PM continuous verification catches drift early
- Dual review catches different issue types
- Final audit closes the loop (vision + execution)

### For Context
- Each chat is fresh - no history
- Include ALL needed info in each prompt
- Planner must force skill usage
- Save all artifacts for later phases

## Checklist

Before starting:
- [ ] CLAUDE.md is up to date
- [ ] Clear understanding of what to build
- [ ] Time to run full workflow (6 phases)

Phase 1-2 (Setup):
- [ ] Architect specification saved
- [ ] Planner prompts saved (one per task)
- [ ] Wave structure understood

Phase 3 (Execute):
- [ ] Each executor prompt pasted completely
- [ ] Outputs collected from each task
- [ ] Waves run in order
- [ ] PM verified each output (✅/⚠️/❌)

Phase 4 (Dual Review):
- [ ] Reviewer audit complete
- [ ] Planner consistency check complete
- [ ] Issues combined into single list

Phase 5 (Integrate):
- [ ] All fixes applied
- [ ] Tests pass
- [ ] Code merged and verified

Phase 6 (Final Audit):
- [ ] Architect vision check complete
- [ ] Planner quality gate complete
- [ ] Both agree on ship decision

## Agent Reference

| Agent | File | When Used |
|-------|------|-----------|
| Architect | `agents/architect.md` | Phase 1 |
| Planner | `agents/planner.md` | Phase 2 |
| Executor | `agents/executor.md` | Phase 3 (template) |
| PM Verify | `agents/planner-verify.md` | Phase 3 (per output) |
| Reviewer | `agents/reviewer.md` | Phase 4 |
| Integrator | `agents/integrator.md` | Phase 5 |
| Architect Final | `agents/architect-final.md` | Phase 6 |
| Planner Final | `agents/planner-final.md` | Phase 6 |
