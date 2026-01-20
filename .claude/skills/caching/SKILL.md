---
name: caching
description: Implement caching strategies for performance. Use when adding caching, optimizing data access, or working with Redis/Memcached.
allowed-tools: Read, Write, Grep, Glob
---

# Caching

## When to Cache

### Good Candidates
- Expensive computations
- Frequently read, rarely changed data
- External API responses
- Database query results

### Bad Candidates
- Rapidly changing data
- User-specific data that varies widely
- Small, fast operations
- Data requiring strong consistency

## Caching Strategies

### Cache-Aside (Lazy Loading)
```javascript
async function getUser(id) {
  // Check cache first
  const cached = await cache.get(`user:${id}`);
  if (cached) return JSON.parse(cached);

  // Cache miss: fetch from database
  const user = await db.users.findById(id);

  // Store in cache
  await cache.set(`user:${id}`, JSON.stringify(user), 'EX', 3600);

  return user;
}
```

### Write-Through
```javascript
async function updateUser(id, data) {
  // Update database
  const user = await db.users.update(id, data);

  // Update cache immediately
  await cache.set(`user:${id}`, JSON.stringify(user), 'EX', 3600);

  return user;
}
```

### Write-Behind (Write-Back)
```javascript
async function updateUser(id, data) {
  // Update cache immediately
  await cache.set(`user:${id}`, JSON.stringify(data), 'EX', 3600);

  // Queue database write (async)
  await queue.add('db-write', { table: 'users', id, data });

  return data;
}
```

## Cache Invalidation

### Time-Based (TTL)
```javascript
// Set expiration
await cache.set('key', value, 'EX', 3600); // 1 hour

// For volatile data
await cache.set('key', value, 'EX', 60); // 1 minute
```

### Event-Based
```javascript
async function updateUser(id, data) {
  await db.users.update(id, data);

  // Invalidate related caches
  await cache.del(`user:${id}`);
  await cache.del(`user:${id}:posts`);
  await cache.del('users:list');
}
```

### Version-Based
```javascript
// Include version in key
const version = await cache.get('users:version');
const cacheKey = `user:${id}:v${version}`;

// Increment version to invalidate all
await cache.incr('users:version');
```

## Cache Patterns

### Memoization
```javascript
const memoize = (fn, ttl = 60000) => {
  const cache = new Map();

  return async (...args) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && Date.now() < cached.expires) {
      return cached.value;
    }

    const result = await fn(...args);
    cache.set(key, { value: result, expires: Date.now() + ttl });
    return result;
  };
};

const getCachedUser = memoize(getUserFromDb, 60000);
```

### Request Deduplication
```javascript
const inFlight = new Map();

async function getUser(id) {
  // Return existing promise if request in flight
  if (inFlight.has(id)) {
    return inFlight.get(id);
  }

  const promise = fetchUser(id);
  inFlight.set(id, promise);

  try {
    return await promise;
  } finally {
    inFlight.delete(id);
  }
}
```

## Redis Patterns

### Basic Operations
```javascript
// String
await redis.set('key', 'value', 'EX', 3600);
const value = await redis.get('key');

// Hash (for objects)
await redis.hset('user:123', { name: 'John', email: 'john@example.com' });
const user = await redis.hgetall('user:123');

// List (for queues)
await redis.lpush('queue', 'item');
const item = await redis.rpop('queue');

// Set (for unique items)
await redis.sadd('tags', 'javascript', 'nodejs');
const tags = await redis.smembers('tags');
```

## Caching Checklist

- [ ] Cache has appropriate TTL
- [ ] Invalidation strategy defined
- [ ] Cache misses handled gracefully
- [ ] Monitoring for hit/miss ratio
- [ ] Fallback if cache unavailable
- [ ] No sensitive data cached inappropriately
