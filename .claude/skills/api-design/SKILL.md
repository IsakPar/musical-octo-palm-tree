---
name: api-design
description: Design REST and GraphQL APIs with best practices. Use when creating API endpoints, designing schemas, or working on backend interfaces.
allowed-tools: Read, Write, Grep, Glob
---

# API Design

## REST API Conventions

### HTTP Methods
| Method | Purpose | Idempotent |
|--------|---------|------------|
| GET | Read resource | Yes |
| POST | Create resource | No |
| PUT | Replace resource | Yes |
| PATCH | Update resource | Yes |
| DELETE | Remove resource | Yes |

### URL Patterns
```
# Resources (nouns, plural)
GET    /users          # List users
POST   /users          # Create user
GET    /users/{id}     # Get user
PUT    /users/{id}     # Replace user
PATCH  /users/{id}     # Update user
DELETE /users/{id}     # Delete user

# Nested resources
GET    /users/{id}/posts     # User's posts
POST   /users/{id}/posts     # Create post for user

# Actions (when CRUD doesn't fit)
POST   /users/{id}/verify    # Non-CRUD action
```

### Status Codes
```
2xx Success
200 OK              - Successful GET/PUT/PATCH
201 Created         - Successful POST
204 No Content      - Successful DELETE

4xx Client Error
400 Bad Request     - Invalid input
401 Unauthorized    - Not authenticated
403 Forbidden       - Not authorized
404 Not Found       - Resource doesn't exist
409 Conflict        - Resource conflict
422 Unprocessable   - Validation failed

5xx Server Error
500 Internal Error  - Server error
503 Unavailable     - Service down
```

### Response Format
```json
// Success
{
  "data": { "id": "123", "name": "Example" },
  "meta": { "page": 1, "total": 100 }
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [
      { "field": "email", "message": "Must be valid email" }
    ]
  }
}
```

## API Design Principles

### Consistency
- Same naming conventions everywhere
- Same response format for all endpoints
- Same error handling pattern

### Versioning
```
# URL versioning (recommended)
/api/v1/users
/api/v2/users

# Header versioning
Accept: application/vnd.api+json;version=1
```

### Pagination
```json
// Cursor-based (recommended for large datasets)
{
  "data": [...],
  "pagination": {
    "next_cursor": "abc123",
    "has_more": true
  }
}

// Offset-based (simpler, but slower for large offsets)
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 100
  }
}
```

### Filtering and Sorting
```
GET /users?status=active&role=admin
GET /users?sort=created_at:desc
GET /users?fields=id,name,email
```

## Security

### Authentication
- Use Bearer tokens in Authorization header
- Never pass tokens in URLs
- Implement token expiration and refresh

### Authorization
- Check permissions on every request
- Validate resource ownership
- Use role-based access control

### Input Validation
- Validate all input server-side
- Sanitize data before use
- Return clear validation errors

### Rate Limiting
```
Headers:
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

## API Checklist

- [ ] Consistent naming conventions
- [ ] Proper HTTP methods and status codes
- [ ] Pagination for list endpoints
- [ ] Input validation
- [ ] Authentication/authorization
- [ ] Rate limiting
- [ ] Error handling with clear messages
- [ ] API documentation
