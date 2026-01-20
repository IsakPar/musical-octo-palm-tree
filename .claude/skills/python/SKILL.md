---
name: python
description: Write Python with best practices. Use when working with Python, including type hints, async, and idiomatic patterns.
allowed-tools: Read, Write, Bash, Grep, Glob
---

# Python

## Type Hints

### Basic Types
```python
from typing import Optional, List, Dict, Union, Callable

name: str = "John"
age: int = 30
active: bool = True
scores: List[int] = [90, 85, 88]
config: Dict[str, str] = {"key": "value"}
maybe_name: Optional[str] = None
value: Union[str, int] = "hello"
```

### Function Types
```python
def greet(name: str) -> str:
    return f"Hello, {name}"

def process(callback: Callable[[int], str]) -> None:
    result = callback(42)
    print(result)

# Generic functions
from typing import TypeVar
T = TypeVar('T')

def first(items: List[T]) -> Optional[T]:
    return items[0] if items else None
```

### Classes
```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class User:
    id: str
    name: str
    email: Optional[str] = None

    def greet(self) -> str:
        return f"Hello, {self.name}"
```

## Error Handling

### Specific Exceptions
```python
# Bad
try:
    do_something()
except Exception:
    pass

# Good
try:
    do_something()
except ValueError as e:
    logger.error(f"Validation failed: {e}")
    raise
except ConnectionError as e:
    logger.error(f"Connection failed: {e}")
    raise
```

### Custom Exceptions
```python
class AppError(Exception):
    """Base exception for application errors."""
    pass

class UserNotFoundError(AppError):
    """Raised when user is not found."""
    def __init__(self, user_id: str):
        self.user_id = user_id
        super().__init__(f"User not found: {user_id}")
```

### Context Managers
```python
# Always use context managers for resources
with open("file.txt") as f:
    content = f.read()

# Custom context manager
from contextlib import contextmanager

@contextmanager
def timer(name: str):
    start = time.time()
    yield
    elapsed = time.time() - start
    print(f"{name} took {elapsed:.2f}s")

with timer("operation"):
    do_something()
```

## Common Patterns

### Data Classes
```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class User:
    name: str
    email: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=datetime.now)

    def __post_init__(self):
        self.email = self.email.lower()
```

### Pydantic Models
```python
from pydantic import BaseModel, EmailStr, validator

class User(BaseModel):
    name: str
    email: EmailStr
    age: int

    @validator('age')
    def check_age(cls, v):
        if v < 0:
            raise ValueError('Age must be positive')
        return v

    class Config:
        frozen = True  # Immutable

# Usage
user = User(name="John", email="john@example.com", age=30)
user_dict = user.dict()
user_json = user.json()
```

### Async/Await
```python
import asyncio
import aiohttp

async def fetch(url: str) -> str:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.text()

async def fetch_all(urls: List[str]) -> List[str]:
    tasks = [fetch(url) for url in urls]
    return await asyncio.gather(*tasks)

# Run
results = asyncio.run(fetch_all(["url1", "url2"]))
```

## Best Practices

### Use List Comprehensions
```python
# Instead of
result = []
for item in items:
    if item.active:
        result.append(item.name)

# Use comprehension
result = [item.name for item in items if item.active]

# Dict comprehension
user_map = {u.id: u for u in users}

# Generator for large data
names = (item.name for item in large_items)
```

### Avoid Mutable Default Arguments
```python
# Bad
def add_item(item, items=[]):
    items.append(item)
    return items

# Good
def add_item(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items
```

### Use Pathlib for Files
```python
from pathlib import Path

# Instead of os.path
path = Path(__file__).parent / "data" / "file.txt"
content = path.read_text()
path.write_text("content")

# Check existence
if path.exists():
    ...
```

### String Formatting
```python
name = "John"
age = 30

# f-strings (preferred)
message = f"Hello, {name}! You are {age} years old."

# For complex formatting
message = f"Value: {value:,.2f}"  # 1,234.56
```

## Testing

### pytest
```python
import pytest

def test_add():
    assert add(2, 3) == 5

def test_add_negative():
    assert add(-1, 1) == 0

# Fixtures
@pytest.fixture
def user():
    return User(name="Test", email="test@example.com")

def test_user_greet(user):
    assert user.greet() == "Hello, Test"

# Parametrize
@pytest.mark.parametrize("a,b,expected", [
    (2, 3, 5),
    (-1, 1, 0),
    (0, 0, 0),
])
def test_add_parametrized(a, b, expected):
    assert add(a, b) == expected
```

## Python Checklist

- [ ] Type hints on functions
- [ ] No mutable default arguments
- [ ] Context managers for resources
- [ ] Specific exception handling
- [ ] Dataclasses or Pydantic for data
- [ ] f-strings for formatting
- [ ] pathlib for file paths
- [ ] Tests with pytest
