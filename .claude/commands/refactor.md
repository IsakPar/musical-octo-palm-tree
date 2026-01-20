# Refactor Command

Improve code structure without changing behavior.

$ARGUMENTS

## Instructions

1. **Identify what to refactor**:
   - If a path is provided, focus on that file/function
   - If no path, identify the most problematic code

2. **Look for code smells**:
   - Long functions (> 20 lines)
   - Deep nesting (> 3 levels)
   - Duplicate code
   - God classes/objects
   - Magic numbers/strings
   - Poor naming

3. **Apply refactoring techniques**:
   - Extract function
   - Rename for clarity
   - Replace conditionals with polymorphism
   - Extract class/module
   - Inline unnecessary abstractions

4. **Verify behavior unchanged**:
   - Run existing tests
   - Add tests if missing
   - Check edge cases still work

## Output Format

```markdown
## Refactoring Summary

### Changes Made
1. **[Change type]**: [Description]
   - Before: [What it was]
   - After: [What it became]
   - Why: [Reasoning]

### Tests
- [ ] Existing tests pass
- [ ] New tests added for [what]

### Follow-up Suggestions
- [Additional improvements for later]
```

## Guidelines

- Make small, incremental changes
- Commit after each refactoring step
- Don't refactor and add features at once
- Ensure tests exist before major refactoring
