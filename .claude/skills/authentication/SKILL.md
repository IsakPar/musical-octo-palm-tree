---
name: authentication
description: Implement secure authentication and authorization. Use when working on login, signup, sessions, JWT, or access control.
allowed-tools: Read, Write, Grep, Glob
---

# Authentication & Authorization

## Authentication Methods

### Session-Based
```javascript
// Login: Create session
const sessionId = crypto.randomUUID();
await sessions.create({
  id: sessionId,
  userId: user.id,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
});
res.cookie('session', sessionId, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict'
});

// Middleware: Validate session
const session = await sessions.findById(req.cookies.session);
if (!session || session.expiresAt < new Date()) {
  throw new UnauthorizedError();
}
req.user = await users.findById(session.userId);
```

### JWT-Based
```javascript
// Login: Generate tokens
const accessToken = jwt.sign(
  { sub: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '15m' }
);
const refreshToken = jwt.sign(
  { sub: user.id },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: '7d' }
);

// Middleware: Validate token
const token = req.headers.authorization?.split(' ')[1];
const payload = jwt.verify(token, process.env.JWT_SECRET);
req.user = await users.findById(payload.sub);
```

## Password Security

### Hashing
```javascript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

// Hash password (registration)
const hash = await bcrypt.hash(password, SALT_ROUNDS);

// Verify password (login)
const valid = await bcrypt.compare(password, user.passwordHash);
```

### Password Requirements
- Minimum 8 characters
- Check against common passwords
- Don't limit maximum length unreasonably
- Don't require special characters (length > complexity)

## Authorization Patterns

### Role-Based (RBAC)
```javascript
const PERMISSIONS = {
  admin: ['read', 'write', 'delete', 'manage_users'],
  editor: ['read', 'write'],
  viewer: ['read']
};

function requirePermission(permission) {
  return (req, res, next) => {
    const userPermissions = PERMISSIONS[req.user.role] || [];
    if (!userPermissions.includes(permission)) {
      throw new ForbiddenError();
    }
    next();
  };
}

app.delete('/posts/:id', requirePermission('delete'), deletePost);
```

### Resource-Based
```javascript
async function canEditPost(user, post) {
  // Owner can edit
  if (post.authorId === user.id) return true;
  // Admins can edit
  if (user.role === 'admin') return true;
  return false;
}

app.patch('/posts/:id', async (req, res) => {
  const post = await posts.findById(req.params.id);
  if (!await canEditPost(req.user, post)) {
    throw new ForbiddenError();
  }
  // ... update post
});
```

## Security Best Practices

### Cookie Settings
```javascript
res.cookie('session', token, {
  httpOnly: true,    // Not accessible via JavaScript
  secure: true,      // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 86400000   // 24 hours
});
```

### Token Storage
- Access tokens: Memory (not localStorage)
- Refresh tokens: httpOnly cookie
- Never store tokens in localStorage (XSS vulnerable)

### Rate Limiting
```javascript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts'
});

app.post('/login', loginLimiter, login);
```

## Auth Checklist

- [ ] Passwords hashed with bcrypt/argon2
- [ ] Tokens have reasonable expiration
- [ ] Cookies are httpOnly and secure
- [ ] Rate limiting on auth endpoints
- [ ] Session invalidation on logout
- [ ] CSRF protection in place
- [ ] Password reset flow is secure
