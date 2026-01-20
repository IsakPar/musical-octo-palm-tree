# Optimize Command

Identify and fix performance issues.

$ARGUMENTS

## Instructions

1. **Determine optimization scope**:
   - If a path is provided, focus on that file/function
   - If no path, identify performance hotspots

2. **Look for performance issues**:

   ### Database
   - [ ] N+1 queries
   - [ ] Missing indexes
   - [ ] Unbounded queries (no LIMIT)
   - [ ] Loading more data than needed

   ### Code
   - [ ] Expensive operations in loops
   - [ ] Unnecessary allocations
   - [ ] Blocking operations in async code
   - [ ] Missing caching opportunities

   ### Frontend
   - [ ] Large bundle sizes
   - [ ] Excessive re-renders
   - [ ] Unoptimized images
   - [ ] Missing lazy loading

3. **Suggest optimizations**:

```markdown
## Performance Analysis

### Issues Found
1. **[Issue type]** (file:line)
   - Impact: [How it affects performance]
   - Fix: [How to optimize]
   - Expected improvement: [Estimate]

### Quick Wins
- [Easy optimizations with high impact]

### Requires Profiling
- [Issues that need measurement before fixing]
```

## Guidelines

- Measure before optimizing
- Focus on hotspots, not micro-optimizations
- Consider trade-offs (complexity vs speed)
- Test after optimizing
