# Setup Orchestration Workflow

Quick reference for running the greenfield setup workflow.

## The 7 Phases

```
┌──────────┐   ┌─────────────┐   ┌─────────────┐   ┌───────────┐
│ RESEARCH │ → │  ARCHITECT  │ → │  SCAFFOLD   │ → │DEPENDENCY │
│          │   │   (Setup)   │   │   PLANNER   │   │  AUDITOR  │
└──────────┘   └─────────────┘   └─────────────┘   └───────────┘
   Versions      Decisions        Structure        Verify pkgs
                                                        ↓
┌──────────────┐   ┌──────────────┐   ┌───────────────────┐
│DOCUMENTATION │ ← │   SCAFFOLD   │ ← │    SCAFFOLD       │
│              │   │   VERIFIER   │   │    EXECUTOR       │
└──────────────┘   └──────────────┘   └───────────────────┘
   CLAUDE.md        Does it work?       Create files
```

## Quick Start

### Phase 0: Research

**Purpose**: Get CURRENT versions, not AI training data

1. Open new chat
2. Paste `setup-agents/researcher.md`
3. Tell it what technologies you're considering
4. Get: **Version manifest + deprecated patterns list**

```
Input: "I want to build with Next.js, Tailwind, Prisma, PostgreSQL"
Output: Current versions, breaking changes, patterns to avoid
```

### Phase 1: Architect (Setup Mode)

**Purpose**: Make foundational technology and architecture decisions

1. Open new chat
2. Paste `setup-agents/architect-setup.md`
3. Give it: Research report + what you want to build
4. Get: **Specification + ADRs**

```
Input: Research report + "Building a SaaS dashboard"
Output: Tech stack decisions, architecture, ADRs
```

### Phase 2: Scaffold Planner

**Purpose**: Design exact project structure

1. Open new chat
2. Paste `setup-agents/scaffold-planner.md`
3. Give it: Architecture spec + research report
4. Get: **File tree + all config contents**

```
Input: Architecture spec
Output: Exact folder structure, package.json, tsconfig, etc.
```

### Phase 3: Dependency Auditor

**Purpose**: Verify EVERY package version (critical gate!)

1. Open new chat
2. Paste `setup-agents/dependency-auditor.md`
3. Give it: Scaffold spec (with intended versions)
4. Get: **Verified package.json + compatibility report**

```
Input: Intended dependencies from scaffold planner
Output: VERIFIED package.json with correct versions
```

### Phase 4: Scaffold Executor

**Purpose**: Create all the files

1. Open new chat
2. Paste `setup-agents/scaffold-executor.md`
3. Give it: Scaffold spec + VERIFIED package.json
4. Get: **Created project files**

```
Input: Scaffold spec + verified package.json
Output: All files created
```

### Phase 5: Scaffold Verifier

**Purpose**: Confirm everything actually works

1. Open new chat
2. Paste `setup-agents/scaffold-verifier.md`
3. Let it run: install, build, lint, test, dev server
4. Get: **Verification report (green/red)**

```
Checks: npm install → typecheck → lint → build → dev server → tests
Output: All green or specific fixes needed
```

### Phase 6: Documentation

**Purpose**: Capture decisions for future

1. Open new chat
2. Paste `setup-agents/documentation.md`
3. Give it: All previous outputs
4. Get: **CLAUDE.md, README.md, ADRs**

```
Input: Research + Architecture + Scaffold + Verification
Output: Project documentation
```

## Artifacts Flow

```
Research      →  Version manifest + deprecated patterns
                      ↓
Architect     →  Tech stack + ADRs
                      ↓
Scaffold Plan →  File tree + config contents
                      ↓
Dep Auditor   →  VERIFIED package.json
                      ↓
Executor      →  Created files
                      ↓
Verifier      →  ✅ Works or ❌ Fixes needed
                      ↓
Documentation →  CLAUDE.md + README + ADRs
                      ↓
              Ready for feature development!
```

## Why This Order?

```
1. RESEARCH first because AI training data is outdated
   → Prevents: wrangler@3.5.2 when 4.5.2 exists

2. ARCHITECT after research because decisions need current info
   → Prevents: Choosing deprecated patterns

3. SCAFFOLD PLANNER after architect because structure depends on decisions
   → Prevents: Wrong folder structure for chosen framework

4. DEPENDENCY AUDITOR before executor because versions must be verified
   → Prevents: Installing outdated packages

5. VERIFIER after executor because files must exist to test
   → Prevents: "Works on my machine" issues

6. DOCUMENTATION last because it summarizes everything
   → Prevents: Missing documentation
```

## Common Version Mistakes Prevented

| AI Default | Research Finds | Fix |
|------------|----------------|-----|
| Next.js 13 | Next.js 14.2.x | Use 14.2.x |
| wrangler 3.x | wrangler 4.x | Use 4.x |
| ESLint 8 flat config | Still need old config | Use appropriate config |
| Tailwind 3.x | Tailwind 4 beta | Stay on 3.x stable |
| create-react-app | Deprecated | Use Vite or Next.js |

## Agent Reference

| Phase | Agent | File |
|-------|-------|------|
| 0 | Researcher | `setup-agents/researcher.md` |
| 1 | Architect (Setup) | `setup-agents/architect-setup.md` |
| 2 | Scaffold Planner | `setup-agents/scaffold-planner.md` |
| 3 | Dependency Auditor | `setup-agents/dependency-auditor.md` |
| 4 | Scaffold Executor | `setup-agents/scaffold-executor.md` |
| 5 | Scaffold Verifier | `setup-agents/scaffold-verifier.md` |
| 6 | Documentation | `setup-agents/documentation.md` |

## Checklist

### Before Starting
- [ ] Know what you want to build
- [ ] Know your deployment target
- [ ] Know your team's experience level
- [ ] Have time for full workflow

### Phase 0-1 (Research + Decisions)
- [ ] Version manifest saved
- [ ] Deprecated patterns noted
- [ ] Architecture spec saved
- [ ] ADRs created

### Phase 2-3 (Planning + Verification)
- [ ] Scaffold spec saved
- [ ] All dependencies listed
- [ ] Dependency audit complete
- [ ] Verified package.json saved

### Phase 4-5 (Creation + Verification)
- [ ] All files created
- [ ] npm install passes
- [ ] Build passes
- [ ] Dev server starts
- [ ] All checks green

### Phase 6 (Documentation)
- [ ] CLAUDE.md created
- [ ] README.md created
- [ ] ADRs documented

### After Setup
- [ ] Ready for feature orchestration workflow
- [ ] Can use `/orchestrate` for features

## Tips

### For Speed
- Research and Architect can be same session if needed
- Scaffold Planner and Dependency Auditor can overlap
- But NEVER skip Dependency Auditor

### For Quality
- Let Researcher actually search, don't let it guess
- Verify every version in Dependency Auditor
- Don't skip Scaffold Verifier

### For Complex Stacks
- Break into layers (backend first, then frontend)
- Verify each layer before combining
- Check cross-layer compatibility

## After Setup Complete

Your project is now ready for the feature orchestration workflow:

```
Setup Orchestration (this workflow)
         ↓
    Working scaffold
         ↓
Feature Orchestration (../workflow.md)
         ↓
    Working features
```

Use `/orchestrate` to build features on top of your verified scaffold.
