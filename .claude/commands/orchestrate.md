# Orchestrate Command

Start a multi-agent orchestration workflow for a complex feature.

$ARGUMENTS

## Instructions

This command helps you run the multi-agent orchestration workflow. It will guide you through each phase.

### If Starting Fresh

1. Read the orchestration skill at `.claude/skills/orchestration/SKILL.md`
2. Understand the 6-phase workflow
3. Start with the Architect phase

### Architect Phase

**Open a new chat and paste this prompt:**

```
You are the Architect Agent in a multi-agent orchestration workflow.

Your job: Deeply understand what we're building before any code is written.

## Step 1: Read Project Context
- Read CLAUDE.md (root)
- Read relevant subdirectory CLAUDE.md files
- Note existing patterns and conventions

## Step 2: Ask Clarifying Questions
Before proceeding, ask about:
1. What exactly are we building?
2. Who is this for?
3. What's the scope (MVP, full feature)?
4. What constraints exist?
5. What should this NOT do?

## Step 3: Produce Specification
Output a specification with:
- Overview
- Requirements (functional + non-functional)
- Technical context (stack, patterns)
- Scope boundaries
- Success criteria

Start by reading the project context, then ask me questions.
```

Tell the architect what you want to build: $ARGUMENTS

### After Architect Phase

Copy the specification and proceed to the Planner phase.

See `.claude/skills/orchestration/agents/planner.md` for the full planner prompt.

### Workflow Summary

```
Phase 1: Architect       → Get specification
Phase 2: Planner         → Get task prompts (waves + skills)
Phase 3: Execute+Verify  → Run tasks in parallel + PM verifies each
Phase 4: Dual Review     → Reviewer + Planner audit in parallel
Phase 5: Integrate       → Merge, fix, verify
Phase 6: Final Audit     → Architect + Planner final check → SHIP decision
```

### Agent Files

| Phase | Agent | File |
|-------|-------|------|
| 1 | Architect | `agents/architect.md` |
| 2 | Planner | `agents/planner.md` |
| 3 | Executor | `agents/executor.md` (template) |
| 3 | PM Verify | `agents/planner-verify.md` |
| 4 | Reviewer | `agents/reviewer.md` |
| 4 | Planner | (review mode) |
| 5 | Integrator | `agents/integrator.md` |
| 6 | Architect | `agents/architect-final.md` |
| 6 | Planner | `agents/planner-final.md` |

For full details, see:
- `.claude/skills/orchestration/SKILL.md`
- `.claude/skills/orchestration/workflow.md`
- `.claude/skills/orchestration/agents/`
