---
name: documentation-writer
description: Write clear documentation and READMEs. Use when asked to document code, write READMEs, or create API docs.
allowed-tools: Read, Write, Grep, Glob
---

# Documentation Writer

## README Template

```markdown
# Project Name

Brief description of what this project does.

## Quick Start

\`\`\`bash
# Install
npm install

# Run
npm start
\`\`\`

## Features

- Feature 1
- Feature 2
- Feature 3

## Usage

\`\`\`javascript
import { thing } from 'project';

const result = thing.doSomething();
\`\`\`

## API Reference

### `functionName(param1, param2)`

Description of what it does.

**Parameters:**
- `param1` (type): Description
- `param2` (type): Description

**Returns:** Description of return value

**Example:**
\`\`\`javascript
const result = functionName('value', 123);
\`\`\`

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| debug | boolean | false | Enable debug mode |

## Development

\`\`\`bash
# Run tests
npm test

# Build
npm run build
\`\`\`

## License

MIT
```

## Documentation Principles

### Write for the Reader
- Assume they're new to the project
- Explain the "why" not just the "what"
- Use examples liberally

### Keep it Updated
- Documentation that's wrong is worse than none
- Update docs when you change code
- Review docs in PRs

### Structure for Scanning
- Use headings and lists
- Put important info first
- Keep paragraphs short

## API Documentation Format

```javascript
/**
 * Creates a new user with the given data.
 *
 * @param {Object} userData - The user data
 * @param {string} userData.email - User's email address
 * @param {string} userData.name - User's display name
 * @param {string} [userData.role='user'] - User's role (optional)
 * @returns {Promise<User>} The created user object
 * @throws {ValidationError} If email is invalid
 * @example
 * const user = await createUser({
 *   email: 'test@example.com',
 *   name: 'Test User'
 * });
 */
async function createUser(userData) {
  // ...
}
```

## When to Document

### Always Document
- Public APIs
- Complex algorithms
- Non-obvious decisions
- Configuration options
- Setup/deployment steps

### Don't Over-Document
- Self-explanatory code
- Obvious getters/setters
- Standard patterns
- Things that will change frequently

## Comment Guidelines

```javascript
// BAD: Explains what (obvious from code)
// Increment counter by 1
counter++;

// GOOD: Explains why (not obvious)
// Rate limit exceeded, back off exponentially
counter++;

// GOOD: Warns about gotchas
// Must be called before init() - see issue #123
setupConfig();
```
