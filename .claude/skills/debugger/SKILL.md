---
name: debugger
description: Investigate and fix bugs systematically. Use when something is broken, not working, throwing errors, or needs debugging.
allowed-tools: Read, Grep, Glob, Bash
---

# Debugger

## Debugging Process

### 1. Reproduce
- Get exact steps to reproduce
- Identify inputs that trigger the bug
- Note expected vs actual behavior

### 2. Isolate
- Narrow down to smallest failing case
- Identify which component is failing
- Check recent changes that might have caused it

### 3. Understand
- Read error messages carefully
- Check stack traces
- Review relevant code paths

### 4. Hypothesize
- Form theory about root cause
- Consider multiple possibilities
- Rank by likelihood

### 5. Test
- Add logging/debugging output
- Test hypothesis with minimal change
- Verify fix doesn't break other things

### 6. Fix
- Make minimal necessary change
- Add test to prevent regression
- Document if non-obvious

## Common Bug Patterns

### Off-by-One Errors
```javascript
// Bug: Array index out of bounds
for (let i = 0; i <= arr.length; i++) // Should be < not <=
```

### Null/Undefined
```javascript
// Bug: Accessing property of undefined
user.profile.name // user.profile might be undefined
user?.profile?.name // Safe
```

### Race Conditions
```javascript
// Bug: State read before update completes
setCount(count + 1);
setCount(count + 1); // Both read same count
setCount(c => c + 1); // Correct
```

### Async Errors
```javascript
// Bug: Missing await
const data = fetchData(); // Returns Promise, not data
const data = await fetchData(); // Correct
```

### Type Coercion
```javascript
// Bug: String concatenation instead of addition
"5" + 3 // "53"
parseInt("5") + 3 // 8
```

## Debugging Questions

1. What changed recently?
2. Does it fail consistently or intermittently?
3. Does it fail in all environments?
4. What are the inputs when it fails?
5. Are there similar bugs in the issue tracker?

## Output Format

```markdown
## Bug Analysis

### Problem
[Description of the bug]

### Root Cause
[What's actually causing the issue]

### Fix
[Code changes needed]

### Verification
[How to confirm the fix works]

### Prevention
[Test or check to prevent regression]
```
