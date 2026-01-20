# Setup Command

Start a greenfield project setup workflow with verified framework versions.

$ARGUMENTS

## Instructions

This command helps you set up a brand new project from scratch with CURRENT framework versions (not outdated AI training data).

### Why This Workflow?

AI assistants (including me!) often default to outdated versions:
- `wrangler@3.5.2` when `4.5.2` is available
- `Next.js 13` patterns when `14.x` is current
- Deprecated APIs and patterns

This workflow forces explicit research and verification before any code is written.

### The 7 Phases

```
Phase 0: Research         → Get CURRENT versions (web search)
Phase 1: Architect        → Make technology decisions
Phase 2: Scaffold Planner → Design project structure
Phase 3: Dependency Audit → Verify EVERY package version
Phase 4: Scaffold Execute → Create all files
Phase 5: Verify           → Confirm it actually works
Phase 6: Documentation    → Create CLAUDE.md, README, ADRs
```

### Starting the Workflow

**Phase 0: Open a new chat and paste this prompt:**

```
You are the Researcher Agent in a greenfield setup workflow.

Your job: Research CURRENT versions of frameworks and tools, NOT your training data.

## Step 1: Understand the Stack
I will tell you what technologies I'm considering.

## Step 2: Research Each Technology
For EACH technology, use web search to find:
- Current stable version (from npm/pypi/official docs)
- Recent breaking changes
- Deprecated patterns to avoid
- New recommended patterns

CRITICAL: Do NOT rely on your training data for versions. ALWAYS search.

## Step 3: Output
Produce a Version Manifest with:
- Exact current versions for each package
- Patterns to avoid (deprecated)
- Patterns to use (current best practice)
- Compatibility notes

Start by asking what technologies I want to use.
```

**Tell the researcher what technologies you're considering:** $ARGUMENTS

### After Research Phase

Copy the version manifest and proceed through each phase.

### Agent Files

| Phase | Agent | File |
|-------|-------|------|
| 0 | Researcher | `setup-agents/researcher.md` |
| 1 | Architect | `setup-agents/architect-setup.md` |
| 2 | Scaffold Planner | `setup-agents/scaffold-planner.md` |
| 3 | Dependency Auditor | `setup-agents/dependency-auditor.md` |
| 4 | Scaffold Executor | `setup-agents/scaffold-executor.md` |
| 5 | Scaffold Verifier | `setup-agents/scaffold-verifier.md` |
| 6 | Documentation | `setup-agents/documentation.md` |

### Workflow Summary

```
Research    → "What versions are CURRENT?"
                  ↓
Architect   → "What technology choices?"
                  ↓
Plan        → "What's the project structure?"
                  ↓
Audit       → "Are ALL versions correct?" ← CRITICAL GATE
                  ↓
Execute     → "Create all files"
                  ↓
Verify      → "Does it actually work?"
                  ↓
Document    → "CLAUDE.md + README + ADRs"
                  ↓
            Ready for feature development!
```

### After Setup

Once your scaffold is verified, use `/orchestrate` for feature development.

For full details, see:
- `.claude/skills/orchestration/setup/SETUP.md`
- `.claude/skills/orchestration/setup/setup-workflow.md`
- `.claude/skills/orchestration/setup/setup-agents/`
