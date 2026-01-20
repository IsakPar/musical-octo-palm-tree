---
name: rust
description: Write Rust with safe and idiomatic patterns. Use when working with Rust, including ownership, lifetimes, and error handling.
allowed-tools: Read, Write, Bash, Grep, Glob
---

# Rust

## Ownership and Borrowing

### Ownership Rules
```rust
fn main() {
    let s1 = String::from("hello");  // s1 owns the String
    let s2 = s1;                      // Ownership moves to s2
    // println!("{}", s1);            // Error: s1 no longer valid
    println!("{}", s2);               // Works
}
```

### Borrowing
```rust
fn main() {
    let s = String::from("hello");

    // Immutable borrow
    let len = calculate_length(&s);
    println!("{} has length {}", s, len);  // s still valid

    // Mutable borrow
    let mut s = String::from("hello");
    change(&mut s);
}

fn calculate_length(s: &String) -> usize {
    s.len()
}

fn change(s: &mut String) {
    s.push_str(", world");
}
```

### Lifetimes
```rust
// Explicit lifetime annotation
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

// Struct with lifetime
struct Excerpt<'a> {
    part: &'a str,
}
```

## Error Handling

### Result Type
```rust
use std::fs::File;
use std::io::{self, Read};

fn read_file(path: &str) -> Result<String, io::Error> {
    let mut file = File::open(path)?;  // ? propagates error
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}
```

### Custom Errors
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("User not found: {0}")]
    UserNotFound(String),

    #[error("Database error")]
    Database(#[from] sqlx::Error),

    #[error("IO error")]
    Io(#[from] std::io::Error),
}
```

### Option Type
```rust
fn find_user(id: &str) -> Option<User> {
    users.get(id).cloned()
}

// Using Option
if let Some(user) = find_user("123") {
    println!("Found: {}", user.name);
}

// Or with combinators
let name = find_user("123")
    .map(|u| u.name)
    .unwrap_or_default();
```

## Structs and Enums

### Structs
```rust
#[derive(Debug, Clone, PartialEq)]
pub struct User {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
}

impl User {
    pub fn new(name: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            email: None,
        }
    }

    pub fn with_email(mut self, email: String) -> Self {
        self.email = Some(email);
        self
    }
}
```

### Enums
```rust
#[derive(Debug)]
pub enum Status {
    Active,
    Inactive,
    Pending { reason: String },
}

impl Status {
    pub fn is_active(&self) -> bool {
        matches!(self, Status::Active)
    }
}
```

## Traits

### Defining Traits
```rust
pub trait Repository<T> {
    fn find(&self, id: &str) -> Option<T>;
    fn save(&mut self, item: T) -> Result<(), Error>;
}

impl Repository<User> for InMemoryUserRepo {
    fn find(&self, id: &str) -> Option<User> {
        self.users.get(id).cloned()
    }

    fn save(&mut self, user: User) -> Result<(), Error> {
        self.users.insert(user.id.clone(), user);
        Ok(())
    }
}
```

### Common Traits to Derive
```rust
#[derive(Debug)]      // Debug formatting
#[derive(Clone)]      // Clone method
#[derive(PartialEq)]  // Equality comparison
#[derive(Eq)]         // Full equality
#[derive(Hash)]       // Hashing
#[derive(Default)]    // Default value
#[derive(Serialize, Deserialize)]  // serde
```

## Async Rust

### Async Functions
```rust
use tokio;

async fn fetch_data(url: &str) -> Result<String, reqwest::Error> {
    let response = reqwest::get(url).await?;
    let body = response.text().await?;
    Ok(body)
}

#[tokio::main]
async fn main() {
    let data = fetch_data("https://api.example.com").await.unwrap();
    println!("{}", data);
}
```

### Concurrent Execution
```rust
use futures::future::join_all;

async fn fetch_all(urls: Vec<&str>) -> Vec<String> {
    let futures: Vec<_> = urls.iter()
        .map(|url| fetch_data(url))
        .collect();

    join_all(futures).await
        .into_iter()
        .filter_map(|r| r.ok())
        .collect()
}
```

## Best Practices

### Avoid .unwrap() in Production
```rust
// Bad
let user = find_user(id).unwrap();

// Good
let user = find_user(id).ok_or(AppError::UserNotFound(id))?;

// Or with match
match find_user(id) {
    Some(user) => process(user),
    None => log::warn!("User not found"),
}
```

### Prefer Iterators Over Loops
```rust
// Instead of
let mut results = Vec::new();
for item in items {
    if item.active {
        results.push(item.name.clone());
    }
}

// Use iterators
let results: Vec<_> = items.iter()
    .filter(|i| i.active)
    .map(|i| i.name.clone())
    .collect();
```

## Rust Checklist

- [ ] No .unwrap() in production code
- [ ] Errors have context (use thiserror or anyhow)
- [ ] Derive common traits (Debug, Clone, etc.)
- [ ] Use iterators over explicit loops
- [ ] Lifetimes explicit where needed
- [ ] Tests in same file with #[cfg(test)]
