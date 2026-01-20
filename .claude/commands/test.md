# Test Command

Generate tests for the specified code.

$ARGUMENTS

## Instructions

1. **Analyze the code** to understand:
   - What functions/methods need testing
   - What edge cases exist
   - What dependencies need mocking

2. **Write tests** that cover:
   - Happy path (normal inputs)
   - Edge cases (empty, null, boundary values)
   - Error cases (invalid inputs, failures)

3. **Use the project's testing framework**:
   - JavaScript/TypeScript: Jest, Vitest, or existing framework
   - Python: pytest
   - Go: built-in testing package
   - Rust: built-in test module

4. **Follow test structure**:
   ```
   // Arrange - Set up test data
   // Act - Execute the code
   // Assert - Verify results
   ```

## Test Patterns

### Unit Test Example
```javascript
describe('calculateTotal', () => {
  it('should sum items correctly', () => {
    const items = [{ price: 10 }, { price: 20 }];
    expect(calculateTotal(items)).toBe(30);
  });

  it('should return 0 for empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });

  it('should handle null items', () => {
    expect(() => calculateTotal(null)).toThrow();
  });
});
```

## Guidelines

- Test behavior, not implementation
- Each test should be independent
- Use descriptive test names
- Mock external dependencies
- Keep tests readable
