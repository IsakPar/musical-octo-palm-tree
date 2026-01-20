---
name: orchestration
description: Multi-agent workflow for complex tasks. Use when building features that span multiple domains, require parallel execution, or need structured decomposition with quality gates.
allowed-tools: Read, Write, Grep, Glob, Task
---

# Multi-Agent Orchestration System

## When to Use This

- Building a feature that spans 3+ domains (frontend, backend, database, etc.)
- Task would benefit from parallel execution
- You want quality gates and audits at each phase
- User explicitly asks to "orchestrate", "plan this out", or "break this down"

## The Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  PHASE 1: ARCHITECT                                             │
│  ────────────────────                                           │
│  "What are we building?"                                        │
│  - Clarify requirements with user                               │
│  - Identify constraints and patterns                            │
│  - Output: Clear specification                                  │
│                                                                  │
│                         ↓                                       │
│                                                                  │
│  PHASE 2: PLANNER (PM)                                          │
│  ─────────────────────                                          │
│  "How do we build it?"                                          │
│  - Decompose into single-domain tasks                           │
│  - Organize into dependency waves                               │
│  - Write copy-paste prompts for each task                       │
│  - Assign relevant skills to each prompt                        │
│  - Output: Prompts ready to paste into new chats                │
│                                                                  │
│                         ↓                                       │
│                                                                  │
│  PHASE 3: EXECUTION + CONTINUOUS VERIFICATION                   │
│  ────────────────────────────────────────────                   │
│                                                                  │
│  Wave 1: [Task A] [Task B] [Task C]  ← Run in parallel          │
│     ↓        ↓        ↓                                         │
│  PM verifies each output as it completes (while Wave 2 runs)    │
│                                                                  │
│  Wave 2: [Task D] [Task E]           ← Start when Wave 1 done   │
│     ↓        ↓                                                   │
│  PM verifies each output as it completes                        │
│                                                                  │
│  Wave 3: [Task F]                    ← Start when Wave 2 done   │
│     ↓                                                            │
│  PM verifies output                                             │
│                                                                  │
│                         ↓                                       │
│                                                                  │
│  PHASE 4: DUAL REVIEW                                           │
│  ────────────────────                                           │
│  "Did we build it right?"                                       │
│  Run BOTH in parallel:                                          │
│  - Reviewer: Full audit (security, performance, edge cases)     │
│  - Planner: Cross-task consistency check                        │
│  - Output: Combined issues and fixes needed                     │
│                                                                  │
│                         ↓                                       │
│                                                                  │
│  PHASE 5: INTEGRATION                                           │
│  ────────────────────                                           │
│  "Does it all work together?"                                   │
│  - Merge all outputs                                            │
│  - Apply fixes from dual review                                 │
│  - Run tests                                                    │
│  - Verification                                                 │
│                                                                  │
│                         ↓                                       │
│                                                                  │
│  PHASE 6: FINAL DUAL AUDIT                                      │
│  ─────────────────────────                                      │
│  "Did we achieve the vision?"                                   │
│  Run BOTH in parallel:                                          │
│  - Architect: Vision match check (you defined it, verify it)    │
│  - Planner: Final quality gate                                  │
│  - Output: Ship/Don't ship decision                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Workflow?

**Belt and braces quality**: Multiple verification points catch different types of issues:
- PM continuous verification catches executor drift early
- Dual review catches cross-cutting concerns
- Final dual audit ensures the whole matches the vision

**Parallel everything**: PM verifies Wave 1 outputs while Wave 2 runs. Reviewer and Planner run simultaneously. No wasted time.

## How to Run This Workflow

### Phase 1: Architect

Open a new chat and paste the prompt from `agents/architect.md`.

The architect will:
- Ask clarifying questions
- Read CLAUDE.md and relevant project files
- Output a clear specification

**Save the specification** - you'll need it for multiple phases.

### Phase 2: Planner

Open a new chat and paste the prompt from `agents/planner.md`.

Give the planner:
- The specification from the architect
- Any additional context

