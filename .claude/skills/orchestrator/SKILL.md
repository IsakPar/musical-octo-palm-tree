---
name: orchestrator
description: Coordinate complex multi-step tasks. Use when a task spans multiple domains, requires many steps, or needs structured decomposition.
allowed-tools: Task, Read, Write, Grep, Glob, Bash
---

# Task Orchestrator

## When to Use

- Task spans multiple domains (frontend + backend + infra)
- Task requires 5+ distinct steps
- Task would benefit from parallel execution
- User asks to "build", "implement", or "create" something substantial

## Orchestration Process

```
1. AUDIT      → Understand scope, codebase, constraints
2. DECOMPOSE  → Break into discrete, parallel-safe tasks
3. COORDINATE → Handle dependencies, sequence work
4. SYNTHESIZE → Combine results, verify integration
5. REPORT     → Document what was built
```

## Phase 1: Audit

Before decomposing, understand the landscape:

### Quick Audit Template
```markdown
### Project Type
- Language(s)?
- Framework(s)?
- Monorepo or single package?

### Existing Patterns
- Code organization?
- Testing patterns?
- Error handling approach?

### Constraints
- CI/CD requirements?
- Performance requirements?
- Compatibility requirements?
```

## Phase 2: Decompose

Break into discrete units:

### Decomposition Principles
1. **Single Responsibility**: Each sub-task does ONE thing
2. **Clear Boundaries**: Minimize dependencies between tasks
3. **Parallel-Safe**: Identify which tasks can run simultaneously
4. **Testable**: Each task has verifiable completion criteria

### Task Breakdown Template
```markdown
#### Task: [Name]
- **Description**: What needs to be done
- **Depends On**: [other tasks or "none"]
- **Parallel Safe**: Yes/No
- **Completion Criteria**: How we know it's done
```

## Phase 3: Coordinate

### Parallel vs Sequential
```
PARALLEL SAFE (run simultaneously):
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Task 1  │  │ Task 2  │  │ Task 3  │
└─────────┘  └─────────┘  └─────────┘

SEQUENTIAL (wait for dependencies):
┌─────────┐
│ Task 1  │
└────┬────┘
     ↓
┌─────────┐
│ Task 2  │
└────┬────┘
     ↓
┌─────────┐
│ Task 3  │
└─────────┘
```

### Progress Tracking
```markdown
| Task | Status | Notes |
|------|--------|-------|
| 1. Schema | ✅ Done | Created migration |
| 2. API | 🔄 In Progress | 3/4 endpoints |
| 3. UI | ⏳ Waiting | Blocked on Task 2 |
```

## Phase 4: Synthesize

### Integration Checklist
- [ ] All files in correct locations
- [ ] No naming conflicts
- [ ] Imports/exports consistent
- [ ] Types compatible
- [ ] Tests pass

## Phase 5: Report

### Final Report Template
```markdown
# Orchestration Report: [Task Name]

## Summary
[1-2 sentence overview]

## Files Created
| File | Purpose |
|------|---------|
| `path/to/file` | Description |

## Files Modified
| File | Changes |
|------|---------|
| `path/to/file` | What changed |

## Key Decisions
- Decision 1: [Why this approach]

## How to Verify
\`\`\`bash
npm test
npm run dev
# Visit http://localhost:3000/...
\`\`\`

## Follow-Up Tasks
1. [Task not in scope but should be done later]
```
