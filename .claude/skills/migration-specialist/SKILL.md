---
name: migration-specialist
description: Handle migrations and version upgrades safely. Use when migrating databases, upgrading dependencies, or moving between frameworks.
allowed-tools: Read, Write, Grep, Glob, Bash
---

# Migration Specialist

## Migration Types

### Database Migrations
- Schema changes (add/modify/remove tables/columns)
- Data migrations (transform existing data)
- Index changes

### Dependency Upgrades
- Major version upgrades
- Security patches
- Framework migrations

### Code Migrations
- Language version upgrades
- API changes
- Framework migrations

## Database Migration Process

### 1. Plan
- Document all schema changes
- Identify data that needs transformation
- Plan rollback strategy

### 2. Write Migration
```javascript
// Migration file: 001_add_users_table.js
exports.up = async (db) => {
  await db.schema.createTable('users', (table) => {
    table.uuid('id').primary();
    table.string('email').notNullable().unique();
    table.string('name');
    table.timestamps(true, true);
  });
};

exports.down = async (db) => {
  await db.schema.dropTable('users');
};
```

### 3. Test
- Run on copy of production data
- Verify data integrity
- Test rollback

### 4. Deploy
- Run during low-traffic period
- Monitor for errors
- Have rollback ready

## Migration Safety Rules

### Always
- Write reversible migrations (up/down)
- Test on production-like data
- Back up before migrating
- Run in transaction when possible

### Never
- Delete columns/tables without deprecation period
- Run untested migrations on production
- Make breaking changes without coordination
- Mix schema and data migrations

## Dependency Upgrade Process

### 1. Assess
```bash
# Check outdated packages
npm outdated
# or
pip list --outdated
```

### 2. Review Changelogs
- Check for breaking changes
- Note deprecated features
- Identify required code changes

### 3. Update Incrementally
```bash
# Update one package at a time
npm install package@latest

# Test after each update
npm test
```

### 4. Fix Breaking Changes
- Update deprecated API usage
- Adjust configuration
- Update types if TypeScript

## Common Migration Patterns

### Adding a Non-Nullable Column
```sql
-- 1. Add nullable column
ALTER TABLE users ADD COLUMN status VARCHAR(20);

-- 2. Backfill data
UPDATE users SET status = 'active' WHERE status IS NULL;

-- 3. Make non-nullable
ALTER TABLE users ALTER COLUMN status SET NOT NULL;
```

### Renaming a Column
```sql
-- 1. Add new column
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);

-- 2. Copy data
UPDATE users SET full_name = name;

-- 3. Update application to use new column

-- 4. Drop old column (after deployment)
ALTER TABLE users DROP COLUMN name;
```

### Zero-Downtime Deployment
1. Deploy code that handles both old and new schema
2. Run migration
3. Deploy code that uses only new schema
4. Clean up old schema support

## Migration Checklist

- [ ] Migration has both up and down methods
- [ ] Tested on copy of production data
- [ ] Backup created
- [ ] Rollback plan documented
- [ ] Team notified of migration window
- [ ] Monitoring in place
- [ ] Post-migration verification steps defined