The planner will:
- Break down into tasks
- Organize into waves
- Generate copy-paste prompts for each task
- Tell you which skills each executor should use

**Save all the prompts** - one per task.

### Phase 3: Execute + Continuous PM Verification

**Execute in waves:**
1. Open N new chats (one per task in Wave 1)
2. Paste each task's prompt (generated by planner)
3. Run all wave tasks in parallel
4. Collect outputs

**PM verification (run in parallel with next wave):**
As each executor completes:
1. Open a new chat with `agents/planner-verify.md`
2. Give it the task requirements + executor output
3. PM gives quick verdict: ✅ APPROVED | ⚠️ NOTES | ❌ REWORK

You can start Wave 2 while PM verifies Wave 1 outputs. The PM just needs to flag any issues before Phase 4.

### Phase 4: Dual Review

Run BOTH in parallel (two separate chats):

**Chat 1 - Reviewer** (`agents/reviewer.md`):
- Give it: specification + all task outputs
- Does: Full security/performance/edge case audit

**Chat 2 - Planner Review** (`agents/planner.md` in review mode):
- Give it: specification + all task outputs + PM verification notes
- Does: Cross-task consistency check, pattern compliance

Combine their findings into a single list of issues.

### Phase 5: Integration

Open a new chat with `agents/integrator.md`.

Give the integrator:
- Original specification
- All task outputs
- Combined issues from dual review

The integrator will:
- Apply all fixes
- Merge outputs
- Run tests
- Verify everything works together

### Phase 6: Final Dual Audit

Run BOTH in parallel (two separate chats):

**Chat 1 - Architect Final** (`agents/architect-final.md`):
- Give it: original specification + final integrated output
- Does: Verify vision was achieved (closed loop)

**Chat 2 - Planner Final** (`agents/planner-final.md`):
- Give it: original specification + final integrated output
- Does: Final quality gate

Both should agree on: **SHIP IT** | **SHIP WITH CAVEATS** | **NEEDS MORE WORK**

## Key Principles

### 1. Single Domain Per Task
Each executor prompt should focus on ONE thing:
- "Create the database schema" ✓
- "Create the database schema and API endpoints" ✗

### 2. Minimal Context, Maximum Clarity
Prompts should include only what's needed for that task, but be crystal clear about:
- What to build
- What patterns to follow
- What NOT to do

### 3. Skills Inheritance
The planner specifies which skills each executor should use. This ensures consistent patterns across all parallel work.

### 4. Quality Gates
Never skip the review phase. The full audit catches:
- Security issues
- Performance problems
- Inconsistencies between tasks
- Edge cases

### 5. Fresh Contexts
Each agent runs in a fresh chat. No context pollution. No thread length issues.

## File References

### Phase Agents
- `agents/architect.md` - Phase 1: Requirements and specification
- `agents/planner.md` - Phase 2: Task decomposition and prompt generation
- `agents/executor.md` - Phase 3: Template for executor prompts
- `agents/planner-verify.md` - Phase 3: PM verification of each executor output
- `agents/reviewer.md` - Phase 4: Full audit (security, performance, edge cases)
- `agents/integrator.md` - Phase 5: Merge and verify

### Final Review Agents
- `agents/architect-final.md` - Phase 6: Vision match verification
- `agents/planner-final.md` - Phase 6: Final quality gate

### Quick Reference
- `workflow.md` - Quick reference for the full workflow

### Setup Orchestration (Greenfield Projects)
- `setup/SETUP.md` - Overview of setup workflow
- `setup/setup-workflow.md` - Quick reference for setup
- `setup/setup-agents/` - All setup phase agents

## Which Workflow?

| Situation | Use |
|-----------|-----|
| Starting from scratch | **Setup Orchestration** (`/setup`) |
| Major framework upgrade | **Setup Orchestration** (`/setup`) |
| Building features on existing codebase | **Feature Orchestration** (`/orchestrate`) |
| Adding to established project | **Feature Orchestration** (`/orchestrate`) |

## See Also

- `../code-reviewer/SKILL.md` - For code review patterns
- `../architect/SKILL.md` - For system design patterns
