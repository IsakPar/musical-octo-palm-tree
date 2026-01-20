# Review Command

Review code for bugs, security, performance, and style issues.

$ARGUMENTS

## Instructions

1. **Determine scope**:
   - If a path is provided, review that file or directory
   - If no path, check for recent changes with `git diff` or ask what to review

2. **Analyze code** across these dimensions:
   - **Correctness**: Logic errors, edge cases, null handling
   - **Security**: Input validation, auth checks, data exposure
   - **Performance**: Complexity, N+1 queries, unnecessary allocations
   - **Maintainability**: Naming, abstraction, duplication
   - **Testing**: Coverage for new code paths

3. **Provide structured feedback**:

```markdown
## Code Review Summary

### Overview
[Brief description and overall impression]

### Critical Issues (must fix)
1. **[Issue]** (file:line)
   - Problem: [What's wrong]
   - Fix: [How to fix]

### Suggestions (should fix)
1. **[Suggestion]** (file:line)
   - Current: [What exists]
   - Better: [Improved version]

### Notes
- [Positive observations]

### Summary
- Critical: X issues
- Suggestions: Y items
- Recommendation: Approve / Request Changes
```

## Guidelines

- Be constructive, not critical
- Explain the "why" behind suggestions
- Acknowledge good patterns
- Prioritize feedback by importance
