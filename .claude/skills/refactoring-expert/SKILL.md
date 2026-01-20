---
name: refactoring-expert
description: Clean up and improve code structure. Use when asked to refactor, clean up, reduce technical debt, or fix code smells.
allowed-tools: Read, Write, Grep, Glob
---

# Refactoring Expert

## Refactoring Principles

### Prerequisites
1. Have tests before refactoring
2. Make small, incremental changes
3. Verify tests pass after each change
4. Commit frequently

### Goals
- Improve readability
- Reduce complexity
- Remove duplication
- Clarify intent

## Code Smells to Fix

### Long Functions
Split into smaller, focused functions:
```javascript
// Before: 50+ line function
function processOrder(order) {
  // validate...
  // calculate totals...
  // apply discounts...
  // update inventory...
  // send notification...
}

// After: Composed functions
function processOrder(order) {
  validateOrder(order);
  const total = calculateTotal(order);
  const finalPrice = applyDiscounts(total, order.discounts);
  updateInventory(order.items);
  notifyCustomer(order, finalPrice);
}
```

### Deep Nesting
Use early returns and guard clauses:
```javascript
// Before: Deep nesting
function process(data) {
  if (data) {
    if (data.isValid) {
      if (data.items.length > 0) {
        // actual logic
      }
    }
  }
}

// After: Guard clauses
function process(data) {
  if (!data) return;
  if (!data.isValid) return;
  if (data.items.length === 0) return;
  // actual logic
}
```

### God Classes
Split by responsibility:
```javascript
// Before: One class doing everything
class UserManager {
  createUser() {}
  deleteUser() {}
  sendEmail() {}
  generateReport() {}
  calculateMetrics() {}
}

// After: Single responsibility
class UserService { createUser() {} deleteUser() {} }
class EmailService { sendEmail() {} }
class ReportService { generateReport() {} }
class MetricsService { calculateMetrics() {} }
```

### Magic Numbers
Extract to named constants:
```javascript
// Before
if (statusCode === 3) {}
setTimeout(fn, 86400000);

// After
const STATUS_APPROVED = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
if (statusCode === STATUS_APPROVED) {}
setTimeout(fn, ONE_DAY_MS);
```

### Duplicate Code
Extract shared logic:
```javascript
// Before: Same validation in multiple places
function createUser(data) {
  if (!data.email || !data.email.includes('@')) throw new Error();
  // ...
}
function updateUser(data) {
  if (!data.email || !data.email.includes('@')) throw new Error();
  // ...
}

// After: Extracted validation
function validateEmail(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email');
  }
}
function createUser(data) {
  validateEmail(data.email);
  // ...
}
```

## Refactoring Techniques

### Extract Function
Move code block into a named function

### Inline Function
Replace function call with function body (when too granular)

### Rename
Make names clearer and more descriptive

### Move
Relocate code to where it belongs

### Extract Class
Split large class into smaller, focused classes

### Replace Conditional with Polymorphism
Use inheritance/composition instead of switch statements

## Refactoring Checklist

- [ ] Tests exist and pass
- [ ] Changes are incremental
- [ ] Names are clear and descriptive
- [ ] Functions are small and focused
- [ ] No code duplication
- [ ] No deep nesting
- [ ] No magic numbers/strings
- [ ] Tests still pass after changes
