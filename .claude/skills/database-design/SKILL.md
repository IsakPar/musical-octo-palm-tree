---
name: database-design
description: Design database schemas and write efficient queries. Use when working on database design, schema changes, or query optimization.
allowed-tools: Read, Write, Grep, Glob
---

# Database Design

## Schema Design Principles

### Normalization
- 1NF: No repeating groups, atomic values
- 2NF: No partial dependencies
- 3NF: No transitive dependencies
- Balance normalization with query performance

### When to Denormalize
- Read-heavy workloads
- Frequently joined data
- Performance critical paths
- After measuring, not before

## Common Patterns

### Users and Auth
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### One-to-Many
```sql
-- One user has many posts
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  content TEXT,
  INDEX idx_posts_user_id (user_id)
);
```

### Many-to-Many
```sql
-- Users have many roles, roles have many users
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
```

### Soft Deletes
```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  -- ... other columns
  deleted_at TIMESTAMPTZ NULL
);

-- Query only active records
SELECT * FROM posts WHERE deleted_at IS NULL;
```

## Indexing

### When to Add Indexes
- Columns in WHERE clauses
- Columns in JOIN conditions
- Columns in ORDER BY
- Foreign keys

### Index Types
```sql
-- B-tree (default, most common)
CREATE INDEX idx_users_email ON users(email);

-- Unique
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Composite (order matters)
CREATE INDEX idx_posts_user_date ON posts(user_id, created_at);

-- Partial (for filtered queries)
CREATE INDEX idx_active_users ON users(email) WHERE deleted_at IS NULL;
```

### Don't Over-Index
- Each index slows writes
- Index columns you actually query
- Monitor slow queries, add indexes as needed

## Query Patterns

### Avoid N+1
```sql
-- Bad: N+1 queries
SELECT * FROM users;
-- Then for each user:
SELECT * FROM posts WHERE user_id = ?;

-- Good: Single query with join
SELECT u.*, p.*
FROM users u
LEFT JOIN posts p ON u.id = p.user_id;
```

### Pagination
```sql
-- Offset pagination (simple but slow for large offsets)
SELECT * FROM posts ORDER BY created_at LIMIT 20 OFFSET 100;

-- Cursor pagination (better for large datasets)
SELECT * FROM posts
WHERE created_at < ?
ORDER BY created_at DESC
LIMIT 20;
```

## Questions to Ask

Before designing:
- What are the main query patterns?
- What's the expected data volume?
- Read-heavy or write-heavy?
- What are the consistency requirements?

## Database Checklist

- [ ] Primary keys on all tables
- [ ] Foreign keys with proper ON DELETE
- [ ] Indexes on frequently queried columns
- [ ] Timestamps (created_at, updated_at)
- [ ] Data types are appropriate
- [ ] Constraints enforce data integrity
- [ ] Migration files are reversible
