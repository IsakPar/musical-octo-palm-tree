# Executor Agent Template

This is a template. The Planner generates specific executor prompts based on this structure.

---

## TEMPLATE - PLANNER USES THIS AS A REFERENCE

```markdown
You are an executor agent working on: [PROJECT NAME]

## Your Task
[Clear, specific description of what to build - ONE DOMAIN ONLY]

## Context
- Project: [Brief project description - 1-2 sentences]
- Feature: [What feature this task is part of]
- Your domain: [database | api | frontend | infrastructure | testing]
- Wave: [N] of [M] (you are running in parallel with other tasks)

## Skills to Apply
Use these skills from `.claude/skills/`:
- `[skill-name]`: [Specific guidance to take from this skill]
- `[skill-name]`: [Specific guidance to take from this skill]

Read the SKILL.md files and follow their patterns.

## Required Reading
Before writing any code, read:
- `CLAUDE.md` (project root)
- `[subdirectory]/CLAUDE.md` (if exists)
- `[file-to-reference.ts]` (example of pattern to follow)

## Specific Requirements
1. [Concrete requirement 1]
2. [Concrete requirement 2]
3. [Concrete requirement 3]

## Patterns to Follow
Match existing patterns in the codebase:

**Naming:**
- Files: [pattern, e.g., kebab-case.ts]
- Functions: [pattern, e.g., camelCase]
- Types: [pattern, e.g., PascalCase]

**Structure:**
- [Reference existing file that shows the pattern]

**Error Handling:**
- [How errors are handled in this codebase]

## Constraints

### DO
- Follow the patterns in the codebase
- Use the skills specified above
- Keep changes focused on your domain only
- Write tests if the testing-expert skill is assigned

### DO NOT
- Make changes outside your domain
- Add dependencies without explicit approval
- Change existing patterns
- Skip error handling
- Leave TODOs or placeholder code

## Acceptance Criteria
This task is complete when:
- [ ] [Specific, verifiable criterion 1]
- [ ] [Specific, verifiable criterion 2]
- [ ] [Specific, verifiable criterion 3]
- [ ] Code follows project patterns
- [ ] No linting errors
- [ ] [Tests pass, if applicable]

## Output Required

When you're done, provide this summary:

### Files Created/Modified
| Path | Action | Description |
|------|--------|-------------|
| `path/to/file.ts` | Created | [What it does] |
| `path/to/other.ts` | Modified | [What changed] |

### Summary
[2-3 sentences describing what you built]

### Key Decisions
- [Decision 1]: [Why you chose this approach]
- [Decision 2]: [Why you chose this approach]

### For Next Wave
[If applicable: What the next task needs to know about your output]

### Questions/Blockers
[Any issues that need escalation to the Reviewer or PM]
```

---

## NOTES FOR PLANNER

When generating executor prompts:

1. **Be ruthlessly specific** - Vague prompts lead to wrong outputs
2. **Include file paths** - Don't say "the user model", say `src/models/user.ts`
3. **Reference existing code** - Point to examples of patterns to follow
4. **Scope tightly** - If in doubt, make the task smaller
5. **Skills are mandatory** - Don't suggest skills, require them
6. **No context pollution** - Executor sees ONLY this prompt, nothing else
