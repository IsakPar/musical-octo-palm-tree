---
name: github-actions
description: Set up CI/CD with GitHub Actions. Use when creating workflows, automating tests, or setting up deployment pipelines.
allowed-tools: Read, Write, Grep, Glob
---

# GitHub Actions

## Workflow Basics

### Workflow File Location
```
.github/workflows/
├── ci.yml          # Continuous integration
├── deploy.yml      # Deployment
└── release.yml     # Release process
```

### Basic Structure
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
```

## Common Workflows

### Node.js CI
```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

### Go CI
```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - run: go mod download
      - run: go vet ./...
      - run: go test -race ./...
```

### Python CI
```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r requirements.txt
      - run: pytest
```

### Docker Build and Push
```yaml
name: Docker

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
```

## Matrix Builds

### Multiple Versions
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

### Multiple OS
```yaml
jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - run: npm test
```

## Secrets and Environment

### Using Secrets
```yaml
steps:
  - run: echo "Deploying..."
    env:
      API_KEY: ${{ secrets.API_KEY }}
```

### Environments
```yaml
jobs:
  deploy:
    environment: production
    runs-on: ubuntu-latest
    steps:
      - run: deploy
        env:
          API_URL: ${{ vars.API_URL }}
```

## Caching

### npm
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

### Custom Cache
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

## Conditional Execution

```yaml
jobs:
  deploy:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest

  # Skip on draft PRs
  test:
    if: github.event.pull_request.draft == false
```

## Actions Checklist

- [ ] Checkout action included
- [ ] Caching configured for dependencies
- [ ] Secrets stored securely (not in workflow)
- [ ] Matrix builds for multiple versions if needed
- [ ] Environment-specific deployments
- [ ] Appropriate triggers (push, PR, etc.)
