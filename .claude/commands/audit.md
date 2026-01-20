# Audit Command

Security audit for the specified code or project.

$ARGUMENTS

## Instructions

1. **Determine audit scope**:
   - If a path is provided, audit that file/directory
   - If no path, audit the entire project

2. **Check for security issues**:

   ### Authentication & Authorization
   - [ ] Passwords properly hashed (bcrypt, argon2)
   - [ ] Sessions/tokens have expiration
   - [ ] Authorization checked on all protected routes
   - [ ] No hardcoded credentials

   ### Input Validation
   - [ ] All user input validated server-side
   - [ ] SQL queries parameterized
   - [ ] HTML output escaped (XSS prevention)
   - [ ] File uploads validated

   ### Data Protection
   - [ ] Sensitive data encrypted at rest
   - [ ] HTTPS enforced
   - [ ] Cookies are httpOnly and secure
   - [ ] No secrets in code or logs

   ### Dependencies
   - [ ] No known vulnerable dependencies
   - [ ] Dependencies up to date

3. **Report findings**:

```markdown
## Security Audit Report

### Critical Issues
1. **[Issue]** (file:line)
   - Risk: [What could happen]
   - Fix: [How to fix]

### Warnings
1. **[Issue]** (file:line)
   - Risk: [What could happen]
   - Fix: [How to fix]

### Passed Checks
- [x] [Check that passed]

### Recommendations
- [Additional security improvements]
```

## Guidelines

- Prioritize by severity
- Provide actionable fixes
- Check OWASP Top 10
- Run `npm audit` or equivalent
