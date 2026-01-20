---
name: react
description: Build React components with best practices. Use when working with React, JSX, hooks, or React-based frameworks like Next.js.
allowed-tools: Read, Write, Grep, Glob
---

# React Development

## Component Patterns

### Functional Components
```jsx
// Preferred: Functional component with hooks
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId).then(setUser).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Spinner />;
  if (!user) return <NotFound />;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

### Component Organization
```
components/
├── ui/                    # Reusable primitives
│   ├── Button.tsx
│   ├── Input.tsx
│   └── Modal.tsx
├── features/              # Feature-specific
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── SignupForm.tsx
│   └── dashboard/
│       └── DashboardCard.tsx
└── layout/                # Layout components
    ├── Header.tsx
    └── Sidebar.tsx
```

## Hooks Best Practices

### useState
```jsx
// Simple state
const [count, setCount] = useState(0);

// Object state - update immutably
const [user, setUser] = useState({ name: '', email: '' });
setUser(prev => ({ ...prev, name: 'John' }));

// Lazy initialization for expensive computations
const [data, setData] = useState(() => expensiveComputation());
```

### useEffect
```jsx
// Dependency array rules
useEffect(() => {
  // Runs on every render - usually wrong
});

useEffect(() => {
  // Runs once on mount
}, []);

useEffect(() => {
  // Runs when deps change
}, [dep1, dep2]);

// Cleanup
useEffect(() => {
  const subscription = subscribe();
  return () => subscription.unsubscribe();
}, []);
```

### useMemo and useCallback
```jsx
// Memoize expensive computations
const sortedList = useMemo(
  () => items.sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);

// Memoize callbacks passed to children
const handleClick = useCallback(
  () => doSomething(id),
  [id]
);
```

### Custom Hooks
```jsx
// Extract reusable logic
function useUser(userId) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchUser(userId)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  return { user, loading, error };
}

// Usage
function UserProfile({ userId }) {
  const { user, loading, error } = useUser(userId);
  // ...
}
```

## State Management

### When to Use What
- **useState**: Component-local state
- **useContext**: Shared state (theme, auth, etc.)
- **useReducer**: Complex state logic
- **External library**: Large-scale app state

### Context Pattern
```jsx
const ThemeContext = createContext();

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const toggle = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be within ThemeProvider');
  return context;
}
```

## Performance

### Avoid Re-renders
```jsx
// Split components to isolate state
function Parent() {
  return (
    <>
      <ExpensiveChild />  {/* Won't re-render when count changes */}
      <Counter />         {/* Has its own state */}
    </>
  );
}

// Use React.memo for pure components
const ExpensiveList = React.memo(function ExpensiveList({ items }) {
  return items.map(item => <Item key={item.id} {...item} />);
});
```

### Keys
```jsx
// Always use stable, unique keys
{items.map(item => (
  <Item key={item.id} {...item} />  // Good
))}

// Never use index as key for dynamic lists
{items.map((item, index) => (
  <Item key={index} {...item} />  // Bad - causes issues on reorder
))}
```

## React Checklist

- [ ] Components are small and focused
- [ ] Keys are stable and unique
- [ ] Effects have correct dependencies
- [ ] Cleanup in useEffect where needed
- [ ] Expensive computations memoized
- [ ] State lifted only as high as needed
- [ ] Error boundaries for error handling
