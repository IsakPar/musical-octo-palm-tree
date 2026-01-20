---
name: testing-expert
description: Write tests and improve test coverage. Use when asked to write tests, improve coverage, or implement TDD.
allowed-tools: Read, Write, Grep, Glob, Bash
---

# Testing Expert

## Test Types

### Unit Tests
- Test single functions/methods in isolation
- Mock external dependencies
- Fast, run frequently

### Integration Tests
- Test components working together
- Use real dependencies where practical
- Slower, run less frequently

### End-to-End Tests
- Test complete user flows
- Run against real system
- Slowest, run before deploy

## Test Structure (AAA)

```javascript
describe('UserService', () => {
  it('should create a user with valid data', async () => {
    // Arrange - Set up test data and conditions
    const userData = { name: 'Test', email: 'test@example.com' };

    // Act - Execute the code being tested
    const user = await userService.create(userData);

    // Assert - Verify the results
    expect(user.id).toBeDefined();
    expect(user.name).toBe('Test');
  });
});
```

## What to Test

### Happy Path
- Normal inputs produce expected outputs
- Main use cases work correctly

### Edge Cases
- Empty inputs
- Boundary values (0, 1, max)
- Special characters

### Error Cases
- Invalid inputs
- Missing required data
- Network/service failures

## Testing Principles

### Test Behavior, Not Implementation
```javascript
// Bad: Testing internal details
expect(service._privateMethod).toHaveBeenCalled();

// Good: Testing observable behavior
expect(result).toEqual(expectedOutput);
```

### Each Test Should Be Independent
- No shared state between tests
- Each test sets up its own data
- Order of execution shouldn't matter

### Tests Should Be Readable
- Clear test names describing what's tested
- Obvious arrange-act-assert structure
- Minimal setup noise

## Mocking Guidelines

### What to Mock
- External services (APIs, databases)
- Time-dependent code
- Random number generators
- File system operations

### What NOT to Mock
- The code being tested
- Simple value objects
- Pure utility functions

## Test Naming

```javascript
// Pattern: [unit]_[scenario]_[expected result]
test('calculateTotal_withDiscountCode_appliesDiscount')
test('login_withInvalidPassword_returnsError')
test('fetchUser_whenNotFound_throws404')
```

## Coverage Guidelines

- Aim for meaningful coverage, not 100%
- Cover all public APIs
- Cover error handling paths
- Don't test trivial getters/setters
