---
name: performance-optimizer
description: Optimize code performance and identify bottlenecks. Use when something is slow, needs optimization, or has performance issues.
allowed-tools: Read, Grep, Glob, Bash
---

# Performance Optimizer

## Performance Process

### 1. Measure First
- Don't optimize without profiling data
- Identify actual bottlenecks
- Establish baseline metrics

### 2. Find the Hotspot
- 80% of time spent in 20% of code
- Focus on the critical path
- Profile, don't guess

### 3. Optimize
- Make targeted changes
- Verify improvement with measurements
- Check for regressions

## Common Performance Issues

### N+1 Queries
```javascript
// Bad: N+1 queries
const users = await db.query('SELECT * FROM users');
for (const user of users) {
  const posts = await db.query(`SELECT * FROM posts WHERE user_id = ${user.id}`);
}

// Good: Single query with join
const usersWithPosts = await db.query(`
  SELECT u.*, p.* FROM users u
  LEFT JOIN posts p ON u.id = p.user_id
`);
```

### Loading Everything Into Memory
```javascript
// Bad: Load all records
const allRecords = await db.query('SELECT * FROM huge_table');
return allRecords.filter(r => r.active);

// Good: Filter in database
const activeRecords = await db.query(
  'SELECT * FROM huge_table WHERE active = true LIMIT 100'
);
```

### Blocking the Event Loop
```javascript
// Bad: Synchronous heavy computation
function processLargeArray(arr) {
  return arr.map(heavyComputation);
}

// Good: Batch processing
async function processLargeArray(arr) {
  const results = [];
  for (let i = 0; i < arr.length; i += 100) {
    const batch = arr.slice(i, i + 100);
    results.push(...batch.map(heavyComputation));
    await new Promise(resolve => setImmediate(resolve));
  }
  return results;
}
```

### Missing Indexes
```sql
-- Check for missing indexes
EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 123;

-- Add index if full table scan
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
```

### Excessive Re-renders (React)
```jsx
// Bad: Creates new function every render
<Button onClick={() => handleClick(id)} />

// Good: Memoized callback
const handleButtonClick = useCallback(() => handleClick(id), [id]);
<Button onClick={handleButtonClick} />
```

## Optimization Techniques

### Caching
- Cache expensive computations
- Cache database queries
- Cache API responses
- Invalidate appropriately

### Lazy Loading
- Load resources on demand
- Code splitting for large bundles
- Virtual scrolling for long lists

### Batching
- Batch database writes
- Batch API requests
- Debounce user input

### Pagination
- Never return unbounded results
- Use cursor-based pagination for large datasets
- Implement infinite scroll correctly

## Performance Checklist

- [ ] Database queries have appropriate indexes
- [ ] No N+1 query patterns
- [ ] Large datasets are paginated
- [ ] Expensive operations are cached
- [ ] Images are optimized and lazy-loaded
- [ ] JavaScript bundle is code-split
- [ ] API responses use compression
