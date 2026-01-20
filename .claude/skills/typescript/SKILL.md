---
name: typescript
description: Write TypeScript with best practices. Use when working with TypeScript, types, interfaces, or type-safe JavaScript.
allowed-tools: Read, Write, Grep, Glob
---

# TypeScript

## Type Basics

### Primitive Types
```typescript
const name: string = 'John';
const age: number = 30;
const active: boolean = true;
const data: null = null;
const nothing: undefined = undefined;
```

### Object Types
```typescript
// Interface (extendable)
interface User {
  id: string;
  name: string;
  email?: string;  // optional
  readonly createdAt: Date;  // immutable
}

// Type alias (more flexible)
type Status = 'active' | 'inactive' | 'pending';
type UserId = string;
type UserOrNull = User | null;
```

### Arrays and Tuples
```typescript
const numbers: number[] = [1, 2, 3];
const names: Array<string> = ['Alice', 'Bob'];
const tuple: [string, number] = ['John', 30];
```

### Functions
```typescript
// Function type
function greet(name: string): string {
  return `Hello, ${name}`;
}

// Arrow function
const add = (a: number, b: number): number => a + b;

// Optional and default parameters
function log(message: string, level: string = 'info'): void {
  console.log(`[${level}] ${message}`);
}

// Rest parameters
function sum(...numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}
```

## Advanced Types

### Union and Intersection
```typescript
// Union: one of multiple types
type StringOrNumber = string | number;

// Intersection: combine types
type WithTimestamps = {
  createdAt: Date;
  updatedAt: Date;
};
type UserWithTimestamps = User & WithTimestamps;
```

### Generics
```typescript
// Generic function
function first<T>(items: T[]): T | undefined {
  return items[0];
}

// Generic interface
interface ApiResponse<T> {
  data: T;
  error?: string;
}

// Generic with constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

### Utility Types
```typescript
// Partial: all properties optional
type PartialUser = Partial<User>;

// Required: all properties required
type RequiredUser = Required<User>;

// Pick: select properties
type UserName = Pick<User, 'id' | 'name'>;

// Omit: exclude properties
type UserWithoutId = Omit<User, 'id'>;

// Record: object with specific keys
type UserMap = Record<string, User>;

// Readonly: immutable
type ImmutableUser = Readonly<User>;
```

### Type Guards
```typescript
// typeof guard
function process(value: string | number) {
  if (typeof value === 'string') {
    return value.toUpperCase();
  }
  return value * 2;
}

// instanceof guard
function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

// Custom type guard
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj
  );
}
```

### Discriminated Unions
```typescript
type Success = { status: 'success'; data: string };
type Error = { status: 'error'; error: string };
type Result = Success | Error;

function handle(result: Result) {
  switch (result.status) {
    case 'success':
      console.log(result.data);  // TypeScript knows it's Success
      break;
    case 'error':
      console.log(result.error);  // TypeScript knows it's Error
      break;
  }
}
```

## Best Practices

### Avoid `any`
```typescript
// Bad
function parse(data: any): any {
  return JSON.parse(data);
}

// Good
function parse<T>(data: string): T {
  return JSON.parse(data) as T;
}

// Better: validate at runtime
function parseUser(data: string): User {
  const parsed = JSON.parse(data);
  if (!isUser(parsed)) {
    throw new Error('Invalid user data');
  }
  return parsed;
}
```

### Use Strict Config
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### Type Assertions Sparingly
```typescript
// Avoid when possible
const user = data as User;  // Could be wrong at runtime

// Prefer type guards
if (isUser(data)) {
  // data is User here
}
```

### Export Types
```typescript
// Export interface for consumers
export interface CreateUserInput {
  name: string;
  email: string;
}

export function createUser(input: CreateUserInput): User {
  // ...
}
```

## TypeScript Checklist

- [ ] strict mode enabled
- [ ] No `any` types (use `unknown` if needed)
- [ ] Interfaces for object shapes
- [ ] Type guards for runtime checks
- [ ] Generics for reusable code
- [ ] Exported types for public APIs
