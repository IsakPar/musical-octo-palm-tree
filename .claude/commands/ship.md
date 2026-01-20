# Ship Command

Prepare code for deployment.

$ARGUMENTS

## Instructions

1. **Run pre-ship checks**:

   ```bash
   # Run tests
   npm test  # or equivalent

   # Run linter
   npm run lint  # or equivalent

   # Run type check (if TypeScript)
   npm run typecheck

   # Build
   npm run build
   ```

2. **Review changes**:
   ```bash
   git status
   git diff
   ```

3. **Create commit** (if changes not committed):
   - Write descriptive commit message
   - Follow conventional commits if used

4. **Create PR** (if requested):
   - Title summarizing changes
   - Description with context
   - Link related issues

5. **Report status**:

```markdown
## Ship Checklist

### Checks
- [ ] Tests passing
- [ ] Lint passing
- [ ] Types passing
- [ ] Build successful

### Changes
- [Summary of what's being shipped]

### Ready to Ship
[Yes/No - with any blockers]
```

## Guidelines

- Don't ship with failing tests
- Review diff before committing
- Write clear commit messages
- Tag releases appropriately
