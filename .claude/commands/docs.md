# Docs Command

Generate documentation for the specified code.

$ARGUMENTS

## Instructions

1. **Determine documentation type**:
   - If a file is specified, document that file/function
   - If no argument, create or update README.md

2. **For function/class documentation**:
   - Add JSDoc, docstrings, or language-appropriate comments
   - Document parameters, return values, and exceptions
   - Include usage examples

3. **For README documentation**:
   ```markdown
   # Project Name

   Brief description.

   ## Quick Start
   [Installation and basic usage]

   ## Features
   [Key features list]

   ## Usage
   [Code examples]

   ## API Reference
   [If applicable]

   ## Development
   [Setup for contributors]

   ## License
   [License info]
   ```

## Documentation Style

### Function Documentation
```javascript
/**
 * Creates a new user with the given data.
 *
 * @param {Object} data - User data
 * @param {string} data.name - User's name
 * @param {string} data.email - User's email
 * @returns {Promise<User>} The created user
 * @throws {ValidationError} If data is invalid
 * @example
 * const user = await createUser({ name: 'John', email: 'john@example.com' });
 */
```

## Guidelines

- Write for someone new to the project
- Include working examples
- Keep it concise but complete
- Update docs when code changes
