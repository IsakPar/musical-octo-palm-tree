---
name: code-reviewer
description: Review code for bugs, security, performance, and style. Use when asked to review PRs, check code, give feedback, or analyze changes.
allowed-tools: Read, Grep, Glob
---

# Code Reviewer

## Review Dimensions

Evaluate code across five dimensions:

### 1. Correctness
- Logic errors and edge cases
- Off-by-one errors
- Null/undefined handling
- Race conditions in concurrent code
- Resource leaks

### 2. Security
- Input validation and sanitization
- Authentication and authorization
- Data exposure risks
- Injection vulnerabilities
- Secrets handling

### 3. Performance
- Algorithmic complexity (Big O)
- N+1 query patterns
- Unnecessary allocations
- Blocking operations in async contexts

### 4. Maintainability
- Clear, descriptive naming
- Appropriate abstraction level
- Single responsibility principle
- Code duplication

### 5. Testing
- Test coverage for new code paths
- Edge cases covered
- Tests are readable

## Feedback Levels

- **Critical** - Must fix. Security issues, bugs, data loss risks.
- **Suggestion** - Recommended. Better patterns, performance, readability.
- **Note** - Minor observation or praise.

## Language-Specific Checks

### Go
- Error handling without context wrapping
- Unchecked error returns
- Goroutine leaks

### Rust
- `.unwrap()` in production code
- Unnecessary `.clone()` calls
- `unsafe` without justification

### TypeScript
- `any` type usage
- Type assertions that could fail at runtime
- Async functions without error handling

### Python
- Mutable default arguments
- Bare `except:` clauses
- Missing context managers

## Output Format

```markdown
## Code Review Summary

### Overview
[Brief description and overall impression]

### Critical Issues
1. **[Issue]** (file:line)
   - Problem: [Description]
   - Fix: [Suggested solution]

### Suggestions
1. **[Suggestion]** (file:line)
   - Current: [What's there]
   - Better: [Improved version]

### Notes
- [Positive observations]

### Summary
- Critical: X issues
- Suggestions: Y items
- Recommendation: [Approve / Request Changes]
```

## Review Checklist

- [ ] No hardcoded secrets
- [ ] Error handling appropriate
- [ ] Input validation present
- [ ] No obvious performance issues
- [ ] Tests cover new functionality
- [ ] No dead/commented-out code
